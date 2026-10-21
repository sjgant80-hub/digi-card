// src/select.mjs — the mesh chooses its own coupling. Two ways to weigh the nodes' scores, one interface: LINEAR (organ 2's
// logistic coupling, src/compose.mjs) and TREES (gradient-boosted trees over the scores, living-seed's mutation-gated
// baseline kernel — they can learn interactions). Each is judged out of fold on the cases it may learn from (GATE),
// never on TEST; the better one is learned on all of them. Only scores go in. Pure, deterministic, total on its inputs.
import { couple, coupled } from './compose.mjs';
import { boosted, out } from '../vendor/living-seed/src/baseline.mjs';
import { auc } from '../vendor/living-seed/vendor/seed-library/seedlib.mjs';

/** the linear coupling: learn(columns, y) → model; model.predict(scoresOfOneCase) → a score */
export const linear = { name: 'linear', learn: (columns, y) => { const c = couple(columns, y); return { c, predict: (s) => coupled(c, s) }; } };

/** the tree coupling: depth-2 boosted trees over the scores (settings fixed by the caller) */
export function trees(opts) {
  return { name: 'trees', learn: (columns, y) => {
    const features = columns.map((_, k) => 'n' + k), cols = Object.fromEntries(columns.map((c, k) => ['n' + k, Float64Array.from(c)]));
    const m = boosted({ features, cols, y }, y.map((_, i) => i), opts);
    return { m, predict: (s) => m.trees.reduce((a, t) => a + out(t, (f) => s[Number(f.slice(1))]), m.base) };
  } };
}

/** out-of-fold AUC of a coupling on the rows given: every row predicted by a coupling that never learned from it */
export function oofAuc(coupler, columns, y, folds = 4) {
  const n = y.length, pred = new Array(n);
  Array.from({ length: folds }, (_, f) => f).forEach((f) => {
    const tr = [], ho = [];
    y.forEach((_, i) => (i % folds === f ? ho : tr).push(i));
    const m = coupler.learn(columns.map((c) => tr.map((i) => c[i])), tr.map((i) => y[i]));
    for (const i of ho) pred[i] = m.predict(columns.map((c) => c[i]));
  });
  return auc(pred, y);
}

/** choose: each coupling's out-of-fold AUC; the best (the first, on a tie) learned on all the rows */
export function choose(couplers, columns, y, folds = 4) {
  const scored = couplers.map((c) => ({ name: c.name, oof: oofAuc(c, columns, y, folds) }));
  const k = scored.reduce((b, s, i) => (s.oof > scored[b].oof ? i : b), 0);
  return { chosen: couplers[k].name, scored, model: couplers[k].learn(columns, y) };
}
