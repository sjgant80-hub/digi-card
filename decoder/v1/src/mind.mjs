// src/mind.mjs — THE MIND a DIGI card carries: grown on the ground it works on, answering only where it has earned to,
// and levelling up only by a gain anyone can re-run.
//
// What the mind is, plainly: for each department it knows, a scorecard of at most six threshold rules over that
// department's own columns (seed-library's ribosome, vendored unchanged). The card carries the rules' SHAPE — which
// column, which quantile, which way, what weight — as a recipe of a few dozen bytes; the thresholds are read off the
// ground's own FIT rows wherever it is expressed, so the same recipe on the same bytes is the same mind, bit for bit, and
// it takes milliseconds. Nothing is neural, nothing is fitted by gradient, and a mind that does not clear its genome's
// bar on GATE (cases it never grew on) is CUT: it abstains, always.
//
// A mind of more than one department (a child bred across departments) answers through a coupling: a logistic
// regression over its departments' scores, learned on GATE (dex-frontier's compose.mjs), judged out of fold there.
//
// A LEVEL is the one way a mind changes: a new search (seed-library's evolution, from a seed) finds a scorecard, and it
// is adopted only if it beats the mind it replaces on GATE by at least MARGIN. The receipt carries the found mind in its
// fixed form, the search that found it, the ground's id, and both scores in millionths — so rerun() re-expresses both
// minds on the same bytes and demands the very same numbers, and with deep, re-runs the search and demands the very same
// mind. A level is never believed: it is re-run. (Whether a level earned on GATE holds on TEST is measured, not assumed:
// organ 3.) Pure and total: junk is refused in plain words, never thrown.
import { germinate as express, encodeSeed, makeSeed, decodeSeed, round6 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { operatingPoint, caseOf } from '../vendor/dex-frontier/vendor/living-seed/src/germinate.mjs';
import { couple, coupled } from '../vendor/dex-frontier/src/compose.mjs';
import { oofAuc, linear } from '../vendor/dex-frontier/src/select.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { viewOf } from './data.mjs';

export const MARGIN = 2000;                                            // a level lifts GATE AUC by at least 0.002
export const GROW = { population: 40, elites: 8, generations: 30 };    // the search a level runs (dex-frontier's nodes')
export const LEVEL_KEYS = ['after', 'before', 'data', 'domain', 'found', 'kind', 'recipe'];
const no = (why) => ({ ok: false, why });
const milli = (x) => Math.round(x * 1e6);
const exactly = (x, keys) => Object.prototype.toString.call(x) === '[object Object]' && Object.keys(x).sort().join() === keys.join();
const fired = (rule, x) => (rule.op === '>' ? x > rule.v : x <= rule.v);
const ruleScore = (rules, get) => round6(rules.reduce((s, r) => s + (fired(r, get(r.feat)) ? r.w : 0), 0));

/** a found mind in its fixed form: this exact rule shape for this department (thresholds still read off the ground) */
export const fixedOf = (domain, seed, genome) => encodeSeed(makeSeed({ domain, seed, genome }));
/** the search a level runs: one seed for one department */
export const searchOf = (domain, seed, grow = GROW) => encodeSeed(makeSeed({ domain, seed, grow }));
/** the seeds a card tries next: from its life's head, so every card searches its own way and anyone can repeat it */
/** the score at a share of the way up a sorted list (the operating point: the cut that puts that share below it) */
export const atShare = (sorted, share) => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
/** is this a level's lift? at least MARGIN millionths of GATE AUC */
export const lifts = (before, after) => after - before >= MARGIN;
export const seedsFor = (head, n) => Array.from({ length: n }, (_, i) => (parseInt(sha256Hex(head + ':' + i).slice(0, 8), 16) % 999999937) + 1);

/**
 * Express one recipe on one department: the organ, live or cut at the bar. A fixed recipe takes milliseconds; a search
 * recipe runs the search first. → { domain, recipe, fixed, state, gate (millionths), body: { rules, threshold } } |
 * a refusal
 */
export function organOf(recipe, view, bar) {
  const d = decodeSeed(recipe);
  if (!d.ok) return no('the recipe is not a seed: ' + d.error);
  if (!view || d.seed.domain !== view.name) return no('the recipe is for ' + d.seed.domain + ', not ' + (view ? view.name : 'nothing'));
  const g = express(view, recipe);
  if (!g.ok) return no('it could not grow here: ' + g.error);
  const rules = g.scorecard.rules.map((r) => ({ feat: r.feat, op: r.op, v: r.v, w: r.w }));
  return { ok: true, domain: view.name, recipe, fixed: fixedOf(view.name, d.seed.seed, g.genome), state: g.heldAuc >= bar ? 'live' : 'cut', gate: milli(g.heldAuc),
    body: { rules, threshold: round6(operatingPoint(g.scorecard, view, view.trainRows)) } };
}

/** the recipe each department of a card's mind follows after its first n level receipts: its genome's, then each level's */
export function recipesOf(v, n = Infinity) {
  const out = v.genome.organs.map((recipe) => ({ domain: decodeSeed(recipe, { guard: false }).seed.domain, recipe }));
  v.receipts.filter((r) => r.kind === 'level').slice(0, n).forEach((r) => { const o = out.find((x) => x.domain === r.domain); if (o) o.recipe = r.recipe; });
  return out;
}

/** one organ's score for row i of its view */
const scoreAt = (organ, view, i) => ruleScore(organ.body.rules, (f) => view.cols[f][i]);

/**
 * The card's mind on a ground: every department it knows, expressed there (or dormant, where the ground has no such
 * department); a coupling over the live ones when there are two or more. v — a checked dossier (verify()).
 * → { organs, live, gate (millionths, out of fold for a coupled mind), coupling, threshold } — gate is null with none live
 */
export function mindOf(v, ground) {
  const bar = v.genome.gate.auc, organs = recipesOf(v).map(({ domain, recipe }) => {
    const view = viewOf(ground, domain);
    if (!view) return { domain, recipe, state: 'dormant', why: 'this ground holds no ' + domain + ' records' };
    const o = organOf(recipe, view, bar);
    return o.ok ? o : { domain, recipe, state: 'cut', why: o.why };
  });
  const live = organs.filter((o) => o.state === 'live');
  if (live.length < 2) return { organs, live: live.length, gate: live.length ? live[0].gate : null, coupling: null, threshold: live.length ? live[0].body.threshold : null };
  const views = live.map((o) => viewOf(ground, o.domain)), rows = views[0].heldRows, fit = views[0].trainRows, y = rows.map((i) => views[0].y[i]);
  const columns = live.map((o, k) => rows.map((i) => scoreAt(o, views[k], i)));
  const c = couple(columns, y), z = fit.map((i) => coupled(c, live.map((o, k) => scoreAt(o, views[k], i)))).sort((a, b) => a - b);
  const base = fit.reduce((a, i) => a + views[0].y[i], 0) / fit.length;
  return { organs, live: live.length, gate: milli(oofAuc(linear, columns, y)), coupling: c, threshold: atShare(z, 1 - base) };
}

/** the mind's score for row i of the ground (null where it does not answer): for measuring, never for choosing */
export function scoreRow(mind, ground, i) {
  const live = mind.organs.filter((o) => o.state === 'live');
  if (!live.length) return null;
  const s = live.map((o) => scoreAt(o, viewOf(ground, o.domain), i));
  return mind.coupling ? coupled(mind.coupling, s) : s[0];
}

/**
 * Ask the mind about one case: x — the case's measurements by name. → { verdict: 'VERIFIED', label (0|1), score,
 * threshold, fired: [{ domain, feat, op, v, w }] } from a live mind that can read every measurement its rules read, or
 * { verdict: 'ABSTAIN', why } — never a guess.
 */
export function answer(mind, x) {
  const live = mind.organs.filter((o) => o.state === 'live');
  if (!live.length) return { verdict: 'ABSTAIN', why: mind.organs.length ? 'no department of its mind cleared its gate here: ' + mind.organs.map((o) => o.domain + ' ' + o.state).join(', ') : 'it has no mind' };
  if (!x || typeof x !== 'object') return { verdict: 'ABSTAIN', why: 'there is no case to read' };
  const missing = live.flatMap((o) => o.body.rules.map((r) => r.feat)).filter((f) => typeof x[f] !== 'number' || !Number.isFinite(x[f]));
  if (missing.length) return { verdict: 'ABSTAIN', why: 'the case lacks ' + [...new Set(missing)].join(', ') + ', which its rules read' };
  const s = live.map((o) => ruleScore(o.body.rules, (f) => x[f])), score = mind.coupling ? round6(coupled(mind.coupling, s)) : s[0];
  return { verdict: 'VERIFIED', label: score > mind.threshold ? 1 : 0, score, threshold: mind.threshold,
    fired: live.flatMap((o) => o.body.rules.filter((r) => fired(r, x[r.feat])).map((r) => ({ domain: o.domain, ...r }))) };
}

/** a case of the ground by row: every measurement of every department in it */
export const caseAt = (ground, i) => Object.fromEntries(Object.keys(ground.ds.cols).map((f) => [f, ground.ds.cols[f][i]]));
export { caseOf };

/**
 * Work for a level: run the search from seed on one department of the card's mind, and offer the receipt if what it
 * finds beats the mind it would replace by MARGIN on GATE. Slow by nature (it is a search); everything after is fast.
 * → { ok, receipt, before, after } | a refusal with both numbers
 */
export function level(v, ground, { domain, seed, grow = GROW } = {}) {
  const now = recipesOf(v).find((r) => r.domain === domain);
  if (!now) return no('its mind has no ' + String(domain).slice(0, 40) + ' department');
  const view = viewOf(ground, domain);
  if (!view) return no('this ground holds no ' + domain + ' records');
  if (!Number.isInteger(seed) || seed < 1) return no('a search starts from a whole-number seed of 1 or more');
  const bar = v.genome.gate.auc, before = organOf(now.recipe, view, bar), found = searchOf(domain, seed, grow), after = organOf(found, view, bar);
  if (!before.ok) return no('its mind could not be expressed here: ' + before.why);
  if (!after.ok) return no('the search could not run here: ' + after.why);
  if (!lifts(before.gate, after.gate)) return no('the search found ' + (after.gate / 1e6).toFixed(6) + ' on GATE against the mind’s ' + (before.gate / 1e6).toFixed(6) + ': a level needs a lift of at least 0.002');
  return { ok: true, before: before.gate, after: after.gate, receipt: { kind: 'level', data: ground.id, domain, recipe: after.fixed, found, before: before.gate, after: after.gate } };
}

/**
 * Re-run a level receipt: event k of a checked dossier (v, dossier), on a ground this device holds. The mind before it
 * and the mind it carries are both expressed here and must score exactly what the receipt says, the lift must be a
 * level's, and with deep the search it names must find exactly the mind it carries. → { ok } | a refusal naming why.
 */
export function rerun(receipt, v, k, dossier, { ground, deep = false } = {}) {
  if (!exactly(receipt, LEVEL_KEYS) || receipt.kind !== 'level') return no('it is not a level receipt');
  if (!ground || receipt.data !== ground.id) return no('this device does not hold the data this level was earned on (' + String(receipt.data).slice(0, 40) + ')');
  const before = dossier.events.slice(1, k).filter((e) => e.type === 'receipt' && e.receipt.kind === 'level').length;
  const prior = recipesOf(v, before).find((r) => r.domain === receipt.domain);
  if (!prior) return no('its mind has no ' + String(receipt.domain).slice(0, 40) + ' department');
  const view = viewOf(ground, receipt.domain), bar = v.genome.gate.auc;
  const d = decodeSeed(receipt.recipe), s = decodeSeed(receipt.found);
  if (!d.ok || d.seed.grow || d.seed.domain !== receipt.domain) return no('a level carries the mind it found, fixed, for its own department');
  if (!s.ok || !s.seed.grow || s.seed.domain !== receipt.domain) return no('a level names the search that found it, for its own department');
  const was = organOf(prior.recipe, view, bar), is = organOf(receipt.recipe, view, bar);
  if (!was.ok || was.gate !== receipt.before) return no('the mind before this level scores ' + (was.ok ? was.gate : 'nothing') + ' here, not the ' + receipt.before + ' its receipt says');
  if (is.gate !== receipt.after) return no('the mind this level carries scores ' + is.gate + ' here, not the ' + receipt.after + ' its receipt says');
  if (!lifts(receipt.before, receipt.after)) return no('a level lifts the mind by at least 2000 millionths on GATE; this one lifts it by ' + (receipt.after - receipt.before));
  if (deep && organOf(receipt.found, view, bar).fixed !== receipt.recipe) return no('the search it names does not find the mind it carries');
  return { ok: true };
}
