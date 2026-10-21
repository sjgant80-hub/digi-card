// src/deep.mjs — a deeper grown body. The seed library's ribosome grows a scorecard of at most six single-column threshold
// rules; the diagnosis (data/diagnose.json, FIT and GATE only) found that too shallow to carry a department's signal on
// the telecom customers: one deep model per department, sending one score, came within 0.005 of every column pooled, the
// six-rule nodes 0.031 short. A deep body is the same ribosome grown in STAGES. Each stage evolves one more scorecard with
// the seed library's own genome, crossover and mutation; its fitness is the AUC of the body so far PLUS this stage, so
// each stage grows on what the stages before it missed. The department's training rows are cut three ways: thresholds
// are set on REST, the search selects on SELECT, and a stage is kept only if it beats the body so far on CHECK — rows the
// search never saw (𝟙), so a stage that only fits the search's own rows is refused, and growth stops when it stops
// paying. HELD sets the share of the training rows held out for SELECT and CHECK together (a larger CHECK judges each
// stage on more rows). No step damping: fitness is AUC, which ignores scale, so damping every stage alike changes
// nothing (a test showed it), and each rule's weight grid already sets a stage's size. CUTS sets where a rule may cut a
// column: 'quantile' (the seed library's grid of sixteenths) or 'values' (on a column with at most 16 distinct values,
// between its actual values, so a coded category such as a month can be picked out exactly; other columns keep the
// grid). The body study after organ 2f (data/study-body.json) found budget, stages and held share changed nothing, and
// the cut grid the likely limit; the second (data/study-body-2.json) found the cut grid did not move the mesh either. A
// rule of single-column steps sees each column alone, and an interaction lives in two columns at once: no sum of
// one-column steps can draw it. PAIRS lets a rule hold a second condition, on another column of the department or on
// the same one (an interval): it fires only when both hold, a leaf of a two-level tree, still one readable line ("if
// euribor ≤ 1.3 and month is May"). Pure, deterministic, total.
import { splitRows, rng, draw, coin, auc, round6, stemGenome, randomGenome, crossGenome, mutateGenome, MAXRULES, MAXFEATS, QGRID, WGRID } from '../vendor/living-seed/vendor/seed-library/seedlib.mjs';

export const DEEP = { population: 40, elites: 8, generations: 30, stages: 8, held: 1 / 3, cuts: 'quantile', pairs: false };

const fires = (c, x) => (c.op === '>' ? x > c.v : x <= c.v);
/** a scorecard's score for row i: the weight of every rule that fires (the seed library's scoreRow exactly, for single
 *  rules); a paired rule fires only when both its conditions hold */
export const scoreCard = (card, dataset, i) => card.rules.reduce((a, r) => a + (fires(r, dataset.cols[r.feat][i]) && (!r.and || fires(r.and, dataset.cols[r.and.feat][i])) ? r.w : 0), 0);

const SLOTS = Array.from({ length: MAXRULES }, (_, k) => k);
/** the second condition of every rule slot: a (on), g (its column), h (its cut), e (its side) */
const pairOf = (g, r) => { for (const k of SLOTS) Object.assign(g, { ['a' + k]: draw(r, 2), ['g' + k]: draw(r, MAXFEATS), ['h' + k]: draw(r, QGRID.length), ['e' + k]: draw(r, 2) }); return g; };
const stemPair = (g) => { for (const k of SLOTS) Object.assign(g, { ['a' + k]: 0, ['g' + k]: k, ['h' + k]: Math.floor(QGRID.length / 2), ['e' + k]: 1 }); return g; };
const crossPair = (child, a, b, r) => { for (const k of SLOTS) { const src = coin(r) ? a : b; for (const f of ['a', 'g', 'h', 'e']) child[f + k] = src[f + k]; } return child; };
function mutatePair(g, r) {
  const out = { ...g }, slot = draw(r, MAXRULES * 4), k = slot >> 2, what = slot & 3;
  if (what === 0) out['a' + k] = g['a' + k] ^ 1;
  else if (what === 1) out['g' + k] = draw(r, MAXFEATS);
  else if (what === 2) out['h' + k] = Math.min(QGRID.length - 1, Math.max(0, g['h' + k] + (coin(r) ? -1 : 1)));
  else out['e' + k] = g['e' + k] ^ 1;
  return out;
}
/** the genome operations: the seed library's, and with pairs on, the second condition carried, crossed and mutated too */
export const genomeOps = (pairs) => (pairs
  ? { stem: () => stemPair(stemGenome()), random: (r) => pairOf(randomGenome(r), r), cross: (a, b, r) => crossPair(crossGenome(a, b, r), a, b, r), mutate: (g, r) => (coin(r) ? mutateGenome(g, r) : mutatePair(g, r)) }
  : { stem: stemGenome, random: randomGenome, cross: crossGenome, mutate: mutateGenome });

