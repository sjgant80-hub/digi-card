// src/spread.mjs — organ 7, SOVEREIGN SPREAD. Each node belongs to the contributor whose key sealed it. It travels as a
// card (living-seed's: the genome in the pixels of a PNG, read verify-before-parse), so a seed spreads hand to hand and
// any device can grow it on its own silo. The mesh keeps a ledger of what each contributor's node is worth to it — its
// out-of-fold contribution on GATE — so "owned by its contributors" is a measured share, not a slogan. A contributor can
// revoke: their node leaves, the coupling re-learns without it, and no other node changes. And what crosses for one
// answer is counted exactly: one score per live node, never a record.
import { cardOf, readCard } from '../vendor/living-seed/src/card.mjs';
import { couple } from './compose.mjs';
import { contribution } from './wisp.mjs';

/** a node to a card and back: → { ok, png, bytes, back } — back is the genome the card carries, opened under its seal */
export async function carry(genomeText, opts = {}) {
  const c = await cardOf(genomeText);
  if (!c.ok) return c;
  const r = await readCard(c.png, opts);
  return r.ok ? { ok: true, png: c.png, bytes: c.png.length, back: r.genome, id: r.id } : r;
}

/**
 * The ledger: for each live node, who stands behind it, its out-of-fold contribution to the coupled GATE AUC, and its
 * share of the positive contributions. adverts: the live nodes' adverts, in the coupling's order.
 */
export function ledger(adverts, gateCols, gateY) {
  const rows = adverts.map((a, k) => ({ node: a.node, silo: a.silo, maker: a.maker, contribution: contribution(gateCols, k, gateY) }));
  const total = rows.reduce((s, x) => s + Math.max(0, x.contribution), 0);
  return rows.map((x) => ({ ...x, share: total > 0 ? Math.max(0, x.contribution) / total : 0 }));
}

/** revoke node k: the coupling re-learned on GATE without it (every other node untouched) */
export function revoke(gateCols, gateY, k) {
  if (gateCols.length < 2) return { ok: false, why: 'the last node of a mesh cannot leave it answering' };
  return { ok: true, coupling: couple(gateCols.filter((_, j) => j !== k), gateY), left: gateCols.length - 1 };
}

/** what crosses the mesh for one answer: the live nodes' scores, as the message that carries them */
export function message(scores) {
  const text = JSON.stringify(scores.map((s) => (s === null ? null : Math.round(s * 1e6) / 1e6)));
  return { text, bytes: new TextEncoder().encode(text).length, numbers: scores.length };
}
