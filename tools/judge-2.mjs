#!/usr/bin/env node
// tools/judge-2.mjs — organ 2, judged by the rules tools/seal-2.mjs sealed. node tools/judge-2.mjs [--write | --check]
import { judgeMain } from './organ.mjs';

const f = (x) => (x / 1e6).toFixed(3);
judgeMain(2, {
  P1: (r) => ({ pass: r.declared === r.cards && r.cards > 0, saw: r.declared + ' of ' + r.cards + ' minds scored exactly their declared GATE' }),
  P2: (r) => ({ pass: r.offline.ran === r.cards && r.offline.touched === 0, saw: r.offline.ran + ' of ' + r.cards + ' expressed with the network trapped; ' + r.offline.touched + ' reached for it' }),
  P3: (r) => ({ pass: r.deep.same === r.deep.tried && r.deep.tried > 0, saw: r.deep.same + ' of ' + r.deep.tried + ' searches, re-run from nothing, found the very same mind' }),
  P4: (r) => ({ pass: Object.values(r.changedBytes).every((w) => / is not the published bytes$/.test(w)), saw: Object.entries(r.changedBytes).map(([s, w]) => s + ': ' + w).join('; ') }),
  Q1: (r) => ({ pass: r.aboveCoin >= Math.ceil(0.99 * r.cards), saw: r.aboveCoin + ' of ' + r.cards + ' above a coin on TEST' }),
  Q2: (r) => ({ pass: r.medianDrop <= 20000, saw: 'median GATE − TEST: ' + f(r.medianDrop) }),
  Q3: (r) => ({ pass: Object.values(r.departments).every((d) => d.medianTest >= 600000), saw: Object.entries(r.departments).map(([d, x]) => d + ' ' + f(x.medianTest)).join('; ') }),
});
