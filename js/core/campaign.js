// The campaign (戰略): forty-five cities, the warlords of a scenario, their officers, and the months passing.
// Every officer does one thing a month (farm, trade, walls, drafting, training, searching, recruiting, moving).
// Wars are fought on the battlefield: the player's in core/battle.js with the player in charge, the AI's against
// each other in the same rules, fought out by the AI on both sides.
import { CITIES, ROADS } from '../data/world.js';
import { GENERALS_RAW } from '../data/generals.js';
import { SCEN } from '../data/scenarios.js';
import { PREFER } from '../data/allegiance.js';
import { ITEMS as TREASURE_RAW, HIDDEN } from '../data/treasures.js';
import { USABLES, GEAR, LINES } from '../data/rules.js';
import { RELICS, rollRelic } from '../data/relics.js';
import { pickLine, startLevel, defaultGear, battleStats, gainExp, TREASURES, itemDef, fits } from './officer.js';
import { makeField, themeFor, rng } from './mapgen.js';
import { createBattle, aiPhase, endPhase, alive, addTower } from './battle.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
export const MAX_DEPLOY = 10;
// the month's dice: rebuilt from the seed so a saved game carries only numbers
export const dice = (G, salt = 0) => rng((G.seed + G.t * 7919 + salt * 104729 + (G.roll = (G.roll || 0) + 1) * 31) >>> 0);

// ---------------------------------------------------------------- a new game
export function newGame({ scenario = '190', player = 'cao', seed = (Date.now() & 0x7fffffff) } = {}) {
  const S = SCEN[scenario] || SCEN['190'], start = S.year, r = rng(seed);
  const G = { v: 1, seed, t: 0, scenario: S.id, year: start, month: 1, player, log: [], captives: [], bag: { dou: 6, mai: 2, jiu: 2, yao: 2 }, over: null, stats: { won: 0, lost: 0, taken: 0 }, roll: 0 };
  G.cities = CITIES.map(([name, x, y, size], id) => ({ id, name, x, y, size, adj: [], owner: null,
    gold: 400 + size * 300, food: 4000 + size * 3000, troops: 0, farm: 120 + size * 90 + Math.round(r() * 60), trade: 100 + size * 90 + Math.round(r() * 60), wall: 150 + size * 120,
    farmMax: 300 + size * 250, tradeMax: 300 + size * 250, wallMax: 400 + size * 250 }));
  const byName = Object.fromEntries(G.cities.map((c) => [c.name, c]));
  for (const pair of ROADS.split(/\s+/).filter(Boolean)) { const [a, b] = pair.split('-').map((n) => byName[n]); a.adj.push(b.id); b.adj.push(a.id); }
  G.factions = {};
  for (const [id, name, lord, color, cities] of S.factions) {
    G.factions[id] = { id, name, lordName: lord, color, lord: null, alive: true, capital: byName[cities[0]].id };
    for (const n of cities) { const c = byName[n]; c.owner = id; c.troops = Math.round((4000 + c.size * 2500) * (0.85 + r() * 0.3)); }
  }
  for (const c of G.cities) if (!c.owner) c.troops = Math.round((1500 + c.size * 1000) * (0.8 + r() * 0.4));
  // defences: arrow towers on the walls, barricades, hidden pits, and for some great cities a moat
  for (const c of G.cities) c.fac = { tower: c.size - 1 + (r() < 0.35 ? 1 : 0), fence: c.size + (r() < 0.5 ? 1 : 0), trap: Math.floor(r() * (c.size + 1)), moat: c.size === 3 && r() < 0.55 };
  if (S.dong) for (const c of G.cities) if (c.owner === 'dong') c.troops = Math.round(c.troops * 1.3);
  // officers
  G.officers = GENERALS_RAW.trim().split('\n').map((line, id) => {
    const [name, born, died, lead, war, int, pol, cha, fac, city, kin] = line.split(',');
    return { id, name, born: +born, died: +died, lead: +lead, war: +war, int: +int, pol: +pol, cha: +cha, fac0: fac === '-' ? null : fac, home: byName[city].id, kin: kin || null,
      fac: null, city: byName[city].id, status: 'unborn', exp: 0, eq: { w: null, a: null, x: null }, done: false, merit: 0 };
  });
  // the four hidden heroes: somewhere, waiting to be found
  for (const [name, lead, war, int, pol, cha, sword] of HIDDEN) {
    const city = Math.floor(r() * G.cities.length);
    G.officers.push({ id: G.officers.length, name, born: start - 20, died: start + 80, lead, war, int, pol, cha, fac0: null, home: city, kin: 'chenfam', fac: null, city, status: 'hiddenhero', exp: 0, eq: { w: 't_' + sword, a: null, x: null }, done: false, merit: 0, hidden: true });
  }
  const byOfc = Object.fromEntries(G.officers.map((o) => [o.name, o]));
  for (const [fid, names] of Object.entries(PREFER)) for (const n of names.split(/\s+/)) if (byOfc[n]) byOfc[n].prefer = fid;
  for (const f of Object.values(G.factions)) f.lord = byOfc[f.lordName].id;
  for (const o of G.officers) {
    if (o.hidden) continue;
    if (o.died < start) { o.status = 'dead'; continue; }
    if (o.born + 16 > start) { o.status = 'unborn'; continue; }
    const fid = startFaction(G, S, o), f = fid && G.factions[fid];
    if (f) {
      const home = G.cities[o.city], mine = G.cities.filter((c) => c.owner === f.id);
      const near = mine.sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y))[0];
      o.status = 'serving'; o.fac = f.id; o.city = home.owner === f.id ? o.city : o.id === f.lord ? f.capital : near.id;
    } else o.status = 'free';
  }
  for (const f of Object.values(G.factions)) G.officers[f.lord].city = f.capital;
  // classes, levels and kit; the warlords lead as lords
  const extra = (start - 190) / 4;
  for (const o of G.officers) {
    o.line = pickLine(o); o.lv = startLevel(o, extra + (o.hidden ? 4 : 0));
    const keep = o.eq.w; o.eq = defaultGear(o, 1 + Math.floor(o.lv / 12)); if (keep) o.eq.w = keep;
  }
  for (const f of Object.values(G.factions)) { const l = G.officers[f.lord]; l.line = 'lord'; const k = l.eq.w; l.eq = defaultGear(l, 1 + Math.floor(l.lv / 12)); if (k && TREASURES[k]) l.eq.w = k; }
  // famous items go to their historical owners if they're around; otherwise they wait to be found
  G.hidden = {};
  for (const [key, , , , , holders, hideIn] of TREASURE_RAW) {
    const id = 't_' + key, it = TREASURES[id], slot = it.slot;
    const h = holders.map((x) => (Array.isArray(x) ? x : [x])).map(([n, from = 0, to = 9999]) => (start >= from && start <= to ? byOfc[n] : null)).find((o) => o && ['serving', 'free'].includes(o.status) && !(slot === 'w' ? TREASURES[o.eq.w] : TREASURES[o.eq.x]));
    if (h) h.eq[slot] = id;
    else if (hideIn) { const c = hideIn === '*' ? Math.floor(r() * G.cities.length) : byName[hideIn].id; (G.hidden[c] = G.hidden[c] || []).push(id); }
  }
  if (!G.factions[player]) G.player = Object.keys(G.factions)[0];
  G.missions = []; rollMissions(G);
  note(G, ['天下大亂，群雄並起。', 'The realm falls into chaos and warlords rise.']);
  return G;
}
function startFaction(G, S, o) {
  if (S.who && o.name in S.who) { const w = S.who[o.name]; return w !== '-' && G.factions[w] ? w : null; }
  for (const f of Object.values(G.factions)) if (f.lordName === o.name) return f.id;
  if (S.allStars) return o.fac0 && G.factions[o.fac0] ? o.fac0 : null;
  if (S.id === '190') return o.fac0 && G.factions[o.fac0] ? o.fac0 : null;
  if (o.kin) { const f = Object.values(G.factions).find((x) => { const l = G.officers.find((g) => g.name === x.lordName); return l && l.kin === o.kin; }); if (f) return f.id; }
  const pre = o.prefer && G.factions[o.prefer] ? o.prefer : null;
  if (o.fac0) { const c = G.factions[o.fac0] ? o.fac0 : (S.carry || {})[o.fac0]; if (c && c !== '-' && G.factions[c]) return pre || c; }
  return pre;
}

