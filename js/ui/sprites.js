// Pixel art drawn in code: soldiers of every class (three looks each, as they promote), officers' portraits,
// the battlefield's tiles (roads, walls and water join up with their neighbours), and tall things that stand on
// the ground (the keep, gatehouses, houses, tents, chests). Cached on small canvases, drawn scaled with crisp pixels.
const cache = new Map();
const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
export const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const hex = (c) => { if (c.startsWith('rgb')) return c.match(/\d+/g).map(Number); const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const shade = (c, k) => { const [r, g, b] = hex(c); const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
// a 1-pixel dark outline around whatever was drawn (makes small sprites read clearly on busy ground)
function outline(g, w, h, col = [26, 16, 10]) {
  const d = g.getImageData(0, 0, w, h), a = d.data, out = new Uint8ClampedArray(a);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (a[i + 3]) continue;
    const n = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < h && a[(ny * w + nx) * 4 + 3] > 0; };
    if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) { out[i] = col[0]; out[i + 1] = col[1]; out[i + 2] = col[2]; out[i + 3] = 235; }
  }
  d.data.set(out); g.putImageData(d, 0, 0);
}
function grayscale(g, w, h) { const d = g.getImageData(0, 0, w, h), a = d.data; for (let i = 0; i < a.length; i += 4) { const v = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) * 0.72; a[i] = a[i + 1] = a[i + 2] = v; } g.putImageData(d, 0, 0); }

