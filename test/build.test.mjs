// build.test.mjs — a build is a set of cards for a job; measured, its parts field as a party's do (each must answer and
// lead a coin, the best-proven part fields each set of departments, the rest benched by name), coupled and judged out of
// fold on GATE; a combo beats its best part by COMBO, an anti-combo falls short of it by COMBO; a receipt re-runs exactly,
// is proven by signed re-runs from two distinct keys, and the build book ranks what is proven.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobsOf, recipeOf, buildId, receiptId, nameOf, verdictOf, measure, rerun, signRerun, proofOf, bookOf, doesJob,
  BUILD, RERUN, MAX_PARTS, COMBO, PROVEN_BY, ZERO, KEYS, RECEIPT } from '../src/build.mjs';
import { oof } from '../src/mesh.mjs';
import { organOf, searchOf, fixedOf, mindOf, scoreRow } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { PARTY_MARGIN } from '../src/raid.mjs';
import { rng, stemGenome } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { key, toy, SMALL, cardOn } from './helpers.mjs';

// three departments that each carry the outcome, and one of pure noise
const base = toy({ departments: ['a', 'b', 'c'] }), r = rng(5);
const n1 = base.ds.y.map(() => Math.round(r() * 100)), n2 = base.ds.y.map(() => Math.round(r() * 100));
const ground = { ...base, ds: { ...base.ds, cols: { ...base.ds.cols, n1, n2 }, features: [...base.ds.features, 'n1', 'n2'], silos: { ...base.ds.silos, n: ['n1', 'n2'] } } };
const found = (domain, seed) => organOf(searchOf(domain, seed, SMALL), viewOf(ground, domain), 0.6).fixed;
const [maker, alice, bob, eve] = await Promise.all(['maker', 'alice', 'bob', 'eve'].map(key));
const A = await cardOn([found('toy-a', 2)], { maker, owner: alice, name: 'toy-a' });
const B = await cardOn([found('toy-b', 10)], { maker, owner: bob, name: 'toy-b', serial: 2 });
const C = await cardOn([found('toy-c', 10)], { maker, owner: alice, name: 'toy-c', serial: 3 });
const A2 = await cardOn([found('toy-a', 5)], { maker, owner: alice, name: 'toy-a-two', serial: 4 });
const N = await cardOn([fixedOf('toy-n', 1, { ...stemGenome(), on: 1, f0: 1 })], { maker, owner: alice, name: 'toy-n', serial: 5, bar: 0.5 });
const Z = await cardOn([fixedOf('toy-z', 1, stemGenome())], { maker, owner: alice, name: 'toy-z', serial: 8 });
const AB = await cardOn([found('toy-a', 2), found('toy-b', 10)], { maker, owner: alice, name: 'toy-ab', serial: 9 });
const COIN = await cardOn([fixedOf('toy-n', 1, { ...stemGenome(), on: 0 })], { maker, owner: alice, name: 'toy-coin', serial: 10, bar: 0.5 });
const rows = ground.ds.gateRows, y = rows.map((i) => ground.ds.y[i]), milli = (x) => Math.round(x * 1e6);
const colOf = (c) => rows.map((i) => scoreRow(mindOf(c.v, ground), ground, i));
const made = (cs, from) => recipeOf(cs.map((c) => c.v), ground, from).build;
const ABC = made([A, B, C]), all3 = [A.v, B.v, C.v], M3 = measure(ABC, all3, ground);
const resign = async (keys, x, over) => { const f = { ...Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'sig')), ...over }; return { ...f, sig: await sign(keys, utf8(canonical(f))) }; };

