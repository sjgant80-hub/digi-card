// breed.test.mjs — a child is born only if it beats both parents on GATE: crossed within a department, or carrying two
// departments coupled; it names both parents; anyone holding the ground can re-run the birth; everything else is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breed, birthCheck, MAX_TRIES } from '../src/breed.mjs';
import { organOf, mindOf, fixedOf, searchOf } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { verify, issue, give } from '../src/dossier.mjs';
import { stemGenome, decodeSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { open } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { key, toy, SMALL, cardOn } from './helpers.mjs';

const ground = toy();
const found = (domain, seed, grow = SMALL) => organOf(searchOf(domain, seed, grow), viewOf(ground, domain), 0.6);
async function family() {
  const [maker, alice, bob] = await Promise.all(['maker', 'alice', 'bob'].map(key));
  const on = (organs, o = {}) => cardOn(organs, { maker, owner: alice, ...o });
  return { maker, alice, bob, on };
}

test('within a department: the parents’ rules are crossed, and the first child that beats both is sealed, naming them', async () => {
  const { alice, on } = await family();
  const a = await on([found('toy-a', 3).fixed], { name: 'toy-a' }), b = await on([found('toy-a', 4).fixed], { name: 'toy-a', serial: 2 });
  const ga = mindOf(a.v, ground).gate, gb = mindOf(b.v, ground).gate;
  let r = null, seed = 0;
  while (!(r && r.born) && seed < 30) r = await breed(a.v, b.v, ground, alice, { seed: ++seed });
  assert.ok(r.born, 'some seed of thirty crosses a child better than both');
  assert.ok(r.gate > Math.max(ga, gb)); assert.deepEqual(r.parents, [ga, gb]);
  assert.ok(r.tries >= 1 && r.tries <= MAX_TRIES);
  const g = await open(r.genome);
  assert.deepEqual([g.ok, g.id, g.fields.name, g.fields.parents, g.fields.gate.auc, g.fields.by, g.fields.organs], [true, r.id, 'toy-a', [a.v.id, b.v.id], 0.6, alice.pub, r.organs]);
  assert.equal(decodeSeed(r.organs[0]).seed.grow, null, 'the child carries its mind fixed');
  const again = await breed(a.v, b.v, ground, alice, { seed });
  assert.deepEqual([again.genome, again.gate], [r.genome, r.gate], 'the same parents and seed breed the same child');
  const child = (await issue(r.genome, alice, { serial: 1, to: alice.pub, theme: 'blockcraft-v1', generation: 1 })).dossier, vc = await verify(child);
  assert.ok(vc.ok); assert.equal(mindOf(vc, ground).gate, r.gate);
  assert.deepEqual(birthCheck(vc, a.v, b.v, ground), { ok: true, child: r.gate, parents: [ga, gb] });
  assert.deepEqual(birthCheck(vc, b.v, a.v, ground), { ok: true, child: r.gate, parents: [gb, ga] });
  const named = await breed(a.v, b.v, ground, alice, { seed, name: 'toy-a-junior' });
  assert.equal((await open(named.genome)).fields.name, 'toy-a-junior');
  assert.equal((await breed(a.v, b.v, ground, alice, { seed, name: 'Junior' })).why, 'the child could not be sealed: the name is lower-case letters, digits and hyphens, at most 32');
  assert.equal((await breed(a.v, b.v, ground, alice, { seed, name: 5 })).why, 'the child could not be sealed: the name is lower-case letters, digits and hyphens, at most 32');
});

test('across two departments: the child carries both minds, coupled on GATE, and beats each parent alone', async () => {
  const { alice, on } = await family();
  const a = await on([found('toy-a', 5).fixed], { name: 'toy-a' }), b = await on([found('toy-b', 6).fixed], { name: 'toy-b', serial: 2 });
  const r = await breed(a.v, b.v, ground, alice, { seed: 1, name: 'toy-pair' });
  assert.ok(r.born, r.why);
  assert.deepEqual([r.tries, r.organs], [1, [a.v.genome.organs[0], b.v.genome.organs[0]]], 'nothing to cross: one child, the two minds as they are');
  const vc = await verify((await issue(r.genome, alice, { serial: 1, to: alice.pub, theme: 'synthwave-v1', generation: 1 })).dossier);
  const m = mindOf(vc, ground);
  assert.deepEqual([m.live, m.gate], [2, r.gate]); assert.ok(m.coupling);
  assert.ok(birthCheck(vc, a.v, b.v, ground).ok);
});

test('every way a breeding cannot be honest is refused, before anything is sealed', async () => {
  const { maker, alice, bob, on } = await family();
  const a = await on([found('toy-a', 5).fixed]), b = await on([found('toy-b', 6).fixed], { serial: 2, name: 'toy-b' });
  const cut = await on([found('toy-a', 5).fixed], { bar: 0.99, serial: 3 }), away = await on([fixedOf('credit-customer', 1, stemGenome())], { name: 'credit-customer', serial: 4 });
  const bobs = await verify((await give(b.d, alice, bob.pub)).dossier);
  const cases = {
    'a card that does not check': [[{ ok: false }, b.v, alice], 'only two cards that check can breed'],
    'nothing': [[null, b.v, alice], 'only two cards that check can breed'],
    'one card twice': [[a.v, a.v, alice], 'a card cannot breed with itself'],
    'someone else’s parent': [[a.v, bobs, alice], 'only the owner of both parents can breed them'],
    'a stranger breeding': [[a.v, b.v, bob], 'only the owner of both parents can breed them'],
    'no keys': [[a.v, b.v, null], 'only the owner of both parents can breed them'],
    'another ground': [[a.v, away.v, alice], 'these two cards do not both live on this ground: there are no shared cases to judge a child on'],
    'a parent cut here': [[a.v, cut.v, alice], 'both parents must have a live mind here (' + mindOf(a.v, ground).gate + ' and none)'],
  };
  for (const [what, [[x, y, k], why]] of Object.entries(cases)) assert.equal((await breed(x, y, ground, k)).why, why, what);
  for (const seed of [0, -2, 1.5, '1', null]) assert.equal((await breed(a.v, b.v, ground, alice, { seed })).why, 'a breeding starts from a whole-number seed of 1 or more', String(seed));
  for (const tries of [0, MAX_TRIES + 1, 2.5, '3']) assert.equal((await breed(a.v, b.v, ground, alice, { tries })).why, 'a breeding tries 1 to 12 crossings', String(tries));
  assert.ok((await breed(a.v, b.v, ground, alice, { tries: MAX_TRIES })).born, 'twelve is allowed');
  assert.notEqual((await breed(a.v, b.v, ground, alice, { tries: 1 })).why, 'a breeding tries 1 to 12 crossings', 'one is allowed');
  assert.equal(MAX_TRIES, 12);
});

test('no child is promised: when no crossing beats both parents, nothing is born, and the numbers say why', async () => {
  const { alice, on } = await family();
  // a ground where one rule is already perfect: no child can score more than parents who score 1
  const sure = toy({ seed: 2 });
  sure.ds.cols.a1 = sure.ds.y.map((y) => (y ? 100 : 0));
  const perfect = fixedOf('toy-a', 1, { ...stemGenome(), on: 1, q0: 0 });   // a1 above its lowest sixteenth: exactly the cases
  assert.equal(organOf(perfect, viewOf(sure, 'toy-a'), 0.6).gate, 1000000);
  const a = await on([perfect]), b = await on([perfect], { name: 'toy-a-twin', serial: 2 });
  const r = await breed(a.v, b.v, sure, alice, { seed: 1, tries: 3 });
  assert.equal(r.born, false);
  assert.match(r.why, /^no child of theirs beat both parents on GATE \(\d+ against 1000000, 3 tried\)$/);
  assert.equal(r.tries, 3);
  const other = await on([organOf(searchOf('toy-b', 6, SMALL), viewOf(sure, 'toy-b'), 0.6).fixed], { name: 'toy-b', serial: 3 });
  const cross = await breed(a.v, other.v, sure, alice, { seed: 1 });
  assert.equal(cross.born, false);
  assert.equal(cross.tries, 1, 'two departments: nothing to cross, so one child is tried');
  assert.ok(cross.why.endsWith(' against 1000000, 1 tried)'), cross.why);
  const strict = await on([perfect], { name: 'toy-a-strict', bar: 0.99, serial: 4 }), strict2 = await on([perfect], { name: 'toy-a-strict-two', bar: 0.99, serial: 5 });
  const whys = [];
  for (let s = 1; s <= 40; s++) whys.push((await breed(strict.v, strict2.v, sure, alice, { seed: s, tries: 1 })).why);
  assert.ok(whys.includes('no child of theirs beat both parents on GATE (no live child against 1000000, 1 tried)'), 'a crossing can grow nothing that clears a high bar');
  const nine = toy({ departments: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], seed: 3 });
  for (const d of 'abcdefghi') nine.ds.cols[d + '1'] = nine.ds.y.map((y, i) => y * 60 + ((i * 7 + d.charCodeAt(0)) % 50));   // every department sees the outcome
  const of = (d) => organOf(searchOf('toy-' + d, 2, SMALL), viewOf(nine, 'toy-' + d), 0.5).fixed;
  const many = await on(['a', 'b', 'c', 'd', 'e'].map(of), { name: 'toy-five', bar: 0.5 }), more = await on(['f', 'g', 'h', 'i'].map(of), { name: 'toy-four', bar: 0.5, serial: 2 });
  assert.equal((await breed(many.v, more.v, nine, alice)).why, 'a child carries at most 8 departments');
  const four = await on(['e', 'f', 'g', 'h'].map(of), { name: 'toy-four-b', bar: 0.5, serial: 3 });
  assert.notEqual((await breed(many.v, four.v, nine, alice)).why, 'a child carries at most 8 departments', 'eight departments is allowed');
});

