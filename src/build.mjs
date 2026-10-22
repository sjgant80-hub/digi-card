// src/build.mjs — BUILDS AND COMBOS: certain Kardlings together do a job better than any one of them, and that is measured,
// never claimed.
//
// A JOB is a business at a bar: the world bosses of the drop's admission record (src/raid.mjs) are the first jobs — the
// best any lone search on the business found, plus the party's margin. A BUILD is a recipe for a job: a set of cards (by
// id, each as it stands) on one business's ground, its parts in card-id order so the same cards make the same build, free
// to share and to fork (a fork names the build it came from). Measured, its parts are fielded as a party's are (src/mesh.mjs,
// without consents: a measurement needs nobody's leave): each must answer here and lead a coin on GATE with a
// paired-bootstrap bound above zero; the best-proven part fields each set of departments; the rest are benched by name.
// The fielded parts are coupled by non-negative stacking and judged out of fold on GATE.
//
// A COMBO is a build that beats its best part: its out-of-fold GATE AUC less the best fielded part's own out-of-fold GATE
// AUC (like for like) is at least COMBO millionths. An ANTI-COMBO is at least COMBO below its best part: together they do
// worse. Anything between is plain. A build's NAME is its fielded parts' titles in the order they field — made from the
// parts, never typed. A receipt is PROVEN when at least PROVEN_BY distinct keys have signed a re-run of it that measured
// exactly the same; the first of them found it. (A key is not a person: two keys make the claim one anyone can check, not
// a vote.) Whether combos found on GATE hold on TEST is for an organ to measure, never for this file to assert.
//
// Pure apart from the signatures (WebCrypto Ed25519); total: junk is refused in plain words, never thrown.
import { mindOf, scoreRow } from './mind.mjs';
import { facts } from './dossier.mjs';
import { oof } from './mesh.mjs';
import { worldBossesOf } from './raid.mjs';
import { lead } from '../vendor/dex-frontier/src/stats.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

export const BUILD = 'digi.build.v1';
export const RERUN = 'digi.rerun.v1';
export const MAX_PARTS = 6;   // benched parts count: a build is at most six cards, as the build card draws them
export const COMBO = 5000;        // a combo beats its best part by at least 0.005 GATE AUC, out of fold
export const PROVEN_BY = 2;       // distinct keys whose signed re-runs prove a receipt
export const ZERO = '0'.repeat(64);
export const KEYS = ['data', 'from', 'parts', 'type'];
export const RECEIPT = ['best', 'build', 'data', 'fielded', 'gate', 'kind', 'lift', 'n', 'name', 'parts', 'verdict'];
const RERUN_KEYS = ['by', 'receipt', 'sig', 'type'];
const HEX = /^[0-9a-f]{64}$/, SIG = /^[0-9a-f]{128}$/, CARD = /^[0-9a-f]{16}$/;
const no = (why) => ({ ok: false, why });
const milli = (x) => Math.round(x * 1e6);
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
const exactly = (x, keys) => isObj(x) && Object.keys(x).sort().join() === keys.join();
const unsigned = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig'));
const byId = (a, b) => (a < b ? -1 : 1);   // ids are never equal where it sorts; equal ones keep the order they came in
const hashOf = (e) => sha256Hex(canonical(e));

/** the jobs of an admission record: each business at the bar its world boss sets, by name */
export function jobsOf(admission) {
  return worldBossesOf(admission).map((b) => ({ set: b.set, bar: b.bar, best: b.best })).sort((a, b) => byId(a.set, b.set));
}

/** a build of these cards for this ground, forking the build `from` (or none). → { ok, build } | a refusal */
export function recipeOf(cards, ground, from = ZERO) {
  if (!ground || typeof ground.id !== 'string' || !ground.id) return no('a build is for a ground');
  if (!Array.isArray(cards) || cards.length < 2) return no('a build is two cards or more');
  if (cards.length > MAX_PARTS) return no('a build is at most ' + MAX_PARTS + ' cards');
  if (typeof from !== 'string' || !HEX.test(from)) return no('a build forks another build by its id, or none');
  const seen = new Set();
  for (const v of cards) {
    if (!v || v.ok !== true || !CARD.test(v.id || '') || !HEX.test(v.head || '')) return no('a part is a card that checks');
    if (seen.has(v.id)) return no('the same card is in the build twice');
    seen.add(v.id);
  }
  const parts = cards.map((v) => ({ card: v.id, head: v.head })).sort((a, b) => byId(a.card, b.card));
  return { ok: true, build: { type: BUILD, data: ground.id, parts, from } };
}

