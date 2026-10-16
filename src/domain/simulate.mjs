import { createSeededRandom } from './random.mjs';
import { settingSpec } from './machine.mjs';

function roundCoins(value) {
  return Number(value.toFixed(6));
}

export function createSettingModel(machine, setting) {
  const spec = settingSpec(machine, setting);
  const roles = machine.smallRoles;
  const probabilities = {
    big: 1 / spec.bigDenominator,
    regular: 1 / spec.regularDenominator,
    bell: 1 / roles.bellDenominators[spec.setting - 1],
    replay: 1 / roles.replayDenominator,
    cherry: 1 / roles.cherryDenominator,
    watermelon: 1 / roles.watermelonDenominator,
  };
  const baseExpectedNetPerGame = -machine.betCoinsPerGame
    + probabilities.big * machine.bigPayoutCoins
    + probabilities.regular * machine.regularPayoutCoins
    + probabilities.bell * roles.payouts.bell
    + probabilities.replay * roles.payouts.replay
    + probabilities.cherry * roles.payouts.cherry
    + probabilities.watermelon * roles.payouts.watermelon;
  const targetExpectedNetPerGame = machine.betCoinsPerGame * (spec.payoutRate - 1);

  return Object.freeze({
    spec,
    probabilities: Object.freeze(probabilities),
    calibrationPerGame: targetExpectedNetPerGame - baseExpectedNetPerGame,
    expectedNetPerGame: targetExpectedNetPerGame,
    modelKind: 'official-bonus-plus-estimated-small-roles-calibrated-to-official-payout',
  });
}

function outcomeForRoll(roll, model, machine) {
  const { probabilities } = model;
  let edge = probabilities.big;
  if (roll < edge) return { type: 'BB', payout: machine.bigPayoutCoins };
  edge += probabilities.regular;
  if (roll < edge) return { type: 'REG', payout: machine.regularPayoutCoins };
  edge += probabilities.bell;
  if (roll < edge) return { type: 'bell', payout: machine.smallRoles.payouts.bell };
  edge += probabilities.replay;
  if (roll < edge) return { type: 'replay', payout: machine.smallRoles.payouts.replay };
  edge += probabilities.cherry;
  if (roll < edge) return { type: 'cherry', payout: machine.smallRoles.payouts.cherry };
  edge += probabilities.watermelon;
  if (roll < edge) return { type: 'watermelon', payout: machine.smallRoles.payouts.watermelon };
  return { type: 'miss', payout: 0 };
}

export function simulateSession({ machine, setting, games, seed, pathInterval = 100 }) {
  if (!Number.isInteger(games) || games < 0) throw new RangeError('games must be a non-negative integer');
  const model = createSettingModel(machine, setting);
  const random = createSeededRandom(seed);
  const events = [];
  const path = [{ game: 0, coins: 0 }];
  let coins = 0;
  let bigCount = 0;
  let regularCount = 0;
  let peakCoins = 0;
  let peakGame = 0;
  let maxDrawdown = 0;
  let troughCoins = 0;
  let peakHeldCoins = 0;
  let peakHeldGame = 0;
  let maxDroughtGames = 0;
  let lastBonusGame = 0;

  for (let game = 1; game <= games; game += 1) {
    const outcome = outcomeForRoll(random.next(), model, machine);
    coins += -machine.betCoinsPerGame + model.calibrationPerGame + outcome.payout;

    if (outcome.type === 'BB' || outcome.type === 'REG') {
      const intervalGames = game - lastBonusGame;
      maxDroughtGames = Math.max(maxDroughtGames, intervalGames);
      lastBonusGame = game;
      if (outcome.type === 'BB') bigCount += 1;
      else regularCount += 1;
      events.push({
        game,
        type: outcome.type,
        intervalGames,
        payoutCoins: outcome.payout,
        coinsAfter: roundCoins(coins),
      });
    }

    if (coins > peakCoins) {
      peakCoins = coins;
      peakGame = game;
    }
    maxDrawdown = Math.max(maxDrawdown, peakCoins - coins);
    // 持ちメダル: 手持ちが尽きた時点で現金投資に切り替わるため、差枚からそれまでの最低差枚を引いた値になる
    if (coins < troughCoins) troughCoins = coins;
    if (coins - troughCoins > peakHeldCoins) {
      peakHeldCoins = coins - troughCoins;
      peakHeldGame = game;
    }

    if (game % pathInterval === 0 || game === games) {
      path.push({ game, coins: roundCoins(coins) });
    }
  }

  maxDroughtGames = Math.max(maxDroughtGames, games - lastBonusGame);
  const finalCoins = roundCoins(coins);
  const roundedPeak = roundCoins(peakCoins);

  return {
    setting: model.spec.setting,
    games,
    seed,
    bigCount,
    regularCount,
    finalCoins,
    peakCoins: roundedPeak,
    peakGame,
    peakToEndDrawdown: roundCoins(roundedPeak - finalCoins),
    maxDrawdown: roundCoins(maxDrawdown),
    peakHeldCoins: roundCoins(peakHeldCoins),
    peakHeldGame,
    maxDroughtGames,
    events,
    path,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalSampler(random) {
  let spare = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }

    let first = 0;
    let second = 0;
    while (first <= Number.EPSILON) first = random.next();
    second = random.next();
    const magnitude = Math.sqrt(-2 * Math.log(first));
    spare = magnitude * Math.sin(2 * Math.PI * second);
    return magnitude * Math.cos(2 * Math.PI * second);
  };
}