test('birthCheck: the child must name both parents and beat them both, as they stood, on this ground', async () => {
  const { alice, on } = await family();
  const a = await on([found('toy-a', 5).fixed]), b = await on([found('toy-b', 6).fixed], { name: 'toy-b', serial: 2 });
  const better = mindOf(a.v, ground).gate >= mindOf(b.v, ground).gate ? a : b;
  const weak = await on(better.v.genome.organs, { name: 'toy-weak', parents: [a.v.id, b.v.id], serial: 3 });
  const orphan = await on([found('toy-a', 7).fixed], { name: 'toy-orphan', parents: [a.v.id], serial: 4 });
  const cutChild = await on([found('toy-a', 5).fixed], { name: 'toy-cut', parents: [a.v.id, b.v.id], bar: 0.99, serial: 5 });
  const m = (v) => mindOf(v, ground).gate;
  assert.equal(birthCheck(weak.v, a.v, b.v, ground).why, 'the child scores ' + mindOf(weak.v, ground).gate + ' on GATE here, not more than both parents (' + m(a.v) + ', ' + m(b.v) + ')');
  assert.equal(birthCheck(orphan.v, a.v, b.v, ground).why, 'the child does not name these two as its parents');
  assert.equal(birthCheck(weak.v, a.v, orphan.v, ground).why, 'the child does not name these two as its parents');
  assert.equal(birthCheck(weak.v, a.v, a.v, ground).why, 'the child does not name these two as its parents', 'one parent twice is not two');
  assert.equal(birthCheck(weak.v, b.v, b.v, ground).why, 'the child does not name these two as its parents');
  const cutA = await on([found('toy-a', 5).fixed], { name: 'toy-a-cut', bar: 0.99, serial: 7 }), cutB = await on([found('toy-b', 6).fixed], { name: 'toy-b-cut', bar: 0.99, serial: 8 });
  const ofCutA = await on([found('toy-a', 5).fixed], { name: 'toy-x', parents: [cutA.v.id, b.v.id], serial: 9 }), ofCutB = await on([found('toy-a', 5).fixed], { name: 'toy-y', parents: [a.v.id, cutB.v.id], serial: 10 });
  assert.equal(birthCheck(ofCutA.v, cutA.v, b.v, ground).why, 'the three minds are not all live on this ground');
  assert.equal(birthCheck(ofCutB.v, a.v, cutB.v, ground).why, 'the three minds are not all live on this ground');
  assert.equal(birthCheck(cutChild.v, a.v, b.v, ground).why, 'the three minds are not all live on this ground');
  assert.equal(birthCheck(weak.v, a.v, { ok: false }, ground).why, 'only cards that check can be compared');
  assert.equal(birthCheck(null, a.v, b.v, ground).why, 'only cards that check can be compared');
});
