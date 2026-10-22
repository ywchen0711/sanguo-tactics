// The battle rules, 曹操傳-style: each side moves all its units in its phase (move, then attack / strategy / item / wait),
// terrain costs movement and shields defenders, cavalry beats infantry beats archers beats cavalry, and a struck unit
// strikes back if it can reach. No drawing here: the UI plays back B.events. Runs in Node for tests.
import { TERRAIN, apt, counter, STRATS, DMG_KINDS, HELP_KINDS, USABLES, LINES } from '../data/rules.js';
import { battleStats, gainExp, strategiesOf } from './officer.js';
import { tileAt, rng } from './mapgen.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const md = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
const ev = (B, e) => { B.events.push(e); return e; };
export const alive = (u) => u && !u.gone;
export const foesOf = (B, u) => B.units.filter((o) => alive(o) && o.side !== u.side);
export const friendsOf = (B, u) => B.units.filter((o) => alive(o) && o.side === u.side);
export const unitAt = (B, x, y) => B.units.find((o) => alive(o) && o.x === x && o.y === y) || null;
const other = (side) => (side === 'atk' ? 'def' : 'atk');

// ---------------------------------------------------------------- setting up
// sides: { atk: { name, color, player, units: [{ o, troops, commander, ai }] }, def: {...} }
export function createBattle({ map, atk, def, limit = 30, seed = 1, goal } = {}) {
  const B = { map, units: [], turn: 1, limit, side: 'atk', events: [], rnd: rng(seed), over: null, why: null, sides: { atk, def }, uid: 1, goal: goal || 'storm', exp: {}, loot: [] };
  for (const sideKey of ['atk', 'def']) {
    const S = B.sides[sideKey], spots = sideKey === 'atk' ? map.atkStart : map.defStart;
    S.units.forEach((m, i) => {
      const p = spots[i % spots.length], s = battleStats(m.o);
      const u = { id: B.uid++, o: m.o, side: sideKey, x: p[0], y: p[1], s, hp: Math.max(1, Math.min(s.hp, m.troops ?? s.hp)), mp: s.mp, st: {}, buf: {}, moved: false, acted: false, done: false,
        commander: !!m.commander, ai: m.ai ?? !S.player, mode: m.mode || (sideKey === 'def' ? 'hold' : 'attack'), dir: sideKey === 'atk' ? 1 : -1, start: m.troops ?? s.hp, kills: 0 };
      // two officers on one start tile: find the nearest free spot
      if (B.units.some((o) => o.x === u.x && o.y === u.y)) { const f = freeNear(B, u.x, u.y, u); if (f) { u.x = f[0]; u.y = f[1]; } }
      B.units.push(u);
    });
  }
  startPhase(B, 'atk');
  return B;
}
function freeNear(B, x, y, u) {
  for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) + Math.abs(dy) !== r) continue;
    const nx = x + dx, ny = y + dy, t = tileAt(B.map, nx, ny);
    if (t && TERRAIN[t.t].cost[u.s.move] > 0 && !B.units.some((o) => alive(o) && o.x === nx && o.y === ny)) return [nx, ny];
  }
  return null;
}

