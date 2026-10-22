// shrink.test.mjs — a build teaches one small card: the teacher coupled on FIT only, its answers on FIT cut to the FIT
// rows' own share of yeses; a search on one department learns them; the student, re-expressed on the true answers, is
// judged on GATE and kept only if it beats its best source by MARGIN; every shrink re-checks, and deeply, the search.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shrinkSeed, teacherOf, taughtView, keptOf, shrink, checkShrink, studentOf, KEYS } from '../src/shrink.mjs';
import { recipeOf, measure, buildId } from '../src/build.mjs';
import { organOf, searchOf, fixedOf, seedsFor, atShare, scoreRow, mindOf, MARGIN, GROW } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { BAR } from '../src/raid.mjs';
import { coupleNonNegative, coupled } from '../vendor/dex-frontier/src/compose.mjs';
import { rng, stemGenome } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { key, toy, SMALL, cardOn } from './helpers.mjs';

const base = toy({ departments: ['a', 'b', 'c'] }), r = rng(5);
const n1 = base.ds.y.map(() => Math.round(r() * 100)), n2 = base.ds.y.map(() => Math.round(r() * 100));
const ground = { ...base, ds: { ...base.ds, cols: { ...base.ds.cols, n1, n2 }, features: [...base.ds.features, 'n1', 'n2'], silos: { ...base.ds.silos, n: ['n1', 'n2'] } } };
const found = (domain, seed) => organOf(searchOf(domain, seed, SMALL), viewOf(ground, domain), 0.6).fixed;
const [maker, alice, bob] = await Promise.all(['maker', 'alice', 'bob'].map(key));
const A = await cardOn([found('toy-a', 2)], { maker, owner: alice, name: 'toy-a' });
const B = await cardOn([found('toy-b', 10)], { maker, owner: bob, name: 'toy-b', serial: 2 });
const C = await cardOn([found('toy-c', 10)], { maker, owner: alice, name: 'toy-c', serial: 3 });
const A2 = await cardOn([found('toy-a', 5)], { maker, owner: alice, name: 'toy-a-two', serial: 4 });
const cards = [A.v, B.v, C.v], build = recipeOf(cards, ground).build, id = buildId(build), M = measure(build, cards, ground);
const view = viewOf(ground, 'toy-a'), yBefore = ground.ds.y.slice();
const S0 = (await shrink(alice, build, cards, ground, { k: 0 })).shrink, S1 = (await shrink(alice, build, cards, ground, { k: 1 })).shrink;
const unsigned = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig'));
const resign = async (keys, s, over) => { const f = { ...unsigned(s), ...over }; return { ...f, sig: await sign(keys, utf8(canonical(f))) }; };

test('the seed: the trainer’s key, the build, the department and the number fix it, so no two trainers repeat work', () => {
  assert.equal(shrinkSeed(alice.pub, id, 'toy-a', 3), seedsFor('digi-card/shrink/' + id + '/toy-a/' + alice.pub, 4)[3]);
  const s = shrinkSeed(alice.pub, id, 'toy-a', 0);
  for (const other of [shrinkSeed(bob.pub, id, 'toy-a', 0), shrinkSeed(alice.pub, '0'.repeat(64), 'toy-a', 0), shrinkSeed(alice.pub, id, 'toy-b', 0), shrinkSeed(alice.pub, id, 'toy-a', 1)]) assert.notEqual(other, s);
  assert.deepEqual(KEYS, ['best', 'build', 'by', 'data', 'domain', 'found', 'gate', 'k', 'kept', 'kind', 'recipe', 'sig', 'teacher']);
});

