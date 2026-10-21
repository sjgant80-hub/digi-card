#!/usr/bin/env node
// tools/judge-8.mjs — organ 8, judged by the rules tools/seal-8.mjs sealed. node tools/judge-8.mjs [--write | --check]
import { judgeMain } from './organ.mjs';

const f = (x) => (x / 1e6).toFixed(3);
judgeMain(8, {
  P1: (r) => ({ pass: r.registry.ok && r.registry.same && r.registry.entries >= 9000, saw: r.registry.entries + ' entries (' + (r.registry.bytes / 1e6).toFixed(1) + ' MB, ' + r.registry.owners + ' owners) replayed from nothing: ' + (r.registry.same ? 'the very same registry' : 'a different registry') }),
  P2: (r) => ({ pass: r.growth.length > 0 && r.growth.every((x) => x.steps.every((s) => s.shareSum === 1e6)), saw: r.growth.map((x) => x.set + ' ' + x.steps.map((s) => s.shareSum).join('/')).join('; ') }),
  Q1: (r) => ({ pass: r.growth.length > 0 && r.growth.every((x) => x.steps[x.steps.length - 1].test > x.steps[0].test), saw: r.growth.map((x) => x.set + ' ' + f(x.steps[0].test) + ' → ' + f(x.steps[x.steps.length - 1].test)).join('; ') }),
  Q2: (r) => ({ pass: r.growth.length > 0 && r.growth.every((x) => x.steps.every((s, k) => k === 0 || s.test >= x.steps[k - 1].test - 5000)), saw: r.growth.map((x) => x.set + ' ' + x.steps.map((s) => f(s.test)).join(' → ')).join('; ') }),
  Q3: (r) => ({ pass: r.registry.ms <= 300000, saw: r.registry.entries + ' entries in ' + (r.registry.ms / 1000).toFixed(1) + ' s' }),
});