// ---------------------------------------------------------------- phases
export function startPhase(B, side) {
  B.side = side;
  ev(B, { t: 'phase', side, turn: B.turn });
  for (const u of B.units) {
    if (!alive(u) || u.side !== side) continue;
    u.moved = false; u.acted = false; u.done = false; u.from = null;
    const tt = TERRAIN[tileAt(B.map, u.x, u.y).t];
    if (tt.heal && u.hp < u.s.hp) { const n = Math.min(u.s.hp - u.hp, Math.round(u.s.hp * tt.heal / 100)); u.hp += n; ev(B, { t: 'heal', u, n, why: 'ground' }); }
    if (u.st.poison) { const n = Math.min(u.hp - 1, Math.round(u.s.hp * 0.08)); if (n > 0) { u.hp -= n; ev(B, { t: 'dmg', u, n, why: 'poison' }); } }
    for (const k of Object.keys(u.st)) { u.st[k]--; if (u.st[k] <= 0) { delete u.st[k]; ev(B, { t: 'cured', u, st: k }); } }
    for (const k of Object.keys(u.buf)) { u.buf[k][1]--; if (u.buf[k][1] <= 0) delete u.buf[k]; }
    // confused units wander and strike at random; they are handled by the AI even on the player's side
  }
}
// everyone on this side has acted (or the player ended the phase): the other side's turn, or the next turn
export function endPhase(B) {
  if (B.over) return;
  for (const u of B.units) if (alive(u) && u.side === B.side) u.done = true;
  if (B.side === 'atk') startPhase(B, 'def');
  else { B.turn++; if (B.turn > B.limit) return finish(B, 'def', 'time'); startPhase(B, 'atk'); }
  checkEnd(B);
}
export function finish(B, winner, why) { if (B.over) return; B.over = winner; B.why = why; ev(B, { t: 'end', winner, why }); }
export function checkEnd(B) {
  if (B.over) return B.over;
  const A = B.units.filter((u) => alive(u) && u.side === 'atk'), D = B.units.filter((u) => alive(u) && u.side === 'def');
  if (!A.length) return finish(B, 'def', 'rout');
  if (!D.length) return finish(B, 'atk', 'rout');
  if (!A.some((u) => u.commander)) return finish(B, 'def', 'commander');
  if (!D.some((u) => u.commander)) return finish(B, 'atk', 'commander');
  if (B.map.siege && A.some((u) => u.x === B.map.keep[0] && u.y === B.map.keep[1])) return finish(B, 'atk', 'keep');
  return null;
}

// ---------------------------------------------------------------- movement
// zone of control: stepping next to a foe ends the move (except for the tile you stand on when you start)
export function reach(B, u) {
  const out = new Map(), key = (x, y) => `${x},${y}`;
  if (u.st.stop) { out.set(key(u.x, u.y), { x: u.x, y: u.y, cost: 0, path: [[u.x, u.y]] }); return out; }
  const mov = u.s.mov + (u.buf.agi ? 1 : 0), foes = foesOf(B, u);
  const zoc = new Set(); for (const f of foes) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) zoc.add(key(f.x + dx, f.y + dy));
  const q = [{ x: u.x, y: u.y, cost: 0, path: [[u.x, u.y]] }]; out.set(key(u.x, u.y), q[0]);
  while (q.length) {
    q.sort((a, b) => a.cost - b.cost);
    const c = q.shift();
    if (c.cost > 0 && zoc.has(key(c.x, c.y))) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy, t = tileAt(B.map, nx, ny); if (!t) continue;
      const cost = TERRAIN[t.t].cost[u.s.move]; if (!cost) continue;
      const o = unitAt(B, nx, ny); if (o && o.side !== u.side) continue;
      const nc = c.cost + cost; if (nc > mov) continue;
      const k = key(nx, ny), prev = out.get(k); if (prev && prev.cost <= nc) continue;
      const n = { x: nx, y: ny, cost: nc, path: [...c.path, [nx, ny]] }; out.set(k, n); q.push(n);
    }
  }
  // you can pass through friends but not stop on them
  for (const [k, v] of [...out]) { const o = unitAt(B, v.x, v.y); if (o && o !== u) out.delete(k); }
  return out;
}
export function moveTo(B, u, x, y, path) {
  if (u.x === x && u.y === y) { u.moved = true; return; }
  u.from = [u.x, u.y]; const p = path || [[u.x, u.y], [x, y]];
  if (x !== u.x) u.dir = x > u.x ? 1 : -1;
  u.x = x; u.y = y; u.moved = true;
  ev(B, { t: 'move', u, path: p });
}
// undo a move (before acting)
export function undoMove(B, u) { if (!u.from || u.acted) return false; u.x = u.from[0]; u.y = u.from[1]; u.from = null; u.moved = false; return true; }

