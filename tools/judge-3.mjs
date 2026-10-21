#!/usr/bin/env node
// tools/judge-3.mjs — organ 3, judged by the rules tools/seal-3.mjs sealed. node tools/judge-3.mjs [--write | --check]
import { judgeMain } from './organ.mjs';

const f = (x) => (x / 1e6).toFixed(4);
judgeMain(3, {
  P1: (r) => ({ pass: r.leveled > 0 && r.levels.every((l) => l.shallow && l.deep && l.afterGate === l.after), saw: r.levels.filter((l) => l.shallow).length + ' of ' + r.leveled + ' levels re-ran exactly, ' + r.levels.filter((l) => l.deep).length + ' deeply' }),
  P2: (r) => ({ pass: r.leveled > 0 && r.levels.every((l) => Object.keys(l.refused).length === 5 && Object.values(l.refused).every(Boolean)), saw: r.levels.reduce((s, l) => s + Object.values(l.refused).filter(Boolean).length, 0) + ' of ' + 5 * r.leveled + ' forgeries refused' }),
  P3: (r) => ({ pass: r.leveled > 0 && r.registry.withRerun === r.leveled && r.registry.refusedWithout === r.leveled, saw: r.registry.withRerun + ' recorded with the re-runner; ' + r.registry.refusedWithout + ' refused without it, of ' + r.leveled }),
  Q1: (r) => ({ pass: r.leveled > 0 && r.testUp >= 0.6 * r.leveled, saw: r.testUp + ' of ' + r.leveled + ' levels rose on TEST' }),
  Q2: (r) => ({ pass: r.meanTestGain > 0 && r.meanTestGainLow95 > 0, saw: 'mean TEST gain ' + f(r.meanTestGain) + ', bootstrap 95% lower bound ' + f(r.meanTestGainLow95) }),
  Q3: (r) => ({ pass: r.leveled >= 0.25 * r.sampled, saw: r.leveled + ' of ' + r.sampled + ' cards earned a level in three searches' }),
});
