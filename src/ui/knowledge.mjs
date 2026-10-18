// 「知識編」画面。調べた報告（ホールの設定配分の調査と、それを店の台帳で確かめた結果）をスマホで読む（2026-10-18）。
// 店の数字が入るので、台番の順位と同じ鍵で封をした data/knowledge.sealed.json を置き、台番の順位で合言葉を入れると開く。
// 読める形の data/knowledge.json があればそれを使う（手元の確かめ用）。どちらも無い時はボタンごと出さない。
import { openSealed, whenUnlocked } from './dai-rank.mjs';

// 報告の中身は台本（tools/seal-knowledge.mjs）が pandoc で作った物だけ。念のため、決まった形の要素と属性だけを残す
const KEEP = new Set(['H1', 'H2', 'H3', 'H4', 'P', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD',
  'COLGROUP', 'COL', 'CAPTION', 'STRONG', 'EM', 'B', 'I', 'CODE', 'PRE', 'A', 'NAV', 'BR', 'HR', 'BLOCKQUOTE',
  'SPAN', 'DIV', 'SUP', 'SUB', 'DL', 'DT', 'DD', 'DEL', 'S']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON',
  'TEXTAREA', 'SELECT', 'OPTION', 'IMG', 'SVG', 'MATH', 'VIDEO', 'AUDIO', 'SOURCE', 'TRACK', 'TEMPLATE', 'CANVAS', 'PICTURE']);
const ATTRS = new Set(['id', 'class', 'href', 'data-label', 'colspan', 'rowspan', 'align']);

async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// 決まった要素と属性だけを残す。ページ内の飛び先は、ほかの画面とぶつからないように前に印を付ける
function clean(node, prefix) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    const tag = child.tagName;
    if (DROP.has(tag)) {
      child.remove();
      continue;
    }
    clean(child, prefix);
    if (!KEEP.has(tag)) {
      child.replaceWith(...child.childNodes);
      continue;
    }
    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (!ATTRS.has(name)) {
        child.removeAttribute(attr.name);
      } else if (name === 'id') {
        child.setAttribute('id', prefix + value);
      } else if (name === 'href') {
        if (value.startsWith('#')) {
          let target = value.slice(1);
          try { target = decodeURIComponent(target); } catch { /* そのまま */ }
          child.setAttribute('href', `#${prefix}${target}`);
          child.setAttribute('data-kn-jump', prefix + target);
        } else if (/^https:\/\//i.test(value)) {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        } else {
          child.removeAttribute('href');
        }
      }
    }
  }
}

function docBody(doc) {
  const parsed = new DOMParser().parseFromString(`<div>${doc.html}</div>`, 'text/html');
  const root = parsed.body.firstElementChild;
  clean(root, `kn-${doc.id}-`);
  const body = el('article', 'kn-doc');
  body.append(...[...document.importNode(root, true).childNodes]);
  return body;
}

function head(panel) {
  panel.replaceChildren(el('p', 'kicker', 'KNOWLEDGE'));
}

function listView(panel, data) {
  head(panel);
  panel.append(el('h1', null, '知識編'));
  panel.append(el('p', 'screen-helper', '調べた報告を読む所。押すと本文が開きます。'));
  const list = el('div', 'kn-list');
  data.docs.forEach((doc) => {
    const card = el('button', 'kn-card');
    card.type = 'button';
    card.append(el('span', 'kn-kind', doc.kind), el('b', 'kn-title', doc.title), el('span', 'kn-lead', doc.lead),
      el('i', 'kn-meta', `${doc.made}・約${Math.max(1, Math.round(doc.chars / 1000))}千字`));
    card.addEventListener('click', () => docView(panel, data, doc));
    list.append(card);
  });
  panel.append(list, el('p', 'kn-foot', `更新 ${data.updated}`));
}

function docView(panel, data, doc) {
  head(panel);
  const back = el('button', 'kn-back', '← 知識編の一覧へ');
  back.type = 'button';
  back.addEventListener('click', () => {
    listView(panel, data);
    window.scrollTo({ top: 0 });
  });
  panel.append(back, docBody(doc));
  const bottom = back.cloneNode(true);
  bottom.addEventListener('click', () => {
    listView(panel, data);
    window.scrollTo({ top: 0 });
  });
  panel.append(bottom);
  window.scrollTo({ top: 0 });
}

function lockedView(panel, rankButton) {
  head(panel);
  panel.append(el('h1', null, '知識編'));
  panel.append(el('p', 'screen-helper', '店の数字が入っているので、合言葉で開きます。「台番の順位」で合言葉を入れると、ここも開きます。'));
  if (rankButton) {
    const go = el('button', 'dr-apply', '台番の順位で合言葉を入れる');
    go.type = 'button';
    go.addEventListener('click', () => {
      rankButton.click();
      window.scrollTo({ top: 0 });
    });
    panel.append(go);
  }
}

function jump(panel) {
  panel.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-kn-jump]');
    if (!link) return;
    event.preventDefault();
    const target = [...panel.querySelectorAll('[id]')].find((node) => node.id === link.dataset.knJump);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function usable(data) {
  return data && Array.isArray(data.docs) && data.docs.length > 0;
}

export async function initKnowledge({ button, panel, rankButton }) {
  if (!button || !panel) return;
  jump(panel);
  const plain = await fetchJson('./data/knowledge.json');
  if (usable(plain)) {
    button.hidden = false;
    listView(panel, plain);
    return;
  }
  const sealed = await fetchJson('./data/knowledge.sealed.json');
  if (!sealed || !globalThis.crypto?.subtle) return;
  button.hidden = false;
  lockedView(panel, rankButton);
  const opener = await whenUnlocked();
  try {
    const data = await openSealed(sealed, opener);
    if (usable(data)) listView(panel, data);
  } catch {
    head(panel);
    panel.append(el('h1', null, '知識編'), el('p', 'screen-helper', '開けませんでした。アプリを開き直してください。'));
  }
}