test('the constants, and the jobs: each business of an admission record at its world boss’s bar, by name', () => {
  assert.deepEqual([BUILD, RERUN, MAX_PARTS, COMBO, PROVEN_BY, ZERO], ['digi.build.v1', 'digi.rerun.v1', 6, 5000, 2, '0'.repeat(64)]);
  assert.deepEqual(KEYS, ['data', 'from', 'parts', 'type']);
  assert.deepEqual(RECEIPT, ['best', 'build', 'data', 'fielded', 'gate', 'kind', 'lift', 'n', 'name', 'parts', 'verdict']);
  const adm = { departments: [{ set: 'toy', domain: 'toy-a', gates: [700000], admitted: true }, { set: 'low', domain: 'low-a', gates: [580000], admitted: false }, { set: 'toy', domain: 'toy-b', gates: [650000], admitted: false }] };
  assert.deepEqual(jobsOf(adm), [{ set: 'low', bar: 600000 + PARTY_MARGIN, best: 580000 }, { set: 'toy', bar: 700000 + PARTY_MARGIN, best: 700000 }]);
  assert.deepEqual(jobsOf({ departments: [adm.departments[0], adm.departments[1]] }).map((j) => j.set), ['low', 'toy'], 'sorted by name whatever the order given');
  assert.deepEqual(jobsOf({ departments: [adm.departments[1], adm.departments[0]] }).map((j) => j.set), ['low', 'toy']);
  for (const junk of [null, {}, 'x', { departments: 7 }]) assert.deepEqual(jobsOf(junk), []);
});

test('a recipe: its parts in card-id order (the same cards make the same build), the build it forks, or a refusal', () => {
  const r1 = recipeOf([C.v, A.v, B.v], ground), r2 = recipeOf([B.v, C.v, A.v], ground);
  assert.equal(r1.ok, true);
  assert.deepEqual(Object.keys(r1.build).sort(), KEYS);
  assert.deepEqual([r1.build.type, r1.build.data, r1.build.from], [BUILD, ground.id, ZERO]);
  assert.deepEqual(r1.build.parts, [A, B, C].map((c) => ({ card: c.v.id, head: c.v.head })).sort((p, q) => (p.card < q.card ? -1 : 1)));
  assert.equal(buildId(r1.build), buildId(r2.build), 'the same cards in any order are the same build');
  assert.equal(buildId(r1.build), sha256Hex(canonical(r1.build)));
  const fork = recipeOf([A.v, B.v], ground, buildId(r1.build));
  assert.equal(fork.build.from, buildId(r1.build));
  assert.notEqual(buildId(fork.build), buildId(recipeOf([A.v, B.v], ground).build), 'a fork is its own build');
  const many = Array.from({ length: MAX_PARTS + 1 }, (_, k) => ({ ...A.v, id: k.toString(16).padStart(16, '0') }));
  assert.equal(recipeOf(many.slice(0, MAX_PARTS), ground).ok, true, 'MAX_PARTS cards make a build');
  const cases = [
    [[A.v, B.v], null, ZERO, 'a build is for a ground'], [[A.v, B.v], {}, ZERO, 'a build is for a ground'], [[A.v, B.v], { id: '' }, ZERO, 'a build is for a ground'], [[A.v, B.v], { id: 7 }, ZERO, 'a build is for a ground'],
    ['x', ground, ZERO, 'a build is two cards or more'], [[A.v], ground, ZERO, 'a build is two cards or more'], [many, ground, ZERO, 'a build is at most 6 cards'],
    [[A.v, B.v], ground, 'x', 'a build forks another build by its id, or none'], [[A.v, B.v], ground, 7, 'a build forks another build by its id, or none'],
    [[A.v, null], ground, ZERO, 'a part is a card that checks'], [[A.v, { ...B.v, ok: false }], ground, ZERO, 'a part is a card that checks'],
    [[A.v, { ...B.v, id: 'xyz' }], ground, ZERO, 'a part is a card that checks'], [[A.v, { ...B.v, id: undefined }], ground, ZERO, 'a part is a card that checks'],
    [[A.v, { ...B.v, head: 'nope' }], ground, ZERO, 'a part is a card that checks'], [[A.v, { ...B.v, head: undefined }], ground, ZERO, 'a part is a card that checks'],
    [[A.v, B.v, A.v], ground, ZERO, 'the same card is in the build twice'],
  ];
  for (const [cs, g, from, why] of cases) assert.deepEqual(recipeOf(cs, g, from), { ok: false, why }, why);
});

