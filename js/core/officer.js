// Officers (武將): the five attributes from history, a unit class that grows with level, gear, and the battle numbers
// those add up to. Shared by the campaign and the battle rules.
import { LINES, GRADE, tierOf, MAX_LV, LEARN, SIGNATURE, STRATS, GEAR } from '../data/rules.js';
import { ITEMS as TREASURE_RAW } from '../data/treasures.js';

// famous items (寶物): a weapon (w) fights as a top-tier weapon; horses, books and treasures sit in the accessory slot
export const TREASURES = {};
for (const [key, zh, en, slot, bonus] of TREASURE_RAW) {
  const t = { id: 't_' + key, key, name: [zh, en], famous: true, slot: slot === 'w' ? 'w' : 'x', attr: bonus, tier: 6, price: 6000 };
  if (slot === 'w') t.atk = 30; else if (slot === 'h') { t.mov = 1; t.only = 'horse'; t.agi = 6; } else if (slot === 'b') { t.spi = 10; t.mp = 12; } else t.mor = 8;
  TREASURES[t.id] = t;
}
export const itemDef = (id) => GEAR[id] || TREASURES[id] || null;

// which kind of soldiers a general leads, from what history says they were good at
const BY_NAME = {
  lord: [], // filled at the start of a game with the warlords
  cav: '呂布 張遼 馬超 馬岱 龐德 趙雲 張飛 關羽 文醜 顏良 公孫瓚 曹純 夏侯惇 許褚 張郃 徐晃 文鴦 馬騰 韓遂 曹彰 孫策 華雄 曹仁 曹洪 董卓 閻行 姜維 張繡 胡車兒 夏侯霸',
  arch: '黃忠 太史慈 夏侯淵 呂虔 黃蓋 程普 韓當 周泰 蔣欽 嚴顏 秦宓 李嚴 陳武 魏續 宋憲 侯成 曹休',
  hbow: '馬雲祿 公孫越 公孫範 樂進 李典 黃權 蹋頓 軻比能 徹里吉 越吉 劉豹 孫權 孫尚香',
  brawl: '典韋 許褚 孟獲 祝融 兀突骨 沙摩柯 帶來洞主 木鹿大王 朵思大王 金環三結 阿會喃 忙牙長 胡車兒 張任',
  bandit: '周倉 裴元紹 張燕 管亥 甘寧 臧霸 孫觀 昌豨 尹禮 吳敦 廖化 何儀 黃劭 龔都 劉辟 彭脫',
  taoist: '于吉 左慈 張角 張寶 張梁 華佗 管輅 孟節 張魯 黃承彥 司馬徽 南華 普淨 張衛 李意',
  strat: '諸葛亮 龐統 司馬懿 周瑜 陸遜 郭嘉 賈詡 荀彧 荀攸 程昱 徐庶 法正 魯肅 呂蒙 田豐 沮授 陳宮 審配 李儒 蒯越 蒯良 張昭 張紘 諸葛瑾 馬良 姜維x 鄧艾x 鍾會 劉曄 滿寵 蔣琬 費禕 陸抗 闞澤 虞翻 顧雍 步騭 諸葛恪 王允 許攸 逢紀 郭圖 辛評 楊修 孫乾 簡雍 伊籍 劉巴 李恢 呂範',
};
const LINE_OF = {};
for (const [line, names] of Object.entries(BY_NAME)) if (typeof names === 'string') for (const n of names.split(/\s+/)) if (!n.endsWith('x') && !LINE_OF[n]) LINE_OF[n] = line;
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return (h >>> 0) / 4294967296; };
export function pickLine(o) {
  if (LINE_OF[o.name]) return LINE_OF[o.name];
  const { lead, war, int } = o, h = hash(o.name);
  if (int >= 82 && war < 72) return int >= 90 && h < 0.15 ? 'taoist' : 'strat';
  if (int >= 75 && war < 55) return h < 0.3 ? 'taoist' : 'strat';
  if (war >= 82) return h < 0.55 ? 'cav' : h < 0.75 ? 'inf' : h < 0.88 ? 'hbow' : 'brawl';
  if (lead >= 75 && war >= 65) return h < 0.4 ? 'cav' : h < 0.75 ? 'inf' : 'arch';
  if (war >= 65) return h < 0.35 ? 'inf' : h < 0.6 ? 'cav' : h < 0.85 ? 'arch' : 'bandit';
  if (int >= 65) return h < 0.6 ? 'strat' : h < 0.75 ? 'taoist' : 'arch';
  if (lead >= 60) return h < 0.4 ? 'inf' : h < 0.7 ? 'arch' : 'siege';
  return h < 0.4 ? 'inf' : h < 0.7 ? 'arch' : h < 0.85 ? 'bandit' : 'siege';
}
// a sensible starting level from how able they are
export function startLevel(o, extra = 0) {
  const s = o.lead * 0.4 + o.war * 0.35 + o.int * 0.25, h = hash(o.name + 'lv');
  return Math.max(1, Math.min(30, Math.round((s - 40) / 4.5 + h * 3 + extra)));
}

