// The battle screen: your phase (pick a unit, move, then attack / strategy / item / wait), the enemy's phase played
// back with animations, and full information on any unit — yours or the enemy's.
import { T, EN } from '../i18n.js';
import { el, clear, $ui, menu, pushKeys, bar, wait, toast, modal } from './dom.js';
import { Field } from './field.js';
import { portrait } from './sprites.js';
import { nm } from './names.js';
import { TERRAIN, STRATS, USABLES, AILMENTS, BUFF_NAMES, DMG_KINDS, HELP_KINDS, LINES, apt } from '../data/rules.js';
import { itemDef } from '../core/officer.js';
import { RARITY, fxText } from '../data/relics.js';
import * as R from '../core/battle.js';
import { sfx, music } from '../audio.js';

let FAST = false;
const W = (ms) => wait(FAST ? ms * 0.4 : ms);
const key = (x, y) => `${x},${y}`;
const COL = { move: 'rgba(80,150,255,.42)', atk: 'rgba(255,80,60,.38)', reach: 'rgba(255,120,90,.18)', strat: 'rgba(190,110,255,.42)', area: 'rgba(255,220,90,.55)', help: 'rgba(90,230,140,.42)', foe: 'rgba(255,150,60,.3)' };
const ONE_LINERS = [['可惡……撤退！', 'Curses… fall back!'], ['不敵……先退一步！', 'Too strong… retreat!'], ['這次就算了……', 'Another day…'], ['兵力不足，撤退！', 'Not enough men — withdraw!']];

