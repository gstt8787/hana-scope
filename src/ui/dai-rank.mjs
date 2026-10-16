// 「台番の順位」画面。数字は非公開版にだけ置く data/dai-rank.json から読む。
// 読めない時（公開版など）は画面のボタンごと出さない。
const TIERS = [
  [40, '#b71c1c', '#fff'],
  [30, '#e53935', '#fff'],
  [20, '#fb8c00', '#fff'],
  [10, '#fdd835', '#222'],
  [0, '#cfd8dc', '#222'],
];
const WEEK = '日月火水木金土';
const VIEWS = [['week', '曜日別'], ['event', 'イベント別'], ['cross', 'かけ合わせ'], ['cluster', '昼の目安']];
const DAY_COLORS = ['#5b5368', '#fb8c00', '#e53935'];

function tier(pct) {
  const hit = TIERS.find(([lo]) => pct >= lo) ?? TIERS[TIERS.length - 1];
  return { bg: hit[1], fg: hit[2] };
}

function esc(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function pctOf(hi, n) {
  return n ? Math.round((hi / n) * 100) : 0;
}

function chip(pct) {
  const { bg, fg } = tier(pct);
  return `<b class="dr-chip" style="background:${bg};color:${fg}">${pct}%</b>`;
}

function cellOf(tab, no) {
  const row = tab.rows[String(no)];
  if (!row) return null;
  const [rank, n, hi] = row;
  return { rank, n, hi, pct: pctOf(hi, n) };
}

function stripHtml(data, tab) {
  const cells = data.nos.map((no) => {
    const c = cellOf(tab, no);
    if (!c || c.rank == null) return `<div class="dr-c is-few"><i>${Number(no)}</i><b>-</b></div>`;
    const { bg, fg } = tier(c.pct);
    const top = c.rank <= 3 && c.hi > 0 ? ' is-top' : '';
    return `<div class="dr-c${top}" style="background:${bg};color:${fg}"><i>${Number(no)}</i><b>${Number(c.rank)}</b></div>`;
  }).join('');
  return `<div class="dr-ends"><span>← 左（${esc(data.left.name)}側）</span><span>右（${esc(data.right.name)}側）→</span></div>
<div class="dr-strip"><div class="dr-nb">${esc(data.left.name)}</div>${cells}<div class="dr-nb">${esc(data.right.name)}</div></div>`;
}

function listHtml(data, tab) {
  const total = data.nos.length;
  const rows = data.nos.map((no, i) => {
    const c = cellOf(tab, no);
    const pos = `<td class="dr-ps">${i + 1}</td><td class="dr-ps">${total - i}</td>`;
    if (!c) return `<tr class="is-few">${pos}<td class="dr-no">${Number(no)}</td><td>-</td><td>-</td><td class="dr-ct">なし</td></tr>`;
    if (c.rank == null) {
      return `<tr class="is-few">${pos}<td class="dr-no">${Number(no)}</td><td class="dr-rk">参考</td><td class="dr-pc"><b>${c.pct}%</b></td><td class="dr-ct">${Number(c.hi)}/${Number(c.n)}</td></tr>`;
    }
    const { bg, fg } = tier(c.pct);
    const top = c.rank <= 3 && c.hi > 0 ? ' is-top' : '';
    return `<tr>${pos}<td class="dr-no">${Number(no)}</td><td class="dr-rk${top}">${Number(c.rank)}位</td><td class="dr-pc" style="background:${bg};color:${fg}"><b>${c.pct}%</b></td><td class="dr-ct">${Number(c.hi)}/${Number(c.n)}</td></tr>`;
  }).join('');
  return `<table class="dr-list"><thead><tr><th>左から</th><th>右から</th><th>台番</th><th>順位</th><th>割合</th><th>出た日<br>/日数</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function legendHtml() {
  return TIERS.map(([lo, bg, fg], i) => {
    const label = i === 0 ? `${lo}%以上` : `${lo}〜${TIERS[i - 1][0] - 1}%`;
    return `<span style="background:${bg};color:${fg}">${label}</span>`;
  }).join('');
}

// 曜日別とイベント別で同じ形: ボタンの列 → 色の見本 → 見出し → 13台の帯 → 1台1行の表
function seatView(data, chipsHtml, chipsClass, tab, foot) {
  return `<div class="${chipsClass}" role="tablist">${chipsHtml}</div>
    <div class="dr-legend">${legendHtml()}<span class="dr-legend-top">枠＝1〜3位</span></div>
    <h2 class="dr-title">${esc(tab.title)}<span>${Number(tab.days)}日分・スタハナ全体 ${pctOf(tab.hi, tab.n)}%（${Number(tab.hi)}/${Number(tab.n)}）</span></h2>
    ${stripHtml(data, tab)}
    ${listHtml(data, tab)}
    <p class="dr-foot">${foot}</p>`;
}

function weekHtml(data, tab) {
  const chips = data.tabs.map((t) => `<button type="button" class="dr-tab${t.id === tab.id ? ' is-active' : ''}" data-dr-tab="${esc(t.id)}">${esc(t.id)}</button>`).join('');
  return seatView(data, chips, 'dr-tabs', tab, '台番ごとの差は、今の日数では偶然と見分けがつかない（「島のかたまり」参照）。順位は参考。');
}

function eventNames(data) {
  const rate = (name) => {
    const t = data.eventTabs[name];
    return t.n ? t.hi / t.n : 0;
  };
  const days = (name) => data.eventTabs[name].days;
  const pick = (kind) => data.events
    .filter((e) => e.kind === kind && data.eventTabs?.[e.name]?.days > 0)
    .map((e) => e.name)
    .sort((a, b) => days(b) - days(a) || rate(b) - rate(a));
  return [...pick('event'), ...pick('cal')];
}

function eventHtml(data, name) {
  const names = eventNames(data);
  const current = names.includes(name) ? name : names[0];
  const tab = data.eventTabs[current];
  const kindOf = (n) => data.events.find((e) => e.name === n)?.kind;
  const row = (kind, label) => `<div class="dr-evrow"><span class="dr-evlabel">${label}</span><div class="dr-evscroll">${names.filter((n) => kindOf(n) === kind)
    .map((n) => `<button type="button" class="dr-tab dr-evtab${n === current ? ' is-active' : ''}" data-dr-ev="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>`;
  const chips = row('event', '取材') + row('cal', '日付');
  const hidden = data.events.length - names.length;
  return seatView(data, chips, 'dr-evtabs', tab,
    `ボタンは日数の多い順（同じなら割合の高い順）。横にすべらせると続きが出る。今の13台の並びになってからの日が無い${hidden}つは出していない。1つの台番で見ると、このイベントの日は数日しか無い。`);
}

// かけ合わせ: 曜日・取材・日付の種類を1つずつ選び、重なる日だけで13台の表と日ごとの表を出す
const FILTERS = [['dow', '曜日'], ['ev', '取材'], ['cal', '日付']];

function dayMatches(day, f) {
  return (!f.dow || day.dow === f.dow) && (!f.ev || day.ev.includes(f.ev)) && (!f.cal || day.cal.includes(f.cal));
}

function tabFromDays(data, days, title) {
  const stat = data.nos.map(() => [0, 0]);
  days.forEach((day) => day.s.forEach((v, i) => {
    if (v != null) { stat[i][0] += 1; stat[i][1] += v ? 1 : 0; }
  }));
  const min = Number(data.minRankDays);
  const rated = stat.filter(([n]) => n >= min).map(([n, h]) => h / n);
  const rows = {};
  data.nos.forEach((no, i) => {
    const [n, h] = stat[i];
    if (n) rows[String(no)] = [n >= min ? 1 + rated.filter((r) => r > h / n).length : null, n, h];
  });
  return { title, days: days.length, n: stat.reduce((a, [n]) => a + n, 0), hi: stat.reduce((a, [, h]) => a + h, 0), rows };
}

function filterRow(data, f, k, label) {
  const values = k === 'dow'
    ? [...WEEK.slice(1), WEEK[0]]
    : [...new Set(data.days13.flatMap((d) => d[k]))];
  const count = (v) => data.days13.filter((d) => dayMatches(d, { ...f, [k]: v })).length;
  const items = values.map((v) => [v, count(v)]).filter(([v, c]) => c > 0 || f[k] === v);
  if (k !== 'dow') items.sort((a, b) => b[1] - a[1]);
  const btn = (v, text, c) => `<button type="button" class="dr-tab dr-evtab${(f[k] || '') === v ? ' is-active' : ''}" data-dr-f="${k}" data-dr-v="${esc(v)}">${esc(text)}${c == null ? '' : `<small>${c}</small>`}</button>`;
  return `<div class="dr-evrow"><span class="dr-evlabel">${label}</span><div class="dr-evscroll">${btn('', 'すべて')}${items.map(([v, c]) => btn(v, v, c)).join('')}</div></div>`;
}

function crossHtml(data, f) {
  const days = data.days13.filter((d) => dayMatches(d, f));
  const parts = [f.dow && `${f.dow}曜`, f.ev, f.cal].filter(Boolean);
  const title = parts.length ? parts.join(' × ') : 'すべての日';
  const filters = `<div class="dr-evtabs">${FILTERS.map(([k, label]) => filterRow(data, f, k, label)).join('')}</div>`;
  if (!days.length) {
    return `${filters}<div class="dr-callout"><b>この組み合わせの日は無い。</b><span>どれかの段を「すべて」に戻す。</span></div>`;
  }
  const tab = tabFromDays(data, days, title);
  const head = data.nos.map((no) => `<i>${Number(no)}</i>`).join('');
  const rows = days.map((d) => {
    const k = d.s.filter((v) => v).length;
    const n = d.s.filter((v) => v != null).length;
    const tags = [...d.ev.filter((e) => e !== '（取材名なし）'), ...d.cal].map((t) => `<span>${esc(t)}</span>`).join('');
    const cells = d.s.map((v) => `<b class="${v == null ? 'is-none' : v ? 'is-hi' : 'is-lo'}"></b>`).join('');
    return `<div class="dr-day"><div class="dr-day-head"><strong>${esc(d.label)}</strong><span class="dr-day-tags">${tags}</span><em>${k}/${n}台</em></div><div class="dr-dots">${cells}</div></div>`;
  }).join('');
  return `${filters}
    <div class="dr-legend">${legendHtml()}<span class="dr-legend-top">枠＝1〜3位</span></div>
    <h2 class="dr-title">${esc(tab.title)}<span>${Number(tab.days)}日分・スタハナ全体 ${pctOf(tab.hi, tab.n)}%（${Number(tab.hi)}/${Number(tab.n)}）</span></h2>
    ${stripHtml(data, tab)}
    ${listHtml(data, tab)}
    <h2 class="dr-title">日ごとの表<span>新しい日が上。丸は左から台の並びどおり。赤＝高設定並み、灰＝回ったが届かず、点線＝数字なし</span></h2>
    <div class="dr-dots dr-dots-head">${head}</div>
    <div class="dr-daylist">${rows}</div>
    <p class="dr-foot">選んだ条件が全部そろう日だけを数える。ボタンの小さい数字は、ほかの段の選び方のまま、それを選んだ時の日数。</p>`;
}

// 昼の目安: 13台のうちREGの良い台が何台か → 今日の日の種類の見込みと、1台が高設定の見込み
function islandHtml(data, state) {
  const isl = data.island;
  if (!isl) return '';
  const check = isl.checks.find((c) => c.games === state.g) ?? isl.checks[1] ?? isl.checks[0];
  const chips = isl.checks.map((c) => `<button type="button" class="dr-tab dr-evtab${c.games === check.games ? ' is-active' : ''}" data-dr-g="${Number(c.games)}">${Number(c.games).toLocaleString()}G</button>`).join('');
  const legend = isl.types.map((t, i) => `<span><i style="background:${DAY_COLORS[i]}"></i>${esc(t.name)}</span>`).join('');
  const rows = check.rows.map((r) => {
    const top = r.post.indexOf(Math.max(...r.post));
    const bar = r.post.map((p, i) => `<span style="width:${p}%;background:${DAY_COLORS[i]}"></span>`).join('');
    const open = state.k === r.k;
    const weights = Object.entries(r.weights).map(([st, w]) => `<span>設定${Number(st)} <b>${Number(w)}</b></span>`).join('');
    const detail = open ? `<div class="dr-isl-detail"><p>${isl.types.map((t, i) => `${esc(t.name)} ${Number(r.post[i])}%`).join('・')}</p>
        <div class="dr-isl-w">${weights}</div>
        <button type="button" class="dr-apply" data-dr-apply="${Number(r.k)}">この重みで設定推測を開く</button></div>` : '';
    return `<button type="button" class="dr-isl-row${open ? ' is-open' : ''}" data-dr-k="${Number(r.k)}">
        <b class="dr-isl-k">${Number(r.k)}台</b>
        <span class="dr-isl-bar">${bar}</span>
        <span class="dr-isl-top" style="color:${top === 0 ? '#b9b1c2' : DAY_COLORS[top]}">${esc(isl.types[top].name.replace('の日', ''))} ${Number(r.post[top])}%</span>
        <span class="dr-isl-high">1台<b>${Number(r.high)}%</b></span></button>${detail}`;
  }).join('');
  return `<h2 class="dr-title">昼の時点で、13台のうちREGの良い台は何台？<span>良い台＝その時点でREGが${Number(check.needReg)}回以上（1/280より良い）。13台とも同じくらい回っている時の見込み</span></h2>
    <div class="dr-evscroll dr-gchips">${chips}</div>
    <div class="dr-isl-legend">${legend}</div>
    <div class="dr-isl">${rows}</div>
    <p class="dr-foot">右の「1台」＝その日の1台が設定4〜6である見込み。行を押すと、設定推測の「店状況の重み付け」に入れる数が出て、そのまま入れて設定推測を開ける。<br>作り方: 閉店の数字（${Number(isl.days)}日）から、日を「${isl.types.map((t) => `${esc(t.name)}（${Number(t.share)}%の日・1台が高設定 ${Number(t.highRate)}%）`).join('、')}」に分けた。決め事: ${esc(isl.assumptions)} 昼の途中の実際の数字での答え合わせは、まだしていない。</p>`;
}

function applyPrior(weights) {
  document.querySelectorAll('[data-prior-setting]').forEach((input) => {
    const w = Number(weights[input.dataset.priorSetting]);
    input.value = String(Math.max(0.1, Number.isFinite(w) ? w : 0.1));
  });
  document.querySelector('[data-action="apply-prior"]')?.click();
  document.querySelector('[data-screen="estimate"]')?.click();
  window.scrollTo({ top: 0 });
}

function clusterHtml(data) {
  const c = data.cluster;
  const maxDays = Math.max(...c.perDay.map((r) => Math.max(r.days, r.expected)));
  const perDay = c.perDay.map((r) => `<tr><th>${esc(r.label)}</th>
      <td><div class="dr-bar"><span class="dr-bar-obs" style="width:${(r.days / maxDays) * 100}%"></span></div><div class="dr-bar"><span class="dr-bar-exp" style="width:${(r.expected / maxDays) * 100}%"></span></div></td>
      <td class="dr-num"><b>${Number(r.days)}日</b><small>${Number(r.expected)}日</small></td></tr>`).join('');
  const others = c.others.map((r) => `<tr><th>${esc(r.label)}</th><td>${chip(pctOf(r.hi, r.n))}</td><td class="dr-num">${Number(r.hi)}/${Number(r.n)}</td></tr>`).join('');
  const seat = Math.round(c.seatChance * 100);
  return `<h2 class="dr-title">この目安が使えるわけ</h2><div class="dr-callout"><b>この店のスタハナは、入れる日にまとめて入れる。</b>
      <span>どの台番に入るかは、同じ日の中で比べると偶然の範囲（くじ引きで${seat}%の確率で出る差）。一方、日ごとのかたまりは偶然では出ない（くじ引き2,000回で${Math.round(c.clumpChance * 2000)}回）。台を選ぶ前に、今日が「入れている日」かを読む。</span></div>
    <h2 class="dr-title">1日に高設定並みが何台出たか<span>スタハナが8台以上あった${Number(c.days)}日。太い棒＝実際の日数、細い棒＝毎日バラバラに入れた場合の見込み</span></h2>
    <table class="dr-kv">${perDay}</table>
    <h2 class="dr-title">ほかの台の結果と、その台の結果<span>同じ日のほかのスタハナが何台高設定並みだったか → その台も高設定並みだった割合</span></h2>
    <table class="dr-kv">${others}</table>
    <p class="dr-foot">使い方: ホールでは、島の13台のデータカウンター（とくにREG）を見て、良さそうな台が何台あるかを数える。多い日は「入れている日」の見込みが上がり、自分の台も粘る価値が上がる。少ない日は早めに見切る。数字は1日の終わりの結果どうしの関係。昼の途中でどこまで読めるかは、まだ確かめていない。</p>`;
}

function render(panel, data, state) {
  const tab = data.tabs.find((t) => t.id === state.tab) ?? data.tabs[0];
  const views = VIEWS.filter(([id]) => id === 'week' || (id === 'event' ? data.eventTabs : id === 'cross' ? data.days13 : data.cluster))
    .map(([id, label]) => `<button type="button" class="dr-view${id === state.view ? ' is-active' : ''}" data-dr-view="${id}">${label}</button>`).join('');
  const body = state.view === 'event' ? eventHtml(data, state.ev)
    : state.view === 'cross' ? crossHtml(data, state.f ?? {})
      : state.view === 'cluster' ? islandHtml(data, state) + clusterHtml(data) : weekHtml(data, tab);
  panel.innerHTML = `
    <p class="kicker">SEAT MAP</p>
    <h1>${esc(data.store)} ${esc(data.model)} 台番の順位</h1>
    <p class="screen-helper">台の正面から見た並びのまま。割合は${esc(data.rule)}が出た日の割合。灰色は${Number(data.minRankDays) - 1}日以下で順位なし。</p>
    <div class="dr-views">${views}</div>
    ${body}
    <p class="dr-foot">台帳 ${esc(data.period)}（${esc(data.periodNote)}）・更新 ${esc(data.updated)}</p>`;
  panel.querySelectorAll('[data-dr-tab]').forEach((button) => {
    button.addEventListener('click', () => render(panel, data, { ...state, tab: button.dataset.drTab }));
  });
  panel.querySelectorAll('[data-dr-view]').forEach((button) => {
    button.addEventListener('click', () => render(panel, data, { ...state, view: button.dataset.drView }));
  });
  panel.querySelectorAll('[data-dr-ev]').forEach((button) => {
    button.addEventListener('click', () => render(panel, data, { ...state, view: 'event', ev: button.dataset.drEv }));
  });
  panel.querySelectorAll('[data-dr-f]').forEach((button) => {
    button.addEventListener('click', () => render(panel, data, { ...state, view: 'cross', f: { ...(state.f ?? {}), [button.dataset.drF]: button.dataset.drV } }));
  });
  panel.querySelectorAll('[data-dr-g]').forEach((button) => {
    button.addEventListener('click', () => render(panel, data, { ...state, view: 'cluster', g: Number(button.dataset.drG), k: null }));
  });
  panel.querySelectorAll('[data-dr-k]').forEach((button) => {
    button.addEventListener('click', () => {
      const k = Number(button.dataset.drK);
      render(panel, data, { ...state, view: 'cluster', k: state.k === k ? null : k });
    });
  });
  panel.querySelectorAll('[data-dr-apply]').forEach((button) => {
    button.addEventListener('click', () => {
      const check = data.island.checks.find((c) => c.games === state.g) ?? data.island.checks[1] ?? data.island.checks[0];
      const row = check.rows.find((r) => r.k === Number(button.dataset.drApply));
      if (row) applyPrior(row.weights);
    });
  });
  panel.querySelectorAll('.dr-evtab.is-active').forEach((active) => {
    active.parentElement.scrollLeft = active.offsetLeft - active.parentElement.offsetLeft - 40;
  });
}

// 公開版: 数字は封をした形（data/dai-rank.sealed.json）で置き、合言葉で開ける。開ける方の鍵だけを端末に覚える
const CURVE = { name: 'ECDH', namedCurve: 'P-256' };
const REMEMBER = 'hana-scope:dai-rank-unlock';
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// 合言葉のそろえ方（tools/seal-dai-rank.mjs と同じ）: 半角→全角、空白を除く、英字は小文字、ひらがなはカタカナに
function normalizePhrase(text) {
  return String(text).normalize('NFKC').replace(/\s+/g, '').toLowerCase()
    .replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

async function openerFromPhrase(box, phrase) {
  const subtle = globalThis.crypto.subtle;
  const base = await subtle.importKey('raw', new TextEncoder().encode(normalizePhrase(phrase)), 'PBKDF2', false, ['deriveKey']);
  const wrapAes = await subtle.deriveKey({ name: 'PBKDF2', salt: unb64(box.salt), iterations: box.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pkcs8 = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, wrapAes, unb64(box.wrapped));
  const opener = await subtle.importKey('pkcs8', pkcs8, CURVE, true, ['deriveKey']);
  return { opener, jwk: await subtle.exportKey('jwk', opener) };
}

async function openSealed(sealed, opener) {
  const subtle = globalThis.crypto.subtle;
  const eph = await subtle.importKey('jwk', sealed.epk, CURVE, false, []);
  const aes = await subtle.deriveKey({ name: 'ECDH', public: eph }, opener, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, aes, unb64(sealed.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

function start(panel, data) {
  const today = WEEK[new Date().getDay()];
  render(panel, data, { g: 2000, k: null, view: 'week', tab: data.tabs.some((t) => t.id === today) ? today : data.tabs[0].id });
}

function askPhrase(panel, box, sealed, message = '') {
  panel.innerHTML = `
    <p class="kicker">SEAT MAP</p>
    <h1>台番の順位</h1>
    <p class="screen-helper">合言葉を入れると開きます。合言葉が無いと、店の数字は読めない形で置いてあります。</p>
    <form class="dr-lock" id="dr-lock">
      <input id="dr-phrase" class="dr-phrase" type="text" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="合言葉" aria-label="合言葉">
      <label class="dr-remember"><input id="dr-remember" type="checkbox" checked> このスマホで覚える（次から入れなくてよい）</label>
      <button type="submit" class="dr-apply">開く</button>
      <p class="dr-lock-msg" id="dr-lock-msg">${esc(message)}</p>
    </form>`;
  panel.querySelector('#dr-lock').addEventListener('submit', async (event) => {
    event.preventDefault();
    const msg = panel.querySelector('#dr-lock-msg');
    msg.textContent = '開いています…';
    try {
      const { opener, jwk } = await openerFromPhrase(box, panel.querySelector('#dr-phrase').value);
      const data = await openSealed(sealed, opener);
      if (panel.querySelector('#dr-remember').checked) {
        try { localStorage.setItem(REMEMBER, JSON.stringify(jwk)); } catch { /* 覚えられない端末でも、今回は開く */ }
      }
      start(panel, data);
    } catch {
      msg.textContent = '合言葉が違います。もう一度入れてください。';
    }
  });
}

export async function initDaiRank({ button, panel, url = './data/dai-rank.json' }) {
  if (!button || !panel) return;
  const plain = await fetchJson(url);
  if (plain && Array.isArray(plain.tabs) && Array.isArray(plain.nos)) {
    button.hidden = false;
    start(panel, plain);
    return;
  }
  const [box, sealed] = await Promise.all([fetchJson('./data/dai-rank.box.json'), fetchJson('./data/dai-rank.sealed.json')]);
  if (!box || !sealed || !globalThis.crypto?.subtle) return;
  button.hidden = false;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(REMEMBER)); } catch { saved = null; }
  if (saved) {
    try {
      const opener = await globalThis.crypto.subtle.importKey('jwk', saved, CURVE, true, ['deriveKey']);
      start(panel, await openSealed(sealed, opener));
      return;
    } catch {
      try { localStorage.removeItem(REMEMBER); } catch { /* なし */ }
    }
  }
  askPhrase(panel, box, sealed);
}
