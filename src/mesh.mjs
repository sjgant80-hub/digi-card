// src/mesh.mjs — THE MESH: owned DIGIs of one business answer as one, each by its owner's consent, and a ledger says —
// by measurement, not by claim — what each card is worth to the whole.
//
// A card joins a mesh only with a consent its owner signed for THIS life of the card (its head), so a card sold on
// leaves the mesh until its new owner consents. It must answer here (a live mind on this ground) and lead a coin on GATE
// with a paired-bootstrap bound above zero (dex-frontier's join rule, organ 2h): a card that adds nothing measurable stays
// on the bench, named, with its number. The mesh fields the best-proven card for each set of departments (ties to the
// lower id); the rest stand by. The members' scores are coupled by non-negative stacking (dex-frontier's compose.mjs:
// a member adds its word or is silent, never counted against its own evidence), learned on GATE and judged out of fold.
//
// The ledger: each member's contribution is the out-of-fold GATE AUC of the mesh with it minus without it, and its share
// is its part of the positive contributions, in millionths, summing to exactly a million. When the mesh does work (a job
// of answered cases), each owner is credited cases × share — in a hash-chained log anyone can replay, every share
// recomputed from the ground. Credits are an accounting of contribution, not money: what a credit is worth, if anything,
// is the business of whoever runs the mesh, outside this repository. Only scores cross between members, never records.
import { coupleNonNegative, coupled } from '../vendor/dex-frontier/src/compose.mjs';
import { lead } from '../vendor/dex-frontier/src/stats.mjs';
import { auc, round6 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { mindOf, scoreRow, answer } from './mind.mjs';

export const CONSENT = 'digi.consent.v1';
export const MAX_MEMBERS = 12;
export const ZERO = '0'.repeat(64);
const MESH = /^[a-z][a-z0-9-]{0,31}$/, PUB = /^[0-9a-f]{64}$/, SIG = /^[0-9a-f]{128}$/;
const no = (why) => ({ ok: false, why });
const milli = (x) => Math.round(x * 1e6);
const exactly = (x, keys) => Object.prototype.toString.call(x) === '[object Object]' && Object.keys(x).sort().join() === keys.join();
const canon = (x) => { try { return canonical(x); } catch { return null; } };
const unsigned = (c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'sig'));

/** the owner's consent for this card, as it stands now, to work in mesh. → the signed consent | a refusal */
export async function consent(ownerKeys, v, mesh) {
  if (typeof mesh !== 'string' || !MESH.test(mesh)) return no('a mesh is named in lower-case letters, digits and hyphens, at most 32');
  if (!v || v.ok !== true || v.owner !== ownerKeys.pub) return no('only the card’s owner consents for it');
  const c = { kind: CONSENT, mesh, card: v.id, head: v.head, by: ownerKeys.pub };
  return { ok: true, consent: { ...c, sig: await sign(ownerKeys, utf8(canonical(c))) } };
}

/** is this consent the owner's, for this card as it stands now, for this mesh? → { ok } | a refusal naming why */
export async function consentOk(c, v, mesh) {
  if (!exactly(c, ['by', 'card', 'head', 'kind', 'mesh', 'sig']) || c.kind !== CONSENT) return no('not a consent');
  if (c.mesh !== mesh) return no('the consent is for another mesh');
  if (c.card !== v.id) return no('the consent is for another card');
  if (c.head !== v.head) return no('the consent was given for an earlier life of the card: its owner must consent again');
  if (c.by !== v.owner) return no('the consent is not its owner’s');
  if (!PUB.test(c.by) || !SIG.test(c.sig) || !(await verifySig(c.by, c.sig, utf8(canonical(unsigned(c)))))) return no('the consent’s signature does not check');
  return { ok: true };
}

/** out-of-fold AUC of the non-negative coupling of these columns (folds by row), or a coin's 0.5 with no columns */
function oof(cols, y, folds = 4) {
  if (!cols.length) return 0.5;
  const pred = new Array(y.length);
  for (let f = 0; f < folds; f++) {
    const tr = [], ho = [];
    y.forEach((_, i) => (i % folds === f ? ho : tr).push(i));
    const c = coupleNonNegative(cols.map((col) => tr.map((i) => col[i])), tr.map((i) => y[i]));
    for (const i of ho) pred[i] = coupled(c, cols.map((col) => col[i]));
  }
  return auc(pred, y);
}