// ---------------------------------------------------------------- looking things up
export const note = (G, text, fac = null) => { G.log.push({ y: G.year, m: G.month, text, fac }); if (G.log.length > 300) G.log.shift(); };
export const citiesOf = (G, fid) => G.cities.filter((c) => c.owner === fid);
export const officersOf = (G, fid) => G.officers.filter((o) => o.status === 'serving' && o.fac === fid);
export const officersIn = (G, c) => G.officers.filter((o) => o.status === 'serving' && o.city === c.id && o.fac === c.owner);
export const freeIn = (G, c) => G.officers.filter((o) => o.status === 'free' && o.city === c.id);
export const lordOf = (G, fid) => G.officers[G.factions[fid].lord];
export const isLord = (G, o) => !!o.fac && G.factions[o.fac] && G.factions[o.fac].lord === o.id;
export const capOf = (c) => 6000 + c.size * 6000;
const quality = (o) => (o.lead + o.war + o.int * 0.6) / 2.6 + o.lv * 2;
export const cityPower = (G, c) => { const os = officersIn(G, c).sort((a, b) => quality(b) - quality(a)).slice(0, 8); return (c.troops + 600) * (1 + sum(os, quality) / 300) * (1 + c.wall / 1500); };
export const factionPower = (G, fid) => sum(citiesOf(G, fid), (c) => cityPower(G, c));
export const maxTroops = (o) => battleStats(o).hp;

