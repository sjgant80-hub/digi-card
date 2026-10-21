// src/wisp.mjs — the mesh as it runs. Two things the spec asks of a living mesh, measured on a stream of cases in order:
//   · GROW BY WORKING (organ 4): records arrive over time; at each step a node re-grows on everything it has seen so far.
//   · THE WISP (organ 5): as each window of cases is answered and its outcomes come in, the coupling re-learns from every
//     outcome seen so far — routes that keep paying strengthen, routes that stop paying weaken — and a node whose
//     out-of-fold contribution falls to nothing is pruned. Against it: the same mesh with its coupling frozen at GATE.
// Pure, deterministic, total on its inputs; the coupling is src/compose.mjs's.
import { couple, coupled } from './compose.mjs';
import { rng, auc } from '../vendor/living-seed/vendor/seed-library/seedlib.mjs';

/** arrivals: rows in arrival order, cut into `steps` cumulative portions (the first step holds 1/steps of them) */
export function arrivals(rows, steps) {
  if (!(steps >= 1) || !rows.length) return [];
  return Array.from({ length: steps }, (_, k) => rows.slice(0, Math.round(((k + 1) * rows.length) / steps)));
}

/** a seeded order for rows that carry no time (Fisher–Yates) */
export function order(rows, seed) {
  const r = rng(seed), xs = rows.slice();
  for (let i = xs.length - 1; i; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
  return xs;
}

/** a view of a silo grown on the rows seen so far (still graded on GATE) */
export const seenSoFar = (view, rows) => ({ ...view, trainRows: rows });

/** windows of a stream: consecutive slices of `size` (the last may be shorter) */
export const windows = (n, size) => Array.from({ length: Math.ceil(n / size) }, (_, k) => [k * size, Math.min(n, (k + 1) * size)]);

/**
 * How much a node adds, out of fold: the k-fold AUC of the coupling with the node against without it, on the rows
 * given (columns: one per node; y: outcomes). → with − without (positive: it adds)
 */
export function contribution(columns, k, y, folds = 2, coupler = couple) {
  const n = y.length, fold = (i) => i % folds;
  const oof = (cols) => {
    const out = new Array(n);
    Array.from({ length: folds }, (_, f) => f).forEach((f) => {
      const train = [], held = [];
      y.forEach((_, i) => (fold(i) === f ? held : train).push(i));
      const c = coupler(cols.map((col) => train.map((i) => col[i])), train.map((i) => y[i]));
      for (const i of held) out[i] = coupled(c, cols.map((col) => col[i]));
    });
    return auc(out, y);
  };
  return oof(columns) - oof(columns.filter((_, j) => j !== k));
}

/**
 * Run the mesh down a stream. gate: { cols, y } — the GATE scores and outcomes; stream: { cols, y } — the stream's,
 * in order; size: window length; learn: re-learn the coupling before each window from GATE plus every outcome so far;
 * prune: before each window drop any live node whose out-of-fold contribution on the recent outcomes is ≤ 0.
 * → { scores (one per stream case), live: [node indices live in each window] }
 */
export function run(gate, stream, { size = 300, learn = false, prune = false, recent = 900 } = {}) {
  const n = stream.y.length, scores = new Array(n), liveByWindow = [];
  let live = gate.cols.map((_, k) => k);
  for (const [from, to] of windows(n, size)) {
    const seenCols = gate.cols.map((g, k) => (learn ? g.concat(stream.cols[k].slice(0, from)) : g)), seenY = learn ? gate.y.concat(stream.y.slice(0, from)) : gate.y;
    if (prune && live.length > 1) {   // with no outcome yet (or one kind only) every contribution is 0, and nothing is pruned
      const lo = Math.max(0, from - recent), rc = live.map((k) => stream.cols[k].slice(lo, from)), ry = stream.y.slice(lo, from);
      const keep = ry.length ? live.filter((k, j) => contribution(rc, j, ry) > 0) : [];
      if (keep.length) live = keep;
    }
    liveByWindow.push(live.slice());
    const c = couple(live.map((k) => seenCols[k]), seenY);
    for (let i = from; i < to; i++) scores[i] = coupled(c, live.map((k) => stream.cols[k][i]));
  }
  return { scores, live: liveByWindow };
}

/** a node that goes bad: from case `from` on, its scores are replaced by noise on its own scale (seeded) */
export function breakAt(col, from, seed) {
  const r = rng(seed), lo = Math.min(...col), hi = Math.max(...col);
  return col.map((v, i) => (i < from ? v : lo + r() * (hi - lo)));
}
