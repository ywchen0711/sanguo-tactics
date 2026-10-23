// The rules of the battlefield: terrain, unit classes (兵種) and their promotions, strategies (策略) and gear.
// Everything here is plain data; core/battle.js reads it.

// ---------------------------------------------------------------- terrain
// cost: movement points per move type (0 = impassable); def: defence bonus in %; heal: troops recovered each turn (% of max)
//   move types: foot (infantry, archers, strategists, taoists), horse (cavalry and lords), wild (bandits, brawlers), cart (siege engines)
export const TERRAIN = {
  plain:  { name: ['平原', 'Plain'],     cost: { foot: 1, horse: 1, wild: 1, cart: 1 }, def: 0 },
  grass:  { name: ['草原', 'Grassland'], cost: { foot: 1, horse: 1, wild: 1, cart: 1 }, def: 5, burn: 1.2 },
  forest: { name: ['森林', 'Forest'],    cost: { foot: 2, horse: 3, wild: 1, cart: 0 }, def: 20, burn: 1.3 },
  hill:   { name: ['山地', 'Hills'],     cost: { foot: 2, horse: 3, wild: 1, cart: 3 }, def: 15, rock: true },
  mount:  { name: ['高山', 'Mountain'],  cost: { foot: 0, horse: 0, wild: 2, cart: 0 }, def: 30, rock: true },
  river:  { name: ['河川', 'River'],     cost: { foot: 0, horse: 0, wild: 0, cart: 0 }, def: 0, wet: true },
  shoal:  { name: ['淺灘', 'Shallows'],  cost: { foot: 2, horse: 2, wild: 2, cart: 0 }, def: -10, wet: true },
  bridge: { name: ['橋', 'Bridge'],      cost: { foot: 1, horse: 1, wild: 1, cart: 1 }, def: 0, wet: true },
  road:   { name: ['道路', 'Road'],      cost: { foot: 1, horse: 1, wild: 1, cart: 1 }, def: 0 },
  village:{ name: ['村莊', 'Village'],   cost: { foot: 1, horse: 1, wild: 1, cart: 1 }, def: 10, heal: 10 },
  marsh:  { name: ['濕地', 'Marsh'],     cost: { foot: 2, horse: 3, wild: 2, cart: 0 }, def: -5, wet: true },
  desert: { name: ['沙漠', 'Desert'],    cost: { foot: 2, horse: 2, wild: 2, cart: 2 }, def: 0 },
  snow:   { name: ['雪原', 'Snowfield'], cost: { foot: 2, horse: 2, wild: 2, cart: 3 }, def: 0, cold: true },
  wall:   { name: ['城牆', 'Wall'],      cost: { foot: 0, horse: 0, wild: 0, cart: 0 }, def: 0 },
  gate:   { name: ['城門', 'Gate'],      cost: { foot: 1, horse: 1, wild: 1, cart: 1 }, def: 20 },
  town:   { name: ['城內', 'Town'],      cost: { foot: 1, horse: 1, wild: 1, cart: 1 }, def: 5 },
  castle: { name: ['城池', 'Keep'],      cost: { foot: 1, horse: 1, wild: 1, cart: 1 }, def: 30, heal: 15 },
  camp:   { name: ['陣營', 'Camp'],      cost: { foot: 1, horse: 1, wild: 1, cart: 1 }, def: 15, heal: 10 },
  fence:  { name: ['拒馬', 'Barricade'], cost: { foot: 2, horse: 0, wild: 2, cart: 2 }, def: 25 },
  moat:   { name: ['護城河', 'Moat'],    cost: { foot: 0, horse: 0, wild: 0, cart: 0 }, def: 0, wet: true },
};
// how well each move type fights on each terrain (地形適性), in % — scales both attack and defence
export const APT = {
  foot:  { forest: 100, hill: 100, marsh: 90, shoal: 90, desert: 90, snow: 90 },
  horse: { forest: 80, hill: 85, marsh: 75, shoal: 80, desert: 95, snow: 85, town: 95, castle: 95 },
  wild:  { forest: 115, hill: 120, mount: 120, marsh: 95, shoal: 95, desert: 95, snow: 90, town: 90, castle: 90 },
  cart:  { hill: 90, desert: 90, snow: 85, town: 90, forest: 80 },
};
export const apt = (move, terr) => (APT[move][terr] ?? 100) / 100;