// attributes with gear bonuses
export function attrs(o) {
  const a = { lead: o.lead, war: o.war, int: o.int, pol: o.pol, cha: o.cha };
  for (const id of Object.values(o.eq || {})) { const it = id && itemDef(id); if (it && it.attr) for (const [k, v] of Object.entries(it.attr)) a[k] = Math.min(120, a[k] + v); }
  return a;
}
const grow = (base, lv, g) => base * (1 + (lv - 1) * 0.035 * GRADE[g]);
// the numbers a unit fights with
export function battleStats(o) {
  const L = LINES[o.line], t = tierOf(o.lv), a = attrs(o), lv = o.lv, g = L.g;
  const s = {
    line: o.line, tier: t, kind: L.kind, move: L.move, cls: L.names[t], mov: L.mov[t], r: L.r[t],
    atk: grow(a.war * 0.6 + 12, lv, g[0]), def: grow(a.lead * 0.6 + 12, lv, g[1]), spi: grow(a.int * 0.6 + 12, lv, g[2]),
    agi: grow(a.war * 0.4 + a.lead * 0.3 + a.int * 0.3 + 6, lv, g[3]), mor: grow(a.cha * 0.4 + a.lead * 0.4 + 8, lv, g[4]),
    hp: (L.hp[0] + (lv - 1) * L.hp[1]) * (0.75 + a.lead / 300) * (1 + t * 0.08), mp: (L.mp[0] + (lv - 1) * L.mp[1]) * (0.5 + a.int / 100), res: 0,
  };
  for (const [slot, id] of Object.entries(o.eq || {})) {
    const it = id && itemDef(id); if (!it) continue;
    if (it.only && it.only !== L.move && !(it.only === 'foot' && L.move !== 'horse')) continue;
    for (const k of ['atk', 'def', 'spi', 'agi', 'mor', 'mov', 'mp', 'res']) if (it[k]) s[k] += it[k];
    if (slot === 'w' && it.famous) s.atk += t * 4;
  }
  for (const k of ['atk', 'def', 'spi', 'agi', 'mor']) s[k] = Math.round(s[k]);
  s.hp = Math.round(s.hp / 10) * 10; s.mp = Math.round(s.mp);
  // a commander of many years is hard to rattle
  s.strats = strategiesOf(o);
  return s;
}
export function strategiesOf(o) {
  const out = LEARN[o.line].filter(([, l]) => o.lv >= l).map(([id]) => id);
  // the great strategists bring their own arts once they've grown into them
  if (SIGNATURE[o.name] && o.lv >= 12) for (const id of SIGNATURE[o.name]) if (!out.includes(id) && (o.lv >= 20 || STRATS[id].mp <= 20)) out.push(id);
  if (o.int >= 85 && !['strat', 'taoist'].includes(o.line) && !out.includes('huoji')) out.unshift('huoji');
  return out;
}
export const EXP_LV = 100;
export function gainExp(o, n) {
  const ups = [];
  o.exp = (o.exp || 0) + n;
  while (o.exp >= EXP_LV && o.lv < MAX_LV) { o.exp -= EXP_LV; o.lv++; ups.push(o.lv); }
  if (o.lv >= MAX_LV) o.exp = 0;
  return ups;
}
// the default kit for a new officer: weapon and armour of the right kind for their soldiers
export function defaultGear(o, tier = 1) {
  const L = LINES[o.line], t = Math.max(1, Math.min(5, tier));
  return { w: L.wpn ? `${L.wpn}${t}` : null, a: `${L.arm}${t}`, x: null };
}
// when a unit's line changes (a lord, or the player re-trains them), swap gear that no longer fits
export function fits(o, it) {
  if (!it) return true;
  const L = LINES[o.line];
  if (it.slot === 'w') return it.famous || it.type === L.wpn || (L.wpn === 'spear' && it.type === 'sword') || (o.line === 'lord' && it.type === 'spear');
  if (it.slot === 'a') return it.type === L.arm || (L.arm === 'heavy' && it.type === 'light') || (L.arm === 'light' && it.type === 'robe' && false);
  return !it.only || it.only === L.move || (it.only === 'foot' && L.move !== 'horse');
}
