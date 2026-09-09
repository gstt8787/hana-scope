const OFFICIAL_POP = Object.freeze({
  kind: 'official',
  publisher: '株式会社パイオニア',
  title: '「スターハナハナ-30」「スマート沖スロ スターハナハナ」公式POP',
  url: 'https://www.slot-pioneer.co.jp/product/star_hanahana/pop/pop_pdf.pdf',
  checkedOn: '2026-09-08',
});

const POKOSLOT = Object.freeze({
  kind: 'analysis-site',
  publisher: 'ぽこすろっと',
  title: 'スターハナハナ｜設定判別 設定差 ベル確率 ビッグ中スイカ フェザーランプ サイドランプ',
  url: 'https://www.nankaikoya.jp/star-hanahana/',
  publishedOn: '2025-04-28',
  checkedOn: '2026-09-08',
  note: 'メーカー非公表の推定値。前作キングハナハナ-30と同じ振り分けとして各解析サイトが掲載している値と一致する。',
});

const KENSLO = Object.freeze({
  kind: 'estimate',
  publisher: 'けんのスロットシミュレーション',
  title: 'スターハナハナ-30 解析情報',
  url: 'https://kenslo65536.com/kaiseki/star-hanahana-30.html',
  checkedOn: '2026-09-08',
  note: '公表機械割から逆算した独自解析値。',
});

