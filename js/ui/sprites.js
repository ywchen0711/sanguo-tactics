// Pixel art drawn in code, in a warm, earthy, chibi style: little big-headed soldiers of every class (three looks
// each, as they promote), round-faced portraits with shiny eyes, flat ground textures for the isometric field
// (laid as diamonds by field.js), and upright things that stand on it — trees, rocks, houses, walls, the keep.
const cache = new Map();
const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
export const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const hex = (c) => { if (c.startsWith('rgb')) return c.match(/\d+/g).map(Number); const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const shade = (c, k) => { const [r, g, b] = hex(c); const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
const OUT = [46, 30, 18];
// a 1-pixel dark brown outline around the drawing
function outline(g, w, h, col = OUT) {
  const d = g.getImageData(0, 0, w, h), a = d.data, out = new Uint8ClampedArray(a);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (a[i + 3]) continue;
    const n = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < h && a[(ny * w + nx) * 4 + 3] > 0; };
    if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) { out[i] = col[0]; out[i + 1] = col[1]; out[i + 2] = col[2]; out[i + 3] = 255; }
  }
  d.data.set(out); g.putImageData(d, 0, 0);
}
function grayscale(g, w, h) { const d = g.getImageData(0, 0, w, h), a = d.data; for (let i = 0; i < a.length; i += 4) { const v = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) * 0.7; a[i] = a[i + 1] = a[i + 2] = v; } g.putImageData(d, 0, 0); }