// ---------------------------------------------------------------- attacking
export const inRange = (u, fx, fy, tx, ty) => { const d = md(fx, fy, tx, ty); return d >= u.s.r[0] && d <= u.s.r[1]; };
export function attackTiles(B, u, fx = u.x, fy = u.y) {
  const out = [];
  for (let dy = -u.s.r[1]; dy <= u.s.r[1]; dy++) for (let dx = -u.s.r[1]; dx <= u.s.r[1]; dx++) { const x = fx + dx, y = fy + dy; if (tileAt(B.map, x, y) && inRange(u, fx, fy, x, y)) out.push([x, y]); }
  return out;
}
const bufK = (u, k) => 1 + (u.buf[k] ? u.buf[k][0] : 0);
const tAt = (B, u) => tileAt(B.map, u.x, u.y).t;
// the expected exchange: damage, hit, crit and double-strike chances, and the counter
export function forecast(B, a, d) {
  const one = (x, y, counterHit) => {
    const ta = tAt(B, x), td = tAt(B, y);
    const wall = y.wallBonus && ['town', 'gate', 'castle', 'camp'].includes(td) ? y.wallBonus : 0;
    const atk = x.s.atk * bufK(x, 'atk') * apt(x.s.move, ta), def = y.s.def * bufK(y, 'def') * apt(y.s.move, td) * (1 + TERRAIN[td].def / 100 + wall);
    let dmg = (atk - def / 2) * 4 + (x.o.lv - y.o.lv) * 5 + 20;
    dmg *= counter(x.s.kind, y.s.kind);
    if (x.s.line === 'siege' && ['castle', 'gate', 'camp', 'town', 'fence'].includes(td)) dmg *= 1.4;
    if (counterHit) dmg *= 0.75;
    dmg = Math.max(10, Math.round(dmg));
    const hit = y.st.conf || y.st.stop ? 100 : clamp(Math.round(90 + (x.s.agi * bufK(x, 'agi') - y.s.agi * bufK(y, 'agi')) * 0.5), 60, 100);
    const crit = clamp(Math.round(5 + (x.s.mor - y.s.mor) * 0.3 + (x.s.line === 'brawl' ? 10 : 0) + (x.commander ? 3 : 0)), 3, 35);
    const dbl = counterHit ? 0 : clamp(Math.round((x.s.agi - y.s.agi) * 0.6 - 5 + (x.s.line === 'brawl' ? 15 : 0) + (x.s.line === 'cav' && x.s.tier === 2 ? 8 : 0)), 0, 40);
    return { dmg, hit, crit, dbl };
  };
  const f = one(a, d, false);
  const canCounter = !d.st.conf && inRange(d, d.x, d.y, a.x, a.y) && !(d.s.line === 'siege' && d.s.r[0] > 1 && md(a.x, a.y, d.x, d.y) < 2);
  f.counter = canCounter ? one(d, a, true) : null;
  return f;
}
export function attack(B, a, d) {
  const f = forecast(B, a, d);
  if (d.x !== a.x) a.dir = d.x > a.x ? 1 : -1;
  const strike = (x, y, F, kind) => {
    if (!alive(x) || !alive(y)) return;
    const miss = B.rnd() * 100 >= F.hit, crit = !miss && B.rnd() * 100 < F.crit;
    const dmg = miss ? 0 : Math.min(y.hp, Math.round(F.dmg * (crit ? 1.5 : 1) * (0.95 + B.rnd() * 0.1)));
    y.hp -= dmg;
    ev(B, { t: 'atk', a: x, d: y, dmg, miss, crit, kind });
    gainFrom(B, x, y, dmg, kind === 'counter' ? 0.5 : 1);
    if (y.hp <= 0) defeat(B, y, x);
  };
  strike(a, d, f, 'atk');
  if (alive(d) && f.dbl && B.rnd() * 100 < f.dbl) strike(a, d, f, 'double');
  if (alive(d) && alive(a) && f.counter) strike(d, a, f.counter, 'counter');
  a.acted = true;
  checkEnd(B);
}
function defeat(B, u, by) {
  u.hp = 0; u.gone = true;
  ev(B, { t: 'retreat', u, by });
  if (by) { by.kills++; giveExp(B, by, 20 + (u.commander ? 30 : 0) + Math.max(0, u.o.lv - by.o.lv) * 3); }
}
// experience: a little for every blow, more for felling a unit
function gainFrom(B, x, y, dmg, k) { if (!dmg) return; giveExp(B, x, Math.round(clamp(8 + (y.o.lv - x.o.lv) * 2, 2, 24) * k)); }
export function giveExp(B, u, n) {
  if (!n || u.side !== playerSide(B)) return;
  B.exp[u.o.id] = (B.exp[u.o.id] || 0) + n;
  const before = u.s.hp, t0 = u.s.tier, ups = gainExp(u.o, n);
  if (ups.length) {
    const s = battleStats(u.o); u.hp = Math.min(s.hp, u.hp + (s.hp - before)); u.mp = Math.min(s.mp, u.mp + 4); u.s = s;
    ev(B, { t: 'lvup', u, lv: u.o.lv, promoted: s.tier > t0 ? s.cls : null });
  }
}
export const playerSide = (B) => (B.sides.atk.player ? 'atk' : B.sides.def.player ? 'def' : null);

