// raid.test.mjs — a boss is a department no genesis search took past the bar; a strike is one signed search from a seed
// the striker's key fixes; any device re-checks it; the boss falls when a strike clears the bar, and its striker seals
// the loot; pooled strikes count once each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strikeSeed, bossesOf, strike, check, strikeId, standing, lootOf, BAR, KEYS } from '../src/raid.mjs';
import { seedsFor, searchOf, organOf, GROW } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { key, toy } from './helpers.mjs';

const ground = toy();
const [alice, bob] = await Promise.all(['alice', 'bob'].map(key));
const ADMISSION = { departments: [
  { set: 'toy', domain: 'toy-a', gates: [700000, 650000], admitted: true },
  { set: 'toy', domain: 'toy-b', gates: [550000, 580000, 571000], admitted: false },
  { set: 'toy', domain: 'toy-c', gates: [], admitted: false },
  { set: 'toy', domain: 'toy-d', gates: [500000], admitted: 'no' },
  'junk',
] };
const S0 = (await strike(alice, ground, 'toy-b', 0)).strike, S1 = (await strike(alice, ground, 'toy-b', 1)).strike, B0 = (await strike(bob, ground, 'toy-b', 0)).strike;
const resign = async (keys, s, over) => { const f = { ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'sig')), ...over, by: keys.pub }; return { ...f, sig: await sign(keys, utf8(canonical(f))) }; };

test('bosses: the departments the drop never admitted, with the best genesis search against each', () => {
  assert.deepEqual(bossesOf(ADMISSION), [{ domain: 'toy-b', set: 'toy', best: 580000, searched: 3 }]);
  for (const junk of [null, {}, { departments: 'x' }, 'x']) assert.deepEqual(bossesOf(junk), []);
});

test('strike seeds: the striker’s key and the number fix them; no two players share one', () => {
  assert.equal(strikeSeed(alice.pub, 'toy-b', 0), seedsFor('digi-card/raid/toy-b/' + alice.pub, 1)[0]);
  assert.equal(strikeSeed(alice.pub, 'toy-b', 3), seedsFor('digi-card/raid/toy-b/' + alice.pub, 4)[3]);
  assert.notEqual(strikeSeed(alice.pub, 'toy-b', 0), strikeSeed(bob.pub, 'toy-b', 0));
  assert.notEqual(strikeSeed(alice.pub, 'toy-b', 0), strikeSeed(alice.pub, 'toy-a', 0));
  assert.notEqual(strikeSeed(alice.pub, 'toy-b', 0), strikeSeed(alice.pub, 'toy-b', 1));
});

test('strike: a signed search, its mind carried fixed, its GATE measured; junk refused', async () => {
  assert.deepEqual(Object.keys(S0).sort(), KEYS);
  assert.deepEqual([S0.kind, S0.domain, S0.data, S0.k, S0.by], ['strike', 'toy-b', ground.id, 0, alice.pub]);
  assert.equal(S0.found, searchOf('toy-b', strikeSeed(alice.pub, 'toy-b', 0), GROW));
  const o = organOf(S0.found, viewOf(ground, 'toy-b'), BAR / 1e6);
  assert.deepEqual([S0.recipe, S0.gate], [o.fixed, o.gate]);
  assert.match(S0.sig, /^[0-9a-f]{128}$/);
  assert.equal((await strike(null, ground, 'toy-b', 0)).why, 'a strike is signed by an Ed25519 key');
  assert.equal((await strike({ pub: 'x' }, ground, 'toy-b', 0)).why, 'a strike is signed by an Ed25519 key');
  for (const k of [-1, 1.5, 100000, '1']) assert.equal((await strike(alice, ground, 'toy-b', k)).why, 'a strike’s number is a whole number from 0', String(k));
  const last = await strike(alice, ground, 'toy-b', 99999, { organ: o });
  assert.equal(last.ok, true);
  assert.deepEqual(await check(last.strike, ground), { ok: true }, 'strike 99999 is the last a striker makes, and it checks');
  assert.equal((await strike(alice, ground, 'toy-z', 0)).why, 'this ground holds no toy-z records');
  assert.match((await strike(alice, ground, 'toy-b', 0, { organ: { ok: false, why: 'stopped' } })).why, /^the search could not run here: stopped$/);
  assert.match((await strike(alice, ground, 'toy-b', 0, { organ: {} })).why, /^the search could not run here: no organ$/);
  const handed = await strike(alice, ground, 'toy-b', 0, { organ: o });
  assert.deepEqual(handed.strike, S0, 'the organ a worker hands in gives the same strike');
});

