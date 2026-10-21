#!/usr/bin/env node
// tools/judge-1.mjs — organ 1, judged by the rules tools/seal-1.mjs sealed. node tools/judge-1.mjs [--write | --check]
import { judgeMain } from './organ.mjs';

const all = (r) => Object.values(r.forgeries);
judgeMain(1, {
  P1: (r) => ({ pass: r.roundtrip === r.cards && r.cards > 0, saw: r.roundtrip + ' of ' + r.cards + ' cards read back exactly' }),
  P2: (r) => ({ pass: r.identical === r.cards, saw: r.identical + ' of ' + r.cards + ' written twice were byte-identical' }),
  P3: (r) => ({ pass: all(r).length === 12 && all(r).every((c) => c.tried === r.sample && c.refused === c.tried), saw: Object.entries(r.forgeries).map(([k, c]) => k + ' ' + c.refused + '/' + c.tried).join('; ') }),
  P4: (r) => ({ pass: r.offline.reads === r.sample && r.offline.touched === 0, saw: r.offline.reads + ' of ' + r.sample + ' read with the network trapped; ' + r.offline.touched + ' reached for it' }),
  P5: (r) => ({ pass: r.fakeLevel.read === r.fakeLevel.tried && r.fakeLevel.refused === r.fakeLevel.tried, saw: r.fakeLevel.read + ' of ' + r.fakeLevel.tried + ' faked cards read; ' + r.fakeLevel.refused + ' refused by the registry' }),
  Q1: (r) => ({ pass: r.readMs.median <= 250, saw: 'median ' + r.readMs.median + ' ms, 90th percentile ' + r.readMs.p90 + ' ms (' + r.machine + ')' }),
});