// ---------------------------------------------------------------- strategies
const AREA = (a) => { const out = []; for (let dy = -a; dy <= a; dy++) for (let dx = -a; dx <= a; dx++) if (Math.abs(dx) + Math.abs(dy) <= a) out.push([dx, dy]); return out; };
export const areaOf = (B, s, x, y) => AREA(STRATS[s].a).map(([dx, dy]) => [x + dx, y + dy]).filter(([ax, ay]) => tileAt(B.map, ax, ay));
// can this strategy be cast at that tile? (fire won't burn on water, floods need water nearby, rocks need slopes)
export function terrainOk(B, u, sid, x, y) {
  const k = STRATS[sid].kind, t = tileAt(B.map, x, y); if (!t) return false;
  const T = TERRAIN[t.t];
  if (k === 'fire') return !T.wet && !T.cold;
  if (k === 'water') { if (T.wet) return true; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = tileAt(B.map, x + dx, y + dy); return n && TERRAIN[n.t].wet; }); }
  if (k === 'rock') return !!T.rock || !!TERRAIN[tileAt(B.map, u.x, u.y).t].rock;
  return true;
}
export const stratCost = (u, sid) => STRATS[sid].mp;
export function canCast(B, u, sid) { return !u.st.seal && u.mp >= stratCost(u, sid); }
// tiles you may aim this strategy at (centre on a unit of the right side)
export function stratTargets(B, u, sid, fx = u.x, fy = u.y) {
  const S = STRATS[sid], help = HELP_KINDS.has(S.kind), out = [];
  for (const o of B.units) {
    if (!alive(o)) continue;
    if (help ? o.side !== u.side : o.side === u.side) continue;
    if (md(fx, fy, o.x, o.y) > S.r) continue;
    if (!help && !terrainOk(B, { ...u, x: fx, y: fy }, sid, o.x, o.y)) continue;
    out.push([o.x, o.y]);
  }
  return out;
}
export function stratForecast(B, u, sid, t) {
  const S = STRATS[sid];
  if (S.kind === 'heal') return { heal: Math.round(u.s.spi * bufK(u, 'spi') * S.p * 3 + 80 + u.o.lv * 4) };
  if (HELP_KINDS.has(S.kind)) return { hit: 100 };
  const dspi = t.s.spi * bufK(t, 'spi');
  if (DMG_KINDS.has(S.kind)) {
    const T = TERRAIN[tileAt(B.map, t.x, t.y).t];
    let dmg = (u.s.spi * bufK(u, 'spi') * S.p - dspi * 0.45) * 3.6 + (u.o.lv - t.o.lv) * 4 + 30;
    if (S.kind === 'fire' && T.burn) dmg *= T.burn;
    if (S.kind === 'water' && T.wet) dmg *= 1.15;
    dmg *= 1 - (t.s.res || 0) / 100;
    return { dmg: Math.max(10, Math.round(dmg)), hit: clamp(Math.round(80 + (u.s.spi - dspi) * 0.6), 40, 100) };
  }
  // ailments and weakening
  return { hit: clamp(Math.round(50 + (u.s.spi - dspi) * 1.0 + (S.p - 1) * 30 - (t.s.res || 0) / 2), 10, 95) };
}
export function cast(B, u, sid, x, y) {
  const S = STRATS[sid]; if (!canCast(B, u, sid)) return false;
  u.mp -= stratCost(u, sid);
  if (x !== u.x) u.dir = x > u.x ? 1 : -1;
  const help = HELP_KINDS.has(S.kind), tiles = areaOf(B, sid, x, y), res = [];
  for (const [tx, ty] of tiles) {
    const t = unitAt(B, tx, ty); if (!t || (help ? t.side !== u.side : t.side === u.side)) continue;
    if (!help && S.a && !terrainOk(B, u, sid, tx, ty)) continue;
    const f = stratForecast(B, u, sid, t), r = { d: t };
    if (S.kind === 'heal') { const n = Math.min(t.s.hp - t.hp, Math.round(f.heal * (0.95 + B.rnd() * 0.1))); t.hp += n; r.heal = n; giveExp(B, u, n > 0 ? 8 : 2); }
    else if (S.kind === 'cure') { const had = Object.keys(t.st).length; t.st = {}; if (sid === 'guwu') t.buf.mor = [0.2, 3]; r.cure = true; giveExp(B, u, had ? 10 : 3); }
    else if (S.kind.endsWith('+')) { const k = S.kind.slice(0, 3); t.buf[k] = [0.2, 3]; r.buf = k; giveExp(B, u, 6); }
    else if (B.rnd() * 100 >= f.hit) { r.miss = true; }
    else if (DMG_KINDS.has(S.kind)) { const n = Math.min(t.hp, Math.round(f.dmg * (0.95 + B.rnd() * 0.1))); t.hp -= n; r.dmg = n; gainFrom(B, u, t, n, 1); if (t.hp <= 0) r.fell = true; }
    else if (S.kind.endsWith('-')) { const k = S.kind.slice(0, 3); t.buf[k] = [-0.2, 3]; r.buf = k; giveExp(B, u, 8); }
    else { t.st[S.kind] = S.p > 1 ? 3 : 2 + (B.rnd() < 0.5 ? 1 : 0); r.st = S.kind; giveExp(B, u, 10); }
    res.push(r);
  }
  ev(B, { t: 'strat', u, sid, x, y, tiles, res });
  for (const r of res) if (r.fell) defeat(B, r.d, u);
  u.acted = true;
  checkEnd(B);
  return true;
}

