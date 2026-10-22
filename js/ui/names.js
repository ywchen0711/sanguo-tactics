// Names for the English interface: officers and cities in pinyin.
import { PY, COMPOUND, SPECIAL } from '../data/pinyin.js';
import { EN } from '../i18n.js';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const py = (chars) => [...chars].map((c) => PY[c] || c).join('');
export function romanize(name, place = false) {
  if (!name) return name;
  if (SPECIAL[name]) return SPECIAL[name];
  if (/^[A-Za-z]/.test(name)) return name;
  if (place) return cap(py(name));
  const sur = COMPOUND.find((s) => name.startsWith(s)) || name[0], rest = name.slice(sur.length);
  return rest ? `${cap(py(sur))} ${cap(py(rest))}` : cap(py(sur));
}
const GENERIC = { 守將: 'Garrison Captain', 守備兵: 'Garrison', 弓手隊: 'Bowmen', 鄉勇: 'Volunteers', 民兵: 'Militia', 騎兵隊: 'Riders', 謀士: 'Adviser', 守軍: 'Garrison' };
export const nm = (name) => (EN ? GENERIC[name] || romanize(name) : name);
export const cityName = (name) => (EN ? romanize(name, true) : name);
