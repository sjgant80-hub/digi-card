// src/cogrow.mjs — growth that composes. A node grown on its own (src/node.mjs) searches for the rules that predict best
// BY THEMSELVES, so in a mesh it can mostly repeat what a stronger neighbour already knows. Co-growth scores each
// candidate recipe by what it ADDS: on an inner split of the node's own FIT rows, the candidate is fitted, coupled with
// the other nodes' scores for the same cases, and judged by the coupled AUC. Only scores cross: the growing node sees
// its own silo's records and, for each of its FIT cases, the other nodes' scores — never their records.
// The search is seed-library's (vendored): the same population, elites, generations, crossover and mutation, seeded.
import { splitRows, rng, fit, scoreRow, stemGenome, randomGenome, crossGenome, mutateGenome, auc, round6 } from '../vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { couple, coupled } from './compose.mjs';

const draw = (r, k) => Math.floor(r() * k), coin = (r) => draw(r, 2) === 0;

/**
 * How much a genome adds to the mesh, on the node's own rows. view: the node's silo (seed-library shape); inner:
 * { rest, held } rows; others: (row) → [the other nodes' scores for that case]. The candidate is fitted on inner.rest,
 * the coupling is learned on inner.rest, and the coupled answer is scored on inner.held. → AUC
 */
export function joinFitness(view, inner, genome, others, coupler = couple) {
  const card = fit(view, inner.rest, genome);
  const cols = (rows) => { const o = rows.map(others), k = o[0].length; return [...Array.from({ length: k }, (_, j) => o.map((x) => x[j])), rows.map((i) => scoreRow(card, view, i))]; };
  const restCols = cols(inner.rest), c = coupler(restCols, inner.rest.map((i) => view.y[i]));
  const heldCols = cols(inner.held);
  return auc(inner.held.map((_, r) => coupled(c, heldCols.map((col) => col[r]))), inner.held.map((i) => view.y[i]));
}

/** the search: seed-library's grow loop, with joinFitness as the fitness (coupled as the mesh will be: opts.coupler). → { champion, fitness, history, evals } */
export function cogrow(view, rows, seed, cfg, others, { coupler = couple } = {}) {
  const inner = splitRows(view, rows, 1 / 3, seed), r = rng(seed * 7919 + 1);
  let born = 0;
  const live = (g) => ({ g, n: born++, fitness: joinFitness(view, inner, g, others, coupler) });
  const ranked = (p) => [...p].sort((x, y) => y.fitness - x.fitness || x.n - y.n);   // fittest first; ties to the elder
  let pop = [stemGenome(), ...Array.from({ length: cfg.population - 1 }, () => randomGenome(r))].map(live);
  const best = () => ranked(pop)[0];
  const history = [best().fitness];
  for (let gen = 1; gen < cfg.generations; gen++) {
    const battle = () => ranked([pop[draw(r, pop.length)], pop[draw(r, pop.length)]])[0];
    const next = ranked(pop).slice(0, cfg.elites);
    while (next.length < cfg.population) { const child = crossGenome(battle().g, battle().g, r); next.push(live(coin(r) ? mutateGenome(child, r) : child)); }
    pop = next;
    history.push(best().fitness);
  }
  return { champion: best().g, fitness: round6(best().fitness), history: history.map(round6), evals: born };
}
