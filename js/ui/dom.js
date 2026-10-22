// Small DOM helpers: making elements, keyboard-driven menus, pop-ups and toasts.
export const $ui = () => document.getElementById('ui');
// append() and prepend() skip null and false, so optional pieces can be written inline
for (const P of [Element.prototype, DocumentFragment.prototype]) for (const k of ['append', 'prepend']) { const f = P[k]; P[k] = function (...xs) { return f.apply(this, xs.flat(Infinity).filter((x) => x != null && x !== false)); }; }
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
export const clear = (n = $ui()) => { while (n.firstChild) n.firstChild.remove(); return n; };

// ---------------------------------------------------------------- keys: a stack of handlers, the top one hears the keys
const handlers = [];
export const pushKeys = (fn) => { handlers.push(fn); return () => { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); }; };
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', Enter: 'ok', ' ': 'ok', z: 'ok', Z: 'ok', Escape: 'back', x: 'back', X: 'back', Backspace: 'back', q: 'rotl', Q: 'rotl', e: 'rotr', E: 'rotr', Tab: 'tab', m: 'mute', M: 'mute' };
addEventListener('keydown', (ev) => {
  if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
  const k = KEYMAP[ev.key]; if (!k) return;
  const h = handlers[handlers.length - 1];
  if (h) { ev.preventDefault(); h(k, ev); }
});

// a menu: items = [{ label, right, disabled, onpick, hint }]; resolves to the picked index (or -1 on back)
export function menu(parent, items, { title, onmove, cancel = true, cls = '' } = {}) {
  return new Promise((resolve) => {
    let sel = Math.max(0, items.findIndex((i) => !i.disabled));
    const box = el('div', { class: `panel menu ${cls}` }, title ? el('div', { class: 'title small', style: { padding: '0 4px 4px' } }, title) : null);
    const btns = items.map((it, i) => {
      const b = el('button', { disabled: it.disabled || null, onclick: () => done(i), onmouseenter: () => { if (!it.disabled) { sel = i; paint(); } } }, el('span', {}, it.label), it.right != null ? el('span', { class: 'r' }, it.right) : null);
      box.append(b); return b;
    });
    const paint = () => { btns.forEach((b, i) => b.classList.toggle('sel', i === sel)); if (onmove) onmove(items[sel], sel); };
    const step = (d) => { for (let k = 0; k < items.length; k++) { sel = (sel + d + items.length) % items.length; if (!items[sel].disabled) break; } paint(); };
    const off = pushKeys((k) => { if (k === 'up') step(-1); else if (k === 'down') step(1); else if (k === 'ok') done(sel); else if (k === 'back' && cancel) done(-1); });
    function done(i) { if (i >= 0 && items[i].disabled) return; off(); box.remove(); resolve(i); }
    parent.append(box); paint();
    box.close = () => done(-1);
  });
}
export function toast(text, ms = 1600) { const t = el('div', { class: 'panel toast' }, text); $ui().append(t); setTimeout(() => t.remove(), ms); }
// a pop-up box with buttons; resolves to the index of the button pressed
export function modal(content, buttons = [], { wide = false } = {}) {
  return new Promise((resolve) => {
    const m = el('div', { class: 'modal' }), p = el('div', { class: 'panel', style: wide ? { width: 'min(900px, 100%)' } : {} }, content);
    const row = el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } });
    const close = (i) => { off(); m.remove(); resolve(i); };
    buttons.forEach((b, i) => row.append(el('button', { class: 'btn' + (i === 0 ? ' primary' : ''), onclick: () => close(i) }, b)));
    if (buttons.length) p.append(row);
    m.append(p); $ui().append(m);
    const off = pushKeys((k) => { if (k === 'ok' && buttons.length) close(0); else if (k === 'back') close(buttons.length ? buttons.length - 1 : -1); });
    // a stray tap outside does nothing: choose with the buttons (or Esc)
  });
}
// a pop-up you close yourself: returns close(); onBack runs on Escape or a click outside
// outside: whether a click outside the box closes it (off for boxes where a stray tap would lose your place)
export function sheet(content, { onBack, wide = false, outside = true } = {}) {
  const m = el('div', { class: 'modal' }), p = el('div', { class: 'panel', style: wide ? { width: 'min(900px, 100%)' } : {} }, content);
  m.append(p); $ui().append(m);
  let open = true;
  const close = () => { if (!open) return; open = false; off(); m.remove(); };
  const off = pushKeys((k) => { if (k === 'back') { close(); if (onBack) onBack(); } });
  m.addEventListener('click', (e) => { if (e.target === m && outside) { close(); if (onBack) onBack(); } });
  return close;
}
export const bar = (v, max, col) => el('div', { class: 'bar' }, el('i', { style: { width: `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`, background: col } }));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
