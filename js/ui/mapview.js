// The map of the realm: land and sea, the great rivers, the roads, and the forty-five cities in their owners' colours.
import { cityName } from './names.js';
import { objectSprite } from './sprites.js';

const COAST = [[96, 0], [97, 10], [92, 18], [88, 27], [93, 33], [90, 40], [89, 47], [94, 56], [97, 63], [96, 72], [94, 80], [86, 88], [70, 95], [55, 98], [42, 104], [100, 104], [100, 0]];
const RIVERS = [
  { name: ['黃河', 'Yellow River'], col: '#c8a860', pts: [[6, 30], [14, 28], [24, 24], [33, 15], [42, 10], [46, 16], [47, 30], [49, 37], [56, 37], [64, 34], [72, 30], [80, 29], [89, 28]] },
  { name: ['長江', 'Yangtze'], col: '#4a8ac8', pts: [[8, 64], [15, 73], [22, 76], [28, 73], [34, 70], [40, 73], [46, 75], [52, 72], [57, 70], [63, 73], [68, 70], [74, 66], [82, 65], [95, 62]] },
  { name: ['漢水', 'Han'], col: '#5a9ac8', pts: [[24, 52], [32, 56], [38, 58], [43, 63], [48, 67], [54, 69]] },
  { name: ['渭水', 'Wei'], col: '#b8a060', pts: [[40, 38], [36, 40], [30, 42], [22, 43]] },
  { name: ['淮水', 'Huai'], col: '#5a9ac8', pts: [[60, 52], [66, 56], [72, 60], [78, 62]] },
];
// ranges and wastes, for the look of the land
const MOUNTAINS = [[18, 50], [22, 48], [28, 49], [33, 50], [12, 58], [8, 66], [24, 60], [30, 62], [40, 50], [44, 49], [36, 30], [40, 24], [52, 12], [56, 22], [10, 40], [16, 36], [60, 86], [50, 92], [30, 84], [20, 90], [74, 82], [64, 80]];
const DESERT = [[6, 18], [12, 14], [18, 12], [4, 26], [26, 6], [34, 4]];

