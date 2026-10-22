# 三國戰旗傳 · Sanguo Tactics

A Three Kingdoms strategy game in the browser: the map of the realm with its **45 cities**, **500 historical officers**, and battles fought
like *Cao Cao Den* (曹操傳) — phase-based tactics on a grid, where your whole army moves and then the enemy's does.

**Play:** https://ywchen0711.github.io/sanguo-tactics/ (Chinese and English)

## The campaign
- Six scenarios: 190 Rise Against Dong Zhuo, 195, 200 Guandu, 208 Red Cliffs, 221 The Three Kingdoms, and a what-if with every hero at once.
- Pick any warlord. Each month every officer does one thing: farm, trade, walls, draft, train, search (talent, treasure, gold), recruit, move.
- Transport gold, food and troops; buy items and gear at a city's market; equip famous treasures (青龍偃月刀, 赤兔馬, 孫子兵法 …).
- March on a neighbouring city with up to ten officers. The other warlords build up, fight each other and come for you;
  when they do, command the defence yourself or leave it to the garrison.
- Captured officers can be recruited, released or executed. Hold all 45 cities to unite the realm.

## The battles
- A siege map generated from where the city stands: the central plains, Hebei, the frontier, Liang's deserts, Shu's mountains, Jiangnan's marshes, or the Great River with its bridges.
- Ten unit lines with three tiers each (promotion at Lv15 and Lv30): infantry, cavalry, archers, horse archers, strategists, taoists, martial artists, bandits, siege engines and lords.
- Cavalry beat infantry, infantry beat archers, archers beat cavalry. Terrain costs movement, shields defenders and suits some troops better than others.
- A struck unit hits back if it can reach; criticals and double strikes; zones of control.
- Thirty strategies: fire (not on water), floods (near water), rockfall (on hills), wind, lightning, healing, confusion, pinning, silence, poison, buffs and debuffs.
- Full information on any unit, enemies included; a forecast before every attack; auto-battle; win by routing their commander, wiping them out or taking the keep.

## Code
Plain ES modules, no build step. `js/core` holds the rules (campaign, battle, officers, battlefields) and runs in Node:
`node tools/test.mjs` checks the data, every battlefield, and four years of every scenario fought out by the AI.
The officers, cities and scenarios come from the companion simulation *三國志 群雄模擬*.
