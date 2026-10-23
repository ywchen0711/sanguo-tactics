// The editor (修改): change any number in the game at any time — cities, officers, items, the date, and, in battle,
// any unit on the field. Changes apply at once; the campaign saves them when the editor closes.
import { T } from '../i18n.js';
import { el, clear, sheet, toast } from './dom.js';
import { nm, cityName } from './names.js';
import { LINES, LINE_ORDER, GEAR, USABLES, AILMENTS, tierOf } from '../data/rules.js';
import { RELICS, RARITY } from '../data/relics.js';
import { TREASURES, itemDef, battleStats } from '../core/officer.js';
import * as C from '../core/campaign.js';
import { alive, checkEnd, finish } from '../core/battle.js';

const ATTR = [['lead', '統率', 'LEAD'], ['war', '武力', 'WAR'], ['int', '智力', 'INT'], ['pol', '政治', 'POL'], ['cha', '魅力', 'CHA']];
// a labelled number box bound to obj[key]
function num(obj, key, label, { min = 0, max = 999999, step = 1, after } = {}) {
  const inp = el('input', { type: 'number', value: obj[key] ?? 0, min, max, step, onchange: (e) => { let v = Number(e.target.value); if (!Number.isFinite(v)) v = 0; v = Math.max(min, Math.min(max, v)); obj[key] = v; e.target.value = v; if (after) after(v); } });
  return el('label', { class: 'ed' }, el('span', {}, label), inp);
}
function pick(label, options, value, onchange) {
  const s = el('select', { onchange: (e) => onchange(e.target.value) }, options.map(([v, l]) => el('option', { value: v, selected: v === value || null }, l)));
  return el('label', { class: 'ed' }, el('span', {}, label), s);
}
function check(obj, key, label, after) {
  return el('label', { class: 'ed' }, el('span', {}, label), el('input', { type: 'checkbox', checked: obj[key] || null, onchange: (e) => { obj[key] = e.target.checked; if (after) after(); } }));
}
const itemName = (id) => { const it = USABLES[id] || itemDef(id); return it ? T(it.name) + (it.rarity ? `【${T(RARITY[it.rarity].name)}】` : it.famous ? T('【名品】', ' [Famous]') : '') : id; };
const ALL_ITEMS = () => [...Object.keys(USABLES), ...Object.keys(GEAR), ...Object.keys(TREASURES), ...Object.keys(RELICS)];