/** a build's id, and a receipt's: the hash of what it says */
export const buildId = (b) => hashOf(b);
export const receiptId = (r) => hashOf(r);

/** a build's name: its fielded parts' titles, in the order they field */
export const nameOf = (titles) => titles.join(' × ');

/** what a build is, from how many parts field and its lift: a combo, an anti-combo, or plain (one part alone is plain) */
export const verdictOf = (fielded, lift) => (fielded >= 2 && lift >= COMBO ? 'combo' : fielded >= 2 && lift <= -COMBO ? 'anti' : 'plain');

/** is this a build as recipeOf makes one: its type, a ground, 2 to MAX_PARTS parts in strict card-id order, a fork id */
function wellMade(b) {
  if (!exactly(b, KEYS) || b.type !== BUILD || typeof b.data !== 'string' || !HEX.test(b.from) || !Array.isArray(b.parts)) return false;
  if (b.parts.length < 2 || b.parts.length > MAX_PARTS) return false;
  return b.parts.every((p, k) => exactly(p, ['card', 'head']) && CARD.test(p.card) && HEX.test(p.head) && (k === 0 || p.card > b.parts[k - 1].card));
}

/**
 * Measure a build on its ground with the cards it names (in any order). → { ok, receipt: { kind: 'build', build, data,
 * parts: [{ card, head, title, domains, gate, joined, why, alone, contribution }] (in the build's order), fielded, gate,
 * best, lift, n, verdict: 'combo' | 'anti' | 'plain', name }, fielded: [{ card, mind, col }] } | a refusal
 */
export function measure(build, cards, ground) {
  try {
    if (!wellMade(build)) return no('not a build');
    if (!ground || !ground.ds || build.data !== ground.id) return no('this is not the ground the build is for');
    const here = new Map((Array.isArray(cards) ? cards : []).filter((v) => v && v.ok === true).map((v) => [v.id, v]));
    const rows = ground.ds.gateRows, y = rows.map((i) => ground.ds.y[i]), all = [];
    for (const p of build.parts) {
      const v = here.get(p.card);
      if (!v) return no('the build names a card that is not here: ' + p.card);
      if (v.head !== p.head) return no('a part has changed since the build was made: ' + p.card + ' (make the build again)');
      const row = { card: v.id, head: v.head, title: facts(v).title, domains: '', gate: null, joined: false, why: null, alone: null, contribution: null };
      const mind = mindOf(v, ground);
      if (mind.gate === null) { all.push({ ...row, why: 'it is dormant here: no department of its mind answers on this ground' }); continue; }
      const col = rows.map((i) => scoreRow(mind, ground, i)), l = lead(col, col.map(() => 0), y, 400, 7);
      row.domains = mind.organs.filter((o) => o.state === 'live').map((o) => o.domain).join('+');
      row.gate = mind.gate;
      if (!(l.low95 > 0)) { all.push({ ...row, why: 'it does not lead a coin on GATE (bound ' + l.low95 + ')' }); continue; }
      all.push({ ...row, mind, col });
    }
    const able = all.filter((p) => p.mind).sort((a, b) => b.gate - a.gate || byId(a.card, b.card)), fielded = [];
    for (const p of able) {
      if (fielded.some((f) => f.domains === p.domains)) p.why = 'a better-proven part fields ' + p.domains;
      else { p.joined = true; fielded.push(p); }
    }
    if (!fielded.length) return no('no part can field here: ' + all.map((p) => p.why).join('; '));
    const cols = fielded.map((p) => p.col), gate = milli(oof(cols, y));
    fielded.forEach((p, k) => { p.alone = milli(oof([p.col], y)); p.contribution = gate - milli(oof(cols.filter((_, j) => j !== k), y)); });
    const best = Math.max(...fielded.map((p) => p.alone)), lift = gate - best, parts = all.map(({ mind, col, ...p }) => p);
    const receipt = { kind: 'build', build: buildId(build), data: ground.id, parts, fielded: fielded.length, gate, best, lift, n: rows.length, verdict: verdictOf(fielded.length, lift), name: nameOf(fielded.map((p) => p.title)) };
    return { ok: true, receipt, fielded: fielded.map((p) => ({ card: p.card, mind: p.mind, col: p.col })) };
  } catch { return no('the build could not be measured here'); }
}

