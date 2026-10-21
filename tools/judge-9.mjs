#!/usr/bin/env node
// tools/judge-9.mjs — organ 9's verdict, by its sealed rules alone (data/organ-9/prereg.json) over its record.
//   node tools/judge-9.mjs [--write | --check]
import { judgeMain, isMain } from './organ.mjs';

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
export const RULES = {
  P1: (r) => { const ok = r.duels.filter((x) => x.ok && x.rerun).length; return { pass: r.duels.length === 1000 && ok === 1000, saw: ok + ' of ' + r.duels.length + ' duels re-ran to the same receipt' }; },
  P2: (r) => { const good = r.duels.filter((x) => x.ok && x.receipt.n === r.batch && x.batchDistinct && x.batchGate && !x.batchTest).length; return { pass: good === r.duels.length && r.duels.length === 1000, saw: good + ' of ' + r.duels.length + ' batches were ' + r.batch + ' distinct GATE rows with no TEST row' }; },
  P3: (r) => { const refused = r.forgeries.filter((x) => x.refused).length; return { pass: r.forgeries.length === 240 && refused === 240, saw: refused + ' of ' + r.forgeries.length + ' forgeries refused' }; },
  P4: (r) => ({ pass: r.ratings.same && r.ratings.total === 1000 * r.ratings.cards, saw: 'ratings ' + (r.ratings.same ? 'identical' : 'DIFFERENT') + ' twice; total ' + r.ratings.total + ' over ' + r.ratings.cards + ' cards' }),
  Q1: (r) => { const decided = r.sets.filter((p) => p.wins.a !== p.wins.b), right = decided.filter((p) => (p.wins.a > p.wins.b) === (p.test[0] > p.test[1])).length; return { pass: decided.length > 0 && right / decided.length >= 0.6, saw: right + ' of ' + decided.length + ' decided pairs (' + pct(right, decided.length) + '%): the majority winner had the higher TEST AUC' }; },
  Q2: (r) => { const decided = r.duels.filter((x) => x.ok && x.receipt.winner !== 'draw'), upsets = decided.filter((x) => x.lowerGateWon).length; return { pass: decided.length > 0 && upsets / decided.length >= 0.1, saw: upsets + ' of ' + decided.length + ' decided duels (' + pct(upsets, decided.length) + '%) were won by the card with the lower GATE AUC' }; },
  Q3: (r) => { const ms = [...r.ms].sort((a, b) => a - b), med = ms[ms.length >> 1]; return { pass: med <= 250, saw: 'median duel ' + med + ' ms' }; },
};
if (isMain(import.meta.url, 'judge-9.mjs')) judgeMain(9, RULES);