// opts: { B (a battle in progress), onChange (redraw whatever is on screen) }
export function openEditor(G, { B = null, onChange = () => {}, onClose = () => {} } = {}) {
  let tab = B ? 'battle' : 'city';
  const box = el('div', { class: 'editor' }), body = el('div', { class: 'edbody scroll' });
  const tabs = [['city', T('城市', 'Cities')], ['officer', T('武將', 'Officers')], ['items', T('道具', 'Items')], ['game', T('遊戲', 'Game')], ...(B ? [['battle', T('戰鬥', 'Battle')]] : [])];
  const changed = () => { try { onChange(); } catch (e) { console.error(e); } };
  const render = () => {
    clear(box).append(el('div', { class: 'row' }, el('span', { class: 'title grow' }, T('修改', 'Edit')), el('span', { class: 'small dim' }, T('任何數值都可以直接改，立即生效', 'Change any number; it takes effect at once'))),
      el('div', { class: 'tabs' }, tabs.map(([k, l]) => el('button', { class: 'btn' + (tab === k ? ' primary' : ''), onclick: () => { tab = k; render(); } }, l))), body,
      el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, el('button', { class: 'btn primary', onclick: () => close() }, T('完成', 'Done'))));
    clear(body);
    ({ city: cityTab, officer: officerTab, items: itemsTab, game: gameTab, battle: battleTab })[tab]();
  };
  // ------------------------------------------------ cities
  let cityId = G.factions[G.player] ? G.factions[G.player].capital : 0;
  function cityTab() {
    const c = G.cities[cityId];
    body.append(pick(T('城市', 'City'), G.cities.map((x) => [String(x.id), `${cityName(x.name)}（${x.owner ? nm(G.factions[x.owner].name) : T('無主', 'none')}）`]), String(cityId), (v) => { cityId = +v; render(); }),
      el('div', { class: 'edgrid' },
        num(c, 'gold', T('金', 'Gold'), { after: changed }), num(c, 'food', T('糧', 'Food'), { after: changed }), num(c, 'troops', T('兵', 'Troops'), { after: changed }),
        num(c, 'farm', T('農業', 'Farming'), { after: changed }), num(c, 'farmMax', T('農業上限', 'Farming cap'), { after: changed }),
        num(c, 'trade', T('商業', 'Commerce'), { after: changed }), num(c, 'tradeMax', T('商業上限', 'Commerce cap'), { after: changed }),
        num(c, 'wall', T('城防', 'Walls'), { after: changed }), num(c, 'wallMax', T('城防上限', 'Walls cap'), { after: changed }),
        num(c, 'size', T('規模(1-3)', 'Size (1-3)'), { min: 1, max: 3, after: changed }),
        num(c.fac, 'tower', T('箭樓', 'Towers'), { max: 8, after: changed }), num(c.fac, 'fence', T('拒馬', 'Barricades'), { max: 8, after: changed }), num(c.fac, 'trap', T('陷坑', 'Pits'), { max: 30, after: changed }),
        check(c.fac, 'moat', T('護城河', 'Moat'), changed)),
      pick(T('擁有者', 'Owner'), [['', T('無主', 'Unclaimed')], ...Object.values(G.factions).map((f) => [f.id, nm(f.name) + (f.alive ? '' : T('（已滅亡）', ' (fallen)'))])], c.owner || '', (v) => {
        c.owner = v || null; if (v) G.factions[v].alive = true;
        for (const o of G.officers) if (o.status === 'serving' && o.city === c.id && o.fac !== c.owner) { const home = C.citiesOf(G, o.fac)[0]; if (home) o.city = home.id; else { o.status = 'free'; o.fac = null; } }
        C.checkOver(G); changed(); render();
      }));
  }
  // ------------------------------------------------ officers
  let query = '', offId = null;
  function officerTab() {
    const list = G.officers.filter((o) => o.status !== 'dead' && (!query || o.name.includes(query) || nm(o.name).toLowerCase().includes(query.toLowerCase())))
      .sort((a, b) => (b.fac === G.player) - (a.fac === G.player) || b.lv - a.lv).slice(0, 200);
    if (offId == null || !G.officers[offId]) offId = (list[0] || G.officers[0]).id;
    const search = el('input', { type: 'text', placeholder: T('搜尋武將名字', 'Search a name'), value: query, oninput: (e) => { query = e.target.value; const keep = e.target.selectionStart; render(); const s = box.querySelector('.edsearch'); if (s) { s.focus(); s.setSelectionRange(keep, keep); } }, class: 'edsearch' });
    body.append(el('label', { class: 'ed wide' }, el('span', {}, T('搜尋', 'Search')), search),
      pick(T('武將', 'Officer'), list.map((o) => [String(o.id), `${nm(o.name)}　Lv${o.lv}　${o.fac ? nm(G.factions[o.fac].name) : T({ free: '在野', hidden: '未發現', hiddenhero: '隱藏', unborn: '未登場', captive: '俘虜' }[o.status] || o.status)}`]), String(offId), (v) => { offId = +v; render(); }));
    const o = G.officers[offId]; if (!o) return;
    const s = battleStats(o);
    body.append(el('div', { class: 'small dim' }, `${T(s.cls)} · ${T('兵力', 'Troops')} ${s.hp} · MP ${s.mp} · ${T('攻', 'ATK')} ${s.atk} ${T('防', 'DEF')} ${s.def} ${T('精', 'SPI')} ${s.spi} ${T('爆', 'AGI')} ${s.agi} ${T('士', 'MOR')} ${s.mor}`),
      el('div', { class: 'edgrid' }, ATTR.map(([k, z, e]) => num(o, k, T(z, e), { max: 150, after: () => { changed(); render(); } })),
        num(o, 'lv', T('等級', 'Level'), { min: 1, max: 50, after: () => { changed(); render(); } }), num(o, 'exp', 'EXP', { max: 99, after: changed }),
        check(o, 'done', T('本月已行動', 'Busy this month'), changed)),
      pick(T('兵種', 'Unit line'), LINE_ORDER.map((k) => [k, T(LINES[k].names[tierOf(o.lv)])]), o.line, (v) => { o.line = v; changed(); render(); }),
      pick(T('身分', 'Status'), [['serving', T('仕官', 'Serving')], ['free', T('在野', 'Free')], ['hidden', T('未發現', 'Undiscovered')], ['captive', T('俘虜', 'Captive')], ['dead', T('死亡', 'Dead')]], o.status, (v) => {
        o.status = v; if (v === 'serving' && !o.fac) { o.fac = G.player; o.city = G.factions[G.player].capital; } if (v !== 'serving') { if (v !== 'captive') o.fac = null; } if (v === 'captive' && !G.captives.includes(o.id)) { o.captiveOf = G.player; o.fromFac = o.fac; o.fac = null; G.captives.push(o.id); }
        C.checkOver(G); changed(); render();
      }),
      pick(T('勢力', 'House'), [['', T('無', 'None')], ...Object.values(G.factions).filter((f) => f.alive).map((f) => [f.id, nm(f.name)])], o.fac || '', (v) => {
        if (!v) { o.fac = null; if (o.status === 'serving') o.status = 'free'; } else { o.fac = v; o.status = 'serving'; if (G.cities[o.city].owner !== v) o.city = (C.citiesOf(G, v)[0] || G.cities[o.city]).id; }
        changed(); render();
      }),
      pick(T('所在城市', 'City'), G.cities.map((c) => [String(c.id), cityName(c.name)]), String(o.city), (v) => { o.city = +v; if (o.status === 'serving' && G.cities[o.city].owner !== o.fac) toast(T('注意：這座城不屬於他的勢力', 'Note: that city isn’t his house’s'), 1800); changed(); render(); }),
      el('div', { class: 'title small sect' }, T('裝備（從所有道具中任選）', 'Equipment (any item)')),
      ['w', 'a', 'x'].map((slot) => { const ids = ALL_ITEMS().filter((id) => { const it = itemDef(id); return it && it.slot === slot; });
        return pick(T(...{ w: ['武器', 'Weapon'], a: ['防具', 'Armour'], x: ['輔助', 'Extra'] }[slot]), [['', '—'], ...ids.map((id) => [id, itemName(id)])], o.eq[slot] || '', (v) => { o.eq[slot] = v || null; changed(); render(); }); }));
  }
  // ------------------------------------------------ items
  let itemQuery = '';
  function itemsTab() {
    const ids = Object.keys(G.bag).filter((id) => G.bag[id] > 0);
    body.append(el('div', { class: 'title small sect' }, T('道具袋（直接改數量，改成 0 就移除）', 'The bag (change counts; 0 removes)')),
      el('div', { class: 'edgrid' }, ids.length ? ids.map((id) => num(G.bag, id, itemName(id), { max: 999, after: (v) => { if (!v) delete G.bag[id]; changed(); } })) : el('div', { class: 'dim small' }, '—')));
    const all = ALL_ITEMS().filter((id) => !itemQuery || itemName(id).includes(itemQuery) || id.includes(itemQuery));
    const sel = el('select', {}, all.slice(0, 700).map((id) => el('option', { value: id }, itemName(id))));
    const cnt = el('input', { type: 'number', value: 1, min: 1, max: 999 });
    body.append(el('div', { class: 'title small sect' }, T('加入道具', 'Add an item')),
      el('label', { class: 'ed wide' }, el('span', {}, T('搜尋', 'Search')), el('input', { type: 'text', class: 'edsearch2', placeholder: T('名字，例如 青龍、赤兔、神器', 'A name, e.g. Dragon, Hare'), value: itemQuery, oninput: (e) => { itemQuery = e.target.value; const k = e.target.selectionStart; render(); const s = box.querySelector('.edsearch2'); if (s) { s.focus(); s.setSelectionRange(k, k); } } })),
      el('div', { class: 'row' }, sel, cnt, el('button', { class: 'btn primary', onclick: () => { const id = sel.value; if (!id) return; G.bag[id] = (G.bag[id] || 0) + Math.max(1, +cnt.value || 1); toast(T(`加入了 ${itemName(id)} ×${cnt.value}`, `Added ${itemName(id)} ×${cnt.value}`)); changed(); render(); } }, T('加入', 'Add'))),
      el('div', { class: 'small dim' }, T(`共 ${all.length} 種符合（寶物 500 種、名品 ${Object.keys(TREASURES).length} 種、一般裝備、道具）`, `${all.length} match (500 treasures, ${Object.keys(TREASURES).length} famous items, gear and supplies)`)));
  }
  // ------------------------------------------------ the game
  function gameTab() {
    body.append(el('div', { class: 'edgrid' }, num(G, 'year', T('年', 'Year'), { min: 150, max: 300, after: changed }), num(G, 'month', T('月', 'Month'), { min: 1, max: 12, after: changed })),
      pick(T('扮演的君主', 'Your house'), Object.values(G.factions).filter((f) => f.alive).map((f) => [f.id, `${nm(f.name)}（${T('城', 'cities')} ${C.citiesOf(G, f.id).length}）`]), G.player, (v) => { G.player = v; C.rollMissions(G); changed(); render(); toast(T(`現在扮演 ${nm(G.factions[v].name)}`, `Now playing ${nm(G.factions[v].name)}`)); }),
      el('div', { class: 'row', style: { marginTop: '10px' } },
        el('button', { class: 'btn', onclick: () => { for (const o of C.officersOf(G, G.player)) o.done = false; changed(); toast(T('全部武將都可以再行動了', 'Everyone can act again')); } }, T('全部武將重新行動', 'Everyone acts again')),
        el('button', { class: 'btn', onclick: () => { G.roll = (G.roll || 0) + 7; C.rollMissions(G); changed(); toast(T('任務已重新產生', 'New missions')); } }, T('重新產生任務', 'Reroll missions')),
        el('button', { class: 'btn', onclick: () => { for (const c of C.citiesOf(G, G.player)) { c.gold += 5000; c.food += 20000; } changed(); toast(T('每座城 金+5000 糧+20000', 'Every city: gold +5000, food +20000')); } }, T('全部城市加錢糧', 'Gold and food everywhere')),
        el('button', { class: 'btn', onclick: () => { for (const c of C.citiesOf(G, G.player)) c.troops = C.capOf(c); changed(); toast(T('全部城市兵力補滿', 'Every barracks filled')); } }, T('全部城市兵力補滿', 'Fill every barracks'))));
  }
  // ------------------------------------------------ the battle in progress
  let unitId = null;
  function battleTab() {
    const units = B.units.filter(alive), mineSide = B.sides.atk.player ? 'atk' : 'def';
    if (unitId == null || !units.some((u) => u.id === unitId)) unitId = (units.find((u) => u.side === mineSide) || units[0]).id;
    const u = B.units.find((x) => x.id === unitId);
    const reStat = () => { const k = u.hp / u.s.hp, s = battleStats(u.o); u.s = s; u.hp = Math.max(1, Math.round(s.hp * k)); };
    body.append(pick(T('部隊', 'Unit'), units.map((x) => [String(x.id), `${x.side === mineSide ? T('我', 'Ours') : T('敵', 'Foe')}　${nm(x.o.name)}　${x.hp}/${x.s.hp}`]), String(unitId), (v) => { unitId = +v; render(); }),
      el('div', { class: 'edgrid' },
        num(u, 'hp', T('兵力', 'Troops'), { min: 1, max: 99999, after: changed }), num(u.s, 'hp', T('兵力上限', 'Max troops'), { min: 1, max: 99999, after: changed }),
        num(u, 'mp', T('策略值', 'MP'), { max: 9999, after: changed }), num(u.s, 'mp', T('策略值上限', 'Max MP'), { max: 9999, after: changed }),
        ...[['atk', '攻擊', 'ATK'], ['def', '防禦', 'DEF'], ['spi', '精神', 'SPI'], ['agi', '爆發', 'AGI'], ['mor', '士氣', 'MOR']].map(([k, z, e]) => num(u.s, k, T(z, e), { max: 9999, after: changed })),
        num(u.s, 'mov', T('移動', 'Move'), { max: 20, after: changed }), num(u.s.r, 1, T('最大射程', 'Max range'), { min: 1, max: 10, after: changed }),
        num(u.o, 'lv', T('等級（重算數值）', 'Level (recalc)'), { min: 1, max: 50, after: () => { reStat(); changed(); render(); } }),
        check(u, 'done', T('已行動', 'Done'), changed), check(u, 'commander', T('主將', 'Commander'), changed)),
      Object.keys(u.st).length ? el('div', { class: 'small' }, T('狀態：', 'Status: '), Object.keys(u.st).map((k) => T(AILMENTS[k])).join(T('、', ', ')), ' ', el('button', { class: 'btn small', onclick: () => { u.st = {}; changed(); render(); } }, T('解除', 'Clear'))) : null,
      el('div', { class: 'row', style: { marginTop: '10px' } },
        el('button', { class: 'btn', onclick: () => { for (const x of B.units) if (alive(x) && x.side === mineSide) { x.hp = x.s.hp; x.mp = x.s.mp; x.st = {}; } changed(); toast(T('我軍全員兵力、策略值全滿', 'Our army is fully restored')); } }, T('我軍全滿', 'Restore our army')),
        el('button', { class: 'btn', onclick: () => { for (const x of B.units) if (alive(x) && x.side === mineSide) { x.done = false; x.acted = false; x.moved = false; } changed(); toast(T('我軍全員可以再行動', 'Our whole army can act again')); } }, T('我軍再行動', 'Our army acts again')),
        el('button', { class: 'btn', onclick: () => { B.limit += 10; changed(); toast(T('回合上限 +10', 'Turn limit +10')); } }, T('回合上限 +10', 'Turn limit +10')),
        el('button', { class: 'btn war', onclick: () => { finish(B, mineSide, 'edit'); checkEnd(B); changed(); close(); } }, T('立即勝利', 'Win now'))));
  }
  render();
  const close0 = sheet(box, { wide: true, onBack: () => onClose() });
  const close = () => { close0(); onClose(); };
  return close;
}
