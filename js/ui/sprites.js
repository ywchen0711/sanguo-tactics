// Pixel art drawn in code: soldiers of every class (three looks each, as they promote), officers' portraits,
// and the battlefield's tiles. Everything is cached on small canvases and drawn scaled up with crisp pixels.
const cache = new Map();
const mk = (w, h) => { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); return c; };
export const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const shade = (c, k) => { const [r, g, b] = hex(c); const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };

// ---------------------------------------------------------------- units: 24×24, facing right
// line: inf cav arch hbow strat taoist brawl bandit siege lord · tier 0-2 · col: the faction's colour · frame 0/1
export function unitSprite(line, tier, col, frame = 0, gray = false) {
  const key = `u|${line}|${tier}|${col}|${frame}|${gray}`;
  if (cache.has(key)) return cache.get(key);
  const c = mk(24, 24), g = c.getContext('2d');
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  const bob = frame ? 1 : 0;
  const skin = '#f0c898', dark = '#2a1a10', steel = tier === 2 ? '#e8d070' : tier === 1 ? '#b8c0d0' : '#8a8a8a', trim = tier === 2 ? '#ffe070' : shade(col, 0.4);
  const cloth = col, clothD = shade(col, -0.35), clothL = shade(col, 0.3);
  // a horse under a rider
  const horse = (hx) => {
    const hc = tier === 2 && line === 'lord' ? '#f0f0e8' : tier === 2 ? '#3a2a20' : tier === 1 ? '#6a4a30' : '#8a5a34', hd = shade(hc.startsWith('#') ? hc : '#8a5a34', -0.35);
    R(hx + 3, 13, 14, 6, hc); R(hx + 15, 9, 4, 6, hc); R(hx + 17, 8, 4, 3, hc); R(hx + 20, 9, 1, 2, dark); R(hx + 18, 8, 1, 1, dark);
    R(hx + 15, 8, 2, 2, hd); R(hx + 1, 13, 3, 2, hd); R(hx + 1, 15, 2, 3, hd); // mane and tail
    const l = frame ? [[4, 19], [7, 18], [13, 19], [16, 18]] : [[4, 18], [7, 19], [13, 18], [16, 19]];
    for (const [x, y] of l) R(hx + x, y, 2, 24 - y - 1, hd);
    if (tier >= 1) { R(hx + 5, 12, 9, 2, clothD); R(hx + 5, 14, 9, 1, trim); } // barding
  };
  const rider = (x, y, weapon) => {
    R(x + 1, y + 5, 6, 6, cloth); R(x + 1, y + 5, 6, 1, clothL); R(x + 2, y + 9, 4, 1, trim);
    R(x + 2, y + 1, 4, 4, skin); R(x + 5, y + 2, 1, 1, dark);
    helmet(x + 2, y, tier);
    if (weapon === 'spear') { R(x + 8, y - 3, 1, 14, '#6a4a2a'); R(x + 7, y - 5, 3, 3, steel); }
    if (weapon === 'bow') { R(x + 8, y + 2, 1, 8, '#7a4a20'); R(x + 9, y + 1, 1, 1, '#7a4a20'); R(x + 9, y + 10, 1, 1, '#7a4a20'); R(x + 7, y + 2, 1, 8, '#ddd'); }
    if (weapon === 'sword') { R(x + 7, y + 4, 1, 1, '#6a4a2a'); R(x + 8, y - 1, 1, 6, steel); }
  };
  const helmet = (x, y, t) => {
    if (line === 'lord') { R(x - 1, y - 1, 6, 2, '#ffd040'); R(x + 1, y - 3, 2, 2, '#ffd040'); if (t >= 1) R(x + 2, y - 5, 1, 2, '#ff4040'); return; }
    R(x - 1, y - 1, 6, 2, steel); R(x, y - 2, 4, 1, steel);
    if (t >= 1) R(x + 1, y - 4, 2, 2, clothL);
    if (t === 2) R(x + 2, y - 6, 1, 2, '#ff5050');
  };
  const foot = (x, y) => { // legs and feet, stepping on frame 1
    R(x + 1, y + 9, 2, 4 - bob, '#3a2a20'); R(x + 4, y + 9, 2, 4 + bob - 1, '#3a2a20');
    R(x + 1, y + 13 - bob, 2, 1, dark); R(x + 4, y + 12 + bob, 2, 1, dark);
  };
  const body = (x, y, robe) => {
    if (robe) { R(x, y + 4, 7, 9, cloth); R(x, y + 4, 7, 1, clothL); R(x + 3, y + 5, 1, 8, trim); R(x, y + 12, 7, 1, clothD); }
    else { R(x, y + 4, 7, 6, cloth); R(x, y + 4, 7, 1, clothL); R(x, y + 9, 7, 1, trim); if (tier >= 1) { R(x - 1, y + 4, 2, 3, steel); R(x + 6, y + 4, 2, 3, steel); } }
    R(x + 1, y, 5, 4, skin); R(x + 4, y + 1, 1, 1, dark);
  };
  const y0 = 7 + bob;
  switch (line) {
    case 'inf': {
      foot(7, y0); body(7, y0, false); helmet(8, y0, tier);
      // spear and shield
      R(15, y0 - 4, 1, 15, '#6a4a2a'); R(14, y0 - 6, 3, 3, steel);
      R(5, y0 + 4, 3, 6, tier === 2 ? '#c8a040' : clothD); R(6, y0 + 6, 1, 2, trim);
      break;
    }
    case 'arch': {
      foot(8, y0); body(8, y0, false); R(8, y0 - 1, 6, 2, tier ? steel : '#7a5a3a');
      R(16, y0 + 1, 1, 10, '#7a4a20'); R(17, y0, 1, 1, '#7a4a20'); R(17, y0 + 11, 1, 1, '#7a4a20'); R(15, y0 + 1, 1, 10, '#e8e8e8');
      R(6, y0 + 4, 2, 6, '#8a6a3a'); R(6, y0 + 3, 1, 2, '#e0e0e0'); // quiver
      if (tier === 2) { R(14, y0 + 5, 4, 1, '#c0c0c0'); }
      break;
    }
    case 'cav': horse(1); rider(8, 3 + bob, 'spear'); break;
    case 'hbow': horse(1); rider(8, 3 + bob, 'bow'); break;
    case 'lord': horse(1); rider(8, 3 + bob, 'sword'); R(7, 8 + bob, 2, 6, tier === 2 ? '#ffd040' : '#c03030'); break; // cape
    case 'strat': {
      foot(8, y0); body(8, y0, true);
      R(8, y0 - 2, 6, 2, '#f0f0f0'); R(9, y0 - 3, 4, 1, '#f0f0f0'); // 綸巾 scarf hat
      R(15, y0 + 3, 3, 4, '#f8f8f0'); R(16, y0 + 7, 1, 2, '#8a6a3a'); // feather fan
      if (tier >= 1) R(8, y0 + 4, 7, 1, '#ffd070');
      break;
    }
    case 'taoist': {
      foot(8, y0); body(8, y0, true);
      R(10, y0 - 2, 3, 2, '#2a2a2a'); R(11, y0 - 3, 1, 1, '#ffd070'); // topknot and pin
      R(16, y0 - 3, 1, 16, '#8a6a3a'); R(15, y0 - 4, 3, 2, tier === 2 ? '#ffe070' : '#a0e0ff');
      if (tier >= 1) R(8, y0 + 7, 7, 1, '#e0e0ff');
      break;
    }
    case 'brawl': {
      foot(8, y0); R(8, y0 + 4, 7, 6, skin); R(8, y0 + 8, 7, 2, cloth); R(8, y0 + 4, 7, 1, shade('#f0c898', -0.15));
      R(9, y0, 5, 4, skin); R(12, y0 + 1, 1, 1, dark); R(8, y0, 7, 1, tier === 2 ? '#ffd040' : '#e03030'); // headband
      R(15, y0 + 5 - bob, 3, 3, tier ? steel : skin); R(5, y0 + 5 + bob, 3, 3, tier ? steel : skin);
      break;
    }
    case 'bandit': {
      foot(8, y0); body(8, y0, false); R(8, y0 - 1, 6, 2, '#5a3a2a'); R(13, y0, 2, 2, '#5a3a2a');
      R(16, y0 + 1, 1, 10, '#6a4a2a'); R(16, y0, 3, 4, steel); R(17, y0 + 1, 2, 2, shade(steel.startsWith('#') ? steel : '#8a8a8a', -0.3));
      break;
    }
    case 'siege': {
      const wood = '#8a5a30', wd = '#5a3818';
      R(3, 12, 18, 6, wood); R(3, 12, 18, 1, '#a87040');
      for (const x of [5, 16]) { R(x, 17, 4, 4, wd); R(x + 1, 18, 2, 2, '#c8a060'); }
      if (tier === 0) { R(5, 9, 15, 3, wd); R(19, 8, 3, 5, steel); R(7, 6, 11, 3, cloth); } // ram under a roof
      else { R(10, 4 - bob, 2, 9, wd); R(8, 3 - bob, 7, 2, wd); R(14, 1 - bob, 3, 3, '#8a8a8a'); R(6, 11, 12, 1, cloth); if (tier === 2) R(4, 10, 4, 2, '#ffd040'); }
      break;
    }
  }
  if (gray) { const d = g.getImageData(0, 0, 24, 24), a = d.data; for (let i = 0; i < a.length; i += 4) { const v = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) * 0.75; a[i] = a[i + 1] = a[i + 2] = v; } g.putImageData(d, 0, 0); }
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
export function portrait(o, colIn = '#8a2a2a', size = 32) {
  const key = `p|${o.name}|${o.line}|${colIn}`;
  if (cache.has(key)) return cache.get(key);
  const c = mk(32, 32), g = c.getContext('2d'), r = rnd(hash(o.name)), L = LOOKS[o.name] || {};
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  const fem = FEMALE.has(o.name);
  const face = L.face || ['#f0c898', '#e8b888', '#d8a878', '#f4d0a8'][Math.floor(r() * 4)], fd = shade(face.startsWith('#') ? face : '#f0c898', -0.2);
  const hair = L.hair || (o.lv > 30 && r() < 0.3 ? '#a0a0a0' : ['#1a1008', '#2a1a10', '#3a2416', '#101010'][Math.floor(r() * 4)]);
  const beard = fem ? 'none' : L.beard || ['none', 'short', 'goatee', 'long', 'bush', 'goatee'][Math.floor(r() * 6)], bc = L.bc || hair;
  // backdrop
  const bg = g.createLinearGradient(0, 0, 0, 32); bg.addColorStop(0, shade(colIn, -0.55)); bg.addColorStop(1, shade(colIn, -0.25)); g.fillStyle = bg; g.fillRect(0, 0, 32, 32);
  // shoulders and robe in the faction's colour
  R(4, 25, 24, 7, colIn); R(4, 25, 24, 1, shade(colIn, 0.3)); R(14, 25, 4, 7, shade(colIn, -0.3));
  if (['inf', 'cav', 'lord', 'hbow', 'siege'].includes(o.line)) { R(3, 25, 7, 4, '#b8c0d0'); R(22, 25, 7, 4, '#b8c0d0'); }
  // neck, face
  R(13, 21, 6, 5, fd); R(9, 8, 14, 15, face); R(8, 11, 1, 6, face); R(23, 11, 1, 6, face); R(9, 21, 14, 1, fd);
  // hair
  R(9, 6, 14, 4, hair); R(8, 8, 2, 6, hair); R(22, 8, 2, 6, hair);
  if (fem) { R(7, 8, 3, 16, hair); R(22, 8, 3, 16, hair); R(12, 3, 8, 4, hair); R(15, 2, 2, 2, '#ffd040'); }
  // eyes and brows
  const eye = L.eye || '#1a1a1a', ey = 13 + Math.floor(r() * 2);
  R(11, ey, 3, 2, '#fff'); R(18, ey, 3, 2, '#fff'); R(12, ey, 2, 2, eye); R(19, ey, 2, 2, eye);
  const brow = fem ? 1 : 2; R(10, ey - 2, 5, brow, hair); R(17, ey - 2, 5, brow, hair);
  if (L.patch) { R(17, ey - 1, 5, 4, '#1a1a1a'); R(9, ey - 2, 14, 1, '#1a1a1a'); }
  R(15, ey + 3, 2, 2, fd); // nose
  R(13, 19, 6, 1, fem ? '#c84a5a' : shade(face.startsWith('#') ? face : '#f0c898', -0.4)); // mouth
  // beard
  if (beard === 'short') { R(10, 18, 12, 4, bc); R(13, 19, 6, 1, face); }
  if (beard === 'goatee') { R(14, 20, 4, 4, bc); R(11, 17, 3, 1, bc); R(18, 17, 3, 1, bc); }
  if (beard === 'long') { R(11, 18, 10, 5, bc); R(12, 23, 8, 5, bc); R(14, 28, 4, 3, bc); R(13, 19, 6, 1, face); }
  if (beard === 'bush') { R(8, 15, 16, 9, bc); R(10, 24, 12, 3, bc); R(12, 19, 8, 1, '#7a2a2a'); for (let i = 0; i < 6; i++) R(8 + Math.floor(r() * 15), 15 + Math.floor(r() * 10), 1, 2, shade(bc.startsWith('#') ? bc : '#101010', 0.25)); }
  // headwear: by class, or their own
  const hat = L.hat || ({ strat: 'scarf', taoist: 'yellowknot', brawl: 'band', bandit: 'wrap', lord: 'crown' })[o.line] || (fem ? null : (['inf', 'cav', 'hbow', 'arch', 'siege'].includes(o.line) ? 'helm' : null));
  const metal = o.lv >= 30 ? '#e8d070' : o.lv >= 15 ? '#c8d0dc' : '#9a9aa0';
  if (hat === 'helm') { R(8, 4, 16, 5, metal); R(7, 8, 18, 2, metal); R(15, 1, 2, 3, '#c03030'); R(8, 4, 16, 1, shade('#ffffff', 0)); }
  if (hat === 'silver') { R(8, 4, 16, 5, '#e0e8f0'); R(7, 8, 18, 2, '#c0c8d0'); R(15, 0, 2, 4, '#ffffff'); }
  if (hat === 'lion') { R(8, 3, 16, 6, '#e0e8f0'); R(7, 8, 18, 2, '#c0c8d0'); R(12, 1, 8, 3, '#ffd040'); R(13, 5, 2, 2, '#c03030'); R(17, 5, 2, 2, '#c03030'); }
  if (hat === 'crown') { R(10, 3, 12, 4, '#2a2a2a'); R(9, 6, 14, 2, '#ffd040'); R(14, 1, 4, 3, '#ffd040'); R(15, 2, 2, 1, '#e03030'); }
  if (hat === 'scarf') { R(9, 3, 14, 5, '#f0f0f0'); R(9, 7, 14, 1, '#d0d0d0'); R(21, 6, 4, 8, '#f0f0f0'); }
  if (hat === 'green') { R(9, 3, 14, 5, '#2a7a3a'); R(9, 7, 14, 1, '#1a5a2a'); }
  if (hat === 'red') { R(9, 3, 14, 5, '#c03030'); R(9, 7, 14, 1, '#801818'); }
  if (hat === 'yellow' || hat === 'yellowknot') { R(12, 2, 8, 5, hat === 'yellow' ? '#e0c020' : hair); R(14, 1, 4, 2, hat === 'yellow' ? '#e0c020' : hair); R(15, 0, 2, 2, '#ffd070'); }
  if (hat === 'band') { R(8, 9, 16, 2, '#e03030'); R(23, 10, 3, 5, '#e03030'); }
  if (hat === 'wrap') { R(8, 4, 16, 6, '#6a4a3a'); R(22, 8, 3, 6, '#6a4a3a'); }
  if (hat === 'pheasant') { R(8, 4, 16, 5, '#e8d070'); R(7, 8, 18, 2, '#e8d070'); R(6, 0, 2, 6, '#e05030'); R(24, 0, 2, 6, '#e05030'); R(4, 0, 3, 2, '#e05030'); R(25, 0, 3, 2, '#e05030'); }
  if (hat === 'feather') { R(9, 5, 14, 3, '#c8a040'); R(10, 0, 2, 6, '#3a8a3a'); R(15, -1, 2, 7, '#e0c040'); R(20, 0, 2, 6, '#c03030'); }
  // frame
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(0.5, 0.5, 31, 31);
  cache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- tiles: 24×24, a few variants each
const TILE_COL = {
  plain: ['#a8b868', '#98a85a'], grass: ['#78a848', '#689838'], forest: ['#5a8a3a', '#3a6a2a'], hill: ['#b89a60', '#9a7a48'], mount: ['#8a8278', '#6a6258'],
  river: ['#3a78c0', '#2a68b0'], shoal: ['#6aa8d8', '#5a98c8'], bridge: ['#3a78c0', '#a87a48'], road: ['#c8b080', '#b8a070'], village: ['#a8b868', '#98a85a'],
  marsh: ['#5a7a4a', '#4a6a5a'], desert: ['#e0c888', '#d0b878'], snow: ['#eef2f8', '#d8e0ee'], wall: ['#8a8a8a', '#6a6a6a'], gate: ['#8a8a8a', '#5a3a20'],
  town: ['#b8b0a0', '#a8a090'], castle: ['#b8b0a0', '#a8a090'], camp: ['#a8b868', '#98a85a'], fence: ['#a8b868', '#98a85a'],
};
export function tileSprite(t, variant = 0, frame = 0, nb = 0) {
  const key = `t|${t}|${variant}|${frame}|${nb}`;
  if (cache.has(key)) return cache.get(key);
  const c = mk(24, 24), g = c.getContext('2d'), r = rnd(hash(t) + variant * 977 + 1), [a, b] = TILE_COL[t] || TILE_COL.plain;
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  R(0, 0, 24, 24, a);
  // ground speckle
  for (let i = 0; i < 18; i++) R(Math.floor(r() * 24), Math.floor(r() * 24), 1 + Math.floor(r() * 2), 1, b);
  const tree = (x, y, s = 1) => { R(x + 2, y + 6, 2, 3, '#5a3a1a'); R(x, y + 2, 6, 5, '#2a5a20'); R(x + 1, y, 4, 3, '#3a7a2a'); R(x + 1, y + 1, 2, 2, '#5a9a3a'); };
  switch (t) {
    case 'grass': for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 22), y = Math.floor(r() * 22); R(x, y, 1, 2, '#4a8a2a'); R(x + 1, y - 1, 1, 2, '#5a9a3a'); } break;
    case 'forest': for (const [x, y] of [[2, 3], [13, 1], [7, 12], [16, 13], [1, 15]].slice(0, 3 + (variant % 3))) tree(x, y); break;
    case 'hill': R(3, 9, 18, 10, '#a88a50'); R(5, 7, 14, 4, '#b89a60'); R(7, 6, 10, 2, '#c8aa70'); R(4, 17, 17, 2, '#8a6a38'); R(13, 9, 6, 8, '#9a7a48'); break;
    case 'mount': R(2, 14, 20, 8, '#6a6258'); R(5, 8, 14, 7, '#7a7268'); R(8, 4, 8, 5, '#8a8278'); R(10, 2, 4, 3, '#eef'); R(9, 5, 2, 10, '#5a524a'); R(15, 8, 3, 12, '#5a524a'); break;
    case 'river': case 'shoal': {
      const ph = frame * 6;
      for (let y = 2; y < 24; y += 6) for (let x = (y + ph) % 12; x < 24; x += 12) R(x, y, 4, 1, t === 'river' ? '#6aa8e0' : '#a8d8f0');
      if (t === 'shoal') for (let i = 0; i < 5; i++) R(Math.floor(r() * 22), Math.floor(r() * 22), 2, 2, '#a89878');
      break;
    }
    case 'bridge': R(0, 0, 24, 24, '#3a78c0'); R(2, 0, 20, 24, '#a87a48'); for (let y = 1; y < 24; y += 4) R(2, y, 20, 1, '#7a5428'); R(2, 0, 2, 24, '#6a4420'); R(20, 0, 2, 24, '#6a4420'); break;
    case 'road': R(6, 0, 12, 24, '#d8c090'); for (let i = 0; i < 6; i++) R(7 + Math.floor(r() * 10), Math.floor(r() * 24), 2, 1, '#b8a070'); break;
    case 'village': {
      R(3, 9, 9, 7, '#e8dcc0'); R(2, 6, 11, 4, '#8a3a2a'); R(6, 12, 2, 4, '#5a3a1a');
      R(13, 13, 8, 6, '#e8dcc0'); R(12, 10, 10, 4, '#6a4a2a'); R(16, 15, 2, 4, '#5a3a1a'); break;
    }
    case 'marsh': for (let i = 0; i < 4; i++) { const x = Math.floor(r() * 18), y = Math.floor(r() * 20); R(x, y, 6, 2, '#4a6a8a'); R(x + 1, y - 1, 1, 3, '#8aa860'); } break;
    case 'desert': for (let y = 4; y < 24; y += 7) { R(0, y, 24, 1, '#c8b070'); R(3, y + 1, 10, 1, '#f0d8a0'); } break;
    case 'snow': for (let i = 0; i < 8; i++) R(Math.floor(r() * 22), Math.floor(r() * 22), 2, 1, '#c0cce0'); break;
    case 'wall': R(0, 0, 24, 24, '#7a7a7a'); for (let y = 0; y < 24; y += 6) for (let x = (y / 6) % 2 ? 0 : 6; x < 24; x += 12) R(x, y, 11, 5, '#8e8e8e'); R(0, 0, 24, 2, '#a0a0a0'); for (let x = 0; x < 24; x += 6) R(x, 0, 3, 4, '#a8a8a8'); break;
    case 'gate': R(0, 0, 24, 24, '#7a7a7a'); R(4, 4, 16, 20, '#5a3a1a'); R(4, 4, 16, 2, '#3a2410'); R(11, 4, 2, 20, '#3a2410'); R(6, 12, 2, 2, '#ffd040'); R(16, 12, 2, 2, '#ffd040'); R(0, 0, 24, 3, '#a0a0a0'); break;
    case 'town': {
      for (let y = 0; y < 24; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < 24; x += 6) R(x, y, 5, 5, '#c4bcac');
      // a quarter of the town's tiles have a house on them
      if (variant === 3) { R(4, 9, 16, 11, '#e8dcc0'); R(2, 5, 20, 5, '#5a4a3a'); R(4, 3, 16, 3, '#6a5a4a'); R(10, 14, 4, 6, '#5a3a1a'); R(5, 12, 3, 3, '#3a2a1a'); R(16, 12, 3, 3, '#3a2a1a'); }
      break;
    }
    case 'castle': {
      R(2, 10, 20, 12, '#e8dcc0'); R(0, 6, 24, 5, '#8a2a20'); R(2, 4, 20, 3, '#a8382a'); R(5, 0, 14, 5, '#8a2a20'); R(10, 14, 4, 8, '#5a3a1a');
      R(4, 13, 3, 3, '#3a2a1a'); R(17, 13, 3, 3, '#3a2a1a'); R(11, 1, 2, 2, '#ffd040'); break;
    }
    case 'camp': R(3, 8, 8, 8, '#e8e0c8'); R(5, 5, 4, 4, '#e8e0c8'); R(6, 12, 2, 4, '#5a3a1a'); R(13, 10, 8, 7, '#d8d0b8'); R(15, 8, 4, 3, '#d8d0b8'); R(11, 2, 1, 8, '#6a4a2a'); R(12, 2, 4, 3, '#c03030'); break;
    case 'fence': for (let x = 2; x < 24; x += 5) { R(x, 6, 2, 12, '#7a5428'); R(x, 4, 2, 2, '#c8a060'); } R(0, 10, 24, 2, '#6a4420'); break;
  }
  // water meets land: a light edge
  if (nb && (t === 'river' || t === 'shoal')) { g.fillStyle = 'rgba(230,220,170,.85)'; if (nb & 1) g.fillRect(0, 0, 24, 2); if (nb & 2) g.fillRect(22, 0, 2, 24); if (nb & 4) g.fillRect(0, 22, 24, 2); if (nb & 8) g.fillRect(0, 0, 2, 24); }
  cache.set(key, c);
  return c;
}