test('the teacher: the fielded parts coupled on FIT alone, a yes above the cut that keeps the FIT rows’ share of yeses', () => {
  const t = teacherOf(M.fielded, ground), fit = ground.ds.fitRows, y = fit.map((i) => ground.ds.y[i]);
  assert.deepEqual([...t.keys()], fit, 'an answer for every FIT row, and no other');
  const cols = M.fielded.map((f) => fit.map((i) => scoreRow(f.mind, ground, i))), c = coupleNonNegative(cols, y);
  const z = fit.map((_, j) => coupled(c, cols.map((col) => col[j]))), cut = atShare([...z].sort((a, b) => a - b), 1 - y.reduce((a, b) => a + b, 0) / y.length);
  assert.deepEqual([...t.values()], z.map((s) => (s > cut ? 1 : 0)));
  const yes = [...t.values()].filter((a) => a === 1).length, truth = y.filter((a) => a === 1).length;
  assert.ok(Math.abs(yes - truth) <= 5, 'it says yes about as often as the FIT rows do: ' + yes + ' against ' + truth);
  assert.ok(yes > 0 && yes < fit.length);
  assert.notDeepEqual([...t.values()], y, 'it is the teacher’s answers, not the true ones');
});

test('the taught view: the teacher’s answers on FIT rows, the true ones everywhere else, the ground untouched', () => {
  const t = teacherOf(M.fielded, ground), v = taughtView(view, t);
  for (const i of ground.ds.fitRows) assert.equal(v.y[i], t.get(i));
  for (const i of [...ground.ds.gateRows, ...ground.ds.testRows]) assert.equal(v.y[i], ground.ds.y[i]);
  assert.deepEqual(ground.ds.y, yBefore, 'the ground’s own answers are never touched');
  assert.deepEqual(view.y, yBefore);
  assert.deepEqual([v.name, v.features, v.cols, v.trainRows, v.heldRows, v.n], [view.name, view.features, view.cols, view.trainRows, view.heldRows, view.n]);
  assert.notEqual(v.y, view.y);
});

test('a shrink: the trainer’s search on the teacher’s answers, the student judged on the true GATE, kept by the rule', async () => {
  assert.deepEqual(Object.keys(S0).sort(), KEYS);
  const fnd = searchOf('toy-a', shrinkSeed(alice.pub, id, 'toy-a', 0), GROW), taught = organOf(fnd, taughtView(view, teacherOf(M.fielded, ground)), BAR / 1e6);
  const best = Math.max(...M.receipt.parts.filter((p) => p.joined).map((p) => p.gate));
  assert.deepEqual([S0.kind, S0.build, S0.data, S0.domain, S0.k, S0.found, S0.recipe, S0.by], ['shrink', id, ground.id, 'toy-a', 0, fnd, taught.fixed, alice.pub]);
  assert.equal(S0.domain, M.receipt.parts.find((p) => p.card === M.fielded[0].card).domains, 'by default, the best fielded part’s department');
  assert.deepEqual([S0.gate, S0.teacher, S0.best], [organOf(taught.fixed, view, 0.6).gate, M.receipt.gate, best]);
  assert.equal(best, mindOf(A.v, ground).gate);
  assert.deepEqual([S0.kept, S1.kept], [keptOf(S0.gate, S0.best), keptOf(S1.gate, S1.best)]);
  assert.equal(S0.kept, true, 'this student beats its best source by the margin');
  assert.equal(S1.kept, false, 'and this one does not');
  assert.ok(await verifySig(alice.pub, S0.sig, utf8(canonical(unsigned(S0)))));
  const intoB = await shrink(alice, build, cards, ground, { k: 0, domain: 'toy-b' });
  assert.deepEqual([intoB.ok, intoB.shrink.domain], [true, 'toy-b']);
  const given = organOf(fixedOf('toy-a', 1, stemGenome()), view, 0.6), handed = await shrink(bob, build, cards, ground, { k: 99999, organ: given });
  assert.deepEqual([handed.ok, handed.shrink.recipe, handed.shrink.k, handed.shrink.gate], [true, given.fixed, 99999, given.gate], 'a search run elsewhere is handed in');
  // two fielded parts teach; the best of them, whichever comes first by card id, gives the default department
  for (const pair of [[B, C], [C, A]]) {
    const b2 = recipeOf(pair.map((x) => x.v), ground).build, m2 = measure(b2, pair.map((x) => x.v), ground), two = await shrink(alice, b2, pair.map((x) => x.v), ground, { organ: organOf(fixedOf(m2.receipt.parts.find((p) => p.card === m2.fielded[0].card).domains, 1, stemGenome()), viewOf(ground, m2.receipt.parts.find((p) => p.card === m2.fielded[0].card).domains), 0.6) });
    assert.equal(m2.receipt.fielded, 2);
    assert.deepEqual([two.ok, two.shrink.domain], [true, mindOf(pair.map((x) => x.v).sort((p, q) => mindOf(q, ground).gate - mindOf(p, ground).gate)[0], ground).organs[0].domain]);
  }
});

