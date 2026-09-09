function csvCell(value) {
  const text = String(value ?? '');
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(values) {
  return values.map(csvCell).join(',');
}

export function representativeRunToCsv(run) {
  const lines = [
    csvRow(['設定', '総ゲーム', 'シード', '最終差枚', 'BIG', 'REG', '最大ハマリ']),
    csvRow([
      run.setting,
      run.games,
      run.seed,
      run.finalCoins,
      run.bigCount,
      run.regularCount,
      run.maxDroughtGames,
    ]),
    '',
    csvRow(['当選ゲーム', '種別', '当選間隔', '獲得枚数', '当選後差枚']),
    ...run.events.map((event) => csvRow([
      event.game,
      event.type,
      event.intervalGames,
      event.payoutCoins,
      event.coinsAfter,
    ])),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
