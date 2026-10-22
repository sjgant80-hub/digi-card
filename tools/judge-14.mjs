#!/usr/bin/env node
// tools/judge-14.mjs — organ 14's verdict, by its sealed rules alone (data/organ-14/prereg.json) over its record.
//   node tools/judge-14.mjs [--write | --check]
import { judgeMain, isMain } from './organ.mjs';

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const sum = (r, k) => r.cards.reduce((s, c) => s + c[k], 0);
export const RULES = {
  P1: (r) => { const n = sum(r, 'rows'), ok = sum(r, 'exact'); return { pass: r.cards.length === 10 * r.sets.length && n === 30 * r.cards.length && ok === n, saw: ok + ' of ' + n + ' GATE rows said in words, asked of ' + r.cards.length + ' cards of ' + r.sets.length + ' businesses, were read back exactly on every column the rules read and answered with the mind’s own label, score and fired rules' }; },
  P2: (r) => {
    const mi = sum(r, 'missing'), miOk = sum(r, 'missingOk'), co = sum(r, 'conflict'), coOk = sum(r, 'conflictOk'), off = sum(r, 'offTopicOk'), offAll = r.offTopic * r.cards.length;
    return { pass: mi > 0 && miOk === mi && co > 0 && coOk === co && off === offAll, saw: miOk + ' of ' + mi + ' questions with a value its rules read left out abstained naming exactly what was missing; ' + coOk + ' of ' + co + ' with one said twice differently abstained; ' + off + ' of ' + offAll + ' off-topic questions abstained' };
  },
  P3: (r) => { const t = sum(r, 'twice'), tOk = sum(r, 'twiceOk'), a = sum(r, 'asks'), aOk = sum(r, 'asksOk'); return { pass: t > 0 && tOk === t && a >= 2 * r.cards.length && aOk === a, saw: tOk + ' of ' + t + ' questions asked twice gave the very same receipt; ' + aOk + ' of ' + a + ' of the questions each card offers were answered' }; },
  Q1: (r) => { const n = sum(r, 'varied'), ok = sum(r, 'variedOk'); return { pass: n > 0 && ok / n >= 0.99, saw: ok + ' of ' + n + ' rows said with other words in another order were read back exactly (' + pct(ok, n) + '%)' }; },
  Q2: (r) => { const n = sum(r, 'names'), ok = sum(r, 'namesAbstain'); return { pass: n > 0 && ok / n >= 0.95, saw: ok + ' of ' + n + ' questions that only name a column abstained (' + pct(ok, n) + '%)' }; },
};
if (isMain(import.meta.url, 'judge-14.mjs')) judgeMain(14, RULES);
