// src/breed.mjs — BREEDING: two DIGI cards make a child, and it is born only if it beats BOTH parents.
//
// Two ways a child can be better, and both are real genetics, judged on GATE (cases neither parent grew on):
//   · the same department — the parents' rule shapes are crossed rule by rule and, half the time, changed once
//     (seed-library's crossover and mutation, vendored unchanged; dex-frontier's population.mjs is the pattern);
//   · two departments of one business — the child carries both minds and answers through a coupling learned on GATE
//     (src/mind.mjs), judged out of fold there: a child that knows the customer AND the payments.
// Two cards from different grounds share no cases, so there is nothing to judge their child on: that is refused, plainly,
// rather than faked — across businesses, DIGIs compose in the mesh instead (src/mesh.mjs), where no records cross.
//
// The child is a new genome naming both parents' ids, sealed by the breeder — who must own both parents — with the higher
// of their bars. A child is never a promise: the breeder's device tries up to MAX_TRIES crossings and seals the first that
// beats both, or nothing. birthCheck() lets anyone holding the same ground re-run the claim. Pure apart from the seals.
import { crossGenome, mutateGenome, rng, coin, decodeSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { seal, MAX_ORGANS } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { mindOf, fixedOf } from './mind.mjs';
import { viewOf } from './data.mjs';

export const MAX_TRIES = 12;
const no = (why, extra = {}) => ({ born: false, why, ...extra });

/** the mind a genome's organs would have on a ground, as a card that carries them would (no levels yet) */
const mindOfOrgans = (organs, bar, ground) => mindOf({ genome: { organs, gate: { auc: bar } }, receipts: [] }, ground);

/** a parent's live departments on the ground, each in its fixed form */
function liveOf(v, ground) {
  const m = mindOf(v, ground);
  return { m, organs: m.organs.filter((o) => o.state === 'live').map((o) => ({ domain: o.domain, fixed: o.fixed, genome: decodeSeed(o.fixed).seed.genome })) };
}

/**
 * Breed two checked cards (va, vb: verify() results) on a ground the breeder holds. keys — the breeder's, who must own
 * both. opts: seed (whole number ≥ 1), name (the child genome's; default: the first parent's), tries (≤ MAX_TRIES).
 * → { born: true, genome (sealed text), id, gate, parents: [gateA, gateB], tries, organs } | { born: false, why, … }
 */
export async function breed(va, vb, ground, keys, { seed = 1, name, tries = MAX_TRIES } = {}) {
  if (!va || !vb || va.ok !== true || vb.ok !== true) return no('only two cards that check can breed');
  if (va.id === vb.id) return no('a card cannot breed with itself');
  if (!keys || va.owner !== keys.pub || vb.owner !== keys.pub) return no('only the owner of both parents can breed them');
  if (!Number.isInteger(seed) || seed < 1) return no('a breeding starts from a whole-number seed of 1 or more');
  if (!Number.isInteger(tries) || tries < 1 || tries > MAX_TRIES) return no('a breeding tries 1 to ' + MAX_TRIES + ' crossings');
  const domains = [...va.genome.organs, ...vb.genome.organs].map((o) => decodeSeed(o, { guard: false }).seed.domain);
  if (domains.some((d) => !viewOf(ground, d))) return no('these two cards do not both live on this ground: there are no shared cases to judge a child on');
  const a = liveOf(va, ground), b = liveOf(vb, ground);
  if (!a.organs.length || !b.organs.length) return no('both parents must have a live mind here (' + [a, b].map((p) => (p.m.gate === null ? 'none' : p.m.gate)).join(' and ') + ')');
  const union = [...new Set([...a.organs, ...b.organs].map((o) => o.domain))];
  if (union.length > MAX_ORGANS) return no('a child carries at most ' + MAX_ORGANS + ' departments');
  const beat = Math.max(a.m.gate, b.m.gate), bar = Math.max(va.genome.gate.auc, vb.genome.gate.auc);
  const shared = union.some((d) => a.organs.some((o) => o.domain === d) && b.organs.some((o) => o.domain === d));
  const attempts = shared ? tries : 1;
  let best = null, tried = 0;
  for (let t = 0; t < attempts; t++) {
    tried++;
    const r = rng(seed * 7919 + t);
    const organs = union.map((d) => {
      const x = a.organs.find((o) => o.domain === d), y = b.organs.find((o) => o.domain === d);
      if (!x || !y) return (x || y).fixed;
      let g = crossGenome(x.genome, y.genome, r);
      if (coin(r)) g = mutateGenome(g, r);
      return fixedOf(d, seed + t, g);
    });
    const m = mindOfOrgans(organs, bar, ground);
    if (m.gate !== null && m.live === organs.length && (!best || m.gate > best.m.gate)) best = { organs, m, t };
    if (best && best.m.gate > beat) break;
  }
  if (!best || !(best.m.gate > beat)) return no('no child of theirs beat both parents on GATE (' + (best ? best.m.gate : 'none live') + ' against ' + beat + ', ' + tried + ' tried)', { tries: tried });
  const sealed = await seal({ name: name === undefined ? va.genome.name : name, parents: [va.id, vb.id], gate: { auc: bar }, organs: best.organs }, keys);
  if (!sealed.ok) return no('the child could not be sealed: ' + sealed.why);
  return { born: true, genome: sealed.text, id: sealed.id, gate: best.m.gate, parents: [a.m.gate, b.m.gate], tries: tried, organs: best.organs };
}

/**
 * Re-run a birth: the child (vc) names both parents (va, vb) as its parents, and on this ground the mind it was born
 * with beats both parents' minds — as they stood when it was born, so pass their dossiers of that moment (the registry's
 * log holds every moment). → { ok, child, parents } | { ok: false, why }
 */
export function birthCheck(vc, va, vb, ground) {
  if ([vc, va, vb].some((v) => !v || v.ok !== true)) return { ok: false, why: 'only cards that check can be compared' };
  const p = vc.genome.parents;
  if (p.length !== 2 || !p.includes(va.id) || !p.includes(vb.id)) return { ok: false, why: 'the child does not name these two as its parents' };
  const c = mindOfOrgans(vc.genome.organs, vc.genome.gate.auc, ground).gate, a = mindOf(va, ground).gate, b = mindOf(vb, ground).gate;
  if (c === null || a === null || b === null) return { ok: false, why: 'the three minds are not all live on this ground' };
  return c > Math.max(a, b) ? { ok: true, child: c, parents: [a, b] } : { ok: false, why: 'the child scores ' + c + ' on GATE here, not more than both parents (' + a + ', ' + b + ')' };
}
