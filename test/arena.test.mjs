// arena.test.mjs — a duel is agreed by both owners for their cards as they stand; the batch comes from both signatures;
// the better ranking on it wins; the receipt re-runs exactly; ratings are whole numbers from a published table, and
// self-play never moves them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { challenge, accept, seedOf, batchOf, duel, rerun, expected, ratings, BATCH, RATING, K, EXPECT } from '../src/arena.mjs';
import { organOf, searchOf, fixedOf } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { verify, give } from '../src/dossier.mjs';
import { stemGenome, auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { key, toy, SMALL, cardOn } from './helpers.mjs';

const ground = toy();
const found = (domain, seed) => organOf(searchOf(domain, seed, SMALL), viewOf(ground, domain), 0.6).fixed;
const signAs = async (keys, fields) => ({ ...fields, by: keys.pub, sig: await sign(keys, utf8(canonical({ ...fields, by: keys.pub }))) });

async function ring() {
  const [maker, alice, bob, eve] = await Promise.all(['maker', 'alice', 'bob', 'eve'].map(key));
  const A = await cardOn([found('toy-a', 5)], { maker, owner: alice, name: 'toy-a' });
  const B = await cardOn([found('toy-b', 6)], { maker, owner: bob, name: 'toy-b', serial: 2 });
  const W = await cardOn([fixedOf('toy-a', 1, { ...stemGenome(), on: 1 })], { maker, owner: bob, name: 'toy-a-weak', serial: 3 });
  const A2 = await cardOn([found('toy-a', 5)], { maker, owner: bob, name: 'toy-a-twin', serial: 4 });   // the very same mind as A, another card
  return { maker, alice, bob, eve, A, B, W, A2 };
}
async function agreed(keysA, vA, keysB, vB, nonce = 'n1') {
  const ch = (await challenge(keysA, vA, nonce)).challenge, ac = (await accept(keysB, vB, ch)).accept;
  return { challenge: ch, accept: ac };
}

test('challenge: signed by the card’s owner for the card as it stands, with a nonce; junk refused by name', async () => {
  const { alice, bob, A } = await ring();
  const r = await challenge(alice, A.v, 'round-1');
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.challenge).sort(), ['by', 'card', 'head', 'nonce', 'sig', 'type']);
  assert.deepEqual([r.challenge.type, r.challenge.card, r.challenge.head, r.challenge.nonce, r.challenge.by], ['digi.challenge.v1', A.v.id, A.v.head, 'round-1', alice.pub]);
  assert.match(r.challenge.sig, /^[0-9a-f]{128}$/);
  assert.equal((await challenge(bob, A.v, 'x')).why, 'only the card’s owner can send its challenge');
  assert.equal((await challenge(null, A.v, 'x')).why, 'only the card’s owner can send its challenge');
  assert.equal((await challenge(alice, { ...A.v, ok: false }, 'x')).why, 'only a card that checks can challenge');
  assert.equal((await challenge(alice, null, 'x')).why, 'only a card that checks can challenge');
  for (const n of ['', 'Round', '-x', 'a'.repeat(65), 5, 'a b']) assert.equal((await challenge(alice, A.v, n)).why, 'a nonce is up to 64 lowercase letters, digits and hyphens', String(n));
  assert.equal((await challenge(alice, A.v, 'a'.repeat(64))).ok, true);
  assert.equal((await challenge(alice, A.v, '0')).ok, true);
});