// ---------------------------------------------------------------- the month's commands (each officer once)
// returns [ok, message] — the UI shows the message
export const COMMANDS = {
  farm: { name: ['開墾', 'Farm'], cost: 50, desc: ['提升農業：每月收穫更多糧食（政治越高越好）', 'Raise farming: more food each month (Politics)'] },
  trade: { name: ['商業', 'Trade'], cost: 50, desc: ['提升商業：每月收入更多金錢（政治越高越好）', 'Raise commerce: more gold each month (Politics)'] },
  wall: { name: ['城防', 'Walls'], cost: 80, desc: ['修築城牆：守城戰時守軍防禦提升（統率越高越好）', 'Repair the walls: defenders fight harder in sieges (Leadership)'] },
  draft: { name: ['徵兵', 'Draft'], cost: 120, desc: ['招募士兵（統率、魅力越高招得越多）', 'Raise soldiers (Leadership, Charisma)'] },
  train: { name: ['訓練', 'Train'], cost: 0, desc: ['操練：武將獲得經驗值', 'Drill: the officer gains experience'] },
  search: { name: ['搜索', 'Search'], cost: 0, desc: ['在城中尋找人才、寶物或金錢（智力越高越好）', 'Look for talent, treasure or gold in the city (Intelligence)'] },
  build: { name: ['設施', 'Defences'], cost: 0, desc: ['修建防守設施：箭樓、拒馬、陷坑、護城河，讓守城戰更有利', 'Build defences — arrow towers, barricades, pits, a moat — to hold the city'] },
};
// defensive works: cost, how many a city can have (by size), what they do
export const FACILITIES = {
  tower: { name: ['箭樓', 'Arrow tower'], cost: 400, max: (c) => 2 + c.size * 2, desc: ['建在城牆上，敵軍接近時自動射擊；可以被攻擊摧毀', 'Built on the walls; shoots at anyone who comes near; can be torn down'] },
  fence: { name: ['拒馬', 'Barricade'], cost: 150, max: () => 8, desc: ['擺在城門前，騎兵無法通過、步兵行動緩慢', 'Set before the gates: cavalry can\'t pass and foot soldiers slow down'] },
  trap: { name: ['陷坑', 'Pit trap'], cost: 200, max: (c) => 4 + c.size * 2, desc: ['埋在城門附近，踩到的敵軍損兵 15% 並停下', 'Hidden near the gates: an attacker who steps in loses 15% and stops'] },
  moat: { name: ['護城河', 'Moat'], cost: 1200, max: () => 1, desc: ['環繞城牆的河，只能從城門前的橋進攻', 'Water around the walls: attackers must cross at the gates'] },
};
export const facCount = (c, k) => (k === 'moat' ? (c.fac.moat ? 1 : 0) : c.fac[k] || 0);
export function build(G, o, what) {
  const c = G.cities[o.city], F = FACILITIES[what];
  if (o.done) return [false, ['這位武將本月已經行動過了', 'Already busy this month']];
  if (facCount(c, what) >= F.max(c)) return [false, ['已經蓋滿了', 'Already at the limit']];
  if (c.gold < F.cost) return [false, ['金錢不足', 'Not enough gold']];
  c.gold -= F.cost; o.done = true;
  if (what === 'moat') c.fac.moat = true; else c.fac[what] = (c.fac[what] || 0) + 1;
  return [true, [`修建了${F.name[0]}（${facCount(c, what)}/${F.max(c)}）`, `Built: ${F.name[1]} (${facCount(c, what)}/${F.max(c)})`]];
}
export function doCommand(G, o, cmd) {
  const c = G.cities[o.city], C = COMMANDS[cmd], r = dice(G, o.id);
  if (o.done) return [false, ['這位武將本月已經行動過了', 'Already busy this month']];
  if (c.gold < C.cost) return [false, ['金錢不足', 'Not enough gold']];
  c.gold -= C.cost; o.done = true;
  let msg;
  if (cmd === 'farm') { const n = Math.round(6 + o.pol * 0.22 + r() * 6); c.farm = Math.min(c.farmMax, c.farm + n); msg = [`農業 +${n}（${c.farm}/${c.farmMax}）`, `Farming +${n} (${c.farm}/${c.farmMax})`]; }
  else if (cmd === 'trade') { const n = Math.round(6 + o.pol * 0.22 + r() * 6); c.trade = Math.min(c.tradeMax, c.trade + n); msg = [`商業 +${n}（${c.trade}/${c.tradeMax}）`, `Commerce +${n} (${c.trade}/${c.tradeMax})`]; }
  else if (cmd === 'wall') { const n = Math.round(8 + o.lead * 0.25 + r() * 8); c.wall = Math.min(c.wallMax, c.wall + n); msg = [`城防 +${n}（${c.wall}/${c.wallMax}）`, `Walls +${n} (${c.wall}/${c.wallMax})`]; }
  else if (cmd === 'draft') { const n = Math.min(capOf(c) - c.troops, Math.round(350 + o.lead * 6 + o.cha * 5 + r() * 200)); if (n <= 0) { c.gold += C.cost; o.done = false; return [false, ['兵營已滿', 'The barracks are full']]; } c.troops += n; c.food -= Math.round(n / 10); msg = [`徵得士兵 ${n} 人（${c.troops}）`, `Drafted ${n} soldiers (${c.troops})`]; }
  else if (cmd === 'train') { const n = Math.round(30 + o.lead * 0.3 + r() * 15), ups = gainExp(o, n); msg = [`經驗 +${n}${ups.length ? `，升到 Lv${o.lv}！` : ''}`, `EXP +${n}${ups.length ? `, now Lv${o.lv}!` : ''}`]; }
  else if (cmd === 'search') msg = search(G, o, c, r);
  return [true, msg];
}
function search(G, o, c, r) {
  const free = G.officers.filter((x) => x.city === c.id && (x.status === 'hidden' || (x.status === 'hiddenhero' && r() < 0.25)));
  const luck = 0.35 + o.int / 250;
  if (free.length && r() < luck) { const f = free[0]; f.status = 'free'; return [`發現了在野的人才：${f.name}！可以試著登用。`, `Found a talent: ${f.name}! Try to recruit them.`]; }
  const hid = G.hidden[c.id] || [];
  if (hid.length && r() < luck * 0.6) { const id = hid.shift(); G.bag[id] = (G.bag[id] || 0) + 1; return [`發現了寶物「${itemDef(id).name[0]}」！`, `Found a treasure: ${itemDef(id).name[1]}!`]; }
  if (r() < 0.45) { const n = Math.round(50 + r() * 150 + o.int); c.gold += n; return [`找到了 ${n} 金`, `Found ${n} gold`]; }
  if (r() < 0.4) { const ids = Object.keys(USABLES); const id = ids[Math.floor(r() * ids.length)]; G.bag[id] = (G.bag[id] || 0) + 1; return [`找到了「${USABLES[id].name[0]}」`, `Found ${USABLES[id].name[1]}`]; }
  return ['什麼也沒找到', 'Nothing turned up'];
}
// win over a free officer (or a captive): charisma against their pride; family follows family
export function recruitChance(G, o, t) {
  const lord = lordOf(G, o.fac);
  let p = 45 + (o.cha - t.cha) * 0.6 + (lord.cha - 70) * 0.4;
  if (t.prefer === o.fac) p += 30;
  if (t.kin && officersOf(G, o.fac).some((x) => x.kin === t.kin)) p += 40;
  if (t.captiveOf) p -= 15;
  if (t.fac && G.factions[t.fac] && G.factions[t.fac].alive && isLord(G, t)) p = 0;
  return clamp(Math.round(p), 0, 95);
}
export function recruit(G, o, t) {
  if (o.done) return [false, ['這位武將本月已經行動過了', 'Already busy this month']];
  o.done = true;
  if (dice(G, t.id)() * 100 < recruitChance(G, o, t)) { join(G, t, o.fac, o.city); return [true, [`${t.name} 答應加入！`, `${t.name} agrees to join!`]]; }
  return [true, [`${t.name} 拒絕了……`, `${t.name} refuses…`]];
}
function join(G, t, fid, cityId) { t.status = 'serving'; t.fac = fid; t.city = cityId; t.done = true; delete t.captiveOf; G.captives = G.captives.filter((x) => x !== t.id); }
export function moveOfficer(G, o, to) {
  const c = G.cities[o.city], d = G.cities[to];
  if (o.done || d.owner !== o.fac || !c.adj.includes(to)) return [false, ['不能移動到那裡', 'Can\'t move there']];
  o.city = to; o.done = true; return [true, [`${o.name} 前往 ${d.name}`, `${o.name} leaves for ${d.name}`]];
}
export function transport(G, from, to, { gold = 0, food = 0, troops = 0 }) {
  const c = G.cities[from], d = G.cities[to];
  gold = clamp(gold, 0, c.gold); food = clamp(food, 0, c.food); troops = clamp(troops, 0, Math.min(c.troops, capOf(d) - d.troops));
  c.gold -= gold; d.gold += gold; c.food -= food; d.food += food; c.troops -= troops; d.troops += troops;
  return [true, [`運送了 金${gold} 糧${food} 兵${troops}`, `Sent ${gold} gold, ${food} food, ${troops} troops`]];
}
// buy at a city's market
export function buy(G, c, id) { const it = USABLES[id] || GEAR[id]; if (!it || c.gold < it.price) return false; c.gold -= it.price; G.bag[id] = (G.bag[id] || 0) + 1; return true; }
export function shopOf(G, c) {
  const t = Math.min(5, 1 + Math.floor(c.trade / 250) + Math.floor((G.year - 190) / 12));
  return [...Object.keys(USABLES), ...Object.values(GEAR).filter((g) => g.tier <= t && (g.slot !== 'x' || c.size >= 2)).map((g) => g.id)];
}
export function equip(G, o, id) {
  const it = itemDef(id); if (!it || !G.bag[id] || !fits(o, it)) return false;
  const old = o.eq[it.slot]; if (old) G.bag[old] = (G.bag[old] || 0) + 1;
  G.bag[id]--; if (!G.bag[id]) delete G.bag[id]; o.eq[it.slot] = id; return true;
}
export function unequip(G, o, slot) { const id = o.eq[slot]; if (!id) return; G.bag[id] = (G.bag[id] || 0) + 1; o.eq[slot] = null; }