test('check: a true strike re-checks, shallow and deep; a forged one is refused by name', async () => {
  assert.deepEqual(await check(S0, ground), { ok: true });
  assert.deepEqual(await check(S0, ground, { deep: true }), { ok: true });
  assert.deepEqual(await check(B0, ground), { ok: true });
  const other = organOf(searchOf('toy-b', 999, GROW), viewOf(ground, 'toy-b'), BAR / 1e6);
  const cases = [
    [{ ...S0, extra: 1 }, 'not a strike'], [{ ...S0, kind: 'level' }, 'not a strike'], [null, 'not a strike'], [{ ...S0, by: 'x' }, 'not a strike'], [{ ...S0, sig: 'x' }, 'not a strike'],
    [{ ...S0, k: -1 }, 'not a strike'], [{ ...S0, k: 1.5 }, 'not a strike'], [{ ...S0, k: 100000 }, 'not a strike'], [{ ...S0, gate: 0.5 }, 'not a strike'],
    [{ ...S0, gate: S0.gate + 1 }, 'the strike’s signature does not check'],
    [await resign(alice, S0, { k: 1 }), 'the search it names is not this striker’s strike 1'],
    [await resign(bob, S0, {}), 'the search it names is not this striker’s strike 0'],
    [await resign(alice, S0, { recipe: S0.found }), 'a strike carries the mind it found, fixed, for its own department'],
    [await resign(alice, S0, { recipe: 'junk' }), 'a strike carries the mind it found, fixed, for its own department'],
    [await resign(alice, S0, { recipe: organOf(searchOf('toy-a', 5, GROW), viewOf(ground, 'toy-a'), 0.6).fixed }), 'a strike carries the mind it found, fixed, for its own department'],
    [await resign(alice, S0, { gate: S0.gate + 1 }), /^the mind it carries scores \d+ here, not the \d+ it says$/],
    [await resign(alice, S0, { data: 'toy:other' }), 'this device does not hold the data the strike was made on'],
  ];
  for (const [s, why] of cases) { const r = await check(s, ground); assert.equal(r.ok, false); if (why instanceof RegExp) assert.match(r.why, why); else assert.equal(r.why, why); }
  assert.equal((await check(S0, null)).why, 'this device does not hold the data the strike was made on');
  const swapped = await resign(alice, S0, { recipe: other.fixed, gate: other.gate });
  assert.deepEqual(await check(swapped, ground), { ok: true }, 'shallow: the mind it carries scores what it says');
  assert.equal((await check(swapped, ground, { deep: true })).why, 'the search it names does not find the mind it carries');
  const noView = { ...ground, ds: { ...ground.ds, silos: { a: ground.ds.silos.a } } };
  assert.equal((await check(S0, noView)).why, 'this ground holds no toy-b records');
});

test('standing: health is the bar less the best; a boss falls at the bar; each strike counts once', async () => {
  const bosses = bossesOf(ADMISSION);
  const r = standing(bosses, []).raids['toy-b'];
  assert.deepEqual(r, { domain: 'toy-b', set: 'toy', start: 580000, best: 580000, strikes: 0, hp: 20000, fallen: false, kill: null, strikers: {} });
  const weak = await resign(alice, S0, { gate: 590000 }), strong = await resign(bob, B0, { gate: 600000, k: 7 }), higher = await resign(alice, S1, { gate: 640000 });
  const s = standing(bosses, [weak, weak, strong, higher, { ...weak, domain: 'toy-a' }, 'junk']).raids['toy-b'];
  assert.equal(s.strikes, 3);
  assert.equal(s.best, 640000);
  assert.equal(s.hp, 0);
  assert.equal(s.fallen, true);
  assert.deepEqual(s.kill, { by: bob.pub, k: 7, gate: 600000, after: 2 });
  assert.deepEqual(s.strikers, { [alice.pub]: 2, [bob.pub]: 1 });
  const once = standing(bosses, [weak]).raids['toy-b'];
  assert.deepEqual([once.best, once.hp, once.fallen], [590000, 10000, false]);
  const below = standing(bosses, [await resign(alice, S0, { gate: 400000 })]).raids['toy-b'];
  assert.deepEqual([below.best, below.hp, below.strikes], [580000, 20000, 1]);
  const just = standing(bosses, [await resign(alice, S0, { gate: 599999 })]).raids['toy-b'];
  assert.deepEqual([just.fallen, just.hp], [false, 1]);
  const over = standing([{ domain: 'toy-b', set: 'toy', best: 650000 }], []).raids['toy-b'];
  assert.equal(over.hp, 0);
  assert.equal(strikeId(S0), sha256Hex(canonical(S0)));
  for (const [b, x] of [[null, []], [[], null], ['x', []]]) assert.equal(standing(b, x).why, 'a standing reads the bosses and the strikes');
});

test('loot: the first card of a fallen boss’s department, its genome for the striker to seal', async () => {
  const strong = await resign(bob, B0, { gate: 600000 });
  assert.deepEqual(lootOf(strong), { ok: true, genome: { name: 'toy-b', parents: [], gate: { auc: 0.6 }, organs: [strong.recipe] } });
  assert.equal(lootOf(await resign(bob, B0, { gate: 599999 })).why, 'only a strike that cleared the bar carries loot');
  assert.equal(lootOf({ ...strong, kind: 'level' }).why, 'only a strike that cleared the bar carries loot');
  assert.equal(lootOf(null).why, 'only a strike that cleared the bar carries loot');
});
