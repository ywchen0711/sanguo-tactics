// The campaign screen: the map, a panel for the city you pick, your officers' monthly orders, marching to war,
// and what follows a battle (spoils, captives). runCampaign() resolves when the game is won or lost.
import { T, EN } from '../i18n.js';
import { el, clear, $ui, menu, pushKeys, bar, wait, toast, modal, sheet } from './dom.js';
import { MapView } from './mapview.js';
import { portrait } from './sprites.js';
import { nm, cityName } from './names.js';
import { runBattle } from './battleui.js';
import { openEditor } from './editor.js';
import { LINES, STRATS, USABLES, GEAR, LEARN, tierOf } from '../data/rules.js';
import { battleStats, itemDef, fits, TREASURES } from '../core/officer.js';
import * as C from '../core/campaign.js';
import { THEMES } from '../core/mapgen.js';
import { RELICS, RARITY, fxText } from '../data/relics.js';
import { music, sfx } from '../audio.js';

const ATTR = [['lead', '統率', 'LEAD'], ['war', '武力', 'WAR'], ['int', '智力', 'INT'], ['pol', '政治', 'POL'], ['cha', '魅力', 'CHA']];
const fname = (G, fid) => (fid ? nm(G.factions[fid].name) : T('無主', 'Unclaimed'));
const face = (o, col, px = 40) => { const c = el('canvas', { width: 32, height: 32, class: 'face', style: { width: px + 'px', height: px + 'px' } }); c.getContext('2d').drawImage(portrait(o, col), 0, 0); return c; };

