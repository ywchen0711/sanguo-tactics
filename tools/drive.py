# Builds tmp-drive.html: the real game plus a script that clicks through it to a given stage and puts what it saw
# (and any errors) in the page title, for headless screenshots.
# python tools/drive.py; then open tmp-drive.html?stage=N
#   1 title · 2 scenario list · 3 warlord list · 4 campaign map · 5 deploy sheet · 6 battle start · 7 a move and an attack
#   8 strategy menu · 9 whole battle on auto, then results · 10 officer sheet · 11 info sheet on an enemy · 12 a month passes
import os
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(here, 'index.html'), encoding='utf-8').read()
pre = """<script>window.__errs = []; addEventListener('error', (e) => window.__errs.push(e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno)); addEventListener('unhandledrejection', (e) => window.__errs.push('rej ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason))); try { localStorage.clear(); } catch (e) {}</script>
"""
drv = """<script type="module">
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const q = new URLSearchParams(location.search), stage = +(q.get('stage') || 1);
const key = (k) => dispatchEvent(new KeyboardEvent('keydown', { key: k }));
const btn = (t) => [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t) && !x.disabled);
const click = (t) => { const b = btn(t); if (b) b.click(); return !!b; };
const report = (m) => { document.title = m + ' | errs: ' + window.__errs.join(' || '); };
try {
  await wait(700);
  if (stage === 1) { report('title'); }
  else {
    click('新的遊戲'); await wait(300);
    if (stage === 2) report('scenarios');
    else {
      [...document.querySelectorAll('.card')][+(q.get('sc') || 0)].click(); await wait(400);
      if (stage === 3) report('lords');
      else {
        const lords = [...document.querySelectorAll('.card')]; (lords.find((b) => b.textContent.includes(q.get('lord') || '曹操')) || lords[0]).click(); await wait(400);
        click('出發'); await wait(500); click('明白了'); await wait(500);
        const G = window.__sg.G;
        if (stage === 4) report(`campaign ${G.year}/${G.month} cities=${G.cities.filter((c) => c.owner === G.player).length}`);
        else if (stage === 10) { document.querySelector('.citypanel .item').click(); await wait(400); report('officer sheet'); }
        else if (stage === 18) { G.missions[5].kind = 'legend'; G.missions[5].stars = 5; click('任務'); await wait(500); report(`board missions=${document.querySelectorAll('.modal .item.mission').length} drill=${document.querySelectorAll('.modal .item.drill .btn').length}`); }
        else if (stage === 16 || stage === 17) {
          // the training ground (16) or an escort mission forced onto the board (17)
          if (stage === 17) { const m = G.missions[0]; m.kind = 'escort'; m.stars = 3; m.foes = 5; m.theme = 'plains'; }
          click('任務'); await wait(400);
          if (stage === 16) [...document.querySelectorAll('.modal .item.drill .btn')][1].click(); else document.querySelector('.modal .btn.war').click();
          await wait(500); const m2 = document.querySelector('.modal'); if (m2 && !document.querySelector('.modal .check')) { m2.querySelector('.btn').click(); await wait(400); }
          click('出發！'); await wait(500); click('出擊'); await wait(2000);
          const B = window.__B;
          click('委任'); await wait(+(q.get('ms') || 30000));
          const goal = document.querySelector('.goal') ? document.querySelector('.goal').textContent : '';
          for (let i = 0; i < 6 && document.querySelector('.modal'); i++) { const b = document.querySelector('.modal .btn.primary') || document.querySelector('.modal .btn'); b.click(); await wait(600); }
          report(`${stage === 16 ? 'drill' : 'escort'} goal=${B.goal} over=${B.over} why=${B.why} turn=${B.turn} spawns=${B.events.filter((e) => e.t === 'spawn').length} vip=${B.units.some((u) => u.vip)}`);
        }
        else if (stage === 14 || stage === 15) {
          click('任務'); await wait(400);
          const goB = [...document.querySelectorAll('.modal .btn.war')].find((b) => !b.disabled); goB.click(); await wait(500);
          click('出發！'); await wait(500); click('出擊'); await wait(2000);
          const B = window.__B;
          if (stage === 14) report(`mission units=${B.units.length} chests=${B.map.chests.length} goal=${B.goal}`);
          else { click('委任'); await wait(+(q.get('ms') || 50000)); for (let i = 0; i < 6 && document.querySelector('.modal'); i++) { const b = document.querySelector('.modal .btn.primary') || document.querySelector('.modal .btn'); b.click(); await wait(600); } report(`mission over=${B.over} turn=${B.turn} loot=${B.loot.length} bag=${Object.keys(G.bag).length}`); }
        }
        else if (stage === 13) {
          // Dong Zhuo marches from Luoyang on Chenliu; we command the defence, then hand it to auto-battle
          const from = G.cities.find((c) => c.name === '洛陽'), to = G.cities.find((c) => c.name === '陳留');
          const atk = G.officers.filter((o) => o.status === 'serving' && o.city === from.id && o.fac === from.owner).slice(0, 6);
          const p = window.__camp.fight({ af: from.owner, from: from.id, to: to.id, atkOfficers: atk, defOfficers: G.officers.filter((o) => o.status === 'serving' && o.city === to.id && o.fac === G.player).slice(0, 6) }, { defending: true });
          await wait(400); click('開戰'); await wait(2500);
          const B = window.__B; const me = B.sides.def.player ? 'def' : 'atk';
          click('委任'); await wait(+(q.get('ms') || 45000));
          for (let i = 0; i < 8 && document.querySelector('.modal'); i++) { const b = document.querySelector('.modal .btn.primary') || document.querySelector('.modal .btn'); b.click(); await wait(600); }
          report(`defence me=${me} over=${B.over} why=${B.why} turn=${B.turn} owner=${to.owner} captives=${G.captives.length}`);
        }
        else if (stage === 12) { click('結束月份'); await wait(2500); for (let i = 0; i < 6 && document.querySelector('.modal'); i++) { const b = document.querySelector('.modal .btn.primary') || document.querySelector('.modal .btn'); if (b) b.click(); await wait(500); } report(`month ${G.year}/${G.month} log=${G.log.length}`); }
        else {
          click('出征'); await wait(400);
          // several targets: take the first
          const m = document.querySelector('.modal'); if (m && !document.querySelector('.modal .check')) { m.querySelector('.btn').click(); await wait(400); }
          if (stage === 5) report('deploy ' + document.querySelectorAll('.modal .item.on').length);
          else {
            click('出陣'); await wait(400); click('開戰'); await wait(1800);
            const B = window.__B;
            if (stage === 6) { if (q.get('zoom')) { const v = window.__view, u = B.units.find((x) => x.side === 'atk'); v.zoomBy(+q.get('zoom')); v.centerOn(u.x + 3, u.y, false); await wait(300); } report(`battle units=${B.units.length} side=${B.side} theme=${B.map.theme}`); }
            else if (stage === 7 || stage === 8 || stage === 11) {
              const v = window.__view, cv = document.getElementById('view'), r = cv.getBoundingClientRect();
              const tap = (x, y) => { const px = r.left + ((x + 0.5) * v.ts - v.camX) / v.dpr, py = r.top + ((y + 0.5) * v.ts - v.camY) / v.dpr; cv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: px, clientY: py })); };
              if (stage === 11) { const f = B.units.find((u) => u.side === 'def'); v.centerOn(f.x, f.y, false); await wait(100); tap(f.x, f.y); await wait(200); tap(f.x, f.y); await wait(500); report('info ' + (document.querySelector('.modal') ? 'open' : 'closed')); }
              else {
                const u = B.units.find((x) => x.side === 'atk' && (stage === 8 ? x.s.strats.length : true));
                const f = B.units.find((x) => x.side === 'def');
                // put a foe within reach, so there is something to hit
                const spot = [[1, 0], [0, 1], [0, -1], [-1, 0]].map(([dx, dy]) => [u.x + 1 + dx, u.y + dy]).find(([x, y]) => !B.units.some((o) => o.x === x && o.y === y));
                const free = (x, y) => !B.units.some((o) => o !== f && o.x === x && o.y === y);
                const d = u.s.r[1] >= 2 && u.s.r[0] >= 2 ? 2 : 1; const sp = [[d, 0], [0, d], [0, -d], [-d, 0]].map(([dx, dy]) => [u.x + dx, u.y + dy]).find(([x, y]) => x >= 0 && y >= 0 && free(x, y));
                f.x = sp[0]; f.y = sp[1]; f.ax = f.x; f.ay = f.y;
                v.centerOn(u.x, u.y, false); await wait(100);
                tap(u.x, u.y); await wait(300); tap(u.x, u.y); await wait(600);
                if (stage === 7) { click('攻擊'); await wait(300); click('確定'); await wait(3000); report(`attack foeHP ${f.hp}/${f.s.hp} unitDone=${u.done}`); }
                else { click('策略'); await wait(400); report('strategy menu ' + document.querySelectorAll('.cmd .menu button').length); }
              }
            }
            else if (stage === 9) { click('委任'); await wait(+(q.get('ms') || 40000)); for (let i = 0; i < 6 && document.querySelector('.modal'); i++) { const b = document.querySelector('.modal .btn.primary') || document.querySelector('.modal .btn'); b.click(); await wait(600); } report(`after battle over=${B.over} turn=${B.turn} cities=${window.__sg.G.cities.filter((c) => c.owner === window.__sg.G.player).length}`); }
          }
        }
      }
    }
  }
} catch (e) { window.__errs.push('driver ' + e.message); report('driver failed'); }
</script>
"""
s = s.replace('<head>', '<head>\n' + pre, 1).replace('</body>', drv + '</body>', 1)
open(os.path.join(here, 'tmp-drive.html'), 'w', encoding='utf-8').write(s)
print('ok')
