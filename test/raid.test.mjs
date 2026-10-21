// raid.test.mjs — a boss is a department no genesis search took past the bar; a strike is one signed search from a seed
// the striker's key fixes; any device re-checks it; the boss falls when a strike clears the bar, and its striker seals
// the loot; pooled strikes count once each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strikeSeed, bossesOf, strike, check, strikeId, standing, lootOf, BAR, KEYS, worldBossesOf, partyStrike, checkClear, worldStanding, partyOf, PARTY_MARGIN, CLEAR } from '../src/raid.mjs';
import { consent, assemble } from '../src/mesh.mjs';
import { seedsFor, searchOf, organOf, GROW } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { key, toy, SMALL, cardOn } from './helpers.mjs';

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

// ── party raids ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('world bosses: each business at its best lone genesis search, or the plain bar, plus the margin a party must clear', () => {
  const adm = { departments: [...ADMISSION.departments, { set: 'low', domain: 'low-a', gates: [580000, 'x'], admitted: false }, { set: 'low', domain: 'low-b', gates: 'x' }, { set: 7, gates: [] }] };
  assert.deepEqual(worldBossesOf(adm), [{ set: 'toy', best: 700000, departments: 4, bar: 710000 }, { set: 'low', best: 580000, departments: 1, bar: 610000 }]);
  assert.equal(PARTY_MARGIN, 10000);
  assert.equal(partyOf('toy'), 'raid-toy');
  for (const junk of [null, {}, { departments: 'x' }, 'x']) assert.deepEqual(worldBossesOf(junk), []);
});

test('party strike: the party assembled as a mesh, its receipt naming every fielded card, owner and share', async () => {
  const maker = await key('maker'), found = (d, s) => organOf(searchOf(d, s, SMALL), viewOf(ground, d), 0.6).fixed;
  const PA = await cardOn([found('toy-a', 5)], { maker, owner: alice, name: 'toy-a' }), PB = await cardOn([found('toy-b', 6)], { maker, owner: bob, name: 'toy-b', serial: 2 });
  const join = async (keys, c, name = 'raid-toy') => ({ v: c.v, consent: (await consent(keys, c.v, name)).consent });
  const party = [await join(alice, PA), await join(bob, PB)], easy = { set: 'toy', bar: 500000 }, hard = { set: 'toy', bar: 999999 };
  const r = await partyStrike(easy, party, ground);
  assert.equal(r.ok, true);
  const m = await assemble('raid-toy', party, ground);
  assert.deepEqual(Object.keys(r.clear).sort(), CLEAR);
  assert.deepEqual([r.clear.kind, r.clear.party, r.clear.set, r.clear.data, r.clear.bar, r.clear.gate], ['clear', 'raid-toy', 'toy', ground.id, 500000, m.gate]);
  assert.deepEqual(r.clear.members, m.members.filter((x) => x.joined).map((x) => ({ card: x.card, head: x.card === PA.v.id ? PA.v.head : PB.v.head, owner: x.owner, contribution: x.contribution, share: x.share })));
  assert.equal(r.clear.members.reduce((s, x) => s + x.share, 0), 1000000);
  assert.deepEqual(new Set(r.clear.members.map((x) => x.owner)), new Set([alice.pub, bob.pub]));
  assert.deepEqual([r.cleared, r.best], [true, m.best]);
  assert.equal((await partyStrike(hard, party, ground)).cleared, false);
  assert.equal((await partyStrike({ set: 'toy', bar: m.gate }, party, ground)).cleared, true, 'reaching the bar clears it');
  assert.equal((await partyStrike({ set: 'toy', bar: m.gate + 1 }, party, ground)).cleared, false);
  for (const b of [null, 'x', { set: 5, bar: 1 }, { set: 'toy' }, { set: 'toy', bar: 0.5 }]) assert.equal((await partyStrike(b, party, ground)).why, 'a party strikes a world boss');
  assert.equal((await partyStrike({ set: 'bank', bar: 1 }, party, ground)).why, 'this is not the ground of bank');
  assert.equal((await partyStrike(easy, party, null)).why, 'this is not the ground of toy');
  assert.equal((await partyStrike(easy, party, { set: 'toy' })).why, 'this is not the ground of toy');
  assert.equal((await partyStrike(easy, [], ground)).why, 'a mesh needs at least one card');
  assert.match((await partyStrike(easy, [await join(alice, PA, 'raid-bank')], ground)).why, /^no card can join: the consent is for another mesh$/);
  assert.equal((await partyStrike(easy, 'x', ground)).why, 'a mesh needs at least one card');
  assert.equal((await partyStrike(easy, [null, ...party], ground)).why, 'the party could not strike here');
  const loose = await partyStrike(easy, [...party, { v: undefined, consent: null }, { v: { ok: false }, consent: null }], ground);
  assert.deepEqual(loose.clear, r.clear, 'a candidate with no card, or one that does not check, joins nothing and breaks nothing');
  assert.deepEqual(await checkClear(r.clear, easy, party, ground), { ok: true });
  assert.equal((await checkClear({ ...r.clear, gate: 1 }, easy, party, ground)).why, 'struck again here, the party scores ' + m.gate + ' with 2 fielded, not the 1 with 2 its receipt says');
  assert.match((await checkClear(r.clear, easy, party.slice(0, 1), ground)).why, /^struck again here, the party scores \d+ with 1 fielded, not the \d+ with 2 its receipt says$/);
  assert.match((await checkClear({ ...r.clear, members: 'x' }, easy, party, ground)).why, / with 0 its receipt says$/);
  assert.match((await checkClear(r.clear, { set: 'toy', bar: 1 }, party, ground)).why, /^struck again here/, 'the bar is part of the receipt');
  for (const bad of [null, { ...r.clear, kind: 'strike' }, { ...r.clear, extra: 1 }]) assert.equal((await checkClear(bad, easy, party, ground)).why, 'not a party’s strike');
  assert.equal((await checkClear(r.clear, null, party, ground)).why, 'the party does not strike again: a party strikes a world boss');
});

