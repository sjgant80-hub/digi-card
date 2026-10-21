#!/usr/bin/env node
// tools/judge-11.mjs — organ 11's verdict, by its sealed rules alone (data/organ-11/prereg.json) over its record.
//   node tools/judge-11.mjs [--write | --check]
import { judgeMain, isMain } from './organ.mjs';

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[(s.length - 1) >> 1] : null; };
const six = (m) => (m / 1e6).toFixed(6);
export const RULES = {
  P1: (r) => {
    const good = r.kits.filter((k) => k.ok && k.same && k.greedyOk && k.liftsOk).length, clean = r.foreign.filter((f) => f.ok && f.clean).length;
    return { pass: !r.dry && r.kits.length === 100 && good === 100 && r.foreign.length === 20 && clean === 20, saw: good + ' of ' + r.kits.length + ' auto-kits the same twice in either order, every step lifting and the best of what joins; ' + clean + ' of ' + r.foreign.length + ' foreign pools never picked another key’s card, another business’s or the DIGI itself' };
  },
  P2: (r) => {
    const c = r.chapters, x = r.receipts;
    return { pass: c.once && c.ordered && c.n === c.worlds && x.sets === 1000 && x.consistent === 1000 && x.twice === 1000, saw: c.n + ' chapters holding ' + c.raids + ' raid bosses and ' + c.worlds + ' world bosses, each once' + (c.ordered ? ', least left first' : ', NOT in order') + '; ' + x.consistent + ' of ' + x.sets + ' receipt sets read exactly as their bosses fell, ' + x.twice + ' the same in either order' };
  },
  P3: (r) => { const ok = r.kits.filter((k) => k.measuredOk).length; return { pass: r.kits.length === 100 && ok === 100, saw: ok + ' of ' + r.kits.length + ' auto-kits measure again exactly what they said' }; },
  Q1: (r) => { const lifted = r.kits.filter((k) => k.ok && k.lift >= 5000), held = lifted.filter((k) => k.testLift > 0).length; return { pass: lifted.length > 0 && held / lifted.length >= 0.8, saw: held + ' of ' + lifted.length + ' auto-kits that lifted GATE by 0.005 or more also lifted TEST (' + pct(held, lifted.length) + '%)' }; },
  Q2: (r) => { const many = r.kits.filter((k) => k.ok && k.steps >= 2), full = median(many.map((k) => k.testLift)), first = median(many.map((k) => k.testFirstLift)); return { pass: many.length > 0 && full >= first, saw: many.length + ' auto-kits of two nodes or more: median TEST lift ' + (full === null ? '–' : six(full)) + ' with every node, ' + (first === null ? '–' : six(first)) + ' with the first alone' }; },
  Q3: (r) => { const some = r.kits.filter((k) => k.ok && k.steps >= 1), beat = some.filter((k) => k.test >= k.testRandom).length; return { pass: some.length > 0 && beat / some.length >= 0.7, saw: beat + ' of ' + some.length + ' auto-kits scored at least a seeded random kit of the same size on TEST (' + pct(beat, some.length) + '%)' }; },
};
if (isMain(import.meta.url, 'judge-11.mjs')) judgeMain(11, RULES);