// ---------------------------------------------------------------- unit classes
// grades for growth: S 1.3, A 1.15, B 1.0, C 0.85 (attack, defence, spirit 精神, agility 爆發, morale 士氣)
export const GRADE = { S: 1.3, A: 1.15, B: 1.0, C: 0.85 };
// a line has three tiers; promotion at level 15 and 30
//   r: [min, max] attack range; hp/mp: base and growth per level; g: grades atk def spi agi mor
//   kind: for the counter triangle (cavalry beats infantry beats archers beats cavalry)
export const LINES = {
  inf:    { kind: 'inf',  move: 'foot',  names: [['輕步兵', 'Light Infantry'], ['重步兵', 'Heavy Infantry'], ['近衛兵', 'Imperial Guard']], mov: [4, 4, 5], r: [[1, 1], [1, 1], [1, 1]], hp: [460, 46], mp: [8, 0.6], g: 'BABBB', wpn: 'sword', arm: 'heavy' },
  cav:    { kind: 'cav',  move: 'horse', names: [['輕騎兵', 'Light Cavalry'], ['重騎兵', 'Heavy Cavalry'], ['虎豹騎', 'Tiger Riders']], mov: [6, 6, 7], r: [[1, 1], [1, 1], [1, 1]], hp: [430, 43], mp: [8, 0.6], g: 'ABCAB', wpn: 'spear', arm: 'heavy' },
  arch:   { kind: 'arch', move: 'foot',  names: [['弓兵', 'Archers'], ['弩兵', 'Crossbowmen'], ['連弩兵', 'Repeating Crossbows']], mov: [4, 4, 4], r: [[2, 2], [2, 3], [1, 3]], hp: [380, 38], mp: [8, 0.6], g: 'ACCBB', wpn: 'bow', arm: 'light' },
  hbow:   { kind: 'arch', move: 'horse', names: [['弓騎兵', 'Horse Archers'], ['連弩騎兵', 'Crossbow Riders'], ['神弓騎', 'Divine Bow Riders']], mov: [5, 6, 6], r: [[1, 2], [1, 2], [1, 3]], hp: [390, 39], mp: [8, 0.6], g: 'BCCAB', wpn: 'bow', arm: 'light' },
  strat:  { kind: 'mag',  move: 'foot',  names: [['策士', 'Tactician'], ['軍師', 'Strategist'], ['都督', 'Grand Strategist']], mov: [4, 4, 5], r: [[1, 1], [1, 1], [1, 1]], hp: [340, 34], mp: [30, 3], g: 'CCSBB', wpn: 'fan', arm: 'robe' },
  taoist: { kind: 'mag',  move: 'foot',  names: [['道士', 'Taoist'], ['方士', 'Mystic'], ['仙人', 'Immortal']], mov: [4, 4, 5], r: [[1, 1], [1, 1], [1, 1]], hp: [330, 33], mp: [32, 3.2], g: 'CCABA', wpn: 'staff', arm: 'robe' },
  brawl:  { kind: 'wild', move: 'wild',  names: [['武術家', 'Martial Artist'], ['拳法家', 'Fist Master'], ['武道家', 'Grandmaster']], mov: [5, 5, 6], r: [[1, 1], [1, 1], [1, 1]], hp: [410, 41], mp: [8, 0.6], g: 'ACCSA', wpn: 'fist', arm: 'light' },
  bandit: { kind: 'wild', move: 'wild',  names: [['山賊', 'Bandits'], ['義賊', 'Outlaws'], ['綠林豪傑', 'Greenwood Heroes']], mov: [5, 5, 6], r: [[1, 1], [1, 1], [1, 1]], hp: [430, 43], mp: [8, 0.6], g: 'ABCBC', wpn: 'axe', arm: 'light' },
  siege:  { kind: 'cart', move: 'cart',  names: [['衝車', 'Battering Ram'], ['投石車', 'Catapult'], ['霹靂車', 'Thunder Catapult']], mov: [3, 3, 4], r: [[1, 1], [2, 4], [2, 5]], hp: [420, 42], mp: [4, 0.3], g: 'SBCCC', wpn: null, arm: 'heavy' },
  tower:  { kind: 'tower', move: 'cart', names: [['箭樓', 'Arrow Tower'], ['弩樓', 'Crossbow Tower'], ['連弩樓', 'Repeater Tower']], mov: [0, 0, 0], r: [[2, 3], [2, 3], [2, 4]], hp: [520, 30], mp: [0, 0], g: 'ABCCB', wpn: null, arm: 'heavy' },
  lord:   { kind: 'lord', move: 'horse', names: [['群雄', 'Warlord'], ['霸王', 'Overlord'], ['皇帝', 'Emperor']], mov: [5, 6, 6], r: [[1, 1], [1, 1], [1, 1]], hp: [500, 50], mp: [16, 1.4], g: 'AABBS', wpn: 'sword', arm: 'heavy' },
};
export const LINE_ORDER = ['inf', 'cav', 'arch', 'hbow', 'strat', 'taoist', 'brawl', 'bandit', 'siege', 'lord'];
export const tierOf = (lv) => (lv >= 30 ? 2 : lv >= 15 ? 1 : 0);
export const PROMOTE = [15, 30];
export const MAX_LV = 500;
// the counter triangle: attacker kind vs defender kind → multiplier
export function counter(a, d) {
  const beats = { cav: 'inf', inf: 'arch', arch: 'cav' };
  if (beats[a] === d) return 1.25;
  if (beats[d] === a) return 0.8;
  if (a === 'cav' && d === 'mag') return 1.1;
  return 1;
}

