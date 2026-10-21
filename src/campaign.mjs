// src/campaign.mjs — THE CAMPAIGN: the raids, as chapters, and a DIGI kitted for you by measurement.
//
// Each business is a chapter. First come the departments of it that no genesis search took past the bar (its raid bosses,
// src/raid.mjs bossesOf), the nearest to the bar first; last comes the business itself (its world boss, worldBossesOf: a
// party must clear its best lone card's GATE plus 0.010). Chapters run with the least left to clear first: what a chapter
// has left is the sum of its raid bosses' distances to the bar plus its world boss's distance to its own. A chapter is
// cleared only when every boss in it has fallen, and its standing is read from the strikes and the party strikes alone
// (standing / worldStanding), so any device holding the same receipts reads the same campaign.
//
// KIT IT FOR ME is forward selection, measured: from the owner's own cards of the DIGI's business, add the node that lifts
// the kitted GATE AUC the most (out of fold, src/kit.mjs kitted), and keep going while one lifts it and a node slot is
// open; ties go to the lower card id, so the same cards always give the same kit. Each step is shown with what it added.
// A card that is not the owner's, not of this business, or the DIGI itself is never tried. It is agentic engineering's
// tool selection by ablation, in the open.
//
// Pure apart from the measuring (kitted), and total: junk is a refusal, never thrown.
import { bossesOf, worldBossesOf, standing, worldStanding, BAR } from './raid.mjs';
import { kitted, slotsOf } from './kit.mjs';
import { facts } from './dossier.mjs';

const no = (why) => ({ ok: false, why });
/** the order chapters, bosses and cards are read in when what decides them is equal: a three-way compare, 0 only for the same text */
export const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** the chapters of an admission record: [{ n, set, raids: [{ domain, best, hp }], world: { set, best, bar, hp }, left }] */
export function chaptersOf(admission) {
  const raids = bossesOf(admission), worlds = worldBossesOf(admission);
  const chapters = worlds.map((w) => {
    const own = raids.filter((r) => r.set === w.set).map((r) => ({ domain: r.domain, best: r.best, hp: BAR - r.best })).sort((a, b) => a.hp - b.hp || byId(a.domain, b.domain));
    const world = { set: w.set, best: w.best, bar: w.bar, hp: w.bar - w.best };
    return { set: w.set, raids: own, world, left: own.reduce((s, r) => s + r.hp, 0) + world.hp };
  });
  return chapters.sort((a, b) => a.left - b.left || byId(a.set, b.set)).map((c, k) => ({ n: k + 1, ...c }));
}

/**
 * The campaign as it stands from the receipts: every boss marked fallen or not, each chapter cleared or not, and the
 * chapter to play now (the first not cleared; null once all are). → { ok, chapters, now } | a refusal
 */
export function campaign(admission, strikes, clears) {
  if (!Array.isArray(strikes) || !Array.isArray(clears)) return no('a campaign reads the strikes and the party strikes');
  const chapters = chaptersOf(admission), raid = standing(bossesOf(admission), strikes), world = worldStanding(worldBossesOf(admission), clears);
  const out = chapters.map((c) => {
    const raids = c.raids.map((r) => ({ ...r, fallen: raid.raids[r.domain].fallen }));
    const w = { ...c.world, fallen: world.raids[c.set].fallen };
    return { ...c, raids, world: w, cleared: raids.every((r) => r.fallen) && w.fallen };
  });
  const now = out.find((c) => !c.cleared);
  return { ok: true, chapters: out, now: now ? now.n : null };
}

/**
 * Kit it for me: v a checked DIGI, cards the owner's other checked cards, ground its business's. → { ok, nodes: [card ids
 * in slot order], alone, gate, steps: [{ card, gate, adds }] } | a refusal. alone and gate in millionths, out of fold.
 */
export function autoKit(v, cards, ground) {
  if (!v || v.ok !== true) return no('only a card that checks can be kitted');
  if (!Array.isArray(cards)) return no('kit it from a list of your cards');
  const set = facts(v).dataset, pool = cards.filter((n) => n && n.ok === true && n.id !== v.id && n.owner === v.owner && facts(n).dataset === set).sort((a, b) => byId(a.id, b.id));
  const start = kitted(v, [], ground);
  if (!start.ok) return start;
  const slots = slotsOf(v).nodes, chosen = [], steps = [];
  let gate = start.gate;
  while (chosen.length < slots) {
    let best = null;
    for (const n of pool) {
      if (chosen.includes(n)) continue;
      const k = kitted(v, [...chosen, n], ground);
      if (k.ok && k.slots[chosen.length].joined && (!best || k.gate > best.gate)) best = { n, gate: k.gate };
    }
    if (!best || best.gate <= gate) break;
    steps.push({ card: best.n.id, gate: best.gate, adds: best.gate - gate });
    chosen.push(best.n); gate = best.gate;
  }
  return { ok: true, nodes: chosen.map((n) => n.id), alone: start.gate, gate, steps };
}
