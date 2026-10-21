// src/stats.mjs — how sure a lead is. The paired bootstrap that living-seed's organs 2 and 2c used: resample the cases
// with replacement, score both contestants on the same resample, and read the 2.5th percentile of the AUC difference —
// the 95% lower bound of "a leads b". Paired, so both are judged on the very same cases each time. Pure and seeded.
import { rng, auc, round6 } from '../vendor/living-seed/vendor/seed-library/seedlib.mjs';

/** 95% lower bound of auc(a) − auc(b) on outcomes y: n paired resamples, seeded */
export function pairedLow(a, b, y, n = 2000, seed = 99) {
  if (a.length !== y.length || b.length !== y.length || !y.length) throw new Error('both contestants need a score for every case');
  const r = rng(seed), d = [];
  for (let k = 0; k < n; k++) {
    const idx = y.map(() => Math.floor(r() * y.length));
    d.push(auc(idx.map((i) => a[i]), idx.map((i) => y[i])) - auc(idx.map((i) => b[i]), idx.map((i) => y[i])));
  }
  d.sort((x, z) => x - z);
  return round6(d[Math.floor(0.025 * n)]);
}

/** a lead, with its bound: { a, b, lead, low95 } (AUCs to six places) */
export function lead(a, b, y, n, seed) {
  const A = auc(a, y), B = auc(b, y);
  return { a: round6(A), b: round6(B), lead: round6(A - B), low95: pairedLow(a, b, y, n, seed) };
}

/** a median, of numbers (the middle one, the lower of two when even) */
export const median = (xs) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[(s.length - 1) >> 1] : null; };
