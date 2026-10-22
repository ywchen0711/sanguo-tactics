// The map of the realm: land and sea, the great rivers, the roads, and the forty-five cities in their owners' colours.
import { cityName } from './names.js';

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
    // parchment land
    const land = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7); land.addColorStop(0, '#e6d6ac'); land.addColorStop(1, '#c8b282');
    g.fillStyle = '#1e2c3a'; g.fillRect(0, 0, W, H);
    g.fillStyle = land; g.fillRect(X(0), Y(-2), 100 * s, 106 * s);
    // paper grain
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(90,60,30,${Math.random() * 0.06})`; g.fillRect(X(Math.random() * 100), Y(Math.random() * 104 - 2), s * 0.4, s * 0.4); }
    // the sea
    g.beginPath(); COAST.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath();
    const sea = g.createLinearGradient(X(85), 0, X(100), 0); sea.addColorStop(0, '#5a8aa8'); sea.addColorStop(1, '#3a6a8a'); g.fillStyle = sea; g.fill();
    g.strokeStyle = 'rgba(60,40,20,.55)'; g.lineWidth = Math.max(1.5, s * 0.35); g.stroke();
    // waves
    g.strokeStyle = 'rgba(220,240,255,.25)'; g.lineWidth = Math.max(1, s * 0.15);
    for (let i = 0; i < 40; i++) { const x = 90 + Math.random() * 10, y = Math.random() * 100; if (x < 92 && y < 60) continue; g.beginPath(); g.arc(X(x), Y(y), s * 0.8, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    // desert stipple
    g.fillStyle = 'rgba(200,160,80,.35)'; for (const [x, y] of DESERT) for (let i = 0; i < 60; i++) g.fillRect(X(x + (Math.random() - 0.5) * 10), Y(y + (Math.random() - 0.5) * 8), s * 0.3, s * 0.3);
    // mountains: little ink peaks
    for (const [x, y] of MOUNTAINS) for (let k = 0; k < 3; k++) {
      const mx = X(x + k * 2.2 - 2), my = Y(y + (k % 2) * 1.2), h = s * (2.2 + (k % 2)), w = s * 1.8;
      g.fillStyle = 'rgba(120,96,60,.55)'; g.beginPath(); g.moveTo(mx - w, my); g.lineTo(mx, my - h); g.lineTo(mx + w, my); g.closePath(); g.fill();
      g.fillStyle = 'rgba(80,60,36,.6)'; g.beginPath(); g.moveTo(mx, my - h); g.lineTo(mx + w, my); g.lineTo(mx + w * 0.2, my); g.closePath(); g.fill();
    }
    // rivers
    for (const r of RIVERS) {
      g.strokeStyle = r.col; g.lineWidth = Math.max(2, s * (r.name[0] === '長江' || r.name[0] === '黃河' ? 0.9 : 0.55)); g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); r.pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke();
    }
    // a compass and border
    g.strokeStyle = 'rgba(90,60,30,.6)'; g.lineWidth = Math.max(2, s * 0.4); g.strokeRect(X(0), Y(-2), 100 * s, 106 * s);
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
      img.data.set(edge ? [r * 0.55, gg * 0.55, b * 0.55, 170] : [r, gg, b, o === G.player ? 92 : 64], i * 4);
    }
    g.putImageData(img, 0, 0);
    this.terr = c; this.terrSig = sig; return c;
  }
  draw(G, dt = 0) {
    this.time += dt;
    const g = this.g, { s, X, Y } = this.frame();
    if (!this.bg || this.bgFor !== `${this.cv.width}x${this.cv.height}|${JSON.stringify(this.inset || {})}`) this.background();
    g.drawImage(this.bg, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(this.territory(G), X(0), Y(-2), 100 * s, 104 * s);
    // river names
    g.font = `${Math.round(s * 1.5)}px "Noto Serif TC", serif`; g.fillStyle = 'rgba(40,70,110,.55)';
    for (const r of RIVERS.slice(0, 2)) { const [x, y] = r.pts[Math.floor(r.pts.length / 2)]; g.fillText(r.name[0], X(x) + s, Y(y) + s * 2.2); }
    // roads
    g.setLineDash([s * 0.6, s * 0.5]); g.lineWidth = Math.max(1, s * 0.22);
    for (const c of G.cities) for (const j of c.adj) if (j > c.id) { const d = G.cities[j]; g.strokeStyle = this.marks.has(c.id) && this.marks.has(d.id) ? 'rgba(255,90,40,.9)' : 'rgba(110,80,40,.5)'; g.beginPath(); g.moveTo(X(c.x), Y(c.y)); g.lineTo(X(d.x), Y(d.y)); g.stroke(); }
    g.setLineDash([]);
    // cities
    for (const c of G.cities) {
      const f = c.owner && G.factions[c.owner], col = f ? f.color : '#9a9488', x = X(c.x), y = Y(c.y), r = s * (0.9 + c.size * 0.35);
      const mark = this.marks.get(c.id);
      if (mark) { g.strokeStyle = mark; g.lineWidth = Math.max(2, s * 0.4); g.beginPath(); g.arc(x, y, r * 1.9 + Math.sin(this.time * 5) * s * 0.2, 0, Math.PI * 2); g.stroke(); }
      if (this.sel === c.id) { g.fillStyle = 'rgba(255,240,160,.35)'; g.beginPath(); g.arc(x, y, r * 2.2, 0, Math.PI * 2); g.fill(); }
      // a walled fort: stone walls with corner towers, a hall roof, and a banner in the owner's colour
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - r + s * 0.25, y - r * 0.6 + s * 0.35, r * 2, r * 1.5);
      g.fillStyle = '#b8b0a0'; g.fillRect(x - r, y - r * 0.6, r * 2, r * 1.5);
      g.fillStyle = '#d8d0c0'; g.fillRect(x - r, y - r * 0.6, r * 2, r * 0.3);
      g.fillStyle = '#8a8070'; for (const [tx, ty] of [[-1, -0.6], [1, -0.6], [-1, 0.9], [1, 0.9]]) g.fillRect(x + tx * r - r * 0.28, y + ty * r - r * 0.28, r * 0.56, r * 0.56);
      g.fillStyle = col; g.fillRect(x - r * 0.62, y - r * 0.25, r * 1.24, r * 0.95);
      g.fillStyle = '#3a2418'; g.beginPath(); g.moveTo(x - r * 0.85, y - r * 0.25); g.lineTo(x, y - r * 1.05); g.lineTo(x + r * 0.85, y - r * 0.25); g.closePath(); g.fill();
      g.fillStyle = '#5a3a1a'; g.fillRect(x + r * 0.95, y - r * 1.9, Math.max(1, s * 0.18), r * 1.4);
      g.fillStyle = col; g.fillRect(x + r * 0.95 + Math.max(1, s * 0.18), y - r * 1.9, r * 0.8, r * 0.5);
      g.strokeStyle = c.owner === G.player ? '#ffd860' : 'rgba(30,20,10,.8)'; g.lineWidth = Math.max(1, s * (c.owner === G.player ? 0.35 : 0.2)); g.strokeRect(x - r, y - r * 0.6, r * 2, r * 1.5);
      // name
      const fs = Math.round(Math.max(10 * this.dpr, s * 1.45));
      g.font = `bold ${fs}px "Noto Serif TC", "Noto Sans TC", serif`; g.textAlign = 'center';
      g.lineWidth = Math.max(2, fs / 5); g.strokeStyle = 'rgba(245,232,200,.9)'; g.strokeText(cityName(c.name), x, y + r * 0.8 + fs);
      g.fillStyle = c.owner === G.player ? '#7a1a10' : '#2a1a10'; g.fillText(cityName(c.name), x, y + r * 0.8 + fs);
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