test('measure: the parts field as a party’s do, coupled and judged out of fold on GATE, each with what it is worth', () => {
  assert.equal(M3.ok, true);
  const R = M3.receipt;
  assert.deepEqual(Object.keys(R).sort(), RECEIPT);
  assert.deepEqual([R.kind, R.build, R.data, R.n, R.fielded], ['build', buildId(ABC), ground.id, rows.length, 3]);
  // fielded best GATE first (A, C, B here), the parts listed in the build's own order
  assert.deepEqual(R.parts.map((p) => p.card), ABC.parts.map((p) => p.card));
  assert.deepEqual(M3.fielded.map((f) => f.card), [A.v.id, C.v.id, B.v.id]);
  const cols = [A, C, B].map(colOf), gate = milli(oof(cols, y));
  assert.equal(R.gate, gate);
  const alone = cols.map((c) => milli(oof([c], y)));
  assert.equal(R.best, Math.max(...alone));
  assert.equal(R.lift, R.gate - R.best);
  for (const [k, c] of [A, C, B].entries()) {
    const p = R.parts.find((x) => x.card === c.v.id);
    assert.deepEqual([p.head, p.title, p.domains, p.gate, p.joined, p.why, p.alone], [c.v.head, ['Toy A', 'Toy C', 'Toy B'][k], ['toy-a', 'toy-c', 'toy-b'][k], mindOf(c.v, ground).gate, true, null, alone[k]]);
    assert.equal(p.contribution, gate - milli(oof(cols.filter((_, j) => j !== k), y)), 'a part’s worth: the build with it, less without it');
    assert.deepEqual(Object.keys(p).sort(), ['alone', 'card', 'contribution', 'domains', 'gate', 'head', 'joined', 'title', 'why']);
  }
  assert.equal(R.name, 'Toy A × Toy C × Toy B', 'named from its fielded parts, in the order they field');
  assert.equal(R.verdict, 'combo');
  assert.ok(R.lift >= COMBO);
  assert.equal(M3.fielded[0].mind.gate, mindOf(A.v, ground).gate);
  assert.deepEqual(M3.fielded[0].col, colOf(A));
  assert.deepEqual(measure(ABC, [C.v, B.v, A.v, Z.v], ground), M3, 'the cards in any order, and a card it does not name, change nothing');
});

test('measure: a part that is dormant, cannot lead a coin, or is out-proven is benched, named, and adds nothing', () => {
  const b = made([A, A2, B, N, Z]), m = measure(b, [A, A2, B, N, Z].map((c) => c.v), ground), part = (c) => m.receipt.parts.find((p) => p.card === c.v.id);
  assert.equal(m.ok, true);
  assert.deepEqual(m.fielded.map((f) => f.card), [A.v.id, B.v.id]);
  assert.deepEqual([part(A2).joined, part(A2).why, part(A2).gate, part(A2).alone, part(A2).contribution], [false, 'a better-proven part fields toy-a', mindOf(A2.v, ground).gate, null, null]);
  assert.equal(part(N).joined, false);
  assert.match(part(N).why, /^it does not lead a coin on GATE \(bound -?0\.\d+\)$/);
  assert.deepEqual([part(N).domains, part(N).gate], ['toy-n', mindOf(N.v, ground).gate]);
  assert.deepEqual([part(Z).joined, part(Z).why, part(Z).domains, part(Z).gate, part(Z).title], [false, 'it is dormant here: no department of its mind answers on this ground', '', null, 'Toy Z']);
  assert.deepEqual([m.receipt.fielded, m.receipt.gate, m.receipt.name], [2, milli(oof([colOf(A), colOf(B)], y)), 'Toy A × Toy B']);
  assert.equal(m.receipt.gate, measure(made([A, B]), [A.v, B.v], ground).receipt.gate, 'the benched add nothing');
  const flat = measure(made([A, B, COIN]), [A.v, B.v, COIN.v], ground).receipt.parts.find((p) => p.card === COIN.v.id);
  assert.deepEqual([flat.joined, flat.why, flat.gate], [false, 'it does not lead a coin on GATE (bound 0)', mindOf(COIN.v, ground).gate], 'a flat score leads a coin by exactly nothing');
  // two parts of the same departments and the same GATE: the lower card id fields, whichever way round they come
  for (const twin of ['0'.repeat(16), 'f'.repeat(16)]) {
    const copy = { ...A.v, id: twin }, t = measure(recipeOf([copy, A.v], ground).build, [A.v, copy], ground);
    assert.deepEqual(t.fielded.map((f) => f.card), [twin < A.v.id ? twin : A.v.id]);
    assert.equal(t.receipt.parts.find((p) => p.card === (twin < A.v.id ? A.v.id : twin)).why, 'a better-proven part fields toy-a');
  }
});

