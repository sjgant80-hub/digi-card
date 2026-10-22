// kar-foldcycle · foldcycle.mjs — the deterministic verdict kernel for the fold-cycle prefix-recycling
// experiment. Given prefill-latency samples (cold = recompute the prefix from scratch, warm = recycle the
// cached prefix), it computes the recycled saving and an honest WIN / LEARN / UNMEASURED verdict.
//
// Pure and total: samples in, verdict out, NEVER throws. The MEASUREMENT (hitting a real local model) lives
// in run-eval.mjs — this is only the judgement, so it can be gated and re-run by anyone against their own
// numbers. It scores LATENCY, an honest proxy for prefill energy (fewer recomputed FLOPs = less time = fewer
// joules) — NOT a wattmeter reading, and NOT a claim that prefix caching is novel (it is the proven seed);
// it quantifies the MAGNITUDE of the recycled saving on whatever metal produced the samples.

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
// keep only real, non-negative numbers — a latency is never negative, and garbage must not skew a median
function clean(arr) { return Array.isArray(arr) ? arr.map(num).filter((x) => x !== null && x >= 0) : []; }

export function median(arr) {
  const s = clean(arr).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function mean(arr) {
  const s = clean(arr);
  if (!s.length) return null;
  return Math.round(s.reduce((a, b) => a + b, 0) / s.length);
}

/** Verdict from cold (recompute) vs warm (recycled) prefill-latency samples.
 *  WIN threshold default 20% — below it the recycling didn't net meaningfully.
 *  optional `control` (unrelated / no-shared-prefix samples) sanity-checks the finding: a real prefix-reuse
 *  saving should NOT appear in the control (nothing to recycle), so control≈cold. If control is fast too,
 *  the measurement is suspect (the spec's own "if it saves with no overlap, the measurement is wrong").
 *  An empty/insufficient sample is NOT a clean pass (anti-narrowing): it reports UNMEASURED. */
export function analyze(input) {
  // total against ANY input: null/number/string default to {} (a bare `= {}` only catches undefined)
  const { cold, warm, control, thresholdPct = 20 } = (input && typeof input === 'object') ? input : {};
  const c = clean(cold), w = clean(warm);
  if (c.length < 1 || w.length < 1) {
    return { verdict: 'UNMEASURED', why: 'need at least one cold and one warm sample — an empty run is not a pass',
      coldMedian: null, warmMedian: null, savingMs: null, savingPct: null, nCold: c.length, nWarm: w.length };
  }
  const coldMedian = median(c), warmMedian = median(w);
  const savingMs = coldMedian - warmMedian;
  const savingPct = coldMedian > 0 ? Math.round((100 * savingMs) / coldMedian) : 0;
  const verdict = savingPct >= thresholdPct ? 'WIN' : 'LEARN';
  const out = {
    verdict,
    why: verdict === 'WIN'
      ? `recycling the cached prefix cut prefill latency ${savingPct}% (${coldMedian}ms cold -> ${warmMedian}ms warm) — the saving is the recomputed prefill avoided`
      : `no meaningful prefill saving (${savingPct}%) — recycling did not net on these samples`,
    coldMedian, warmMedian, savingMs, savingPct, nCold: c.length, nWarm: w.length, thresholdPct,
  };
  // control sanity: a genuine reuse saving must be ABSENT in the control (unrelated queries, nothing to reuse)
  const ctl = clean(control);
  if (ctl.length) {
    const controlMedian = median(ctl);
    // control should look like cold (slow), not warm (fast): its saving-vs-cold should be small
    const controlSavingPct = coldMedian > 0 ? Math.round((100 * (coldMedian - controlMedian)) / coldMedian) : 0;
    out.controlMedian = controlMedian;
    out.controlSavingPct = controlSavingPct;
    out.controlHolds = controlSavingPct < thresholdPct;   // true = control got no saving, as a real finding requires
    if (verdict === 'WIN' && !out.controlHolds) {
      out.verdict = 'SUSPECT';
      out.why = `control ALSO sped up (${controlSavingPct}%) — a real prefix-reuse saving should not appear with nothing to recycle; the measurement is suspect`;
    }
  }
  return out;
}

export default analyze;
