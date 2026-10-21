// replay.test.mjs — a duel watched case by case: fought again to the very same receipt first, then each case's scores,
// calls and whether each was right; and one case read back, by the very rules that fired on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callsOf, replay, readBack } from '../src/replay.mjs';
import { equip, kitted, kitChallenge, kitAccept, kitDuel } from '../src/kit.mjs';
import { organOf, searchOf, scoreRow, answer, caseAt } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { key, toy, SMALL, cardOn } from './helpers.mjs';

const ground = toy({ departments: ['a', 'b', 'c'] });
const found = (domain, seed) => organOf(searchOf(domain, seed, SMALL), viewOf(ground, domain), 0.6).fixed;
const [maker, alice, bob] = await Promise.all(['maker', 'alice', 'bob'].map(key));
const A = await cardOn([found('toy-a', 2)], { maker, owner: alice, name: 'toy-a' });
const B = await cardOn([found('toy-b', 10)], { maker, owner: alice, name: 'toy-b', serial: 2 });
const Bb = await cardOn([found('toy-b', 10)], { maker, owner: bob, name: 'toy-b', serial: 7 });
const lo = (await equip(alice, A.v, [B.v])).loadout, sideA = { v: A.v, loadout: lo, nodes: [B.v] }, sideB = { v: Bb.v, loadout: null };
const ch = (await kitChallenge(alice, A.v, lo, 'r1')).challenge, ac = (await kitAccept(bob, Bb.v, null, ch)).accept, signed = { challenge: ch, accept: ac };
const fought = await kitDuel(sideA, sideB, ground, signed);

test('calls: yes for as many top-scored cases as the batch holds real yeses, ties to the earlier case', () => {
  assert.deepEqual(callsOf([0.1, 0.9, 0.5, 0.9], 2), [false, true, false, true]);
  assert.deepEqual(callsOf([0.5, 0.5, 0.5], 1), [true, false, false], 'a tie goes to the earlier case');
  assert.deepEqual(callsOf([0.3, 0.2], 0), [false, false]);
  assert.deepEqual(callsOf([0.3, 0.2], 5), [true, true]);
  for (const [s, n] of [[null, 1], [[1], -1], [[1], 1.5], ['x', 1]]) assert.deepEqual(callsOf(s, n), []);
});

test('replay: fought again to the very same receipt, then every case with both scores, calls and whether each was right', async () => {
  assert.equal(fought.ok, true);
  const r = await replay(fought.receipt, sideA, sideB, ground, signed);
  assert.equal(r.ok, true);
  assert.deepEqual(r.receipt, fought.receipt);
  assert.equal(r.frames.length, fought.batch.length);
  assert.deepEqual(r.frames.map((f) => f.row), fought.batch, 'in the batch’s own order');
  assert.deepEqual(r.frames.map((f) => [f.a.score, f.b.score]), fought.batch.map((_, k) => [fought.scores.a[k], fought.scores.b[k]]));
  const y = fought.y, yeses = y.filter((t) => t === 1).length;
  assert.deepEqual(r.frames.map((f) => f.y), y);
  assert.equal(r.frames.filter((f) => f.a.call).length, yeses, 'as many yeses as the batch holds');
  assert.equal(r.frames.filter((f) => f.b.call).length, yeses);
  assert.ok(r.frames.every((f) => f.a.right === (f.a.call === (f.y === 1)) && f.b.right === (f.b.call === (f.y === 1))));
  assert.deepEqual(r.right, { a: r.frames.filter((f) => f.a.right).length, b: r.frames.filter((f) => f.b.right).length });
  assert.equal(Math.round(auc(r.frames.map((f) => f.a.score), y) * 1e6), fought.receipt.a.auc, 'the frames give back the receipt’s own AUC');
  assert.equal(Math.round(auc(r.frames.map((f) => f.b.score), y) * 1e6), fought.receipt.b.auc);
});

test('replay: a receipt the duel does not give, a side that changed, or junk is refused by name', async () => {
  const off = { ...fought.receipt, a: { ...fought.receipt.a, auc: fought.receipt.a.auc + 1 } };
  assert.equal((await replay(off, sideA, sideB, ground, signed)).why, 're-fought here, it gives ' + fought.receipt.a.auc + ' against ' + fought.receipt.b.auc + ', not the receipt’s ' + off.a.auc + ' against ' + off.b.auc);
  assert.equal((await replay(fought.receipt, sideA, sideB, ground, { challenge: null, accept: ac })).why, 'the duel does not re-fight: not a challenge');
  for (const bad of [null, {}, { kind: 'x' }]) assert.equal((await replay(bad, sideA, sideB, ground, signed)).why, 'not a duel receipt');
  assert.equal((await replay(fought.receipt, sideA, sideB, null, signed)).ok, false);
});

test('read-back: one case opened — each fielded mind’s rules that fired on it, and the score they sum to', () => {
  const k = kitted(A.v, [B.v], ground), row = fought.batch[0], back = readBack(k, ground, row);
  assert.equal(back.ok, true);
  assert.equal(back.minds.length, k.fielded.length);
  back.minds.forEach((m, j) => {
    const f = k.fielded[j], a = answer(f.mind, caseAt(ground, row));
    assert.equal(m.card, f.card);
    assert.equal(m.score, a.score);
    assert.equal(m.score, scoreRow(f.mind, ground, row), 'the very score the duel used for that mind');
    assert.deepEqual(m.fired, a.fired.map((r) => ({ domain: r.domain, feat: r.feat, op: r.op, v: r.v, w: r.w })));
    assert.equal(Math.round(m.fired.reduce((s, r) => s + r.w, 0) * 1e6) / 1e6, m.score, 'the fired rules sum to the score');
  });
  const dormant = readBack({ fielded: [{ card: 'x', mind: { organs: [] } }] }, ground, row);
  assert.deepEqual(dormant.minds[0].fired, []);
  assert.equal(dormant.minds[0].score, null);
  for (const [kk, rr] of [[null, row], [k, -1], [k, ground.ds.n], [k, 1.5], [{}, row]]) assert.equal(readBack(kk, ground, rr).why, 'read back a fielded kit on one of its ground’s cases');
  assert.equal(readBack(k, null, row).ok, false);
  assert.equal(readBack(k, ground, 0).ok, true, 'the first case is a case');
  assert.equal(readBack(k, ground, ground.ds.n - 1).ok, true, 'and so is the last');
});