// ---------------------------------------------------------------- strategies (策略)
// [id, zh, en, mp, range, area, kind, power]
//   kind: fire water rock wind bolt (damage) · heal cure (help) · conf stop seal poison (ailments) · atk+ def+ spi+ agi+ (buffs on friends) · atk- def- (on foes)
//   area: 0 one target, 1 a plus of five tiles, 2 a diamond of thirteen
const STRAT_RAW = [
  ['huoji', '火計', 'Fire', 6, 3, 0, 'fire', 1.0], ['jiaore', '焦熱', 'Scorch', 12, 3, 0, 'fire', 1.6], ['baoyan', '爆焰', 'Blaze', 18, 3, 1, 'fire', 1.35], ['huolong', '火龍', 'Fire Dragon', 28, 4, 2, 'fire', 1.5],
  ['shuiji', '水計', 'Flood', 6, 3, 0, 'water', 1.05], ['zhuoliu', '濁流', 'Torrent', 13, 3, 1, 'water', 1.3], ['hongshui', '大洪水', 'Deluge', 26, 4, 2, 'water', 1.5],
  ['luoshi', '落石', 'Rockfall', 6, 3, 0, 'rock', 1.05], ['shanbeng', '山崩', 'Landslide', 13, 3, 1, 'rock', 1.35],
  ['xuanfeng', '旋風', 'Whirlwind', 8, 3, 0, 'wind', 1.1], ['baofeng', '暴風', 'Gale', 16, 3, 1, 'wind', 1.3],
  ['luolei', '落雷', 'Thunderbolt', 11, 3, 0, 'bolt', 1.5], ['tianlei', '天雷', 'Heaven\'s Wrath', 24, 4, 1, 'bolt', 1.6],
  ['yuanzhu', '援助', 'Relief', 5, 2, 0, 'heal', 1.0], ['dayuanzhu', '大援助', 'Great Relief', 10, 2, 0, 'heal', 2.0], ['buji', '補給', 'Resupply', 12, 2, 1, 'heal', 1.0], ['huitian', '回天', 'Turn the Tide', 26, 3, 2, 'heal', 1.6],
  ['zhiliao', '治療', 'Remedy', 4, 2, 0, 'cure', 1], ['guwu', '鼓舞', 'Rally', 7, 2, 1, 'cure', 1],
  ['hunluan', '混亂', 'Confuse', 6, 3, 0, 'conf', 1], ['qianzhi', '牽制', 'Pin Down', 5, 3, 0, 'stop', 1], ['fengsha', '封殺', 'Silence', 5, 3, 0, 'seal', 1], ['duyan', '毒煙', 'Poison Smoke', 7, 3, 1, 'poison', 1],
  ['jili', '激勵', 'Inspire', 5, 2, 0, 'atk+', 1], ['tiebi', '鐵壁', 'Iron Wall', 5, 2, 0, 'def+', 1], ['mingxiang', '冥想', 'Clear Mind', 5, 2, 0, 'spi+', 1], ['shenxing', '神行', 'Swift Step', 6, 2, 0, 'agi+', 1],
  ['dunbing', '鈍兵', 'Blunt Arms', 5, 3, 0, 'atk-', 1], ['pozhen', '破陣', 'Break Ranks', 5, 3, 0, 'def-', 1],
  ['bazhen', '八陣圖', 'Eight-Gate Maze', 30, 4, 1, 'stop', 1.5],
];
export const STRATS = {};
for (const [id, zh, en, mp, r, a, kind, p] of STRAT_RAW) STRATS[id] = { id, name: [zh, en], mp, r, a, kind, p };
export const DMG_KINDS = new Set(['fire', 'water', 'rock', 'wind', 'bolt']);
export const HELP_KINDS = new Set(['heal', 'cure', 'atk+', 'def+', 'spi+', 'agi+']);
export const AILMENTS = { conf: ['混亂', 'Confused', '#ff8ad8'], stop: ['牽制', 'Pinned', '#8ad0ff'], seal: ['封殺', 'Silenced', '#c0a0ff'], poison: ['中毒', 'Poisoned', '#8ad04a'] };
export const BUFF_NAMES = { atk: ['攻擊', 'ATK'], def: ['防禦', 'DEF'], spi: ['精神', 'SPI'], agi: ['爆發', 'AGI'], mor: ['士氣', 'MOR'] };
// what each line learns, and at what level
export const LEARN = {
  inf: [['tiebi', 8], ['jili', 18], ['guwu', 28]],
  cav: [['jili', 10], ['shenxing', 20], ['pozhen', 32]],
  arch: [['huoji', 8], ['dunbing', 18], ['jiaore', 34]],
  hbow: [['huoji', 10], ['shenxing', 18], ['dunbing', 30]],
  strat: [['huoji', 1], ['luoshi', 3], ['shuiji', 5], ['hunluan', 7], ['xuanfeng', 9], ['qianzhi', 11], ['dunbing', 13], ['jiaore', 15], ['pozhen', 16], ['fengsha', 18], ['zhuoliu', 20], ['shanbeng', 22], ['baoyan', 25], ['baofeng', 28], ['huolong', 35], ['hongshui', 40]],
  taoist: [['yuanzhu', 1], ['zhiliao', 3], ['xuanfeng', 5], ['qianzhi', 7], ['mingxiang', 9], ['luolei', 11], ['guwu', 13], ['dayuanzhu', 15], ['duyan', 17], ['tiebi', 19], ['buji', 21], ['hunluan', 23], ['tianlei', 30], ['huitian', 36]],
  brawl: [['guwu', 8], ['jili', 16], ['shenxing', 24]],
  bandit: [['hunluan', 10], ['duyan', 20], ['dunbing', 28]],
  siege: [['luoshi', 12], ['shanbeng', 32]],
  tower: [],
  lord: [['jili', 3], ['yuanzhu', 6], ['huoji', 10], ['guwu', 15], ['tiebi', 20], ['dayuanzhu', 25], ['jiaore', 30], ['buji', 38]],
};
// famous strategists' own arts
export const SIGNATURE = { 諸葛亮: ['bazhen', 'hongshui', 'huolong'], 周瑜: ['huolong', 'baoyan'], 陸遜: ['huolong', 'baoyan'], 龐統: ['huolong', 'hunluan'], 司馬懿: ['bazhen', 'hunluan'], 于吉: ['tianlei', 'luolei'], 左慈: ['tianlei', 'huitian'], 張角: ['tianlei', 'luolei', 'duyan'], 華佗: ['huitian', 'dayuanzhu'], 郭嘉: ['hunluan', 'baoyan'], 賈詡: ['duyan', 'hunluan'] };

