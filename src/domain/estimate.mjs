// 確率0の示唆が出た設定を「ほぼ否定」として扱うための下限。log(0) を避けつつ、
// 0.2%の確定系示唆（REG後の色）に対して 1/200,000 まで重みを落とす。
const PROBABILITY_FLOOR = 1e-9;

function normalizeLogWeights(logWeights) {
  const max = Math.max(...logWeights);
  const weights = logWeights.map((value) => Math.exp(value - max));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

function normalizePrior(prior, length) {
  if (prior === undefined) return Array(length).fill(1 / length);
  if (!Array.isArray(prior) || prior.length !== length || prior.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError(`Prior must contain ${length} positive numbers`);
  }
  const total = prior.reduce((sum, value) => sum + value, 0);
  return prior.map((value) => value / total);
}

function rank(probabilities, settings) {
  return probabilities
    .map((probability, index) => ({ setting: settings[index].setting, probability }))
    .sort((left, right) => right.probability - left.probability);
}

function validateCount(name, value) {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer`);
}

function safeLog(probability) {
  return Math.log(Math.max(probability, PROBABILITY_FLOOR));
}

function readCount(observed, key, label) {
  const value = observed?.[key] ?? 0;
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${label}は0以上の整数で入力してください。`);
  return value;
}

function bonusLogLikelihoods(machine, games, big, regular) {
  return machine.settings.map((spec) => {
    if (games === 0) return 0;
    const bigMean = games / spec.bigDenominator;
    const regularMean = games / spec.regularDenominator;
    return big * Math.log(bigMean) - bigMean + regular * Math.log(regularMean) - regularMean;
  });
}

function binomialEvidence(definition, observed, settingCount) {
  const count = readCount(observed, definition.id, definition.label);
  const bonuses = readCount(observed, definition.trials.from, `${definition.label}の対象ボーナス数`);
  const trials = bonuses * definition.trials.gamesPerBonus;
  if (count > trials) {
    throw new RangeError(`${definition.label}の回数（${count}）が対象ゲーム数（${trials}）を超えています。`);
  }
  const used = trials > 0;
  const logs = Array.from({ length: settingCount }, (_, index) => {
    if (!used) return 0;
    const probability = 1 / definition.denominators[index];
    return count * Math.log(probability) + (trials - count) * Math.log(1 - probability);
  });
  return { logs, used, eliminated: Array(settingCount).fill(false), observedCount: count, trials };
}

function categoricalEvidence(definition, observed, settingCount) {
  const counts = observed?.[definition.id] ?? {};
  const categoryCounts = definition.categories.map((category) => readCount(counts, category, `${definition.label}の${definition.categoryLabels?.[category] ?? category}`));
  const total = categoryCounts.reduce((sum, value) => sum + value, 0);
  let remainderCount = 0;
  if (definition.remainder) {
    const base = readCount(observed, definition.remainder.from, `${definition.label}の対象ボーナス数`);
    if (total > base) {
      throw new RangeError(`${definition.label}の色の合計（${total}）が対象ボーナス数（${base}）を超えています。`);
    }
    remainderCount = base - total;
  }
  const used = total > 0 || remainderCount > 0;
  const eliminated = Array(settingCount).fill(false);
  const logs = Array.from({ length: settingCount }, (_, index) => {
    if (!used) return 0;
    const rates = definition.categories.map((category) => definition.ratesPercent[category][index] / 100);
    const colouredTotal = rates.reduce((sum, value) => sum + value, 0);
    let remainderRate = 0;
    let normalizedRates = rates;
    if (definition.remainder) {
      remainderRate = Math.max(0, 1 - colouredTotal);
    } else if (colouredTotal > 0) {
      normalizedRates = rates.map((value) => value / colouredTotal);
    }
    let log = 0;
    categoryCounts.forEach((count, categoryIndex) => {
      if (count === 0) return;
      if (normalizedRates[categoryIndex] <= 0) eliminated[index] = true;
      log += count * safeLog(normalizedRates[categoryIndex]);
    });
    if (remainderCount > 0) log += remainderCount * safeLog(remainderRate);
    return log;
  });
  return {
    logs,
    used,
    eliminated,
    observedCount: total,
    trials: total + remainderCount,
    remainderCount: definition.remainder ? remainderCount : undefined,
  };
}

