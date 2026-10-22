// Five hundred treasures (寶物), each with its own name and its own mix of powers. Generated from a fixed seed, so
// every game (and every save) has the same five hundred. Rarity 1-5: 凡品 良品 珍品 寶物 神器.
// An item: { id: 'r123', slot: 'w'|'a'|'x', type, rarity, name: [zh, en], atk/def/spi/agi/mor/mov/mp, fx: { key: value } }

export const RARITY = [null, { name: ['凡品', 'Common'], col: '#d8d0c0' }, { name: ['良品', 'Fine'], col: '#7adf8a' }, { name: ['珍品', 'Rare'], col: '#7ab0ff' }, { name: ['寶物', 'Treasure'], col: '#d08aff' }, { name: ['神器', 'Legendary'], col: '#ffc840' }];

// powers: what each does in battle (core/battle.js reads s.fx), and how strong at each rarity
//   r: [value at rarity 1..5]; slots: where it can appear; w: how often
export const EFFECTS = {
  regen:     { name: ['回復', 'Regen'], d: (v) => [`每回合回復兵力 ${v}%`, `restore ${v}% troops each turn`], r: [4, 6, 8, 10, 14], slots: 'ax', w: 3 },
  mpRegen:   { name: ['回氣', 'Focus'], d: (v) => [`每回合回復策略值 ${v}`, `restore ${v} MP each turn`], r: [2, 3, 4, 6, 8], slots: 'wx', w: 2 },
  crit:      { name: ['必殺', 'Critical'], d: (v) => [`必殺率 +${v}%`, `critical chance +${v}%`], r: [4, 6, 9, 12, 16], slots: 'wx', w: 3 },
  dbl:       { name: ['連擊', 'Flurry'], d: (v) => [`連擊率 +${v}%`, `double-strike chance +${v}%`], r: [5, 8, 11, 15, 20], slots: 'wx', w: 3 },
  evade:     { name: ['閃避', 'Evasion'], d: (v) => [`敵人命中 -${v}%`, `foes hit ${v}% less`], r: [4, 6, 8, 11, 14], slots: 'ax', w: 3 },
  hit:       { name: ['精準', 'Accuracy'], d: (v) => [`命中 +${v}%`, `hit +${v}%`], r: [5, 8, 11, 14, 18], slots: 'wx', w: 2 },
  pierce:    { name: ['破甲', 'Pierce'], d: (v) => [`無視敵方地形防禦 ${v}%`, `ignore ${v}% of the target's terrain defence`], r: [30, 45, 60, 80, 100], slots: 'w', w: 2 },
  counterUp: { name: ['反擊強化', 'Riposte'], d: (v) => [`反擊傷害 +${v}%`, `counter damage +${v}%`], r: [15, 25, 35, 50, 70], slots: 'wa', w: 2 },
  firstStrike: { name: ['迎擊', 'Pre-emptive'], d: () => ['被攻擊時先反擊', 'strikes first when attacked'], r: [0, 0, 1, 1, 1], slots: 'wx', w: 1, flag: true },
  noCounter: { name: ['先手必勝', 'Overwhelm'], d: () => ['攻擊時敵人無法反擊', 'foes cannot counter your attacks'], r: [0, 0, 0, 1, 1], slots: 'w', w: 1, flag: true },
  drain:     { name: ['吸血', 'Lifesteal'], d: (v) => [`造成傷害的 ${v}% 轉為兵力`, `${v}% of damage dealt returns as troops`], r: [8, 12, 16, 22, 30], slots: 'w', w: 2 },
  thorns:    { name: ['反傷', 'Thorns'], d: (v) => [`受到近戰傷害的 ${v}% 反彈`, `reflect ${v}% of melee damage taken`], r: [8, 12, 18, 24, 32], slots: 'a', w: 2 },
  vs_cav:    { name: ['斬馬', 'Horse-Cutter'], d: (v) => [`對騎兵傷害 +${v}%`, `+${v}% damage to cavalry`], r: [10, 15, 20, 28, 36], slots: 'w', w: 2 },
  vs_inf:    { name: ['破陣', 'Line-Breaker'], d: (v) => [`對步兵傷害 +${v}%`, `+${v}% damage to infantry`], r: [10, 15, 20, 28, 36], slots: 'w', w: 2 },
  vs_arch:   { name: ['突襲', 'Skirmisher'], d: (v) => [`對弓兵傷害 +${v}%`, `+${v}% damage to archers`], r: [10, 15, 20, 28, 36], slots: 'w', w: 2 },
  vs_mag:    { name: ['斬妖', 'Sorcery-Slayer'], d: (v) => [`對策略系部隊傷害 +${v}%`, `+${v}% damage to casters`], r: [10, 15, 20, 28, 36], slots: 'w', w: 1 },
  fire:      { name: ['火神', 'Fire'], d: (v) => [`火系策略威力 +${v}%`, `fire strategies +${v}%`], r: [10, 15, 20, 28, 40], slots: 'wx', w: 2, mag: true },
  water:     { name: ['水神', 'Water'], d: (v) => [`水系策略威力 +${v}%`, `water strategies +${v}%`], r: [10, 15, 20, 28, 40], slots: 'wx', w: 1, mag: true },
  rock:      { name: ['山神', 'Stone'], d: (v) => [`落石系策略威力 +${v}%`, `rockfall strategies +${v}%`], r: [10, 15, 20, 28, 40], slots: 'wx', w: 1, mag: true },
  wind:      { name: ['風神', 'Wind'], d: (v) => [`風系策略威力 +${v}%`, `wind strategies +${v}%`], r: [10, 15, 20, 28, 40], slots: 'wx', w: 1, mag: true },
  bolt:      { name: ['雷神', 'Thunder'], d: (v) => [`雷系策略威力 +${v}%`, `lightning strategies +${v}%`], r: [10, 15, 20, 28, 40], slots: 'wx', w: 1, mag: true },
  healUp:    { name: ['仁術', 'Mercy'], d: (v) => [`回復策略效果 +${v}%`, `healing strategies +${v}%`], r: [10, 18, 25, 35, 50], slots: 'wx', w: 2, mag: true },
  mpSave:    { name: ['省力', 'Economy'], d: (v) => [`策略消耗 -${v}%`, `strategies cost ${v}% less MP`], r: [10, 15, 20, 25, 35], slots: 'x', w: 2, mag: true },
  res:       { name: ['抗策', 'Resolve'], d: (v) => [`受到策略傷害 -${v}%，異常成功率降低`, `strategy damage taken -${v}%, ailments less likely`], r: [8, 12, 18, 25, 35], slots: 'ax', w: 3 },
  imm_conf:  { name: ['清心', 'Clear Head'], d: () => ['不會混亂', 'immune to confusion'], r: [1, 1, 1, 1, 1], slots: 'ax', w: 1, flag: true },
  imm_stop:  { name: ['疾行', 'Unfettered'], d: () => ['不會被牽制', 'immune to pinning'], r: [1, 1, 1, 1, 1], slots: 'ax', w: 1, flag: true },
  imm_seal:  { name: ['明智', 'Unsilenced'], d: () => ['不會被封殺', 'immune to silence'], r: [1, 1, 1, 1, 1], slots: 'ax', w: 1, flag: true },
  imm_poison:{ name: ['百毒不侵', 'Antivenom'], d: () => ['不會中毒', 'immune to poison'], r: [1, 1, 1, 1, 1], slots: 'ax', w: 1, flag: true },
  range:     { name: ['遠射', 'Long Shot'], d: () => ['遠程攻擊射程 +1', 'ranged attacks reach 1 further'], r: [0, 0, 1, 1, 1], slots: 'w', w: 1, flag: true, ranged: true },
  walk_forest: { name: ['林行', 'Woodland Stride'], d: () => ['森林移動消耗為 1', 'forests cost 1 to cross'], r: [1, 1, 1, 1, 1], slots: 'x', w: 1, flag: true },
  walk_hill: { name: ['登山', 'Mountaineer'], d: () => ['山地移動消耗為 1', 'hills cost 1 to cross'], r: [1, 1, 1, 1, 1], slots: 'x', w: 1, flag: true },
  walk_wet:  { name: ['涉水', 'Wader'], d: () => ['濕地、淺灘移動消耗為 1', 'marsh and shallows cost 1'], r: [1, 1, 1, 1, 1], slots: 'x', w: 1, flag: true },
  zocFree:   { name: ['神出鬼沒', 'Phantom'], d: () => ['不受敵軍阻擋（無視包圍）', 'ignores zones of control'], r: [0, 1, 1, 1, 1], slots: 'x', w: 1, flag: true },
  aura:      { name: ['統帥', 'Command'], d: (v) => [`相鄰友軍攻擊 +${v}%`, `adjacent allies +${v}% attack`], r: [5, 8, 10, 14, 18], slots: 'x', w: 2 },
  guardAura: { name: ['堅守', 'Bulwark'], d: (v) => [`相鄰友軍防禦 +${v}%`, `adjacent allies +${v}% defence`], r: [5, 8, 10, 14, 18], slots: 'ax', w: 2 },
  lastStand: { name: ['不屈', 'Undying'], d: () => ['每場戰鬥一次，致命傷害時保留 1 兵力', 'once a battle, survive a fatal blow with 1 troop'], r: [0, 1, 1, 1, 1], slots: 'ax', w: 1, flag: true },
  expUp:     { name: ['勤學', 'Studious'], d: (v) => [`獲得經驗 +${v}%`, `+${v}% experience`], r: [10, 15, 20, 30, 50], slots: 'x', w: 2 },
  critGuard: { name: ['鐵壁', 'Steadfast'], d: () => ['不會被必殺', 'immune to criticals'], r: [0, 1, 1, 1, 1], slots: 'a', w: 1, flag: true },
  siege:     { name: ['攻城', 'Siegebreaker'], d: (v) => [`對城內、城門、陣營上的敵人傷害 +${v}%`, `+${v}% damage to foes in town, gates or camps`], r: [10, 15, 22, 30, 40], slots: 'wx', w: 2 },
  wallGuard: { name: ['守城', 'Rampart'], d: (v) => [`在城內、城門、陣營防禦 +${v}%`, `+${v}% defence in town, gates or camps`], r: [10, 15, 22, 30, 40], slots: 'ax', w: 2 },
  charge:    { name: ['衝鋒', 'Charge'], d: (v) => [`移動 3 格以上後攻擊，傷害 +${v}%`, `+${v}% damage after moving 3+ tiles`], r: [10, 15, 22, 30, 40], slots: 'wx', w: 2 },
  rally:     { name: ['鼓勇', 'Bloodlust'], d: (v) => [`擊退敵人時回復兵力 ${v}%`, `restore ${v}% troops on routing a foe`], r: [8, 12, 16, 22, 30], slots: 'wx', w: 2 },
  hpPct:     { name: ['壯軍', 'Host'], d: (v) => [`兵力上限 +${v}%`, `+${v}% max troops`], r: [5, 8, 10, 14, 20], slots: 'ax', w: 3 },
  gold:      { name: ['招財', 'Fortune'], d: (v) => [`戰鬥後金錢 +${v}%`, `+${v}% gold after battle`], r: [10, 20, 30, 45, 60], slots: 'x', w: 1 },
};