/** measure a build again from its recipe and its cards: the very same receipt, or a refusal naming the difference */
export function rerun(receipt, build, cards, ground) {
  try {
    if (!exactly(receipt, RECEIPT) || receipt.kind !== 'build') return no('not a build’s receipt');
    if (!wellMade(build) || receipt.build !== buildId(build)) return no('the receipt is for another build');
    const m = measure(build, cards, ground);
    if (!m.ok) return no('the build does not measure again: ' + m.why);
    return canonical(m.receipt) === canonical(receipt) ? { ok: true }
      : no('measured again here, it scores ' + m.receipt.gate + ' against its best part’s ' + m.receipt.best + ', not the receipt’s ' + receipt.gate + ' against ' + receipt.best);
  } catch { return no('not a build’s receipt'); }
}

/** a key's signed re-run of a receipt it measured again, exactly, here. → { ok, rerun } | a refusal */
export async function signRerun(keys, receipt, build, cards, ground) {
  if (!keys || !HEX.test(keys.pub || '')) return no('a re-run is signed by an Ed25519 key');
  const r = rerun(receipt, build, cards, ground);
  if (!r.ok) return r;
  const fields = { type: RERUN, receipt: receiptId(receipt), by: keys.pub };
  return { ok: true, rerun: { ...fields, sig: await sign(keys, utf8(canonical(fields))) } };
}

/**
 * Is this receipt proven? It measures again here, and at least PROVEN_BY distinct keys signed re-runs of exactly it (each
 * key once; a re-run that is not one, of another receipt, badly signed, or by a key already counted, is left out and
 * named). → { ok, verdict, proven, keys (in the order given), finder (the first, or null), refused: [why…] } | a refusal
 */
export async function proofOf(receipt, build, cards, ground, reruns) {
  const r = rerun(receipt, build, cards, ground);
  if (!r.ok) return r;
  if (!Array.isArray(reruns)) return no('a proof reads a list of signed re-runs');
  const id = receiptId(receipt), keys = [], refused = [];
  for (const x of reruns) {
    if (!exactly(x, RERUN_KEYS) || x.type !== RERUN || !HEX.test(x.by) || !HEX.test(x.receipt) || !SIG.test(x.sig)) { refused.push('not a signed re-run'); continue; }
    if (x.receipt !== id) { refused.push('a re-run of another receipt'); continue; }
    if (!(await verifySig(x.by, x.sig, utf8(canonical(unsigned(x)))))) { refused.push('a re-run whose signature does not check'); continue; }
    if (keys.includes(x.by)) { refused.push('the same key twice'); continue; }
    keys.push(x.by);
  }
  return { ok: true, verdict: receipt.verdict, proven: keys.length >= PROVEN_BY, keys, finder: keys.length ? keys[0] : null, refused };
}

/**
 * The build book, from checked proofs [{ receipt, proof }] (proofOf's): per ground, every proven combo, the biggest lift
 * first (ties to the lower build id), named, with its finder and how many keys proved it; the proven anti-combos, the
 * biggest drop first; how many proven builds were plain; and the best proven GATE. A receipt is counted once; an entry
 * that is not a proven receipt is left out. → { ok, jobs: { [ground id]: { combos, anti, plain, best } } } | a refusal
 */
export function bookOf(entries) {
  if (!Array.isArray(entries)) return no('a book reads proven receipts');
  const out = {}, seen = new Set();
  for (const e of entries) {
    try {
      if (!isObj(e) || !exactly(e.receipt, RECEIPT) || e.receipt.kind !== 'build' || !Number.isSafeInteger(e.receipt.gate) || !isObj(e.proof) || e.proof.ok !== true || e.proof.proven !== true) continue;
      const r = e.receipt, id = receiptId(r);
      if (seen.has(id) || e.proof.verdict !== r.verdict || !Array.isArray(e.proof.keys)) continue;
      seen.add(id);
      const j = out[r.data] || (out[r.data] = { combos: [], anti: [], plain: 0, best: 0 });
      const row = { id, build: r.build, name: r.name, gate: r.gate, best: r.best, lift: r.lift, fielded: r.fielded, finder: e.proof.finder, keys: e.proof.keys.length };
      if (r.verdict === 'combo') j.combos.push(row); else if (r.verdict === 'anti') j.anti.push(row); else j.plain++;
      j.best = Math.max(j.best, r.gate);
    } catch { /* an entry that cannot be read is not counted */ }
  }
  for (const j of Object.values(out)) {
    j.combos.sort((a, b) => b.lift - a.lift || byId(a.build, b.build));
    j.anti.sort((a, b) => a.lift - b.lift || byId(a.build, b.build));
  }
  return { ok: true, jobs: out };
}

/** does a measured build do this job: a receipt on the job's business that reaches its bar */
export const doesJob = (receipt, job) => isObj(receipt) && isObj(job) && typeof receipt.data === 'string' && receipt.data.split(':')[0] === job.set && Number.isSafeInteger(receipt.gate) && receipt.gate >= job.bar;