function evidenceGroup(definition, observed, settingCount) {
  if (definition.kind === 'binomial') return binomialEvidence(definition, observed, settingCount);
  if (definition.kind === 'categorical') return categoricalEvidence(definition, observed, settingCount);
  throw new RangeError(`Unknown evidence kind: ${definition.kind}`);
}

function tierProbabilities(probabilities, settings) {
  const sumWhere = (predicate) => probabilities.reduce((sum, value, index) => (predicate(settings[index].setting) ? sum + value : sum), 0);
  return {
    atLeast4: sumWhere((setting) => setting >= 4),
    atLeast5: sumWhere((setting) => setting >= 5),
    exactly6: sumWhere((setting) => setting === 6),
  };
}

export function estimateSettings({ machine, games, big, regular, prior, observed, useAnalysisEvidence = true }) {
  validateCount('games', games);
  validateCount('big', big);
  validateCount('regular', regular);

  const settingCount = machine.settings.length;
  const bonusLogs = bonusLogLikelihoods(machine, games, big, regular);
  const contributions = [{
    id: 'bonus',
    label: 'ボーナス確率',
    sourceKind: 'official',
    used: games > 0,
    fit: games > 0 ? normalizeLogWeights(bonusLogs) : null,
    eliminated: Array(settingCount).fill(false),
  }];

  const totalLogs = [...bonusLogs];
  const eliminated = Array(settingCount).fill(false);
  let usesAnalysisEvidence = false;

  for (const definition of machine.evidence ?? []) {
    const isAnalysisValue = definition.source?.kind !== 'official';
    if (isAnalysisValue && !useAnalysisEvidence) {
      contributions.push({ id: definition.id, label: definition.label, sourceKind: definition.source?.kind ?? 'estimate', used: false, disabled: true, fit: null, eliminated: Array(settingCount).fill(false) });
      continue;
    }
    const group = evidenceGroup(definition, observed, settingCount);
    if (group.used) {
      if (isAnalysisValue) usesAnalysisEvidence = true;
      group.logs.forEach((value, index) => { totalLogs[index] += value; });
      group.eliminated.forEach((flag, index) => { if (flag) eliminated[index] = true; });
    }
    contributions.push({
      id: definition.id,
      label: definition.label,
      kind: definition.kind,
      sourceKind: definition.source?.kind ?? 'estimate',
      used: group.used,
      fit: group.used ? normalizeLogWeights(group.logs) : null,
      eliminated: group.eliminated,
      observedCount: group.observedCount,
      remainderCount: group.remainderCount,
      trials: group.trials,
    });
  }

  const fit = normalizeLogWeights(totalLogs);
  const normalizedPrior = normalizePrior(prior, settingCount);
  const posterior = normalizeLogWeights(totalLogs.map((value, index) => value + Math.log(normalizedPrior[index])));
  const fitRank = rank(fit, machine.settings);
  const posteriorRank = rank(posterior, machine.settings);
  const evidenceRatio = fitRank[1].probability === 0 ? Infinity : fitRank[0].probability / fitRank[1].probability;
  const evidenceLabel = games < 1_000
    ? 'sample-short'
    : evidenceRatio < 3
      ? 'weak'
      : evidenceRatio < 10
        ? 'reference'
        : 'strong';
  const maxShift = Math.max(...fit.map((value, index) => Math.abs(value - posterior[index])));

  return {
    fit,
    posterior,
    top: fitRank[0],
    runnerUp: fitRank[1],
    posteriorTop: posteriorRank[0],
    evidence: { ratio: evidenceRatio, label: evidenceLabel },
    sensitivity: {
      warn: fitRank[0].setting !== posteriorRank[0].setting || maxShift >= 0.15,
      topChanged: fitRank[0].setting !== posteriorRank[0].setting,
      maxShift,
    },
    tiers: tierProbabilities(fit, machine.settings),
    posteriorTiers: tierProbabilities(posterior, machine.settings),
    contributions,
    eliminated,
    usesAnalysisEvidence,
  };
}