// ---------------------------------------------------------------- items
export function itemTargets(B, u, id) { const it = USABLES[id]; return friendsOf(B, u).filter((o) => md(o.x, o.y, u.x, u.y) <= 1 && (it.heal ? o.hp < o.s.hp : it.mph ? o.mp < o.s.mp : Object.keys(o.st).length)).map((o) => [o.x, o.y]); }
export function useItem(B, u, id, t) {
  const it = USABLES[id], r = { d: t };
  if (it.heal) { const n = Math.min(t.s.hp - t.hp, it.heal); t.hp += n; r.heal = n; }
  if (it.mph) { const n = Math.min(t.s.mp - t.mp, it.mph); t.mp += n; r.mp = n; }
  if (it.cure) { t.st = {}; r.cure = true; }
  ev(B, { t: 'item', u, id, res: [r] });
  giveExp(B, u, 6); u.acted = true;
}
export function wait(B, u) { u.acted = true; u.done = true; }

// ---------------------------------------------------------------- the AI
// modes: attack (go for them), hold (stay inside the walls until someone comes near), guard (the commander: stay on the keep)
export function plan(B, u) {
  const foes = foesOf(B, u), friends = friendsOf(B, u);
  const moves = u.moved ? [{ x: u.x, y: u.y, path: [[u.x, u.y]] }] : [...reach(B, u).values()];
  // a confused unit staggers somewhere and hits whoever is next to it, friend or foe
  if (u.st.conf) { const m = moves[Math.floor(B.rnd() * moves.length)]; const near = B.units.filter((o) => alive(o) && o !== u && md(o.x, o.y, m.x, m.y) === 1); return { ...m, act: near.length && B.rnd() < 0.6 ? 'atk' : null, target: near[0] || null }; }
  const pos = (m) => {
    const T = TERRAIN[tileAt(B.map, m.x, m.y).t];
    let s = T.def * 0.25 + (T.heal && u.hp < u.s.hp * 0.7 ? 8 : 0) + apt(u.s.move, tileAt(B.map, m.x, m.y).t) * 6;
    const near = foes.reduce((d, f) => Math.min(d, md(f.x, f.y, m.x, m.y)), 99);
    const frail = u.s.kind === 'mag' || u.s.line === 'arch' || u.s.line === 'siege';
    if (u.mode === 'attack') s -= near * (frail ? 0.6 : 1.2);
    if (frail && near <= 1) s -= 10;
    if (u.mode === 'guard' && B.map.keep) s -= md(m.x, m.y, B.map.keep[0], B.map.keep[1]) * 12;
    if (u.mode === 'hold' && B.map.keep) s -= Math.max(0, md(m.x, m.y, B.map.keep[0], B.map.keep[1]) - 5) * 3;
    // attackers want the keep
    if (u.side === 'atk' && B.map.siege && m.x === B.map.keep[0] && m.y === B.map.keep[1]) s += 200;
    if (u.hp < u.s.hp * 0.35 && near <= 2) s -= 8;
    return s;
  };
  let best = { score: -1e9 };
  const consider = (m, act, target, sid, base) => { const sc = base + pos(m); if (sc > best.score) best = { score: sc, x: m.x, y: m.y, path: m.path, act, target, sid }; };
  const commanderBonus = (d) => (d.commander ? 25 : 0);
  // hold: until a foe comes near, stay put (but still strike anything in reach)
  const roused = u.mode !== 'hold' || foes.some((f) => md(f.x, f.y, u.x, u.y) <= u.s.mov + u.s.r[1] + 3) || B.turn > B.limit * 0.6;
  for (const m of moves) {
    if (!roused && (m.x !== u.x || m.y !== u.y)) continue;
    if (u.mode === 'guard' && B.map.keep && (m.x !== B.map.keep[0] || m.y !== B.map.keep[1]) && md(u.x, u.y, B.map.keep[0], B.map.keep[1]) === 0 && u.hp > u.s.hp * 0.3) continue;
    consider(m, null, null, null, 0);
    const ox = u.x, oy = u.y; u.x = m.x; u.y = m.y;
    if (!u.acted) {
      for (const d of foes) {
        if (!inRange(u, m.x, m.y, d.x, d.y)) continue;
        const f = forecast(B, u, d);
        const exp = Math.min(d.hp, f.dmg) * f.hit / 100 * (1 + f.dbl / 200);
        let v = exp / d.s.hp * 100 + (f.dmg >= d.hp ? 50 : 0) + commanderBonus(d);
        if (f.counter) v -= Math.min(u.hp, f.counter.dmg) * f.counter.hit / 100 / u.s.hp * 60;
        consider(m, 'atk', d, null, v);
      }
      if (!u.st.seal) for (const sid of u.s.strats) {
        const S = STRATS[sid]; if (u.mp < S.mp) continue;
        for (const [tx, ty] of stratTargets(B, u, sid, m.x, m.y)) {
          let v = 0;
          for (const [ax, ay] of areaOf(B, sid, tx, ty)) {
            const t = unitAt(B, ax, ay); if (!t || t === u && !HELP_KINDS.has(S.kind)) continue;
            const help = HELP_KINDS.has(S.kind); if (help ? t.side !== u.side : t.side === u.side) continue;
            const f = stratForecast(B, u, sid, t);
            if (S.kind === 'heal') { const miss = t.s.hp - t.hp; if (miss > t.s.hp * 0.2) v += Math.min(miss, f.heal) / t.s.hp * 110 + (t.commander ? 10 : 0); }
            else if (S.kind === 'cure') v += Object.keys(t.st).length ? 30 : 0;
            else if (S.kind.endsWith('+')) v += t.buf[S.kind.slice(0, 3)] ? 0 : foes.some((f) => md(f.x, f.y, t.x, t.y) <= f.s.mov + f.s.r[1] + 1) ? 7 : 0;
            else if (S.kind.endsWith('-')) v += t.buf[S.kind.slice(0, 3)] ? 0 : 10 * f.hit / 100;
            else if (DMG_KINDS.has(S.kind)) v += (Math.min(t.hp, f.dmg) / t.s.hp * 100 + (f.dmg >= t.hp ? 50 : 0) + commanderBonus(t)) * f.hit / 100;
            else v += t.st[S.kind] ? 0 : (S.kind === 'conf' ? 32 : S.kind === 'seal' ? (t.s.kind === 'mag' ? 30 : 6) : S.kind === 'stop' ? 18 : 16) * f.hit / 100;
          }
          v -= S.mp * 0.4;
          if (v > 0) consider(m, 'strat', unitAt(B, tx, ty), sid, v);
        }
      }
      // supplies for a badly hurt friend (or oneself)
      if (u.items) for (const id of Object.keys(u.items)) {
        if (!u.items[id]) continue;
        for (const [tx, ty] of itemTargets(B, u, id)) { const t = unitAt(B, tx, ty), it = USABLES[id]; if (it.heal && t.hp < t.s.hp * 0.4) consider(m, 'item', t, id, Math.min(it.heal, t.s.hp - t.hp) / t.s.hp * 90); }
      }
    }
    u.x = ox; u.y = oy;
  }
  // nothing to hit from anywhere: march toward the nearest foe (or the keep)
  if (!best.act && roused && u.mode !== 'guard' && foes.length && !u.moved) {
    const goal = u.side === 'atk' && B.map.siege && u.mode === 'attack' && foes.length <= 2 ? [{ x: B.map.keep[0], y: B.map.keep[1] }] : foes;
    const field = stepsTo(B, u, goal);
    let pick = null;
    for (const m of moves) { const d = (field.get(`${m.x},${m.y}`) ?? 999) - pos(m) * 0.05; if (!pick || d < pick.d) pick = { ...m, d }; }
    if (pick) return { x: pick.x, y: pick.y, path: pick.path, act: null };
  }
  return best;
}
// walking distance (ignoring units) from every tile to the nearest goal, for this unit's move type
export function stepsTo(B, u, goals) {
  const dist = new Map(), q = [];
  for (const g of goals) { dist.set(`${g.x},${g.y}`, 0); q.push([g.x, g.y, 0]); }
  while (q.length) {
    q.sort((a, b) => a[2] - b[2]); const [x, y, d] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, t = tileAt(B.map, nx, ny); if (!t) continue;
      const c = TERRAIN[t.t].cost[u.s.move]; if (!c) continue;
      const k = `${nx},${ny}`, nd = d + c; if (dist.has(k) && dist.get(k) <= nd) continue;
      dist.set(k, nd); q.push([nx, ny, nd]);
    }
  }
  return dist;
}
// carry out a plan (for the AI and for auto-battle)
export function runPlan(B, u, p) {
  if (!p) { wait(B, u); return; }
  if ((p.x !== u.x || p.y !== u.y) && !u.moved) moveTo(B, u, p.x, p.y, p.path);
  u.moved = true;
  if (!B.over && p.act === 'atk' && p.target && alive(p.target) && inRange(u, u.x, u.y, p.target.x, p.target.y)) attack(B, u, p.target);
  else if (!B.over && p.act === 'strat' && p.target) cast(B, u, p.sid, p.target.x, p.target.y);
  else if (!B.over && p.act === 'item' && p.target) { u.items[p.sid]--; useItem(B, u, p.sid, p.target); }
  checkEnd(B);
  u.done = true; u.acted = true;
}
// the whole phase for an AI side (or auto-battle): units nearest the enemy go first
export function aiPhase(B, side = B.side) {
  const order = B.units.filter((u) => alive(u) && u.side === side && !u.done).sort((a, b) => nearest(B, a) - nearest(B, b));
  for (const u of order) { if (B.over) break; if (!alive(u) || u.done) continue; runPlan(B, u, plan(B, u)); }
}
const nearest = (B, u) => foesOf(B, u).reduce((d, f) => Math.min(d, md(f.x, f.y, u.x, u.y)), 99);
export { md, LINES, strategiesOf };