function sampleRareBinomial(trials, probability, random) {
  if (probability <= 0 || trials === 0) return 0;
  const logFailure = Math.log1p(-probability);
  let successes = 0;
  let position = 0;

  while (position < trials) {
    const uniform = Math.max(random.next(), Number.MIN_VALUE);
    const failuresBeforeSuccess = Math.floor(Math.log(uniform) / logFailure);
    position += failuresBeforeSuccess + 1;
    if (position <= trials) successes += 1;
  }

  return successes;
}

function sampleBinomial(trials, probability, random, sampleNormal) {
  if (trials <= 0 || probability <= 0) return 0;
  if (probability >= 1) return trials;

  const expectedSuccesses = trials * probability;
  const expectedFailures = trials * (1 - probability);
  if (expectedSuccesses < 30) return sampleRareBinomial(trials, probability, random);
  if (expectedFailures < 30) return trials - sampleRareBinomial(trials, 1 - probability, random);

  const approximate = Math.round(
    expectedSuccesses + Math.sqrt(trials * probability * (1 - probability)) * sampleNormal(),
  );
  return clamp(approximate, 0, trials);
}

function sampleOutcomeCounts(games, model, random, sampleNormal) {
  const probabilities = model.probabilities;
  const ordered = [
    ['big', probabilities.big],
    ['regular', probabilities.regular],
    ['bell', probabilities.bell],
    ['replay', probabilities.replay],
    ['cherry', probabilities.cherry],
    ['watermelon', probabilities.watermelon],
  ];
  const counts = {};
  let remainingGames = games;
  let remainingProbability = 1;

  for (const [name, probability] of ordered) {
    const conditionalProbability = probability / remainingProbability;
    const count = sampleBinomial(remainingGames, conditionalProbability, random, sampleNormal);
    counts[name] = count;
    remainingGames -= count;
    remainingProbability -= probability;
  }

  return counts;
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values, average) {
  if (values.length < 2) return 0;
  const squaredErrors = values.reduce((sum, value) => sum + (value - average) ** 2, 0);
  return Math.sqrt(squaredErrors / (values.length - 1));
}

function quantile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  const position = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const weight = position - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function describe(values) {
  const average = mean(values);
  const standardDeviation = sampleStandardDeviation(values, average);
  const standardError = values.length > 0 ? standardDeviation / Math.sqrt(values.length) : 0;
  const sorted = [...values].sort((left, right) => left - right);
  const percentiles = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95];
  const quantiles = Object.fromEntries(
    percentiles.map((percentile) => [percentile, roundCoins(quantile(sorted, percentile))]),
  );

  return {
    mean: roundCoins(average),
    standardDeviation: roundCoins(standardDeviation),
    standardError: roundCoins(standardError),
    meanInterval: {
      low: roundCoins(average - 1.96 * standardError),
      high: roundCoins(average + 1.96 * standardError),
    },
    quantiles,
    minimum: roundCoins(sorted[0] ?? 0),
    maximum: roundCoins(sorted.at(-1) ?? 0),
  };
}

