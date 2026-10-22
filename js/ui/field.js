// The battlefield on screen: a top-down grid of 24-pixel tiles drawn at 2× (and zoomed), the units on it,
// highlighted ranges, and the little animations — walking, striking, strategies, numbers rising off the units.
import { unitSprite, tileSprite, hash } from './sprites.js';
import { AILMENTS } from '../data/rules.js';

export const BASE = 48;
const WET = new Set(['river', 'shoal', 'bridge', 'marsh']);
export class Field {
  constructor(cv) {
    this.cv = cv; this.g = cv.getContext('2d');
    this.zoom = 1; this.camX = 0; this.camY = 0; this.marks = new Map(); this.cursor = null; this.fx = []; this.time = 0;
    this.active = null; this.B = null; this.colors = { atk: '#3a6ad8', def: '#c83a2a' };
  }
  setBattle(B) {
    this.B = B; const m = B.map;
    this.nb = m.tiles.map((t, i) => { if (!WET.has(t.t) || t.t === 'bridge') return 0; const x = i % m.w, y = Math.floor(i / m.w); let f = 0; const land = (dx, dy) => { const n = m.tiles[(y + dy) * m.w + x + dx]; return n && !WET.has(n.t) && x + dx >= 0 && x + dx < m.w; }; if (y > 0 && land(0, -1)) f |= 1; if (land(1, 0)) f |= 2; if (y < m.h - 1 && land(0, 1)) f |= 4; if (land(-1, 0)) f |= 8; return f; });
    for (const u of B.units) { u.ax = u.x; u.ay = u.y; u.alpha = 1; u.flash = 0; }
    this.resize();
  }
  get ts() { return BASE * this.zoom; }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr); this.dpr = dpr;
    if (this.B) { const fit = Math.min(this.cv.width / (this.B.map.w * BASE), this.cv.height / (this.B.map.h * BASE)); this.minZoom = Math.min(1, fit * 0.98); if (!this.zoomSet) { this.zoom = Math.max(this.minZoom, Math.min(1.25 * dpr * 0.75, this.cv.width / (BASE * 15))); this.zoomSet = true; } this.clampCam(); }
  }
  clampCam() {
    const W = this.cv.width, H = this.cv.height, mw = this.B.map.w * this.ts, mh = this.B.map.h * this.ts;
    this.camX = mw <= W ? (mw - W) / 2 : Math.max(0, Math.min(mw - W, this.camX));
    this.camY = mh <= H ? (mh - H) / 2 : Math.max(0, Math.min(mh - H, this.camY));
  }
  centerOn(x, y, smooth = true) {
    const tx = (x + 0.5) * this.ts - this.cv.width / 2, ty = (y + 0.5) * this.ts - this.cv.height / 2;
    if (smooth) this.camGoal = [tx, ty]; else { this.camX = tx; this.camY = ty; this.clampCam(); }
  }
  // keep a tile on screen (with a margin)
  ensure(x, y) {
    const ts = this.ts, px = x * ts - this.camX, py = y * ts - this.camY, m = ts * 2;
    if (px < m || py < m || px > this.cv.width - m - ts || py > this.cv.height - m - ts) this.centerOn(x, y);
  }
  pan(dx, dy) { this.camGoal = null; this.camX -= dx * this.dpr; this.camY -= dy * this.dpr; this.clampCam(); }
  zoomBy(k, px, py) {
    const old = this.ts, z = Math.max(this.minZoom || 0.4, Math.min(2.2, this.zoom * k));
    const cx = (px ?? this.cv.width / 2) + this.camX, cy = (py ?? this.cv.height / 2) + this.camY;
    this.zoom = z; const s = this.ts / old; this.camX = cx * s - (px ?? this.cv.width / 2); this.camY = cy * s - (py ?? this.cv.height / 2); this.clampCam();
  }
  // screen pixel (CSS) → grid tile
  pick(cssX, cssY) {
    const x = Math.floor((cssX * this.dpr + this.camX) / this.ts), y = Math.floor((cssY * this.dpr + this.camY) / this.ts);
    return this.B && x >= 0 && y >= 0 && x < this.B.map.w && y < this.B.map.h ? [x, y] : null;
  }
  scr(x, y) { return [x * this.ts - this.camX, y * this.ts - this.camY]; }

  draw(dt) {
    const g = this.g, B = this.B; if (!B) return;
    this.time += dt;
    if (this.camGoal) { const k = Math.min(1, dt * 8); this.camX += (this.camGoal[0] - this.camX) * k; this.camY += (this.camGoal[1] - this.camY) * k; this.clampCam(); if (Math.abs(this.camGoal[0] - this.camX) < 1 && Math.abs(this.camGoal[1] - this.camY) < 1) this.camGoal = null; }
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1a1410'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    const ts = this.ts, m = B.map, x0 = Math.max(0, Math.floor(this.camX / ts)), y0 = Math.max(0, Math.floor(this.camY / ts));
    const x1 = Math.min(m.w - 1, Math.ceil((this.camX + this.cv.width) / ts)), y1 = Math.min(m.h - 1, Math.ceil((this.camY + this.cv.height) / ts));
    const frame = Math.floor(this.time * 1.6) % 2;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x, t = m.tiles[i].t, [sx, sy] = this.scr(x, y);
      g.drawImage(tileSprite(t, hash(`${x},${y}`) % 4, WET.has(t) ? frame : 0, this.nb[i]), Math.floor(sx), Math.floor(sy), Math.ceil(ts), Math.ceil(ts));
    }
    // faint grid
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; g.beginPath();
    for (let x = x0; x <= x1 + 1; x++) { const sx = Math.floor(x * ts - this.camX) + 0.5; g.moveTo(sx, y0 * ts - this.camY); g.lineTo(sx, (y1 + 1) * ts - this.camY); }
    for (let y = y0; y <= y1 + 1; y++) { const sy = Math.floor(y * ts - this.camY) + 0.5; g.moveTo(x0 * ts - this.camX, sy); g.lineTo((x1 + 1) * ts - this.camX, sy); }
    g.stroke();
    // highlighted tiles
    const pulse = 0.75 + Math.sin(this.time * 5) * 0.25;
    for (const [k, col] of this.marks) { const [x, y] = k.split(',').map(Number), [sx, sy] = this.scr(x, y); g.globalAlpha = pulse; g.fillStyle = col; g.fillRect(sx + 1, sy + 1, ts - 2, ts - 2); g.globalAlpha = 1; }
    // the cursor
    if (this.cursor) { const [sx, sy] = this.scr(this.cursor[0], this.cursor[1]), k = ts * 0.25, w = Math.max(2, ts / 16); g.strokeStyle = '#fff6c0'; g.lineWidth = w; g.beginPath(); for (const [cx, cy, dx, dy] of [[sx, sy, 1, 1], [sx + ts, sy, -1, 1], [sx, sy + ts, 1, -1], [sx + ts, sy + ts, -1, -1]]) { g.moveTo(cx + dx * k, cy + w / 2 * dy); g.lineTo(cx + w / 2 * dx, cy + w / 2 * dy); g.lineTo(cx + w / 2 * dx, cy + dy * k); } g.stroke(); }
    // units, back to front
    const us = B.units.filter((u) => !u.gone || u.alpha > 0).sort((a, b) => a.ay - b.ay);
    for (const u of us) this.drawUnit(u, dt);
    // effects and numbers
    this.fx = this.fx.filter((f) => (f.t += dt) < f.dur);
    for (const f of this.fx) this.drawFx(f);
  }
  drawUnit(u, dt) {
    const g = this.g, ts = this.ts, [sx, sy] = this.scr(u.ax, u.ay), B = this.B;
    if (u.gone) u.alpha = Math.max(0, u.alpha - dt * 1.5);
    g.globalAlpha = u.alpha;
    const col = this.colors[u.side], tired = u.side === B.side && u.done && !B.over;
    const frame = tired ? 0 : Math.floor(this.time * 2 + u.id * 0.37) % 2;
    // team disc under the feet
    g.fillStyle = u.side === 'atk' ? 'rgba(80,140,255,.35)' : 'rgba(255,90,70,.35)';
    g.beginPath(); g.ellipse(sx + ts / 2, sy + ts * 0.86, ts * 0.36, ts * 0.11, 0, 0, Math.PI * 2); g.fill();
    if (u === this.active) { g.strokeStyle = '#ffe680'; g.lineWidth = Math.max(1.5, ts / 24); g.stroke(); }
    const spr = unitSprite(u.s.line, u.s.tier, col, frame, tired);
    const lx = u.lunge ? u.lunge[0] * ts * 0.3 : 0, ly = u.lunge ? u.lunge[1] * ts * 0.3 : 0;
    g.save(); g.translate(Math.floor(sx + lx + (u.dir < 0 ? ts : 0)), Math.floor(sy + ly)); if (u.dir < 0) g.scale(-1, 1);
    g.drawImage(spr, 0, 0, ts, ts);
    if (u.flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = u.alpha * Math.min(1, u.flash * 3); g.drawImage(spr, 0, 0, ts, ts); g.globalCompositeOperation = 'source-over'; g.globalAlpha = u.alpha; u.flash -= dt; }
    g.restore();
    // troops bar and markers
    const bw = ts * 0.78, bx = sx + (ts - bw) / 2, by = sy + ts - Math.max(4, ts / 10), bh = Math.max(3, ts / 14), k = Math.max(0, u.hp) / u.s.hp;
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    g.fillStyle = k > 0.5 ? (u.side === 'atk' ? '#5ab0ff' : '#ff6a50') : k > 0.25 ? '#ffd040' : '#ff3030'; g.fillRect(bx, by, bw * k, bh);
    if (u.commander) { const fx = sx + ts * 0.06, fy = sy + ts * 0.04, fs = ts * 0.22; g.fillStyle = '#5a3a1a'; g.fillRect(fx, fy, Math.max(1, ts / 24), fs * 1.6); g.fillStyle = col; g.fillRect(fx + 2, fy, fs, fs * 0.8); g.fillStyle = '#ffd040'; g.fillRect(fx + 2, fy + fs * 0.8 - 2, fs, 2); }
    const sts = Object.keys(u.st); sts.forEach((k2, i) => { g.fillStyle = AILMENTS[k2] ? AILMENTS[k2][2] : '#fff'; g.beginPath(); g.arc(sx + ts * (0.88 - i * 0.14), sy + ts * 0.12, ts * 0.06, 0, Math.PI * 2); g.fill(); });
    const bufs = Object.entries(u.buf); if (bufs.length) { g.fillStyle = bufs.some(([, v]) => v[0] > 0) ? '#7aff8a' : '#ff8a7a'; g.font = `bold ${Math.round(ts * 0.22)}px sans-serif`; g.fillText(bufs.some(([, v]) => v[0] > 0) ? '▲' : '▼', sx + ts * 0.74, sy + ts * 0.62); }
    g.globalAlpha = 1;
  }
  drawFx(f) {
    const g = this.g, ts = this.ts, k = f.t / f.dur, [sx, sy] = this.scr(f.x, f.y), cx = sx + ts / 2, cy = sy + ts / 2;
    if (f.kind === 'text') {
      g.save(); g.font = `bold ${Math.round(ts * (f.big ? 0.42 : 0.34))}px "Noto Sans TC", sans-serif`; g.textAlign = 'center';
      const y = cy - ts * 0.2 - k * ts * 0.5; g.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
      g.lineWidth = Math.max(2, ts / 14); g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(f.text, cx, y); g.fillStyle = f.col || '#fff'; g.fillText(f.text, cx, y); g.restore();
      return;
    }
    g.save(); g.globalAlpha = Math.min(1, (1 - k) * 2);
    const r = (n) => (Math.sin(n * 91.7 + f.seed) * 0.5 + 0.5);
    if (f.kind === 'fire') for (let i = 0; i < 14; i++) { const a = r(i), h = ts * (0.25 + 0.5 * r(i + 3)) * Math.sin(k * Math.PI); g.fillStyle = i % 3 ? '#ff8a20' : '#ffe040'; g.beginPath(); g.ellipse(sx + ts * (0.1 + 0.8 * a), sy + ts * 0.9 - h * (0.5 + 0.5 * Math.abs(Math.sin(f.t * 12 + i))), ts * 0.08, h * 0.35, 0, 0, Math.PI * 2); g.fill(); }
    if (f.kind === 'water') { g.fillStyle = 'rgba(80,150,255,.75)'; const h = ts * Math.sin(k * Math.PI); g.fillRect(sx, sy + ts - h, ts, h); g.fillStyle = 'rgba(220,240,255,.8)'; for (let i = 0; i < 4; i++) g.fillRect(sx + ts * r(i), sy + ts - h + ts * 0.1 * i, ts * 0.3, 2); }
    if (f.kind === 'rock') for (let i = 0; i < 5; i++) { const fall = Math.min(1, k * 1.6 - i * 0.1); if (fall < 0) continue; g.fillStyle = i % 2 ? '#8a7a68' : '#6a5a48'; const s = ts * (0.18 + 0.12 * r(i)); g.fillRect(sx + ts * (0.1 + 0.7 * r(i + 9)), sy - ts + fall * ts * 1.6, s, s); }
    if (f.kind === 'wind') { g.strokeStyle = 'rgba(220,255,230,.9)'; g.lineWidth = Math.max(2, ts / 16); for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx, cy, ts * (0.15 + i * 0.13), f.t * 9 + i, f.t * 9 + i + 3.6); g.stroke(); } }
    if (f.kind === 'bolt') { g.strokeStyle = '#fff8a0'; g.lineWidth = Math.max(2, ts / 12); g.beginPath(); let x = cx, y = sy - ts * 2; g.moveTo(x, y); for (let i = 0; i < 6; i++) { x = cx + (r(i + Math.floor(f.t * 20)) - 0.5) * ts * 0.6; y += ts * 0.5; g.lineTo(x, y); } g.stroke(); g.fillStyle = 'rgba(255,255,200,.3)'; g.fillRect(sx, sy, ts, ts); }
    if (f.kind === 'heal' || f.kind === 'buff' || f.kind === 'cure') { g.fillStyle = f.kind === 'heal' ? '#8aff9a' : f.kind === 'cure' ? '#fff' : '#ffe070'; for (let i = 0; i < 8; i++) { const y = sy + ts * (1 - ((k * 1.4 + r(i)) % 1)); g.fillRect(sx + ts * r(i + 4), y, Math.max(2, ts / 16), Math.max(2, ts / 16) * 2); } }
    if (f.kind === 'hex' || f.kind === 'debuff') { g.strokeStyle = f.kind === 'hex' ? '#ff8ad8' : '#c08aff'; g.lineWidth = Math.max(2, ts / 16); g.beginPath(); for (let i = 0; i < 20; i++) { const a = i * 0.7 + f.t * 6, rr = ts * 0.4 * (1 - i / 22); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.stroke(); }
    if (f.kind === 'slash') { g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(2, ts / 12); g.beginPath(); g.moveTo(sx + ts * 0.15, sy + ts * (0.2 + k * 0.3)); g.lineTo(sx + ts * 0.85, sy + ts * (0.55 + k * 0.3)); g.stroke(); }
    if (f.kind === 'arrow') { const [fx0, fy0] = this.scr(f.from[0], f.from[1]), px = fx0 + (sx - fx0) * k + ts / 2, py = fy0 + (sy - fy0) * k + ts / 2 - Math.sin(k * Math.PI) * ts; g.strokeStyle = '#f0e0c0'; g.lineWidth = Math.max(2, ts / 16); g.beginPath(); g.moveTo(px - (sx - fx0) * 0.06, py - (sy - fy0) * 0.06); g.lineTo(px, py); g.stroke(); }
    if (f.kind === 'boulder') { const [fx0, fy0] = this.scr(f.from[0], f.from[1]), px = fx0 + (sx - fx0) * k + ts / 2, py = fy0 + (sy - fy0) * k + ts / 2 - Math.sin(k * Math.PI) * ts * 2; g.fillStyle = '#6a5a48'; g.beginPath(); g.arc(px, py, ts * 0.16, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  // effects
  text(x, y, text, col, big = false, dur = 1.1) { this.fx.push({ kind: 'text', x, y, text, col, big, t: 0, dur }); }
  effect(kind, x, y, dur = 0.7, extra = {}) { this.fx.push({ kind, x, y, t: 0, dur, seed: Math.random() * 100, ...extra }); }
}