// ---------------------------------------------------------------- gear
// slots: w weapon, a armour, x accessory. tiers 1-5; a famous item (寶物) also raises the bearer's attributes
const WTYPES = { sword: ['劍', 'Sword'], spear: ['槍', 'Spear'], bow: ['弓', 'Bow'], fan: ['羽扇', 'Fan'], staff: ['杖', 'Staff'], fist: ['拳套', 'Gauntlets'], axe: ['斧', 'Axe'] };
const ATYPES = { heavy: ['鎧', 'Mail'], light: ['皮甲', 'Leather'], robe: ['道袍', 'Robe'] };
const TIER = [['銅', 'Bronze'], ['鐵', 'Iron'], ['鋼', 'Steel'], ['精鋼', 'Fine Steel'], ['玄鐵', 'Dark Iron']];
export const GEAR = {};
for (const [t, [zh, en]] of TIER.entries()) {
  for (const [k, [wz, we]] of Object.entries(WTYPES)) {
    const mag = k === 'fan' || k === 'staff';
    GEAR[`${k}${t + 1}`] = { id: `${k}${t + 1}`, slot: 'w', type: k, tier: t + 1, name: [`${zh}${wz}`, `${en} ${we}`], atk: mag ? 2 + t * 2 : 5 + t * 5, spi: mag ? 5 + t * 5 : 0, price: [200, 500, 1100, 2200, 4000][t] };
  }
  for (const [k, [az, ae]] of Object.entries(ATYPES)) GEAR[`${k}${t + 1}`] = { id: `${k}${t + 1}`, slot: 'a', type: k, tier: t + 1, name: [`${zh}${az}`, `${en} ${ae}`], def: k === 'robe' ? 3 + t * 3 : k === 'light' ? 4 + t * 4 : 5 + t * 5, spi: k === 'robe' ? 3 + t * 3 : 0, agi: k === 'light' ? 1 + t : 0, price: [180, 450, 1000, 2000, 3600][t] };
}
// accessories
const ACC = [
  ['horse1', '駿馬', 'Fine Horse', { mov: 1 }, 800, 'horse'], ['shoes1', '草鞋', 'Straw Sandals', { mov: 1 }, 900, 'foot'],
  ['book1', '孫子兵法', 'The Art of War', { spi: 8, mp: 10 }, 1500], ['book2', '六韜', 'Six Secret Teachings', { spi: 6, agi: 4 }, 1200],
  ['seal1', '將印', 'General\'s Seal', { mor: 10 }, 1000], ['ring1', '護身符', 'Amulet', { res: 20 }, 1100], ['flag1', '軍旗', 'War Banner', { atk: 5, mor: 5 }, 1300], ['shield1', '藤甲', 'Rattan Shield', { def: 8 }, 1000],
];
for (const [id, zh, en, fx, price, only] of ACC) GEAR[id] = { id, slot: 'x', tier: 3, name: [zh, en], ...fx, price, only };
// consumables (道具): heal troops, restore strategy points, cure ailments
export const USABLES = {
  dou: { id: 'dou', name: ['豆', 'Beans'], heal: 300, price: 60 },
  mai: { id: 'mai', name: ['麥', 'Wheat'], heal: 700, price: 150 },
  mi: { id: 'mi', name: ['米', 'Rice'], heal: 1500, price: 400 },
  jiu: { id: 'jiu', name: ['酒', 'Wine'], mph: 20, price: 200 },
  yao: { id: 'yao', name: ['傷藥', 'Salve'], cure: true, price: 80 },
};
export const ARMOR_FOR = (line) => LINES[line].arm;
export const WEAPON_FOR = (line) => LINES[line].wpn;
