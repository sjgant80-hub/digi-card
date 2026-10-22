#!/usr/bin/env node
// tools/judge-17.mjs — organ 17's verdict, by its sealed rules alone (data/organ-17/prereg.json) over its record.
//   node tools/judge-17.mjs [--write | --check]
import { judgeMain, isMain } from './organ.mjs';

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const ok = (r) => r.heroes.filter((h) => h.crowned);
/** a model's recycling, as sealed: warm against cold at the median, the controls against cold, and foldcycle's verdict */
function recycled(r, model) {
  const x = r.recycling.find((y) => y.model === model);
  if (!x || x.cold.length !== 10 || x.warm.length !== 20 || x.control.length !== 10) return { pass: false, saw: 'no full recycling record for ' + model };
  const c = median(x.cold), w = median(x.warm), k = median(x.control), saved = Math.round((100 * (c - w)) / c), ctl = Math.round((100 * (c - k)) / c);
  return { pass: saved >= 75 && ctl < 25 && x.verdict.verdict === 'WIN', saw: model + ': cold ' + c + ' ms, warm ' + w + ' ms (' + saved + '% less), controls ' + k + ' ms (' + ctl + '% against cold); kar-foldcycle says ' + x.verdict.verdict };
}
export const RULES = {
  P1: (r) => {
    const h = ok(r), good = h.filter((x) => x.checks && x.tampers === 15 && x.refused === 15).length, refused = h.reduce((s, x) => s + (x.refused || 0), 0), tried = h.reduce((s, x) => s + (x.tampers || 0), 0);
    return { pass: !r.small && r.heroes.length === 120 && h.length === 120 && good === 120 && refused === 1800 && tried === 1800, saw: h.length + ' of ' + r.heroes.length + ' heroes crowned, ' + h.filter((x) => x.checks).length + ' checked exactly as crowned; ' + refused + ' of ' + tried + ' tampered copies refused' };
  },
  P2: (r) => {
    const h = ok(r), good = h.filter((x) => x.stable && x.memoryMoves === x.memoryShared && x.appendOnly && x.freshAt === 20).length;
    return { pass: h.length === 120 && good === 120, saw: good + ' of ' + h.length + ' heroes: the same opening three times, moved by memory exactly when shared (' + h.filter((x) => x.memoryShared).length + ' share), a page that only grew for 20 questions and started fresh on the 21st' };
  },
  P3: (r) => {
    const h = ok(r), good = h.filter((x) => x.wall && x.wall.mismatches === 0 && !x.wall.over && x.wall.spent <= x.wall.budget).length;
    return { pass: h.length === 120 && good === 120, saw: good + ' of ' + h.length + ' limit walls: every one of 50 questions routed to the key exactly when it fit, the total never past the limit (' + h.reduce((s, x) => s + (x.wall ? x.wall.mismatches : 0), 0) + ' mismatches)' };
  },
  P4: (r) => {
    const h = ok(r), good = h.filter((x) => x.verified > 0 && x.ruled === x.verified && x.off === 5 && x.offAbstained === 5 && x.offKeyed === 5).length;
    return { pass: h.length === 120 && good === 120, saw: good + ' of ' + h.length + ' heroes: ' + h.reduce((s, x) => s + x.ruled, 0) + ' of ' + h.reduce((s, x) => s + x.verified, 0) + ' questions their rules answer routed to the rules; ' + h.reduce((s, x) => s + x.offKeyed, 0) + ' of ' + h.reduce((s, x) => s + x.off, 0) + ' off-business questions routed to the key' };
  },
  Q1: (r) => recycled(r, 'qwen2.5:7b'),
  Q2: (r) => recycled(r, 'llama3.2:1b'),
  Q3: (r) => {
    const h = ok(r), short = h.filter((x) => !(x.openingTokens >= 512)).length, q = r.recycling.find((y) => y.model === 'qwen2.5:7b'), reads = q ? q.rows.map((x) => x.coldTokens) : [];
    return { pass: h.length === 120 && short === 0 && reads.length === 10 && reads.every((t) => t >= 512), saw: (h.length - short) + ' of ' + h.length + ' openings at least 512 tokens by the game’s counter (smallest ' + Math.min(...h.map((x) => x.openingTokens)) + '); cold reads on qwen2.5:7b: ' + reads.join(', ') + ' tokens' };
  },
};
if (isMain(import.meta.url, 'judge-17.mjs')) judgeMain(17, RULES);