test('the kept rule is exact: at least MARGIN above the best source', () => {
  assert.equal(MARGIN, 2000);
  for (const [g, b, k] of [[702000, 700000, true], [701999, 700000, false], [703000, 700000, true], [700000, 700000, false], [600000, 700000, false]]) assert.equal(keptOf(g, b), k, g + ' ' + b);
});

test('a shrink is refused, by name, without a key, a number, a build that measures, two fielded parts, a department or a search', async () => {
  const given = organOf(fixedOf('toy-a', 1, stemGenome()), view, 0.6);
  for (const k of [null, {}, { pub: 'x' }]) assert.deepEqual(await shrink(k, build, cards, ground, { organ: given }), { ok: false, why: 'a shrink is signed by an Ed25519 key' });
  for (const k of [-1, 1.5, 100000, '1', null]) assert.deepEqual(await shrink(alice, build, cards, ground, { k, organ: given }), { ok: false, why: 'a shrink’s number is a whole number from 0' });
  assert.equal((await shrink(alice, build, [A.v, B.v], ground, { organ: given })).why, 'the build does not measure here: the build names a card that is not here: ' + C.v.id);
  const lone = recipeOf([A.v, A2.v], ground).build;
  assert.deepEqual(await shrink(alice, lone, [A.v, A2.v], ground, { organ: given }), { ok: false, why: 'a build of one fielded part has nothing to teach that part does not know' });
  for (const d of ['toy-q', 7, null]) assert.deepEqual(await shrink(alice, build, cards, ground, { domain: d, organ: given }), { ok: false, why: 'this ground holds no ' + String(d) + ' department' });
  assert.deepEqual(await shrink(alice, build, cards, ground, { organ: { ok: false, why: 'it ran out of room' } }), { ok: false, why: 'the search could not run here: it ran out of room' });
  assert.deepEqual(await shrink(alice, build, cards, ground, { organ: { ok: false } }), { ok: false, why: 'the search could not run here: no organ' });
  const elsewhere = organOf(fixedOf('toy-b', 1, stemGenome()), viewOf(ground, 'toy-b'), 0.6);
  assert.deepEqual(await shrink(alice, build, cards, ground, { organ: elsewhere }), { ok: false, why: 'the student could not be expressed here: the recipe is for toy-b, not toy-a' });
  assert.deepEqual(await shrink(alice, build, cards, ground, { domain: { toString() { throw new Error('unsayable'); } } }), { ok: false, why: 'the build could not be shrunk here' });
});