export async function runCampaign(G, { save, quit }) {
  const cv = document.getElementById('view'), ui = clear();
  const map = new MapView(cv);
  const fitMap = () => { map.inset = innerWidth > 760 ? { t: 64, r: 360 } : { t: 60, b: Math.round(innerHeight * 0.47) }; map.resize(); };
  fitMap();
  let selected = G.factions[G.player].capital, alive = true, last = performance.now(), busy = false;
  const top = el('div', { class: 'panel topbar' }), side = el('div', { class: 'panel citypanel scroll' }), chron = el('div', { class: 'panel chron small' });
  ui.append(top, side, chron);
  const frame = (now) => { if (!alive) return; const dt = (now - last) / 1000; last = now; try { map.sel = selected; map.draw(G, dt); } catch (e) { console.error(e); } requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  const onResize = () => fitMap(); addEventListener('resize', onResize);
  // tap a city; drag to pan when zoomed; wheel to zoom
  let down = null, dragged = false;
  cv.onpointerdown = (e) => { down = { x: e.clientX, y: e.clientY }; dragged = false; };
  cv.onpointermove = (e) => { if (!down) return; if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) dragged = true; if (dragged && map.zoom > 1) { map.pan(e.clientX - down.x, e.clientY - down.y); down = { x: e.clientX, y: e.clientY }; } };
  cv.onpointerup = () => { down = null; };
  cv.onclick = (e) => { if (dragged) return; const r = cv.getBoundingClientRect(), c = map.pick(G, e.clientX - r.left, e.clientY - r.top); if (c && !busy) { selected = c.id; sfx('ok'); drawSide(); } };
  cv.onwheel = (e) => { e.preventDefault(); map.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15); };
  music('world');

  // ------------------------------------------------ top bar
  function drawTop() {
    const f = G.factions[G.player], mine = C.citiesOf(G, G.player), offs = C.officersOf(G, G.player);
    const gold = mine.reduce((s, c) => s + c.gold, 0), troops = mine.reduce((s, c) => s + c.troops, 0);
    clear(top).append(
      el('span', { class: 'seal', style: { background: f.color } }, nm(f.name).slice(0, EN ? 3 : 1)),
      el('b', { class: 'date' }, T(`${G.year}年 ${G.month}月`, `${['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][G.month]} ${G.year}`)),
      el('span', { class: 'small' }, `${T('城', 'Cities')} ${mine.length}/${G.cities.length} · ${T('武將', 'Officers')} ${offs.length} · ${T('金', 'Gold')} ${gold} · ${T('兵', 'Troops')} ${troops}`),
      el('span', { class: 'grow' }),
      el('button', { class: 'btn mission', onclick: () => missionBoard() }, T(`任務 ${G.missions.length}`, `Missions ${G.missions.length}`)),
      el('button', { class: 'btn', onclick: () => officerList() }, T('武將', 'Officers')),
      el('button', { class: 'btn', onclick: () => bagSheet() }, T('道具', 'Items')),
      el('button', { class: 'btn', onclick: () => chronicle() }, T('記錄', 'Chronicle')),
      el('button', { class: 'btn', title: T('隨時調整任何數值', 'Change any value at any time'), onclick: () => openEditor(G, { onChange: () => drawSide(), onClose: () => { save(); drawSide(); } }) }, T('⚙ 修改', '⚙ Edit')),
      el('button', { class: 'btn', onclick: () => sysMenu() }, T('選單', 'Menu')),
      el('button', { class: 'btn primary', onclick: () => endMonth() }, T('結束月份 ▶', 'End month ▶')));
    const recent = G.log.slice(-3).reverse();
    clear(chron).append(recent.map((l) => el('div', {}, el('span', { class: 'dim' }, `${l.y}.${l.m} `), T(...l.text))));
  }
  // ------------------------------------------------ the city panel
  function drawSide() {
    drawTop();
    const c = G.cities[selected], mine = c.owner === G.player, f = c.owner && G.factions[c.owner];
    const offs = C.officersIn(G, c), free = C.freeIn(G, c);
    map.marks.clear();
    const stat = (label, v, max) => el('div', { class: 'cstat' }, el('span', { class: 'dim' }, label), el('b', {}, max ? `${v}/${max}` : v), max ? bar(v, max, '#c8a040') : null);
    clear(side).append(
      el('div', { class: 'row', style: { alignItems: 'baseline' } }, el('span', { class: 'title', style: { fontSize: '22px' } }, cityName(c.name)), el('span', { class: 'tag', style: { color: f ? f.color : 'var(--dim)', borderColor: f ? f.color : 'var(--line)' } }, fname(G, c.owner)), el('span', { class: 'dim small' }, '★'.repeat(c.size) + ' · ' + T(THEMES[C.themeFor(c)].name))),
      el('div', { class: 'cgrid' },
        stat(T('金', 'Gold'), c.gold), stat(T('糧', 'Food'), c.food), stat(T('兵', 'Troops'), c.troops, C.capOf(c)),
        stat(T('農業', 'Farming'), c.farm, c.farmMax), stat(T('商業', 'Commerce'), c.trade, c.tradeMax), stat(T('城防', 'Walls'), c.wall, c.wallMax)),
      el('div', { class: 'defrow small' }, el('span', { class: 'dim' }, T('防守設施', 'Defences')), ...Object.entries(C.FACILITIES).map(([k, F]) => el('span', { class: 'tag', title: T(F.desc) }, `${T(F.name)} ${k === 'moat' ? (c.fac.moat ? '✓' : '—') : k === 'trap' && !mine ? '?' : c.fac[k] || 0}`))),
    );
    // officers here
    side.append(el('div', { class: 'title small sect' }, T(`武將（${offs.length}）`, `Officers (${offs.length})`)));
    const list = el('div', { class: 'list' });
    for (const o of offs.sort((a, b) => (C.isLord(G, b) ? 1 : 0) - (C.isLord(G, a) ? 1 : 0) || b.lv - a.lv)) list.append(offRow(o, f ? f.color : '#888', () => officerSheet(o)));
    if (!offs.length) list.append(el('div', { class: 'small dim' }, mine ? T('這座城沒有武將。', 'No officers here.') : T('沒有武將駐守（只有守備兵）。', 'No officers — only a garrison.')));
    side.append(list);
    if (mine && free.length) {
      side.append(el('div', { class: 'title small sect' }, T('在野人才', 'Talent at large')));
      for (const t of free) side.append(el('div', { class: 'item' }, face(t, '#666', 28), el('span', { class: 'grow' }, nm(t.name), el('span', { class: 'dim small' }, ` Lv${t.lv} · ${T(LINES[t.line].names[tierOf(t.lv)])}`)), el('button', { class: 'btn', onclick: () => doRecruit(c, t) }, T('登用', 'Recruit'))));
    }
    // orders
    if (mine) {
      side.append(el('div', { class: 'title small sect' }, T('指令', 'Orders')));
      const cmds = el('div', { class: 'cmds' });
      for (const [k, cm] of Object.entries(C.COMMANDS)) cmds.append(el('button', { class: 'btn', title: T(cm.desc), onclick: () => order(c, k) }, T(cm.name), cm.cost ? el('span', { class: 'dim small' }, ` ${cm.cost}`) : null));
      cmds.append(el('button', { class: 'btn', onclick: () => moveOrder(c) }, T('移動', 'Move')), el('button', { class: 'btn', onclick: () => sendOrder(c) }, T('輸送', 'Transport')), el('button', { class: 'btn', onclick: () => shop(c) }, T('市場', 'Market')));
      const targets = c.adj.map((j) => G.cities[j]).filter((d) => d.owner !== G.player);
      cmds.append(el('button', { class: 'btn war', disabled: !targets.length || !offs.some((o) => !o.done) || null, onclick: () => warOrder(c) }, T('出征', 'March')));
      side.append(cmds);
      for (const d of targets) map.marks.set(d.id, 'rgba(255,80,40,.8)');
    } else {
      const from = c.adj.map((j) => G.cities[j]).filter((d) => d.owner === G.player);
      if (from.length) { side.append(el('div', { class: 'row', style: { marginTop: '10px' } }, el('button', { class: 'btn war', onclick: () => warOrder(from.length === 1 ? from[0] : null, c) }, T(`進攻 ${cityName(c.name)}`, `Attack ${cityName(c.name)}`)))); for (const d of from) map.marks.set(d.id, 'rgba(80,160,255,.8)'); }
      else side.append(el('div', { class: 'small dim', style: { marginTop: '8px' } }, T('沒有與我方城市相鄰，無法進攻。', 'Not next to any of your cities.')));
    }
  }
  function offRow(o, col, onclick) {
    const s = battleStats(o);
    return el('div', { class: 'item' + (o.done && o.fac === G.player ? ' off' : ''), onclick }, face(o, col, 30),
      el('div', { class: 'grow' }, el('div', {}, nm(o.name), C.isLord(G, o) ? el('span', { class: 'tag lord' }, T('君主', 'Lord')) : null, o.done && o.fac === G.player ? el('span', { class: 'tag' }, T('已行動', 'Busy')) : null),
        el('div', { class: 'small dim' }, `${T(s.cls)} Lv${o.lv} · ${ATTR.map(([k, z]) => o[k]).join('/')}`)),
      el('span', { class: 'small dim' }, `${T('兵', '')}${s.hp}`));
  }
  // pick one of the city's free officers for an order (best for it first)
  async function pickOfficer(c, by, title) {
    const offs = C.officersIn(G, c).filter((o) => !o.done).sort((a, b) => by(b) - by(a));
    if (!offs.length) { toast(T('這座城的武將本月都已經行動了', 'Everyone here is busy this month')); return null; }
    return new Promise((resolve) => {
      const close = sheet(el('div', {}, el('div', { class: 'title' }, title), el('div', { class: 'list scroll', style: { maxHeight: '60vh' } }, offs.map((o) => offRow(o, G.factions[G.player].color, () => { close(); resolve(o); }))), el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, el('button', { class: 'btn', onclick: () => { close(); resolve(null); } }, T('取消', 'Cancel')))), { onBack: () => resolve(null) });
    });
  }
  async function order(c, k) {
    if (k === 'build') return buildOrder(c);
    const by = { farm: (o) => o.pol, trade: (o) => o.pol, wall: (o) => o.lead, draft: (o) => o.lead + o.cha, train: (o) => -o.lv, search: (o) => o.int }[k];
    const o = await pickOfficer(c, by, `${T(C.COMMANDS[k].name)}：${T(C.COMMANDS[k].desc)}`); if (!o) return;
    const [ok, msg] = C.doCommand(G, o, k); sfx(ok ? 'ok' : 'hurt'); toast(`${nm(o.name)}：${T(...msg)}`, 2200); drawSide(); save();
  }
  async function buildOrder(c) {
    const keys = Object.keys(C.FACILITIES);
    const labels = keys.map((k) => { const F = C.FACILITIES[k]; return `${T(F.name)}　${C.facCount(c, k)}/${F.max(c)}　${T('金', 'gold')} ${F.cost}`; });
    const r = await modal(el('div', {}, el('div', { class: 'title' }, T('修建防守設施', 'Build defences')), el('div', { class: 'small dim' }, T(`城內金錢 ${c.gold}`, `City gold ${c.gold}`)), keys.map((k) => el('div', { class: 'small', style: { marginTop: '4px' } }, el('b', {}, T(C.FACILITIES[k].name)), '：', T(C.FACILITIES[k].desc)))), [...labels, T('取消', 'Cancel')]);
    if (r < 0 || r >= keys.length) return;
    const o = await pickOfficer(c, (x) => x.lead, T(`派誰去修建${T(C.FACILITIES[keys[r]].name)}？`, `Who will build the ${C.FACILITIES[keys[r]].name[1]}?`)); if (!o) return;
    const [ok, msg] = C.build(G, o, keys[r]); sfx(ok ? 'ok' : 'hurt'); toast(T(...msg), 2200); drawSide(); save();
  }
  // ------------------------------------------------ training missions
  const idleAll = () => C.officersOf(G, G.player).filter((o) => !o.done).length;
  const goalTag = (K) => (K.vip ? T(`護送 ${K.limit} 回合`, `Escort ${K.limit} turns`) : K.goal === 'survive' ? T(`堅守 ${K.limit} 回合`, `Hold ${K.limit} turns`) : K.goal === 'leader' ? T('擊敗首領', 'Defeat the leader') : T('全滅敵軍', 'Rout them'));
  function missionBoard() {
    const avg = C.avgLevel(G), idle = idleAll();
    const box = el('div', {}, el('div', { class: 'title' }, T('鍛鍊任務', 'Training missions')), el('div', { class: 'small dim' }, T('派最多 6 名武將出戰（可以從任何一座我方城市派出，不消耗城內兵力）。完成任務獲得經驗、金錢與寶物，參加的武將都會得到額外經驗；地圖上的寶箱走上去就能打開。任務每月更新。', 'Send up to 6 officers from any of your cities (no city troops are used). Win for experience, gold and treasure — everyone who goes earns bonus experience; walk onto a chest to open it. New missions every month.')),
      // the training ground: always open
      el('div', { class: 'item drill' }, el('div', { class: 'grow' }, el('b', {}, T('演武場', 'Training Ground')), el('div', { class: 'small dim' }, T(C.MISSION_KINDS.drill.desc)), el('div', { class: 'small' }, T(`隨時可以出戰，次數不限（每位武將每月一次）。目前主力平均 Lv${avg}`, `Open any time, as often as you like (each officer once a month). Your best average Lv${avg}`))),
        el('div', { class: 'row' }, [[-3, T('輕鬆', 'Easy')], [0, T('普通', 'Even')], [5, T('困難', 'Hard')], [7, T('地獄', 'Brutal')]].map(([d, label]) => el('button', { class: 'btn', disabled: !idle || null, onclick: () => { close(); goMission(C.drillMission(G, G.factions[G.player].capital, Math.max(1, avg + d))); } }, `${label} Lv${Math.max(1, avg + d)}`)))),
      el('div', { class: 'list', style: { marginTop: '8px' } }, G.missions.length ? G.missions.map((m) => { const K = C.MISSION_KINDS[m.kind], c = G.cities[m.city];
        return el('div', { class: 'item mission' + (K.legend ? ' legend' : '') }, el('div', { class: 'grow' }, el('div', {}, el('b', {}, T(K.name)), el('span', { class: 'stars' }, ' ' + '★'.repeat(m.stars) + '☆'.repeat(5 - m.stars)), el('span', { class: 'tag' }, goalTag(K))),
          el('div', { class: 'small dim' }, T(K.desc)),
          el('div', { class: 'small' }, `${T('地點', 'At')} ${cityName(c.name)} · ${T('建議', 'Suggested')} Lv${m.lv} · ${T('敵軍', 'Foes')} ${m.foes} · ${T(THEMES[m.theme].name)}`),
          el('div', { class: 'small', style: { color: RARITY[m.rarity].col } }, `${T('報酬', 'Reward')}：${T('金', 'gold')} ${m.gold} · ${T(RARITY[m.rarity].name)}${T('寶物', ' treasure')}${C.MISSION_KINDS[m.kind].champion ? T(' · 猛將的神兵', ' · the champion\'s weapon') : ''}`)),
          el('button', { class: 'btn war', disabled: !idle || null, onclick: () => { close(); goMission(m); } }, idle ? T('出發', 'Go') : T('無人可派', 'No one free'))); }) : el('div', { class: 'dim' }, T('本月的任務都完成了，可以去演武場。', 'All of this month\u2019s missions are done — try the training ground.'))),
      el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, el('button', { class: 'btn primary', onclick: () => close() }, T('關閉', 'Close'))));
    const close = sheet(box, { wide: true });
  }
  async function goMission(m) {
    const K = C.MISSION_KINDS[m.kind];
    // send them from any city with someone free (the mission's own city first)
    const from = C.citiesOf(G, G.player).filter((x) => C.officersIn(G, x).some((o) => !o.done)).sort((a, b) => (b.id === m.city) - (a.id === m.city) || C.officersIn(G, b).length - C.officersIn(G, a).length);
    if (!from.length) return toast(T('沒有可以派出的武將', 'No one is free'));
    const j = from.length === 1 ? 0 : await choose(T('從哪座城派出武將？', 'Send officers from which city?'), from.map((x) => `${cityName(x.name)}（${T('可派', 'free')} ${C.officersIn(G, x).filter((o) => !o.done).length}）`));
    if (j < 0) return;
    const c = from[j];
    const picked = await deploy(c, `${T(K.name)} ${K.hidden ? `Lv${m.lv}` : '★'.repeat(m.stars)}`, null, 6);
    if (!picked) return;
    busy = true; alive = false; removeEventListener('resize', onResize);
    const B = C.missionSetup(G, m, picked);
    const lead = B.units.find((u) => u.side === 'def' && u.commander);
    await modal(el('div', {}, el('div', { class: 'title', style: { fontSize: '22px' } }, T(K.name)), el('div', {}, T(K.desc)),
      K.legend && lead ? el('div', { style: { marginTop: '6px', color: 'var(--gold2)' } }, T(`敵將：${lead.o.name}（Lv${lead.o.lv}）`, `Foe: ${nm(lead.o.name)} (Lv${lead.o.lv})`)) : null,
      el('div', { class: 'small dim', style: { marginTop: '6px' } }, T(`${THEMES[m.theme].name[0]} · 敵軍 ${m.foes} 隊${B.waves && B.waves.length ? ` · 援兵 ${B.waves.length} 波` : ''} · 寶箱 ${B.map.chests.length} 個 · ${goalTag(K)} · 限 ${B.limit} 回合`, `${THEMES[m.theme].name[1]} · ${m.foes} enemy units${B.waves && B.waves.length ? ` · ${B.waves.length} waves` : ''} · ${B.map.chests.length} chests · ${goalTag(K)} · ${B.limit} turns`))), [T('出擊', 'Go')]);
    await runBattle(B, { bag: G.bag, G });
    const res = C.settleMission(G, B, m);
    clear(); alive = true; busy = false; last = performance.now(); fitMap(); map.bg = null; addEventListener('resize', onResize); requestAnimationFrame(frame); ui.append(top, side, chron); music('world');
    const mine = B.units.filter((u) => u.side === 'atk');
    await modal(el('div', {}, el('div', { class: 'title', style: { fontSize: '24px', color: res.won ? 'var(--gold2)' : 'var(--red)' } }, res.won ? T('任務完成！', 'Mission complete!') : T('任務失敗……', 'Mission failed…')),
      mine.filter((u) => !u.o.militia).map((u) => el('div', { class: 'small' }, nm(u.o.name), el('span', { class: 'dim' }, ` Lv${u.o.lv} · EXP +${(B.exp[u.o.id] || 0) + res.bonus}`), res.ups.includes(u.o) ? el('span', { style: { color: 'var(--gold2)' } }, ' LEVEL UP!') : null)),
      el('div', { class: 'small dim' }, T(`（含任務獎勵經驗 +${res.bonus}）`, `(including a mission bonus of +${res.bonus})`)),
      res.won && res.gold ? el('div', { style: { marginTop: '6px' } }, T(`金 +${res.gold}`, `Gold +${res.gold}`)) : null,
      [...res.items, ...res.loot].length ? el('div', { style: { marginTop: '6px' } }, el('div', { class: 'title small' }, T('獲得', 'Obtained')), [...res.items, ...res.loot].map((id) => itemLine(id))) : null,
      !res.won ? el('div', { class: 'small dim' }, T('（武將們獲得的經驗與寶箱仍然保留）', '(experience and opened chests are kept)')) : null), [T('確定', 'OK')], { wide: true });
    save(); drawSide();
  }
  async function doRecruit(c, t) {
    const o = await pickOfficer(c, (x) => C.recruitChance(G, x, t), T(`派誰去登用 ${nm(t.name)}？`, `Who will recruit ${nm(t.name)}?`)); if (!o) return;
    const [, msg] = C.recruit(G, o, t); sfx('ok'); toast(T(...msg), 2200); drawSide(); save();
  }
  async function moveOrder(c) {
    const dests = c.adj.map((j) => G.cities[j]).filter((d) => d.owner === G.player);
    if (!dests.length) return toast(T('沒有相鄰的我方城市', 'No neighbouring city of yours'));
    const o = await pickOfficer(c, (x) => x.lv, T('移動哪位武將？', 'Move whom?')); if (!o) return;
    const j = await choose(T(`${nm(o.name)} 要前往哪裡？`, `Where should ${nm(o.name)} go?`), dests.map((d) => cityName(d.name)));
    if (j < 0) return;
    const [, msg] = C.moveOfficer(G, o, dests[j].id); toast(T(...msg)); drawSide(); save();
  }
  function choose(title, labels) { return modal(el('div', { class: 'title' }, title), [...labels, T('取消', 'Cancel')]).then((i) => (i === labels.length ? -1 : i)); }
  async function sendOrder(c) {
    const dests = c.adj.map((j) => G.cities[j]).filter((d) => d.owner === G.player);
    if (!dests.length) return toast(T('沒有相鄰的我方城市', 'No neighbouring city of yours'));
    const j = dests.length === 1 ? 0 : await choose(T('運送到哪裡？', 'Send to which city?'), dests.map((d) => cityName(d.name))); if (j < 0) return;
    const d = dests[j], amt = { gold: 0, food: 0, troops: 0 };
    const slider = (k, label, max) => { const v = el('b', {}, '0'); const inp = el('input', { type: 'range', min: 0, max, step: Math.max(1, Math.round(max / 50)), value: 0, oninput: (e) => { amt[k] = +e.target.value; v.textContent = amt[k]; } }); return el('div', { class: 'slider' }, el('span', {}, label), inp, v); };
    const r = await modal(el('div', {}, el('div', { class: 'title' }, T(`${cityName(c.name)} → ${cityName(d.name)}`, `${cityName(c.name)} → ${cityName(d.name)}`)), slider('gold', T('金', 'Gold'), c.gold), slider('food', T('糧', 'Food'), c.food), slider('troops', T('兵', 'Troops'), Math.min(c.troops, C.capOf(d) - d.troops))), [T('運送', 'Send'), T('取消', 'Cancel')]);
    if (r !== 0) return;
    const [, msg] = C.transport(G, c.id, d.id, amt); toast(T(...msg)); drawSide(); save();
  }
  function shop(c) {
    const ids = C.shopOf(G, c);
    const box = el('div', {});
    const render = () => {
      clear(box).append(el('div', { class: 'row' }, el('span', { class: 'title grow' }, T(`${cityName(c.name)} 市場`, `${cityName(c.name)} market`)), el('span', {}, `${T('城內金錢', 'City gold')} ${c.gold}`)),
        el('div', { class: 'list scroll', style: { maxHeight: '62vh' } }, ids.map((id) => { const it = USABLES[id] || GEAR[id]; return el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', {}, T(it.name), G.bag[id] ? el('span', { class: 'dim small' }, ` ×${G.bag[id]}`) : null), el('div', { class: 'small dim' }, itemText(it))), el('button', { class: 'btn', disabled: c.gold < it.price || null, onclick: () => { C.buy(G, c, id); sfx('ok'); render(); save(); } }, `${it.price}`)); })),
        el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, el('button', { class: 'btn primary', onclick: () => { close(); drawSide(); } }, T('離開', 'Leave'))));
    };
    render(); const close = sheet(box, { onBack: () => drawSide() });
  }
  // ------------------------------------------------ war
  async function warOrder(src, target = null) {
    if (!src) { const from = G.cities[target.id].adj.map((j) => G.cities[j]).filter((d) => d.owner === G.player); const j = await choose(T('從哪座城出兵？', 'March from which city?'), from.map((d) => cityName(d.name))); if (j < 0) return; src = from[j]; }
    if (!target) {
      const ts = src.adj.map((j) => G.cities[j]).filter((d) => d.owner !== G.player);
      const j = ts.length === 1 ? 0 : await choose(T('進攻哪座城？', 'Attack which city?'), ts.map((d) => `${cityName(d.name)}（${fname(G, d.owner)} · ${T('兵', 'troops')} ${d.troops}）`)); if (j < 0) return;
      target = ts[j];
    }
    const picked = await deploy(src, T(`出征 ${cityName(target.name)}`, `March on ${cityName(target.name)}`), target);
    if (!picked) return;
    await fight({ af: G.player, from: src.id, to: target.id, atkOfficers: picked, atkTroops: picked.troops });
  }
  // choose who marches (up to ten); shows the troops each would lead
  function deploy(c, title, enemyCity, cap = C.MAX_DEPLOY) {
    const mission = cap < C.MAX_DEPLOY;
    return new Promise((resolve) => {
      const offs = C.officersIn(G, c).filter((o) => !o.done || (enemyCity == null && !mission)).sort((a, b) => C.quality(b) - C.quality(a));
      if (!offs.length) { toast(T('沒有可以出陣的武將', 'No one free to march')); return resolve(null); }
      const sel = new Set(offs.filter((o) => !(C.isLord(G, o) && offs.length > 3)).slice(0, Math.min(cap, offs.length)).map((o) => o.id));
      // troops each officer leads: the player sets them; by default, the city's soldiers shared out by each one's maximum
      const pool = c.troops, MIN = 100, alloc = {};
      const maxOf = (o) => battleStats(o).hp, chosen = () => offs.filter((o) => sel.has(o.id));
      const total = () => chosen().reduce((n, o) => n + (alloc[o.id] || 0), 0);
      const share = (frac) => { const L = chosen(), need = L.reduce((n, o) => n + maxOf(o), 0), k = need ? Math.min(1, pool * frac / need) : 0; for (const o of L) alloc[o.id] = Math.max(MIN, Math.floor(maxOf(o) * k / 10) * 10); fit(); };
      const fillInOrder = () => { let left = pool; for (const o of chosen()) { alloc[o.id] = Math.max(MIN, Math.min(maxOf(o), left)); left -= alloc[o.id]; } fit(); };
      const fit = () => { let over = total() - pool; for (const o of chosen().reverse()) { if (over <= 0) break; const cut = Math.min(over, (alloc[o.id] || 0) - MIN); if (cut > 0) { alloc[o.id] -= cut; over -= cut; } } };
      share(enemyCity ? 0.85 : 1);
      const box = el('div', {});
      let sumLine = null;
      const updateSum = () => { if (sumLine) { const t = total(); sumLine.textContent = T(`出陣兵力 ${t} / 城內 ${pool}　留守 ${pool - t}`, `${t} of ${pool} troops march · ${pool - t} stay home`); sumLine.style.color = t > pool ? 'var(--red)' : ''; } };
      const render = () => {
        const foes = enemyCity ? (C.officersIn(G, enemyCity).length ? C.officersIn(G, enemyCity) : null) : null;
        sumLine = el('b', {});
        const row = (o) => {
          const s2 = battleStats(o), on = sel.has(o.id), mx = maxOf(o);
          const head = el('div', { class: 'item' + (on ? ' on' : ''), onclick: () => { if (on) { sel.delete(o.id); delete alloc[o.id]; } else if (sel.size < cap) { sel.add(o.id); alloc[o.id] = Math.max(MIN, Math.min(mx, pool - total())); } render(); } },
            el('span', { class: 'check' }, on ? '☑' : '☐'), face(o, G.factions[G.player].color, 28),
            el('div', { class: 'grow' }, el('div', {}, nm(o.name), C.isLord(G, o) ? el('span', { class: 'tag lord' }, T('君主', 'Lord')) : null), el('div', { class: 'small dim' }, `${T(s2.cls)} Lv${o.lv} · ${T('移動', 'Mv')}${s2.mov} · ${T('上限', 'max')} ${mx}`)),
            mission ? el('span', { class: 'small' }, `${mx}`) : null);
          if (mission || !on) return head;
          // the troop slider and number for a chosen officer
          const num = el('input', { type: 'number', min: MIN, max: mx, step: 10, value: alloc[o.id] });
          const rng = el('input', { type: 'range', min: MIN, max: mx, step: 10, value: alloc[o.id] });
          const set = (v) => { v = Math.max(MIN, Math.min(mx, Math.round(+v || 0))); const others = total() - (alloc[o.id] || 0); v = Math.min(v, Math.max(MIN, pool - others)); alloc[o.id] = v; num.value = v; rng.value = v; updateSum(); };
          num.onchange = (e) => set(e.target.value); rng.oninput = (e) => set(e.target.value);
          for (const x of [num, rng]) { x.onclick = (e) => e.stopPropagation(); x.onpointerdown = (e) => e.stopPropagation(); }
          return el('div', { class: 'alloc' }, head, el('div', { class: 'allocrow' }, el('span', { class: 'small dim' }, T('帶兵', 'Troops')), rng, num, el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); set(mx); } }, T('補滿', 'Max'))));
        };
        clear(box).append(el('div', { class: 'title' }, title),
          enemyCity ? el('div', { class: 'small dim' }, T(`敵方：${fname(G, enemyCity.owner)} · 兵 ${enemyCity.troops} · 武將 ${foes ? foes.length : 0}${foes ? '' : '（守備兵）'} · 城防 ${enemyCity.wall}`, `Enemy: ${fname(G, enemyCity.owner)} · ${enemyCity.troops} troops · ${foes ? foes.length : 0} officers${foes ? '' : ' (garrison)'} · walls ${enemyCity.wall}`)) : null,
          mission ? el('div', { class: 'small', style: { margin: '4px 0' } }, T(`選擇出戰武將（最多 ${cap} 人）：已選 ${sel.size} 人 · 鍛鍊任務以滿兵力出戰，不消耗城內士兵`, `Choose up to ${cap}: ${sel.size} chosen · missions go at full strength and use no city troops`))
            : el('div', { class: 'allocbar' }, el('div', { class: 'small' }, T(`選擇出陣武將（最多 ${cap} 人）：已選 ${sel.size} 人　`, `Choose up to ${cap}: ${sel.size} chosen · `), sumLine),
              el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => { share(enemyCity ? 0.85 : 1); render(); } }, T('按比例分配', 'Share out')), el('button', { class: 'btn small', onclick: () => { fillInOrder(); render(); } }, T('依序補滿', 'Fill in order')), el('button', { class: 'btn small', onclick: () => { for (const o of chosen()) alloc[o.id] = MIN; render(); } }, T('全部最少', 'All minimum')))),
          el('div', { class: 'list scroll', style: { maxHeight: '50vh' } }, offs.map(row)),
          el('div', { class: 'small dim', style: { marginTop: '4px' } }, mission ? T('提示：君主出陣時就是主將，君主撤退就會戰敗。', 'Tip: a lord who marches is the commander; losing them loses the battle.') : T('提示：每位武將最多帶到自己的兵力上限，最少 100。沒帶出去的士兵留在城裡。君主出陣時就是主將，君主撤退就會戰敗。', 'Tip: each officer leads up to their own maximum (at least 100). Soldiers not sent stay in the city. A lord who marches is the commander; losing them loses the battle.')),
          el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, el('button', { class: 'btn', onclick: () => { close(); resolve(null); } }, T('取消', 'Cancel')),
            el('button', { class: 'btn primary', disabled: !sel.size || null, onclick: () => { if (!mission && total() > pool) return toast(T('出陣兵力超過城內兵力', 'More troops than the city has')); close(); const L = chosen(); L.troops = mission ? null : Object.fromEntries(L.map((o) => [o.id, alloc[o.id]])); resolve(L); } }, mission ? T('出發！', 'Set out!') : enemyCity ? T('出陣！', 'March!') : T('迎擊！', 'Defend!'))));
        updateSum();
      };
      render(); const close = sheet(box, { onBack: () => resolve(null), outside: false });
    });
  }
  async function fight(args, { defending = false, auto = false } = {}) {
    busy = true; alive = false; removeEventListener('resize', onResize);
    let B = C.battleSetup(G, args);
    if (auto) C.autoBattle(B);
    else {
      await preBattle(B, defending);
      B = await runBattle(B, { bag: G.bag, G });
    }
    const res = C.settle(G, B);
    // back to the map
    clear(); alive = true; busy = false; last = performance.now(); fitMap(); map.bg = null; addEventListener('resize', onResize); requestAnimationFrame(frame); ui.append(top, side, chron); music('world');
    await results(B, res, auto);
    await captives();
    save(); drawSide();
    if (G.over) await ending();
  }
  async function preBattle(B, defending) {
    const c = G.cities[B.to], th = THEMES[B.map.theme];
    const side2 = (s) => B.sides[s].units.map((m) => el('div', { class: 'small' }, nm(m.o.name), el('span', { class: 'dim' }, ` ${T(LINES[m.o.line].names[tierOf(m.o.lv)])} Lv${m.o.lv} · ${m.troops}`)));
    await modal(el('div', {}, el('div', { class: 'title', style: { fontSize: '22px' } }, T(`${cityName(c.name)}之戰`, `The Battle of ${cityName(c.name)}`)), el('div', { class: 'small dim' }, T(th.name), ' · ', defending ? T('守城戰', 'Defending the city') : T('攻城戰', 'Storming the city')),
      el('div', { class: 'two' }, el('div', {}, el('div', { class: 'title small', style: { color: 'var(--blue)' } }, `${B.sides.atk.name}${T('軍', '')}`), side2('atk')), el('div', {}, el('div', { class: 'title small', style: { color: 'var(--red)' } }, `${B.sides.def.name}${T('軍', '')}`), side2('def')))), [T('開戰', 'To battle')], { wide: true });
  }
  async function results(B, res, auto) {
    const meWon = (res.atkWon && res.af === G.player) || (!res.atkWon && res.df === G.player);
    const mine = B.units.filter((u) => (u.side === 'atk' ? res.af : res.df) === G.player && u.o.id >= 0);
    const lines = mine.map((u) => el('div', { class: 'small' }, nm(u.o.name), el('span', { class: 'dim' }, ` Lv${u.o.lv} · EXP +${B.exp[u.o.id] || 0}${u.gone ? T(' · 撤退', ' · fell back') : ''}`)));
    await modal(el('div', {}, el('div', { class: 'title', style: { fontSize: '24px', color: meWon ? 'var(--gold2)' : 'var(--red)' } }, meWon ? T('勝利！', 'Victory!') : T('敗北……', 'Defeat…')),
      el('div', {}, res.atkWon ? T(`${cityName(res.city.name)} 落入${fname(G, res.af)}手中。`, `${cityName(res.city.name)} falls to ${fname(G, res.af)}.`) : T(`${cityName(res.city.name)} 守住了。`, `${cityName(res.city.name)} holds.`)),
      auto ? el('div', { class: 'small dim' }, T('（委任作戰）', '(fought by your officers)')) : null,
      lines.length ? el('div', { style: { marginTop: '8px' } }, lines) : null,
      [...(res.items || []), ...(res.loot || [])].length ? el('div', { style: { marginTop: '6px' } }, el('div', { class: 'title small' }, T('戰利品', 'Spoils')), [...(res.items || []), ...(res.loot || [])].map((id) => itemLine(id))) : null,
      res.fortune ? el('div', { class: 'small' }, T(`招財：金 +${res.fortune}`, `Fortune: gold +${res.fortune}`)) : null,
      res.captured.length ? el('div', { class: 'small', style: { marginTop: '6px' } }, T('俘虜：', 'Captured: ') + res.captured.map((o) => nm(o.name)).join(T('、', ', '))) : null), [T('確定', 'OK')]);
  }
  // decide the fate of each captive taken by the player
  async function captives() {
    for (const id of [...G.captives]) {
      const o = G.officers[id], chance = C.recruitChance(G, { ...C.lordOf(G, G.player), fac: G.player }, o);
      const r = await modal(el('div', {}, el('div', { class: 'row' }, face(o, '#666', 64), el('div', {}, el('div', { class: 'title' }, T(`俘虜：${nm(o.name)}`, `Captive: ${nm(o.name)}`)), el('div', { class: 'small dim' }, `${T(LINES[o.line].names[tierOf(o.lv)])} Lv${o.lv} · ${ATTR.map(([k, z, e]) => `${T(z, e)}${o[k]}`).join(' ')}`), el('div', { class: 'small' }, T(`登用成功率約 ${chance}%`, `About ${chance}% to win over`))))), [T('登用', 'Recruit'), T('釋放', 'Release'), T('處斬', 'Execute')]);
      const [, msg] = C.judge(G, o, r === 0 ? 'join' : r === 2 ? 'kill' : 'free'); toast(T(...msg), 2000); await wait(300);
    }
  }
  // ------------------------------------------------ the month ends
  async function endMonth() {
    if (busy) return; busy = true;
    const idle = C.officersOf(G, G.player).filter((o) => !o.done).length;
    toast(T('月份推進中……', 'The month passes…'), 900); await wait(60);
    const before = G.log.length;
    const { threats } = C.endMonth(G);
    busy = false;
    drawSide(); save();
    // news of the month
    const news = G.log.slice(before).filter((l) => l.fac === G.player || /攻下|滅亡|瓦解|繼承/.test(l.text[0]));
    if (news.length) await modal(el('div', {}, el('div', { class: 'title' }, T(`${G.year}年${G.month}月 · 天下情勢`, `News, ${G.month}/${G.year}`)), news.slice(-8).map((l) => el('div', { class: 'small' }, T(...l.text)))), [T('確定', 'OK')]);
    for (const t of threats) {
      const src = G.cities[t.from], dst = G.cities[t.to];
      if (dst.owner !== G.player) continue;
      const r = await modal(el('div', {}, el('div', { class: 'title', style: { color: 'var(--red)' } }, T('敵軍來襲！', 'Enemy attack!')), el('div', {}, T(`${fname(G, t.af)}軍（武將 ${t.atkOfficers.length} 人，兵 ${Math.round(src.troops * 0.85)}）從${cityName(src.name)}攻向${cityName(dst.name)}！`, `${fname(G, t.af)}'s army (${t.atkOfficers.length} officers, ${Math.round(src.troops * 0.85)} troops) marches from ${cityName(src.name)} on ${cityName(dst.name)}!`)), el('div', { class: 'small dim' }, T(`${cityName(dst.name)}：兵 ${dst.troops} · 武將 ${C.officersIn(G, dst).length}`, `${cityName(dst.name)}: ${dst.troops} troops · ${C.officersIn(G, dst).length} officers`))), [T('親自迎擊', 'Command the defence'), T('委任守將', 'Leave it to the garrison')]);
      if (r === 0 && C.officersIn(G, dst).length) { const picked = await deploy(dst, T(`迎擊：${cityName(dst.name)}`, `Defend ${cityName(dst.name)}`), null); await fight({ ...t, defOfficers: picked || undefined, defTroops: picked ? picked.troops : undefined }, { defending: true }); }
      else await fight(t, { auto: true });
      if (G.over) return;
    }
    void idle;
    if (C.checkOver(G)) await ending();
  }
  // ------------------------------------------------ officer and item sheets
  function officerSheet(o) {
    const col = o.fac ? G.factions[o.fac].color : '#666', mine = o.fac === G.player;
    const box = el('div', {});
    const render = () => {
      const s = battleStats(o);
      clear(box).append(
        el('div', { class: 'row', style: { gap: '12px', flexWrap: 'nowrap' } }, face(o, col, 72), el('div', { style: { flex: 1, minWidth: 0 } },
          el('div', { class: 'row' }, el('span', { class: 'title', style: { fontSize: '22px' } }, nm(o.name)), C.isLord(G, o) ? el('span', { class: 'tag lord' }, T('君主', 'Lord')) : null, el('span', { class: 'tag' }, fname(G, o.fac))),
          el('div', { class: 'small dim' }, `${T(s.cls)} · Lv ${o.lv} · EXP ${o.exp || 0}/100 · ${T('下次晉升', 'next promotion')} ${o.lv < 15 ? 'Lv15' : o.lv < 30 ? 'Lv30' : '—'}`),
          el('div', { class: 'statgrid five' }, ATTR.map(([k, z, e]) => el('div', {}, el('b', {}, T(z, e)), o[k]))))),
        el('div', { class: 'title small sect' }, T('戰鬥數值', 'In battle')),
        el('div', { class: 'statgrid five' }, [['兵力', 'Troops', s.hp], ['策略值', 'MP', s.mp], ['攻擊', 'ATK', s.atk], ['防禦', 'DEF', s.def], ['精神', 'SPI', s.spi], ['爆發', 'AGI', s.agi], ['士氣', 'MOR', s.mor], ['移動', 'Move', s.mov], ['射程', 'Range', s.r[0] === s.r[1] ? s.r[0] : s.r.join('-')]].map(([z, e, v]) => el('div', {}, el('b', {}, T(z, e)), v))),
        el('div', { class: 'title small sect' }, T('裝備', 'Equipment')),
        ['w', 'a', 'x'].map((k) => { const it = o.eq[k] && itemDef(o.eq[k]); return el('div', { class: 'item' }, el('span', { class: 'tag' }, T(...{ w: ['武器', 'Weapon'], a: ['防具', 'Armour'], x: ['輔助', 'Extra'] }[k])), el('div', { class: 'grow' }, it ? T(it.name) : '—', it ? el('div', { class: 'small dim' }, itemText(it)) : null), mine ? el('button', { class: 'btn', onclick: () => changeGear(o, k, render) }, T('更換', 'Change')) : null); }),
        el('div', { class: 'title small sect' }, T('策略', 'Strategies')),
        el('div', { class: 'small' }, s.strats.length ? s.strats.map((id) => T(STRATS[id].name)).join(T('、', ', ')) : '—'),
        el('div', { class: 'small dim', style: { marginTop: '4px' } }, T('之後會學到：', 'Learns later: '), nextStrats(o)),
        el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, el('button', { class: 'btn primary', onclick: () => close() }, T('關閉', 'Close'))));
    };
    render(); const close = sheet(box);
  }
  const nextStrats = (o) => (LEARN[o.line] || []).filter(([, lv]) => lv > o.lv).slice(0, 4).map(([id, lv]) => `${T(STRATS[id].name)}(Lv${lv})`).join(T('、', ', ')) || '—';
  async function changeGear(o, slot, redraw) {
    const ids = Object.keys(G.bag).filter((id) => { const it = itemDef(id); return it && it.slot === slot && fits(o, it); });
    ids.sort((a, b) => ((itemDef(b).rarity || itemDef(b).tier || 0) - (itemDef(a).rarity || itemDef(a).tier || 0)));
    const labels = ids.map((id) => { const it = itemDef(id); return `${it.rarity ? `【${T(RARITY[it.rarity].name)}】` : ''}${T(it.name)} ×${G.bag[id]}　${itemText(it)}`; });
    const r = await modal(el('div', {}, el('div', { class: 'title' }, T('更換裝備', 'Change equipment')), ids.length ? null : el('div', { class: 'small dim' }, T('道具袋裡沒有適合的裝備（可以到市場購買）', 'Nothing in the bag fits (try a market)'))), [...labels, o.eq[slot] ? T('卸下', 'Remove') : null, T('取消', 'Cancel')].filter(Boolean));
    if (r < ids.length) C.equip(G, o, ids[r]);
    else if (o.eq[slot] && r === ids.length) C.unequip(G, o, slot);
    save(); redraw();
  }
  function officerList() {
    const offs = C.officersOf(G, G.player).sort((a, b) => a.city - b.city || b.lv - a.lv);
    const box = el('div', {}, el('div', { class: 'title' }, T(`武將一覽（${offs.length}）`, `Officers (${offs.length})`)),
      el('div', { class: 'table scroll' }, el('table', {}, el('tr', {}, [T('姓名', 'Name'), T('所在', 'City'), T('兵種', 'Class'), 'Lv', ...ATTR.map(([, z, e]) => T(z, e))].map((h) => el('th', {}, h))),
        offs.map((o) => el('tr', { onclick: () => officerSheet(o), class: o.done ? 'off' : '' }, el('td', {}, nm(o.name)), el('td', {}, cityName(G.cities[o.city].name)), el('td', {}, T(LINES[o.line].names[tierOf(o.lv)])), el('td', {}, o.lv), ATTR.map(([k]) => el('td', {}, o[k])))))),
      el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, el('button', { class: 'btn primary', onclick: () => close() }, T('關閉', 'Close'))));
    const close = sheet(box, { wide: true });
  }
  function bagSheet() {
    const ids = Object.keys(G.bag).filter((id) => G.bag[id] > 0);
    const box = el('div', {}, el('div', { class: 'title' }, T('道具袋', 'Items')), el('div', { class: 'small dim' }, T('裝備請在武將的資料頁更換；豆、麥、米、酒、傷藥可以在戰鬥中使用。', 'Equip gear from an officer\'s page; beans, wheat, rice, wine and salve are used in battle.')),
      el('div', { class: 'list scroll', style: { maxHeight: '64vh' } }, ids.length ? ids.sort((a, b) => ((RELICS[b] || {}).rarity || 0) - ((RELICS[a] || {}).rarity || 0)).map((id) => el('div', { class: 'item' }, el('div', { class: 'grow' }, itemLine(id, true)), el('b', {}, `×${G.bag[id]}`))) : el('div', { class: 'dim' }, '—')),
      el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, el('button', { class: 'btn primary', onclick: () => close() }, T('關閉', 'Close'))));
    const close = sheet(box);
  }
  function chronicle() {
    const box = el('div', {}, el('div', { class: 'title' }, T('天下記錄', 'Chronicle')), el('div', { class: 'list scroll', style: { maxHeight: '64vh' } }, G.log.slice().reverse().map((l) => el('div', { class: 'small' }, el('span', { class: 'dim' }, `${l.y}.${l.m}　`), T(...l.text)))),
      el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, el('button', { class: 'btn primary', onclick: () => close() }, T('關閉', 'Close'))));
    const close = sheet(box, { wide: true });
  }
  async function sysMenu() {
    const r = await modal(el('div', { class: 'title' }, T('選單', 'Menu')), [T('存檔', 'Save'), T('遊戲說明', 'How to play'), T('回到標題', 'Title screen'), T('關閉', 'Close')]);
    if (r === 0) { save(); toast(T('已存檔', 'Saved')); }
    if (r === 1) await help();
    if (r === 2) { save(); finish('title'); }
  }
  async function ending() {
    const win = G.over === 'win';
    music(win ? 'victory' : 'sad');
    await modal(el('div', {}, el('div', { class: 'title', style: { fontSize: '28px', color: win ? 'var(--gold2)' : 'var(--red)' } }, win ? T('天下統一！', 'The realm is united!') : T('勢力滅亡……', 'Your house has fallen…')),
      el('div', {}, win ? T(`${G.year}年${G.month}月，${nm(G.factions[G.player].name)}平定四海，一統天下。`, `In ${G.month}/${G.year}, ${nm(G.factions[G.player].name)} brings all under heaven together.`) : T('群雄之中，你的旗幟倒下了。', 'Among the warlords, your banner has fallen.')),
      el('div', { class: 'small dim' }, T(`戰績：勝 ${G.stats.won} 敗 ${G.stats.lost}`, `Battles won ${G.stats.won}, lost ${G.stats.lost}`))), [T('回到標題', 'Title screen')]);
    finish('title');
  }
  let finish;
  const done = new Promise((r) => { finish = (v) => { alive = false; removeEventListener('resize', onResize); r(v); }; });
  window.__camp = { fight, deploy, endMonth };
  drawSide();
  if (G.t === 0 && !G.introSeen) { G.introSeen = true; await help(true); }
  return done;
}
// an item's name in its rarity colour, with what it does
export function itemLine(id, full = true) {
  const it = USABLES[id] || itemDef(id); if (!it) return el('div', {}, id);
  const col = it.rarity ? RARITY[it.rarity].col : it.famous ? '#ffc840' : 'var(--ink)';
  return el('div', { class: 'small' }, el('b', { style: { color: col } }, T(it.name)), it.rarity ? el('span', { class: 'tag', style: { color: col, borderColor: col } }, T(RARITY[it.rarity].name)) : it.famous ? el('span', { class: 'tag', style: { color: col, borderColor: col } }, T('名品', 'Famous')) : null,
    full ? el('div', { class: 'dim' }, itemText(it)) : null);
}
export function itemText(it) {
  const p = [];
  for (const [k, z, e] of [['atk', '攻擊', 'ATK'], ['def', '防禦', 'DEF'], ['spi', '精神', 'SPI'], ['agi', '爆發', 'AGI'], ['mor', '士氣', 'MOR'], ['mov', '移動', 'Move'], ['mp', '策略值', 'MP'], ['res', '抗策略%', 'Resist%']]) if (it[k]) p.push(`${T(z, e)}+${it[k]}`);
  if (it.heal) p.push(T(`回復兵力 ${it.heal}`, `restores ${it.heal} troops`)); if (it.mph) p.push(T(`回復策略值 ${it.mph}`, `restores ${it.mph} MP`)); if (it.cure) p.push(T('解除異常', 'cures ailments'));
  if (it.attr) p.push(Object.entries(it.attr).map(([k, v]) => `${T({ lead: '統率', war: '武力', int: '智力', pol: '政治', cha: '魅力' }[k], k.toUpperCase())}+${v}`).join(' '));
  if (it.only) p.push(it.only === 'horse' ? T('騎乘部隊專用', 'mounted only') : T('步行部隊專用', 'foot only'));
  for (const d of fxText(it)) p.push(T(...d));
  if (it.type) p.push(T({ sword: '劍：步兵、君主', spear: '槍：騎兵', bow: '弓：弓兵', fan: '羽扇：策士', staff: '杖：道士', fist: '拳套：武術家', axe: '斧：山賊', heavy: '鎧：重裝部隊', light: '皮甲：輕裝部隊', robe: '道袍：策士、道士' }[it.type] || '', it.type));
  return p.join(' · ');
}
export async function help(first = false) {
  await modal(el('div', { class: 'helpbox' },
    el('div', { class: 'title' }, first ? T('出師之前', 'Before you march') : T('遊戲說明', 'How to play')),
    el('p', {}, T('【戰略】每個月，每位武將可以執行一個指令：開墾、商業、城防、徵兵、訓練、搜索、登用、移動。點地圖上的城市查看情報；與我方相鄰的敵城會標成紅色，可以「出征」。結束月份後，其他勢力也會行動，也可能來攻打你的城。', 'Strategy: each month every officer can do one thing — farm, trade, walls, draft, train, search, recruit, move. Tap a city on the map; enemy cities next to yours are ringed in red and can be attacked. When the month ends the other warlords move too — and may attack you.')),
    el('p', {}, T('【戰鬥】曹操傳式回合制：我軍全部行動完，換敵軍行動。點我軍部隊→藍色格子移動→選攻擊、策略、道具或待機。騎兵剋步兵、步兵剋弓兵、弓兵剋騎兵。地形會影響移動與防禦；被攻擊的部隊如果打得到，會反擊。', 'Battle, Cao Cao Den style: your whole army moves, then theirs. Tap a unit, a blue tile to move, then Attack, Strategy, Item or Wait. Cavalry beat infantry, infantry beat archers, archers beat cavalry. Terrain changes movement and defence; a struck unit hits back if it can reach.')),
    el('p', {}, T('【策略】火計在水上無效、森林草原加成；水計要靠近水邊；落石要在山地。混亂、牽制、封殺可以封住敵人；援助回復兵力。', 'Strategies: fire won\'t burn on water and burns hotter in forest and grass; floods need water nearby; rockfall needs hills. Confuse, Pin and Silence hold foes back; Relief restores troops.')),
    el('p', {}, T('【鍛鍊任務】按上方「任務」：討伐山賊、剿滅黃巾、平定蠻族、擊退賊騎、猛將試煉、尋寶探險。派最多 6 名武將以滿兵力出戰，不消耗城內士兵；完成後獲得經驗、金錢與寶物，地圖上的寶箱走上去就能打開。任務每月更新。', 'Missions (the Missions button): bandit hunts, Yellow Turban remnants, the southern tribes, raiders, a champion’s trial, a treasure hunt. Up to 6 officers go at full strength without using city troops; win for experience, gold and treasure, and walk onto chests to open them. New missions every month.')),
    el('p', {}, T('【寶物】五百種寶物分為凡品、良品、珍品、寶物、神器。除了能力加成，還有回復、吸血、反傷、迎擊、先手必勝、不屈、破甲、遠射、衝鋒、統帥、省力、抗策、免疫混亂等四十多種效果。在武將資料頁的裝備欄更換。', 'Treasures: five hundred, from Common to Legendary. Besides stats they carry over forty powers — regen, lifesteal, thorns, pre-emptive strikes, overwhelm, undying, pierce, long shot, charge, command, economy, resolve, immunities and more. Equip them from an officer’s page.')),
    el('p', {}, T('【守城設施】「設施」指令可以修建箭樓（城牆上自動射擊）、拒馬（騎兵無法通過）、陷坑（敵軍踩到損兵並停下）、護城河（只能從城門前的橋進攻）。敵方城市也會修建，攻城前先看看城市的防守設施。', 'Defences: the Defences order builds arrow towers (they shoot from the walls), barricades (cavalry can’t pass), pit traps (attackers lose troops and stop) and a moat (attack only across the bridges at the gates). Enemy cities build them too — check a city’s defences before you attack.')),
    el('p', {}, T('【勝敗】攻城戰：擊退敵將主將、全滅敵軍或佔領城池就勝利；我方主將撤退或超過回合限制就敗北。武將會升級，Lv15 與 Lv30 晉升兵種。俘虜可以登用、釋放或處斬。統一全部 45 座城就是天下統一！', 'Victory: rout their commander, wipe them out, or take the keep. Lose if your commander falls or time runs out. Officers level up and promote at Lv15 and Lv30. Captives can be recruited, released or executed. Hold all 45 cities to unite the realm!'))), [T('明白了', 'Got it')]);
}
