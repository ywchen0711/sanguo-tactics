// Battlefields: a walled city to storm (or hold), in country that looks like where the city stands on the map.
// makeField({ theme, w, h, seed, siege, riverSide }) → { w, h, tiles: [{ t }], theme, keep: [x, y], gates, atkStart: [[x, y]], defStart: [[x, y]] }
import { TERRAIN } from '../data/rules.js';

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// smooth noise: a coarse random grid, blended
function noise(w, h, r, cell = 4) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = Array.from({ length: gw * gh }, () => r());
  const at = (x, y) => g[y * gw + x];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => { const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx, b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx; return a * (1 - ty) + b * ty; };
}
// what the country around a city is like
export const THEMES = {
  plains:   { name: ['中原', 'Central Plains'], base: 'plain', mix: [['grass', 0.35], ['forest', 0.12], ['hill', 0.08], ['village', 0.025]] },
  north:    { name: ['河北', 'Hebei'], base: 'plain', mix: [['grass', 0.3], ['hill', 0.12], ['forest', 0.08], ['village', 0.02]] },
  frontier: { name: ['邊塞', 'Frontier'], base: 'grass', mix: [['snow', 0.3], ['hill', 0.15], ['forest', 0.08], ['mount', 0.05]] },
  west:     { name: ['西涼', 'Liang'], base: 'desert', mix: [['plain', 0.3], ['hill', 0.15], ['mount', 0.08], ['grass', 0.08]] },
  shu:      { name: ['巴蜀', 'Ba-Shu'], base: 'plain', mix: [['hill', 0.28], ['mount', 0.14], ['forest', 0.22], ['village', 0.02]] },
  south:    { name: ['江南', 'Jiangnan'], base: 'grass', mix: [['forest', 0.3], ['marsh', 0.14], ['hill', 0.08], ['village', 0.025]] },
  river:    { name: ['長江', 'The Great River'], base: 'grass', mix: [['forest', 0.18], ['marsh', 0.12], ['plain', 0.25], ['village', 0.02]], river: true },
  jungle:   { name: ['南中', 'Nanzhong'], base: 'forest', mix: [['grass', 0.2], ['mount', 0.12], ['hill', 0.18], ['marsh', 0.12]] },
};
const ON_RIVER = new Set(['江陵', '江夏', '柴桑', '建業', '廬江', '江州', '永安', '濮陽', '平原', '襄陽', '樊城']);
export function themeFor(city) {
  const { name, x, y } = city;
  if (ON_RIVER.has(name)) return 'river';
  if (y > 84 && x < 40) return 'jungle';
  if (x < 36 && y > 50) return 'shu';
  if (x < 30 && y < 50) return 'west';
  if (y < 20) return 'frontier';
  if (y < 36) return 'north';
  if (y > 60) return 'south';
  return 'plains';
}