export const STAR_HANAHANA = Object.freeze({
  id: 'smart-star-hanahana',
  name: 'スマート沖スロ スターハナハナ',
  aliases: Object.freeze(['スターハナハナ-30']),
  betCoinsPerGame: 3,
  bigPayoutCoins: 240,
  regularPayoutCoins: 96,
  officialSource: OFFICIAL_POP,
  settings: Object.freeze([
    { setting: 1, bigDenominator: 270, regularDenominator: 387, combinedDenominator: 159, payoutRate: 0.97 },
    { setting: 2, bigDenominator: 262, regularDenominator: 354, combinedDenominator: 150, payoutRate: 0.99 },
    { setting: 3, bigDenominator: 252, regularDenominator: 322, combinedDenominator: 141, payoutRate: 1.01 },
    { setting: 4, bigDenominator: 240, regularDenominator: 293, combinedDenominator: 132, payoutRate: 1.04 },
    { setting: 5, bigDenominator: 229, regularDenominator: 267, combinedDenominator: 123, payoutRate: 1.07 },
    { setting: 6, bigDenominator: 218, regularDenominator: 242, combinedDenominator: 114, payoutRate: 1.10 },
  ].map(Object.freeze)),
  smallRoles: Object.freeze({
    sourceKind: 'estimate',
    source: KENSLO,
    bellDenominators: Object.freeze([6.358, 6.303, 6.3, 6.26, 6.204, 6.2]),
    replayDenominator: 7.298,
    cherryDenominator: 48.689,
    watermelonDenominator: 159.844,
    // 3枚掛け時の払出（公式POPの配当表）。1枚・2枚掛けはベル14・スイカ14・チェリー7。
    payouts: Object.freeze({ bell: 8, replay: 3, cherry: 2, watermelon: 6 }),
  }),
  // ボーナス1回の消化ゲーム数の近似（BIG 240枚 ÷ 1Gあたり純増12枚 = 20G）。解析サイトも20Gで集計している。
  bonusGames: Object.freeze({ big: 20, regular: 7 }),
  // 設定推測に使う示唆要素。公式POPは要素の存在だけを示し、数値はメーカー非公表。
  // 数値は analysis-site 由来のため、推測エンジンでは「解析サイト値」として個別に切り替えられる。
  evidence: Object.freeze([
    Object.freeze({
      id: 'bigWatermelon',
      label: 'BIG中スイカ',
      kind: 'binomial',
      trials: Object.freeze({ from: 'watchedBig', gamesPerBonus: 20 }),
      denominators: Object.freeze([42, 39, 36, 33, 31, 29]),
      source: POKOSLOT,
      alternatives: Object.freeze([
        Object.freeze({ denominators: Object.freeze([47.127, 42.9, 39.7, 37.0, 34.7, 31.266]), source: KENSLO }),
      ]),
    }),
    Object.freeze({
      id: 'regSideLamp',
      label: 'REG中サイドランプ',
      kind: 'categorical',
      categories: Object.freeze(['blue', 'yellow', 'green', 'red', 'rainbow']),
      categoryLabels: Object.freeze({ blue: '青', yellow: '黄', green: '緑', red: '赤', rainbow: '虹' }),
      // 単位: %（設定1〜6）。REG中に白7ビタ押しでスイカを揃えた時の色。
      ratesPercent: Object.freeze({
        blue: Object.freeze([36, 23, 33, 22, 31, 25]),
        yellow: Object.freeze([24, 35, 22, 32, 21, 25]),
        green: Object.freeze([24, 17, 27, 18, 29, 25]),
        red: Object.freeze([16, 25, 18, 28, 19, 25]),
        rainbow: Object.freeze([0.05, 0.06, 0.08, 0.2, 0.4, 0.8]),
      }),
      source: POKOSLOT,
    }),
    Object.freeze({
      id: 'featherAfterBig',
      label: 'フェザーランプ（BIG後）',
      kind: 'categorical',
      categories: Object.freeze(['blue', 'yellow', 'green', 'red', 'rainbow']),
      categoryLabels: Object.freeze({ blue: '青', yellow: '黄', green: '緑', red: '赤', rainbow: '虹' }),
      remainder: Object.freeze({ from: 'watchedBig', label: '白' }),
      ratesPercent: Object.freeze({
        blue: Object.freeze([3.6, 4.1, 4.3, 4.9, 5.4, 5.8]),
        yellow: Object.freeze([2.9, 3.0, 3.5, 3.9, 4.1, 4.6]),
        green: Object.freeze([1.9, 2.1, 2.3, 2.5, 2.7, 3.1]),
        red: Object.freeze([1.3, 1.4, 1.5, 1.6, 1.8, 1.9]),
        rainbow: Object.freeze([0.01, 0.04, 0.07, 0.07, 0.2, 0.4]),
      }),
      source: POKOSLOT,
    }),
    Object.freeze({
      id: 'featherAfterReg',
      label: 'フェザーランプ（REG後）',
      kind: 'categorical',
      categories: Object.freeze(['blue', 'yellow', 'green', 'red', 'rainbow']),
      categoryLabels: Object.freeze({ blue: '青', yellow: '黄', green: '緑', red: '赤', rainbow: '虹' }),
      remainder: Object.freeze({ from: 'watchedReg', label: '白' }),
      // 0 は「その設定では出ない」= 出た時点でその設定を否定する。
      ratesPercent: Object.freeze({
        blue: Object.freeze([0, 0.2, 0.2, 0.4, 0.4, 0.4]),
        yellow: Object.freeze([0, 0, 0.2, 0.2, 0.4, 0.4]),
        green: Object.freeze([0, 0, 0, 0.2, 0.2, 0.4]),
        red: Object.freeze([0, 0, 0, 0, 0.2, 0.2]),
        rainbow: Object.freeze([0, 0, 0, 0, 0, 0.2]),
      }),
      source: POKOSLOT,
    }),
  ]),
  excludedEvidence: Object.freeze([
    Object.freeze({ id: 'bell', label: 'ベル確率', reason: '3つの情報源で数値が食い違い（1/6.36〜1/6.98）、判別力も弱いとされるため未採用。' }),
    Object.freeze({ id: 'retroSound', label: 'レトロサウンド', reason: '本機種の設定別発生率が公表・掲載ともに無く、他機種の流用値しか無いため未採用。' }),
  ]),
});

export function expectedNetCoins(games, payoutRate, betCoinsPerGame = 3) {
  return Number((games * betCoinsPerGame * (payoutRate - 1)).toFixed(9));
}

export function settingSpec(machine, setting) {
  const spec = machine.settings.find((row) => row.setting === Number(setting));
  if (!spec) throw new RangeError(`Unknown setting: ${setting}`);
  return spec;
}