test('measure: one fielded part is plain, a build worse than its best part is an anti-combo, and the cut is exact', () => {
  const one = measure(made([A, A2]), [A.v, A2.v], ground);
  assert.deepEqual([one.receipt.fielded, one.receipt.lift, one.receipt.verdict, one.receipt.name], [1, 0, 'plain', 'Toy A']);
  assert.equal(one.receipt.parts.find((p) => p.card === A.v.id).contribution, one.receipt.gate - 500000, 'alone, a part is worth its lead over a coin');
  const anti = measure(made([A, AB]), [A.v, AB.v], ground);
  assert.deepEqual([anti.receipt.fielded, anti.receipt.verdict], [2, 'anti']);
  assert.ok(anti.receipt.lift <= -COMBO);
  assert.equal(anti.receipt.parts.find((p) => p.card === AB.v.id).domains, 'toy-a+toy-b');
  for (const [f, l, v] of [[2, COMBO, 'combo'], [2, COMBO - 1, 'plain'], [2, -COMBO, 'anti'], [2, -COMBO + 1, 'plain'], [2, 0, 'plain'], [1, COMBO, 'plain'], [1, -COMBO, 'plain'], [3, 99999, 'combo'], [3, -99999, 'anti'], [0, COMBO, 'plain']]) assert.equal(verdictOf(f, l), v, f + ' ' + l);
  assert.equal(nameOf(['a', 'b']), 'a × b');
  assert.equal(nameOf(['a']), 'a');
});

test('measure: what is not a build, on another ground, or without its cards as they stand, is refused by name', () => {
  const bad = (over) => ({ ...ABC, ...over });
  const rev = { ...ABC, parts: [...ABC.parts].reverse() }, dup = { ...ABC, parts: [ABC.parts[0], ABC.parts[0]] };
  const seven = { ...ABC, parts: Array.from({ length: MAX_PARTS + 1 }, (_, k) => ({ card: k.toString(16).padStart(16, '0'), head: ZERO })) };
  for (const b of [null, 'x', {}, bad({ type: 'digi.build.v2' }), bad({ from: 'x' }), bad({ data: 7 }), bad({ parts: 'x' }), bad({ parts: [ABC.parts[0]] }), seven, rev, dup,
    bad({ parts: [ABC.parts[0], { card: 'x', head: ZERO }] }), bad({ parts: [ABC.parts[0], { card: 'f'.repeat(16), head: 'x' }] }), bad({ parts: [ABC.parts[0], { card: 'f'.repeat(16), head: ZERO, x: 1 }] }),
    { ...ABC, extra: 1 }]) assert.deepEqual(measure(b, all3, ground), { ok: false, why: 'not a build' });
  const six = { ...ABC, parts: seven.parts.slice(0, MAX_PARTS) };
  assert.equal(measure(six, all3, ground).why, 'the build names a card that is not here: ' + six.parts[0].card, 'six parts is a build');
  assert.equal(measure(made([A, B]), [A.v, B.v], { ...ground, id: 'toy:other' }).why, 'this is not the ground the build is for');
  assert.equal(measure(ABC, all3, null).why, 'this is not the ground the build is for');
  assert.equal(measure(ABC, all3, { id: ground.id }).why, 'this is not the ground the build is for');
  assert.equal(measure(ABC, [A.v, B.v], ground).why, 'the build names a card that is not here: ' + C.v.id);
  assert.equal(measure(ABC, [A.v, B.v, { ...C.v, ok: false }], ground).why, 'the build names a card that is not here: ' + C.v.id);
  assert.equal(measure(ABC, 'x', ground).why, 'the build names a card that is not here: ' + ABC.parts[0].card);
  assert.equal(measure(ABC, [A.v, B.v, { ...C.v, head: 'e'.repeat(64) }], ground).why, 'a part has changed since the build was made: ' + C.v.id + ' (make the build again)');
  const dead = made([N, Z]);
  assert.equal(measure(dead, [N.v, Z.v], ground).ok, false);
  assert.match(measure(dead, [N.v, Z.v], ground).why, /^no part can field here: (it does not lead a coin on GATE \(bound -?0\.\d+\)|it is dormant here: no department of its mind answers on this ground); (it does not lead a coin on GATE \(bound -?0\.\d+\)|it is dormant here: no department of its mind answers on this ground)$/);
  assert.deepEqual(measure(ABC, all3, { id: ground.id, ds: { gateRows: null } }), { ok: false, why: 'the build could not be measured here' });
});