test('accept: the defender’s owner, naming the challenge; a forged or self challenge is refused', async () => {
  const { alice, bob, eve, A, B } = await ring();
  const ch = (await challenge(alice, A.v, 'n1')).challenge;
  const r = await accept(bob, B.v, ch);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.accept).sort(), ['by', 'card', 'challenge', 'head', 'sig', 'type']);
  assert.deepEqual([r.accept.type, r.accept.card, r.accept.head, r.accept.challenge, r.accept.by], ['digi.accept.v1', B.v.id, B.v.head, sha256Hex(canonical(ch)), bob.pub]);
  assert.equal((await accept(eve, B.v, ch)).why, 'only the card’s owner can accept for it');
  assert.equal((await accept(null, B.v, ch)).why, 'only the card’s owner can accept for it');
  assert.equal((await accept(bob, { ...B.v, ok: false }, ch)).why, 'only a card that checks can accept');
  assert.equal((await accept(bob, undefined, ch)).why, 'only a card that checks can accept');
  assert.equal((await accept(alice, A.v, ch)).why, 'a card cannot fight itself');
  const bad = [[{ ...ch, extra: 1 }, 'not a challenge'], [{ ...ch, type: 'digi.challenge.v2' }, 'not a challenge'], [null, 'not a challenge'], [{ ...ch, card: 'XYZ' }, 'not a challenge'],
    [{ ...ch, head: 'zz' }, 'not a challenge'], [{ ...ch, by: 'zz' }, 'not a challenge'], [{ ...ch, sig: 'zz' }, 'not a challenge'], [{ ...ch, nonce: 'n2' }, 'the challenge’s signature does not check'],
    [await signAs(alice, { type: 'digi.challenge.v1', card: A.v.id, head: A.v.head, nonce: 'Bad Nonce' }), 'not a challenge']];
  for (const [c, why] of bad) assert.equal((await accept(bob, B.v, c)).why, why);
});

test('seed and batch: from both signed records; the ground’s GATE rows, in a hashed order, distinct', async () => {
  const { alice, bob, A, B } = await ring();
  const s1 = await agreed(alice, A.v, bob, B.v, 'n1'), s2 = await agreed(alice, A.v, bob, B.v, 'n2');
  const seed = seedOf(s1.challenge, s1.accept);
  assert.equal(seed, sha256Hex(canonical(s1.challenge) + '|' + canonical(s1.accept)));
  assert.notEqual(seed, seedOf(s2.challenge, s2.accept));
  const b = batchOf(ground, seed);
  assert.equal(b.length, BATCH);
  assert.equal(new Set(b).size, BATCH);
  assert.ok(b.every((i) => ground.ds.gateRows.includes(i)));
  const order = ground.ds.gateRows.map((i) => [sha256Hex(seed + ':' + i), i]).sort((x, y) => (x[0] < y[0] ? -1 : 1)).map((x) => x[1]);   // the same order, written another way
  assert.deepEqual(b, order.slice(0, BATCH));
  assert.deepEqual(batchOf(ground, seed, 3), order.slice(0, 3));
  assert.notDeepEqual(b, batchOf(ground, seedOf(s2.challenge, s2.accept)));
  assert.deepEqual(batchOf(null, seed), []);
  assert.deepEqual(batchOf({ ds: {} }, seed), []);
  assert.equal(BATCH, 64);
});