// ---------------------------------------------------------------- units: 26×30 chibi, facing right, feet at the bottom centre
export const UNIT_W = 26, UNIT_H = 30;
export function unitSprite(line, tier, col, frame = 0, gray = false) {
  const key = `u|${line}|${tier}|${col}|${frame}|${gray}`;
  if (cache.has(key)) return cache.get(key);
  const c = mk(UNIT_W, UNIT_H), g = c.getContext('2d');
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  const st = frame ? 1 : 0;
  const skin = '#f6cfa4', skinD = '#d8a478', hair = '#4a2e1c', eye = '#2a1a10';
  const steel = tier === 2 ? '#f2cf5a' : tier === 1 ? '#c4ccd6' : '#a49c90', steelD = tier === 2 ? '#b08a2a' : tier === 1 ? '#7e8896' : '#6e665c', steelL = tier === 2 ? '#fff0a8' : '#eef2f6';
  const cl = col, clD = shade(col, -0.35), clL = shade(col, 0.3), trim = tier === 2 ? '#ffd860' : tier === 1 ? '#f0e8d0' : shade(col, 0.55);
  // a big round head: face, hair or headgear, two dark eyes
  const head = (x, y, hat) => {
    R(x + 1, y + 1, 10, 9, skin); R(x, y + 3, 12, 6, skin); R(x + 2, y + 9, 8, 1, skinD); R(x + 9, y + 4, 2, 5, skinD);
    R(x + 6, y + 5, 2, 2, eye); R(x + 9, y + 5, 1, 2, eye); R(x + 6, y + 5, 1, 1, '#ffffff');
    R(x + 5, y + 8, 2, 1, '#e89a8a');
    const helm = () => { R(x, y, 12, 4, steel); R(x + 1, y - 1, 10, 1, steel); R(x + 1, y, 10, 1, steelL); R(x, y + 3, 3, 3, steelD); if (tier >= 1) R(x + 5, y - 3, 2, 2, tier === 2 ? '#e23a2a' : clL); if (tier === 2) R(x + 6, y - 5, 1, 2, '#ff6a50'); };
    if (hat === 'helm') helm();
    else if (hat === 'cap') { R(x, y, 12, 3, '#8a6a42'); R(x + 1, y - 1, 9, 1, '#8a6a42'); R(x + 1, y, 9, 1, '#a88a5a'); R(x, y + 3, 2, 3, hair); }
    else if (hat === 'scarf') { R(x, y - 1, 12, 4, '#f6f4ea'); R(x + 1, y - 2, 10, 1, '#f6f4ea'); R(x, y + 2, 12, 1, '#d8d4c8'); R(x - 1, y + 2, 2, 6, '#f6f4ea'); }
    else if (hat === 'knot') { R(x, y, 12, 3, hair); R(x, y + 3, 2, 3, hair); R(x + 4, y - 3, 4, 3, hair); R(x + 5, y - 4, 2, 1, '#ffd070'); }
    else if (hat === 'band') { R(x, y, 12, 2, hair); R(x, y + 2, 12, 1, tier === 2 ? '#ffd040' : '#d83a2a'); R(x - 2, y + 2, 2, 4, tier === 2 ? '#ffd040' : '#d83a2a'); }
    else if (hat === 'wrap') { R(x, y - 1, 12, 4, '#7a5a3e'); R(x + 1, y, 10, 1, '#9a7a5a'); R(x - 1, y + 2, 2, 5, '#7a5a3e'); }
    else if (hat === 'crown') { R(x, y, 12, 3, hair); R(x + 1, y - 2, 10, 2, '#ffd040'); R(x + 1, y - 4, 2, 2, '#ffd040'); R(x + 5, y - 5, 2, 3, '#ffe890'); R(x + 9, y - 4, 2, 2, '#ffd040'); R(x + 5, y - 2, 2, 1, '#e02a2a'); if (tier >= 1) R(x + 5, y - 8, 2, 3, '#ff4a3a'); }
    else { R(x, y, 12, 3, hair); R(x, y + 3, 2, 3, hair); }
  };
  // a small body below the head: tunic, arms, little legs
  const body = (x, y, o = {}) => {
    const bc = o.bare ? skin : cl;
    R(x, y, 8, 7, bc); R(x, y, 8, 1, o.bare ? '#ffe2c4' : clL); R(x + 6, y + 1, 2, 6, o.bare ? skinD : clD);
    if (o.robe) { R(x - 1, y + 4, 10, 5, cl); R(x - 1, y + 8, 10, 1, clD); R(x + 3, y, 2, 9, trim); }
    else { R(x + 1, y + 7, 2, 3 - st, '#4a3424'); R(x + 5, y + 7, 2, 2 + st, '#4a3424'); R(x + 1, y + 10 - st, 2, 1, '#2a1a10'); R(x + 5, y + 9 + st, 2, 1, '#2a1a10'); }
    if (o.armour && tier >= 1) { R(x, y + 1, 8, 3, steel); R(x, y + 1, 8, 1, steelL); }
    if (o.bare) { R(x, y + 5, 8, 2, cl); }
    R(x, y + 6, 8, 1, o.bare ? clD : trim);
  };
  const flag = (x, y) => { R(x, y, 1, 11, '#6a4a2a'); R(x + 1, y, 5, 4, cl); R(x + 1, y, 5, 1, clL); if (tier) R(x + 2, y + 1, 2, 2, trim); };
  // a chibi horse: round barrel, short legs, a big friendly head
  const horse = (x, y, coat, mane) => {
    const cd = shade(coat, -0.3);
    R(x + 2, y + 4, 14, 6, coat); R(x + 2, y + 4, 14, 1, shade(coat, 0.25)); R(x + 2, y + 9, 14, 1, cd);
    R(x + 13, y, 6, 6, coat); R(x + 17, y + 2, 3, 3, coat); R(x + 16, y + 2, 1, 1, eye); R(x + 19, y + 4, 1, 1, cd); R(x + 13, y - 1, 2, 2, coat);
    R(x + 12, y, 2, 6, mane); R(x, y + 4, 3, 2, mane); R(x - 1, y + 5, 2, 4, mane);
    const L = frame ? [[3, 0], [6, 1], [11, 1], [14, 0]] : [[3, 1], [6, 0], [11, 0], [14, 1]];
    for (const [lx, d] of L) { R(x + lx, y + 10, 2, 3 - d, cd); R(x + lx, y + 13 - d, 2, 1, '#2a1a10'); }
    R(x + 6, y + 3, 6, 3, cl); R(x + 6, y + 6, 6, 1, trim);
    if (tier >= 1) { R(x + 13, y, 6, 2, steel); R(x + 3, y + 7, 10, 1, trim); }
  };
  const rider = (x, y, hat) => { R(x + 1, y + 10, 7, 4, cl); R(x + 1, y + 10, 7, 1, clL); if (tier >= 1) R(x + 1, y + 11, 7, 1, steel); head(x - 1, y, hat); };
  const by = 13; // where bodies start under a standing figure's head
  switch (line) {
    case 'inf':
      flag(3, 2); head(7, 3 + st * 0, 'helm'); body(9, by + 1, { armour: true });
      R(19, 4, 1, 21, '#7a5428'); R(18, 2, 3, 3, steel); R(19, 1, 1, 1, steelL);
      R(5, 15, 4, 7, tier === 2 ? '#d8a840' : tier ? steel : '#9a6a3a'); R(5, 15, 4, 1, steelL); R(6, 17, 2, 2, trim);
      break;
    case 'arch':
      flag(3, 3); head(7, 3, tier ? 'helm' : 'cap'); body(9, by + 1, { armour: tier >= 1 });
      R(19, 10, 1, 2, '#7a4a20'); R(20, 12, 1, 8, '#8a5a28'); R(19, 20, 1, 2, '#7a4a20'); R(18, 11, 1, 10, '#ecece4');
      R(6, 15, 3, 6, '#8a6a3a'); R(6, 14, 1, 2, '#f4f4f4'); R(8, 14, 1, 2, '#f4f4f4');
      break;
    case 'cav': horse(2, 15, tier === 2 ? '#4a2e1e' : tier ? '#7a4e30' : '#a06a40', '#2e1e12'); flag(7, 0); rider(9, 3 + st, 'helm'); R(21, 0, 1, 16, '#7a5428'); R(20, -1, 3, 3, steel); break;
    case 'hbow': horse(2, 15, tier === 2 ? '#ece4d4' : '#b08050', '#4a3220'); flag(7, 0); rider(9, 3 + st, tier ? 'helm' : 'cap'); R(20, 6, 1, 2, '#7a4a20'); R(21, 8, 1, 6, '#8a5a28'); R(20, 14, 1, 2, '#7a4a20'); R(19, 7, 1, 8, '#ecece4'); break;
    case 'lord': {
      horse(2, 15, tier === 2 ? '#f6f2ea' : tier ? '#3a3230' : '#94583a', tier === 2 ? '#e8cc60' : '#1e1a18');
      const cape = tier === 2 ? '#ffd040' : '#c82e22'; R(6, 12 + st, 4, 7, cape); R(6, 18 + st, 4, 1, shade(cape, -0.3));
      rider(9, 3 + st, 'crown'); R(20, 4 + st, 1, 7, steelL); R(19, 10 + st, 3, 1, '#ffd040');
      R(2, 0, 1, 12, '#6a4a2a'); R(3, 0, 6, 5, cl); R(3, 0, 6, 1, clL); R(5, 1, 2, 3, '#ffd040');
      break;
    }
    case 'strat': head(7, 4, 'scarf'); body(9, by + 2, { robe: true }); R(18, 15, 4, 4, '#f8f6ee'); R(18, 15, 4, 1, '#ffffff'); R(19, 19, 1, 3, '#8a6a3a'); if (tier >= 1) R(8, 18, 10, 1, '#ffd070'); if (tier === 2) R(6, 17, 2, 8, '#c82e22'); break;
    case 'taoist': { head(7, 4, 'knot'); body(9, by + 2, { robe: true }); const orb = tier === 2 ? '#ffe070' : '#a8e4ff'; R(19, 5, 1, 20, '#8a6a3a'); R(18, 3, 3, 3, orb); R(19, 2, 1, 1, '#ffffff'); break; }
    case 'brawl': head(7, 4, 'band'); body(9, by + 2, { bare: true }); R(17, 16 - st, 4, 3, tier ? steel : skin); R(5, 17 + st, 4, 3, tier ? steel : skin); break;
    case 'bandit': head(7, 4, 'wrap'); body(9, by + 2, {}); R(19, 7, 1, 17, '#6a4a2a'); R(19, 6, 5, 5, steel); R(20, 7, 3, 3, steelL); break;
    case 'siege': {
      const wood = '#a06a3a', wd = '#6a4420';
      R(2, 17, 22, 6, wood); R(2, 17, 22, 1, '#c88a52'); R(2, 22, 22, 1, wd);
      for (const wx of [4, 17]) { R(wx, 21, 6, 6, wd); R(wx + 1, 22, 4, 4, '#d0aa6a'); R(wx + 2, 23, 2, 2, wd); }
      if (tier === 0) { R(3, 11, 20, 6, wd); R(4, 10, 18, 2, cl); R(22, 13, 4, 3, steel); }
      else { R(11, 6 - st, 3, 11, wd); R(7, 4 - st, 11, 3, wd); R(17, 1 - st, 5, 5, '#8a8a8a'); R(18, 2 - st, 2, 2, '#b4b4b4'); R(6, 15, 14, 2, cl); }
      R(1, 6, 1, 11, '#6a4a2a'); R(2, 6, 5, 4, cl);
      break;
    }
    case 'tower':
      R(5, 12, 16, 17, '#a49a88'); for (let yy = 13; yy < 29; yy += 4) for (let xx = (yy / 4) % 2 ? 5 : 8; xx < 21; xx += 6) R(xx, yy, 5, 3, '#bab0a0');
      R(5, 12, 2, 17, '#c8c0b0'); R(19, 12, 2, 17, '#7e766a');
      R(2, 7, 22, 6, tier === 2 ? '#a83a24' : '#7a4a30'); R(4, 4, 18, 4, tier === 2 ? '#c84a2e' : '#94603e'); R(11, 1, 4, 3, '#ffd040');
      R(10, 15, 6, 6, '#3a2a1c'); R(11, 16, 3, 2, skin); R(23, 0, 1, 9, '#6a4a2a'); R(24, 0, 2, 4, cl);
      break;
  }
  outline(g, UNIT_W, UNIT_H);
  if (gray) grayscale(g, UNIT_W, UNIT_H);
  cache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- portraits: 32×32, round faces and shiny eyes
const FEMALE = new Set('孫尚香 祝融 馬雲祿 貂蟬 甄姬 大喬 小喬 蔡文姬 黃月英 王異 鮑三娘 關銀屏 張星彩 王元姬 辛憲英 步練師 卞氏 吳國太 糜夫人 甘夫人 孫魯班 夏侯氏 樊氏 Erin'.split(' '));
const LOOKS = {
  關羽: { face: '#d0604a', beard: 'long', bc: '#1a1008', hat: 'green' }, 張飛: { face: '#a87a52', beard: 'bush', bc: '#101010' }, 劉備: { beard: 'goatee', hat: 'crown' },
  曹操: { beard: 'goatee', hat: 'crown' }, 孫權: { beard: 'short', bc: '#6a3a1a', eye: '#2a6a3a' }, 諸葛亮: { hat: 'scarf', beard: 'goatee' }, 呂布: { hat: 'pheasant' },
  趙雲: { beard: 'none', hat: 'silver' }, 馬超: { beard: 'none', hat: 'lion' }, 黃忠: { beard: 'long', bc: '#e8e8e8', hair: '#e8e8e8' }, 司馬懿: { beard: 'goatee', hat: 'scarf' },
  周瑜: { beard: 'none', hat: 'crown' }, 典韋: { beard: 'bush', face: '#b08060' }, 許褚: { beard: 'none', hair: '#101010', face: '#e0b080' }, 董卓: { beard: 'bush', face: '#e0a888' },
  孟獲: { face: '#9a6a46', beard: 'bush', hat: 'feather' }, 張角: { hat: 'yellow', beard: 'long' }, 于吉: { hat: 'yellow', beard: 'long', bc: '#f0f0f0', hair: '#f0f0f0' }, 左慈: { beard: 'long', bc: '#f0f0f0', hair: '#f0f0f0' },
  袁紹: { beard: 'goatee', hat: 'crown' }, 孫策: { beard: 'none', hat: 'crown' }, 孫堅: { beard: 'short', hat: 'red' }, 夏侯惇: { patch: true, beard: 'short' }, 姜維: { beard: 'none', hat: 'silver' },
};
export function portrait(o, colIn = '#8a2a2a') {
  const key = `p|${o.name}|${o.line}|${colIn}`;
  if (cache.has(key)) return cache.get(key);
  const c = mk(32, 32), g = c.getContext('2d'), r = rnd(hash(o.name)), L = LOOKS[o.name] || {};
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  const fem = FEMALE.has(o.name);
  const face = L.face || ['#f6cfa4', '#eebf92', '#e2b084', '#f8d8b4'][Math.floor(r() * 4)], fd = shade(face, -0.16);
  const hair = L.hair || (o.lv > 30 && r() < 0.3 ? '#a8a8a8' : ['#4a2e1c', '#3a2416', '#2a1a10', '#5a3a22'][Math.floor(r() * 4)]);
  const beard = fem ? 'none' : L.beard || ['none', 'short', 'goatee', 'long', 'bush', 'goatee', 'none'][Math.floor(r() * 7)], bc = L.bc || hair;
  // a soft sky behind, and a frame
  R(0, 0, 32, 32, shade(colIn, 0.55)); R(0, 20, 32, 12, shade(colIn, 0.35));
  // shoulders in the army's colour
  R(5, 25, 22, 7, colIn); R(5, 25, 22, 1, shade(colIn, 0.3)); R(14, 25, 4, 7, shade(colIn, 0.5));
  if (['inf', 'cav', 'lord', 'hbow', 'siege', 'arch'].includes(o.line)) { const m = o.lv >= 30 ? '#f2cf5a' : '#c4ccd6'; R(4, 24, 7, 4, m); R(21, 24, 7, 4, m); R(4, 24, 7, 1, '#ffffff'); R(21, 24, 7, 1, '#ffffff'); }
  // a round face
  R(9, 7, 14, 16, face); R(8, 9, 16, 12, face); R(10, 23, 12, 1, face); R(20, 9, 3, 13, fd); R(10, 23, 12, 1, fd);
  // hair
  R(8, 5, 16, 5, hair); R(7, 7, 3, 8, hair); R(22, 7, 3, 8, hair); R(10, 4, 12, 2, hair); R(11, 5, 5, 1, shade(hair, 0.3));
  if (fem) { R(6, 8, 4, 16, hair); R(22, 8, 4, 16, hair); R(12, 1, 8, 4, hair); R(15, 1, 2, 2, '#ffd040'); R(20, 3, 3, 2, '#f05a7a'); }
  // big shiny eyes, a small mouth, rosy cheeks
  const eye = L.eye || '#2a1a10';
  R(11, 13, 3, 4, eye); R(18, 13, 3, 4, eye); R(11, 13, 1, 1, '#ffffff'); R(18, 13, 1, 1, '#ffffff'); R(13, 16, 1, 1, '#6a4a3a'); R(20, 16, 1, 1, '#6a4a3a');
  R(10, 11, 4, 1, hair); R(18, 11, 4, 1, hair);
  if (L.patch) { R(17, 12, 5, 5, '#1a1a1a'); R(9, 11, 14, 1, '#1a1a1a'); }
  R(15, 20, 3, 1, fem ? '#d84a5a' : '#a8604a');
  R(9, 18, 2, 1, '#f0a0a0'); R(21, 18, 2, 1, '#f0a0a0');
  if (beard === 'short') { R(10, 20, 12, 3, bc); R(14, 20, 4, 1, face); }
  if (beard === 'goatee') { R(15, 21, 3, 4, bc); R(12, 19, 2, 1, bc); R(19, 19, 2, 1, bc); }
  if (beard === 'long') { R(11, 20, 10, 4, bc); R(12, 24, 8, 4, bc); R(14, 28, 4, 3, bc); R(14, 20, 4, 1, face); }
  if (beard === 'bush') { R(8, 17, 16, 7, bc); R(10, 24, 12, 3, bc); R(14, 20, 4, 1, '#8a2a2a'); }
  // headgear
  const hat = L.hat || ({ strat: 'scarf', taoist: 'yellowknot', brawl: 'band', bandit: 'wrap', lord: 'crown' })[o.line] || (fem ? null : (['inf', 'cav', 'hbow', 'siege', 'arch'].includes(o.line) ? 'helm' : null));
  const metal = o.lv >= 30 ? '#f2cf5a' : o.lv >= 15 ? '#c4ccd6' : '#a49c90';
  if (hat === 'helm') { R(7, 3, 18, 6, metal); R(6, 8, 20, 2, metal); R(8, 3, 16, 1, '#ffffff'); R(15, 0, 2, 4, '#d83a2a'); }
  if (hat === 'silver') { R(7, 3, 18, 6, '#e4eaf0'); R(6, 8, 20, 2, '#c8d0d8'); R(15, 0, 2, 4, '#ffffff'); }
  if (hat === 'lion') { R(7, 2, 18, 7, '#e4eaf0'); R(6, 8, 20, 2, '#c8d0d8'); R(11, 0, 10, 3, '#ffd040'); }
  if (hat === 'crown') { R(9, 2, 14, 5, '#2a2a2a'); R(8, 6, 16, 2, '#ffd040'); R(14, 0, 4, 3, '#ffd040'); R(15, 1, 2, 1, '#e03030'); }
  if (hat === 'scarf') { R(8, 2, 16, 6, '#f6f4ea'); R(8, 7, 16, 1, '#d8d4c8'); R(22, 6, 4, 9, '#f6f4ea'); }
  if (hat === 'green') { R(8, 2, 16, 6, '#3a8a46'); R(8, 7, 16, 1, '#2a6a34'); }
  if (hat === 'red') { R(8, 2, 16, 6, '#c83a2a'); R(8, 7, 16, 1, '#8a2418'); }
  if (hat === 'yellow' || hat === 'yellowknot') { R(12, 0, 8, 6, hat === 'yellow' ? '#e8c830' : hair); R(15, 0, 2, 2, '#ffd070'); }
  if (hat === 'band') { R(7, 9, 18, 2, '#d83a2a'); R(24, 10, 3, 5, '#d83a2a'); }
  if (hat === 'wrap') { R(7, 3, 18, 7, '#7a5a3e'); R(23, 8, 3, 6, '#7a5a3e'); }
  if (hat === 'pheasant') { R(7, 3, 18, 6, '#f2cf5a'); R(6, 8, 20, 2, '#f2cf5a'); R(5, 0, 2, 7, '#e85a3a'); R(25, 0, 2, 7, '#e85a3a'); }
  if (hat === 'feather') { R(8, 4, 16, 4, '#c8a040'); R(10, 0, 2, 5, '#3a8a3a'); R(15, 0, 2, 5, '#e8c840'); R(20, 0, 2, 5, '#c83a2a'); }
  // a chunky dark frame
  g.strokeStyle = '#2e1e12'; g.lineWidth = 2; g.strokeRect(1, 1, 30, 30);
  cache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- ground: 32×32 flat textures (field.js lays them as diamonds)
// mask: neighbours of the same kind (N 1, E 2, S 4, W 8 — grid directions) for roads; land: which sides of water are land
const GROUND = {
  plain: ['#8e9450', '#7e8644', '#a0a45e'], grass: ['#7c8c44', '#6a7a38', '#8e9c52'], forest: ['#647a38', '#566c2e', '#748a44'], hill: ['#8a8a4c', '#7a7a40', '#9c9a5a'], mount: ['#8e8270', '#7a6e5e', '#a09482'],
  river: ['#4282b0', '#36729e', '#5c9cc6'], moat: ['#3a6e98', '#2e5e86', '#4e86b0'], shoal: ['#6aa4c4', '#5a94b4', '#8ab8d4'], bridge: ['#4282b0', '#36729e', '#5c9cc6'],
  road: ['#7c8c44', '#6a7a38', '#8e9c52'], village: ['#8e9450', '#7e8644', '#a0a45e'], marsh: ['#5a7050', '#4a6044', '#6a8060'], desert: ['#d8bf84', '#c8ae74', '#e6d098'], snow: ['#e8eef2', '#d4dce4', '#ffffff'],
  wall: ['#a8987c', '#988a70', '#b8aa8e'], gate: ['#a8987c', '#988a70', '#b8aa8e'], town: ['#b4a484', '#a49474', '#c4b494'], castle: ['#b4a484', '#a49474', '#c4b494'], camp: ['#8e9450', '#7e8644', '#a0a45e'], fence: ['#8e9450', '#7e8644', '#a0a45e'],
};
export function groundTex(t, variant = 0, frame = 0, mask = 0, land = 0) {
  const key = `g|${t}|${variant}|${frame}|${mask}|${land}`;
  if (cache.has(key)) return cache.get(key);
  const c = mk(32, 32), g = c.getContext('2d'), r = rnd(hash(t) + variant * 977 + 1), [a, b, l] = GROUND[t] || GROUND.plain;
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  R(0, 0, 32, 32, a);
  for (let i = 0; i < 46; i++) R(Math.floor(r() * 32), Math.floor(r() * 32), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2), r() < 0.55 ? b : l);
  if (['plain', 'grass', 'forest', 'hill', 'village', 'camp', 'fence'].includes(t)) for (let i = 0; i < 4; i++) R(Math.floor(r() * 30), Math.floor(r() * 30), 2, 1, '#9a7a4a'); // bits of earth
  const water = ['river', 'moat', 'shoal', 'bridge'].includes(t);
  if (water) {
    for (let y = 2; y < 32; y += 6) for (let x = (y * 3 + frame * 5) % 12; x < 32; x += 12) R(x, y, 5, 1, shade(a, 0.4));
    if (t === 'shoal') for (let i = 0; i < 6; i++) R(Math.floor(r() * 30), Math.floor(r() * 30), 2, 2, '#b4a080');
    const bank = t === 'moat' ? '#9a8e7a' : '#cfb47a';
    if (land & 1) { R(0, 0, 32, 4, bank); R(0, 4, 32, 1, '#e8f4fa'); }
    if (land & 4) { R(0, 28, 32, 4, bank); R(0, 27, 32, 1, '#e8f4fa'); }
    if (land & 2) { R(28, 0, 4, 32, bank); R(27, 0, 1, 32, '#e8f4fa'); }
    if (land & 8) { R(0, 0, 4, 32, bank); R(4, 0, 1, 32, '#e8f4fa'); }
    if (t === 'bridge') { const across = (mask & 2) || (mask & 8); if (across) { R(0, 6, 32, 20, '#a87a48'); for (let x = 2; x < 32; x += 5) R(x, 6, 1, 20, '#7a5428'); R(0, 6, 32, 2, '#6a4420'); R(0, 24, 32, 2, '#6a4420'); } else { R(6, 0, 20, 32, '#a87a48'); for (let y = 2; y < 32; y += 5) R(6, y, 20, 1, '#7a5428'); R(6, 0, 2, 32, '#6a4420'); R(24, 0, 2, 32, '#6a4420'); } }
  }
  if (t === 'road') {
    // a dirt track that runs to the neighbouring road tiles
    const d = '#b49464', dd = '#9a7a4e', band = (x, y, w, h) => { R(x, y, w, h, d); };
    band(10, 10, 12, 12);
    if (mask & 1) band(10, 0, 12, 11); if (mask & 4) band(10, 21, 12, 11); if (mask & 2) band(21, 10, 11, 12); if (mask & 8) band(0, 10, 11, 12);
    if (!mask) band(0, 10, 32, 12);
    for (let i = 0; i < 10; i++) R(10 + Math.floor(r() * 12), 10 + Math.floor(r() * 12), 1, 1, dd);
  }
  if (t === 'town' || t === 'castle' || t === 'wall' || t === 'gate') for (let y = 0; y < 32; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 32; x += 8) { R(x, y, 7, 7, l); R(x, y + 6, 7, 1, b); }
  if (t === 'marsh') for (let i = 0; i < 4; i++) { const x = Math.floor(r() * 24), y = Math.floor(r() * 28); R(x, y, 8, 3, '#4a6a84'); R(x + 1, y, 6, 1, '#6a8aa4'); }
  if (t === 'desert') for (let y = 4; y < 32; y += 8) { R(0, y, 32, 1, '#c4a868'); R(4 + (y % 6), y + 1, 14, 1, '#f4e2b0'); }
  if (t === 'snow') for (let i = 0; i < 8; i++) R(Math.floor(r() * 30), Math.floor(r() * 30), 3, 1, '#c4d0e0');
  cache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- upright things: anchored at their bottom centre
// returns { c, ax, ay } — the canvas and where its foot is
export function objectSprite(kind, variant = 0, col = '#8a2a1a') {
  const key = `o|${kind}|${variant}|${col}`;
  if (cache.has(key)) return cache.get(key);
  const W = { keep: 44, gatehouse: 32, wall: 32, house: 22, hut: 20, tent: 20, tree: 14, pine: 12, snowpine: 12, rock: 12, tuft: 8, mound: 26, peak: 30, reeds: 10, cactus: 8, fence: 22, chest: 12, pit: 18, trap: 18, flower: 6, citytown: 30 }[kind] || 16;
  const H = { keep: 46, gatehouse: 36, wall: 30, house: 22, hut: 18, tent: 16, tree: 20, pine: 22, snowpine: 22, rock: 9, tuft: 7, mound: 13, peak: 30, reeds: 12, cactus: 13, fence: 12, chest: 11, pit: 10, trap: 10, flower: 5, citytown: 28 }[kind] || 16;
  const c = mk(W, H), g = c.getContext('2d'), r = rnd(hash(kind) + variant * 131 + 7);
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); };
  const roof = (x, y, w, h, rc) => { for (let i = 0; i < h; i++) R(x + i, y + h - 1 - i, w - i * 2, 1, i ? rc : shade(rc, -0.25)); R(x + 1, y + h - 2, w - 2, 1, shade(rc, 0.25)); };
  let doOutline = true;
  switch (kind) {
    case 'tree': { const k = ['#4e7a2e', '#5e8a36', '#46702a'][variant % 3]; R(6, 13, 2, 7, '#6a4a2a'); R(2, 3, 10, 10, k); R(1, 5, 12, 6, k); R(4, 1, 6, 3, k); R(3, 3, 4, 3, shade(k, 0.3)); R(8, 9, 4, 3, shade(k, -0.25)); break; }
    case 'pine': case 'snowpine': { const k = kind === 'snowpine' ? '#5a7a5a' : '#3e6a34'; R(5, 17, 2, 5, '#6a4a2a'); for (let i = 0; i < 4; i++) R(5 - i - 1, 3 + i * 4, 4 + i * 2, 4, k); R(5, 0, 2, 4, k); if (kind === 'snowpine') { R(4, 3, 4, 1, '#ffffff'); R(3, 7, 6, 1, '#ffffff'); R(2, 11, 8, 1, '#ffffff'); } else R(4, 4, 2, 2, shade(k, 0.3)); break; }
    case 'rock': R(1, 3, 10, 6, '#8e8676'); R(3, 1, 6, 3, '#a49c8c'); R(3, 1, 3, 2, '#c0b8a8'); R(7, 5, 4, 4, '#6e665a'); break;
    case 'tuft': R(1, 3, 1, 4, '#5e7a2e'); R(3, 0, 1, 7, '#6e8a36'); R(5, 2, 1, 5, '#5e7a2e'); R(6, 4, 1, 3, '#7e9a44'); doOutline = false; break;
    case 'flower': R(2, 2, 2, 2, ['#f4f0e0', '#f0d040', '#e8808a'][variant % 3]); R(3, 4, 1, 1, '#5e7a2e'); doOutline = false; break;
    case 'mound': R(2, 5, 22, 8, '#8a8a4a'); R(5, 2, 16, 4, '#9a9a56'); R(8, 0, 10, 3, '#aaa864'); R(14, 6, 9, 6, '#74743c'); R(6, 3, 4, 2, '#b8b672'); break;
    case 'peak': R(1, 20, 28, 10, '#7a6e5c'); R(5, 12, 20, 9, '#8e8270'); R(9, 5, 12, 8, '#a09482'); R(12, 1, 6, 5, '#b4a896'); R(12, 0, 6, 3, '#f4f6f8'); R(15, 6, 2, 22, '#685e4e'); R(20, 12, 4, 16, '#685e4e'); R(6, 16, 4, 3, '#b0a492'); break;
    case 'reeds': for (let x = 1; x < 10; x += 2) { R(x, 3 + (x % 3), 1, 9 - (x % 3), '#7a9a50'); R(x, 2 + (x % 3), 1, 2, '#8a6a3a'); } doOutline = false; break;
    case 'cactus': R(3, 2, 2, 11, '#5a8a3a'); R(1, 5, 2, 1, '#5a8a3a'); R(1, 3, 1, 3, '#5a8a3a'); R(5, 6, 2, 1, '#5a8a3a'); R(6, 4, 1, 3, '#5a8a3a'); R(3, 2, 1, 11, '#7aaa4a'); break;
    case 'house': { const wall = variant % 2 ? '#f0e2c4' : '#e6d4b0', rc = ['#8a5a3a', '#a8442e', '#5a6a7a', '#7a6a32'][variant % 4]; R(3, 11, 16, 11, wall); R(3, 11, 16, 1, '#fff6e0'); R(9, 15, 4, 7, '#6a4420'); R(4, 14, 3, 3, '#4a3a2a'); R(15, 14, 3, 3, '#4a3a2a'); roof(1, 3, 20, 9, rc); break; }
    case 'hut': R(3, 9, 14, 9, '#d8c49a'); R(8, 12, 4, 6, '#6a4420'); roof(1, 1, 18, 9, '#b0904a'); R(2, 6, 16, 1, '#8a6a32'); break;
    case 'tent': { g.fillStyle = '#ece4d0'; g.beginPath(); g.moveTo(1, 16); g.lineTo(10, 3); g.lineTo(19, 16); g.fill(); g.fillStyle = '#c8bca0'; g.beginPath(); g.moveTo(10, 3); g.lineTo(19, 16); g.lineTo(10, 16); g.fill(); R(9, 11, 2, 5, '#6a4420'); R(10, 0, 1, 4, '#6a4a2a'); R(11, 0, 5, 3, col); break; }
    case 'fence': for (let x = 1; x < 22; x += 5) { R(x, 2, 2, 10, '#8a6234'); R(x, 1, 2, 1, '#c89a60'); } R(0, 4, 22, 2, '#a07440'); R(0, 8, 22, 2, '#a07440'); break;
    case 'wall': case 'gatehouse': {
      // an isometric stone block: diamond top (16 high), lit left face, shaded right face
      const poly = (pts, f) => { g.fillStyle = f; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
      const T = kind === 'gatehouse' ? 6 : 0, D = H - 16 - T; // top offset and wall height
      poly([[0, 8 + T], [16, 16 + T], [16, 16 + T + D], [0, 8 + T + D]], '#a89a80');
      poly([[16, 16 + T], [32, 8 + T], [32, 8 + T + D], [16, 16 + T + D]], '#86795f');
      poly([[16, T], [32, 8 + T], [16, 16 + T], [0, 8 + T]], '#cfc3a9');
      // courses of stone on the faces, crenels along the top edge
      g.strokeStyle = 'rgba(60,44,28,.35)'; g.lineWidth = 1;
      for (let k = 5; k < D; k += 5) { g.beginPath(); g.moveTo(0, 8 + T + k); g.lineTo(16, 16 + T + k); g.lineTo(32, 8 + T + k); g.stroke(); }
      for (let x = 2; x < 30; x += 6) { const y = x < 16 ? 8 + T - x / 2 : T + (x - 16) / 2; g.fillStyle = '#e2d8c2'; g.fillRect(x, y + 1, 3, 2); }
      g.strokeStyle = '#3e2c1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(16, T); g.lineTo(32, 8 + T); g.lineTo(32, 8 + T + D); g.lineTo(16, 16 + T + D); g.lineTo(0, 8 + T + D); g.lineTo(0, 8 + T); g.closePath(); g.stroke();
      if (kind === 'gatehouse') { poly([[5, 14 + T], [11, 17 + T], [11, 17 + T + D - 3], [5, 14 + T + D - 3]], '#5a3a1e'); poly([[21, 17 + T], [27, 14 + T], [27, 14 + T + D - 3], [21, 17 + T + D - 3]], '#4a2e16'); roof(4, 0, 24, 8, '#9a3a24'); g.fillStyle = '#ffd040'; g.fillRect(15, 0, 2, 2); }
      break;
    }
    case 'keep': {
      R(6, 26, 32, 18, '#f0e2c4'); R(6, 26, 32, 1, '#fff6e0'); R(19, 32, 6, 12, '#6a4420'); R(9, 31, 4, 4, '#4a3a2a'); R(31, 31, 4, 4, '#4a3a2a'); R(6, 43, 32, 1, '#a8987c');
      roof(2, 17, 40, 10, '#b03a26');
      R(12, 11, 20, 8, '#f0e2c4'); R(19, 13, 6, 4, '#4a3a2a');
      roof(8, 2, 28, 10, '#b03a26'); R(21, 0, 2, 3, '#ffd040');
      break;
    }
    case 'citytown': {
      // a little walled town for the campaign map: walls, a hall, a flag in the owner's colour
      R(2, 14, 26, 12, '#bcae92'); R(2, 14, 26, 2, '#d8ccb2'); for (let x = 2; x < 28; x += 4) R(x, 12, 2, 2, '#d8ccb2');
      R(12, 19, 6, 7, '#5a3a1e');
      R(7, 8, 16, 7, '#f0e2c4'); roof(5, 2, 20, 7, '#a8442e');
      R(24, 0, 1, 12, '#6a4a2a'); R(25, 0, 5, 4, col); R(25, 0, 5, 1, shade(col, 0.35));
      break;
    }
    case 'chest': R(1, 4, 10, 7, '#9a5a24'); R(1, 1, 10, 4, '#b86e30'); R(1, 1, 10, 1, '#d88a44'); R(1, 5, 10, 1, '#ffd040'); R(5, 4, 2, 3, '#ffd040'); R(1, 1, 1, 10, '#ffd040'); R(10, 1, 1, 10, '#ffd040'); break;
    case 'pit': g.fillStyle = '#3a2618'; g.beginPath(); g.ellipse(9, 6, 8, 4, 0, 0, Math.PI * 2); g.fill(); R(4, 3, 1, 4, '#c8a060'); R(9, 2, 1, 5, '#c8a060'); R(13, 3, 1, 4, '#c8a060'); doOutline = false; break;
    case 'trap': g.fillStyle = 'rgba(58,38,24,.45)'; g.beginPath(); g.ellipse(9, 6, 7, 3, 0, 0, Math.PI * 2); g.fill(); R(5, 5, 8, 1, 'rgba(200,160,96,.7)'); doOutline = false; break;
  }
  if (doOutline && kind !== 'wall' && kind !== 'gatehouse') outline(g, W, H);
  void r;
  const out = { c, ax: W / 2, ay: H, w: W, h: H };
  cache.set(key, out);
  return out;
}
// the little things that stand on each kind of ground: [{ k, u, v }] with u, v offsets within the tile (-0.4…0.4)
export function decorFor(t, x, y) {
  const h = hash(`${x},${y}`), r = rnd(h), out = [];
  const add = (k, u, v, variant = Math.floor(r() * 4)) => out.push({ k, u, v, variant });
  switch (t) {
    case 'forest': { const n = 2 + (h % 2); const spots = [[-0.18, -0.2], [0.2, -0.05], [-0.05, 0.22], [0.22, 0.25]]; for (let i = 0; i < n; i++) add(r() < 0.35 ? 'pine' : 'tree', spots[i][0], spots[i][1]); break; }
    case 'hill': add('mound', 0, 0.05); if (r() < 0.5) add('rock', 0.25, 0.25); break;
    case 'mount': add('peak', 0, 0.1); break;
    case 'marsh': add('reeds', -0.15, 0); if (r() < 0.6) add('reeds', 0.2, 0.2); break;
    case 'desert': if (r() < 0.25) add('cactus', 0.1, 0.1); else if (r() < 0.2) add('rock', -0.1, 0.1); break;
    case 'snow': if (r() < 0.25) add('snowpine', 0, 0.1); break;
    case 'plain': case 'grass': if (r() < 0.45) add('tuft', r() - 0.5, r() - 0.5); if (r() < 0.25) add('tuft', r() - 0.5, r() - 0.5); if (r() < 0.12) add('rock', r() * 0.6 - 0.3, r() * 0.6 - 0.3); if (t === 'grass' && r() < 0.2) add('flower', r() - 0.5, r() - 0.5); break;
    case 'village': add('hut', -0.05, 0.05); break;
    case 'camp': add('tent', 0, 0.05); break;
    case 'fence': add('fence', 0, 0.1); break;
    case 'wall': add('wall', 0, 0); break;
    case 'gate': add('gatehouse', 0, 0); break;
    case 'castle': add('keep', 0, 0); break;
    case 'town': if (h % 4 === 0) add('house', 0, 0.05); break;
  }
  return out;
}
export const chestSprite = () => objectSprite('chest');
// kept for older callers: a top-down tile (the campaign map's legend and anything else that still wants one)
export const tileSprite = (t, variant, frame, mask, land) => groundTex(t, variant, frame, mask, land);