test('a re-run gives the very same receipt; a changed receipt, another build’s, or junk is refused, naming the numbers', () => {
  assert.deepEqual(rerun(M3.receipt, ABC, all3, ground), { ok: true });
  assert.deepEqual(rerun(M3.receipt, ABC, [...all3].reverse(), ground), { ok: true });
  const forged = { ...M3.receipt, gate: M3.receipt.gate + 1 };
  assert.deepEqual(rerun(forged, ABC, all3, ground), { ok: false, why: 'measured again here, it scores ' + M3.receipt.gate + ' against its best part’s ' + M3.receipt.best + ', not the receipt’s ' + forged.gate + ' against ' + forged.best });
  assert.equal(rerun({ ...M3.receipt, verdict: 'anti' }, ABC, all3, ground).ok, false);
  assert.equal(rerun({ ...M3.receipt, build: ZERO }, ABC, all3, ground).why, 'the receipt is for another build');
  assert.equal(rerun(M3.receipt, made([A, B]), [A.v, B.v], ground).why, 'the receipt is for another build');
  assert.equal(rerun(M3.receipt, 'x', all3, ground).why, 'the receipt is for another build');
  for (const junk of [null, 'x', {}, { ...M3.receipt, kind: 'duel' }, { ...M3.receipt, extra: 1 }]) assert.deepEqual(rerun(junk, ABC, all3, ground), { ok: false, why: 'not a build’s receipt' });
  assert.equal(rerun(M3.receipt, ABC, [A.v, B.v], ground).why, 'the build does not measure again: the build names a card that is not here: ' + C.v.id);
  const cyclic = { ...M3.receipt }; cyclic.parts = [cyclic];
  assert.deepEqual(rerun(cyclic, ABC, all3, ground), { ok: false, why: 'not a build’s receipt' });
});

test('a signed re-run: a key that measured the receipt again here says so; it cannot sign one that does not re-run', async () => {
  const s = await signRerun(bob, M3.receipt, ABC, all3, ground);
  assert.equal(s.ok, true);
  assert.deepEqual(Object.keys(s.rerun).sort(), ['by', 'receipt', 'sig', 'type']);
  assert.deepEqual([s.rerun.type, s.rerun.receipt, s.rerun.by], [RERUN, receiptId(M3.receipt), bob.pub]);
  assert.equal(receiptId(M3.receipt), sha256Hex(canonical(M3.receipt)));
  assert.match(s.rerun.sig, /^[0-9a-f]{128}$/);
  for (const k of [null, {}, { pub: 'x' }]) assert.deepEqual(await signRerun(k, M3.receipt, ABC, all3, ground), { ok: false, why: 'a re-run is signed by an Ed25519 key' });
  assert.equal((await signRerun(bob, { ...M3.receipt, gate: 1 }, ABC, all3, ground)).ok, false);
  assert.match((await signRerun(bob, { ...M3.receipt, gate: 1 }, ABC, all3, ground)).why, /^measured again here/);
});