// names: a poetic prefix and a noun for the kind of thing
const PREFIX = `青龍 Azure-Dragon|白虎 White-Tiger|朱雀 Vermilion-Bird|玄武 Black-Tortoise|麒麟 Qilin|鳳凰 Phoenix|蒼狼 Grey-Wolf|雷霆 Thunderclap|天罡 Heavenly-Star|地煞 Earthly-Fiend|太乙 Taiyi|紫微 Purple-Star|霸王 Overlord's|破軍 Army-Breaker|七星 Seven-Star|九霄 Nine-Heavens|赤霄 Crimson-Sky|寒冰 Frost|烈焰 Blazing|流雲 Drifting-Cloud|驚鴻 Startled-Swan|飛燕 Swallow|金剛 Adamant|玄鐵 Dark-Iron|碧水 Jade-Water|落日 Sunset|明月 Bright-Moon|星辰 Starlight|山河 Hills-and-Rivers|龍鱗 Dragonscale|虎嘯 Tiger's-Roar|鷹揚 Soaring-Hawk|狼牙 Wolf-Fang|獅王 Lion-King|豹尾 Leopard-Tail|玄冥 Dark-Abyss|崑崙 Kunlun|泰山 Mount-Tai|長江 Great-River|黃河 Yellow-River|洛水 Luo-River|赤壁 Red-Cliff|定軍 Dingjun|虎牢 Hulao|漢室 House-of-Han|天子 Son-of-Heaven's|忠義 Loyal|仁德 Benevolent|智謀 Cunning|奇門 Mystic-Gate|八卦 Bagua|太極 Taiji|陰陽 Yin-Yang|五行 Five-Phases|風林 Wind-and-Forest|火山 Volcano|雷公 Thunder-Lord's|雨師 Rain-Master's|白馬 White-Horse|紫電 Purple-Lightning|青霜 Blue-Frost|碧血 Jade-Blood|丹心 Crimson-Heart|鎮國 Realm-Warden|安邦 Peacemaker's|凌雲 Cloud-Piercing|無雙 Peerless|不動 Unmoving|天狼 Sirius|北斗 Northern-Dipper|南華 Nanhua|蓬萊 Penglai|蒼穹 Firmament|萬里 Ten-Thousand-Li|千鈞 Thousandweight|斷金 Gold-Cleaving|遊龍 Roaming-Dragon|伏虎 Tiger-Taming|射日 Sun-Shooting|追風 Wind-Chasing|穿雲 Cloud-Splitting|鎮岳 Mountain-Holding|沉香 Agarwood|雪月 Snow-Moon|翠微 Green-Peak|金烏 Golden-Crow|玉兔 Jade-Rabbit`.split('|').map((x) => x.split(' ')).map(([z, e]) => [z, e.replace(/-/g, ' ')]);
const NOUN = {
  sword: [['劍', 'Sword'], ['刀', 'Saber'], ['鋒', 'Edge']], spear: [['槍', 'Spear'], ['矛', 'Pike'], ['戟', 'Halberd']], bow: [['弓', 'Bow'], ['弩', 'Crossbow']],
  fan: [['扇', 'Fan'], ['羽扇', 'Feather Fan']], staff: [['杖', 'Staff'], ['拂塵', 'Whisk']], fist: [['拳套', 'Gauntlets'], ['鐵爪', 'Claws']], axe: [['斧', 'Axe'], ['鉞', 'Battleaxe']],
  heavy: [['鎧', 'Mail'], ['甲', 'Armour'], ['明光鎧', 'Bright Mail']], light: [['皮甲', 'Leathers'], ['戰袍', 'War Coat'], ['軟甲', 'Soft Armour']], robe: [['道袍', 'Robe'], ['法衣', 'Vestment'], ['鶴氅', 'Crane Cloak']],
  horse: [['馬', 'Steed'], ['駒', 'Colt']], boots: [['靴', 'Boots']], book: [['兵書', 'War Manual'], ['秘卷', 'Secret Scroll']], seal: [['印', 'Seal']], jade: [['玉', 'Jade'], ['玉珮', 'Pendant']],
  ring: [['戒', 'Ring']], banner: [['旗', 'Banner']], amulet: [['符', 'Talisman']], mirror: [['鏡', 'Mirror']], bell: [['鈴', 'Bell']], belt: [['帶', 'Sash']], pearl: [['珠', 'Pearl']], helm: [['盔', 'Helm']], shield: [['盾', 'Shield']],
};
const W_TYPES = ['sword', 'spear', 'bow', 'fan', 'staff', 'fist', 'axe'], A_TYPES = ['heavy', 'light', 'robe'];
const X_TYPES = ['horse', 'boots', 'book', 'seal', 'jade', 'ring', 'banner', 'amulet', 'mirror', 'bell', 'belt', 'pearl', 'helm', 'shield'];
// what an accessory's kind tends to give
const X_BASE = { horse: { mov: 1, agi: 4 }, boots: { mov: 1 }, book: { spi: 6, mp: 6 }, seal: { mor: 8 }, jade: { spi: 4, mor: 4 }, ring: { atk: 4 }, banner: { mor: 6, atk: 3 }, amulet: { spi: 5 }, mirror: { spi: 4, agi: 3 }, bell: { mor: 5, agi: 2 }, belt: { def: 4 }, pearl: { mp: 8 }, helm: { def: 6 }, shield: { def: 7 } };
const X_ONLY = { horse: 'horse', boots: 'foot' };

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const RELICS = {};
export const RELIC_LIST = [];
{
  const r = rng(20261022), pick = (a) => a[Math.floor(r() * a.length)], used = new Set();
  const counts = [0, 150, 140, 110, 70, 30];
  const pickFx = (slot, type, rarity, taken) => {
    const ok = Object.entries(EFFECTS).filter(([k, e]) => e.slots.includes(slot) && e.r[rarity - 1] && !taken.has(k)
      && !(e.ranged && !['bow'].includes(type)) && !(e.mag && slot === 'w' && !['fan', 'staff'].includes(type)) && !(k === 'charge' && slot === 'x' && type !== 'horse'));
    let t = r() * ok.reduce((s, [, e]) => s + e.w, 0);
    for (const [k, e] of ok) { t -= e.w; if (t <= 0) return k; }
    return ok.length ? ok[0][0] : null;
  };
  let n = 0;
  for (let rarity = 1; rarity <= 5; rarity++) for (let i = 0; i < counts[rarity]; i++) {
    const roll = r(), slot = roll < 0.36 ? 'w' : roll < 0.64 ? 'a' : 'x';
    const type = slot === 'w' ? pick(W_TYPES) : slot === 'a' ? pick(A_TYPES) : pick(X_TYPES);
    let name = null;
    for (let k = 0; k < 40 && !name; k++) { const p = pick(PREFIX), nn = pick(NOUN[type]), z = p[0] + nn[0]; if (!used.has(z)) { used.add(z); name = [z, `${p[1]} ${nn[1]}`]; } }
    const it = { id: `r${++n}`, slot, type, rarity, tier: 1 + rarity, name, price: [0, 700, 1600, 3600, 8000, 18000][rarity], relic: true, fx: {} };
    const k = [0, 1, 1.4, 1.9, 2.5, 3.2][rarity];
    if (slot === 'w') { const mag = type === 'fan' || type === 'staff'; it.atk = Math.round((mag ? 4 : 12) * k); if (mag) it.spi = Math.round(10 * k); }
    if (slot === 'a') { it.def = Math.round((type === 'robe' ? 6 : type === 'light' ? 8 : 11) * k); if (type === 'robe') it.spi = Math.round(5 * k); if (type === 'light') it.agi = Math.round(3 * k); }
    if (slot === 'x') { for (const [s, v] of Object.entries(X_BASE[type])) it[s] = s === 'mov' ? v : Math.round(v * k * 0.8); if (X_ONLY[type]) it.only = X_ONLY[type]; if (type === 'horse' && rarity >= 4) it.mov = 2; }
    // powers: more and stronger the rarer it is
    const nfx = [0, 1, 1, 2, r() < 0.5 ? 2 : 3, 3][rarity], taken = new Set();
    for (let j = 0; j < nfx; j++) { const key = pickFx(slot, type, rarity, taken); if (!key) break; taken.add(key); it.fx[key] = EFFECTS[key].r[rarity - 1]; }
    // a famous-sounding item may also lift its bearer's attributes
    if (rarity >= 4) { const a = pick(['lead', 'war', 'int', 'pol', 'cha']); it.attr = { [a]: rarity === 5 ? 5 : 3 }; }
    RELICS[it.id] = it; RELIC_LIST.push(it);
  }
}
// a random relic of a rarity (or near it), for chests and rewards
export function rollRelic(rnd, rarity) {
  const pool = RELIC_LIST.filter((x) => x.rarity === rarity);
  return pool[Math.floor(rnd() * pool.length)].id;
}
export function fxText(it) { return Object.entries(it.fx || {}).map(([k, v]) => EFFECTS[k].d(v)); }
