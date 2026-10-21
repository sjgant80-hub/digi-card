// mind.test.mjs — a card's mind is expressed on the ground it works on, bit for bit the same wherever it is expressed;
// it answers only where it has earned to; a level is a re-runnable gain; and every forged level is refused by its number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { organOf, mindOf, answer, scoreRow, caseAt, level, rerun, recipesOf, fixedOf, searchOf, seedsFor, atShare, lifts, MARGIN, GROW, LEVEL_KEYS } from '../src/mind.mjs';
import { scoreRow as seedScore, round6 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { openSet, viewOf, ownGround } from '../src/data.mjs';
import { issue, addReceipt, reskin, verify } from '../src/dossier.mjs';
import { seal } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { rng, stemGenome, decodeSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { fromSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';

const key = (s) => fromSeed(sha256Bytes(utf8('digi-card/test/' + s)));
const SMALL = { population: 8, elites: 2, generations: 4 };

/** a small real-shaped ground: two departments of one table, the outcome driven by a1 and b1 (and noise) */
function toy(n = 600) {
  const r = rng(11), cols = { a1: [], a2: [], b1: [], b2: [] }, y = [];
  for (let i = 0; i < n; i++) {
    const a1 = Math.round(r() * 100), a2 = Math.round(r() * 100), b1 = Math.round(r() * 100), b2 = Math.round(r() * 100);
    cols.a1.push(a1); cols.a2.push(a2); cols.b1.push(b1); cols.b2.push(b2);
    y.push(a1 + b1 + r() * 60 > 120 ? 1 : 0);
  }
  const all = Array.from({ length: n }, (_, i) => i);
  const ds = { ok: true, name: 'toy', features: ['a1', 'a2', 'b1', 'b2'], cols, y, n, fitRows: all.filter((i) => i % 4 < 2), gateRows: all.filter((i) => i % 4 === 2), testRows: all.filter((i) => i % 4 === 3), silos: { a: ['a1', 'a2'], b: ['b1', 'b2'] } };
  return { ok: true, id: 'toy:00000000000000aa', set: 'toy', ds };
}
const ground = toy();
const card = async (organs, { bar = 0.6, name = 'toy-a', parents = [] } = {}) => {
  const maker = await key('maker'), alice = await key('alice');
  const g = (await seal({ name, parents, gate: { auc: bar }, organs }, maker)).text;
  const d = (await issue(g, maker, { serial: 1, to: alice.pub, theme: 'synthwave-v1' })).dossier;
  return { d, v: await verify(d), alice };
};
const stem = (domain) => fixedOf(domain, 1, stemGenome());

test('a recipe is expressed the same way every time: a search’s fixed form re-expresses to the very same mind, in milliseconds', () => {
  const view = viewOf(ground, 'toy-a');
  const searched = organOf(searchOf('toy-a', 5, SMALL), view, 0.6), again = organOf(searched.fixed, view, 0.6);
  assert.ok(searched.ok && again.ok);
  assert.deepEqual([again.gate, again.body, again.state, again.fixed], [searched.gate, searched.body, searched.state, searched.fixed]);
  assert.equal(again.recipe, searched.fixed); assert.notEqual(searched.recipe, searched.fixed);
  assert.ok(searched.body.rules.length >= 1 && searched.body.rules.length <= 6);
  assert.ok(searched.body.rules.every((r) => ['a1', 'a2'].includes(r.feat)), 'a department reads only its own columns');
  assert.equal(searched.domain, 'toy-a');
  assert.ok(Number.isInteger(searched.gate) && searched.gate > 600000, 'millionths, and the planted signal is found');
  assert.equal(organOf(searched.fixed, view, searched.gate / 1e6).state, 'live', 'the bar is cleared at exactly the bar');
  assert.equal(organOf(searched.fixed, view, (searched.gate + 1) / 1e6).state, 'cut', 'one millionth short is cut');
  assert.equal(organOf(searchOf('toy-b', 5, SMALL), view, 0.6).why, 'the recipe is for toy-b, not toy-a');
  assert.equal(organOf(searchOf('toy-a', 5, SMALL), null, 0.6).why, 'the recipe is for toy-a, not nothing');
  assert.equal(organOf('not a seed', view, 0.6).why, 'the recipe is not a seed: not a seed (missing ◊ seed.v1 tag)');
  assert.equal(organOf(searchOf('toy-a', 5, SMALL), { ...view, trainRows: [] }, 0.6).why, 'it could not grow here: dataset has no train/held rows');
  assert.deepEqual(seedsFor('ab', 3), seedsFor('ab', 3)); assert.notDeepEqual(seedsFor('ab', 2), seedsFor('ac', 2));
  assert.ok(seedsFor('ab', 50).every((s) => Number.isInteger(s) && s >= 1 && s <= 999999937));
  assert.deepEqual(seedsFor('ab', 2), [0, 1].map((i) => (parseInt(sha256Hex('ab:' + i).slice(0, 8), 16) % 999999937) + 1));
  assert.deepEqual([atShare([1, 2, 3], 0), atShare([1, 2, 3], 0.5), atShare([1, 2, 3], 1), atShare([1, 2, 3, 4], 0.75), atShare([7], 0.99)], [1, 2, 3, 4, 7]);
  assert.deepEqual([lifts(0, 2000), lifts(0, 1999), lifts(5, 2005), lifts(5, 2004), MARGIN], [true, false, true, false, 2000]);
  assert.deepEqual([searchOf('toy-a', 5).split(' ').slice(0, 5), GROW], [['◊', 'seed.v1', 'toy-a', '5', 'g:40.8.30'], { population: 40, elites: 8, generations: 30 }]);
});

test('the mind on a ground: live, cut at its bar, or dormant where the ground has no such department', async () => {
  const found = organOf(searchOf('toy-a', 5, SMALL), viewOf(ground, 'toy-a'), 0.6).fixed;
  const { v } = await card([found]), m = mindOf(v, ground);
  assert.deepEqual([m.live, m.organs[0].state, m.gate, m.coupling], [1, 'live', m.organs[0].gate, null]);
  assert.equal(m.threshold, m.organs[0].body.threshold);
  const cut = mindOf((await card([found], { bar: 0.99 })).v, ground);
  assert.deepEqual([cut.live, cut.gate, cut.threshold, cut.organs[0].state], [0, null, null, 'cut']);
  const away = mindOf((await card([stem('credit-customer')], { name: 'credit-customer' })).v, ground);
  assert.deepEqual(away.organs.map((o) => [o.state, o.why]), [['dormant', 'this ground holds no credit-customer records']]);
  assert.equal(viewOf(ground, 'toy-constructor'), null); assert.equal(viewOf(ground, 'toyx-a'), null); assert.equal(viewOf(ground, 5), null);
  const broken = mindOf((await card([found])).v, { ...ground, ds: { ...ground.ds, fitRows: [] } });
  assert.deepEqual([broken.organs[0].state, broken.organs[0].why], ['cut', 'it could not grow here: dataset has no train/held rows']);
});

test('a mind of two departments answers through a coupling learned on GATE, judged out of fold there', async () => {
  const fa = organOf(searchOf('toy-a', 5, SMALL), viewOf(ground, 'toy-a'), 0.6), fb = organOf(searchOf('toy-b', 6, SMALL), viewOf(ground, 'toy-b'), 0.6);
  const { v } = await card([fa.fixed, fb.fixed], { name: 'toy-pair' }), m = mindOf(v, ground);
  assert.equal(m.live, 2); assert.ok(m.coupling && m.coupling.weights.length === 3);
  assert.ok(m.gate > Math.max(fa.gate, fb.gate), 'two departments that each see half the signal answer better together');
  for (const i of ground.ds.testRows.slice(0, 25)) {
    const a = answer(m, caseAt(ground, i));
    assert.equal(a.verdict, 'VERIFIED'); assert.equal(a.score, Math.round(scoreRow(m, ground, i) * 1e6) / 1e6);
    assert.equal(a.label, a.score > m.threshold ? 1 : 0);
    assert.ok(a.fired.every((r) => ['toy-a', 'toy-b'].includes(r.domain)));
  }
  const one = mindOf((await card([fa.fixed, stem('credit-customer')], { name: 'toy-half' })).v, ground);
  assert.deepEqual([one.live, one.coupling, one.gate], [1, null, fa.gate], 'a dormant department is left out, never guessed');
});

test('answer: VERIFIED with the rules that fired, or ABSTAIN with the reason — never a guess', async () => {
  const fa = organOf(searchOf('toy-a', 5, SMALL), viewOf(ground, 'toy-a'), 0.6), m = mindOf((await card([fa.fixed])).v, ground);
  const i = ground.ds.testRows[3], x = caseAt(ground, i), a = answer(m, x);
  assert.deepEqual(Object.keys(a).sort(), ['fired', 'label', 'score', 'threshold', 'verdict']);
  assert.equal(a.score, scoreRow(m, ground, i));
  assert.deepEqual(a.fired, fa.body.rules.filter((r) => (r.op === '>' ? x[r.feat] > r.v : x[r.feat] <= r.v)).map((r) => ({ domain: 'toy-a', ...r })));
  const read = [...new Set(fa.body.rules.map((r) => r.feat))];
  assert.equal(answer(m, { ...x, [read[0]]: undefined }).why, 'the case lacks ' + read[0] + ', which its rules read');
  assert.equal(answer(m, { ...x, [read[0]]: NaN }).verdict, 'ABSTAIN');
  assert.equal(answer(m, { ...x, [read[0]]: '5' }).verdict, 'ABSTAIN', 'a measurement is a number');
  const view = viewOf(ground, 'toy-a');
  for (const t of [...ground.ds.testRows, ...ground.ds.fitRows]) assert.equal(scoreRow(m, ground, t), round6(seedScore({ rules: fa.body.rules }, view, t)), 'the ribosome’s own scoring, row ' + t);
  assert.ok(fa.body.rules.some((r) => r.op === '>' && ground.ds.testRows.some((t) => view.cols[r.feat][t] === r.v)), 'some case sits exactly on a threshold');
  assert.equal(answer(m, null).why, 'there is no case to read');
  assert.equal(answer(m, 'x').why, 'there is no case to read');
  assert.equal(answer(mindOf((await card([fa.fixed], { bar: 0.99 })).v, ground), x).why, 'no department of its mind cleared its gate here: toy-a cut');
  assert.equal(answer({ organs: [] }, x).why, 'it has no mind');
  assert.equal(scoreRow(mindOf((await card([fa.fixed], { bar: 0.99 })).v, ground), ground, i), null);
  const labels = ground.ds.testRows.map((t) => answer(m, caseAt(ground, t)));
  assert.deepEqual([...new Set(labels.map((l) => l.label))].sort(), [0, 1], 'it calls both ways');
  assert.ok(labels.every((l) => l.label === (l.score > m.threshold ? 1 : 0)), 'yes exactly when the score is over its operating point');
});

test('a level: a search that beats the mind by MARGIN on GATE is offered, with both numbers; anything less is refused with them', async () => {
  const { v } = await card([stem('toy-a')]), view = viewOf(ground, 'toy-a');
  const before = organOf(stem('toy-a'), view, 0.6), r = level(v, ground, { domain: 'toy-a', seed: 5, grow: SMALL });
  assert.ok(r.ok, r.why);
  const after = organOf(searchOf('toy-a', 5, SMALL), view, 0.6);
  assert.deepEqual(r.receipt, { kind: 'level', data: 'toy:00000000000000aa', domain: 'toy-a', recipe: after.fixed, found: searchOf('toy-a', 5, SMALL), before: before.gate, after: after.gate });
  assert.deepEqual(Object.keys(r.receipt).sort(), LEVEL_KEYS);
  assert.deepEqual([r.before, r.after], [before.gate, after.gate]);
  const { v: strong } = await card([after.fixed]);
  assert.equal(level(strong, ground, { domain: 'toy-a', seed: 5, grow: SMALL }).why, 'the search found ' + (after.gate / 1e6).toFixed(6) + ' on GATE against the mind’s ' + (after.gate / 1e6).toFixed(6) + ': a level needs a lift of at least 0.002');
  assert.equal(level(v, ground, { domain: 'toy-b', seed: 5 }).why, 'its mind has no toy-b department');
  assert.equal(level(v, ground).why, 'its mind has no undefined department');
  for (const seed of [0, -1, 1.5, '3', null]) assert.equal(level(v, ground, { domain: 'toy-a', seed }).why, 'a search starts from a whole-number seed of 1 or more', String(seed));
  const one = level(v, ground, { domain: 'toy-a', seed: 1, grow: SMALL });
  assert.ok(one.ok || one.why.startsWith('the search found '), 'seed 1 is a seed: ' + one.why);
  assert.equal(level(v, { ...ground, ds: { ...ground.ds, silos: { b: ['b1'] } } }, { domain: 'toy-a', seed: 5 }).why, 'this ground holds no toy-a records');
  assert.equal(level(v, { ...ground, ds: { ...ground.ds, fitRows: [] } }, { domain: 'toy-a', seed: 5, grow: SMALL }).why, 'its mind could not be expressed here: it could not grow here: dataset has no train/held rows');
  assert.equal(level(v, ground, { domain: 'toy-a', seed: 5, grow: { population: 2, elites: 2, generations: 1 } }).why, 'the search could not run here: the recipe is not a seed: elites must be fewer than the population');
  const exact = { ...SMALL };
  const edge = (await card([fixedOf('toy-a', 1, stemGenome())])).v;
  const lift = organOf(searchOf('toy-a', 5, exact), view, 0.6).gate - organOf(stem('toy-a'), view, 0.6).gate;
  assert.ok(lift >= MARGIN, 'the search lifts the stem mind by a level here (' + lift + ')');
  assert.ok(level(edge, ground, { domain: 'toy-a', seed: 5, grow: exact }).ok);
});

test('rerun: a level is re-expressed on the same bytes and must give the very same numbers; every forgery is refused by its number', async () => {
  const { d, v, alice } = await card([stem('toy-a')]), view = viewOf(ground, 'toy-a');
  const l1 = level(v, ground, { domain: 'toy-a', seed: 5, grow: SMALL });
  const d1 = (await addReceipt(d, alice, l1.receipt)).dossier, v1 = await verify(d1);
  assert.deepEqual(rerun(l1.receipt, v1, 1, d1, { ground }), { ok: true });
  const busy = (await addReceipt((await addReceipt((await reskin(d, alice, 'blockcraft-v1')).dossier, alice, { kind: 'note', level: 1 })).dossier, alice, l1.receipt)).dossier;
  assert.deepEqual(rerun(l1.receipt, await verify(busy), 3, busy, { ground }), { ok: true }, 'a skin and a note before it are not levels');
  assert.deepEqual(rerun(l1.receipt, v1, 1, d1, { ground, deep: true }), { ok: true }, 'deep: the search it names finds the mind it carries');
  const now = recipesOf(v1);
  assert.deepEqual(now, [{ domain: 'toy-a', recipe: l1.receipt.recipe }]);
  assert.deepEqual(recipesOf(v1, 0), [{ domain: 'toy-a', recipe: stem('toy-a') }]);
  const better = [7, 9, 13, 21, 34, 55].map((seed) => ({ seed, l: level(v1, ground, { domain: 'toy-a', seed, grow: { population: 16, elites: 4, generations: 8 } }) })).find((x) => x.l.ok);
  assert.ok(better, 'some bigger search beats the first level');
  const l2 = better.l, d2 = (await addReceipt(d1, alice, l2.receipt)).dossier, v2 = await verify(d2);
  assert.equal(l2.receipt.before, l1.receipt.after, 'the second level starts where the first ended');
  assert.deepEqual([rerun(l1.receipt, v2, 1, d2, { ground }), rerun(l2.receipt, v2, 2, d2, { ground })], [{ ok: true }, { ok: true }]);
  const R = l1.receipt, at = (r) => rerun(r, v1, 1, d1, { ground });
  const forged = {
    'a raised score': [{ ...R, after: R.after + 1 }, 'the mind this level carries scores ' + R.after + ' here, not the ' + (R.after + 1) + ' its receipt says'],
    'a lowered start': [{ ...R, before: R.before - 1 }, 'the mind before this level scores ' + R.before + ' here, not the ' + (R.before - 1) + ' its receipt says'],
    'another ground': [{ ...R, data: 'toy:00000000000000bb' }, 'this device does not hold the data this level was earned on (toy:00000000000000bb)'],
    'a department it lacks': [{ ...R, domain: 'toy-b' }, 'its mind has no toy-b department'],
    'a search for a recipe': [{ ...R, recipe: R.found }, 'a level carries the mind it found, fixed, for its own department'],
    'a recipe for another department': [{ ...R, recipe: stem('toy-b') }, 'a level carries the mind it found, fixed, for its own department'],
    'a recipe that is junk': [{ ...R, recipe: 'x' }, 'a level carries the mind it found, fixed, for its own department'],
    'a fixed mind for the search': [{ ...R, found: R.recipe }, 'a level names the search that found it, for its own department'],
    'a search for another department': [{ ...R, found: searchOf('toy-b', 5, SMALL) }, 'a level names the search that found it, for its own department'],
    'a search that is junk': [{ ...R, found: 'x' }, 'a level names the search that found it, for its own department'],
    'an extra field': [{ ...R, note: 1 }, 'it is not a level receipt'],
    'another kind': [{ ...R, kind: 'drop' }, 'it is not a level receipt'],
    'a list': [[R], 'it is not a level receipt'],
    'no lift': [{ ...R, recipe: stem('toy-a'), after: R.before }, 'a level lifts the mind by at least 2000 millionths on GATE; this one lifts it by 0'],
  };
  for (const [what, [r, why]] of Object.entries(forged)) assert.equal(at(r).why, why, what);
  assert.equal(rerun(R, v1, 1, d1, {}).why, 'this device does not hold the data this level was earned on (toy:00000000000000aa)');
  assert.equal(rerun(R, v1, 1, d1).why, 'this device does not hold the data this level was earned on (toy:00000000000000aa)');
  assert.equal(rerun({ ...R, found: searchOf('toy-a', 6, SMALL) }, v1, 1, d1, { ground }).ok, true, 'shallow: the search is provenance');
  assert.equal(rerun({ ...R, found: searchOf('toy-a', 6, SMALL) }, v1, 1, d1, { ground, deep: true }).why, 'the search it names does not find the mind it carries');
  assert.equal(rerun(l2.receipt, v2, 1, d2, { ground }).why, 'the mind before this level scores ' + R.before + ' here, not the ' + l2.receipt.before + ' its receipt says', 'a level is judged against the mind of its own moment');
  assert.equal(rerun(R, v1, 1, d1, { ground: { ...ground, ds: { ...ground.ds, silos: {} } } }).why, 'the mind before this level scores nothing here, not the ' + R.before + ' its receipt says');
  const small = organOf(searchOf('toy-a', 5, SMALL), view, 0.6);
  assert.equal(small.fixed, R.recipe);
  const cutTo = { ...R, recipe: fixedOf('toy-a', 1, { ...stemGenome(), on: 0 }) };
  assert.equal(at(cutTo).why, 'the mind this level carries scores 500000 here, not the ' + R.after + ' its receipt says', 'a mind with no rules is a coin');
  assert.ok(decodeSeed(R.recipe).ok && !decodeSeed(R.recipe).seed.grow);
});

test('the real ground: a credit-free check on the telecom customers, the bytes pinned and the mind the same twice', async () => {
  const bytes = { 'telco-churn.csv': new Uint8Array(readFileSync(new URL('../data/telco-churn.csv', import.meta.url))) };
  const g = await openSet('telco', bytes);
  assert.ok(g.ok, g.why);
  const view = viewOf(g, 'telco-account'), o = organOf(fixedOf('telco-account', 1, stemGenome()), view, 0.6);
  assert.deepEqual([o.ok, o.domain, o.gate], [true, 'telco-account', organOf(o.fixed, viewOf(await openSet('telco', bytes), 'telco-account'), 0.6).gate]);
  const own = ownGround(['tenure,charges,left', ...Array.from({ length: 80 }, (_, i) => [i % 70, (i * 37) % 100, i % 7 === 0 || i % 5 === 0 ? 'yes' : 'no'].join(','))].join('\n'), { target: 'left', positive: 'yes', name: 'my-shop' });
  assert.ok(own.ok, own.why);
  const om = organOf(fixedOf('my-shop', 1, stemGenome()), viewOf(own, 'my-shop'), 0.5);
  assert.ok(om.ok, om.why); assert.equal(viewOf(own, 'my-shop-x'), null);
});