test('proof: two distinct keys’ re-runs prove a receipt, the first found it; forged, other, repeated or junk re-runs are named', async () => {
  const rb = (await signRerun(bob, M3.receipt, ABC, all3, ground)).rerun, re = (await signRerun(eve, M3.receipt, ABC, all3, ground)).rerun, ra = (await signRerun(alice, M3.receipt, ABC, all3, ground)).rerun;
  const p = await proofOf(M3.receipt, ABC, all3, ground, [rb, re, ra]);
  assert.deepEqual(p, { ok: true, verdict: 'combo', proven: true, keys: [bob.pub, eve.pub, alice.pub], finder: bob.pub, refused: [] });
  assert.deepEqual(await proofOf(M3.receipt, ABC, all3, ground, [re]), { ok: true, verdict: 'combo', proven: false, keys: [eve.pub], finder: eve.pub, refused: [] });
  assert.deepEqual(await proofOf(M3.receipt, ABC, all3, ground, []), { ok: true, verdict: 'combo', proven: false, keys: [], finder: null, refused: [] });
  const two = await proofOf(M3.receipt, ABC, all3, ground, [rb, re]);
  assert.deepEqual([two.proven, two.keys.length], [true, PROVEN_BY], 'exactly PROVEN_BY keys prove');
  const other = (await signRerun(bob, measure(made([A, B]), [A.v, B.v], ground).receipt, made([A, B]), [A.v, B.v], ground)).rerun;
  const forged = { ...re, by: alice.pub }, renamed = await resign(eve, re, { receipt: ZERO });
  const junk = [null, 'x', { ...rb, type: 'digi.rerun.v2' }, { ...rb, by: 'x' }, { ...rb, receipt: 'x' }, { ...rb, sig: 'x' }, { ...rb, extra: 1 }, { type: RERUN, by: bob.pub, receipt: receiptId(M3.receipt) }];
  const q = await proofOf(M3.receipt, ABC, all3, ground, [rb, rb, forged, other, renamed, ...junk]);
  assert.deepEqual([q.proven, q.keys, q.finder], [false, [bob.pub], bob.pub]);
  assert.deepEqual(q.refused, ['the same key twice', 'a re-run whose signature does not check', 'a re-run of another receipt', 'a re-run of another receipt', ...junk.map(() => 'not a signed re-run')]);
  assert.deepEqual(await proofOf(M3.receipt, ABC, all3, ground, 'x'), { ok: false, why: 'a proof reads a list of signed re-runs' });
  assert.equal((await proofOf({ ...M3.receipt, gate: 1 }, ABC, all3, ground, [rb, re])).ok, false, 'a receipt that does not re-run here proves nothing');
  const anti = measure(made([A, AB]), [A.v, AB.v], ground);
  assert.equal((await proofOf(anti.receipt, made([A, AB]), [A.v, AB.v], ground, [])).verdict, 'anti');
});

