// src/arena.mjs — THE ARENA: two cards meet on one sealed batch of cases; the one whose mind ranks them better wins,
// and anyone holding both cards and the data re-runs the duel to the very same receipt.
//
// A duel is agreed by both owners. The challenger signs a challenge for its card as it stands (its id and its head) with
// a nonce of its choosing; the defender signs an acceptance naming the challenge's hash and its own card as it stands.
// The batch is drawn from both signed records, so neither side chooses it alone: BATCH of the ground's GATE rows — the
// cases both minds were proven on — ordered by a hash of the duel's seed and each row. Each mind scores the batch; the
// higher AUC on it wins, and equal is a draw. TEST is never read here: it stays sealed for the organs.
//
// Both cards must answer on the ground (a card of another business is dormant there and cannot fight). The receipt
// names both cards' heads, the data's id, the seed, the batch size and both scores in millionths; rerun() re-scores it
// and demands the same numbers. ratings() turns receipts into whole-number Elo ratings, in their order, with a published
// table of expected scores instead of floating exponents, so every device computes the same ladder; a duel with one
// owner on both sides is still a duel, but it never moves a rating. Nothing is staked: a duel moves no card and no credit.
//
// Pure apart from the signatures (WebCrypto Ed25519); total: junk is refused in plain words, never thrown.
import { mindOf, scoreRow } from './mind.mjs';
import { auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

export const BATCH = 64;
export const RATING = 1000, K = 32, STEP = 25, SPAN = 800;
/** the expected score of the lower-rated side, in millionths, for a rating gap of -800, -775, … 800 (1 / (1 + 10^(gap/400))) */
export const EXPECT = Object.freeze([990099, 988584, 986840, 984834, 982528, 979878, 976836, 973346, 969347, 964769, 959537, 953565, 946760, 939022, 930242, 920305, 909091, 896477, 882338, 866557, 849020, 829633, 808318, 785027, 759747, 732507, 703385, 672510, 640065, 606288, 571463, 535916,
  500000, 464084, 428537, 393712, 359935, 327490, 296615, 267493, 240253, 214973, 191682, 170367, 150980, 133443, 117662, 103523, 90909, 79695, 69758, 60978, 53240, 46435, 40463, 35231, 30653, 26654, 23164, 20122, 17472, 15166, 13160, 11416, 9901]);
const HEX = /^[0-9a-f]{64}$/, SIG = /^[0-9a-f]{128}$/, CARD = /^[0-9a-f]{16}$/, NONCE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RECEIPT = ['a', 'accept', 'b', 'challenge', 'data', 'kind', 'n', 'seed', 'self', 'winner'];
const no = (why) => ({ ok: false, why });
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
const exactly = (x, keys) => isObj(x) && Object.keys(x).sort().join() === keys.join();
const unsigned = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig'));
const hashOf = (e) => sha256Hex(canonical(e));

/** the challenger's offer, signed by the owner of its card as it stands. → { ok, challenge } | a refusal */
export async function challenge(keys, v, nonce) {
  if (!v || v.ok !== true) return no('only a card that checks can challenge');
  if (!keys || keys.pub !== v.owner) return no('only the card’s owner can send its challenge');
  if (typeof nonce !== 'string' || !NONCE.test(nonce)) return no('a nonce is up to 64 lowercase letters, digits and hyphens');
  const fields = { type: 'digi.challenge.v1', card: v.id, head: v.head, nonce, by: keys.pub };
  return { ok: true, challenge: { ...fields, sig: await sign(keys, utf8(canonical(fields))) } };
}

/** the defender's acceptance of a challenge, signed by the owner of its own card as it stands. → { ok, accept } | a refusal */
export async function accept(keys, v, ch) {
  if (!v || v.ok !== true) return no('only a card that checks can accept');
  if (!keys || keys.pub !== v.owner) return no('only the card’s owner can accept for it');
  const bad = await checkChallenge(ch);
  if (bad) return no(bad);
  if (ch.card === v.id) return no('a card cannot fight itself');
  const fields = { type: 'digi.accept.v1', card: v.id, head: v.head, challenge: hashOf(ch), by: keys.pub };
  return { ok: true, accept: { ...fields, sig: await sign(keys, utf8(canonical(fields))) } };
}

async function checkSigned(e, type, keys, what) {
  if (!exactly(e, keys) || e.type !== type) return 'not a ' + what;
  if (!CARD.test(e.card) || !HEX.test(e.head) || !HEX.test(e.by) || !SIG.test(e.sig)) return 'not a ' + what;
  return (await verifySig(e.by, e.sig, utf8(canonical(unsigned(e))))) ? '' : 'the ' + what + '’s signature does not check';
}
const checkChallenge = async (ch) => (await checkSigned(ch, 'digi.challenge.v1', ['by', 'card', 'head', 'nonce', 'sig', 'type'], 'challenge')) || (NONCE.test(ch.nonce) ? '' : 'not a challenge');

/** the duel's seed: neither side chose it alone */
export const seedOf = (ch, ac) => sha256Hex(canonical(ch) + '|' + canonical(ac));

/** the batch: n of the ground's GATE rows, in the order of the hash of the seed and each row. → [row] */
export function batchOf(ground, seed, n = BATCH) {
  const rows = ground && ground.ds && Array.isArray(ground.ds.gateRows) ? ground.ds.gateRows : [];
  return rows.map((i) => sha256Hex(seed + ':' + i) + ' ' + i).sort().slice(0, n).map((x) => Number(x.slice(65)));   // a hash, a space, the row
}

/**
 * Fight a duel: vA and vB checked dossiers (verify()), the ground both answer on, and the signed challenge and acceptance.
 * → { ok, receipt: { kind: 'duel', data, a: { card, head, auc }, b: { card, head, auc }, challenge, accept, seed, n, winner, self },
 *     batch, scores: { a: [..], b: [..] }, y: [..] } | a refusal naming why
 */
export async function duel(vA, vB, ground, { challenge: ch, accept: ac } = {}) {
  try {
    if (!vA || vA.ok !== true || !vB || vB.ok !== true) return no('both cards must check');
    const badC = await checkChallenge(ch);
    if (badC) return no(badC);
    const badA = await checkSigned(ac, 'digi.accept.v1', ['by', 'card', 'challenge', 'head', 'sig', 'type'], 'acceptance');
    if (badA) return no(badA);
    if (ac.challenge !== hashOf(ch)) return no('the acceptance is for another challenge');
    if (ch.card !== vA.id || ch.head !== vA.head) return no('the challenge is not for this card as it stands');
    if (ac.card !== vB.id || ac.head !== vB.head) return no('the acceptance is not for this card as it stands');
    if (ch.by !== vA.owner) return no('the challenge was not signed by its card’s owner');
    if (ac.by !== vB.owner) return no('the acceptance was not signed by its card’s owner');
    if (vA.id === vB.id) return no('a card cannot fight itself');
    const mA = mindOf(vA, ground), mB = mindOf(vB, ground);
    if (mA.gate === null || mB.gate === null) return no('both cards must answer on this ground: a card of another business is dormant here');
    const seed = seedOf(ch, ac), batch = batchOf(ground, seed);
    if (batch.length < BATCH) return no('this ground holds fewer than ' + BATCH + ' GATE cases');
    const y = batch.map((i) => ground.ds.y[i]), sA = batch.map((i) => scoreRow(mA, ground, i)), sB = batch.map((i) => scoreRow(mB, ground, i));
    const a = Math.round(auc(sA, y) * 1e6), b = Math.round(auc(sB, y) * 1e6);
    const receipt = { kind: 'duel', data: ground.id, a: { card: vA.id, head: vA.head, auc: a }, b: { card: vB.id, head: vB.head, auc: b }, challenge: hashOf(ch), accept: hashOf(ac), seed, n: batch.length, winner: a > b ? 'a' : b > a ? 'b' : 'draw', self: vA.owner === vB.owner };
    return { ok: true, receipt, batch, scores: { a: sA, b: sB }, y };
  } catch { return no('the duel could not be fought here'); }
}

/** re-fight a duel from its receipt, the two cards, the ground, the challenge and the acceptance. → { ok } | why not */
export async function rerun(receipt, vA, vB, ground, signed) {
  if (!exactly(receipt, RECEIPT) || receipt.kind !== 'duel') return no('not a duel receipt');
  const r = await duel(vA, vB, ground, signed);
  if (!r.ok) return no('the duel does not re-fight: ' + r.why);
  return canonical(r.receipt) === canonical(receipt) ? { ok: true } : no('re-fought here, it gives ' + r.receipt.a.auc + ' against ' + r.receipt.b.auc + ', not the receipt’s ' + receipt.a.auc + ' against ' + receipt.b.auc);
}

/** the expected score, in millionths, of a side rated `mine` against `theirs` */
export function expected(mine, theirs) {
  const gap = Math.max(-SPAN, Math.min(SPAN, theirs - mine)), k = Math.round(gap / STEP) + SPAN / STEP;
  return EXPECT[k];
}

/**
 * Ratings from a list of duel receipts, in their order: every card starts at RATING; after each duel between two
 * owners, each side moves by K × (score − expected), in whole points, the two moves equal and opposite.
 * → { ok, ratings: { card: points }, played: { card: duels }, skipped } | a refusal
 */
export function ratings(receipts) {
  if (!Array.isArray(receipts)) return no('ratings read a list of duel receipts');
  const r = {}, played = {};
  let skipped = 0;
  for (const x of receipts) {
    if (!exactly(x, RECEIPT) || x.kind !== 'duel' || !isObj(x.a) || !isObj(x.b) || !CARD.test(x.a.card) || !CARD.test(x.b.card) || !['a', 'b', 'draw'].includes(x.winner)) return no('not a duel receipt');
    if (x.self) { skipped++; continue; }
    const ra = r[x.a.card] ?? RATING, rb = r[x.b.card] ?? RATING, ea = expected(ra, rb), sa = x.winner === 'a' ? 1e6 : x.winner === 'draw' ? 5e5 : 0;
    const move = Math.round((K * (sa - ea)) / 1e6);
    r[x.a.card] = ra + move; r[x.b.card] = rb - move;
    played[x.a.card] = (played[x.a.card] || 0) + 1; played[x.b.card] = (played[x.b.card] || 0) + 1;
  }
  return { ok: true, ratings: r, played, skipped };
}
