// 三國戰旗傳 · Sanguo Tactics — the title screen, choosing a scenario and a warlord, saving, and the campaign.
import { T, EN, setLang } from './i18n.js';
import { el, clear, $ui, modal, toast, wait } from './ui/dom.js';
import { SCENARIOS } from './data/scenarios.js';
import * as C from './core/campaign.js';
import { MapView } from './ui/mapview.js';
import { runCampaign, help } from './ui/strategy.js';
import { portrait } from './ui/sprites.js';
import { nm, cityName } from './ui/names.js';
import { music, sfx, toggleMute, isMuted } from './audio.js';

const KEY = 'sgt.save.v1', GAME = 'sanguo-tactics';
let cloud = null;
async function initCloud(onPulled) { try { cloud = await import('/save.js'); if (await cloud.pull(GAME, KEY) && onPulled) onPulled(); } catch (e) { cloud = null; } }
let G = null;
const save = () => { if (!G) return; try { localStorage.setItem(KEY, JSON.stringify(G)); } catch (e) { /* ignore */ } if (cloud) try { cloud.touch(GAME, KEY); } catch (e) { /* ignore */ } };
const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); return d && d.v === 1 && !d.over ? d : null; } catch (e) { return null; } };
window.__sg = { get G() { return G; }, save };

async function title() {
  const cv = document.getElementById('view'), ui = clear();
  music('title');
  // the realm behind the title
  const preview = C.newGame({ scenario: '190', seed: 1 });
  const mv = new MapView(cv); mv.resize(); mv.draw(preview);
  const onR = () => { mv.resize(); mv.draw(preview); }; addEventListener('resize', onR);
  const saved = load();
  return new Promise((resolve) => {
    const go = (v) => { removeEventListener('resize', onR); resolve(v); };
    ui.append(el('div', { class: 'titlescreen' },
      el('div', { class: 'logo' }, el('div', { class: 'big' }, '三國戰旗傳'), el('div', { class: 'sub' }, 'SANGUO TACTICS'), el('div', { class: 'tagline' }, T('四十五座城 · 五百名武將 · 曹操傳式戰棋', '45 cities · 500 officers · Cao Cao Den-style battles'))),
      el('div', { class: 'titlemenu' },
        saved ? el('button', { class: 'btn primary', onclick: () => go({ load: saved }) }, T(`繼續遊戲（${nm(saved.factions[saved.player].name)} · ${saved.year}年${saved.month}月）`, `Continue (${nm(saved.factions[saved.player].name)}, ${saved.month}/${saved.year})`)) : null,
        el('button', { class: 'btn' + (saved ? '' : ' primary'), onclick: () => go({ fresh: true }) }, T('新的遊戲', 'New game')),
        el('button', { class: 'btn', onclick: () => help() }, T('遊戲說明', 'How to play')),
        el('div', { class: 'row', style: { justifyContent: 'center' } },
          el('button', { class: 'btn small', onclick: () => setLang(EN ? 'zh' : 'en') }, EN ? '中文' : 'English'),
          el('button', { class: 'btn small', onclick: (e) => { const m = toggleMute(); e.currentTarget.textContent = m ? '♪ ×' : '♪'; } }, isMuted() ? '♪ ×' : '♪'))),
      el('div', { class: 'credit small' }, T('原創作品，人物與城市取材自《三國志》與《三國演義》。', 'An original game; people and places from the Records and the Romance of the Three Kingdoms.'))));
  });
}
async function chooseScenario() {
  return new Promise((resolve) => {
    const ui = clear();
    ui.append(el('div', { class: 'picker' }, el('div', { class: 'title', style: { fontSize: '24px' } }, T('選擇劇本', 'Choose a scenario')),
      el('div', { class: 'cards' }, SCENARIOS.map((s) => el('button', { class: 'card', onclick: () => { sfx('ok'); resolve(s.id); } }, el('div', { class: 'yr' }, s.id === 'heroes' ? '190 ?' : s.year), el('div', { class: 'nm' }, T(s.name)), el('div', { class: 'small dim' }, T(s.desc)), el('div', { class: 'small' }, T(`${s.factions.length} 個勢力`, `${s.factions.length} warlords`))))),
      el('button', { class: 'btn', onclick: () => resolve(null) }, T('返回', 'Back'))));
  });
}
async function chooseFaction(scenario) {
  const P = C.newGame({ scenario, seed: 3 });
  const fs = Object.values(P.factions).map((f) => ({ f, cities: C.citiesOf(P, f.id).length, offs: C.officersOf(P, f.id).length, power: C.factionPower(P, f.id) })).sort((a, b) => b.power - a.power);
  const top = fs[0].power;
  return new Promise((resolve) => {
    const ui = clear();
    const diff = (x) => (x.power > top * 0.6 ? [T('簡單', 'Easy'), '#7adf8a'] : x.power > top * 0.25 ? [T('普通', 'Normal'), '#e8c46a'] : x.power > top * 0.1 ? [T('困難', 'Hard'), '#ff9a6a'] : [T('極難', 'Very hard'), '#ff5a5a']);
    ui.append(el('div', { class: 'picker' }, el('div', { class: 'title', style: { fontSize: '24px' } }, T('選擇君主', 'Choose your warlord')),
      el('div', { class: 'cards lords' }, fs.map((x) => { const l = P.officers[x.f.lord], cv = el('canvas', { width: 32, height: 32, class: 'face', style: { width: '56px', height: '56px' } }); cv.getContext('2d').drawImage(portrait({ ...l, line: 'lord' }, x.f.color), 0, 0); const [dn, dc] = diff(x);
        return el('button', { class: 'card lord', style: { borderColor: x.f.color }, onclick: () => { sfx('ok'); resolve(x.f.id); } }, cv, el('div', { class: 'grow' }, el('div', { class: 'nm' }, nm(l.name)), el('div', { class: 'small dim' }, `${T('城', 'Cities')} ${x.cities} · ${T('武將', 'Officers')} ${x.offs}`), el('div', { class: 'small dim' }, C.citiesOf(P, x.f.id).slice(0, 4).map((c) => cityName(c.name)).join(' ')), el('span', { class: 'tag', style: { color: dc, borderColor: dc } }, dn))); })),
      el('button', { class: 'btn', onclick: () => resolve(null) }, T('返回', 'Back'))));
  });
}
async function main() {
  initCloud(() => { /* a newer save arrived from the cloud; the title shows it next time */ });
  for (;;) {
    const t = await title();
    if (t.load) G = t.load;
    else {
      const sc = await chooseScenario(); if (!sc) continue;
      const fid = await chooseFaction(sc); if (!fid) continue;
      G = C.newGame({ scenario: sc, player: fid });
      const S = SCENARIOS.find((s) => s.id === sc);
      clear(); await modal(el('div', {}, el('div', { class: 'title', style: { fontSize: '22px' } }, `${S.year === 190 && sc === 'heroes' ? '' : S.year + T('年', ' — ')}${T(S.name)}`), el('p', {}, T(S.desc)), el('p', { class: 'small dim' }, T(`你是${nm(G.factions[fid].name)}。目標：統一天下所有城池。`, `You are ${nm(G.factions[fid].name)}. Your goal: hold every city in the realm.`))), [T('出發', 'Begin')]);
      save();
    }
    const r = await runCampaign(G, { save });
    if (G.over) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
    void r;
  }
}
addEventListener('error', (e) => { if (window.__errs) window.__errs.push(e.message); });
main();
