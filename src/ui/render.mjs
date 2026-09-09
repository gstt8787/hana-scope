export function renderEstimateResult(view) {
  const rows = view.rows.map((row) => `
    <div class="setting-row${row.isTop ? ' is-top' : ''}${row.isEliminated ? ' is-eliminated' : ''}">
      <span class="setting-number">${row.setting}</span>
      <span class="probability-track" aria-hidden="true"><span style="width:${row.barWidth}"></span></span>
      <span class="probability-value">${row.probabilityText}</span>
    </div>`).join('');
  const tiers = (view.tiers ?? []).map((tier) => `
    <span class="tier-chip"><small>${tier.label}</small><strong>${tier.text}</strong></span>`).join('');
  const contributions = (view.contributions ?? []).map((group) => `
    <div class="contribution-row${group.bars ? '' : ' is-idle'}">
      <span class="contribution-label">${group.label}<small>${group.sourceText}${group.countText ? ` · ${group.countText}` : ''}</small></span>
      <span class="contribution-bars" aria-hidden="true">${group.bars
        ? group.bars.map((bar) => `<i${bar.isTop ? ' class="is-top"' : ''} style="height:${bar.height}"></i>`).join('')
        : '<i></i>'.repeat(6)}</span>
      <span class="contribution-status">${group.statusText}</span>
    </div>`).join('');

  return `
    <section class="result-panel" aria-live="polite">
      <div class="panel-heading">
        <h2>データ適合度</h2>
        <span class="evidence-chip">${view.evidenceText}</span>
      </div>
      <div class="top-setting"><strong>${view.topLabel}</strong><span>が最有力 / ${view.topProbability}</span></div>
      ${tiers ? `<div class="tier-row" aria-label="高設定の確率">${tiers}</div>` : ''}
      <div class="setting-rows">${rows}</div>
      ${contributions ? `<div class="contribution-list"><h3>要素ごとの傾き</h3>${contributions}</div>` : ''}
      <p class="result-note">次点は${view.runnerUpText}。<br>設定確定とは言えません。${view.hasEliminated ? '<br>「否定」は確定系の示唆で除外した設定です。' : ''}</p>
      ${view.usesAnalysisEvidence ? '<p class="source-note">スイカ・サイドランプ・フェザーランプの振り分けはメーカー非公表の解析サイト値です。</p>' : ''}
      ${view.sensitivityWarning ? '<p class="sensitivity-note">店舗状況の重み付けで先頭候補が変わっています。</p>' : ''}
      <button class="disclosure-button" type="button" data-action="toggle-prior">
        店状況の確率を見る
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
      </button>
    </section>`;
}

export function renderSimulationResult(view) {
  const rows = view.rows.map((row) => `
    <button class="simulation-summary-row" type="button" data-action="show-run" data-setting="${row.setting}">
      <span class="summary-setting">${row.setting}</span>
      <span class="summary-range-wrap">
        <span class="summary-range" aria-label="10–90%範囲">
          <i style="left:${row.rangeLeft}%;width:${row.rangeWidth}%"></i>
          <b style="left:${row.medianLeft}%"></b>
        </span>
        ${row.meanBonusText ? `<small>${row.meanBonusText}</small>` : ''}
      </span>
      <span class="summary-mean ${row.tone}"><strong>${row.meanCoinsText}</strong><small>${row.meanCashText ?? ''}</small></span>
      <span class="summary-win"><strong>${row.winRateText}</strong><small>${row.winRateRangeText}</small></span>
    </button>`).join('');

  return `
    <section class="simulation-result-panel" aria-live="polite">
      <div class="panel-heading simulation-heading">
        <h2>設定別サマリー</h2>
        <span class="evidence-chip">誤差 約±1pt</span>
      </div>
      <div class="summary-legend"><span>10–90%範囲 / 中央値</span><span>平均差枚</span><span>勝率</span></div>
      <div class="simulation-summary-rows">${rows}</div>
      <p class="model-note">公式ボーナス確率・機械割と推定小役値を用いた近似モデルです。各行を押すと代表的な1日の流れを表示します。</p>
    </section>`;
}

export function renderRepresentativeRun(view) {
  const percentileButtons = [
    [0.1, '下位10%'],
    [0.25, '下位25%'],
    [0.5, '中央値'],
    [0.75, '上位25%'],
    [0.9, '上位10%'],
  ].map(([percentile, label]) => `
    <button type="button" data-action="select-percentile" data-percentile="${percentile}"${percentile === view.percentile ? ' class="is-active"' : ''}>${label}</button>
  `).join('');
  const history = view.events.map((event) => `
    <li><span>${event.gameText}</span><strong class="${event.type === 'BIG' ? 'big' : 'regular'}">${event.type}</strong><small>${event.intervalText}</small></li>
  `).join('');

  return `
    <section class="representative-run" data-setting="${view.setting}">
      <button class="back-button" type="button" data-action="back-to-summary">← 設定別サマリー</button>
      <p class="kicker">REPRESENTATIVE RUN</p>
      <h1>${view.title}</h1>
      <p class="screen-helper">代表5本を切り替えて比較できます</p>

      <div class="percentile-selector" aria-label="代表試行">${percentileButtons}</div>

      <section class="chart-panel">
        <div class="panel-heading"><h2>差枚推移</h2><span>0〜8,000G</span></div>
        <svg class="slump-chart" viewBox="0 0 1000 300" role="img" aria-label="差枚推移グラフ" preserveAspectRatio="none">
          <line x1="0" y1="20" x2="1000" y2="20"></line>
          <line x1="0" y1="150" x2="1000" y2="150"></line>
          <line x1="0" y1="280" x2="1000" y2="280"></line>
          <polyline points="${view.pathPoints}"></polyline>
          <text x="0" y="14">${view.yMaximumText}</text>
          <text x="0" y="296">${view.yMinimumText}</text>
        </svg>
        <div class="chart-x-axis"><span>0</span><span>4k</span><span>8k</span></div>
      </section>

      <div class="run-metrics">
        <div><span>最終差枚</span><strong class="positive">${view.finalCoinsText}</strong><small>${view.finalCashText}</small></div>
        <div><span>BIG / REG</span><strong>${view.bonusText}</strong></div>
        <div><span>最大ハマリ</span><strong>${view.maxDroughtText}</strong></div>
      </div>

      <div class="risk-metrics">
        <div><span>最高差枚</span><strong>${view.peakText}</strong></div>
        <div><span>山から終了</span><strong>${view.peakToEndText}</strong></div>
        <div><span>最大ドローダウン</span><strong>${view.maxDrawdownText}</strong></div>
      </div>

      <section class="history-panel">
        <div class="panel-heading"><h2>当選履歴</h2><span>全${view.events.length}件</span></div>
        <ol>${history}</ol>
        <button class="csv-button" type="button" data-action="download-csv">CSVで当選一覧を保存 ↓</button>
      </section>
    </section>`;
}