function wilsonInterval(successes, trials) {
  if (trials === 0) return { low: 0, high: 0 };
  const z = 1.96;
  const rate = successes / trials;
  const denominator = 1 + (z ** 2) / trials;
  const centre = rate + (z ** 2) / (2 * trials);
  const margin = z * Math.sqrt((rate * (1 - rate) + (z ** 2) / (4 * trials)) / trials);
  return {
    low: roundCoins((centre - margin) / denominator),
    high: roundCoins((centre + margin) / denominator),
  };
}

function mixedSeed(seed, setting, sequence) {
  const base = Math.trunc(Number(seed)) || 1;
  return base + setting * 1_000_003 + sequence * 97_409;
}

function chooseRepresentativeRuns(runs) {
  if (runs.length === 0) return [];
  const ordered = [...runs].sort((left, right) => left.finalCoins - right.finalCoins);
  return [0.1, 0.25, 0.5, 0.75, 0.9].map((percentile) => {
    const index = Math.round((ordered.length - 1) * percentile);
    return { percentile, ...ordered[index] };
  });
}

function validateSimulationInput({ games, trials, settings, riskSampleTrials }) {
  if (!Number.isInteger(games) || games <= 0) throw new RangeError('games must be a positive integer');
  if (!Number.isInteger(trials) || trials <= 0) throw new RangeError('trials must be a positive integer');
  if (!Array.isArray(settings) || settings.length === 0) throw new RangeError('settings must not be empty');
  if (!Number.isInteger(riskSampleTrials) || riskSampleTrials < 0) {
    throw new RangeError('riskSampleTrials must be a non-negative integer');
  }
}

function summarizeSetting({ machine, setting, games, trials, seed, riskSampleTrials }) {
  const model = createSettingModel(machine, setting);
  const random = createSeededRandom(mixedSeed(seed, setting, 0));
  const sampleNormal = normalSampler(random);
  const finalCoins = [];
  const bigCounts = [];
  const regularCounts = [];
  let wins = 0;

  for (let trial = 0; trial < trials; trial += 1) {
    const counts = sampleOutcomeCounts(games, model, random, sampleNormal);
    const coins = -machine.betCoinsPerGame * games
      + model.calibrationPerGame * games
      + counts.big * machine.bigPayoutCoins
      + counts.regular * machine.regularPayoutCoins
      + counts.bell * machine.smallRoles.payouts.bell
      + counts.replay * machine.smallRoles.payouts.replay
      + counts.cherry * machine.smallRoles.payouts.cherry
      + counts.watermelon * machine.smallRoles.payouts.watermelon;
    const roundedCoins = roundCoins(coins);
    finalCoins.push(roundedCoins);
    bigCounts.push(counts.big);
    regularCounts.push(counts.regular);
    if (roundedCoins > 0) wins += 1;
  }

  const pathTrialCount = Math.min(riskSampleTrials, trials);
  const pathRuns = Array.from({ length: pathTrialCount }, (_, index) => simulateSession({
    machine,
    setting,
    games,
    seed: mixedSeed(seed, setting, index + 1),
  }));
  const winRate = wins / trials;

  return {
    setting,
    payoutRate: model.spec.payoutRate,
    trials,
    finalCoins: describe(finalCoins),
    bigCount: describe(bigCounts),
    regularCount: describe(regularCounts),
    winRate: roundCoins(winRate),
    winRateInterval: wilsonInterval(wins, trials),
    representativeRuns: chooseRepresentativeRuns(pathRuns),
    riskSampleTrials: pathTrialCount,
    modelKind: model.modelKind,
  };
}

export function runSimulation({
  machine,
  games,
  trials,
  settings = machine?.settings.map((row) => row.setting) ?? [],
  seed = 1,
  riskSampleTrials = 100,
  onProgress = () => {},
  shouldCancel = () => false,
}) {
  validateSimulationInput({ games, trials, settings, riskSampleTrials });
  const summaries = [];

  for (const setting of settings) {
    if (shouldCancel()) {
      return { machineId: machine.id, games, trials, seed, cancelled: true, summaries };
    }
    summaries.push(summarizeSetting({ machine, setting, games, trials, seed, riskSampleTrials }));
    onProgress({
      completedSettings: summaries.length,
      totalSettings: settings.length,
      setting,
    });
  }

  return { machineId: machine.id, games, trials, seed, cancelled: false, summaries };
}
