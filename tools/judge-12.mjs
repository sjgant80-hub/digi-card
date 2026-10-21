#!/usr/bin/env node
// tools/judge-12.mjs — organ 12's verdict, by its sealed rules alone (data/organ-12/prereg.json) over its record.
//   node tools/judge-12.mjs [--write | --check]
import { judgeMain, isMain } from './organ.mjs';

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
export const RULES = {
  P1: (r) => { const good = r.duels.filter((d) => d.ok && d.same && d.aucOk && d.callsOk).length; return { pass: r.duels.length === 100 && good === 100, saw: good + ' of ' + r.duels.length + ' duels replayed to the very same receipt, their cases giving back its AUCs, each side calling exactly as many yeses as the batch held' }; },
  P2: (r) => {
    const ok = r.duels.filter((d) => d.ok), cases = ok.reduce((s, d) => s + d.cases, 0), score = ok.reduce((s, d) => s + d.scoreOk, 0), single = ok.reduce((s, d) => s + d.single, 0), sum = ok.reduce((s, d) => s + d.sumOk, 0);
    return { pass: ok.length === 100 && cases > 0 && score === cases && sum === single, saw: score + ' of ' + cases + ' read-backs gave the very score the duel used; ' + sum + ' of ' + single + ' minds of one department had their fired rules sum to it' };
  },
  P3: (r) => {
    const s = r.synthetic, real = r.brackets.filter((b) => b.ok && b.champion !== null && b.practice === false).length;
    return { pass: s.sets === 1000 && s.twice === 1000 && s.decidedOk === 1000 && s.openOk === 1000 && s.championOk === 1000 && r.brackets.length === 5 && real === 5,
      saw: s.twice + ' of ' + s.sets + ' receipt sets played out the same however entered; ' + s.decidedOk + ' decided every match only by the first decisive receipt of exactly its two cards; ' + s.openOk + ' never decided a match with a side open; ' + s.championOk + ' named a champion exactly when the final was decided; ' + real + ' of ' + r.brackets.length + ' real brackets played to a champion' };
  },
  Q1: (r) => { const split = r.duels.filter((d) => d.ok && d.winner !== 'draw' && d.rightA !== d.rightB), agree = split.filter((d) => (d.rightA > d.rightB) === (d.winner === 'a')).length; return { pass: split.length > 0 && agree / split.length >= 0.8, saw: agree + ' of ' + split.length + ' decided duels whose sides called different numbers of cases right were won by the side with more right (' + pct(agree, split.length) + '%)' }; },
  Q2: (r) => { const ms = r.brackets.flatMap((b) => b.matches).filter((x) => x.gateA !== x.gateB), held = ms.filter((x) => x.winner === (x.gateA > x.gateB ? x.a : x.b)).length; return { pass: ms.length > 0 && held / ms.length >= 0.6, saw: held + ' of ' + ms.length + ' bracket matches were won by the card with the higher declared GATE AUC (' + pct(held, ms.length) + '%)' }; },
};
if (isMain(import.meta.url, 'judge-12.mjs')) judgeMain(12, RULES);