test('the build book: per ground, proven combos by lift, proven anti-combos by drop, plain counted, the best GATE; each once', () => {
  const rec = (data, build, verdict, gate, lift, name) => ({ kind: 'build', build: build.repeat(64), data, parts: [], fielded: 2, gate, best: gate - lift, lift, n: 9, verdict, name });
  const pr = (r, keys = [bob.pub, eve.pub], proven = true) => ({ ok: true, verdict: r.verdict, proven, keys, finder: keys[0] || null, refused: [] });
  const c1 = rec('g:1', 'a', 'combo', 700000, 9000, 'X × Y'), c2 = rec('g:1', 'b', 'combo', 710000, 20000, 'Y × Z'), c3 = rec('g:1', 'c', 'combo', 690000, 9000, 'X × Z');
  const a1 = rec('g:1', 'd', 'anti', 600000, -6000, 'X × X2'), a2 = rec('g:1', 'e', 'anti', 640000, -9000, 'Y × Y2'), a3 = rec('g:1', '0', 'anti', 650000, -6000, 'Z × Z2'), p1 = rec('g:1', 'f', 'plain', 720000, 100, 'X'), o1 = rec('h:2', 'a', 'combo', 800000, 7000, 'P × Q');
  const entries = [{ receipt: c1, proof: pr(c1) }, { receipt: c2, proof: pr(c2, [eve.pub, bob.pub]) }, { receipt: c3, proof: pr(c3) }, { receipt: a1, proof: pr(a1) }, { receipt: a2, proof: pr(a2) }, { receipt: p1, proof: pr(p1) }, { receipt: a3, proof: pr(a3) }, { receipt: o1, proof: pr(o1) },
    { receipt: { ...c1, gate: 9.5e5 + 0.5 }, proof: pr(c1) }, { receipt: { ...c1, gate: '999999' }, proof: pr(c1) },
    { receipt: c1, proof: pr(c1) }, { receipt: rec('g:1', '9', 'combo', 999999, 99999, 'unproven'), proof: pr(c1, [bob.pub], false) },
    { receipt: rec('g:1', '8', 'combo', 999999, 99999, 'mismatch'), proof: { ...pr(c1), verdict: 'plain' } }, { receipt: rec('g:1', '7', 'combo', 999999, 99999, 'not ok'), proof: { ...pr(c1), ok: false } },
    { receipt: rec('g:1', '6', 'combo', 999999, 99999, 'no keys'), proof: { ...pr(c1), keys: 'x' } }, { receipt: { ...c1, kind: 'duel' }, proof: pr(c1) }, { receipt: { ...c1, extra: 1 }, proof: pr(c1) },
    { receipt: c1, proof: null }, null, 'x', { receipt: c1 }];
  const b = bookOf(entries);
  assert.equal(b.ok, true);
  assert.deepEqual(Object.keys(b.jobs).sort(), ['g:1', 'h:2']);
  const g = b.jobs['g:1'];
  assert.deepEqual(g.combos.map((x) => x.name), ['Y × Z', 'X × Y', 'X × Z'], 'the biggest lift first, ties to the lower build id');
  assert.deepEqual(g.combos[0], { id: receiptId(c2), build: 'b'.repeat(64), name: 'Y × Z', gate: 710000, best: 690000, lift: 20000, fielded: 2, finder: eve.pub, keys: 2 });
  assert.deepEqual(g.anti.map((x) => x.name), ['Y × Y2', 'Z × Z2', 'X × X2'], 'the biggest drop first, ties to the lower build id');
  assert.deepEqual([g.plain, g.best], [1, 720000]);
  assert.deepEqual(b.jobs['h:2'], { combos: [{ id: receiptId(o1), build: 'a'.repeat(64), name: 'P × Q', gate: 800000, best: 793000, lift: 7000, fielded: 2, finder: bob.pub, keys: 2 }], anti: [], plain: 0, best: 800000 });
  // two receipts of one build id, the same lift: they keep the order they came in
  const t1 = rec('t:1', 'a', 'combo', 700000, 9000, 'first'), t2 = { ...t1, name: 'second' }, u1 = rec('t:1', 'b', 'anti', 600000, -9000, 'first anti'), u2 = { ...u1, name: 'second anti' };
  const tie = bookOf([t1, t2, u1, u2].map((x) => ({ receipt: x, proof: pr(x) }))).jobs['t:1'];
  assert.deepEqual([tie.combos.map((x) => x.name), tie.anti.map((x) => x.name)], [['first', 'second'], ['first anti', 'second anti']]);
  assert.deepEqual(bookOf([]), { ok: true, jobs: {} });
  assert.deepEqual(bookOf('x'), { ok: false, why: 'a book reads proven receipts' });
  const cyclic = { ...c1 }; cyclic.parts = [cyclic];
  assert.deepEqual(bookOf([{ receipt: cyclic, proof: pr(c1) }]), { ok: true, jobs: {} }, 'an entry that cannot be read is not counted');
});

test('a job is done by a measured build on its business that reaches its bar', () => {
  const job = { set: 'toy', bar: 700000 }, r = (data, gate) => ({ data, gate });
  assert.equal(doesJob(r('toy:1', 700000), job), true);
  assert.equal(doesJob(r('toy:1', 700001), job), true);
  assert.equal(doesJob(r('toy:1', 699999), job), false);
  assert.equal(doesJob(r('bank:1', 800000), job), false);
  assert.equal(doesJob(r('toy', 800000), job), true);
  for (const [a, b] of [[null, job], [r('toy:1', 800000), null], [r(7, 800000), job], [r('toy:1', 7.5e5 + 0.5), job], [r('toy:1', '800000'), job], ['x', job]]) assert.equal(doesJob(a, b), false);
  assert.equal(doesJob(M3.receipt, { set: 'toy', bar: M3.receipt.gate }), true);
});