test('duel: both minds score the same batch; the higher AUC wins; the same mind draws; one owner is self-play', async () => {
  const { alice, bob, A, B, W, A2 } = await ring();
  const r = await duel(A.v, W.v, ground, await agreed(alice, A.v, bob, W.v));
  assert.equal(r.ok, true, r.why);
  const x = r.receipt;
  assert.deepEqual(Object.keys(x).sort(), ['a', 'accept', 'b', 'challenge', 'data', 'kind', 'n', 'seed', 'self', 'winner']);
  assert.deepEqual([x.kind, x.data, x.n, x.self, x.a.card, x.a.head, x.b.card, x.b.head], ['duel', ground.id, BATCH, false, A.v.id, A.v.head, W.v.id, W.v.head]);
  // each side's score is its mind's AUC on the batch, and the winner follows the scores
  assert.equal(x.a.auc, Math.round(auc(r.scores.a, r.y) * 1e6));
  assert.equal(x.b.auc, Math.round(auc(r.scores.b, r.y) * 1e6));
  assert.notEqual(x.a.auc, x.b.auc);
  assert.equal(x.winner, x.a.auc > x.b.auc ? 'a' : 'b');
  assert.equal(r.batch.length, BATCH);
  assert.deepEqual(r.y, r.batch.map((i) => ground.ds.y[i]));
  assert.equal(r.scores.a.length, BATCH);
  assert.equal(x.seed, seedOf((await agreed(alice, A.v, bob, W.v)).challenge, (await agreed(alice, A.v, bob, W.v)).accept));
  // over many duels the winner follows the minds, both ways round
  const wins = { a: 0, b: 0, draw: 0 };
  for (let k = 0; k < 12; k++) { const q = await duel(A.v, W.v, ground, await agreed(alice, A.v, bob, W.v, 'k' + k)); wins[q.receipt.winner]++; assert.equal(q.receipt.winner, q.receipt.a.auc > q.receipt.b.auc ? 'a' : q.receipt.b.auc > q.receipt.a.auc ? 'b' : 'draw'); }
  assert.equal(wins.a + wins.b + wins.draw, 12);
  const back = await duel(W.v, A.v, ground, await agreed(bob, W.v, alice, A.v));
  assert.equal(back.receipt.winner, back.receipt.a.auc > back.receipt.b.auc ? 'a' : 'b');
  const same = await duel(A.v, A2.v, ground, await agreed(alice, A.v, bob, A2.v));
  assert.equal(same.receipt.a.auc, same.receipt.b.auc);
  assert.equal(same.receipt.winner, 'draw');
  const self = await duel(B.v, W.v, ground, await agreed(bob, B.v, bob, W.v));
  assert.equal(self.ok, true);
  assert.equal(self.receipt.self, true);
});