// opts: { bag (the player's items, shared by the army), title }
export async function runBattle(B, opts = {}) {
  const cv = document.getElementById('view'), ui = clear();
  const view = new Field(cv); view.colors = { atk: B.sides.atk.color, def: B.sides.def.color }; view.setBattle(B);
  const me = R.playerSide(B), them = me === 'atk' ? 'def' : 'atk';
  window.__B = B; window.__view = view;
  const bag = opts.bag || {};
  // HUD
  const hud = {
    top: el('div', { class: 'bhud-top' }), card: el('div', { class: 'panel unitcard', style: { display: 'none' } }), tip: el('div', { class: 'panel tilecard', style: { display: 'none' } }),
    cmd: el('div', { class: 'cmd' }), fc: el('div', { class: 'panel forecast', style: { display: 'none' } }), banner: el('div', { class: 'banner', style: { display: 'none' } }),
    goal: el('div', { class: 'panel goal' }), help: el('div', { class: 'helpline' }, T('點選我軍部隊行動 · 點敵軍看情報與範圍 · 拖曳移動地圖 · 滾輪縮放 · X/Esc 取消', 'Tap your unit to act · tap a foe for info and range · drag to scroll · wheel to zoom · X/Esc back')),
  };
  let auto = false;
  const btn = (label, onclick, title) => el('button', { class: 'btn', title, onclick }, label);
  const autoBtn = btn(T('委任', 'Auto'), () => { auto = !auto; autoBtn.classList.toggle('primary', auto); if (auto && cancelPick) cancelPick('auto'); });
  const endBtn = btn(T('結束回合', 'End turn'), () => { if (cancelPick) cancelPick('end'); });
  hud.top.append(endBtn, autoBtn, btn(T('全軍', 'Army'), () => armyList()), btn('＋', () => view.zoomBy(1.2)), btn('－', () => view.zoomBy(1 / 1.2)),
    btn(T('速度', 'Speed'), (e) => { FAST = !FAST; e.currentTarget.classList.toggle('primary', FAST); }));
  ui.append(hud.top, hud.goal, hud.card, hud.tip, hud.cmd, hud.fc, hud.banner, hud.help);
  const goalText = () => {
    const mine = B.sides[me];
    const chests = B.map.chests ? B.map.chests.filter((c) => !c.taken && !c.hidden).length : 0;
    const vip = B.units.find((u) => u.vip);
    const left = B.limit - B.turn + 1;
    if (B.goal === 'survive') { clear(hud.goal).append(el('b', {}, T(`第 ${B.turn}/${B.limit} 回合`, `Turn ${B.turn}/${B.limit}`)), el('span', { class: 'dim small' }, '　' + (vip ? T(`勝利：保護糧車撐過 ${B.limit} 回合（還剩 ${left}）　敗北：糧車被毀或主將撤退`, `Win: keep the wagon alive for ${B.limit} turns (${left} to go) · Lose: the wagon or your commander falls`) : T(`勝利：守住 ${B.limit} 回合（還剩 ${left}）或全滅敵軍　敗北：主將撤退`, `Win: hold for ${B.limit} turns (${left} to go) or rout them · Lose: your commander falls`)))); return; }
    const g = B.goal === 'rout' ? T(`勝利：全滅敵軍　敗北：主將撤退或超過 ${B.limit} 回合${chests ? `　寶箱 ${chests}` : ''}`, `Win: rout them all · Lose: your commander falls or ${B.limit} turns pass${chests ? ` · chests ${chests}` : ''}`)
      : B.goal === 'leader' ? T(`勝利：擊敗敵將　敗北：主將撤退或超過 ${B.limit} 回合${chests ? `　寶箱 ${chests}` : ''}`, `Win: defeat their leader · Lose: your commander falls or ${B.limit} turns pass${chests ? ` · chests ${chests}` : ''}`)
      : me === 'atk' ? T(`勝利：擊敗敵軍主將、全滅敵軍或佔領城池　敗北：主將撤退或超過 ${B.limit} 回合`, `Win: defeat their commander, rout them, or take the keep · Lose: your commander falls, or ${B.limit} turns pass`)
      : T(`勝利：擊退敵軍主將或守住 ${B.limit} 回合　敗北：主將撤退或城池被佔領`, `Win: drive off their commander or hold for ${B.limit} turns · Lose: your commander falls or the keep is taken`);
    clear(hud.goal).append(el('b', {}, T(`第 ${B.turn}/${B.limit} 回合`, `Turn ${B.turn}/${B.limit}`)), el('span', { class: 'dim small' }, '　' + g));
    void mine;
  };
  goalText();
  // ------------------------------------------------ frame loop
  let alive2 = true, last = performance.now();
  const frame = (now) => { if (!alive2) return; const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; try { view.draw(dt); } catch (e) { console.error(e); } requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  const onResize = () => view.resize(); addEventListener('resize', onResize);
  // ------------------------------------------------ pointer: tap, drag, pinch, wheel
  let onTile = null, onHover = null, hoverTile = null, dragged = false;
  const ptrs = new Map(); let pinch = null;
  const cssXY = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }); dragged = false; pinch = null; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } });
  cv.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) { const t = view.pick(...cssXY(e)); if (t && (!hoverTile || t[0] !== hoverTile[0] || t[1] !== hoverTile[1])) { hoverTile = t; hover(t); } return; }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()].map((q) => (q === p ? { x: e.clientX, y: e.clientY } : q)); const d = Math.hypot(b.x - a.x, b.y - a.y); if (pinch) view.zoomBy(d / pinch); pinch = d; dragged = true; }
    else { if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 8) dragged = true; if (dragged) view.pan(e.clientX - p.x, e.clientY - p.y); }
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('click', (e) => { if (dragged) { dragged = false; return; } const t = view.pick(...cssXY(e)); if (!t) return; hoverTile = t; hover(t); if (onTile) onTile(t); });
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (backFn) backFn(); });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = cssXY(e); view.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, x * view.dpr, y * view.dpr); }, { passive: false });
  // keyboard: arrows move the cursor, OK picks, back cancels
  let backFn = null;
  const offKeys = pushKeys((k) => {
    if (k === 'back') { if (backFn) backFn(); return; }
    const c = view.cursor || [0, 0], d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[k];
    if (d) { const t = [Math.max(0, Math.min(B.map.w - 1, c[0] + d[0])), Math.max(0, Math.min(B.map.h - 1, c[1] + d[1]))]; view.cursor = t; view.ensure(...t); hover(t); }
    if (k === 'ok' && view.cursor && onTile) onTile(view.cursor);
  });
  // ------------------------------------------------ cards
  function hover(t) {
    if (onHover) onHover(t);
    const u = R.unitAt(B, t[0], t[1]);
    if (u) { showCard(u); hud.tip.style.display = 'none'; }
    else { hud.card.style.display = 'none'; tileTip(t); }
  }
  function tileTip(t) {
    const tt = B.map.tiles[t[1] * B.map.w + t[0]].t, T0 = TERRAIN[tt];
    const cost = (m) => (T0.cost[m] ? T0.cost[m] : '×');
    hud.tip.style.display = '';
    clear(hud.tip).append(el('b', {}, T(T0.name)), el('span', { class: 'small dim' }, `　${T('防禦', 'DEF')} ${T0.def >= 0 ? '+' : ''}${T0.def}%${T0.heal ? T(`　回復 ${T0.heal}%`, `　heals ${T0.heal}%`) : ''}`),
      el('div', { class: 'small dim' }, `${T('移動消耗', 'Move cost')}：${T('步', 'Foot')} ${cost('foot')} · ${T('騎', 'Horse')} ${cost('horse')} · ${T('山', 'Wild')} ${cost('wild')} · ${T('車', 'Cart')} ${cost('cart')}`));
  }
  function showCard(u) {
    hud.card.style.display = '';
    const pc = el('canvas', { width: 32, height: 32 }); pc.getContext('2d').drawImage(portrait(u.o, B.sides[u.side].color), 0, 0);
    const sts = Object.keys(u.st).map((k) => el('span', { class: 'tag', style: { color: AILMENTS[k][2], borderColor: AILMENTS[k][2] } }, T(AILMENTS[k])));
    clear(hud.card).append(
      el('div', { class: 'head' }, pc, el('div', { style: { flex: 1, minWidth: 0 } },
        el('div', { class: 'nm', style: { color: u.side === me ? 'var(--blue)' : 'var(--red)' } }, nm(u.o.name), u.commander ? el('span', { class: 'tag', style: { marginLeft: '6px', color: 'var(--gold)', borderColor: 'var(--gold)' } }, T('主將', 'Cmdr')) : null),
        el('div', { class: 'small dim' }, `${T(u.s.cls)} · Lv ${u.o.lv}${u.side === me ? ` · EXP ${u.o.exp || 0}` : ''}`))),
      el('div', { class: 'row small', style: { justifyContent: 'space-between', marginTop: '4px' } }, el('span', {}, `${T('兵力', 'Troops')} ${u.hp}/${u.s.hp}`), el('span', { class: 'dim' }, `${T('策略', 'MP')} ${u.mp}/${u.s.mp}`)),
      bar(u.hp, u.s.hp, u.hp / u.s.hp > 0.5 ? '#5ad06a' : u.hp / u.s.hp > 0.25 ? '#e0c040' : '#e05a4a'), el('div', { style: { height: '3px' } }), bar(u.mp, u.s.mp || 1, '#4a8aff'),
      el('div', { class: 'statgrid' }, [['atk', u.s.atk], ['def', u.s.def], ['spi', u.s.spi], ['agi', u.s.agi], ['mor', u.s.mor]].map(([k, v]) => el('div', {}, el('b', {}, T(BUFF_NAMES[k])), v + (u.buf[k] ? (u.buf[k][0] > 0 ? '▲' : '▼') : '')))),
      sts.length ? el('div', { class: 'row', style: { marginTop: '4px', gap: '4px' } }, sts) : null,
      el('div', { class: 'small dim', style: { marginTop: '4px' } }, T('再點一次看詳細情報', 'Tap again for full details')));
  }
  // ------------------------------------------------ full details on any unit (◀ ▶ walk through everyone)
  function infoSheet(u0) {
    return new Promise((resolve) => {
      let u = u0;
      const list = () => B.units.filter(R.alive).sort((a, b) => (a.side === me ? 0 : 1) - (b.side === me ? 0 : 1));
      const m = el('div', { class: 'modal' }), p = el('div', { class: 'panel', style: { width: 'min(640px, 100%)', maxHeight: '88vh', overflowY: 'auto' } });
      const step = (d) => { const L = list(), i = L.indexOf(u); u = L[(Math.max(0, i) + d + L.length) % L.length]; view.cursor = [u.x, u.y]; view.ensure(u.x, u.y); draw(); };
      const draw = () => { const L = list(); clear(p).append(unitDetail(u), el('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '10px' } }, el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => step(-1) }, '◀'), el('span', { class: 'small dim' }, `${L.indexOf(u) + 1} / ${L.length}`), el('button', { class: 'btn', onclick: () => step(1) }, '▶')), el('button', { class: 'btn primary', onclick: close }, T('關閉', 'Close')))); };
      const close = () => { off(); m.remove(); resolve(); };
      const off = pushKeys((k) => { if (k === 'left' || k === 'up') step(-1); else if (k === 'right' || k === 'down') step(1); else if (k === 'back' || k === 'ok') close(); });
      m.addEventListener('click', (e) => { if (e.target === m) close(); });
      m.append(p); ui.append(m); draw();
    });
  }
  function unitDetail(u) {
    const s = u.s, pc = el('canvas', { width: 32, height: 32, class: 'face' }); pc.getContext('2d').drawImage(portrait(u.o, B.sides[u.side].color), 0, 0);
    const tile = B.map.tiles[u.y * B.map.w + u.x].t;
    const sec = (title, ...body) => el('div', { style: { marginTop: '10px' } }, el('div', { class: 'title small sect' }, title), ...body);
    const eq = u.structure ? [el('div', { class: 'small dim' }, T('城牆上的箭樓：敵人進入射程時自動射擊，不會移動；攻城兵器對它特別有效。', 'A tower on the walls: shoots whoever comes in range, never moves; siege engines wreck it.'))]
      : ['w', 'a', 'x'].map((k) => { const it = u.o.eq && u.o.eq[k] && itemDef(u.o.eq[k]); const col = it && it.rarity ? RARITY[it.rarity].col : it && it.famous ? '#ffc840' : null; return el('div', { class: 'small' }, el('span', { class: 'tag' }, T(...{ w: ['武器', 'Weapon'], a: ['防具', 'Armour'], x: ['輔助', 'Extra'] }[k])), ' ', it ? el('b', { style: { color: col || 'inherit' } }, T(it.name)) : '—', it ? el('span', { class: 'dim' }, ' ' + gearText(it)) : null, it && it.fx ? el('div', { style: { color: 'var(--gold2)', paddingLeft: '52px' } }, fxText(it).map((d) => T(...d)).join(T('；', '; '))) : null); });
    const strats = s.strats.length ? s.strats.map((id) => { const S = STRATS[id]; return el('div', { class: 'small' }, el('span', { style: { color: 'var(--gold2)' } }, T(S.name)), el('span', { class: 'dim' }, `　MP ${S.mp} · ${T('射程', 'range')} ${S.r}${S.a ? T(` · 範圍 ${S.a}`, ` · area ${S.a}`) : ''} · ${stratKind(S)}`)); }) : [el('div', { class: 'small dim' }, '—')];
    const L = LINES[s.line];
    return el('div', {},
      el('div', { class: 'row', style: { gap: '12px', alignItems: 'center', flexWrap: 'nowrap' } }, pc, el('div', { style: { flex: 1, minWidth: 0 } },
        el('div', { class: 'row', style: { gap: '6px' } }, el('span', { class: 'title', style: { fontSize: '20px' } }, nm(u.o.name)), el('span', { class: 'tag', style: { color: u.side === me ? 'var(--blue)' : 'var(--red)', borderColor: 'currentColor' } }, u.side === me ? T('我軍', 'Ours') : T('敵軍', 'Enemy')), u.commander ? el('span', { class: 'tag', style: { color: 'var(--gold)', borderColor: 'var(--gold)' } }, T('主將', 'Commander')) : null),
        el('div', { class: 'small dim' }, `${T(s.cls)} · Lv ${u.o.lv}${u.side === me ? ` · EXP ${u.o.exp || 0}/100` : ''} · ${T('移動', 'Move')} ${s.mov} · ${T('射程', 'Range')} ${s.r[0] === s.r[1] ? s.r[0] : s.r.join('-')}`),
        el('div', { class: 'row small', style: { gap: '12px', marginTop: '3px' } }, el('span', {}, `${T('兵力', 'Troops')} ${u.hp}/${s.hp}`), el('span', {}, `${T('策略值', 'MP')} ${u.mp}/${s.mp}`)),
        bar(u.hp, s.hp, '#5ad06a'), el('div', { style: { height: '3px' } }), bar(u.mp, s.mp || 1, '#4a8aff'))),
      sec(T('能力', 'Attributes'), el('div', { class: 'statgrid five' }, [['統率', 'LEAD', u.o.lead], ['武力', 'WAR', u.o.war], ['智力', 'INT', u.o.int], ['政治', 'POL', u.o.pol], ['魅力', 'CHA', u.o.cha]].map(([z, e, v]) => el('div', {}, el('b', {}, T(z, e)), v)))),
      sec(T('戰鬥數值', 'Battle stats'), el('div', { class: 'statgrid five' }, ['atk', 'def', 'spi', 'agi', 'mor'].map((k) => el('div', {}, el('b', {}, T(BUFF_NAMES[k])), s[k], u.buf[k] ? el('span', { style: { color: u.buf[k][0] > 0 ? 'var(--green)' : 'var(--red)' } }, u.buf[k][0] > 0 ? '▲' : '▼') : null))),
        el('div', { class: 'small dim', style: { marginTop: '4px' } }, `${T('所在地形', 'Standing on')}：${T(TERRAIN[tile].name)}（${T('防禦', 'DEF')} ${TERRAIN[tile].def >= 0 ? '+' : ''}${TERRAIN[tile].def}% · ${T('適性', 'aptitude')} ${Math.round(apt(L.move, tile) * 100)}%）`),
        Object.keys(u.st).length ? el('div', { class: 'small', style: { marginTop: '3px' } }, T('狀態：', 'Status: '), Object.entries(u.st).map(([k, n]) => el('span', { class: 'tag', style: { color: AILMENTS[k][2], borderColor: AILMENTS[k][2], marginRight: '4px' } }, `${T(AILMENTS[k])} ${n}`))) : null),
      sec(T('裝備', 'Equipment'), eq),
      sec(T('策略', 'Strategies'), strats),
      sec(T('兵種相剋', 'Matchups'), el('div', { class: 'small dim' }, counterText(L.kind))));
  }
  function counterText(kind) {
    return { cav: T('騎兵：克制步兵，被弓兵克制', 'Cavalry: strong vs infantry, weak to archers'), inf: T('步兵：克制弓兵，被騎兵克制', 'Infantry: strong vs archers, weak to cavalry'), arch: T('弓兵：克制騎兵，被步兵克制；不能反擊相鄰的敵人（連弩兵除外）', 'Archers: strong vs cavalry, weak to infantry; can\'t hit back at close range (except repeating crossbows)'),
      mag: T('策略系：攻擊力弱，靠策略作戰；騎兵對其有利', 'Casters: weak blows, fight with strategies; cavalry do well against them'), wild: T('山地系：在山地、森林特別強，可以越過高山', 'Hill fighters: strong in hills and forests, can cross mountains'), cart: T('兵器：射程遠，攻城威力大（對城內、城門、陣營 ×1.4）', 'Siege engines: long range, hit hard at walls (×1.4 on town, gate, camp)'), lord: T('君主：各項均衡，可使用策略', 'Lords: well-rounded, with strategies') }[kind] || '';
  }
  function stratKind(S) { return { fire: T('火攻（水上、雪地無效；森林草原加成）', 'fire (not on water or snow; stronger in forest and grass)'), water: T('水攻（需要靠近水邊）', 'water (needs water nearby)'), rock: T('落石（目標或自己需在山地）', 'rockfall (target or caster on hills)'), wind: T('風攻', 'wind'), bolt: T('雷擊', 'lightning'), heal: T('回復兵力', 'restore troops'), cure: T('解除異常', 'cure ailments'), conf: T('混亂：無法控制', 'confuse: goes wild'), stop: T('牽制：無法移動', 'pin: can\'t move'), seal: T('封殺：無法用策略', 'silence: no strategies'), poison: T('中毒：每回合損兵', 'poison: loses troops each turn'), 'atk+': T('攻擊提升', 'attack up'), 'def+': T('防禦提升', 'defence up'), 'spi+': T('精神提升', 'spirit up'), 'agi+': T('爆發提升、移動 +1', 'agility up, move +1'), 'atk-': T('攻擊下降', 'attack down'), 'def-': T('防禦下降', 'defence down') }[S.kind]; }
  function gearText(it) { const p = []; for (const [k, z, e] of [['atk', '攻', 'ATK'], ['def', '防', 'DEF'], ['spi', '精', 'SPI'], ['agi', '爆', 'AGI'], ['mor', '士', 'MOR'], ['mov', '移', 'MOV'], ['mp', 'MP', 'MP']]) if (it[k]) p.push(`${T(z, e)}+${it[k]}`); if (it.attr) for (const [k, v] of Object.entries(it.attr)) p.push(`${T({ lead: '統', war: '武', int: '智', pol: '政', cha: '魅' }[k], k.toUpperCase())}+${v}`); return p.join(' '); }
  function armyList() {
    const mine = B.units.filter((u) => u.side === me), foes = B.units.filter((u) => u.side !== me);
    const row = (u) => el('div', { class: 'item' + (u.gone ? ' off' : ''), onclick: () => { if (!u.gone) { closeL(); view.centerOn(u.x, u.y); infoSheet(u); } } }, el('span', { class: 'grow' }, nm(u.o.name), u.commander ? '★' : ''), el('span', { class: 'small dim' }, T(u.s.cls)), el('span', { class: 'small' }, u.gone ? T('撤退', 'Fled') : `${u.hp}/${u.s.hp}`), el('span', { class: 'small dim' }, u.done && !u.gone && u.side === B.side ? T('已行動', 'Done') : ''));
    const box = el('div', {}, el('div', { class: 'title' }, T('我軍', 'Our army')), el('div', { class: 'list' }, mine.map(row)), el('div', { class: 'title', style: { marginTop: '10px' } }, T('敵軍', 'The enemy')), el('div', { class: 'list' }, foes.map(row)));
    const m = el('div', { class: 'modal' }), p = el('div', { class: 'panel', style: { width: 'min(560px, 100%)', maxHeight: '86vh', overflowY: 'auto' } }, box, el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, el('button', { class: 'btn primary', onclick: () => closeL() }, T('關閉', 'Close'))));
    const off = pushKeys((k) => { if (k === 'back' || k === 'ok') closeL(); });
    const closeL = () => { off(); m.remove(); };
    m.addEventListener('click', (e) => { if (e.target === m) closeL(); });
    m.append(p); ui.append(m);
  }
  // ------------------------------------------------ playing back what happened
  let played = 0;
  async function play() {
    while (played < B.events.length) {
      const e = B.events[played++];
      try { await show(e); } catch (er) { console.error(er); }
    }
    goalText();
  }
  async function banner(text, ms = 900) { hud.banner.textContent = text; hud.banner.style.display = ''; await W(ms); hud.banner.style.display = 'none'; }
  async function show(e) {
    const t = e.t;
    if (t === 'phase') { goalText(); const mine = e.side === me; music('battle'); await banner(mine ? T(`第 ${e.turn} 回合　我軍行動`, `Turn ${e.turn} — your move`) : T(`第 ${e.turn} 回合　敵軍行動`, `Turn ${e.turn} — enemy move`), 800); return; }
    if (t === 'move') {
      const u = e.u; view.ensure(u.x, u.y);
      for (let i = 1; i < e.path.length; i++) {
        const [fx, fy] = e.path[i - 1], [tx, ty] = e.path[i];
        if (tx !== fx) u.dir = tx > fx ? 1 : -1;
        const steps = FAST ? 3 : 6;
        for (let k = 1; k <= steps; k++) { u.ax = fx + (tx - fx) * k / steps; u.ay = fy + (ty - fy) * k / steps; await wait(16); }
      }
      u.ax = u.x; u.ay = u.y; return;
    }
    if (t === 'atk') {
      const { a, d } = e; view.ensure(d.x, d.y); view.active = a;
      const ranged = Math.abs(a.x - d.x) + Math.abs(a.y - d.y) > 1;
      if (e.kind === 'counter') view.text(a.x, a.y, T('反擊', 'Counter'), '#ffd070');
      if (e.kind === 'double') view.text(a.x, a.y, T('連擊！', 'Double!'), '#ffd070');
      a.lunge = [Math.sign(d.x - a.x), Math.sign(d.y - a.y)]; await W(110); a.lunge = null;
      if (ranged) { view.effect(a.s.line === 'siege' ? 'boulder' : 'arrow', d.x, d.y, 0.35, { from: [a.x, a.y] }); await W(330); }
      else view.effect('slash', d.x, d.y, 0.25);
      if (e.miss) { view.text(d.x, d.y, 'MISS', '#c8d8ff'); sfx('ok'); }
      else { d.flash = 0.3; sfx('hit'); if (e.crit) { view.text(d.x, d.y - 0.35, T('必殺！', 'Critical!'), '#ff5a3a', true); sfx('hurt'); } view.text(d.x, d.y, `-${e.dmg}`, e.crit ? '#ffd040' : '#ffffff', e.crit); }
      if (e.stand) view.text(d.x, d.y - 0.6, T('不屈！', 'Undying!'), '#ffe070', true);
      if (e.drain) view.text(a.x, a.y, `+${e.drain}`, '#8aff9a');
      if (e.thorns) { a.flash = 0.2; view.text(a.x, a.y, `-${e.thorns}`, '#ff9a7a'); }
      await W(e.crit ? 650 : 480); return;
    }
    if (t === 'retreat') {
      const u = e.u; view.ensure(u.x, u.y); sfx('die');
      const line = ONE_LINERS[u.id % ONE_LINERS.length];
      view.text(u.x, u.y, T('撤退', 'Retreats'), '#ffb0a0', true, 1.3);
      toast(`${nm(u.o.name)}：「${T(...line)}」`, 1800);
      await W(700); return;
    }
    if (t === 'strat') {
      const S = STRATS[e.sid], u = e.u; view.ensure(e.x, e.y); view.active = u;
      await banner(`${nm(u.o.name)}：${T(S.name)}`, 600);
      const fx = DMG_KINDS.has(S.kind) ? S.kind : S.kind === 'heal' ? 'heal' : S.kind === 'cure' ? 'cure' : S.kind.endsWith('+') ? 'buff' : S.kind.endsWith('-') ? 'debuff' : 'hex';
      sfx(DMG_KINDS.has(S.kind) ? 'magic' : 'skill');
      for (const [x, y] of e.tiles) view.effect(fx, x, y, 0.8);
      await W(650);
      for (const r of e.res) {
        const d = r.d;
        if (r.miss) view.text(d.x, d.y, T('失敗', 'Failed'), '#c8d8ff');
        else if (r.dmg != null) { d.flash = 0.3; view.text(d.x, d.y, `-${r.dmg}`, '#ffffff'); }
        else if (r.heal != null) view.text(d.x, d.y, `+${r.heal}`, '#8aff9a');
        else if (r.cure) view.text(d.x, d.y, T('恢復', 'Cured'), '#ffffff');
        else if (r.buf) view.text(d.x, d.y, `${T(BUFF_NAMES[r.buf])}${HELP_KINDS.has(S.kind) ? '▲' : '▼'}`, HELP_KINDS.has(S.kind) ? '#7aff8a' : '#ff8a7a');
        else if (r.st) view.text(d.x, d.y, T(AILMENTS[r.st]), AILMENTS[r.st][2]);
      }
      await W(500); return;
    }
    if (t === 'item') { const r = e.res[0]; view.effect('heal', r.d.x, r.d.y, 0.7); sfx('skill'); view.text(r.d.x, r.d.y, r.heal ? `+${r.heal}` : r.mp ? `MP+${r.mp}` : T('恢復', 'Cured'), '#8aff9a'); await W(500); return; }
    if (t === 'heal') { view.text(e.u.x, e.u.y, `+${e.n}`, '#8aff9a'); await W(160); return; }
    if (t === 'dmg') { view.text(e.u.x, e.u.y, `-${e.n}`, '#c08aff'); await W(160); return; }
    if (t === 'cured') return;
    if (t === 'spawn') { const u0 = e.units[0]; if (u0) view.ensure(u0.x, u0.y); for (const u of e.units) { u.ax = u.x; u.ay = u.y; u.alpha = 1; u.flash = 0.5; } sfx('turn'); await banner(e.side === me ? T('我軍援兵到達！', 'Our reinforcements arrive!') : T('敵軍援兵出現！', 'Enemy reinforcements!'), 1000); return; }
    if (t === 'trap') { view.ensure(e.u.x, e.u.y); e.u.flash = 0.4; sfx('hurt'); view.effect('rock', e.u.x, e.u.y, 0.6); view.text(e.u.x, e.u.y - 0.3, T('陷坑！', 'Pit trap!'), '#ffb070', true); view.text(e.u.x, e.u.y, `-${e.n}`, '#ffffff'); await W(700); return; }
    if (t === 'chest') { const it = USABLES[e.item] || itemDef(e.item), col = it.rarity ? RARITY[it.rarity].col : '#ffe070'; sfx('treasure'); view.effect('buff', e.u.x, e.u.y, 0.8); view.text(e.u.x, e.u.y - 0.3, e.hidden ? T('發現隱藏的物資！', 'A hidden cache!') : T('打開寶箱！', 'Chest!'), '#ffe070', true, 1.4); toast(T(`獲得「${it.name[0]}」${it.rarity ? `（${RARITY[it.rarity].name[0]}）` : ''}`, `Found ${it.name[1]}${it.rarity ? ` (${RARITY[it.rarity].name[1]})` : ''}`), 2200); void col; goalText(); await W(800); return; }
    if (t === 'lvup') { view.text(e.u.x, e.u.y - 0.4, 'LEVEL UP', '#ffe070', true, 1.4); sfx('levelup'); if (e.promoted) await banner(T(`${nm(e.u.o.name)} 晉升為 ${e.promoted[0]}！`, `${nm(e.u.o.name)} is promoted to ${e.promoted[1]}!`), 1300); else await W(400); return; }
    if (t === 'end') return;
  }
  // ------------------------------------------------ the player's phase
  let cancelPick = null;
  function showMarks(m) { view.marks.clear(); for (const [k, c] of m) view.marks.set(k, c); }
  function clearMarks() { view.marks.clear(); onTile = null; onHover = null; backFn = null; hud.fc.style.display = 'none'; }
  // wait for a tap: returns { unit } or 'end' / 'auto'
  function pickUnit() {
    return new Promise((resolve) => {
      cancelPick = (why) => { cancelPick = null; clearMarks(); resolve(why); };
      let shown = null;
      onTile = (t) => {
        const u = R.unitAt(B, t[0], t[1]);
        if (u && u.side === me && !u.done) { cancelPick = null; clearMarks(); resolve({ unit: u }); return; }
        if (u && shown === u) { infoSheet(u); return; }
        if (u) { shown = u; showRange(u); return; }
        shown = null; view.marks.clear();
      };
      backFn = () => { shown = null; view.marks.clear(); };
    });
  }
  // a unit's threat: where it can move (orange) and what it can hit from there (red)
  function showRange(u) {
    const r = R.reach(B, u), m = new Map();
    for (const v of r.values()) m.set(key(v.x, v.y), u.side === me ? COL.move : COL.foe);
    for (const v of r.values()) for (const [x, y] of R.attackTiles(B, u, v.x, v.y)) if (!m.has(key(x, y))) m.set(key(x, y), COL.reach);
    showMarks(m);
  }
  async function commandUnit(u) {
    view.active = u; view.cursor = [u.x, u.y]; showCard(u);
    for (;;) {
      // where to go
      const r = R.reach(B, u), m = new Map();
      for (const v of r.values()) m.set(key(v.x, v.y), COL.move);
      for (const v of r.values()) for (const [x, y] of R.attackTiles(B, u, v.x, v.y)) if (!m.has(key(x, y)) && R.unitAt(B, x, y) && R.unitAt(B, x, y).side !== me) m.set(key(x, y), COL.reach);
      showMarks(m);
      const dest = await new Promise((resolve) => { onTile = (t) => { const v = r.get(key(...t)); if (v) resolve(v); else { const o = R.unitAt(B, ...t); if (o && o.side === me && !o.done && o !== u) resolve({ switchTo: o }); } }; backFn = () => resolve(null); });
      clearMarks();
      if (!dest) { view.active = null; return null; }
      if (dest.switchTo) return dest.switchTo;
      const from = [u.x, u.y, u.dir];
      if (dest.x !== u.x || dest.y !== u.y) { R.moveTo(B, u, dest.x, dest.y, dest.path); await play(); } else u.moved = true;
      view.cursor = [u.x, u.y];
      const res = await actMenu(u);
      if (res === 'done') { view.active = null; return null; }
      // back: undo the move
      u.x = from[0]; u.y = from[1]; u.dir = from[2]; u.ax = u.x; u.ay = u.y; u.moved = false; u.from = null;
    }
  }
  async function actMenu(u) {
    for (;;) {
      const foes = R.attackTiles(B, u).filter(([x, y]) => { const o = R.unitAt(B, x, y); return o && o.side !== me; });
      const strats = u.s.strats.filter((id) => R.canCast(B, u, id));
      const usable = Object.keys(bag).filter((id) => USABLES[id] && bag[id] > 0 && R.itemTargets(B, u, id).length);
      const items = [
        { label: T('攻擊', 'Attack'), disabled: !foes.length },
        { label: T('策略', 'Strategy'), disabled: !strats.length || !!u.st.seal, right: u.s.strats.length ? `MP ${u.mp}` : '' },
        { label: T('道具', 'Item'), disabled: !usable.length },
        { label: T('待機', 'Wait') },
      ];
      backFn = null;
      const i = await menu(clear(hud.cmd), items, { title: nm(u.o.name) });
      if (i < 0) return 'back';
      if (i === 3) { R.wait(B, u); return 'done'; }
      if (i === 0) { if (await aimAttack(u, foes)) return 'done'; }
      if (i === 1) { if (await chooseStrat(u)) return 'done'; }
      if (i === 2) { if (await chooseItem(u, usable)) return 'done'; }
    }
  }
  // pick a target from tiles: hovering shows a forecast; tapping a target twice (or OK on the button) confirms
  function pickTarget(tiles, col, preview, area) {
    return new Promise((resolve) => {
      const set = new Map(tiles.map(([x, y]) => [key(x, y), [x, y]]));
      const base = new Map([...set.keys()].map((k) => [k, col]));
      showMarks(base);
      let chosen = null;
      const focus = (t) => {
        showMarks(base);
        if (!t || !set.has(key(...t))) { hud.fc.style.display = 'none'; return; }
        if (area) for (const [x, y] of area(t)) view.marks.set(key(x, y), COL.area);
        hud.fc.style.display = ''; clear(hud.fc).append(preview(t), el('div', { class: 'row', style: { marginTop: '6px', justifyContent: 'flex-end' } }, el('button', { class: 'btn', onclick: () => finish(null) }, T('取消', 'Cancel')), el('button', { class: 'btn primary', onclick: () => finish(t) }, T('確定', 'Confirm'))));
      };
      const first = tiles[0]; view.cursor = first; focus(first); chosen = first;
      onHover = (t) => { if (t && set.has(key(...t))) focus(t); };
      onTile = (t) => { if (!set.has(key(...t))) return; if (chosen && chosen[0] === t[0] && chosen[1] === t[1]) finish(t); else { chosen = t; view.cursor = t; focus(t); } };
      backFn = () => finish(null);
      const offK = pushKeys((k) => {
        if (k === 'back') return finish(null);
        if (k === 'ok') return finish(chosen);
        if (['left', 'right', 'up', 'down'].includes(k)) { const L = [...set.values()]; const i = L.findIndex((p) => chosen && p[0] === chosen[0] && p[1] === chosen[1]); chosen = L[(i + (k === 'right' || k === 'down' ? 1 : L.length - 1)) % L.length]; view.cursor = chosen; view.ensure(...chosen); focus(chosen); }
      });
      function finish(t) { offK(); clearMarks(); resolve(t); }
    });
  }
  function forecastBox(a, d, f) {
    const row = (who, x, y, F) => el('div', { class: 'fcrow' }, el('b', { style: { color: who.side === me ? 'var(--blue)' : 'var(--red)' } }, nm(who.o.name)),
      el('span', {}, F ? `${T('傷害', 'DMG')} ${F.dmg}` : T('無法反擊', 'No counter')), F ? el('span', { class: 'dim' }, `${T('命中', 'Hit')} ${F.hit}% · ${T('必殺', 'Crit')} ${F.crit}%${F.dbl ? ` · ${T('連擊', 'Double')} ${F.dbl}%` : ''}`) : null);
    const kill = f.dmg >= d.hp;
    return el('div', {}, el('div', { class: 'title small' }, T('攻擊預測', 'Forecast')),
      row(a, a, d, f), row(d, d, a, f.counter),
      el('div', { class: 'small', style: { marginTop: '4px', color: kill ? 'var(--gold2)' : 'var(--dim)' } }, kill ? T('可以擊退！', 'Can rout them!') : `${nm(d.o.name)} ${d.hp} → ${Math.max(0, d.hp - f.dmg)}`));
  }
  async function aimAttack(u, tiles) {
    const t = await pickTarget(tiles, COL.atk, (tt) => { const d = R.unitAt(B, ...tt); return forecastBox(u, d, R.forecast(B, u, d)); });
    if (!t) return false;
    R.attack(B, u, R.unitAt(B, ...t)); u.done = true; await play(); return true;
  }
  async function chooseStrat(u) {
    for (;;) {
      const list = u.s.strats.map((id) => { const S = STRATS[id], tg = R.stratTargets(B, u, id); return { id, label: T(S.name), right: `MP ${S.mp}`, disabled: u.mp < S.mp || !tg.length, tg }; });
      let descBox = null;
      const i = await menu(clear(hud.cmd), list, { title: `${T('策略', 'Strategies')}　MP ${u.mp}/${u.s.mp}`, onmove: (it) => { if (descBox) descBox.remove(); const S = STRATS[it.id]; descBox = el('div', { class: 'panel small stratdesc' }, el('b', {}, T(S.name)), ` · MP ${S.mp} · ${T('射程', 'range')} ${S.r}${S.a ? T(` · 範圍 ${S.a}`, ` · area ${S.a}`) : ''}`, el('div', { class: 'dim' }, stratKind(S)), it.disabled && u.mp >= S.mp ? el('div', { style: { color: 'var(--red)' } }, T('沒有可以施展的目標（地形不符或距離太遠）', 'No valid target (terrain or range)')) : null); hud.cmd.append(descBox); } });
      if (descBox) descBox.remove();
      if (i < 0) return false;
      const it = list[i], S = STRATS[it.id];
      const t = await pickTarget(it.tg, HELP_KINDS.has(S.kind) ? COL.help : COL.strat, (tt) => {
        const box = el('div', {}, el('div', { class: 'title small' }, T(S.name)));
        for (const [x, y] of R.areaOf(B, it.id, ...tt)) { const d = R.unitAt(B, x, y); if (!d || (HELP_KINDS.has(S.kind) ? d.side !== u.side : d.side === u.side)) continue; const f = R.stratForecast(B, u, it.id, d); box.append(el('div', { class: 'fcrow' }, el('b', { style: { color: d.side === me ? 'var(--blue)' : 'var(--red)' } }, nm(d.o.name)), el('span', {}, f.dmg != null ? `${T('傷害', 'DMG')} ${f.dmg}` : f.heal != null ? `${T('回復', 'Heal')} ${Math.min(f.heal, d.s.hp - d.hp)}` : stratKind(S)), f.hit != null && f.hit < 100 ? el('span', { class: 'dim' }, `${T('成功率', 'Chance')} ${f.hit}%`) : null)); }
        return box;
      }, S.a ? (tt) => R.areaOf(B, it.id, ...tt) : null);
      if (!t) continue;
      R.cast(B, u, it.id, ...t); u.done = true; await play(); return true;
    }
  }
  async function chooseItem(u, usable) {
    const list = usable.map((id) => ({ id, label: T(USABLES[id].name), right: `×${bag[id]}` }));
    const i = await menu(clear(hud.cmd), list, { title: T('道具', 'Items') });
    if (i < 0) return false;
    const id = list[i].id, t = await pickTarget(R.itemTargets(B, u, id), COL.help, (tt) => { const d = R.unitAt(B, ...tt), it = USABLES[id]; return el('div', {}, el('div', { class: 'title small' }, T(it.name)), el('div', { class: 'small' }, nm(d.o.name), '　', it.heal ? `${T('兵力', 'Troops')} +${Math.min(it.heal, d.s.hp - d.hp)}` : it.mph ? `MP +${Math.min(it.mph, d.s.mp - d.mp)}` : T('解除異常狀態', 'Cures ailments'))); });
    if (!t) return false;
    bag[id]--; if (!bag[id]) delete bag[id];
    R.useItem(B, u, id, R.unitAt(B, ...t)); u.done = true; await play(); return true;
  }
  async function aiRun(side) {
    const order = B.units.filter((u) => R.alive(u) && u.side === side && !u.done).sort((a, b) => dist(a) - dist(b));
    for (const u of order) {
      if (B.over) break; if (!R.alive(u) || u.done) continue;
      view.active = u; view.ensure(u.x, u.y);
      R.runPlan(B, u, R.plan(B, u)); await play(); await W(120);
      if (side === me && !auto) break;
    }
    view.active = null;
  }
  const dist = (u) => R.foesOf(B, u).reduce((d, f) => Math.min(d, Math.abs(f.x - u.x) + Math.abs(f.y - u.y)), 99);
  async function playerPhase() {
    const commander = B.units.find((u) => u.side === me && u.commander && R.alive(u));
    if (commander && B.turn === 1) view.centerOn(commander.x, commander.y, false);
    for (;;) {
      if (B.over) return;
      // confused units and the towers on our walls act on their own
      for (const u of B.units.filter((x) => R.alive(x) && x.side === me && !x.done && (x.st.conf || x.structure))) { R.runPlan(B, u, R.plan(B, u)); await play(); }
      const left = B.units.filter((u) => R.alive(u) && u.side === me && !u.done);
      if (!left.length || B.over) return;
      if (auto) { await aiRun(me); continue; }
      clear(hud.cmd);
      let pick = await pickUnit();
      while (pick && pick.unit) { const next = await commandUnit(pick.unit); clear(hud.cmd); pick = next ? { unit: next } : null; }
      if (pick === 'end') {
        const n = B.units.filter((u) => R.alive(u) && u.side === me && !u.done).length;
        if (n && (await modal(el('div', {}, T(`還有 ${n} 支部隊沒有行動，要結束回合嗎？`, `${n} units haven't acted. End the turn?`)), [T('結束回合', 'End turn'), T('取消', 'Cancel')])) !== 0) continue;
        return;
      }
    }
  }
  // ------------------------------------------------ the loop
  try {
    music('battle');
    await play();
    while (!B.over) {
      if (B.side === me) await playerPhase(); else await aiRun(them);
      if (B.over) break;
      R.endPhase(B); await play();
    }
    await play();
    await banner(B.over === me ? T('勝利！', 'Victory!') : T('敗北……', 'Defeat…'), 1600);
  } finally {
    alive2 = false; offKeys(); removeEventListener('resize', onResize);
  }
  return B;
}