// ---------------------------------------------------------------- war
// the armies for a battle: who marches, with how many soldiers each
export function muster(G, c, officers, pool = c.troops, chosen = null) {
  // the player's own choice of how many each leads
  if (chosen) return officers.slice(0, MAX_DEPLOY).map((o) => ({ o, troops: Math.max(100, Math.min(maxTroops(o), chosen[o.id] ?? 100)) }));
  const list = officers.slice(0, MAX_DEPLOY), out = []; let left = pool;
  const need = list.map((o) => maxTroops(o)), total = sum(need, (x) => x), k = total ? Math.min(1, pool / total) : 0;
  list.forEach((o, i) => { const n = Math.max(100, Math.floor(need[i] * k / 10) * 10); out.push({ o, troops: Math.min(n, left) || 100 }); left -= Math.min(n, left); });
  return out;
}
// militia for a city with no officers: nameless captains so there is still a fight
export function militia(G, c) {
  const n = clamp(Math.round(c.troops / 1200), 2, 6), r = dice(G, c.id), lv = clamp(Math.round(3 + (G.year - 190) / 3 + c.size * 2), 2, 25), out = [];
  const lines = ['inf', 'arch', 'bandit', 'inf', 'cav', 'strat'];
  for (let i = 0; i < n; i++) {
    const o = { id: -1 - i, name: i === 0 ? '守將' : ['守備兵', '弓手隊', '鄉勇', '民兵', '騎兵隊', '謀士'][i % 6], lead: 45 + Math.round(r() * 20), war: 45 + Math.round(r() * 20), int: 35 + Math.round(r() * 25), pol: 30, cha: 30, line: lines[i % lines.length], lv, exp: 0, militia: true };
    o.eq = defaultGear(o, 1 + Math.floor(lv / 12)); out.push(o);
  }
  return out;
}
// the battlefield for an attack on city c
export function fieldFor(G, c, seed) { return makeField({ theme: themeFor(c), seed, siege: true, w: 24, h: 18, defense: c.fac || {} }); }
// set up a battle: attackers from city `from` (faction af), defenders in city `to`
export function battleSetup(G, { af, from, to, atkOfficers, defOfficers, atkTroops, defTroops, seed = G.seed + G.t * 13 + to }) {
  const src = G.cities[from], dst = G.cities[to], df = dst.owner;
  const defs = defOfficers && defOfficers.length ? defOfficers : (officersIn(G, dst).length ? officersIn(G, dst).sort((a, b) => quality(b) - quality(a)).slice(0, MAX_DEPLOY) : militia(G, dst));
  const atkM = muster(G, src, atkOfficers, Math.round(src.troops * 0.85), atkTroops);
  const defM = muster(G, dst, defs, dst.troops || 1500, defOfficers && defOfficers.length ? defTroops : null);
  const map = fieldFor(G, dst, seed);
  const pl = G.player;
  const defLeadIdx = Math.max(0, defM.findIndex((m) => isLord(G, m.o)));
  const atkLeadIdx = Math.max(0, atkM.findIndex((m) => isLord(G, m.o)));
  const B = createBattle({ map, seed, limit: 30,
    atk: { fac: af, name: G.factions[af].name, color: G.factions[af].color, player: af === pl, units: atkM.map((m, i) => ({ ...m, commander: i === atkLeadIdx })) },
    def: { fac: df, name: df ? G.factions[df].name : '守軍', color: df ? G.factions[df].color : '#8a8a7a', player: !!df && df === pl, units: defM.map((m, i) => ({ ...m, commander: i === defLeadIdx, mode: i === defLeadIdx ? 'guard' : 'hold' })) } });
  // the towers on the walls
  const tlv = Math.round(4 + dst.wall / 70 + (G.year - 190) / 2);
  for (const [x, y] of map.towerSpots) addTower(B, 'def', x, y, tlv);
  // walls: the defenders on town, gates and keep stand firmer the better the city's walls
  const wb = dst.wall / 2500;
  for (const u of B.units) if (u.side === 'def') u.wallBonus = wb;
  // villages on the field sometimes hide supplies or a treasure (only the player finds them)
  const rr = dice(G, to + 5);
  map.tiles.forEach((t, i) => { if (t.t === 'village' && rr() < 0.35) map.chests.push({ x: i % map.w, y: Math.floor(i / map.w), item: rr() < 0.4 ? rollRelic(rr, rr() < 0.7 ? 1 : 2) : Object.keys(USABLES)[Math.floor(rr() * 5)], hidden: true }); });
  B.cityWall = wb; B.from = from; B.to = to; B.af = af; B.df = df;
  return B;
}
// fight it out with the AI on both sides
export function autoBattle(B) { let g = 0; while (!B.over && g++ < 200) { aiPhase(B); if (!B.over) endPhase(B); } return B; }