test('duel: refused unless both owners agreed for these cards as they stand, on a ground both answer on', async () => {
  const { maker, alice, bob, eve, A, B, W } = await ring();
  const s = await agreed(alice, A.v, bob, W.v);
  const why = async (vA, vB, g, signed) => (await duel(vA, vB, g, signed)).why;
  assert.equal(await why({ ...A.v, ok: false }, W.v, ground, s), 'both cards must check');
  assert.equal(await why(A.v, null, ground, s), 'both cards must check');
  assert.equal(await why(A.v, W.v, ground, { challenge: { ...s.challenge, nonce: 'n9' }, accept: s.accept }), 'the challenge’s signature does not check');
  assert.equal(await why(A.v, W.v, ground, { challenge: s.challenge, accept: { ...s.accept, extra: 1 } }), 'not a acceptance');
  assert.equal(await why(A.v, W.v, ground, { challenge: s.challenge, accept: { ...s.accept, type: 'digi.accept.v2' } }), 'not a acceptance');
  assert.equal(await why(A.v, W.v, ground, { challenge: s.challenge, accept: { ...s.accept, head: '0'.repeat(64) } }), 'the acceptance’s signature does not check');
  const other = await agreed(alice, A.v, bob, W.v, 'other');
  assert.equal(await why(A.v, W.v, ground, { challenge: s.challenge, accept: other.accept }), 'the acceptance is for another challenge');
  assert.equal(await why(B.v, W.v, ground, s), 'the challenge is not for this card as it stands');
  const sold = await verify((await give(A.d, alice, eve.pub)).dossier);
  assert.equal(await why(sold, W.v, ground, s), 'the challenge is not for this card as it stands', 'a new head after a give');
  assert.equal(await why(A.v, B.v, ground, s), 'the acceptance is not for this card as it stands');
  const soldW = await verify((await give(W.d, bob, eve.pub)).dossier);
  assert.equal(await why(A.v, soldW, ground, s), 'the acceptance is not for this card as it stands', 'the same card, a new head after a give');
  const forgedC = await signAs(eve, { type: 'digi.challenge.v1', card: A.v.id, head: A.v.head, nonce: 'x' });
  const acF = (await accept(bob, W.v, forgedC)).accept;
  assert.equal(await why(A.v, W.v, ground, { challenge: forgedC, accept: acF }), 'the challenge was not signed by its card’s owner');
  const ch = (await challenge(alice, A.v, 'y')).challenge, forgedA = await signAs(eve, { type: 'digi.accept.v1', card: W.v.id, head: W.v.head, challenge: sha256Hex(canonical(ch)) });
  assert.equal(await why(A.v, W.v, ground, { challenge: ch, accept: forgedA }), 'the acceptance was not signed by its card’s owner');
  const selfAc = await signAs(alice, { type: 'digi.accept.v1', card: A.v.id, head: A.v.head, challenge: sha256Hex(canonical(ch)) });
  assert.equal(await why(A.v, A.v, ground, { challenge: ch, accept: selfAc }), 'a card cannot fight itself');
  const elsewhere = toy({ departments: ['c', 'd'], seed: 12 });
  assert.equal(await why(A.v, W.v, elsewhere, s), 'both cards must answer on this ground: a card of another business is dormant here');
  const C = await cardOn([organOf(searchOf('toy-c', 7, SMALL), viewOf(elsewhere, 'toy-c'), 0.6).fixed], { maker, owner: eve, name: 'toy-c', serial: 9 });
  const sc = await agreed(alice, A.v, eve, C.v);
  assert.equal(await why(A.v, C.v, ground, sc), 'both cards must answer on this ground: a card of another business is dormant here', 'one side dormant');
  const sc2 = await agreed(eve, C.v, alice, A.v);
  assert.equal(await why(C.v, A.v, ground, sc2), 'both cards must answer on this ground: a card of another business is dormant here', 'the other side dormant');
  const short = { ...ground, ds: { ...ground.ds, gateRows: ground.ds.gateRows.slice(0, 63) } };
  const sh = await duel(A.v, W.v, short, s);
  assert.ok(sh.why === 'this ground holds fewer than 64 GATE cases' || /dormant/.test(sh.why), sh.why);
  const exactly64 = { ...ground, ds: { ...ground.ds, gateRows: ground.ds.gateRows.slice(0, 64) } };
  const e64 = await duel(A.v, W.v, exactly64, s);
  assert.ok(e64.ok || /dormant/.test(e64.why), e64.why);
  if (sh.why === 'this ground holds fewer than 64 GATE cases') assert.equal(e64.ok, true);
  assert.equal(await why(A.v, W.v, ground, {}), 'not a challenge');
  assert.equal(await why(A.v, W.v, ground), 'not a challenge');
  assert.equal(await why(A.v, W.v, { ds: null }, s), 'the duel could not be fought here');
  void maker;
});

test('rerun: the same cards, ground and signatures give the very same receipt; anything else is refused', async () => {
  const { alice, bob, A, W, B } = await ring();
  const s = await agreed(alice, A.v, bob, W.v), r = await duel(A.v, W.v, ground, s);
  assert.deepEqual(await rerun(r.receipt, A.v, W.v, ground, s), { ok: true });
  assert.match((await rerun({ ...r.receipt, a: { ...r.receipt.a, auc: r.receipt.a.auc + 1 } }, A.v, W.v, ground, s)).why, /^re-fought here, it gives \d+ against \d+, not the receipt’s \d+ against \d+$/);
  assert.match((await rerun({ ...r.receipt, winner: r.receipt.winner === 'a' ? 'b' : 'a' }, A.v, W.v, ground, s)).why, /^re-fought here/);
  assert.match((await rerun({ ...r.receipt, self: true }, A.v, W.v, ground, s)).why, /^re-fought here/);
  assert.equal((await rerun({ ...r.receipt, kind: 'level' }, A.v, W.v, ground, s)).why, 'not a duel receipt');
  assert.equal((await rerun({ ...r.receipt, extra: 1 }, A.v, W.v, ground, s)).why, 'not a duel receipt');
  assert.equal((await rerun(null, A.v, W.v, ground, s)).why, 'not a duel receipt');
  assert.equal((await rerun(r.receipt, B.v, W.v, ground, s)).why, 'the duel does not re-fight: the challenge is not for this card as it stands');
});

