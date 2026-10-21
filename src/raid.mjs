// src/raid.mjs — RAIDS: the bosses are the problems nobody has solved. A boss is a department of a public dataset where
// no genesis search cleared the bar (0.6 AUC on GATE), so the drop holds no card of it. A raid strikes it with searches:
// each strike is one search on the department's FIT rows, from a seed that the striker's key and the strike's number
// fix (so two players never repeat each other's work), scored on GATE, and signed by the striker. Any device re-checks
// a strike in milliseconds: it re-expresses the mind the search found (carried fixed, as a level carries it) on the
// published bytes and demands the same score; a deep check re-runs the search itself.
//
// The boss's health is the distance from the best strike so far to the bar. It falls when a strike clears the bar, and
// the striker may seal the first card of that department as its maker: the loot. The best of many tries is luckier than
// one, so the raid always says how many strikes it took — and the drop's own admission rule (four of the first eight
// seeds) was stricter than one strike clearing once. Friends raid together by pooling signed strikes; each is checked on
// arrival, and the same strike is never counted twice. Nothing is staked.
//
// Pure apart from the signatures (WebCrypto Ed25519) and the search, which a caller runs (src/mind.mjs, or a worker).
import { organOf, searchOf, seedsFor, GROW } from './mind.mjs';
import { viewOf } from './data.mjs';
import { decodeSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { assemble } from './mesh.mjs';

export const BAR = 600000;
export const KEYS = ['by', 'data', 'domain', 'found', 'gate', 'k', 'kind', 'recipe', 'sig'];
const HEX = /^[0-9a-f]{64}$/, SIG = /^[0-9a-f]{128}$/;
const no = (why) => ({ ok: false, why });
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
const exactly = (x, keys) => isObj(x) && Object.keys(x).sort().join() === keys.join();
const unsigned = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig'));

/** the seed of a striker's k-th strike on a department: their key and the number fix it, so no two players share work */
export const strikeSeed = (pub, domain, k) => seedsFor('digi-card/raid/' + domain + '/' + pub, k + 1)[k];

/** the bosses: the departments of a drop's admission record that no genesis search took past the bar, with their best */
export function bossesOf(admission) {
  if (!isObj(admission) || !Array.isArray(admission.departments)) return [];
  return admission.departments.filter((d) => isObj(d) && d.admitted === false && Array.isArray(d.gates) && d.gates.length).map((d) => ({ domain: d.domain, set: d.set, best: Math.max(...d.gates), searched: d.gates.length }));
}

/**
 * Strike: run the k-th search of this striker on a boss department and sign what it found. Slow (it is a search); the
 * caller may run organOf(searchOf(...)) in a worker and hand the organ in as opts.organ. → { ok, strike } | a refusal
 */
export async function strike(keys, ground, domain, k, opts = {}) {
  if (!keys || !HEX.test(keys.pub || '')) return no('a strike is signed by an Ed25519 key');
  if (!Number.isSafeInteger(k) || k < 0 || k > 99999) return no('a strike’s number is a whole number from 0');
  const view = viewOf(ground, domain);
  if (!view) return no('this ground holds no ' + String(domain).slice(0, 40) + ' records');
  const found = searchOf(domain, strikeSeed(keys.pub, domain, k), GROW), o = opts.organ || organOf(found, view, BAR / 1e6);
  if (!o || o.ok !== true) return no('the search could not run here: ' + ((o && o.why) || 'no organ'));
  const fields = { kind: 'strike', domain, data: ground.id, k, found, recipe: o.fixed, gate: o.gate, by: keys.pub };
  return { ok: true, strike: { ...fields, sig: await sign(keys, utf8(canonical(fields))) } };
}

/**
 * Check a strike on a ground: its shape and signature; the search it names is this striker's k-th; the mind it carries
 * is that search's department's and scores exactly its GATE here; with deep, the search itself finds that very mind.
 * → { ok } | a refusal naming why
 */
export async function check(s, ground, { deep = false } = {}) {
  try {
    if (!exactly(s, KEYS) || s.kind !== 'strike') return no('not a strike');
    if (!HEX.test(s.by) || !SIG.test(s.sig)) return no('not a strike');
    if (!Number.isSafeInteger(s.k) || s.k < 0 || s.k > 99999 || !Number.isSafeInteger(s.gate)) return no('not a strike');
    if (!(await verifySig(s.by, s.sig, utf8(canonical(unsigned(s)))))) return no('the strike’s signature does not check');
    if (!ground || s.data !== ground.id) return no('this device does not hold the data the strike was made on');
    if (s.found !== searchOf(s.domain, strikeSeed(s.by, s.domain, s.k), GROW)) return no('the search it names is not this striker’s strike ' + s.k);
    const d = decodeSeed(s.recipe);
    if (!d.ok || d.seed.grow || d.seed.domain !== s.domain) return no('a strike carries the mind it found, fixed, for its own department');
    const view = viewOf(ground, s.domain);
    if (!view) return no('this ground holds no ' + s.domain + ' records');
    const o = organOf(s.recipe, view, BAR / 1e6);
    if (!o.ok || o.gate !== s.gate) return no('the mind it carries scores ' + (o.ok ? o.gate : 'nothing') + ' here, not the ' + s.gate + ' it says');
    if (deep && organOf(s.found, view, BAR / 1e6).fixed !== s.recipe) return no('the search it names does not find the mind it carries');
    return { ok: true };
  } catch { return no('not a strike'); }
}

/** a strike's identity: the hash of its signed content */
export const strikeId = (s) => sha256Hex(canonical(s));

/**
 * A raid's standing, from checked strikes: for each boss, the strikes against it (each counted once), the best GATE,
 * its health (the bar less the best, never below zero), whether it has fallen, the first strike that felled it, and
 * the strikers. bosses: bossesOf(admission). → { ok, raids: { domain: { … } } }
 */
export function standing(bosses, strikes) {
  if (!Array.isArray(bosses) || !Array.isArray(strikes)) return no('a standing reads the bosses and the strikes');
  const out = {}, seen = new Set();
  for (const b of bosses) out[b.domain] = { domain: b.domain, set: b.set, start: b.best, best: b.best, strikes: 0, hp: Math.max(0, BAR - b.best), fallen: false, kill: null, strikers: {} };
  for (const s of strikes) {
    if (!exactly(s, KEYS) || !out[s.domain]) continue;
    const id = strikeId(s);
    if (seen.has(id)) continue;
    seen.add(id);
    const r = out[s.domain];
    r.strikes++; r.strikers[s.by] = (r.strikers[s.by] || 0) + 1;
    r.best = Math.max(r.best, s.gate); r.hp = Math.max(0, BAR - r.best);
    if (!r.fallen && s.gate >= BAR) { r.fallen = true; r.kill = { by: s.by, k: s.k, gate: s.gate, after: r.strikes }; }
  }
  return { ok: true, raids: out };
}

/** the loot: the genome fields of the first card of a fallen boss's department, for its striker to seal as maker */
export function lootOf(s) {
  if (!exactly(s, KEYS) || s.kind !== 'strike' || s.gate < BAR) return no('only a strike that cleared the bar carries loot');
  return { ok: true, genome: { name: s.domain, parents: [], gate: { auc: BAR / 1e6 }, organs: [s.recipe] } };
}

// ── PARTY RAIDS: the world bosses ───────────────────────────────────────────────────────────────────────────────────
// A world boss is a whole business, at a bar no lone search reached: the best GATE any genesis search on any of its
// departments found (the drop's own admission record), or the plain bar where none reached even that, plus PARTY_MARGIN.
// A party strikes it together: each member's owner consents for this raid, for the card as it stands, and the party is
// assembled exactly as a mesh is (src/mesh.mjs — the join rule, the coupling, the out-of-fold judge, the shares). Its
// strike is a receipt naming every fielded card as it stands, its owner, its leave-one-out contribution and its share in
// millionths (a million between them): the record of who did what. The boss falls when a party's GATE clears the bar.
// Anyone holding the cards and the consents strikes again and must get the very same receipt. Nothing is staked.
export const PARTY_MARGIN = 10000;
export const CLEAR = ['bar', 'data', 'gate', 'kind', 'members', 'party', 'set'];
/** the name every member's owner consents for: one raid per business */
export const partyOf = (set) => 'raid-' + set;

/** the world bosses of an admission record: each business, its best lone genesis search and the bar a party must clear */
export function worldBossesOf(admission) {
  if (!isObj(admission) || !Array.isArray(admission.departments)) return [];
  const sets = new Map();
  for (const d of admission.departments) {
    if (!isObj(d) || typeof d.set !== 'string' || !Array.isArray(d.gates)) continue;
    const s = sets.get(d.set) || { set: d.set, best: 0, departments: 0 };
    s.departments++;
    for (const g of d.gates) if (Number.isSafeInteger(g)) s.best = Math.max(s.best, g);
    sets.set(d.set, s);
  }
  return [...sets.values()].map((s) => ({ ...s, bar: Math.max(BAR, s.best) + PARTY_MARGIN }));
}

/**
 * A party strikes a world boss: candidates [{ v, consent }] (consents for partyOf(set)), on the business's ground.
 * → { ok, clear: { kind: 'clear', party, set, data, bar, gate, members: [{ card, head, owner, contribution, share }] },
 *     cleared, best (the best fielded card alone), mesh } | a refusal
 */
export async function partyStrike(boss, candidates, ground) {
  try {
    if (!isObj(boss) || typeof boss.set !== 'string' || !Number.isSafeInteger(boss.bar)) return no('a party strikes a world boss');
    if (!ground || !ground.ds || ground.set !== boss.set) return no('this is not the ground of ' + String(boss.set).slice(0, 24));
    const m = await assemble(partyOf(boss.set), candidates, ground);
    if (!m.ok) return no(m.why);
    const heads = new Map(candidates.filter((c) => c && c.v && c.v.ok === true).map((c) => [c.v.id, c.v.head]));
    const members = m.members.filter((x) => x.joined).map((x) => ({ card: x.card, head: heads.get(x.card), owner: x.owner, contribution: x.contribution, share: x.share }));
    const clear = { kind: 'clear', party: partyOf(boss.set), set: boss.set, data: ground.id, bar: boss.bar, gate: m.gate, members };
    return { ok: true, clear, cleared: m.gate >= boss.bar, best: m.best, mesh: m };
  } catch { return no('the party could not strike here'); }
}

/** strike again from the receipt's cards and consents: the very same receipt, or a refusal naming the difference */
export async function checkClear(clear, boss, candidates, ground) {
  if (!exactly(clear, CLEAR) || clear.kind !== 'clear') return no('not a party’s strike');
  const r = await partyStrike(boss, candidates, ground);
  if (!r.ok) return no('the party does not strike again: ' + r.why);
  return canonical(r.clear) === canonical(clear) ? { ok: true } : no('struck again here, the party scores ' + r.clear.gate + ' with ' + r.clear.members.length + ' fielded, not the ' + clear.gate + ' with ' + (Array.isArray(clear.members) ? clear.members.length : 0) + ' its receipt says');
}

/** the world bosses' standing from party strikes (each counted once): best GATE, health, and the first strike to clear */
export function worldStanding(bosses, clears) {
  if (!Array.isArray(bosses) || !Array.isArray(clears)) return no('a standing reads the bosses and the strikes');
  const out = {}, seen = new Set();
  for (const b of bosses) out[b.set] = { set: b.set, bar: b.bar, start: b.best, best: b.best, strikes: 0, hp: Math.max(0, b.bar - b.best), fallen: false, first: null };
  for (const c of clears) {
    if (!exactly(c, CLEAR) || !out[c.set] || !Number.isSafeInteger(c.gate) || !Array.isArray(c.members)) continue;
    const id = sha256Hex(canonical(c));
    if (seen.has(id)) continue;
    seen.add(id);
    const r = out[c.set];
    r.strikes++;
    r.best = Math.max(r.best, c.gate); r.hp = Math.max(0, r.bar - r.best);
    if (!r.fallen && c.gate >= r.bar) { r.fallen = true; r.first = { gate: c.gate, members: c.members.length, owners: new Set(c.members.map((x) => x.owner)).size, after: r.strikes }; }
  }
  return { ok: true, raids: out };
}