/** shares of the positive contributions, in millionths, summing to exactly a million (largest remainder, then order) */
export function sharesOf(contributions) {
  const pos = contributions.map((c) => Math.max(0, c)), total = pos.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return contributions.map(() => 0);
  const raw = pos.map((p) => (p * 1e6) / total), out = raw.map(Math.floor);
  const left = 1e6 - out.reduce((a, b) => a + b, 0);
  raw.map((r, k) => ({ k, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.k - b.k).slice(0, left).forEach(({ k }) => out[k]++);
  return out;
}

/**
 * Assemble a mesh on a ground: candidates [{ v, consent }] (v from verify()). → { ok, mesh, members: [{ card, owner,
 * departments, gate, joined, why?, contribution?, share? }], gate (out of fold, millionths), best (the best single
 * member's GATE), coupling, rows } | a refusal
 */
export async function assemble(mesh, candidates, ground) {
  if (typeof mesh !== 'string' || !MESH.test(mesh)) return no('a mesh is named in lower-case letters, digits and hyphens, at most 32');
  if (!Array.isArray(candidates) || !candidates.length) return no('a mesh needs at least one card');
  const rows = ground.ds.gateRows, y = rows.map((i) => ground.ds.y[i]), seen = new Set(), all = [];
  for (const { v, consent: c } of candidates) {
    if (!v || v.ok !== true) { all.push({ card: null, joined: false, why: 'the card does not check' }); continue; }
    const row = { card: v.id, owner: v.owner, departments: v.genome.organs.length, joined: false };
    if (seen.has(v.id)) { all.push({ ...row, why: 'the card is already a candidate' }); continue; }
    seen.add(v.id);
    const ok = await consentOk(c, v, mesh);
    if (!ok.ok) { all.push({ ...row, why: ok.why }); continue; }
    const mind = mindOf(v, ground);
    if (mind.gate === null) { all.push({ ...row, why: 'it has no live mind on this ground' }); continue; }
    const col = rows.map((i) => scoreRow(mind, ground, i)), l = lead(col, col.map(() => 0), y, 400, 7);
    const domains = mind.organs.filter((o) => o.state === 'live').map((o) => o.domain).join('+');
    if (!(l.low95 > 0)) { all.push({ ...row, domains, gate: mind.gate, why: 'it does not lead a coin on GATE (bound ' + l.low95 + ')' }); continue; }
    all.push({ ...row, domains, gate: mind.gate, mind, col, why: null });
  }
  const able = all.filter((m) => m.why === null).sort((a, b) => b.gate - a.gate || (a.card < b.card ? -1 : 1)), fielded = [];
  for (const m of able) {
    if (fielded.some((f) => f.domains === m.domains)) m.why = 'a better-proven card fields ' + m.domains;
    else if (fielded.length >= MAX_MEMBERS) m.why = 'the mesh fields at most ' + MAX_MEMBERS + ' cards';
    else { m.joined = true; fielded.push(m); }
  }
  if (!fielded.length) return no('no card can join: ' + all.map((m) => m.why).join('; '));
  const cols = fielded.map((m) => m.col), whole = oof(cols, y);
  const contributions = fielded.map((_, k) => milli(whole) - milli(oof(cols.filter((__, j) => j !== k), y))), shares = sharesOf(contributions);
  fielded.forEach((m, k) => { m.contribution = contributions[k]; m.share = shares[k]; });
  const members = all.map(({ mind, col, ...m }) => m);
  return { ok: true, mesh, members, fielded: fielded.map((m) => ({ card: m.card, owner: m.owner, mind: m.mind })), gate: milli(whole), best: fielded[0].gate, coupling: coupleNonNegative(cols, y) };
}

/** ask the mesh about one case: each fielded member answers; one that abstains says nothing (its term is left out) */
export function ask(m, x) {
  const said = m.fielded.map((f) => answer(f.mind, x)), heard = said.filter((a) => a.verdict === 'VERIFIED').length;
  if (!heard) return { verdict: 'ABSTAIN', why: 'no member of the mesh can answer this case', members: said };
  const c = m.coupling, z = said.reduce((s, a, k) => s + (a.verdict === 'VERIFIED' ? c.weights[k + 1] * ((a.score - c.mean[k]) / c.sd[k]) : 0), c.weights[0]);
  return { verdict: 'VERIFIED', score: round6(z), heard, members: said };
}

const ENTRY = ['cases', 'credits', 'job', 'mesh', 'n', 'prev'];
/** the hash a ledger entry is known by */
export const entryHash = (e) => sha256Hex(canonical(e));

/**
 * The mesh did work: a job of answered cases. Append its credits to the ledger: each fielded owner, cases × share
 * (millionths). → { ok, log, entry } | a refusal
 */
export function work(m, log, { job, cases }) {
  if (!Array.isArray(log)) return no('not a ledger');
  if (typeof job !== 'string' || !MESH.test(job)) return no('a job is named in lower-case letters, digits and hyphens, at most 32');
  if (!Number.isSafeInteger(cases) || cases < 1 || cases > 1e6) return no('a job is 1 to 1,000,000 answered cases');
  const credits = {};
  for (const mem of m.members.filter((x) => x.joined)) credits[mem.owner] = (credits[mem.owner] || 0) + cases * mem.share;
  const entry = { n: log.length, prev: log.length ? entryHash(log[log.length - 1]) : ZERO, mesh: m.mesh, job, cases, credits };
  return { ok: true, log: [...log, entry], entry };
}

/**
 * Replay a ledger: every entry linked to the one before, and (given the mesh as assembled now) every credit exactly what
 * its shares give. → { ok, totals: { owner: credits } } | a refusal naming the entry
 */
export function tally(log, m) {
  if (!Array.isArray(log)) return no('not a ledger');
  const totals = {};
  for (const [n, e] of log.entries()) {
    if (!exactly(e, ENTRY) || Object.prototype.toString.call(e.credits) !== '[object Object]' || canon(e) === null) return no('entry ' + n + ' is not a ledger entry');
    if (e.n !== n || e.prev !== (n ? entryHash(log[n - 1]) : ZERO)) return no('entry ' + n + ' is not linked to the one before it');
    if (m) {
      const want = work(m, log.slice(0, n), { job: e.job, cases: e.cases });
      if (!want.ok || canonical(want.entry) !== canon(e)) return no('entry ' + n + '’s credits are not what the mesh’s shares give');
    }
    for (const [owner, c] of Object.entries(e.credits)) totals[owner] = (totals[owner] || 0) + c;
  }
  return { ok: true, totals };
}
