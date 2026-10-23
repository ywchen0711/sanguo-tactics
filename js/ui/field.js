// The battlefield on screen, isometric: every grid tile is a diamond of ground, with trees, rocks, walls and houses
// standing up on it, and the little soldiers among them — all drawn back to front. Highlighted ranges, the cursor,
// and the small animations (walking, striking, strategies, numbers rising off the units) live here too.
import { unitSprite, groundTex, objectSprite, decorFor, hash, UNIT_W, UNIT_H } from './sprites.js';
import { AILMENTS } from '../data/rules.js';

export const BASE = 64;  // a tile's width on screen at zoom 1 (its height is half that)
const WET = new Set(['river', 'shoal', 'bridge', 'marsh', 'moat']);
const WATER = new Set(['river', 'shoal', 'bridge', 'moat']);
export class Field {
  constructor(cv) {
    this.cv = cv; this.g = cv.getContext('2d');
    this.zoom = 1; this.camX = 0; this.camY = 0; this.marks = new Map(); this.cursor = null; this.fx = []; this.time = 0;
    this.active = null; this.B = null; this.colors = { atk: '#3a6ad8', def: '#c83a2a' }; this.dpr = 1;
  }
  setBattle(B) {
    this.B = B; const m = B.map;
    const at = (x, y) => (x >= 0 && y >= 0 && x < m.w && y < m.h ? m.tiles[y * m.w + x].t : null);
    const same = { road: new Set(['road', 'bridge', 'gate']), bridge: new Set(['road', 'bridge', 'gate', 'plain', 'grass', 'desert', 'snow', 'town']) };
    this.mask = m.tiles.map((t, i) => { const S = same[t.t]; if (!S) return 0; const x = i % m.w, y = Math.floor(i / m.w); let f = 0; [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(([dx, dy, b]) => { const n = at(x + dx, y + dy); if (n && S.has(n)) f |= b; }); return f; });
    this.nb = m.tiles.map((t, i) => { if (!WATER.has(t.t) || t.t === 'bridge') return 0; const x = i % m.w, y = Math.floor(i / m.w); let f = 0; [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(([dx, dy, b]) => { const n = at(x + dx, y + dy); if (n && !WET.has(n)) f |= b; }); return f; });
    this.decor = m.tiles.map((t, i) => decorFor(t.t, i % m.w, Math.floor(i / m.w)));
    for (const u of B.units) { u.ax = u.x; u.ay = u.y; u.alpha = 1; u.flash = 0; }
    this.resize();
  }
  // tile geometry at the current zoom (canvas pixels)
  get tw() { return BASE * this.zoom * this.dpr; }
  get th() { return this.tw / 2; }
  // the size of the box a unit or an effect is drawn in
  get ts() { return this.tw * 0.8; }
  get ox() { return this.B.map.h * this.tw / 2 + this.tw; }
  get oy() { return this.tw * 1.4; }
  worldW() { return (this.B.map.w + this.B.map.h) * this.tw / 2 + this.tw * 2; }
  worldH() { return (this.B.map.w + this.B.map.h) * this.th / 2 + this.oy + this.tw * 0.6; }
  // a tile's (fractional) top vertex in world pixels, and its centre
  top(x, y) { return [this.ox + (x - y) * this.tw / 2, this.oy + (x + y) * this.th / 2]; }
  centre(x, y) { const [tx, ty] = this.top(x, y); return [tx, ty + this.th / 2]; }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    this.dpr = dpr; this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    if (this.B) {
      const span = (this.B.map.w + this.B.map.h) / 2;
      const fitW = this.cv.width / ((span + 2) * BASE * dpr), fitH = this.cv.height / ((span / 2 + 2.2) * BASE * dpr);
      this.minZoom = Math.min(1, Math.min(fitW, fitH) * 0.98);
      if (!this.zoomSet) { this.zoom = Math.max(this.minZoom, Math.min(1.3, r.width / (BASE * 13))); this.zoomSet = true; }
      this.clampCam();
    }
  }
  clampCam() {
    const W = this.cv.width, H = this.cv.height, mw = this.worldW(), mh = this.worldH();
    this.camX = mw <= W ? (mw - W) / 2 : Math.max(0, Math.min(mw - W, this.camX));
    this.camY = mh <= H ? (mh - H) / 2 : Math.max(0, Math.min(mh - H, this.camY));
  }
  centerOn(x, y, smooth = true) {
    const [cx, cy] = this.centre(x, y), tx = cx - this.cv.width / 2, ty = cy - this.cv.height / 2;
    if (smooth) this.camGoal = [tx, ty]; else { this.camX = tx; this.camY = ty; this.clampCam(); }
  }
  ensure(x, y) {
    const [cx, cy] = this.centre(x, y), px = cx - this.camX, py = cy - this.camY, m = this.tw * 1.5;
    if (px < m || py < m * 1.2 || px > this.cv.width - m || py > this.cv.height - m) this.centerOn(x, y);
  }
  pan(dx, dy) { this.camGoal = null; this.camX -= dx * this.dpr; this.camY -= dy * this.dpr; this.clampCam(); }
  zoomBy(k, px, py) {
    const z = Math.max(this.minZoom || 0.3, Math.min(2.2, this.zoom * k)), s = z / this.zoom;
    const cx = px ?? this.cv.width / 2, cy = py ?? this.cv.height / 2;
    const wx = cx + this.camX, wy = cy + this.camY, ox0 = this.ox, oy0 = this.oy;
    this.zoom = z;
    this.camX = this.ox + (wx - ox0) * s - cx; this.camY = this.oy + (wy - oy0) * s - cy; this.clampCam();
  }
  // screen point (CSS pixels) → grid tile
  pick(cssX, cssY) {
    if (!this.B) return null;
    const wx = cssX * this.dpr + this.camX - this.ox, wy = cssY * this.dpr + this.camY - this.oy;
    const a = wx / (this.tw / 2), b = wy / (this.th / 2), x = Math.floor((a + b) / 2), y = Math.floor((b - a) / 2);
    return x >= 0 && y >= 0 && x < this.B.map.w && y < this.B.map.h ? [x, y] : null;
  }
  // a tile's centre in CSS pixels (for tests, and anything laid over the canvas)
  toCss(x, y) { const [cx, cy] = this.centre(x, y); return [(cx - this.camX) / this.dpr, (cy - this.camY) / this.dpr]; }
  // the top-left of the box a unit or an effect at (x, y) is drawn in, on screen
  scr(x, y) { const [cx, cy] = this.centre(x, y), ts = this.ts; return [cx - this.camX - ts / 2, cy - this.camY + this.th * 0.28 - ts]; }
  diamond(x, y, inset = 0) {
    const g = this.g, [tx, ty] = this.top(x, y), X = tx - this.camX, cy = ty - this.camY + this.th / 2, hw = this.tw / 2 * (1 - inset), hh = this.th / 2 * (1 - inset);
    g.beginPath(); g.moveTo(X, cy - hh); g.lineTo(X + hw, cy); g.lineTo(X, cy + hh); g.lineTo(X - hw, cy); g.closePath();
  }

  draw(dt) {
    const g = this.g, B = this.B; if (!B) return;
    this.time += dt;
    if (this.camGoal) { const k = Math.min(1, dt * 8); this.camX += (this.camGoal[0] - this.camX) * k; this.camY += (this.camGoal[1] - this.camY) * k; this.clampCam(); if (Math.abs(this.camGoal[0] - this.camX) < 1 && Math.abs(this.camGoal[1] - this.camY) < 1) this.camGoal = null; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = '#2c2418'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    const m = B.map, tw = this.tw, th = this.th, W = this.cv.width, H = this.cv.height;
    const visible = (x, y) => { const [cx, cy] = this.centre(x, y), sx = cx - this.camX, sy = cy - this.camY; return sx > -tw && sx < W + tw && sy > -tw * 1.5 && sy < H + tw; };
    const frame = Math.floor(this.time * 1.6) % 2;
    // the ground: each tile's texture mapped onto its diamond
    const k = (tw / 2 + 0.75) / 32, kh = (th / 2 + 0.5) / 32;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!visible(x, y)) continue;
      const i = y * m.w + x, t = m.tiles[i].t, [tx, ty] = this.top(x, y);
      g.setTransform(k, kh, -k, kh, tx - this.camX, ty - this.camY);
      g.drawImage(groundTex(t, hash(`${x},${y}`) % 4, WATER.has(t) ? frame : 0, this.mask[i], this.nb[i]), 0, 0);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // a faint grid, so the tiles can be counted
    g.strokeStyle = 'rgba(40,28,14,.16)'; g.lineWidth = 1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (visible(x, y)) { this.diamond(x, y); g.stroke(); }
    // highlighted tiles
    const pulse = 0.72 + Math.sin(this.time * 5) * 0.2;
    for (const [key, col] of this.marks) { const [x, y] = key.split(',').map(Number); g.globalAlpha = pulse; g.fillStyle = col; this.diamond(x, y, 0.06); g.fill(); g.globalAlpha = 1; }
    // the cursor
    if (this.cursor) { g.strokeStyle = '#fff4b0'; g.lineWidth = Math.max(2, tw / 22); this.diamond(this.cursor[0], this.cursor[1], 0.02); g.stroke(); g.strokeStyle = 'rgba(60,40,10,.6)'; g.lineWidth = 1; this.diamond(this.cursor[0], this.cursor[1], 0.14); g.stroke(); }
    // everything that stands up, back to front
    const list = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const d = this.decor[y * m.w + x]; if (!d.length || !visible(x, y)) continue; for (const o of d) list.push({ z: x + y + (o.u + o.v) * 0.5, draw: () => this.drawObj(o.k, x + o.u, y + o.v, o.variant) }); }
    const me = B.sides.atk.player ? 'atk' : B.sides.def.player ? 'def' : null;
    for (const c of m.chests || []) if (!c.taken && !c.hidden) list.push({ z: c.x + c.y + 0.2, draw: () => this.drawObj('chest', c.x, c.y, 0, Math.sin(this.time * 3 + c.x) * 0.04) });
    for (const key of m.sprung || []) { const [x, y] = key.split(',').map(Number); list.push({ z: x + y - 0.3, draw: () => this.drawObj('pit', x, y, 0) }); }
    if (me === 'def') for (const key of m.traps || []) { const [x, y] = key.split(',').map(Number); list.push({ z: x + y - 0.3, draw: () => this.drawObj('trap', x, y, 0) }); }
    for (const u of B.units) if (!u.gone || u.alpha > 0) list.push({ z: (u.ax ?? u.x) + (u.ay ?? u.y) + 0.6, draw: () => this.drawUnit(u, dt) });
    list.sort((a, b) => a.z - b.z);
    for (const d of list) d.draw();
    // effects and numbers on top
    this.fx = this.fx.filter((f) => (f.t += dt) < f.dur);
    for (const f of this.fx) this.drawFx(f);
  }
  drawObj(kind, x, y, variant, bob = 0) {
    const o = objectSprite(kind, variant, this.colors.def), s = this.tw / 32, [cx, cy] = this.centre(x, y);
    // walls and gatehouses sit exactly on their diamond; everything else stands near the tile's centre
    if (kind === 'wall' || kind === 'gatehouse') { const [tx, ty] = this.top(x, y); this.g.drawImage(o.c, Math.floor(tx - this.camX - 16 * s), Math.floor(ty - this.camY - (o.h - 16) * s), Math.ceil(o.w * s), Math.ceil(o.h * s)); return; }
    const foot = kind === 'pit' || kind === 'trap' ? o.h * s / 2 : this.th * 0.3;
    this.g.drawImage(o.c, Math.floor(cx - this.camX - o.ax * s), Math.floor(cy - this.camY + foot - o.ay * s + bob * this.tw), Math.ceil(o.w * s), Math.ceil(o.h * s));
  }
  // the player's units are blue-ringed, the enemy's red, whichever side is attacking
  mine(u) { const B = this.B; return B.sides[u.side].player || (!B.sides.atk.player && !B.sides.def.player && u.side === 'atk'); }
  drawUnit(u, dt) {
    if (u.ax == null) { u.ax = u.x; u.ay = u.y; u.alpha = 1; u.flash = 0; }
    const g = this.g, B = this.B, s = this.tw / 32 * 0.95, [cx0, cy0] = this.centre(u.ax, u.ay), cx = cx0 - this.camX, cy = cy0 - this.camY;
    if (u.gone) u.alpha = Math.max(0, u.alpha - dt * 1.5);
    g.globalAlpha = u.alpha;
    const col = u.color || this.colors[u.side], tired = u.side === B.side && u.done && !B.over;
    const frame = tired ? 0 : Math.floor(this.time * 2 + u.id * 0.37) % 2;
    // a shadow, and a ring in our blue or their red
    if (!u.structure) {
      g.fillStyle = 'rgba(30,20,10,.32)'; g.beginPath(); g.ellipse(cx, cy + this.th * 0.12, this.tw * 0.26, this.th * 0.24, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = this.mine(u) ? 'rgba(90,160,255,.95)' : 'rgba(255,96,70,.95)'; g.lineWidth = Math.max(1.5, this.tw / 34);
      g.beginPath(); g.ellipse(cx, cy + this.th * 0.12, this.tw * 0.3, this.th * 0.28, 0, 0, Math.PI * 2); g.stroke();
    }
    if (u === this.active) { g.strokeStyle = '#fff4a0'; g.lineWidth = Math.max(2, this.tw / 24); g.beginPath(); g.ellipse(cx, cy + this.th * 0.12, this.tw * 0.36, this.th * 0.34, 0, 0, Math.PI * 2); g.stroke(); }
    const spr = unitSprite(u.s.line, u.s.tier, col, frame, tired), big = u.structure ? 1.35 : 1;
    const w = UNIT_W * s * big, h = UNIT_H * s * big;
    const lx = u.lunge ? (u.lunge[0] - u.lunge[1]) * this.tw * 0.14 : 0, ly = u.lunge ? (u.lunge[0] + u.lunge[1]) * this.th * 0.14 : 0;
    const bx = Math.floor(cx - w / 2 + lx), by = Math.floor(cy + this.th * 0.2 - h + ly);
    g.save(); g.translate(bx + (u.dir < 0 ? w : 0), by); if (u.dir < 0) g.scale(-1, 1);
    g.drawImage(spr, 0, 0, w, h);
    if (u.flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = u.alpha * Math.min(1, u.flash * 3); g.drawImage(spr, 0, 0, w, h); g.globalCompositeOperation = 'source-over'; g.globalAlpha = u.alpha; u.flash -= dt; }
    g.restore();
    // a chunky outlined troops bar over the head
    const k = Math.max(0, u.hp) / u.s.hp, bw = this.tw * 0.5, bh = Math.max(3, this.tw / 18), barX = cx - bw / 2, barY = by - bh - 2;
    g.fillStyle = '#2e1e12'; g.fillRect(barX - 1, barY - 1, bw + 2, bh + 2);
    g.fillStyle = '#5a4630'; g.fillRect(barX, barY, bw, bh);
    g.fillStyle = k > 0.5 ? (this.mine(u) ? '#62b8ff' : '#ff7a5a') : k > 0.25 ? '#ffd040' : '#ff3a2a'; g.fillRect(barX, barY, bw * k, bh);
    if (u.commander) { const fs = this.tw * 0.15; g.fillStyle = '#ffd040'; g.strokeStyle = '#2e1e12'; g.lineWidth = 1.5; g.beginPath(); const sx = barX - fs * 1.3, sy = barY + bh / 2; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? fs * 0.45 : fs; g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke(); }
    Object.keys(u.st).forEach((k2, i) => { g.fillStyle = AILMENTS[k2] ? AILMENTS[k2][2] : '#fff'; g.strokeStyle = '#2e1e12'; g.lineWidth = 1; g.beginPath(); g.arc(barX + bw + 6 + i * 8, barY + bh / 2, Math.max(3, this.tw / 22), 0, Math.PI * 2); g.fill(); g.stroke(); });
    const bufs = Object.entries(u.buf); if (bufs.length) { const up = bufs.some(([, v]) => v[0] > 0), ch = up ? '▲' : '▼'; g.font = `900 ${Math.round(this.tw * 0.2)}px sans-serif`; g.fillStyle = up ? '#7aff8a' : '#ff8a7a'; g.strokeStyle = '#2e1e12'; g.lineWidth = 3; g.strokeText(ch, cx + w * 0.3, by + h * 0.5); g.fillText(ch, cx + w * 0.3, by + h * 0.5); }
    g.globalAlpha = 1;
  }
  drawFx(f) {
    const g = this.g, ts = this.ts, k = f.t / f.dur, [sx, sy] = this.scr(f.x, f.y), cx = sx + ts / 2, cy = sy + ts / 2;
    if (f.kind === 'text') {
      g.save(); g.font = `900 ${Math.round(ts * (f.big ? 0.44 : 0.36))}px "Noto Sans TC", sans-serif`; g.textAlign = 'center';
      const y = cy - ts * 0.35 - k * ts * 0.5; g.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
      g.lineWidth = Math.max(3, ts / 10); g.lineJoin = 'round'; g.strokeStyle = '#2e1e12'; g.strokeText(f.text, cx, y); g.fillStyle = f.col || '#fff'; g.fillText(f.text, cx, y); g.restore();
      return;
    }
    g.save(); g.globalAlpha = Math.min(1, (1 - k) * 2);
    const r = (n) => (Math.sin(n * 91.7 + f.seed) * 0.5 + 0.5);
    if (f.kind === 'fire') for (let i = 0; i < 14; i++) { const a = r(i), hgt = ts * (0.25 + 0.5 * r(i + 3)) * Math.sin(k * Math.PI); g.fillStyle = i % 3 ? '#ff8a20' : '#ffe040'; g.beginPath(); g.ellipse(sx + ts * (0.1 + 0.8 * a), sy + ts * 0.95 - hgt * (0.5 + 0.5 * Math.abs(Math.sin(f.t * 12 + i))), ts * 0.08, hgt * 0.35, 0, 0, Math.PI * 2); g.fill(); }
    if (f.kind === 'water') { g.fillStyle = 'rgba(80,150,255,.7)'; const hgt = ts * Math.sin(k * Math.PI); g.beginPath(); g.ellipse(cx, sy + ts, ts * 0.5, Math.max(1, hgt * 0.6), 0, Math.PI, 0); g.fill(); g.fillStyle = 'rgba(220,240,255,.85)'; for (let i = 0; i < 4; i++) g.fillRect(sx + ts * r(i), sy + ts - hgt * 0.5 + ts * 0.08 * i, ts * 0.25, 2); }
    if (f.kind === 'rock') for (let i = 0; i < 5; i++) { const fall = Math.min(1, k * 1.6 - i * 0.1); if (fall < 0) continue; g.fillStyle = i % 2 ? '#8e8676' : '#6e665a'; const s2 = ts * (0.16 + 0.12 * r(i)); g.fillRect(sx + ts * (0.1 + 0.7 * r(i + 9)), sy - ts + fall * ts * 1.7, s2, s2); }
    if (f.kind === 'wind') { g.strokeStyle = 'rgba(230,255,235,.95)'; g.lineWidth = Math.max(2, ts / 14); for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(cx, cy + ts * 0.2, ts * (0.15 + i * 0.13), ts * (0.08 + i * 0.07), 0, f.t * 9 + i, f.t * 9 + i + 3.6); g.stroke(); } }
    if (f.kind === 'bolt') { g.strokeStyle = '#fff8a0'; g.lineWidth = Math.max(3, ts / 10); g.beginPath(); let x = cx, y = sy - ts * 2; g.moveTo(x, y); for (let i = 0; i < 6; i++) { x = cx + (r(i + Math.floor(f.t * 20)) - 0.5) * ts * 0.6; y += ts * 0.55; g.lineTo(x, y); } g.stroke(); }
    if (f.kind === 'heal' || f.kind === 'buff' || f.kind === 'cure') { g.fillStyle = f.kind === 'heal' ? '#8aff9a' : f.kind === 'cure' ? '#fff' : '#ffe070'; for (let i = 0; i < 8; i++) { const y = sy + ts * (1 - ((k * 1.4 + r(i)) % 1)); g.fillRect(sx + ts * r(i + 4), y, Math.max(3, ts / 14), Math.max(3, ts / 14) * 2); } }
    if (f.kind === 'hex' || f.kind === 'debuff') { g.strokeStyle = f.kind === 'hex' ? '#ff8ad8' : '#c08aff'; g.lineWidth = Math.max(2, ts / 14); g.beginPath(); for (let i = 0; i < 20; i++) { const a = i * 0.7 + f.t * 6, rr = ts * 0.4 * (1 - i / 22); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.6); } g.stroke(); }
    if (f.kind === 'slash') { g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(3, ts / 10); g.lineCap = 'round'; g.beginPath(); g.moveTo(sx + ts * 0.15, sy + ts * (0.2 + k * 0.3)); g.lineTo(sx + ts * 0.85, sy + ts * (0.55 + k * 0.3)); g.stroke(); }
    if (f.kind === 'arrow' || f.kind === 'boulder') {
      const [fx0, fy0] = this.scr(f.from[0], f.from[1]), px = fx0 + (sx - fx0) * k + ts / 2, py = fy0 + (sy - fy0) * k + ts / 2 - Math.sin(k * Math.PI) * ts * (f.kind === 'boulder' ? 2 : 1);
      if (f.kind === 'arrow') { g.strokeStyle = '#f4e4c4'; g.lineWidth = Math.max(2, ts / 16); g.beginPath(); g.moveTo(px - (sx - fx0) * 0.06, py - (sy - fy0) * 0.06); g.lineTo(px, py); g.stroke(); }
      else { g.fillStyle = '#6e665a'; g.beginPath(); g.arc(px, py, ts * 0.15, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  }
  text(x, y, text, col, big = false, dur = 1.1) { this.fx.push({ kind: 'text', x, y, text, col, big, t: 0, dur }); }
  effect(kind, x, y, dur = 0.7, extra = {}) { this.fx.push({ kind, x, y, t: 0, dur, seed: Math.random() * 100, ...extra }); }
}
