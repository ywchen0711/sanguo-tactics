// how well the computer houses staff their cities: empty cities, officers on threatened borders vs. safe interior towns
// node tools/staff.mjs [months]
import * as C from '../js/core/campaign.js';
import { SCENARIOS } from '../js/data/scenarios.js';

const months = +(process.argv[2] || 24);
const tot = { cities: 0, empty: 0, emptyBorder: 0, thr: 0, thrOff: 0, thrWeak: 0, thrFull: 0, inner: 0, innerOff: 0, idleTroops: 0, troops: 0 };
let houses = 0, housesStart = 0;
for (const sc of SCENARIOS) for (const seed of [1, 2, 3]) {
  const G = C.newGame({ scenario: sc.id, player: sc.factions[0][0], seed });
  housesStart += Object.values(G.factions).filter((f) => f.alive).length;
  for (let m = 0; m < months && !G.over; m++) {
    const { threats } = C.endMonth(G, { autoPlayer: true });
    for (const t of threats) { const B = C.battleSetup(G, t); C.autoBattle(B); C.settle(G, B); if (G.over) break; }
    if (m % 6 !== 5) continue;
    // a snapshot every half year
    for (const c of G.cities) {
      if (!c.owner) continue;
      const f = c.owner, n = C.officersIn(G, c).length;
      const foes = c.adj.map((j) => G.cities[j]).filter((d) => d.owner && d.owner !== f && !C.atPeace(G, f, d.owner));
      const border = c.adj.some((j) => G.cities[j].owner !== f);
      tot.cities++; tot.troops += c.troops;
      if (!n) { tot.empty++; if (border) tot.emptyBorder++; }
      if (foes.length) { tot.thr++; tot.thrOff += n; if (c.troops >= C.capOf(c) * 0.9) tot.thrFull++; if (C.cityPower(G, c) < Math.max(...foes.map((d) => C.cityPower(G, d))) * 0.8) tot.thrWeak++; }
      else if (!border) { tot.inner++; tot.innerOff += n; tot.idleTroops += c.troops; }
    }
  }
  houses += Object.values(G.factions).filter((f) => f.alive).length;
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0') + '%';
console.log(`over ${months} months, ${SCENARIOS.length} scenarios x 3 seeds, snapshots every 6 months`);
console.log(`empty cities           ${pct(tot.empty, tot.cities)}  (on a border: ${tot.emptyBorder})`);
console.log(`officers per city      threatened border ${(tot.thrOff / Math.max(1, tot.thr)).toFixed(2)}  ·  safe interior ${(tot.innerOff / Math.max(1, tot.inner)).toFixed(2)}`);
console.log(`threatened & outgunned ${pct(tot.thrWeak, tot.thr)} of threatened cities`);
console.log(`threatened at full camp ${pct(tot.thrFull, tot.thr)} (can't take more soldiers)`);
console.log(`troops idle inside     ${pct(tot.idleTroops, tot.troops)} of all soldiers`);
console.log(`houses left            ${houses} of ${housesStart}`);