test('world standing: the best party so far is the health; the boss falls to the first strike that clears; each once', async () => {
  const bosses = [{ set: 'toy', best: 700000, departments: 4, bar: 710000 }, { set: 'low', best: 580000, departments: 1, bar: 610000 }];
  const c = (gate, owners = [alice.pub, bob.pub], set = 'toy') => ({ kind: 'clear', party: partyOf(set), set, data: 'toy:x', bar: 710000, gate, members: owners.map((o, k) => ({ card: String(k).repeat(16), head: '0'.repeat(64), owner: o, contribution: 1, share: k ? 400000 : 600000 })) });
  const start = worldStanding(bosses, []).raids;
  assert.deepEqual(start.toy, { set: 'toy', bar: 710000, start: 700000, best: 700000, strikes: 0, hp: 10000, fallen: false, first: null });
  assert.equal(start.low.hp, 30000);
  const s = worldStanding(bosses, [c(705000), c(705000), c(712000, [alice.pub, alice.pub, bob.pub]), c(720000), { ...c(800000), set: 'nope' }, 'junk', { ...c(800000), gate: 0.9 }, { ...c(800000), members: 'x' }]).raids.toy;
  assert.deepEqual([s.strikes, s.best, s.hp, s.fallen], [3, 720000, 0, true]);
  assert.deepEqual(s.first, { gate: 712000, members: 3, owners: 2, after: 2 });
  const exact = worldStanding(bosses, [c(710000)]).raids.toy;
  assert.deepEqual([exact.fallen, exact.hp, exact.first.gate], [true, 0, 710000], 'reaching the bar fells it');
  const under = worldStanding(bosses, [c(709999)]).raids.toy;
  assert.deepEqual([under.fallen, under.hp, under.best], [false, 1, 709999]);
  const lower = worldStanding(bosses, [c(600000)]).raids.toy;
  assert.deepEqual([lower.best, lower.hp, lower.strikes], [700000, 10000, 1]);
  assert.equal(worldStanding([{ set: 'toy', best: 720000, bar: 710000 }], []).raids.toy.hp, 0);
  for (const [b, x] of [[null, []], [[], null]]) assert.equal(worldStanding(b, x).why, 'a standing reads the bosses and the strikes');
});