test('check: a shrink re-checks here, shallow and deep; every changed field is refused by name', async () => {
  assert.deepEqual(await checkShrink(S0, build, cards, ground), { ok: true });
  assert.deepEqual(await checkShrink(S0, build, cards, ground, { deep: true }), { ok: true });
  assert.deepEqual(await checkShrink(S1, build, [...cards].reverse(), ground, { deep: true }), { ok: true }, 'a student not kept is a true shrink too');
  const shapes = [null, 'x', {}, { ...S0, extra: 1 }, { ...S0, kind: 'strike' }, { ...S0, by: 'x' }, { ...S0, sig: 'x' }, { ...S0, build: 'x' }, { ...S0, k: -1 }, { ...S0, k: 1.5 }, { ...S0, k: 100000 }, { ...S0, gate: 1.5 }, { ...S0, kept: 'yes' }];
  for (const s of shapes) assert.deepEqual(await checkShrink(s, build, cards, ground), { ok: false, why: 'not a shrink' });
  assert.equal((await checkShrink({ ...S0, gate: S0.gate + 1 }, build, cards, ground)).why, 'the shrink’s signature does not check');
  assert.equal((await checkShrink(S0, build, cards, { ...ground, id: 'toy:else' })).why, 'this device does not hold the data the shrink was made on');
  assert.equal((await checkShrink(S0, build, cards, null)).why, 'this device does not hold the data the shrink was made on');
  assert.equal((await checkShrink(S0, recipeOf([A.v, B.v], ground).build, [A.v, B.v], ground)).why, 'the shrink is of another build');
  assert.equal((await checkShrink(S0, build, [A.v, B.v], ground)).why, 'the build does not measure here: the build names a card that is not here: ' + C.v.id);
  const cases = [
    [{ teacher: S0.teacher + 1 }, 'the teacher scores ' + S0.teacher + ' here, not the ' + (S0.teacher + 1) + ' it says'],
    [{ best: S0.best + 1 }, 'its best source scores ' + S0.best + ' here, not the ' + (S0.best + 1) + ' it says'],
    [{ domain: 'toy-q' }, 'this ground holds no toy-q department'],
    [{ by: bob.pub }, 'the search it names is not this trainer’s shrink 0 of this build'],
    [{ k: 1 }, 'the search it names is not this trainer’s shrink 1 of this build'],
    [{ k: 99999 }, 'the search it names is not this trainer’s shrink 99999 of this build'],
    [{ recipe: fixedOf('toy-b', 1, stemGenome()) }, 'a shrink carries the student it found, fixed, for its own department'],
    [{ recipe: S0.found }, 'a shrink carries the student it found, fixed, for its own department'],
    [{ recipe: 'x' }, 'a shrink carries the student it found, fixed, for its own department'],
    [{ gate: S0.gate + 1 }, 'the student it carries scores ' + S0.gate + ' here, not the ' + (S0.gate + 1) + ' it says'],
    [{ kept: false }, 'a student is kept exactly when it beats its best source by 2000 millionths'],
  ];
  for (const [over, why] of cases) assert.deepEqual(await checkShrink(await resign(over.by === bob.pub ? bob : alice, S0, over), build, cards, ground), { ok: false, why }, why);
  // a student the search did not find, its numbers made consistent: shallow it passes, deep it does not
  const other = organOf(fixedOf('toy-a', 7, stemGenome()), view, 0.6), forged = await resign(alice, S0, { recipe: other.fixed, gate: other.gate, kept: keptOf(other.gate, S0.best) });
  assert.deepEqual(await checkShrink(forged, build, cards, ground), { ok: true });
  assert.deepEqual(await checkShrink(forged, build, cards, ground, { deep: true }), { ok: false, why: 'the search it names does not find the student it carries' });
  const cyclic = { ...build }; cyclic.parts = [cyclic];
  assert.deepEqual(await checkShrink(S0, cyclic, cards, ground), { ok: false, why: 'not a shrink' });
});

test('a kept student becomes a card’s genome, for its trainer to seal; one not kept, or under the bar, does not', () => {
  assert.deepEqual(studentOf(S0), { ok: true, genome: { name: 'toy-a', parents: [], gate: { auc: 0.6 }, organs: [S0.recipe] } });
  assert.deepEqual(studentOf(S1), { ok: false, why: 'only a kept student becomes a card' });
  for (const junk of [null, 'x', { ...S0, extra: 1 }, { ...S0, kind: 'strike' }, { ...S0, kept: 'true' }]) assert.deepEqual(studentOf(junk), { ok: false, why: 'only a kept student becomes a card' });
  assert.deepEqual(studentOf({ ...S0, gate: BAR - 1 }), { ok: false, why: 'a student becomes a card only once it clears the plain bar of 0.6 on GATE' });
  assert.equal(studentOf({ ...S0, gate: BAR }).ok, true);
});
