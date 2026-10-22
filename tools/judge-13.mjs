#!/usr/bin/env node
// tools/judge-13.mjs — organ 13's verdict, by its sealed rules alone (data/organ-13/prereg.json) over its record.
//   node tools/judge-13.mjs [--write | --check]
import { judgeMain, isMain } from './organ.mjs';

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
export const RULES = {
  P1: (r) => {
    const s = r.synthetic;
    return { pass: r.drawsToTie === 3 && s.sets === 1000 && s.twice === 1000 && s.decidedOk === 1000 && s.openOk === 1000 && s.championOk === 1000 && s.ties > 0,
      saw: s.twice + ' of ' + s.sets + ' receipt sets played out the same however entered; ' + s.decidedOk + ' decided every match by its first decisive receipt before the third draw, or by the tie rule at the third draw to the higher seed; ' + s.openOk + ' never decided a match with a side open; ' + s.championOk + ' named a champion exactly when the final was decided; the tie rule settled ' + s.ties + ' of ' + s.decided + ' decided matches' };
  },
  P2: (r) => {
    const good = r.brackets.filter((b) => b.ok && b.champion !== null && b.practice === false && b.ruled === true && b.matches.every((x) => x.fought <= r.drawsToTie)).length;
    return { pass: r.brackets.length === 5 && good === 5, saw: good + ' of ' + r.brackets.length + ' real brackets played out to a champion that is no practice champion, every match by the rule and within ' + r.drawsToTie + ' duels' };
  },
  Q1: (r) => { const ms = r.brackets.flatMap((b) => b.matches), duel = ms.filter((x) => !x.tie).length; return { pass: ms.length > 0 && duel / ms.length >= 0.8, saw: duel + ' of ' + ms.length + ' real matches were decided by a duel, not the tie rule (' + pct(duel, ms.length) + '%)' }; },
  Q2: (r) => { const ms = r.brackets.flatMap((b) => b.matches).filter((x) => x.gateA !== x.gateB), held = ms.filter((x) => x.winner === (x.gateA > x.gateB ? x.a : x.b)).length; return { pass: ms.length > 0 && held / ms.length >= 0.6, saw: held + ' of ' + ms.length + ' bracket matches were won by the card with the higher declared GATE AUC (' + pct(held, ms.length) + '%)' }; },
};
if (isMain(import.meta.url, 'judge-13.mjs')) judgeMain(13, RULES);