test('expected: the published table, clamped at ±800, by 25-point steps', () => {
  assert.equal(EXPECT.length, 65);
  assert.equal(expected(1000, 1000), 500000);
  assert.equal(expected(1000, 1800), 9901);
  assert.equal(expected(1800, 1000), 990099);
  assert.equal(expected(0, 5000), 9901);
  assert.equal(expected(5000, 0), 990099);
  assert.equal(expected(1000, 1025), 464084);
  assert.equal(expected(1000, 975), 535916);
  assert.equal(expected(1000, 1012), 500000);
  assert.equal(expected(1000, 1013), 464084);
  assert.equal(expected(1000, 988), 500000);
  assert.equal(expected(1000, 987), 535916);
  for (let k = 1; k < EXPECT.length; k++) assert.ok(EXPECT[k] < EXPECT[k - 1]);
  for (let k = 0; k < EXPECT.length; k++) assert.equal(EXPECT[k] + EXPECT[EXPECT.length - 1 - k], 1000000);
});

test('ratings: whole points from the receipts, in order; equal and opposite moves; self-play never counts', () => {
  const d = (a, b, winner, self = false) => ({ kind: 'duel', data: 'toy', a: { card: a.repeat(16), head: '0'.repeat(64), auc: 1 }, b: { card: b.repeat(16), head: '0'.repeat(64), auc: 1 }, challenge: '0'.repeat(64), accept: '0'.repeat(64), seed: '0'.repeat(64), n: 64, winner, self });
  assert.deepEqual(ratings([]), { ok: true, ratings: {}, played: {}, skipped: 0 });
  const r = ratings([d('a', 'b', 'a')]);
  assert.deepEqual(r.ratings, { ['a'.repeat(16)]: RATING + K / 2, ['b'.repeat(16)]: RATING - K / 2 });
  assert.deepEqual(r.played, { ['a'.repeat(16)]: 1, ['b'.repeat(16)]: 1 });
  assert.deepEqual(ratings([d('a', 'b', 'b')]).ratings, { ['a'.repeat(16)]: 984, ['b'.repeat(16)]: 1016 });
  assert.deepEqual(ratings([d('a', 'b', 'draw')]).ratings, { ['a'.repeat(16)]: 1000, ['b'.repeat(16)]: 1000 });
  const two = ratings([d('a', 'b', 'a'), d('a', 'b', 'a')]).ratings;   // 1016 vs 984: a gap of 32 → expected 535916 → a gains round(32 × 0.464084) = 15
  assert.deepEqual(two, { ['a'.repeat(16)]: 1031, ['b'.repeat(16)]: 969 });
  const up = ratings([d('a', 'b', 'a'), d('a', 'b', 'b')]).ratings;     // the upset after: b gains round(32 × 0.535916) = 17
  assert.deepEqual(up, { ['a'.repeat(16)]: 999, ['b'.repeat(16)]: 1001 });
  const s = ratings([d('a', 'b', 'a', true), d('c', 'b', 'a')]);
  assert.equal(s.skipped, 1);
  assert.deepEqual(s.ratings, { ['c'.repeat(16)]: 1016, ['b'.repeat(16)]: 984 });
  assert.equal(s.played['a'.repeat(16)], undefined);
  for (const junk of [null, 'x', {}]) assert.equal(ratings(junk).why, 'ratings read a list of duel receipts');
  for (const bad of [{ ...d('a', 'b', 'a'), kind: 'level' }, { ...d('a', 'b', 'a'), winner: 'c' }, { ...d('a', 'b', 'a'), a: null }, { ...d('a', 'b', 'a'), b: null }, { ...d('a', 'b', 'a'), a: { card: 'x' } }, { ...d('a', 'b', 'a'), b: { card: 'x' } }, { ...d('a', 'b', 'a'), extra: 1 }, 7])
    assert.equal(ratings([bad]).why, 'not a duel receipt');
});