/** the seed library's fit(dataset, rows, genome), exactly, with each column's values on `rows` sorted once, not once per rule;
 *  with cuts 'values', a column of at most 16 distinct values is cut between its actual values instead */
export function fitter(dataset, rows, cuts = 'quantile') {
  const feats = dataset.features, nf = feats.length, sorted = new Map(), base = rows.length ? rows.reduce((a, i) => a + dataset.y[i], 0) / rows.length : 0;
  const col = (feat) => { if (!sorted.has(feat)) { const xs = rows.map((i) => dataset.cols[feat][i]).sort((a, b) => a - b), vs = [...new Set(xs)]; sorted.set(feat, { xs, vs: cuts === 'values' && vs.length <= QGRID.length + 1 ? vs : null }); } return sorted.get(feat); };
  const at = (feat, k) => { const { xs, vs } = col(feat); return vs ? vs[k % vs.length] : xs[Math.floor(QGRID[k % QGRID.length] * (xs.length - 1))]; };   // no rows: undefined, which round6 reads as 0, as the library does
  const cond = (feat, d, k) => ({ feat, op: d & 1 ? '>' : '<=', v: round6(at(feat, k)) });
  return (genome) => ({ genome, base: round6(base), rules: SLOTS.filter((r) => (genome.on >> r) & 1).map((r) => {
    const rule = { ...cond(feats[genome['f' + r] % nf], genome['d' + r], genome['q' + r]), w: WGRID[genome['w' + r] % WGRID.length] };
    return genome['a' + r] & 1 ? { ...rule, and: cond(feats[genome['g' + r] % nf], genome['e' + r], genome['h' + r]) } : rule;
  }) });
}

/**
 * grow a deep body on `trainRows` of `dataset` (features, cols, y) from `seed`.
 * → { stages: [scorecard], history: [CHECK AUC after each kept stage], rules, refused: the stage that did not pay, or null }
 */
export function growDeep(dataset, trainRows, seed, cfg = DEEP) {
  const { population, elites, generations, stages, held, cuts, pairs } = { ...DEEP, ...cfg }, G = genomeOps(pairs);
  if (!dataset || !Array.isArray(dataset.features) || !dataset.features.length || !Array.isArray(trainRows)) return { stages: [], history: [], rules: 0, refused: null };
  // too few rows to hold any out: every stage scores 0.5 against a body of 0.5, so the first is refused and nothing grows
  const inner = splitRows(dataset, trainRows, held, seed), cut = splitRows(dataset, inner.held, 1 / 2, seed + 1);
  const rest = inner.rest, select = cut.rest, check = cut.held, sy = select.map((i) => dataset.y[i]), cy = check.map((i) => dataset.y[i]);
  const express = fitter(dataset, rest, cuts), whole = fitter(dataset, trainRows, cuts), r = rng(seed * 7919 + 1), onSelect = new Float64Array(select.length), onCheck = new Float64Array(check.length), cards = [], history = [];
  let so = auc(Array.from(onCheck), cy), refused = null;
  for (let s = 0; s < stages; s++) {
    const live = (g) => { const card = express(g); return { g, fitness: auc(select.map((i, k) => onSelect[k] + scoreCard(card, dataset, i)), sy) }; };
    const rank = (p) => [...p].sort((a, b) => b.fitness - a.fitness);   // stable: on a tie the one already ahead stays ahead
    let pop = rank([G.stem(), ...Array.from({ length: population - 1 }, () => G.random(r))].map(live));
    for (let gen = 1; gen < generations; gen++) {
      const battle = () => { const a = pop[draw(r, pop.length)], b = pop[draw(r, pop.length)]; return b.fitness > a.fitness ? b : a; };
      const next = pop.slice(0, elites);
      while (next.length < population) { const child = G.cross(battle().g, battle().g, r); next.push(live(coin(r) ? G.mutate(child, r) : child)); }
      pop = rank(next);
    }
    const champ = pop[0], card = express(champ.g);
    const passed = auc(check.map((i, k) => onCheck[k] + scoreCard(card, dataset, i)), cy);
    if (!(passed > so)) { refused = { stage: s + 1, check: round6(passed), bodySoFar: round6(so) }; break; }
    select.forEach((i, k) => { onSelect[k] += scoreCard(card, dataset, i); });
    check.forEach((i, k) => { onCheck[k] += scoreCard(card, dataset, i); });
    so = passed;
    cards.push(whole(champ.g));   // expressed on all of the department's training rows, as the seed library does
    history.push(round6(so));
  }
  return { stages: cards, history, rules: cards.reduce((a, c) => a + c.rules.length, 0), refused };
}

/** a deep body's score for row i: the sum of its stages */
export const scoreDeep = (deep, dataset, i) => deep.stages.reduce((a, c) => a + scoreCard(c, dataset, i), 0);
