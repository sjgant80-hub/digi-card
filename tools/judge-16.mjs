#!/usr/bin/env node
// tools/judge-16.mjs — organ 16's verdict, by its sealed rules alone (data/organ-16/prereg.json) over its record.
//   node tools/judge-16.mjs [--write | --check]
import { judgeMain, isMain } from './organ.mjs';

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[(s.length - 1) >> 1] : null; };
const six = (m) => (m === null ? '–' : (m / 1e6).toFixed(6));
const ok = (r) => r.builds.filter((b) => b.ok);
export const RULES = {
  P1: (r) => {
    const good = ok(r).filter((b) => b.sameReversed && b.sameAgain && b.fieldOk && b.rerunType).length;
    return { pass: !r.dry && !r.small && r.builds.length === 80 && ok(r).length === 80 && good === 80, saw: good + ' of ' + r.builds.length + ' builds measured again to the very same receipt by two keys (once reversed, with a card of another business among them), every fielding by the rule' + (ok(r).length < r.builds.length ? ' · ' + (r.builds.length - ok(r).length) + ' could not be measured' : '') };
  },
  P2: (r) => {
    const good = ok(r).filter((b) => b.gateOk && b.bestOk && b.liftOk && b.verdictOk && b.nameOk && b.contribOk).length;
    return { pass: ok(r).length === 80 && good === 80, saw: good + ' of ' + ok(r).length + ' receipts say exactly what their fielded parts give, worked out again apart from the kernel: GATE, best part, lift, verdict, name, every part’s contribution' };
  },
  P3: (r) => {
    const proven = ok(r).filter((b) => b.proven).length, refused = ok(r).filter((b) => b.attackRefused).length;
    return { pass: ok(r).length === 80 && proven === 80 && refused === 80, saw: proven + ' of ' + ok(r).length + ' proven by the two keys, the first named the finder; ' + refused + ' of ' + ok(r).length + ' attack sets (a key twice, a forged signature, two re-runs of another receipt) proved nothing and were each named' };
  },
  P4: (r) => {
    const s = r.shrinks.filter((x) => x.ok), good = s.filter((x) => x.deepOk && x.studentOk && x.keptOk && x.sameSeed && x.cardOk).length;
    return { pass: r.shrinks.length === 20 && s.length === 20 && good === 20, saw: good + ' of ' + r.shrinks.length + ' shrinks checked deeply (the search on the teacher’s answers finds the student), the student scoring its stated GATE, kept exactly by the 0.002 rule, its control the very same seed, and a kept student a card’s genome' };
  },
  Q1: (r) => { const c = ok(r).filter((b) => b.verdict === 'combo'), held = c.filter((b) => b.testLift > 0).length; return { pass: c.length > 0 && held / c.length >= 0.8, saw: held + ' of ' + c.length + ' combos found on GATE also beat their best part on TEST (' + pct(held, c.length) + '%)' }; },
  Q2: (r) => { const c = ok(r).filter((b) => b.verdict === 'combo'), t = median(c.map((b) => b.testLift)), g = median(c.map((b) => b.lift)); return { pass: c.length > 0 && t >= g / 2, saw: c.length + ' combos: median lift ' + six(g) + ' on GATE, ' + six(t) + ' on TEST' }; },
  Q3: (r) => { const k = r.shrinks.filter((x) => x.ok && x.kept), held = k.filter((x) => x.studentTest > x.sourceTest).length; return { pass: k.length > 0 && held / k.length >= 0.7, saw: held + ' of ' + k.length + ' kept students also beat their best source on TEST (' + pct(held, k.length) + '%)' }; },
  Q4: (r) => { const s = r.shrinks.filter((x) => x.ok), won = s.filter((x) => x.studentTest >= x.controlTest).length; return { pass: s.length > 0 && won / s.length >= 0.5, saw: won + ' of ' + s.length + ' students taught by their build scored at least the same search on the true answers on TEST (' + pct(won, s.length) + '%)' }; },
  Q5: (r) => { const s = r.shrinks.filter((x) => x.ok), kept = s.filter((x) => x.kept).length; return { pass: s.length > 0 && kept / s.length >= 0.2, saw: kept + ' of ' + s.length + ' shrinks kept their student (' + pct(kept, s.length) + '%)' }; },
};
if (isMain(import.meta.url, 'judge-16.mjs')) judgeMain(16, RULES);