export function makeField({ theme = 'plains', w = 24, h = 18, seed = 1, siege = true, defense = {} } = {}) {
  const r = rng(seed), T = THEMES[theme] || THEMES.plains, tiles = Array.from({ length: w * h }, () => ({ t: T.base }));
  const at = (x, y) => tiles[y * w + x], inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  // scatter terrain in patches (each kind its own noise field, so forests and hills clump)
  for (const [kind, share] of T.mix) {
    const n = noise(w, h, r, kind === 'village' ? 2 : 3 + Math.floor(r() * 2));
    const vals = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) vals.push(n(x, y));
    const cut = [...vals].sort((a, b) => b - a)[Math.floor(vals.length * share)] ?? 1;
    if (kind === 'village') { for (let k = 0; k < Math.max(1, Math.round(w * h * share / 3)); k++) { const x = 2 + Math.floor(r() * (w - 4)), y = 1 + Math.floor(r() * (h - 2)); at(x, y).t = 'village'; } continue; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (n(x, y) >= cut) at(x, y).t = kind;
  }
  // mountains wear a skirt of hills
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y).t === 'mount') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (inside(nx, ny) && at(nx, ny).t !== 'mount' && r() < 0.6) at(nx, ny).t = 'hill'; }
  // the city: a walled square on the right, gates facing the attackers, the keep in the middle
  const cw = siege ? Math.min(11, Math.floor(w * 0.42)) : 0, chh = siege ? Math.min(11, h - 4) : 0;
  const cx0 = w - cw - 1, cy0 = Math.floor((h - chh) / 2) + Math.floor((r() - 0.5) * 2);
  const keep = siege ? [cx0 + Math.floor(cw / 2) + 1, cy0 + Math.floor(chh / 2)] : [w - 3, Math.floor(h / 2)];
  const gates = [];
  // a river between the armies (the Great River, or sometimes a stream elsewhere)
  if (T.river || r() < 0.25) {
    let x = Math.floor(w * (siege ? 0.35 : 0.45)) + Math.floor((r() - 0.5) * 4);
    const wide = T.river ? 2 : 1, crossings = new Set();
    const nb = T.river ? 2 : 2; for (let k = 0; k < nb; k++) crossings.add(Math.floor(h * (k + 0.5) / nb) + Math.floor((r() - 0.5) * 3));
    for (let y = 0; y < h; y++) {
      const px = x;
      if (y > 0 && r() < 0.35) x = Math.max(4, Math.min(w - cw - 4, x + (r() < 0.5 ? -1 : 1)));
      // when the river bends, fill the corner so the water stays joined edge to edge
      for (let xx = Math.min(x, px); xx < Math.max(x, px) + wide; xx++) { const t = at(xx, y); t.t = crossings.has(y) ? 'bridge' : 'river'; }
      if (!crossings.has(y) && r() < 0.12) at(x + Math.floor(r() * wide), y).t = 'shoal';
      // banks are low and wet
      for (const bx of [x - 1, x + wide]) if (inside(bx, y) && r() < 0.3 && !['bridge'].includes(at(bx, y).t)) at(bx, y).t = 'marsh';
    }
  }
  if (siege) {
    for (let y = cy0; y < cy0 + chh; y++) for (let x = cx0; x < cx0 + cw; x++) {
      const edge = x === cx0 || x === cx0 + cw - 1 || y === cy0 || y === cy0 + chh - 1;
      if (!inside(x, y)) continue;
      at(x, y).t = edge ? 'wall' : 'town';
    }
    const gy = cy0 + Math.floor(chh / 2), gx = cx0 + Math.floor(cw / 2);
    for (const [x, y] of [[cx0, gy], [gx, cy0], [gx, cy0 + chh - 1]]) if (inside(x, y)) { at(x, y).t = 'gate'; gates.push([x, y]); }
    at(keep[0], keep[1]).t = 'castle';
    // a few barracks and streets inside
    for (const [dx, dy] of [[-2, -2], [2, 2], [-2, 2], [2, -2]]) { const x = keep[0] + dx, y = keep[1] + dy; if (inside(x, y) && at(x, y).t === 'town' && r() < 0.5) at(x, y).t = 'camp'; }
    // the approach to the west gate is open ground
    for (let x = cx0 - 3; x < cx0; x++) for (let y = gy - 1; y <= gy + 1; y++) if (inside(x, y) && !['river', 'bridge', 'shoal'].includes(at(x, y).t)) at(x, y).t = y === gy ? 'road' : (at(x, y).t === 'mount' ? 'hill' : at(x, y).t);
  }
  // the city's defences: a moat around the walls (bridged at the gates), barricades before the gates, hidden pits, tower sites
  const traps = new Set(), towerSpots = [];
  if (siege) {
    const gy = cy0 + Math.floor(chh / 2), gx = cx0 + Math.floor(cw / 2);
    if (defense.moat) {
      for (let y = cy0 - 1; y <= cy0 + chh; y++) for (let x = cx0 - 1; x <= cx0 + cw; x++) {
        if (!inside(x, y)) continue;
        const ring = x === cx0 - 1 || x === cx0 + cw || y === cy0 - 1 || y === cy0 + chh; if (!ring) continue;
        const atGate = gates.some(([a, b]) => (a === cx0 && x === cx0 - 1 && y === b) || (b === cy0 && y === cy0 - 1 && x === a) || (b === cy0 + chh - 1 && y === cy0 + chh && x === a));
        at(x, y).t = atGate ? 'bridge' : 'moat';
      }
    }
    // barricades flank the road to each gate, two tiles out
    const fenceSpots = [[cx0 - 3, gy - 1], [cx0 - 3, gy + 1], [gx - 1, cy0 - 3], [gx + 1, cy0 - 3], [gx - 1, cy0 + chh + 2], [gx + 1, cy0 + chh + 2], [cx0 - 4, gy - 2], [cx0 - 4, gy + 2]];
    let nf = defense.fence || 0;
    for (const [x, y] of fenceSpots) { if (nf <= 0) break; if (inside(x, y) && !['river', 'bridge', 'moat', 'wall', 'gate'].includes(at(x, y).t)) { at(x, y).t = 'fence'; nf--; } }
    // pits on the likely approaches (in front of the gates)
    const cand = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = at(x, y).t; if (!['plain', 'grass', 'road', 'desert', 'snow', 'forest'].includes(t)) continue;
      const dg = gates.reduce((m, [a, b]) => Math.min(m, Math.abs(a - x) + Math.abs(b - y)), 99);
      if (dg >= 2 && dg <= 6 && x < cx0 + cw) cand.push([x, y, dg + r() * 3]);
    }
    cand.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of cand.slice(0, defense.trap || 0)) traps.add(`${x},${y}`);
    // towers: the corners first, then beside the gates
    const spots = [[cx0, cy0], [cx0, cy0 + chh - 1], [cx0 + cw - 1, cy0], [cx0 + cw - 1, cy0 + chh - 1], [cx0, gy - 2], [cx0, gy + 2], [gx - 2, cy0], [gx + 2, cy0 + chh - 1]];
    for (const p of spots.slice(0, defense.tower || 0)) if (inside(p[0], p[1]) && at(p[0], p[1]).t === 'wall') towerSpots.push(p);
  }
  // a road from the attackers' side toward the gate
  { let x = 0, y = Math.floor(h / 2); const ty = siege ? cy0 + Math.floor(chh / 2) : y;
    while (x < (siege ? cx0 : w)) { const t = at(x, y); if (['plain', 'grass', 'desert', 'snow', 'marsh', 'forest', 'hill'].includes(t.t) && r() < 0.85) t.t = 'road'; if (y !== ty && r() < 0.35) y += Math.sign(ty - y); else x++; } }
  // the attackers' camp on the left edge must be standable ground
  const atkStart = [], defStart = [];
  const ok = (x, y, who) => { const tt = at(x, y).t; return TERRAIN[tt].cost.foot > 0 && TERRAIN[tt].cost.horse > 0 && !atkStart.some(([a, b]) => a === x && b === y) && !defStart.some(([a, b]) => a === x && b === y); };
  for (let x = 0; x < 3; x++) for (let y = 0; y < h; y++) if (['mount', 'river', 'wall', 'fence', 'forest', 'marsh'].includes(at(x, y).t)) at(x, y).t = 'plain';
  const midY = Math.floor(h / 2);
  for (let ring = 0; atkStart.length < 14 && ring < h; ring++) for (const y of [midY - ring, midY + ring + 1]) for (let x = 0; x < 3 && atkStart.length < 14; x++) if (inside(x, y) && ok(x, y)) atkStart.push([x, y]);
  // defenders: the commander on the keep, then around it, then at the gates and on the walls' inner side
  defStart.push(keep);
  const near = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ok(x, y) && (siege ? at(x, y).t !== 'road' || x > cx0 : true) && x > w * 0.5) near.push([x, y]);
  const score = ([x, y]) => { const g = gates.reduce((m, [gx, gy]) => Math.min(m, Math.abs(gx - x) + Math.abs(gy - y)), 99), k = Math.abs(keep[0] - x) + Math.abs(keep[1] - y); return Math.min(g * 1.2, k) + r() * 2; };
  near.sort((a, b) => score(a) - score(b));
  for (const p of near) { if (defStart.length >= 16) break; if (!defStart.some(([a, b]) => a === p[0] && b === p[1])) defStart.push(p); }
  return { w, h, tiles, theme, keep, gates, atkStart, defStart, siege, traps, towerSpots, chests: [] };
}
export const tileAt = (m, x, y) => (x >= 0 && y >= 0 && x < m.w && y < m.h ? m.tiles[y * m.w + x] : null);
