// src/node.mjs — Γ for one specialist: a node of the mesh. A contributor seals a genome that carries ONE grow-seed for
// ONE silo (a few dozen bytes: which silo, a random seed, how hard to search); the node grows its body from that silo's
// own records on the device (seed-library's gated evolution, vendored unchanged), must clear the genome's bar on the
// GATE rows or be cut, and then scores any case of its silo. Nothing here trains weights: the body is found, not fitted
// by gradient, and every threshold is read off the silo's own records. Records never leave the node: what it shares is
// its advert (what it covers and how well it did) and its scores.
import { seal } from '../vendor/living-seed/src/genome.mjs';
import { germinate, answer, caseOf } from '../vendor/living-seed/src/germinate.mjs';
import { encodeSeed, makeSeed } from '../vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { fromSeed } from '../vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, utf8 } from '../vendor/living-seed/vendor/seed-library/sha256.mjs';

export const GROW = { population: 40, elites: 8, generations: 30 };   // the search every node's seed asks for
export const BAR = 0.6;                                                // the gate: held-out AUC a node must clear on GATE

/** a contributor's demo keys, derived from a public phrase so anyone can reproduce every seal (a real one keeps its own) */
export const contributor = (name) => fromSeed(sha256Bytes(utf8('dex-frontier/contributor/' + name)));

/** the recipe a node travels as: one grow-seed for one silo */
export const recipeOf = (domain, seed, grow = GROW) => encodeSeed(makeSeed({ domain, seed, grow }));

/** seal a node's genome: one organ, the bar, no parents (a first node) or two (a node bred of both) */
export async function sealNode(view, keys, { seed = 1, grow = GROW, bar = BAR, parents = [] } = {}) {
  return seal({ name: 'node-' + view.name, parents, gate: { auc: bar }, organs: [recipeOf(view.name, seed, grow)] }, keys);
}

/** grow the node on its silo. → { ok, organism, organ } | a refusal */
export async function growNode(genomeText, view, opts = {}) {
  const g = await germinate(genomeText, { name: view.name + '-silo', data: { [view.name]: view } }, opts);
  if (!g.ok) return g;
  return { ok: true, organism: g.organism, organ: g.organism.organs.find((o) => o.domain === view.name) };
}

/** the node's scores on rows of its silo: a number where it answers, null where it abstains */
export function scores(organism, view, rows) {
  return rows.map((i) => { const a = answer(organism, view.name, caseOf(view, i)); return a.verdict === 'VERIFIED' ? a.score : null; });
}

/** what a node tells the mesh about itself: what it covers, how it did on GATE, and who stands behind it */
export function advert(organism, view) {
  const o = organism.organs.find((x) => x.domain === view.name);
  return { node: organism.id, silo: view.name, features: view.features, state: o ? o.state : 'absent', gateAuc: o ? o.heldAuc : null, bar: organism.gate.auc, rules: o && o.body ? o.body.rules.length : 0, maker: organism.by };
}

/** route by fit: the live nodes whose silo a case carries every measurement of (its capability, checked, not claimed) */
export function route(adverts, x) {
  return adverts.filter((a) => a.state === 'live' && a.features.every((f) => typeof x[f] === 'number' && Number.isFinite(x[f])));
}