// ---------------------------------------------------------------- units: 32×32, facing right
export function unitSprite(line, tier, col, frame = 0, gray = false) {
  const key = `u|${line}|${tier}|${col}|${frame}|${gray}`;
  if (cache.has(key)) return cache.get(key);
  const c = mk(32, 32), g = c.getContext('2d');
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  const step = frame ? 1 : 0;
  const skin = '#f2c69a', skinD = '#d09a6e', dark = '#24160c';
  const steel = tier === 2 ? '#f0d470' : tier === 1 ? '#c8d0dc' : '#9a9ca0', steelD = tier === 2 ? '#b08a30' : tier === 1 ? '#7a8494' : '#5e6066', steelL = tier === 2 ? '#fff0b0' : '#eef2f8';
  const cl = col, clD = shade(col, -0.4), clL = shade(col, 0.32), trim = tier === 2 ? '#ffd860' : tier === 1 ? '#e8e0c8' : shade(col, 0.55);
  // a little flag on a pole over the back (靠旗)
  const banner = (x, y) => { R(x, y, 1, 13, '#5a3a1a'); R(x + 1, y, 5, 4, cl); R(x + 1, y, 5, 1, clL); R(x + 1, y + 3, 5, 1, clD); if (tier) R(x + 2, y + 1, 2, 2, trim); };
  const head = (x, y, hat) => {
    R(x, y + 2, 6, 5, skin); R(x + 4, y + 3, 1, 1, dark); R(x, y + 6, 6, 1, skinD); R(x + 5, y + 5, 1, 1, skinD);
    if (hat === 'helm') { R(x - 1, y, 8, 3, steel); R(x - 1, y, 8, 1, steelL); R(x - 1, y + 3, 2, 2, steelD); R(x + 1, y - 1, 4, 1, steel); if (tier >= 1) R(x + 2, y - 3, 2, 2, tier === 2 ? '#e03030' : clL); if (tier === 2) R(x + 3, y - 5, 1, 2, '#ff5050'); }
    if (hat === 'cap') { R(x - 1, y, 8, 3, '#7a5a3a'); R(x - 1, y, 8, 1, '#9a7a5a'); }
    if (hat === 'scarf') { R(x - 1, y - 1, 8, 4, '#f4f4ee'); R(x - 1, y + 2, 8, 1, '#c8c8c0'); R(x - 2, y + 1, 2, 5, '#f4f4ee'); }
    if (hat === 'knot') { R(x, y, 6, 2, '#1a1a1a'); R(x + 2, y - 2, 3, 2, '#1a1a1a'); R(x + 3, y - 3, 1, 1, '#ffd070'); }
    if (hat === 'band') { R(x, y + 1, 6, 1, tier === 2 ? '#ffd040' : '#d02a2a'); R(x - 2, y + 1, 2, 3, tier === 2 ? '#ffd040' : '#d02a2a'); R(x, y, 6, 1, '#1a1a1a'); }
    if (hat === 'wrap') { R(x - 1, y, 8, 3, '#6a4a32'); R(x - 2, y + 2, 2, 4, '#6a4a32'); }
    if (hat === 'crown') { R(x - 1, y, 8, 2, '#ffd040'); R(x, y - 2, 2, 2, '#ffd040'); R(x + 4, y - 2, 2, 2, '#ffd040'); R(x + 2, y - 3, 2, 3, '#ffe890'); R(x + 2, y - 1, 2, 1, '#e02a2a'); if (tier >= 1) R(x + 2, y - 6, 1, 3, '#ff4040'); }
  };
  // a standing figure: legs, body (armour, robe or bare), head
  const figure = (x, y, o = {}) => {
    if (!o.robe) { R(x + 1, y + 13, 3, 5 - step, '#3e2a1c'); R(x + 5, y + 13, 3, 4 + step, '#3e2a1c'); R(x + 1, y + 18 - step, 3, 1, dark); R(x + 5, y + 17 + step, 3, 1, dark); }
    else { R(x, y + 13, 9, 5, cl); R(x, y + 17, 9, 1, clD); R(x + 1, y + 18, 3, 1, dark); R(x + 5, y + 18, 3, 1, dark); R(x + 4, y + 8, 1, 10, trim); }
    R(x, y + 7, 9, 7, o.bare ? skin : cl); R(x, y + 7, 9, 1, o.bare ? '#ffe0c0' : clL); R(x + 7, y + 8, 2, 6, o.bare ? skinD : clD);
    if (o.armour && tier >= 1) { R(x + 1, y + 8, 7, 3, steel); R(x + 1, y + 8, 7, 1, steelL); R(x, y + 7, 2, 3, steel); R(x + 7, y + 7, 2, 3, steel); }
    if (o.armour && tier === 0) R(x + 1, y + 10, 7, 1, '#5a4a3a');
    if (o.bare) { R(x, y + 12, 9, 2, cl); R(x + 2, y + 9, 1, 1, skinD); R(x + 6, y + 9, 1, 1, skinD); }
    R(x, y + 13, 9, 1, o.bare ? clD : trim);
    head(x + 2, y, o.hat);
  };
  // a horse facing right: barrel, arched neck, head, four legs that walk
  const horse = (x, y, coat, coatD, mane) => {
    R(x + 3, y + 8, 15, 7, coat); R(x + 3, y + 8, 15, 1, shade(coat, 0.25)); R(x + 3, y + 14, 15, 1, coatD);
    R(x + 16, y + 3, 4, 7, coat); R(x + 18, y + 1, 5, 4, coat); R(x + 21, y + 3, 2, 2, coatD); R(x + 20, y + 2, 1, 1, dark); R(x + 18, y, 2, 2, coat);
    R(x + 15, y + 2, 2, 7, mane); R(x + 1, y + 9, 3, 2, mane); R(x, y + 10, 2, 5, mane);
    const L = frame ? [[4, 0], [7, 2], [13, 2], [16, 0]] : [[4, 2], [7, 0], [13, 0], [16, 2]];
    for (const [lx, d] of L) { R(x + lx, y + 15, 2, 6 - d, coatD); R(x + lx, y + 21 - d, 2, 1, dark); }
    R(x + 7, y + 7, 7, 4, cl); R(x + 7, y + 10, 7, 1, trim);
    if (tier >= 1) { R(x + 17, y + 2, 4, 2, steel); R(x + 4, y + 11, 12, 2, clD); R(x + 4, y + 13, 12, 1, trim); }
  };
  const rider = (x, y, hat) => {
    R(x, y + 6, 7, 7, cl); R(x, y + 6, 7, 1, clL); R(x + 5, y + 7, 2, 6, clD);
    if (tier >= 1) { R(x, y + 7, 7, 2, steel); R(x - 1, y + 6, 2, 2, steel); }
    head(x + 1, y, hat);
  };
  switch (line) {
    case 'inf': {
      banner(9, 1); figure(11, 9, { armour: true, hat: 'helm' });
      R(22, 4, 1, 22, '#7a5428'); R(21, 2, 3, 4, steel); R(22, 1, 1, 1, steelL);
      R(8, 16, 4, 8, tier === 2 ? '#c8a040' : tier === 1 ? steel : '#8a5a2a'); R(8, 16, 4, 1, steelL); R(9, 19, 2, 2, trim);
      break;
    }
    case 'arch': {
      banner(9, 2); figure(11, 9, { armour: tier >= 1, hat: tier ? 'helm' : 'cap' });
      R(23, 8, 1, 2, '#7a4a20'); R(24, 10, 1, 10, '#8a5a28'); R(23, 20, 1, 2, '#7a4a20'); R(21, 9, 1, 13, '#e8e8e0'); R(20, 14, 4, 1, '#d8c8a8');
      R(8, 15, 3, 8, '#8a6a3a'); R(8, 14, 1, 2, '#f0f0f0'); R(10, 14, 1, 2, '#f0f0f0');
      if (tier === 2) { R(19, 16, 5, 2, steel); R(18, 15, 2, 4, '#6a4a2a'); }
      break;
    }
    case 'cav': {
      horse(2, 9, tier === 2 ? '#3a2418' : tier === 1 ? '#6a4228' : '#946038', tier === 2 ? '#1e120a' : '#4a2a14', '#2a1a10');
      banner(10, 0); rider(11, 3 + step, 'helm');
      R(21, 0, 1, 18, '#7a5428'); R(20, 0, 3, 3, steel); R(21, 3, 1, 1, tier ? '#e03030' : steelD);
      break;
    }
    case 'hbow': {
      horse(2, 9, tier === 2 ? '#e8e0d0' : '#a87848', tier === 2 ? '#a8a090' : '#6a4424', '#3a2a1a');
      banner(10, 0); rider(11, 3 + step, tier ? 'helm' : 'cap');
      R(20, 4, 1, 2, '#7a4a20'); R(21, 6, 1, 8, '#8a5a28'); R(20, 14, 1, 2, '#7a4a20'); R(19, 5, 1, 10, '#e8e8e0');
      break;
    }
    case 'lord': {
      horse(2, 9, tier === 2 ? '#f4f0e8' : tier === 1 ? '#2a2a2a' : '#8a5030', tier === 2 ? '#b8b0a0' : tier === 1 ? '#101010' : '#5a3018', tier === 2 ? '#e8d070' : '#1a1a1a');
      R(8, 7 + step, 4, 10, tier === 2 ? '#ffd040' : '#c02a2a'); R(8, 16 + step, 4, 1, shade(tier === 2 ? '#ffd040' : '#c02a2a', -0.3));
      rider(11, 3 + step, 'crown');
      R(19, 1 + step, 1, 9, steelL); R(18, 9 + step, 3, 1, '#ffd040'); R(19, 10 + step, 1, 2, '#6a4a2a');
      R(4, 0, 1, 12, '#5a3a1a'); R(5, 0, 7, 5, cl); R(5, 0, 7, 1, clL); R(7, 1, 3, 3, '#ffd040');
      break;
    }
    case 'strat': {
      figure(11, 9, { robe: true, hat: 'scarf' });
      R(21, 13, 4, 5, '#f8f8f2'); R(21, 13, 4, 1, '#ffffff'); R(22, 18, 1, 3, '#8a6a3a'); R(24, 14, 1, 3, '#e0e0d8');
      if (tier >= 1) R(11, 16, 9, 1, '#ffd070');
      if (tier === 2) R(10, 17, 2, 9, '#c02a2a');
      break;
    }
    case 'taoist': {
      figure(11, 9, { robe: true, hat: 'knot' });
      const orb = tier === 2 ? '#ffe070' : '#a0e0ff';
      R(22, 4, 1, 22, '#8a6a3a'); R(21, 2, 3, 3, orb); R(20, 3, 1, 1, orb); R(24, 3, 1, 1, orb);
      R(11, 15, 9, 1, tier ? '#e8e0ff' : '#e8d070');
      break;
    }
    case 'brawl': figure(11, 9, { bare: true, hat: 'band' }); R(20, 15 - step, 4, 4, tier ? steel : skin); R(20, 15 - step, 4, 1, '#f0f0f0'); R(7, 16 + step, 4, 4, tier ? steel : skin); break;
    case 'bandit': figure(11, 9, { hat: 'wrap' }); R(12, 16, 7, 2, '#6a4a32'); R(22, 6, 1, 18, '#6a4a2a'); R(22, 5, 5, 6, steel); R(23, 6, 3, 4, steelL); R(26, 6, 1, 4, steelD); break;
    case 'siege': {
      const wood = '#946034', wd = '#5e3a1a', wl = '#b8804a';
      R(3, 18, 26, 7, wood); R(3, 18, 26, 1, wl); R(3, 24, 26, 1, wd);
      for (const wx of [6, 21]) { R(wx, 23, 6, 6, wd); R(wx + 1, 24, 4, 4, '#c8a060'); R(wx + 2, 25, 2, 2, wd); }
      if (tier === 0) { R(5, 11, 22, 7, wd); R(6, 10, 20, 2, cl); R(6, 12, 20, 1, clD); R(26, 13, 4, 4, steel); R(29, 14, 2, 2, steelL); }
      else { R(14, 6 - step, 3, 13, wd); R(10, 4 - step, 12, 3, wd); R(20, 1 - step, 5, 5, '#8a8a8a'); R(21, 2 - step, 2, 2, '#b0b0b0'); R(8, 16, 16, 2, cl); if (tier === 2) { R(4, 14, 5, 4, '#ffd040'); R(25, 14, 3, 4, steel); } }
      R(2, 8, 1, 10, '#5a3a1a'); R(3, 8, 5, 4, cl); R(3, 8, 5, 1, clL);
      break;
    }
    case 'tower': {
      R(6, 12, 20, 18, '#8e8a84'); for (let y = 13; y < 30; y += 4) for (let x = (y / 4) % 2 ? 6 : 9; x < 26; x += 6) R(x, y, 5, 3, '#a4a09a');
      R(6, 12, 2, 18, '#bab6ae'); R(24, 12, 2, 18, '#6a6660');
      R(3, 6, 26, 7, tier === 2 ? '#7a2a1a' : '#5a3a28'); R(5, 3, 22, 4, tier === 2 ? '#9a3a24' : '#6e4a32'); R(3, 12, 26, 1, '#2a1a10'); R(14, 0, 4, 3, '#ffd040');
      R(13, 15, 6, 6, '#2a1c14'); R(14, 16, 3, 2, skin); R(17, 16, 1, 5, '#8a5a28');
      R(27, 0, 1, 10, '#5a3a1a'); R(28, 0, 4, 4, cl);
      break;
    }
  }
  outline(g, 32, 32);
  if (gray) grayscale(g, 32, 32);
  cache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- portraits: 32×32
const FEMALE = new Set('孫尚香 祝融 馬雲祿 貂蟬 甄姬 大喬 小喬 蔡文姬 黃月英 王異 鮑三娘 關銀屏 張星彩 王元姬 辛憲英 步練師 卞氏 吳國太 糜夫人 甘夫人 孫魯班 夏侯氏 樊氏 Erin'.split(' '));
const LOOKS = {
  關羽: { face: '#c84a3a', beard: 'long', bc: '#1a1008', hat: 'green' }, 張飛: { face: '#8a6040', beard: 'bush', bc: '#101010' }, 劉備: { beard: 'goatee', hat: 'crown' },
  曹操: { beard: 'goatee', hat: 'crown' }, 孫權: { beard: 'short', bc: '#6a3a1a', eye: '#3a7a3a' }, 諸葛亮: { hat: 'scarf', beard: 'goatee' }, 呂布: { hat: 'pheasant' },
  趙雲: { beard: 'none', hat: 'silver' }, 馬超: { beard: 'none', hat: 'lion' }, 黃忠: { beard: 'long', bc: '#e0e0e0', hair: '#e0e0e0' }, 司馬懿: { beard: 'goatee', hat: 'scarf' },
  周瑜: { beard: 'none', hat: 'crown' }, 典韋: { beard: 'bush', face: '#9a6a4a' }, 許褚: { beard: 'none', hair: '#101010', face: '#d8a070' }, 董卓: { beard: 'bush', face: '#d89a7a' },
  孟獲: { face: '#8a5a3a', beard: 'bush', hat: 'feather' }, 張角: { hat: 'yellow', beard: 'long' }, 于吉: { hat: 'yellow', beard: 'long', bc: '#f0f0f0', hair: '#f0f0f0' }, 左慈: { beard: 'long', bc: '#f0f0f0', hair: '#f0f0f0' },
  袁紹: { beard: 'goatee', hat: 'crown' }, 孫策: { beard: 'none', hat: 'crown' }, 孫堅: { beard: 'short', hat: 'red' }, 夏侯惇: { patch: true, beard: 'short' }, 姜維: { beard: 'none', hat: 'silver' },
};
export function portrait(o, colIn = '#8a2a2a') {
  const key = `p|${o.name}|${o.line}|${colIn}`;
  if (cache.has(key)) return cache.get(key);
  const c = mk(32, 32), g = c.getContext('2d'), r = rnd(hash(o.name)), L = LOOKS[o.name] || {};
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  const fem = FEMALE.has(o.name);
  const face = L.face || ['#f0c898', '#e8b888', '#d8a878', '#f4d0a8'][Math.floor(r() * 4)], fd = shade(face, -0.18), fdd = shade(face, -0.32);
  const hair = L.hair || (o.lv > 30 && r() < 0.3 ? '#a0a0a0' : ['#1a1008', '#2a1a10', '#3a2416', '#101010'][Math.floor(r() * 4)]);
  const beard = fem ? 'none' : L.beard || ['none', 'short', 'goatee', 'long', 'bush', 'goatee'][Math.floor(r() * 6)], bc = L.bc || hair;
  const bg = g.createLinearGradient(0, 0, 0, 32); bg.addColorStop(0, shade(colIn, -0.25)); bg.addColorStop(1, shade(colIn, -0.65)); g.fillStyle = bg; g.fillRect(0, 0, 32, 32);
  g.fillStyle = 'rgba(255,240,200,.12)'; g.beginPath(); g.arc(16, 13, 12, 0, Math.PI * 2); g.fill();
  const armoured = ['inf', 'cav', 'lord', 'hbow', 'siege', 'arch'].includes(o.line);
  R(3, 25, 26, 7, colIn); R(3, 25, 26, 1, shade(colIn, 0.3)); R(13, 25, 6, 7, shade(colIn, -0.3)); R(15, 25, 2, 7, shade(colIn, 0.45));
  if (armoured) { const m = o.lv >= 30 ? '#e8d070' : o.lv >= 15 ? '#c8d0dc' : '#9a9aa0'; R(2, 24, 8, 5, m); R(22, 24, 8, 5, m); R(2, 24, 8, 1, '#ffffff'); R(22, 24, 8, 1, '#ffffff'); R(3, 28, 6, 1, shade(m, -0.3)); R(23, 28, 6, 1, shade(m, -0.3)); }
  R(13, 21, 6, 5, fd); R(9, 8, 14, 15, face); R(8, 11, 1, 6, face); R(23, 11, 1, 6, face);
  R(20, 9, 3, 13, fd); R(9, 21, 14, 1, fd); R(23, 13, 1, 3, fdd); R(8, 13, 1, 3, fd);
  R(9, 6, 14, 4, hair); R(8, 8, 2, 6, hair); R(22, 8, 2, 6, hair); R(11, 6, 6, 1, shade(hair, 0.25));
  if (fem) { R(7, 8, 3, 16, hair); R(22, 8, 3, 16, hair); R(12, 3, 8, 4, hair); R(15, 2, 2, 2, '#ffd040'); R(19, 4, 3, 1, '#e04060'); }
  const eye = L.eye || '#1a1a1a', ey = 13 + Math.floor(r() * 2);
  R(11, ey, 3, 2, '#fff'); R(18, ey, 3, 2, '#fff'); R(12, ey, 2, 2, eye); R(19, ey, 2, 2, eye); R(12, ey, 1, 1, '#fff'); R(19, ey, 1, 1, '#fff');
  const brow = fem ? 1 : 2; R(10, ey - 2, 5, brow, hair); R(17, ey - 2, 5, brow, hair);
  if (!fem && r() < 0.5) { R(10, ey - 3, 2, 1, hair); R(20, ey - 3, 2, 1, hair); }
  if (L.patch) { R(17, ey - 1, 5, 4, '#1a1a1a'); R(9, ey - 2, 14, 1, '#1a1a1a'); }
  R(15, ey + 3, 2, 2, fd); R(16, ey + 4, 1, 1, fdd);
  R(13, 19, 6, 1, fem ? '#c84a5a' : fdd);
  if (fem) { R(10, 17, 2, 1, 'rgba(255,120,120,.5)'); R(20, 17, 2, 1, 'rgba(255,120,120,.5)'); }
  if (beard === 'short') { R(10, 18, 12, 4, bc); R(13, 19, 6, 1, face); R(10, 18, 12, 1, shade(bc, 0.2)); }
  if (beard === 'goatee') { R(14, 20, 4, 4, bc); R(11, 17, 3, 1, bc); R(18, 17, 3, 1, bc); }
  if (beard === 'long') { R(11, 18, 10, 5, bc); R(12, 23, 8, 5, bc); R(14, 28, 4, 3, bc); R(13, 19, 6, 1, face); R(15, 22, 1, 8, shade(bc, 0.25)); }
  if (beard === 'bush') { R(8, 15, 16, 9, bc); R(10, 24, 12, 3, bc); R(12, 19, 8, 1, '#7a2a2a'); for (let i = 0; i < 8; i++) R(8 + Math.floor(r() * 15), 15 + Math.floor(r() * 10), 1, 2, shade(bc, 0.3)); }
  const hat = L.hat || ({ strat: 'scarf', taoist: 'yellowknot', brawl: 'band', bandit: 'wrap', lord: 'crown' })[o.line] || (fem ? null : (armoured ? 'helm' : null));
  const metal = o.lv >= 30 ? '#e8d070' : o.lv >= 15 ? '#c8d0dc' : '#9a9aa0';
  if (hat === 'helm') { R(8, 4, 16, 5, metal); R(7, 8, 18, 2, metal); R(15, 0, 2, 4, '#c03030'); R(8, 4, 16, 1, '#ffffff'); R(8, 8, 16, 1, shade(metal, -0.3)); R(15, 5, 2, 3, shade(metal, -0.2)); }
  if (hat === 'silver') { R(8, 4, 16, 5, '#e0e8f0'); R(7, 8, 18, 2, '#c0c8d0'); R(15, 0, 2, 4, '#ffffff'); R(8, 4, 16, 1, '#ffffff'); }
  if (hat === 'lion') { R(8, 3, 16, 6, '#e0e8f0'); R(7, 8, 18, 2, '#c0c8d0'); R(12, 1, 8, 3, '#ffd040'); R(13, 5, 2, 2, '#c03030'); R(17, 5, 2, 2, '#c03030'); }
  if (hat === 'crown') { R(10, 3, 12, 4, '#2a2a2a'); R(9, 6, 14, 2, '#ffd040'); R(14, 1, 4, 3, '#ffd040'); R(15, 2, 2, 1, '#e03030'); R(9, 6, 14, 1, '#fff0a0'); }
  if (hat === 'scarf') { R(9, 3, 14, 5, '#f0f0f0'); R(9, 7, 14, 1, '#d0d0d0'); R(21, 6, 4, 8, '#f0f0f0'); R(10, 3, 12, 1, '#ffffff'); }
  if (hat === 'green') { R(9, 3, 14, 5, '#2a7a3a'); R(9, 7, 14, 1, '#1a5a2a'); R(10, 3, 12, 1, '#4a9a5a'); }
  if (hat === 'red') { R(9, 3, 14, 5, '#c03030'); R(9, 7, 14, 1, '#801818'); }
  if (hat === 'yellow' || hat === 'yellowknot') { R(12, 2, 8, 5, hat === 'yellow' ? '#e0c020' : hair); R(14, 1, 4, 2, hat === 'yellow' ? '#e0c020' : hair); R(15, 0, 2, 2, '#ffd070'); }
  if (hat === 'band') { R(8, 9, 16, 2, '#e03030'); R(23, 10, 3, 5, '#e03030'); }
  if (hat === 'wrap') { R(8, 4, 16, 6, '#6a4a3a'); R(22, 8, 3, 6, '#6a4a3a'); R(8, 4, 16, 1, '#8a6a5a'); }
  if (hat === 'pheasant') { R(8, 4, 16, 5, '#e8d070'); R(7, 8, 18, 2, '#e8d070'); R(6, 0, 2, 6, '#e05030'); R(24, 0, 2, 6, '#e05030'); R(4, 0, 3, 2, '#e05030'); R(25, 0, 3, 2, '#e05030'); }
  if (hat === 'feather') { R(9, 5, 14, 3, '#c8a040'); R(10, 0, 2, 6, '#3a8a3a'); R(15, 0, 2, 6, '#e0c040'); R(20, 0, 2, 6, '#c03030'); }
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeRect(0.5, 0.5, 31, 31);
  g.strokeStyle = 'rgba(255,220,140,.25)'; g.strokeRect(1.5, 1.5, 29, 29);
  cache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- tiles: 24×24
// mask: which neighbours (N 1, E 2, S 4, W 8) are the same kind (roads, walls); land: which neighbours of water are land
const BASE = {
  plain: ['#b4c070', '#a4b05e', '#c4cc84'], grass: ['#7cae4a', '#6a9c3a', '#8cbc58'], forest: ['#6e9c48', '#5a8a3a', '#7eac58'], hill: ['#b4c070', '#a4b05e', '#c4cc84'], mount: ['#9a9488', '#8a8478', '#aaa498'],
  river: ['#3a78c0', '#2e68ae', '#5a98d8'], moat: ['#2e5e9a', '#244e86', '#4a7ab8'], shoal: ['#6aa8d8', '#5a98c8', '#8ac0e8'], bridge: ['#3a78c0', '#2e68ae', '#5a98d8'], road: ['#b4c070', '#a4b05e', '#c4cc84'],
  village: ['#b4c070', '#a4b05e', '#c4cc84'], marsh: ['#5e7e4c', '#4e6e40', '#6e8e5c'], desert: ['#e4cc8c', '#d4bc7c', '#f0dca4'], snow: ['#eef2f8', '#d8e0ee', '#ffffff'],
  wall: ['#8a8a8a', '#6e6e6e', '#a4a4a4'], gate: ['#8a8a8a', '#6e6e6e', '#a4a4a4'], town: ['#bcb4a4', '#aca494', '#ccc4b4'], castle: ['#bcb4a4', '#aca494', '#ccc4b4'], camp: ['#b4c070', '#a4b05e', '#c4cc84'], fence: ['#b4c070', '#a4b05e', '#c4cc84'],
};
export function tileSprite(t, variant = 0, frame = 0, mask = 0, land = 0) {
  const key = `t|${t}|${variant}|${frame}|${mask}|${land}`;
  if (cache.has(key)) return cache.get(key);
  const c = mk(24, 24), g = c.getContext('2d'), r = rnd(hash(t) + variant * 977 + 1), [a, b, l] = BASE[t] || BASE.plain;
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  R(0, 0, 24, 24, a);
  for (let i = 0; i < 26; i++) R(Math.floor(r() * 24), Math.floor(r() * 24), 1 + Math.floor(r() * 3), 1, r() < 0.5 ? b : l);
  const tuft = (x, y, c1, c2) => { R(x, y, 1, 2, c1); R(x + 1, y - 1, 1, 3, c2); R(x + 2, y, 1, 2, c1); };
  const tree = (x, y, pine) => {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(x + 4, y + 10, 5, 2, 0, 0, Math.PI * 2); g.fill();
    R(x + 3, y + 7, 2, 4, '#5a3a1a');
    if (pine) { R(x + 1, y + 4, 6, 4, '#2e5e22'); R(x + 2, y + 1, 4, 4, '#3a6e2a'); R(x + 3, y - 1, 2, 3, '#4a7e34'); R(x + 3, y + 1, 1, 2, '#6a9e48'); }
    else { R(x, y + 1, 8, 6, '#3a6e2a'); R(x + 1, y, 6, 2, '#4a7e34'); R(x + 1, y + 1, 3, 2, '#6a9e48'); R(x + 5, y + 4, 3, 3, '#2a5a1e'); }
  };
  switch (t) {
    case 'plain': for (let i = 0; i < 3; i++) tuft(Math.floor(r() * 20), 3 + Math.floor(r() * 18), '#8a9a48', '#9aaa58'); if (variant === 1) { R(5, 6, 1, 1, '#f0e060'); R(16, 15, 1, 1, '#f08080'); } break;
    case 'grass': for (let i = 0; i < 7; i++) tuft(Math.floor(r() * 21), 3 + Math.floor(r() * 19), '#4e8a2c', '#5e9c38'); if (variant === 2) { R(7, 9, 1, 1, '#ffffff'); R(15, 4, 1, 1, '#f0e060'); R(18, 17, 1, 1, '#ffffff'); } break;
    case 'forest': { const spots = [[1, 2], [12, 0], [6, 10], [15, 11], [0, 13], [9, 4]]; for (const [x, y] of spots.slice(0, 4 + (variant % 3))) tree(x, y, (x + y + variant) % 3 === 0); break; }
    case 'hill': {
      // a rolling grassy rise: lit on the upper left, in shade on the lower right, a rocky outcrop on some
      const dome = (cx, cy, rx, ry, cl, cd) => { g.fillStyle = cd; g.beginPath(); g.ellipse(cx + 1, cy + 1, rx, ry, 0, Math.PI, 0); g.lineTo(cx + rx + 1, cy + 2); g.lineTo(cx - rx + 1, cy + 2); g.fill(); g.fillStyle = cl; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); g.fill(); g.fillStyle = shade(cl, 0.18); g.beginPath(); g.ellipse(cx - rx * 0.3, cy - ry * 0.45, rx * 0.45, ry * 0.35, 0, 0, Math.PI * 2); g.fill(); };
      dome(15, 19, 9, 10, '#a8a058', '#7a7038'); dome(7, 22, 7, 7, '#b4ac64', '#86783e');
      if (variant % 2) { R(15, 12, 4, 3, '#9a9080'); R(15, 12, 4, 1, '#c0b8a8'); }
      tuft(4, 21, '#6a8a38', '#7a9a48'); tuft(17, 20, '#6a8a38', '#7a9a48');
      break;
    }
    case 'mount': R(1, 15, 22, 9, '#6a6258'); R(3, 9, 18, 7, '#7a7268'); R(6, 4, 12, 6, '#8a8278'); R(9, 1, 6, 4, '#9a9288'); R(10, 0, 4, 3, '#f4f6fa'); R(9, 2, 2, 2, '#e0e6f0'); R(12, 4, 2, 18, '#5a524a'); R(16, 8, 4, 14, '#5a524a'); R(5, 12, 3, 4, '#a49c90'); R(2, 22, 20, 2, '#4a443c'); break;
    case 'river': case 'moat': case 'shoal': case 'bridge': {
      const ph = frame * 4;
      for (let y = 2; y < 24; y += 5) for (let x = (y * 3 + ph) % 10; x < 24; x += 10) R(x, y, 4, 1, t === 'shoal' ? '#b0dcf2' : shade(a, 0.35));
      if (t === 'shoal') for (let i = 0; i < 5; i++) R(Math.floor(r() * 22), Math.floor(r() * 22), 2, 2, '#a89878');
      if (frame && t !== 'shoal') R(Math.floor(r() * 20), Math.floor(r() * 20), 2, 1, '#e8f6ff');
      const bankC = t === 'moat' ? '#7a7a7a' : '#d8c890';
      if (land & 1) { R(0, 0, 24, 3, bankC); R(0, 3, 24, 1, '#f0f8ff'); }
      if (land & 2) { R(21, 0, 3, 24, bankC); R(20, 0, 1, 24, '#f0f8ff'); }
      if (land & 4) { R(0, 21, 24, 3, bankC); R(0, 20, 24, 1, '#f0f8ff'); }
      if (land & 8) { R(0, 0, 3, 24, bankC); R(3, 0, 1, 24, '#f0f8ff'); }
      if (t === 'bridge') {
        const across = (mask & 2) || (mask & 8);
        if (across) { R(0, 4, 24, 16, '#a8783e'); for (let x = 1; x < 24; x += 4) R(x, 4, 1, 16, '#7a5226'); R(0, 4, 24, 2, '#6a4420'); R(0, 18, 24, 2, '#6a4420'); }
        else { R(4, 0, 16, 24, '#a8783e'); for (let y = 1; y < 24; y += 4) R(4, y, 16, 1, '#7a5226'); R(4, 0, 2, 24, '#6a4420'); R(18, 0, 2, 24, '#6a4420'); }
      }
      break;
    }
    case 'road': {
      const rc = '#d8c08e', re = '#bea46e';
      R(6, 6, 12, 12, rc);
      if (mask & 1) R(6, 0, 12, 7, rc); if (mask & 4) R(6, 17, 12, 7, rc); if (mask & 2) R(17, 6, 7, 12, rc); if (mask & 8) R(0, 6, 7, 12, rc);
      if (!mask) R(0, 6, 24, 12, rc);
      for (let i = 0; i < 7; i++) R(7 + Math.floor(r() * 10), 7 + Math.floor(r() * 10), 1, 1, re);
      if (mask & 2 && mask & 8) { R(0, 11, 24, 1, re); } else if (mask & 1 && mask & 4) { R(11, 0, 1, 24, re); }
      break;
    }
    case 'village': case 'camp': case 'fence': tuft(3, 20, '#8a9a48', '#9aaa58'); tuft(18, 4, '#8a9a48', '#9aaa58'); break;
    case 'marsh': for (let i = 0; i < 4; i++) { const x = Math.floor(r() * 17), y = 2 + Math.floor(r() * 18); R(x, y, 7, 2, '#4a6a8a'); R(x + 1, y, 5, 1, '#6a8aaa'); R(x + 1, y - 2, 1, 3, '#8aa860'); R(x + 5, y - 3, 1, 4, '#9ab870'); R(x + 5, y - 4, 1, 1, '#6a4a2a'); } break;
    case 'desert': for (let y = 3; y < 24; y += 7) { R(0, y, 24, 1, '#c8b070'); R(3 + (y % 5), y + 1, 12, 1, '#fff0c0'); } if (variant === 3) { R(16, 12, 2, 7, '#5a8a3a'); R(14, 14, 2, 1, '#5a8a3a'); R(14, 13, 1, 2, '#5a8a3a'); } break;
    case 'snow': for (let i = 0; i < 9; i++) R(Math.floor(r() * 22), Math.floor(r() * 22), 2, 1, '#c0cce0'); if (variant === 1) { R(6, 10, 4, 3, '#a0b0c8'); R(7, 9, 2, 1, '#ffffff'); } break;
    case 'wall': {
      R(0, 0, 24, 24, '#6a6a6a');
      for (let y = 7; y < 24; y += 5) for (let x = (y % 2) ? 0 : 5; x < 24; x += 10) R(x, y, 9, 4, '#828282');
      R(0, 3, 24, 4, '#a2a2a2'); for (let x = 1; x < 24; x += 6) R(x, 0, 4, 4, '#b8b8b8');
      R(0, 21, 24, 3, '#4a4a4a');
      if (!(mask & 8)) R(0, 0, 2, 24, '#555555'); if (!(mask & 2)) R(22, 0, 2, 24, '#555555');
      break;
    }
    case 'gate': R(0, 0, 24, 24, '#6a6a6a'); R(0, 3, 24, 4, '#a2a2a2'); R(4, 7, 16, 17, '#5a3a1a'); R(4, 7, 16, 2, '#3a2410'); R(11, 7, 2, 17, '#3a2410'); for (let y = 11; y < 24; y += 4) { R(5, y, 1, 1, '#ffd040'); R(18, y, 1, 1, '#ffd040'); } break;
    case 'town': for (let y = 0; y < 24; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < 24; x += 6) { R(x, y, 5, 5, l); R(x, y + 4, 5, 1, b); } break;
    case 'castle': for (let y = 0; y < 24; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < 24; x += 6) R(x, y, 5, 5, l); R(1, 18, 22, 6, '#9a8e76'); break;
  }
  cache.set(key, c);
  return c;
}
// things that stand off the ground and overlap the tile above: 24 wide, 36 tall (the bottom 24 rows sit on the tile)
export function objectSprite(kind, variant = 0, col = '#8a2a1a') {
  const key = `o|${kind}|${variant}|${col}`;
  if (cache.has(key)) return cache.get(key);
  const c = mk(24, 36), g = c.getContext('2d');
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  const roof = (x, y, w, colR) => { R(x - 2, y + 3, w + 4, 3, shade(colR, -0.3)); R(x, y, w, 4, colR); R(x + 1, y - 2, w - 2, 2, shade(colR, 0.15)); R(x - 3, y + 2, 2, 2, colR); R(x + w + 1, y + 2, 2, 2, colR); };
  const shadow = (x, y, w) => { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + w / 2, y, w / 2 + 2, 3, 0, 0, Math.PI * 2); g.fill(); };
  switch (kind) {
    case 'keep':
      shadow(2, 33, 20);
      R(3, 22, 18, 12, '#ece0c4'); R(3, 22, 18, 1, '#fff6e0'); R(10, 26, 4, 8, '#5a3a1a'); R(5, 25, 3, 3, '#3a2a1a'); R(16, 25, 3, 3, '#3a2a1a'); R(3, 33, 18, 1, '#8a7a5a');
      roof(3, 17, 18, '#a8301e'); R(6, 10, 12, 8, '#ece0c4'); R(10, 12, 4, 3, '#3a2a1a'); roof(6, 6, 12, '#a8301e'); R(11, 0, 2, 5, '#ffd040'); R(10, 1, 4, 1, '#ffe890');
      break;
    case 'gatehouse': R(1, 14, 22, 9, '#7a7a7a'); R(4, 16, 16, 7, '#e8dcc0'); R(9, 17, 6, 4, '#3a2a1a'); roof(3, 10, 18, '#7a2a1a'); R(20, 4, 1, 8, '#5a3a1a'); R(21, 4, 3, 3, col); break;
    case 'house': { const wallC = variant % 2 ? '#ece0c4' : '#e0d0b0', roofC = ['#6a4a32', '#7a2e22', '#4a5a6a', '#6a5a2a'][variant % 4]; shadow(3, 33, 18); R(4, 22, 16, 11, wallC); R(4, 22, 16, 1, '#fff8e8'); R(10, 26, 4, 7, '#5a3a1a'); R(6, 25, 3, 3, '#3a2a1a'); R(15, 25, 3, 3, '#3a2a1a'); roof(4, 17, 16, roofC); break; }
    case 'village': shadow(2, 33, 20); R(2, 24, 10, 9, '#ece0c4'); roof(2, 20, 10, '#8a3a2a'); R(6, 28, 2, 5, '#5a3a1a'); R(12, 26, 10, 7, '#e0d0b0'); roof(12, 22, 10, '#6a4a2a'); R(16, 29, 2, 4, '#5a3a1a'); R(20, 14, 1, 10, '#6a4a2a'); R(21, 14, 3, 2, '#e8e0c8'); break;
    case 'camp':
      shadow(2, 33, 20);
      for (const [x, w] of [[2, 10], [12, 10]]) { g.fillStyle = '#e8e0c8'; g.beginPath(); g.moveTo(x, 33); g.lineTo(x + w / 2, 21); g.lineTo(x + w, 33); g.fill(); g.fillStyle = '#c8bca0'; g.beginPath(); g.moveTo(x + w / 2, 21); g.lineTo(x + w, 33); g.lineTo(x + w / 2, 33); g.fill(); R(x + w / 2 - 1, 28, 2, 5, '#5a3a1a'); }
      R(11, 10, 1, 14, '#6a4a2a'); R(12, 10, 6, 4, col); R(12, 10, 6, 1, shade(col, 0.3));
      break;
    case 'fence': for (let x = 1; x < 24; x += 5) { R(x, 20, 2, 13, '#7a5428'); R(x, 18, 2, 2, '#c8a060'); R(x + 1, 21, 1, 11, '#5a3a18'); } R(0, 24, 24, 2, '#6a4420'); R(0, 29, 24, 2, '#6a4420'); break;
    case 'chest': shadow(5, 33, 14); R(5, 24, 14, 9, '#8a4a1e'); R(5, 24, 14, 1, '#b86a2e'); R(5, 21, 14, 4, '#a85a24'); R(6, 20, 12, 1, '#c87a3a'); R(5, 25, 14, 1, '#ffd040'); R(11, 24, 2, 4, '#ffd040'); R(11, 26, 2, 1, '#6a3a10'); R(5, 21, 1, 12, '#ffd040'); R(18, 21, 1, 12, '#ffd040'); R(8, 19, 1, 1, '#fff8c0'); break;
    case 'pit': g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(12, 28, 9, 5, 0, 0, Math.PI * 2); g.fill(); R(6, 26, 2, 4, '#c8a060'); R(11, 25, 2, 5, '#c8a060'); R(16, 26, 2, 4, '#c8a060'); break;
    case 'trap': g.fillStyle = 'rgba(40,20,10,.35)'; g.beginPath(); g.ellipse(12, 28, 8, 4, 0, 0, Math.PI * 2); g.fill(); R(8, 27, 8, 1, 'rgba(200,160,96,.6)'); break;
  }
  cache.set(key, c);
  return c;
}
export const chestSprite = () => objectSprite('chest');
