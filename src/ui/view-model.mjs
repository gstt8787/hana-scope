const percentFormatter = new Intl.NumberFormat('ja-JP', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCoins(value) {
  const rounded = Math.round(value);
  if (rounded === 0) return '±0枚';
  const sign = rounded > 0 ? '+' : '-';
  return `${sign}${Math.abs(rounded).toLocaleString('ja-JP')}枚`;
}

export function formatPercent(value) {
  return `${percentFormatter.format(value * 100)}%`;
}

const evidenceLabels = {
  'sample-short': 'サンプル不足',
  weak: 'まだ断定不可',
  reference: '参考差あり',
  strong: '大きな差あり',
};

const tierLabels = [
  ['atLeast4', '設定4以上'],
  ['atLeast5', '設定5以上'],
  ['exactly6', '設定6'],
];

function contributionStatus(group) {
  if (group.disabled) return 'オフ';
  if (!group.used || !group.fit) return '未入力';
  if (group.id === 'regSideLamp') {
    const oddMass = group.fit[0] + group.fit[2] + group.fit[4];
    if (oddMass >= 0.6) return '奇数寄り';
    if (oddMass <= 0.4) return '偶数寄り';
    return '奇偶の差なし';
  }
  const topIndex = group.fit.reduce((best, value, index) => (value > group.fit[best] ? index : best), 0);
  return `設定${topIndex + 1}寄り`;
}

function contributionCountText(group) {
  if (!group.used || !Number.isFinite(group.observedCount)) return '';
  if (Number.isFinite(group.remainderCount)) return `色${group.observedCount}回・白${group.remainderCount}回`;
  if (group.kind === 'binomial' && Number.isFinite(group.trials)) return `${group.observedCount}回/${group.trials}G`;
  return `${group.observedCount}回`;
}

function contributionBars(fit) {
  if (!fit) return null;
  const max = Math.max(...fit);
  return fit.map((probability, index) => ({
    setting: index + 1,
    height: `${max > 0 ? (probability / max) * 100 : 0}%`,
    isTop: probability === max,
  }));
}

export function buildEstimateViewModel(result) {
  const maxProbability = Math.max(...result.fit);
  const eliminated = result.eliminated ?? [];
  return {
    topLabel: `設定${result.top.setting}`,
    topProbability: formatPercent(result.top.probability),
    runnerUpText: `設定${result.runnerUp.setting} ${formatPercent(result.runnerUp.probability)}`,
    evidenceText: evidenceLabels[result.evidence.label] ?? '参考値',
    rows: result.fit.map((probability, index) => ({
      setting: index + 1,
      probability,
      probabilityText: eliminated[index] ? '否定' : formatPercent(probability),
      barWidth: `${(probability / maxProbability) * 100}%`,
      isTop: index + 1 === result.top.setting,
      isEliminated: Boolean(eliminated[index]),
    })),
    sensitivityWarning: result.sensitivity.warn,
    tiers: result.tiers
      ? tierLabels.map(([key, label]) => ({ key, label, text: formatPercent(result.tiers[key]) }))
      : [],
    contributions: (result.contributions ?? []).map((group) => ({
      id: group.id,
      label: group.label,
      statusText: contributionStatus(group),
      sourceText: group.sourceKind === 'official' ? '公式' : '解析値',
      countText: contributionCountText(group),
      bars: contributionBars(group.fit),
    })),
    usesAnalysisEvidence: Boolean(result.usesAnalysisEvidence),
    hasEliminated: eliminated.some(Boolean),
  };
}

function compactTrialCount(trials) {
  if (trials >= 10_000 && trials % 10_000 === 0) return `${trials / 10_000}万`;
  return trials.toLocaleString('ja-JP');
}

export function buildSimulationViewModel(result, { coinValueYen = 20 } = {}) {
  const lowValues = result.summaries.map((summary) => summary.finalCoins.quantiles[0.1]);
  const highValues = result.summaries.map((summary) => summary.finalCoins.quantiles[0.9]);
  const scaleMinimum = Math.min(...lowValues);
  const scaleMaximum = Math.max(...highValues);
  const scaleWidth = Math.max(1, scaleMaximum - scaleMinimum);

  return {
    title: `${result.games.toLocaleString('ja-JP')}Gのブレを${compactTrialCount(result.trials)}回ぶん見る`,
    gamesText: `${result.games.toLocaleString('ja-JP')}G`,
    trialsText: `${result.trials.toLocaleString('ja-JP')}回`,
    rows: result.summaries.map((summary) => {
      const low = summary.finalCoins.quantiles[0.1];
      const median = summary.finalCoins.quantiles[0.5];
      const high = summary.finalCoins.quantiles[0.9];
      const meanCoins = summary.finalCoins.mean;
      return {
        setting: summary.setting,
        payoutRateText: formatPercent(summary.payoutRate),
        meanCoinsText: formatCoins(meanCoins),
        meanCashText: formatCash(meanCoins * coinValueYen),
        meanBonusText: `BIG ${summary.bigCount.mean.toFixed(1)} / REG ${summary.regularCount.mean.toFixed(1)}`,
        winRateText: formatPercent(summary.winRate),
        winRateRangeText: `${formatPercent(summary.winRateInterval.low)}–${formatPercent(summary.winRateInterval.high)}`,
        rangeLeft: ((low - scaleMinimum) / scaleWidth) * 100,
        rangeWidth: ((high - low) / scaleWidth) * 100,
        medianLeft: ((median - scaleMinimum) / scaleWidth) * 100,
        tone: meanCoins > 0 ? 'positive' : meanCoins < 0 ? 'negative' : 'neutral',
      };
    }),
  };
}

function formatCash(value) {
  const rounded = Math.round(value);
  if (rounded === 0) return '±0円';
  const sign = rounded > 0 ? '+' : '-';
  return `${sign}${Math.abs(rounded).toLocaleString('ja-JP')}円`;
}

function compactCoins(value) {
  if (Math.abs(value) >= 1_000) {
    const compact = Number((value / 1_000).toFixed(1));
    return `${compact > 0 ? '+' : ''}${compact}k`;
  }
  return `${value > 0 ? '+' : ''}${Math.round(value)}`;
}

const percentileLabels = {
  0.1: '下位10%に近い',
  0.25: '下位25%に近い',
  0.5: '中央値に近い',
  0.75: '上位25%に近い',
  0.9: '上位10%に近い',
};

export function buildRepresentativeRunViewModel(run, { coinValueYen = 20 } = {}) {
  const pathValues = run.path.map((point) => point.coins);
  let minimum = Math.min(0, ...pathValues);
  let maximum = Math.max(0, ...pathValues);
  if (minimum === maximum) {
    minimum -= 1;
    maximum += 1;
  }
  const padding = (maximum - minimum) * 0.08;
  minimum -= padding;
  maximum += padding;
  const chartHeight = 260;
  const pathPoints = run.path.map((point) => {
    const x = (point.game / run.games) * 1_000;
    const y = chartHeight - ((point.coins - minimum) / (maximum - minimum)) * chartHeight;
    return `${Number(x.toFixed(2))},${Number(y.toFixed(2))}`;
  }).join(' ');
  const percentileLabel = percentileLabels[run.percentile] ?? '代表的な';

  return {
    setting: run.setting,
    percentile: run.percentile,
    title: `設定${run.setting}・${percentileLabel}1日の流れ`,
    finalCoinsText: formatCoins(run.finalCoins),
    finalCashText: formatCash(run.finalCoins * coinValueYen),
    bonusText: `${run.bigCount} / ${run.regularCount}`,
    maxDroughtText: `${run.maxDroughtGames.toLocaleString('ja-JP')}G`,
    peakText: formatCoins(run.peakCoins),
    peakToEndText: formatCoins(-run.peakToEndDrawdown),
    maxDrawdownText: formatCoins(-run.maxDrawdown),
    pathPoints,
    yMaximumText: compactCoins(maximum),
    yMinimumText: compactCoins(minimum),
    events: run.events.map((event) => ({
      gameText: `${event.game.toLocaleString('ja-JP')}G`,
      type: event.type === 'BB' ? 'BIG' : 'REG',
      intervalText: `間隔 ${event.intervalGames.toLocaleString('ja-JP')}G`,
    })),
  };
}