// after a battle: soldiers counted, the city changes hands, officers captured or fled
// returns a summary for the UI: { won (attackers), city, captured: [officers], fled, lost }
export function settle(G, B) {
  const src = G.cities[B.from], dst = G.cities[B.to], af = B.af, df = B.df, r = dice(G, 77);
  const A = B.units.filter((u) => u.side === 'atk'), D = B.units.filter((u) => u.side === 'def');
  const atkWon = B.over === 'atk', out = { atkWon, af, df, city: dst, captured: [], fled: [], atkLeft: 0, defLeft: 0 };
  const sent = sum(A, (u) => u.start), atkLeft = sum(A.filter(alive), (u) => u.hp), defLeft = sum(D.filter(alive), (u) => u.hp);
  src.troops = Math.max(0, src.troops - Math.min(src.troops, sent));
  out.atkLeft = atkLeft; out.defLeft = defLeft;
  const real = (u) => u.o && !u.o.militia && u.o.id >= 0;
  // what's left of the defences
  if (dst.fac) {
    const towers = B.units.filter((u) => u.structure && u.side === 'def'), standing = towers.filter(alive).length;
    dst.fac.tower = atkWon ? Math.max(0, standing - 1) : standing + (dst.fac.tower > towers.length ? dst.fac.tower - towers.length : 0);
    dst.fac.trap = Math.max(0, (dst.fac.trap || 0) - (B.map.sprung ? B.map.sprung.size : 0));
    if (atkWon) dst.fac.trap = 0;
  }
  if (atkWon) {
    const loot = { gold: Math.round(dst.gold * 0.5), food: Math.round(dst.food * 0.5) };
    dst.gold -= loot.gold; dst.food -= loot.food;
    // the defenders: captured, or slip away to another of their cities
    const refuge = df ? dst.adj.map((i) => G.cities[i]).filter((c) => c.owner === df) : [];
    for (const u of D.filter(real)) {
      const o = u.o, p = (u.gone ? 0.45 : 0.25) - (isLord(G, o) ? 0.1 : 0);
      if (!refuge.length || r() < p) { capture(G, o, af); out.captured.push(o); }
      else { const to = refuge[Math.floor(r() * refuge.length)]; o.city = to.id; to.troops += alive(u) ? Math.round(u.hp * 0.5) : 0; out.fled.push(o); }
    }
    // officers who stayed in the city without fighting flee too (or are taken)
    if (df) for (const o of officersIn(G, dst)) {
      if (!refuge.length || r() < 0.3) { capture(G, o, af); out.captured.push(o); } else { o.city = refuge[Math.floor(r() * refuge.length)].id; out.fled.push(o); }
    }
    dst.owner = af; dst.troops = Math.min(capOf(dst), atkLeft); src.gold += loot.gold; dst.gold += 0; out.loot = loot;
    for (const u of A.filter((x) => real(x))) { u.o.city = alive(u) ? dst.id : src.id; u.o.merit += alive(u) ? 2 : 0; }
    // the winners' wounded go home; the rest hold the city
    if (!A.some((u) => alive(u) && real(u))) for (const u of A.filter(real)) u.o.city = dst.id;
    note(G, [`${G.factions[af].name}軍攻下了${dst.name}！`, `${G.factions[af].name}'s army takes ${dst.name}!`], af);
    if (df) checkFall(G, df, af);
  } else {
    // the defenders who fought come back to the barracks, alongside those who never left them
    const defSent = sum(D.filter((u) => !u.structure), (u) => u.start);
    dst.troops = Math.min(capOf(dst), defLeft + Math.max(0, dst.troops - defSent));
    // routed attackers: some taken prisoner by the defenders
    for (const u of A.filter(real)) { u.o.city = src.id; if (u.gone && df && r() < 0.2 && !isLord(G, u.o)) { capture(G, u.o, df); out.captured.push(u.o); } }
    src.troops = Math.min(capOf(src), src.troops + Math.round(atkLeft * 0.9));
    note(G, [`${dst.name}守住了${G.factions[af].name}軍的進攻。`, `${dst.name} holds against ${G.factions[af].name}.`], df);
  }
  // what the player's units picked up on the field
  out.loot = [];
  for (const id of B.loot || []) { G.bag[id] = (G.bag[id] || 0) + 1; out.loot.push(id); }
  // bounty: the player picks up the odd item from the field
  if ((atkWon ? af : df) === G.player) {
    const fortune = B.units.filter((u) => u.side === (af === G.player ? 'atk' : 'def') && u.s.fx && u.s.fx.gold).reduce((m, u) => Math.max(m, u.s.fx.gold), 0);
    if (fortune && out.loot) { const g = Math.round((300 + dst.size * 200) * fortune / 100); (atkWon ? dst : dst).gold += g; out.fortune = g; }
    if (r() < 0.25 + dst.size * 0.1) { const id = rollRelic(r, Math.min(4, 1 + Math.floor(r() * (1 + dst.size)))); G.bag[id] = (G.bag[id] || 0) + 1; out.loot.push(id); }
    const n = 1 + Math.floor(r() * 3), pool = Object.values(GEAR).filter((g) => g.tier <= 2 + Math.floor((G.year - 188) / 8));
    out.items = [];
    for (let i = 0; i < n; i++) { const id = r() < 0.6 ? Object.keys(USABLES)[Math.floor(r() * 5)] : pool[Math.floor(r() * pool.length)].id; G.bag[id] = (G.bag[id] || 0) + 1; out.items.push(id); }
  }
  for (const u of B.units) if (u.o && !u.o.militia) u.o.done = true;
  if (af === G.player) G.stats[atkWon ? 'won' : 'lost']++;
  if (df === G.player) G.stats[atkWon ? 'lost' : 'won']++;
  checkOver(G);
  return out;
}
function capture(G, o, by) {
  o.status = 'captive'; o.captiveOf = by; o.fromFac = o.fac; o.fac = null;
  // their famous items are spoils of war
  if (by === G.player) { G.captives.push(o.id); for (const s of ['w', 'x']) { const id = o.eq[s]; if (id && TREASURES[id]) { G.bag[id] = (G.bag[id] || 0) + 1; o.eq[s] = null; } } }
}
// the player decides a captive's fate: 'join' (try to win them over), 'free', 'kill'
export function judge(G, o, how) {
  G.captives = G.captives.filter((x) => x !== o.id);
  const lord = lordOf(G, G.player);
  if (how === 'join') {
    const p = recruitChance(G, { ...lord, fac: G.player, cha: lord.cha }, o);
    if (dice(G, o.id)() * 100 < p) { join(G, o, G.player, G.factions[G.player].capital); o.city = citiesOf(G, G.player)[0].id; return [true, [`${o.name} 歸順了！`, `${o.name} joins you!`]]; }
    how = 'free';
    release(G, o); return [false, [`${o.name} 不肯投降，被釋放了。`, `${o.name} will not yield, and is set free.`]];
  }
  if (how === 'kill') { o.status = 'dead'; note(G, [`${o.name} 被處斬。`, `${o.name} is executed.`]); return [true, [`${o.name} 被處斬了。`, `${o.name} has been executed.`]]; }
  release(G, o); return [true, [`釋放了 ${o.name}。`, `${o.name} is released.`]];
}
function release(G, o) {
  const f = o.fromFac && G.factions[o.fromFac];
  if (f && f.alive && citiesOf(G, f.id).length) { o.status = 'serving'; o.fac = f.id; o.city = citiesOf(G, f.id)[0].id; }
  else { o.status = 'free'; o.fac = null; }
  delete o.captiveOf;
}
// a faction with no cities falls; one whose lord is gone gets an heir
function checkFall(G, fid, by) {
  const f = G.factions[fid];
  if (!citiesOf(G, fid).length) {
    f.alive = false;
    for (const o of officersOf(G, fid)) { o.status = 'free'; o.fac = null; }
    note(G, [`${f.name}勢力滅亡了。`, `${f.name}'s house has fallen.`], by);
  }
}
function heir(G, fid) {
  const f = G.factions[fid], l = G.officers[f.lord];
  if (l.status === 'serving' && l.fac === fid) return;
  const cands = officersOf(G, fid).sort((a, b) => (b.kin && b.kin === l.kin ? 100 : 0) + b.cha + b.lead - ((a.kin && a.kin === l.kin ? 100 : 0) + a.cha + a.lead));
  if (!cands.length) { for (const c of citiesOf(G, fid)) c.owner = null; f.alive = false; note(G, [`${f.name}勢力瓦解了。`, `${f.name}'s house breaks apart.`]); return; }
  const n = cands[0]; f.lord = n.id; f.name = n.name; f.lordName = n.name; n.line = 'lord';
  const k = n.eq.w; n.eq = { ...defaultGear(n, 1 + Math.floor(n.lv / 12)), x: n.eq.x }; if (k && TREASURES[k]) n.eq.w = k;
  note(G, [`${n.name} 繼承了勢力。`, `${n.name} takes over the house.`], fid);
}
export function checkOver(G) {
  for (const f of Object.values(G.factions)) if (f.alive) heir(G, f.id);
  const mine = citiesOf(G, G.player).length;
  if (!mine || !G.factions[G.player].alive) G.over = 'lose';
  else if (mine === G.cities.length || Object.values(G.factions).every((f) => f.id === G.player || !f.alive)) G.over = 'win';
  return G.over;
}