export class MapView {
  constructor(cv) { this.cv = cv; this.g = cv.getContext('2d'); this.sel = null; this.hover = null; this.time = 0; this.marks = new Map(); this.zoom = 1; this.panX = 0; this.panY = 0; }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr); this.dpr = dpr; this.bg = null;
  }
  // world (0-100) → canvas pixels
  frame() {
    // the free part of the screen (panels cover the rest): inset in CSS pixels
    const I = this.inset || {}, d = this.dpr, L = (I.l || 0) * d, Tp = (I.t || 0) * d, W = this.cv.width - L - (I.r || 0) * d, H = this.cv.height - Tp - (I.b || 0) * d;
    const pad = 10 * d, s0 = Math.min((W - pad * 2) / 100, (H - pad * 2) / 104), s = s0 * this.zoom;
    const ox = L + (W - 100 * s) / 2 + this.panX, oy = Tp + (H - 104 * s) / 2 + 2 * s + this.panY;
    return { s, X: (x) => ox + x * s, Y: (y) => oy + y * s, inv: (px, py) => [(px - ox) / s, (py - oy) / s] };
  }
  pan(dx, dy) { this.panX += dx * this.dpr; this.panY += dy * this.dpr; this.bg = null; }
  zoomBy(k) { this.zoom = Math.max(1, Math.min(3, this.zoom * k)); if (this.zoom === 1) { this.panX = 0; this.panY = 0; } this.bg = null; }
  // the land, drawn once per size
  background() {
    const { s, X, Y } = this.frame(), W = this.cv.width, H = this.cv.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rr = ((seed) => () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; })(20261022);
    g.fillStyle = '#2c2418'; g.fillRect(0, 0, W, H);
    // the sea: deep teal, pixel waves
    g.fillStyle = '#2f6e88'; g.fillRect(X(0), Y(-2), 100 * s, 106 * s);
    // the land: olive grass, speckled
    const land = new Path2D(); land.rect(X(0), Y(-2), 100 * s, 106 * s);
    const sea = new Path2D(); COAST.forEach(([x, y], i) => (i ? sea.lineTo(X(x), Y(y)) : sea.moveTo(X(x), Y(y)))); sea.closePath();
    g.save(); g.clip(land); g.fillStyle = '#7f8c46'; g.fill(land);
    const px = Math.max(2, Math.round(s * 0.45));
    for (let i = 0; i < 9000; i++) { const x = X(rr() * 100), y = Y(rr() * 106 - 2); g.fillStyle = ['#6e7c3a', '#8e9a52', '#74823e', '#9aa45c'][i % 4]; g.fillRect(Math.round(x / px) * px, Math.round(y / px) * px, px, px); }
    // dry steppe and desert in the north-west
    for (const [x, y] of DESERT) for (let i = 0; i < 160; i++) { const dx = (rr() - 0.5) * 14, dy = (rr() - 0.5) * 10; g.fillStyle = rr() < 0.5 ? '#cdb47a' : '#d8c088'; g.fillRect(Math.round(X(x + dx) / px) * px, Math.round(Y(y + dy) / px) * px, px * 2, px); }
    // the sea, drawn over the land along the coast, with a sandy rim
    g.fillStyle = '#2f6e88'; g.fill(sea);
    g.strokeStyle = '#d8c08a'; g.lineWidth = Math.max(3, s * 0.9); g.stroke(sea);
    g.strokeStyle = '#3e2a16'; g.lineWidth = Math.max(1.5, s * 0.25); g.stroke(sea);
    g.restore();
    g.save(); g.clip(sea);
    for (let i = 0; i < 260; i++) { const x = X(80 + rr() * 22), y = Y(rr() * 106 - 2); g.fillStyle = 'rgba(200,240,250,.45)'; g.fillRect(Math.round(x / px) * px, Math.round(y / px) * px, px * 3, px); }
    g.restore();
    // rivers: blue with a light middle
    for (const r of RIVERS) {
      const big = r.name[0] === '長江' || r.name[0] === '黃河';
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = '#2e5a7a'; g.lineWidth = Math.max(4, s * (big ? 1.5 : 1)); g.beginPath(); r.pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke();
      g.strokeStyle = r.name[0] === '黃河' ? '#c4a860' : '#4a92c8'; g.lineWidth = Math.max(2.5, s * (big ? 1.05 : 0.65)); g.stroke();
      g.strokeStyle = 'rgba(220,240,255,.35)'; g.lineWidth = Math.max(1, s * 0.25); g.stroke();
    }
    // mountains and forests, as little pixel sprites
    const put = (kind, x, y, k = 1, variant = 0) => { const o = objectSprite(kind, variant), sc = Math.max(1, s * 0.11 * k); g.drawImage(o.c, Math.round(X(x) - o.ax * sc), Math.round(Y(y) - o.ay * sc), Math.round(o.w * sc), Math.round(o.h * sc)); };
    const trees = [];
    for (let i = 0; i < 260; i++) { const x = 4 + rr() * 86, y = 2 + rr() * 98; if (DESERT.some(([dx, dy]) => Math.hypot(dx - x, dy - y) < 8) || MOUNTAINS.some(([mx, my]) => Math.hypot(mx - x, my - y) < 3)) continue; trees.push([x, y, rr()]); }
    const things = [...trees.map(([x, y, v]) => ({ y, f: () => put(v < 0.35 ? 'pine' : 'tree', x, y, 0.9, Math.floor(v * 3)) })), ...MOUNTAINS.flatMap(([x, y]) => [[-2.2, 0.6], [0, 0], [2.2, 0.8]].map(([dx, dy]) => ({ y: y + dy, f: () => put('peak', x + dx, y + dy, 1.1) })))];
    g.save(); g.clip(land); for (const t of things.sort((a1, b1) => a1.y - b1.y)) { const [lx, ly] = [t.y, 0]; void lx; void ly; t.f(); } g.restore();
    g.save(); g.fillStyle = '#2f6e88'; g.fill(sea); g.strokeStyle = '#d8c08a'; g.lineWidth = Math.max(3, s * 0.9); g.stroke(sea); g.strokeStyle = '#3e2a16'; g.lineWidth = Math.max(1.5, s * 0.25); g.stroke(sea); g.clip(sea);
    for (let i = 0; i < 260; i++) { const x = X(80 + rr() * 22), y = Y(rr() * 106 - 2); g.fillStyle = 'rgba(200,240,250,.45)'; g.fillRect(Math.round(x / px) * px, Math.round(y / px) * px, px * 3, px); }
    g.restore();
    // a chunky wooden frame
    g.strokeStyle = '#2e1a0c'; g.lineWidth = Math.max(4, s * 0.8); g.strokeRect(X(0), Y(-2), 100 * s, 106 * s);
    g.strokeStyle = '#b8834c'; g.lineWidth = Math.max(2, s * 0.3); g.strokeRect(X(0) + s * 0.5, Y(-2) + s * 0.5, 100 * s - s, 106 * s - s);
    this.bg = c; this.bgFor = `${W}x${H}|${JSON.stringify(this.inset || {})}`;
  }
  // each faction's lands, tinted in its colour: every bit of land belongs to its nearest city
  territory(G) {
    const sig = G.cities.map((c) => c.owner || '-').join(',');
    if (this.terr && this.terrSig === sig) return this.terr;
    if (!this.near) {
      const inSea = (x, y) => { let r = false; for (let i = 0, j = COAST.length - 1; i < COAST.length; j = i++) { const [xi, yi] = COAST[i], [xj, yj] = COAST[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r; } return r; };
      this.near = new Int16Array(100 * 104);
      for (let y = 0; y < 104; y++) for (let x = 0; x < 100; x++) {
        if (inSea(x + 0.5, y - 1.5)) { this.near[y * 100 + x] = -1; continue; }
        let best = -1, bd = 1e9; for (const c of G.cities) { const d = (c.x - x - 0.5) ** 2 + (c.y - y + 1.5) ** 2; if (d < bd) { bd = d; best = c.id; } }
        this.near[y * 100 + x] = bd > 220 ? -1 : best;
      }
    }
    const c = document.createElement('canvas'); c.width = 100; c.height = 104; const g = c.getContext('2d'), img = g.createImageData(100, 104);
    const own = (i) => { const n = this.near[i]; return n < 0 ? null : G.cities[n].owner; };
    for (let i = 0; i < 100 * 104; i++) {
      const o = own(i); if (!o) continue;
      const [r, gg, b] = G.factions[o].color.match(/\w\w/g).map((h) => parseInt(h, 16)), x = i % 100;
      const edge = (x > 0 && own(i - 1) !== o) || (x < 99 && own(i + 1) !== o) || (i >= 100 && own(i - 100) !== o) || (i < 100 * 103 && own(i + 100) !== o);
      img.data.set(edge ? [r * 0.6, gg * 0.6, b * 0.6, 190] : [r, gg, b, o === G.player ? 84 : 56], i * 4);
    }
    g.putImageData(img, 0, 0);
    this.terr = c; this.terrSig = sig; return c;
  }
  draw(G, dt = 0) {
    this.time += dt;
    const g = this.g, { s, X, Y } = this.frame();
    if (!this.bg || this.bgFor !== `${this.cv.width}x${this.cv.height}|${JSON.stringify(this.inset || {})}`) this.background();
    g.drawImage(this.bg, 0, 0);
    g.imageSmoothingEnabled = false; g.drawImage(this.territory(G), X(0), Y(-2), 100 * s, 104 * s);
    // roads: dirt tracks with a dark edge
    g.lineCap = 'round';
    for (const c of G.cities) for (const j of c.adj) if (j > c.id) {
      const d = G.cities[j], hot = this.marks.has(c.id) && this.marks.has(d.id);
      g.beginPath(); g.moveTo(X(c.x), Y(c.y)); g.lineTo(X(d.x), Y(d.y));
      g.setLineDash([]); g.strokeStyle = 'rgba(62,42,22,.55)'; g.lineWidth = Math.max(3, s * 0.55); g.stroke();
      g.setLineDash([s * 0.7, s * 0.35]); g.strokeStyle = hot ? '#ff7a4a' : '#c8a46a'; g.lineWidth = Math.max(1.5, s * 0.3); g.stroke();
    }
    g.setLineDash([]);
    // cities
    for (const c of G.cities) {
      const f = c.owner && G.factions[c.owner], col = f ? f.color : '#9a9488', x = X(c.x), y = Y(c.y), r = s * (0.9 + c.size * 0.35);
      const mark = this.marks.get(c.id);
      if (mark) { g.strokeStyle = mark; g.lineWidth = Math.max(2, s * 0.4); g.beginPath(); g.arc(x, y, r * 1.9 + Math.sin(this.time * 5) * s * 0.2, 0, Math.PI * 2); g.stroke(); }
      if (this.sel === c.id) { g.fillStyle = 'rgba(255,240,160,.35)'; g.beginPath(); g.arc(x, y, r * 2.2, 0, Math.PI * 2); g.fill(); }
      // a little walled town flying its owner's flag
      const o = objectSprite('citytown', 0, col), sc = Math.max(1, s * (0.1 + c.size * 0.025));
      g.imageSmoothingEnabled = false; g.drawImage(o.c, Math.round(x - o.w * sc / 2), Math.round(y - o.h * sc * 0.75), Math.round(o.w * sc), Math.round(o.h * sc));
      if (c.owner === G.player) { g.strokeStyle = '#ffe27a'; g.lineWidth = Math.max(2, s * 0.3); g.beginPath(); g.ellipse(x, y + o.h * sc * 0.22, o.w * sc * 0.62, o.h * sc * 0.2, 0, 0, Math.PI * 2); g.stroke(); }
      // its name, bold white with a dark outline
      const fs = Math.round(Math.max(10 * this.dpr, s * 1.3));
      g.font = `900 ${fs}px "Noto Sans TC", sans-serif`; g.textAlign = 'center'; g.lineJoin = 'round';
      g.lineWidth = Math.max(3, fs / 4); g.strokeStyle = '#2e1a0c'; g.strokeText(cityName(c.name), x, y + o.h * sc * 0.25 + fs);
      g.fillStyle = c.owner === G.player ? '#ffe27a' : '#ffffff'; g.fillText(cityName(c.name), x, y + o.h * sc * 0.25 + fs);
      g.textAlign = 'start';
    }
  }
  // the city under a point (CSS pixels)
  pick(G, cssX, cssY) {
    const { s, X, Y } = this.frame(), px = cssX * this.dpr, py = cssY * this.dpr;
    let best = null, bd = 1e9;
    for (const c of G.cities) { const d = Math.hypot(X(c.x) - px, Y(c.y) - py); if (d < bd) { bd = d; best = c; } }
    return best && bd < s * 3.2 ? best : null;
  }
}
