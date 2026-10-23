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
  const m = makeField({ theme: th, seed: s * 31 + 7, defense: s % 2 ? { moat: true, fence: 6, trap: 6, tower: 6 } : {} });
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
// a siege with towers and a moat
{
  const G = C.newGame({ scenario: '190', player: 'cao', seed: 11 });
  const dst = G.cities.find((c) => c.name === '洛陽'), src = G.cities.find((c) => c.name === '陳留');
  dst.fac = { tower: 6, fence: 6, trap: 6, moat: true };
  const B = C.battleSetup(G, { af: 'cao', from: src.id, to: dst.id, atkOfficers: C.officersIn(G, src) });
  const towers = B.units.filter((u) => u.structure).length;
  C.autoBattle(B); const res = C.settle(G, B);
  ok('a siege with towers, moat and pits', towers >= 4 && !!B.over && B.map.tiles.some((t) => t.t === 'moat'), `${towers} towers · ${B.over} by ${B.why} on turn ${B.turn} · ${B.events.filter((e) => e.t === 'trap').length} pits sprung · towers left ${dst.fac.tower}`);
}
// training missions: every kind sets up, runs and pays out
{
  let bad = 0, wins = 0, items = 0;
  for (const kind of Object.keys(C.MISSION_KINDS)) for (let k = 0; k < 3; k++) {
    const G = C.newGame({ scenario: '190', player: 'cao', seed: 20 + k });
    const m = { ...G.missions[0], kind, id: 'x' + k, stars: 1 + k * 2, foes: 4 + k, rarity: 1 + k * 2, theme: C.MISSION_KINDS[kind].themes[0], seed: 77 + k };
    G.missions.push(m);
    const offs = C.officersIn(G, G.cities[m.city]).slice(0, 6);
    try { const B = C.missionSetup(G, m, offs); B.sides.atk.player = false; for (const u of B.units) u.ai = true; C.autoBattle(B); B.sides.atk.player = true; const r = C.settleMission(G, B, m); if (r.won) wins++; items += r.items.length + r.loot.length; if (!B.over) bad++; }
    catch (e) { bad++; console.log(e.stack); }
  }
  const n = Object.keys(C.MISSION_KINDS).length * 3;
  ok('training missions run and reward', bad === 0 && items > 0, `${Object.keys(C.MISSION_KINDS).length} kinds · ${wins}/${n} won by the AI · ${items} items · ${bad} problems`);
  // the goals behave: survival ends in victory at the time limit, the wagon's fall is a defeat
  { const G = C.newGame({ scenario: '190', player: 'cao', seed: 5 }); const m = { ...G.missions[0], kind: 'escort', id: 'e', stars: 3, foes: 5, rarity: 2, theme: 'plains', seed: 9 }; G.missions.push(m);
    const B = C.missionSetup(G, m, C.officersIn(G, G.cities[m.city]).slice(0, 4)); const vip = B.units.find((u) => u.vip); B.sides.atk.player = false; for (const u of B.units) u.ai = true; C.autoBattle(B);
    const spawned = B.events.filter((e) => e.t === 'spawn').length;
    ok('escort: waves arrive and the goal decides', !!vip && spawned >= 1 && ['time', 'vip', 'rout', 'commander'].includes(B.why), `${B.over} by ${B.why} on turn ${B.turn} · ${spawned} waves · wagon ${vip.hp}/${vip.s.hp}`); }
}
// treasures: every one fits somebody, powers apply
{
  const { RELIC_LIST } = await import('../js/data/relics.js');
  const o = { name: '測試', lead: 70, war: 80, int: 60, pol: 40, cha: 60, line: 'cav', lv: 20, exp: 0, eq: { w: 'spear2', a: 'heavy2', x: null } };
  const plain = battleStats(o); const relic = RELIC_LIST.find((x) => x.slot === 'a' && x.fx.hpPct); o.eq.a = relic.id; const withIt = battleStats(o);
  ok('500 treasures with powers', RELIC_LIST.length === 500 && new Set(RELIC_LIST.map((x) => x.name[0])).size === 500 && withIt.hp > plain.hp && withIt.fx.hpPct, `${relic.name[0]}: HP ${plain.hp} → ${withIt.hp}`);
}
// a city that holds keeps the soldiers who stayed home
{
  const G = C.newGame({ scenario: '190', player: 'cao', seed: 3 });
  const src = G.cities.find((c) => c.name === '陳留'), dst = G.cities.find((c) => c.name === '洛陽');
  dst.troops = 24000; dst.fac = { tower: 6, fence: 6, trap: 6, moat: true };
  const B = C.battleSetup(G, { af: 'cao', from: src.id, to: dst.id, atkOfficers: C.officersIn(G, src).slice(0, 2) });
  const sent = B.units.filter((u) => u.side === 'def' && !u.structure).reduce((n, u) => n + u.start, 0);
  C.autoBattle(B); C.settle(G, B);
  ok('defenders who stay home are kept', B.over !== 'def' || dst.troops >= 24000 - sent, `${B.over} · sent ${sent} of 24000 · city now ${dst.troops}`);
}
// diplomacy: a truce holds, allies help, and delegation runs the house
{
  const G = C.newGame({ scenario: '190', player: 'cao', seed: 21 });
  const o = C.officersOf(G, 'cao').sort((a, b) => b.cha - a.cha)[0];
  for (let k = 0; k < 20 && !C.pactOf(G, 'cao', 'liudai'); k++) { o.done = false; G.rel['cao|liudai'] = 80; C.envoy(G, o, 'liudai', 'truce'); }
  const truce = C.pactOf(G, 'cao', 'liudai');
  // every AI house at peace with everyone: nobody should attack across a pact
  let broken = 0;
  for (const f of Object.values(G.factions)) for (const g of Object.values(G.factions)) if (f.id < g.id) C.makePact(G, f.id, g.id, 'truce', 60);
  const owners = G.cities.map((c) => c.owner);
  for (let m = 0; m < 6; m++) C.endMonth(G, { autoPlayer: true });
  G.cities.forEach((c, i) => { if (owners[i] && c.owner !== owners[i]) broken++; });
  ok('truces hold: no one attacks a pact partner', !!truce && broken === 0, `truce until ${truce && truce.until} · ${broken} cities changed hands`);
}
{
  const G = C.newGame({ scenario: '190', player: 'liubei', seed: 22 });
  C.makePact(G, 'liubei', 'kongrong', 'ally', 24);
  const src = G.cities.find((c) => c.owner === 'liubei'), dst = G.cities[src.adj.find((j) => G.cities[j].owner && G.cities[j].owner !== 'liubei' && G.cities[j].owner !== 'kongrong')];
  let helped = 0;
  for (let k = 0; k < 8; k++) { G.roll += 3; const B = C.battleSetup(G, { af: 'liubei', from: src.id, to: dst.id, atkOfficers: C.officersIn(G, src) }); if (B.units.some((u) => u.ally)) helped++; }
  ok('allies send reinforcements', helped > 0, `${helped}/8 battles had allied help`);
}
{
  const G = C.newGame({ scenario: '195', player: 'cao', seed: 23 });
  for (const c of C.citiesOf(G, 'cao')) G.auto.cities[c.id] = true;
  G.auto.war = true; G.auto.warMode = 'bold'; G.auto.diplo = true; G.auto.defend = 'auto';
  const farm0 = C.citiesOf(G, 'cao').reduce((n, c) => n + c.farm + c.trade + c.wall, 0);
  let wars = 0, err = null;
  try { for (let m = 0; m < 12 && !G.over; m++) { const { threats, reports } = C.endMonth(G); wars += reports.filter((x) => x.kind === 'war').length; for (const t of threats) { const B = C.battleSetup(G, t); C.autoBattle(B); C.settle(G, B); } } } catch (e) { err = e; console.log(e.stack); }
  const farm1 = C.citiesOf(G, 'cao').reduce((n, c) => n + c.farm + c.trade + c.wall, 0);
  ok('delegation runs the house', !err && farm1 > farm0, `development ${farm0} → ${farm1} · ${wars} campaigns · cities ${C.citiesOf(G, 'cao').length}`);
}
console.log(fails ? `test: ${fails} FAILED` : 'test: all passed');
process.exit(fails ? 1 : 0);