// ---------------------------------------------------------------- the end of the month
// income and upkeep, AI turns, and the attacks that the player must answer: returns { threats: [battleSetup args] }
export function endMonth(G, { autoPlayer = false } = {}) {
  const threats = [];
  // AI warlords (and, for tests, the player's own house)
  for (const f of Object.values(G.factions)) if (f.alive && (f.id !== G.player || autoPlayer)) { if (f.id === G.player) for (const o of officersOf(G, f.id)) o.done = false; aiTurn(G, f, threats); }
  // the months turn
  G.t++; G.month++; if (G.month > 12) { G.month = 1; G.year++; newYear(G); }
  for (const c of G.cities) {
    c.gold += Math.round(c.trade * 0.35 + 30);
    c.food += Math.round(c.farm * (G.month === 7 ? 6 : 0.6));
    c.food -= Math.round(c.troops / 60);
    if (c.food < 0) { c.troops = Math.round(c.troops * 0.9); c.food = 0; }
    if (!c.owner) c.troops = Math.min(capOf(c) * 0.5, c.troops + 100);
  }
  for (const o of G.officers) o.done = false;
  rollMissions(G);
  return { threats };
}
function newYear(G) {
  // young talents come of age where they were born
  for (const o of G.officers) if (o.status === 'unborn' && o.born + 16 <= G.year && o.died > G.year) { o.status = 'hidden'; o.city = o.home; o.line = pickLine(o); o.lv = startLevel(o, (G.year - 190) / 4); o.eq = defaultGear(o, 1 + Math.floor(o.lv / 12)); }
}
function aiTurn(G, f, threats) {
  const r = dice(G, f.id.length * 97 + f.id.charCodeAt(0));
  const cities = citiesOf(G, f.id);
  for (const c of cities) {
    const os = officersIn(G, c);
    for (const o of os) {
      if (o.done) continue;
      const front = c.adj.some((j) => G.cities[j].owner !== f.id);
      const need = [['draft', c.troops < capOf(c) * 0.75 && c.gold > 300 ? 3 : 0], ['farm', c.farm < c.farmMax ? 1.2 : 0], ['trade', c.trade < c.tradeMax ? 1.3 : 0], ['wall', c.wall < c.wallMax ? 0.8 : 0], ['train', 0.6], ['search', 0.3], ['build', front && c.gold > 700 ? 0.9 : 0]];
      let pick = null, t = r() * sum(need, ([, w]) => w); for (const [k, w] of need) { t -= w; if (t <= 0) { pick = k; break; } }
      if (pick === 'build') { const opts = Object.keys(FACILITIES).filter((k) => facCount(c, k) < FACILITIES[k].max(c) && c.gold >= FACILITIES[k].cost + 300); if (opts.length) build(G, o, opts[Math.floor(r() * opts.length)]); else doCommand(G, o, 'train'); }
      else if (pick) doCommand(G, o, pick);
    }
    // recruit anyone free in the city
    for (const t of freeIn(G, c)) { const o = os.find((x) => !x.done); if (o && r() < 0.5) recruit(G, o, t); }
  }
  // send spare officers toward the front
  for (const c of cities) {
    const os = officersIn(G, c), front = c.adj.map((i) => G.cities[i]).filter((d) => d.owner === f.id && d.adj.some((j) => G.cities[j].owner !== f.id) && officersIn(G, d).length < 3);
    if (os.length > 4 && front.length) { const o = os.filter((x) => !isLord(G, x)).sort((a, b) => quality(a) - quality(b))[0]; if (o) { o.city = front[0].id; o.done = true; } }
  }
  // captives: try to win them over, else let them go
  for (const o of G.officers.filter((x) => x.status === 'captive' && x.captiveOf === f.id)) { if (r() < 0.4 && !isLord(G, o)) join(G, o, f.id, cities[0].id); else release(G, o); }
  // war: at most one campaign a month, against a clearly weaker neighbour
  if (r() < 0.55) {
    let best = null;
    for (const c of cities) {
      const os = officersIn(G, c).filter((o) => !o.done || true);
      if (os.length < 2 || c.troops < 3500) continue;
      for (const j of c.adj) {
        const d = G.cities[j]; if (d.owner === f.id) continue;
        const ratio = cityPower(G, c) * 0.8 / Math.max(1, cityPower(G, d));
        const want = ratio * (d.owner === G.player ? 0.9 : 1) * (d.owner ? 1 : 1.3) + r() * 0.3;
        if (ratio > 1.25 && (!best || want > best.want)) best = { want, c, d };
      }
    }
    if (best) {
      const { c, d } = best, os = officersIn(G, c).sort((a, b) => quality(b) - quality(a));
      const lord = os.find((o) => isLord(G, o)), go = os.filter((o) => o !== lord).slice(0, Math.min(MAX_DEPLOY - 1, os.length - 1));
      if (!go.length && lord) go.push(lord);
      if (go.length) {
        const args = { af: f.id, from: c.id, to: d.id, atkOfficers: go };
        if (d.owner === G.player) threats.push(args);
        else { const B = battleSetup(G, args); autoBattle(B); settle(G, B); }
      }
    }
  }
}
// older saves: fill in what newer versions added
export function migrate(G) {
  for (const c of G.cities) if (!c.fac) c.fac = { tower: c.size - 1, fence: c.size, trap: 0, moat: false };
  if (!G.missions) rollMissions(G);
  return G;
}
// ---------------------------------------------------------------- training missions (鍛鍊任務)
// field battles against bandits, rebels and champions: experience for the officers who go, gold, chests and a treasure
export const MISSION_KINDS = {
  bandit:   { name: ['討伐山賊', 'Bandit Hunt'], desc: ['山賊盤據山林，劫掠商旅。全滅他們。', 'Bandits hold the hills and rob the roads. Wipe them out.'], goal: 'rout', lines: ['bandit', 'bandit', 'arch', 'inf', 'bandit', 'cav', 'bandit', 'arch'], names: ['山賊頭目', '山賊', '弓手', '嘍囉', '盜匪', '馬賊', '山賊', '弓手'], themes: ['shu', 'plains', 'north'] },
  yellow:   { name: ['剿滅黃巾', 'Yellow Turban Remnants'], desc: ['黃巾餘黨又在作亂，擊敗他們的渠帥。', 'Yellow Turban remnants are rising again. Defeat their chieftain.'], goal: 'leader', lines: ['taoist', 'inf', 'bandit', 'taoist', 'arch', 'inf', 'bandit', 'inf'], names: ['黃巾渠帥', '黃巾力士', '黃巾賊', '黃巾道士', '黃巾弓手', '黃巾兵', '黃巾賊', '黃巾兵'], themes: ['plains', 'north', 'south'] },
  tribes:   { name: ['平定蠻族', 'Pacify the Tribes'], desc: ['南方的部族騷擾邊境。他們熟悉山林，小心。', 'Southern tribes raid the border. They know the forests — beware.'], goal: 'rout', lines: ['brawl', 'brawl', 'bandit', 'arch', 'brawl', 'hbow', 'bandit', 'brawl'], names: ['蠻王', '藤甲兵', '蠻兵', '毒箭手', '蠻兵', '蠻騎', '蠻兵', '藤甲兵'], themes: ['jungle', 'south'] },
  raiders:  { name: ['擊退賊騎', 'Drive Off Raiders'], desc: ['塞外的騎兵來去如風。用步兵與弓兵擋住他們。', 'Riders from beyond the wall strike like the wind. Meet them with spears and bows.'], goal: 'rout', lines: ['cav', 'hbow', 'cav', 'hbow', 'cav', 'cav', 'hbow', 'cav'], names: ['賊騎首領', '賊騎', '胡騎', '騎射手', '賊騎', '胡騎', '騎射手', '賊騎'], themes: ['frontier', 'west'] },
  champion: { name: ['猛將試煉', 'Trial of Champions'], desc: ['一位無名猛將向天下英雄挑戰。擊敗他，奪下他的神兵。', 'A nameless champion challenges every hero in the land. Beat him and take his weapon.'], goal: 'leader', champion: true, lines: ['cav', 'inf', 'inf', 'arch', 'arch', 'inf'], names: ['無名猛將', '親衛', '親衛', '弓衛', '弓衛', '親衛'], themes: ['plains', 'north', 'river'] },
  pirates:  { name: ['水賊討伐', 'River Pirates'], desc: ['江上的水賊打劫往來船隻，佔據河岸。渡河擊潰他們。', 'River pirates rob the boats and hold the banks. Cross over and break them.'], goal: 'rout', lines: ['bandit', 'arch', 'bandit', 'arch', 'bandit', 'hbow', 'arch', 'bandit'], names: ['水賊頭目', '水賊弓手', '水賊', '弩手', '水賊', '水寨騎兵', '弓手', '水賊'], themes: ['river'] },
  sorcery:  { name: ['妖術師作亂', 'Sorcerers'], desc: ['妖人以邪術蠱惑百姓，會用混亂、中毒、封殺。擊敗為首的妖術師。', 'Sorcerers bewitch the people with confusion, poison and silence. Defeat their master.'], goal: 'leader', lines: ['taoist', 'taoist', 'inf', 'taoist', 'bandit', 'strat', 'inf', 'taoist'], names: ['妖術師', '妖道', '信徒', '巫女', '狂信者', '術士', '信徒', '妖道'], themes: ['jungle', 'shu', 'south'], int: 85 },
  qiang:    { name: ['西羌入寇', 'Qiang Incursion'], desc: ['羌族騎兵越過邊塞，在荒原上縱橫馳騁。', 'Qiang horsemen pour over the frontier and ride across the wastes.'], goal: 'rout', lines: ['hbow', 'cav', 'hbow', 'cav', 'brawl', 'hbow', 'cav', 'hbow'], names: ['羌王', '羌騎', '羌弓騎', '羌騎', '羌勇士', '羌弓騎', '羌騎', '羌弓騎'], themes: ['west', 'frontier'] },
  shanyue:  { name: ['山越叛亂', 'Shanyue Revolt'], desc: ['山越據險而守，熟悉山林，伏兵四起。', 'The Shanyue hold the high ground; they know every hill and spring ambushes.'], goal: 'leader', lines: ['bandit', 'brawl', 'arch', 'bandit', 'brawl', 'arch', 'bandit', 'brawl'], names: ['山越首領', '山越勇士', '山越弓手', '山越兵', '山越勇士', '山越弓手', '山越兵', '山越勇士'], themes: ['south', 'shu', 'jungle'] },
  defend:   { name: ['守衛村莊', 'Defend the Village'], desc: ['盜匪要來洗劫村莊。守住 10 回合，敵人會從兩側不斷增援。', 'Raiders are coming for the village. Hold for 10 turns as they keep coming from both sides.'], goal: 'survive', layout: 'center', limit: 10, waves: [3, 6], lines: ['bandit', 'cav', 'bandit', 'arch', 'inf', 'bandit', 'cav', 'arch'], names: ['盜匪頭目', '馬賊', '盜匪', '弓手', '流寇', '盜匪', '馬賊', '弓手'], themes: ['plains', 'north', 'south'] },
  escort:   { name: ['護送糧隊', 'Escort the Supplies'], desc: ['糧車在路上被伏擊了！保護糧車撐過 8 回合，糧車被毀就失敗。', 'The supply wagons are ambushed! Keep the wagon alive for 8 turns — if it falls, the mission fails.'], goal: 'survive', layout: 'center', limit: 8, vip: true, waves: [3, 5], lines: ['bandit', 'cav', 'arch', 'bandit', 'cav', 'bandit', 'arch', 'cav'], names: ['伏兵首領', '伏兵騎', '伏兵弓手', '伏兵', '伏兵騎', '伏兵', '伏兵弓手', '伏兵騎'], themes: ['plains', 'north', 'shu', 'west'] },
  legend:   { name: ['傳說之將', 'A Legend Returns'], desc: ['古戰場上出現了傳說中的名將之魂，只有真正的英雄能擊敗他。勝者可得神器。', 'The spirit of a legendary general walks an old battlefield. Only a true hero can beat him — and claim a legendary treasure.'], goal: 'leader', legend: true, lines: ['cav', 'inf', 'inf', 'arch', 'arch', 'cav', 'inf', 'arch'], names: ['?', '親衛', '親衛', '弓衛', '弓衛', '騎衛', '親衛', '弓衛'], themes: ['plains', 'north', 'river'], rare: true },
  drill:    { name: ['演武場', 'Training Ground'], desc: ['和軍中的精兵對練。沒有寶物，但經驗加倍，隨時可以來。', 'Spar with picked troops of your own army. No treasure, but double experience — come any time.'], goal: 'rout', lines: ['inf', 'cav', 'arch', 'strat', 'inf', 'hbow', 'cav', 'taoist'], names: ['教頭', '騎兵教官', '弓術教官', '軍師教官', '步兵教官', '騎射教官', '騎兵教官', '道術教官'], themes: ['plains', 'north', 'south', 'shu', 'west', 'frontier'], hidden: true },
  treasure: { name: ['尋寶探險', 'Treasure Hunt'], desc: ['古墓裡藏著前朝的寶物，盜墓賊也在找。搶先打開寶箱！', 'An old tomb hides treasures of a fallen dynasty, and grave robbers are after them too. Get to the chests first!'], goal: 'rout', chests: 5, lines: ['strat', 'bandit', 'arch', 'bandit', 'inf', 'bandit', 'arch', 'bandit'], names: ['盜墓賊首', '盜墓賊', '弩手', '盜墓賊', '守墓人', '盜墓賊', '弩手', '盜墓賊'], themes: ['shu', 'west', 'jungle', 'south'] },
};
export function rollMissions(G) {
  const r = dice(G, 991), mine = citiesOf(G, G.player); if (!mine.length) { G.missions = []; return; }
  const offs = officersOf(G, G.player).sort((a, b) => b.lv - a.lv).slice(0, 6), avg = offs.length ? offs.reduce((s2, o) => s2 + o.lv, 0) / offs.length : 5;
  const kinds = Object.keys(MISSION_KINDS).filter((k) => !MISSION_KINDS[k].hidden && !MISSION_KINDS[k].rare), out = [];
  for (let i = 0; i < 6; i++) {
    const kind = i === 5 && r() < 0.2 ? 'legend' : kinds[Math.floor(r() * kinds.length)], K = MISSION_KINDS[kind], stars = kind === 'legend' ? 5 : 1 + Math.floor(r() * 5);
    const c = mine[Math.floor(r() * mine.length)];
    out.push({ id: `${G.t}-${i}`, kind, city: c.id, stars, lv: Math.max(1, Math.round(avg + (stars - 3) * 3 + (kind === 'legend' ? 4 : 0))), foes: Math.min(K.lines.length, 3 + stars), gold: 150 * stars + Math.round(r() * 100), rarity: Math.min(5, Math.max(1, stars - (r() < 0.5 ? 1 : 0))), theme: K.themes[Math.floor(r() * K.themes.length)], seed: Math.floor(r() * 1e9) });
  }
  G.missions = out;
}
export function missionSetup(G, m, officers) {
  const K = MISSION_KINDS[m.kind], r = rng(m.seed);
  const map = makeField({ theme: m.theme, seed: m.seed, siege: false, w: 22, h: 16 });
  const foes = [];
  for (let i = 0; i < m.foes; i++) {
    const lead = i === 0 && (K.goal === 'leader' || K.champion), lv = Math.max(1, m.lv + (lead ? (K.champion ? 6 : 2) : Math.floor(r() * 3) - 1));
    const o = { id: -1 - i, name: K.names[i], lead: 50 + Math.round(r() * 25) + (lead ? 15 : 0), war: 50 + Math.round(r() * 25) + (lead ? 20 : 0), int: K.lines[i] === 'strat' || K.lines[i] === 'taoist' ? 70 + Math.round(r() * 20) : 35 + Math.round(r() * 25), pol: 30, cha: 40 + (lead ? 30 : 0), line: K.lines[i], lv, exp: 0, militia: true };
    o.eq = defaultGear(o, Math.min(5, 1 + Math.floor(lv / 10)));
    if (K.int && !lead) o.int = K.int + Math.round(r() * 10);
    if (K.legend && i === 0) { const L = LEGENDS[Math.floor(r() * LEGENDS.length)]; Object.assign(o, L.o, { name: L.name }); o.line = L.line; o.eq = defaultGear(o, 5); o.lv = lv + 4; const w = Object.values(RELICS).filter((x) => x.rarity === 5 && fits(o, x) && x.slot === 'w'); if (w.length) { o.eq.w = w[Math.floor(r() * w.length)].id; o.drop = o.eq.w; } }
    if (K.champion && i === 0) { o.lead = 92; o.war = 98; o.int = 55; o.cha = 85; const w = Object.values(RELICS).filter((x) => x.slot === 'w' && x.type === 'spear' && x.rarity === Math.min(5, m.stars)); if (w.length) { o.eq.w = w[Math.floor(r() * w.length)].id; o.drop = o.eq.w; } }
    foes.push({ o, troops: undefined, commander: lead, mode: lead ? 'hold' : r() < 0.25 ? 'hold' : 'attack' });
  }
  const B = createBattle({ map, seed: m.seed, limit: K.limit || 20, goal: K.goal === 'leader' ? 'leader' : K.goal,
    atk: { fac: G.player, name: G.factions[G.player].name, color: G.factions[G.player].color, player: true, units: officers.slice(0, 6).map((o, i) => ({ o, troops: maxTroops(o), commander: i === 0 })) },
    def: { fac: null, name: K.name[0], color: '#6a6a5a', player: false, units: foes } });
  // the centre layout: we hold the middle, they come from both edges
  if (K.layout === 'center') {
    const cx = Math.floor(map.w / 2), cy = Math.floor(map.h / 2), ok = (x, y) => { const t = map.tiles[y * map.w + x]; return t && ['plain', 'grass', 'road', 'desert', 'snow', 'village', 'forest', 'hill'].includes(t.t); };
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 3; x <= cx + 3; x++) if (!ok(x, y)) map.tiles[y * map.w + x].t = 'plain';
    map.tiles[cy * map.w + cx].t = 'village';
    const mine = B.units.filter((u) => u.side === 'atk'), ring = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0]];
    mine.forEach((u, i) => { u.x = cx + ring[i + 1][0]; u.y = cy + ring[i + 1][1]; });
    B.units.filter((u) => u.side === 'def').forEach((u, i) => { const left = i % 2 === 0; u.x = left ? 1 : map.w - 2; u.y = Math.max(1, Math.min(map.h - 2, cy - 3 + Math.floor(i / 2) * 2)); u.dir = left ? 1 : -1; u.mode = 'attack'; });
    for (const u of B.units.filter((x) => x.side === 'def')) { let k = 0; while (B.units.some((o) => o !== u && o.x === u.x && o.y === u.y) && k++ < 10) u.y = (u.y + 1) % map.h; const t = map.tiles[u.y * map.w + u.x]; if (!['plain', 'grass', 'road', 'desert', 'snow'].includes(t.t)) t.t = 'plain'; }
    // the wagon to protect sits on the village
    if (K.vip) {
      const o = { id: -90, name: '糧車', lead: 60, war: 20, int: 20, pol: 0, cha: 50, line: 'siege', lv: Math.max(1, m.lv), exp: 0, eq: {}, militia: true };
      const s = battleStats(o); s.mov = 0; s.hp = Math.round(s.hp * 1.4);
      B.units.push({ id: B.uid++, o, side: 'atk', x: cx, y: cy, s, hp: s.hp, mp: 0, st: {}, buf: {}, moved: false, acted: false, done: false, commander: false, ai: true, mode: 'tower', structure: true, vip: true, dir: 1, start: s.hp, kills: 0 });
    }
    // reinforcements from the edges
    B.waves = (K.waves || []).map((turn, wi) => ({ turn, side: 'def', units: Array.from({ length: 2 + Math.floor(m.stars / 2) }, (_, j) => {
      const line = K.lines[(wi * 3 + j) % K.lines.length], lv = Math.max(1, m.lv + Math.floor(r() * 3) - 1);
      const o = { id: -40 - wi * 10 - j, name: K.names[(wi * 3 + j) % K.names.length], lead: 50 + Math.round(r() * 25), war: 50 + Math.round(r() * 25), int: 35 + Math.round(r() * 25), pol: 30, cha: 40, line, lv, exp: 0, militia: true };
      o.eq = defaultGear(o, Math.min(5, 1 + Math.floor(lv / 10)));
      return { o, x: j % 2 ? map.w - 2 : 1, y: Math.max(1, Math.min(map.h - 2, cy - 2 + j * 2)) };
    }) }));
  }
  // chests across the field
  const want = K.hidden ? 0 : (K.chests || 0) + 1 + Math.floor(m.stars / 2);
  const spots = map.tiles.map((t, i) => [i % map.w, Math.floor(i / map.w), t.t]).filter(([x, y, t]) => x > 4 && !['river', 'mount', 'wall', 'moat'].includes(t) && !B.units.some((u) => u.x === x && u.y === y));
  for (let i = 0; i < want && spots.length; i++) { const [x, y] = spots.splice(Math.floor(r() * spots.length), 1)[0]; map.chests.push({ x, y, item: r() < 0.55 ? rollRelic(r, Math.max(1, Math.min(5, m.rarity - (r() < 0.6 ? 1 : 0)))) : Object.keys(USABLES)[Math.floor(r() * 5)] }); }
  B.mission = m;
  return B;
}
export function settleMission(G, B, m) {
  const won = B.over === 'atk', out = { won, gold: 0, items: [], loot: [] };
  for (const id of B.loot || []) { G.bag[id] = (G.bag[id] || 0) + 1; out.loot.push(id); }
  // everyone who went learns something; more for a win and a harder mission
  out.bonus = Math.round((won ? 12 : 5) * m.stars * (m.kind === 'drill' ? 2 : 1));
  out.ups = [];
  for (const u of B.units) if (u.o && !u.o.militia && u.side === 'atk') { const before = u.o.lv; gainExp(u.o, out.bonus); if (u.o.lv > before) out.ups.push(u.o); }
  if (won && m.kind !== 'drill') {
    const c = G.cities[m.city]; out.gold = m.gold; c.gold += m.gold;
    const id = rollRelic(dice(G, 4242), m.rarity); G.bag[id] = (G.bag[id] || 0) + 1; out.items.push(id);
    const champ = B.units.find((u) => u.o.drop); if (champ) { G.bag[champ.o.drop] = (G.bag[champ.o.drop] || 0) + 1; out.items.push(champ.o.drop); }
    note(G, [`${MISSION_KINDS[m.kind].name[0]}（${'★'.repeat(m.stars)}）完成！`, `${MISSION_KINDS[m.kind].name[1]} (${m.stars}★) complete!`], G.player);
  }
  for (const u of B.units) if (u.o && !u.o.militia) u.o.done = true;
  G.missions = G.missions.filter((x) => x.id !== m.id);
  return out;
}
// the legendary generals of earlier ages, who appear in 傳說之將
export const LEGENDS = [
  { name: '西楚霸王 項羽', line: 'cav', o: { lead: 98, war: 100, int: 60, cha: 92 } },
  { name: '兵仙 韓信', line: 'strat', o: { lead: 100, war: 72, int: 98, cha: 80 } },
  { name: '殺神 白起', line: 'inf', o: { lead: 99, war: 90, int: 88, cha: 70 } },
  { name: '飛將軍 李廣', line: 'arch', o: { lead: 90, war: 96, int: 70, cha: 88 } },
  { name: '冠軍侯 霍去病', line: 'cav', o: { lead: 96, war: 95, int: 82, cha: 90 } },
  { name: '兵聖 孫武', line: 'strat', o: { lead: 100, war: 60, int: 100, cha: 85 } },
];
// the training ground: always open, at the level you choose
export function drillMission(G, cityId, lv) {
  const r = dice(G, 313), K = MISSION_KINDS.drill;
  return { id: 'drill-' + G.t + '-' + Math.floor(r() * 1e6), kind: 'drill', city: cityId, stars: Math.max(1, Math.min(5, Math.round(lv / 8))), lv, foes: 6, gold: 0, rarity: 1, theme: K.themes[Math.floor(r() * K.themes.length)], seed: Math.floor(r() * 1e9) };
}
export const avgLevel = (G) => { const offs = officersOf(G, G.player).sort((a, b) => b.lv - a.lv).slice(0, 6); return offs.length ? Math.round(offs.reduce((s2, o) => s2 + o.lv, 0) / offs.length) : 5; };
export { quality, rng, themeFor, LINES };
