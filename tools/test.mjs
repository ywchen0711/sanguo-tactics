// node tools/test.mjs — the data hangs together, the battle rules hold, and whole campaigns run for years without trouble.
import { STRATS, LEARN, LINES, TERRAIN, GEAR } from '../js/data/rules.js';
import { SCENARIOS } from '../js/data/scenarios.js';
import { battleStats, gainExp } from '../js/core/officer.js';
import { makeField, THEMES } from '../js/core/mapgen.js';
import * as BT from '../js/core/battle.js';
import * as C from '../js/core/campaign.js';

let fails = 0;
const ok = (name, cond, info = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}  ${info}`); if (!cond) fails++; };

// data
ok('every learnable strategy exists', Object.values(LEARN).flat().every(([id]) => STRATS[id]));
ok('every line has three tiers', Object.values(LINES).every((L) => L.names.length === 3 && L.mov.length === 3 && L.r.length === 3));
ok('gear types match lines', Object.values(LINES).every((L) => (!L.wpn || GEAR[L.wpn + '1']) && GEAR[L.arm + '1']));

// every battlefield: the attackers can walk to the keep
let blocked = 0;
for (const th of Object.keys(THEMES)) for (let s = 0; s < 30; s++) {
  const m = makeField({ theme: th, seed: s * 31 + 7 });
  const B = { map: m, units: [] }, u = { s: { move: 'foot' } };
  const d = BT.stepsTo(B, u, [{ x: m.keep[0], y: m.keep[1] }]);
  if (!m.atkStart.some(([x, y]) => d.has(`${x},${y}`))) { blocked++; if (blocked < 4) console.log('   blocked', th, s); }
  if (m.atkStart.length < 10 || m.defStart.length < 10) { blocked++; console.log('   few starts', th, s, m.atkStart.length, m.defStart.length); }
}
ok('battlefields are connected and roomy', blocked === 0, `${blocked} bad of ${Object.keys(THEMES).length * 30}`);

// campaigns: every scenario, the player's house run by the AI, a few years each
for (const sc of SCENARIOS) {
  const t0 = Date.now();
  let err = null, battles = 0;
  const G = C.newGame({ scenario: sc.id, player: sc.factions[0][0], seed: 42 });
  const serving = G.officers.filter((o) => o.status === 'serving').length;
  try {
    for (let m = 0; m < 48 && !G.over; m++) {
      const { threats } = C.endMonth(G, { autoPlayer: true });
      for (const t of threats) { const B = C.battleSetup(G, t); C.autoBattle(B); C.settle(G, B); battles++; if (G.over) break; }
    }
  } catch (e) { err = e; console.log(e.stack); }
  const alive = Object.values(G.factions).filter((f) => f.alive).length;
  const bad = G.cities.filter((c) => c.owner && !G.factions[c.owner].alive).length + G.officers.filter((o) => o.status === 'serving' && (!G.factions[o.fac] || !G.factions[o.fac].alive || G.cities[o.city].owner !== o.fac)).length;
  ok(`scenario ${sc.id}: four years run`, !err && bad === 0, `${serving} officers serving at start · ${alive}/${Object.keys(G.factions).length} houses left · ${G.year}/${G.month} · ${bad} inconsistencies · ${Date.now() - t0} ms`);
}

// a player's battle: units, phases, attacks, strategies and the end
{
  const G = C.newGame({ scenario: '190', player: 'cao', seed: 7 });
  const src = G.cities.find((c) => c.name === '陳留'), dst = G.cities.find((c) => c.name === '濮陽');
  const B = C.battleSetup(G, { af: 'cao', from: src.id, to: dst.id, atkOfficers: C.officersIn(G, src) });
  ok('a battle sets up', B.units.length >= 3 && B.units.some((u) => u.side === 'atk' && u.commander) && B.units.some((u) => u.side === 'def' && u.commander), `${B.units.filter((u) => u.side === 'atk').length} vs ${B.units.filter((u) => u.side === 'def').length}`);
  const u = B.units.find((x) => x.side === 'atk'), r = BT.reach(B, u);
  ok('units can move', r.size > 5, `${r.size} tiles`);
  C.autoBattle(B);
  const lvBefore = G.officers.filter((o) => o.fac === 'cao').map((o) => o.lv);
  const res = C.settle(G, B);
  ok('the battle ends and settles', !!B.over && res && typeof res.atkWon === 'boolean', `${B.over} by ${B.why} on turn ${B.turn}`);
}
// strategies respect terrain: no fire on water, floods need water
{
  const m = makeField({ theme: 'river', seed: 3 });
  const wet = m.tiles.findIndex((t) => t.t === 'river' || t.t === 'shoal'), dry = m.tiles.findIndex((t) => t.t === 'plain' || t.t === 'grass');
  const B = { map: m, units: [] }, u = { x: 0, y: 0 };
  ok('fire will not burn on water', !BT.terrainOk(B, u, 'huoji', wet % m.w, Math.floor(wet / m.w)) && BT.terrainOk(B, u, 'huoji', dry % m.w, Math.floor(dry / m.w)));
}
// levels grow stats and promote
{
  const o = { name: '測試', lead: 70, war: 80, int: 50, pol: 40, cha: 60, line: 'cav', lv: 14, exp: 0, eq: {} };
  const s0 = battleStats(o); gainExp(o, 100); const s1 = battleStats(o);
  ok('level 15 promotes light cavalry', s0.tier === 0 && s1.tier === 1 && s1.hp > s0.hp, `${s0.cls[0]} → ${s1.cls[0]}, HP ${s0.hp} → ${s1.hp}`);
}
console.log(fails ? `test: ${fails} FAILED` : 'test: all passed');
process.exit(fails ? 1 : 0);
