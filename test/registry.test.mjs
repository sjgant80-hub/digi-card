// registry.test.mjs — a card cannot be sold twice: the first give recorded wins, a forked life is refused for good, a
// level is recorded only once re-run, one card per serial per maker, and any copy of the log re-runs from nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empty, record, replay, standing, ownerOf, dossierOf, hashOf, ZERO, MAX_LOG } from '../src/registry.mjs';
import { issue, give, addReceipt, verify } from '../src/dossier.mjs';
import { seal } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { encodeSeed, makeSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { fromSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

const key = (s) => fromSeed(sha256Bytes(utf8('digi-card/test/' + s)));
const genomeOf = async (maker, name = 'credit-collections') => (await seal({ name, parents: [], gate: { auc: 0.6 }, organs: [encodeSeed(makeSeed({ domain: name, seed: 1, grow: { population: 40, elites: 8, generations: 30 } }))] }, maker)).text;
const must = (r) => { assert.ok(r.ok, r.why); return r; };

async function world() {
  const [maker, alice, bob, carol, dave, eve] = await Promise.all(['maker', 'alice', 'bob', 'carol', 'dave', 'eve'].map(key));
  const g = await genomeOf(maker), d = must(await issue(g, maker, { serial: 1, to: alice.pub, theme: 'synthwave-v1' })).dossier;
  return { maker, alice, bob, carol, dave, eve, g, d, id: (await verify(d)).id };
}

test('a card is recorded, then grows: each entry names where its events begin, and links to the entry before', async () => {
  const { alice, bob, d, id } = await world(), r0 = empty();
  const a = must(await record(r0, d));
  assert.equal(a.outcome, 'recorded');
  assert.deepEqual(a.entry, { n: 0, prev: ZERO, card: id, at: 0, events: d.events, genome: d.genome });
  assert.deepEqual([ownerOf(a.reg, id), dossierOf(a.reg, id), a.reg.head, a.reg.serials], [alice.pub, d, hashOf(a.entry), { [(await verify(d)).maker + ':1']: id }]);
  assert.deepEqual(r0, empty(), 'the old registry is untouched');
  const toBob = must(await give(d, alice, bob.pub)).dossier, b = must(await record(a.reg, toBob));
  assert.equal(b.outcome, 'grown');
  assert.deepEqual(b.entry, { n: 1, prev: hashOf(a.entry), card: id, at: 1, events: [toBob.events[1]] });
  assert.deepEqual([ownerOf(b.reg, id), dossierOf(b.reg, id), b.reg.log.length], [bob.pub, toBob, 2]);
  const again = must(await record(b.reg, toBob));
  assert.deepEqual([again.outcome, again.entry, again.reg], ['already recorded', null, b.reg]);
  assert.deepEqual([ownerOf(b.reg, 'ffffffffffffffff'), dossierOf(b.reg, 'ffffffffffffffff'), ownerOf(b.reg, 'constructor'), dossierOf(b.reg, '__proto__')], [null, null, null, null]);
});

test('a double sale: the first give recorded wins, and the other buyer’s card is refused for good, naming the event', async () => {
  const { alice, bob, carol, dave, d, id } = await world();
  const toBob = must(await give(d, alice, bob.pub)).dossier, toCarol = must(await give(d, alice, carol.pub)).dossier;
  assert.ok((await verify(toBob)).ok && (await verify(toCarol)).ok, 'both chains check on their own: only the record can decide');
  let reg = must(await record(must(await record(empty(), d)).reg, toBob)).reg;
  assert.equal((await record(reg, toCarol)).why, 'this card’s life parts from the one on record at event 1: the first recorded wins, so this is not the card’s life');
  assert.deepEqual(standing(reg, toCarol, id), { standing: 'forked', at: 1, owner: bob.pub });
  const onward = must(await give(toCarol, carol, dave.pub)).dossier;
  assert.equal((await record(reg, onward)).why, 'this card’s life parts from the one on record at event 1: the first recorded wins, so this is not the card’s life', 'selling the forked card on does not launder it');
  assert.deepEqual([standing(reg, toBob, id), standing(reg, d, id), standing(empty(), d, id)], [{ standing: 'current', at: 2, owner: bob.pub }, { standing: 'behind', at: 1, owner: bob.pub }, { standing: 'unrecorded' }]);
  assert.equal((await record(reg, d)).why, 'the registry holds a later life of this card (2 events; this one has 1)');
  const bobOn = must(await give(toBob, bob, dave.pub)).dossier;
  assert.deepEqual(standing(reg, bobOn, id), { standing: 'ahead', at: 2, owner: bob.pub });
  reg = must(await record(reg, bobOn)).reg;
  assert.equal(ownerOf(reg, id), dave.pub);
});

test('one card per serial per maker; another maker’s serial 1 is its own; the same genome is one card', async () => {
  const { maker, alice, bob, eve, d, id } = await world();
  let reg = must(await record(empty(), d)).reg;
  const other = must(await issue(await genomeOf(maker, 'credit-recovery'), maker, { serial: 1, to: bob.pub, theme: 'synthwave-v1' })).dossier;
  assert.equal((await record(reg, other)).why, 'serial 1 of this maker is already card ' + id);
  const two = must(await issue(await genomeOf(maker, 'credit-recovery'), maker, { serial: 2, to: bob.pub, theme: 'synthwave-v1' })).dossier;
  reg = must(await record(reg, two)).reg;
  const evesOwn = must(await issue(await genomeOf(eve, 'credit-recovery'), eve, { serial: 1, to: eve.pub, theme: 'synthwave-v1' })).dossier;
  reg = must(await record(reg, evesOwn)).reg;
  assert.equal(reg.log.length, 3);
  const reissued = must(await issue(d.genome, maker, { serial: 9, to: alice.pub, theme: 'blockcraft-v1' })).dossier;
  assert.equal((await record(reg, reissued)).why, 'this card’s life parts from the one on record at event 0: the first recorded wins, so this is not the card’s life');
});

test('a level is recorded only once re-run here, and only the new ones are re-run', async () => {
  const { alice, d } = await world();
  let reg = must(await record(empty(), d)).reg;
  const one = must(await addReceipt(d, alice, { kind: 'grow', before: 700000, after: 720000 })).dossier;
  assert.equal((await record(reg, one)).why, 'event 1 is a receipt, and the registry records a level only once it has re-run it');
  const runners = {
    'a refusal': [() => ({ ok: false, why: 'it scored 0.700000 here, not 0.720000' }), 'event 1’s receipt did not re-run: it scored 0.700000 here, not 0.720000'],
    'a refusal without a reason': [() => ({ ok: false }), 'event 1’s receipt did not re-run: no reason given'],
    'a yes that is not true': [() => ({ ok: 1 }), 'event 1’s receipt did not re-run: no reason given'],
    'nothing': [() => undefined, 'event 1’s receipt did not re-run: no reason given'],
    'a throw': [() => { throw new Error('x'); }, 'event 1’s receipt did not re-run: no reason given'],
    'a rejection': [async () => { throw new Error('x'); }, 'event 1’s receipt did not re-run: no reason given'],
    'not a function': ['yes', 'event 1 is a receipt, and the registry records a level only once it has re-run it'],
  };
  for (const [what, [rerun, why]] of Object.entries(runners)) assert.equal((await record(reg, one, { rerun })).why, why, what);
  const calls = [], rerun = async (receipt, v, k, dossier) => { calls.push([receipt.after, v.id, k, dossier.events.length]); return { ok: true }; };
  reg = must(await record(reg, one, { rerun })).reg;
  const two = must(await addReceipt(one, alice, { kind: 'grow', before: 720000, after: 730000 })).dossier;
  reg = must(await record(reg, two, { rerun })).reg;
  const id = (await verify(d)).id;
  assert.deepEqual(calls, [[720000, id, 1, 2], [730000, id, 2, 3]], 'each receipt re-run once, when it is new, with the life it sits in');
  assert.equal(reg.log.length, 3);
});

test('only a life that checks is recorded, under the device’s trust', async () => {
  const { maker, eve, d } = await world();
  assert.equal((await record(empty(), { v: 1 })).why, 'only a card whose life checks is recorded: not a dossier');
  assert.equal((await record(empty(), d, { trust: [eve.pub] })).why, 'only a card whose life checks is recorded: the genome was refused: untrusted maker');
  assert.ok((await record(empty(), d, { trust: [maker.pub] })).ok);
  const full = { ...empty(), log: Array(MAX_LOG) };
  assert.equal((await record(full, d)).why, 'the registry is full');
  assert.ok((await record({ ...empty(), log: Array(MAX_LOG - 1) }, d)).ok, 'one short of full still records');
});

test('any copy of the log re-runs from nothing to the same registry; a log that was tampered with is refused at the entry', async () => {
  const { maker, alice, bob, carol, d } = await world();
  const toBob = must(await give(d, alice, bob.pub)).dossier, toCarol = must(await give(d, alice, carol.pub)).dossier;
  const other = must(await issue(await genomeOf(maker, 'credit-recovery'), maker, { serial: 2, to: carol.pub, theme: 'blockcraft-v1' })).dossier;
  const earned = must(await addReceipt(toBob, bob, { kind: 'grow', before: 1, after: 2 })).dossier, rerun = () => ({ ok: true });
  let reg = empty();
  for (const x of [d, other, toBob, earned]) reg = must(await record(reg, x, { rerun })).reg;
  const log = reg.log, back = must(await replay(log, { rerun })).reg;
  assert.deepEqual(back, reg, 'the same cards, owners, serials and head');
  const relink = (entries) => { let head = ZERO; return entries.map((e, n) => { const x = { ...e, n, prev: head }; head = hashOf(x); return x; }); };
  const forkAt2 = relink([log[0], log[1], { ...log[2], events: toCarol.events.slice(1) }]);
  const bad = {
    'not a list': ['log', 'not a registry log'],
    'too long': [Array(MAX_LOG + 1), 'the registry is full'],
    'exactly full, then junk': [Array(MAX_LOG), 'entry 0 is not a registry entry'],
    'a hole': [[log[0], undefined], 'entry 1 is not a registry entry'],
    'a list for an entry': [[[log[0]]], 'entry 0 is not a registry entry'],
    'an extra field': [[{ ...log[0], note: 1 }], 'entry 0 is not a registry entry'],
    'events not a list': [[{ ...log[0], events: 'x' }], 'entry 0 is not a registry entry'],
    'a dropped entry': [[log[0], log[2]], 'entry 1 is not linked to the one before it'],
    'two swapped': [[log[1], log[0]], 'entry 0 is not linked to the one before it'],
    'a changed number': [[{ ...log[0], n: 1 }], 'entry 0 is not linked to the one before it'],
    'a changed link': [[log[0], { ...log[1], prev: ZERO }], 'entry 1 is not linked to the one before it'],
    'a first entry without its genome': [relink([(({ genome, ...e }) => e)(log[0])]), 'entry 0 was refused: only a card whose life checks is recorded: the genome was refused: not a genome'],
    'a genome on a later entry': [relink([log[0], log[1], { ...log[2], genome: d.genome }]), 'entry 2 is not what the registry would have recorded'],
    'an entry with nothing new': [relink([log[0], log[1], { ...log[2], events: [] }]), 'entry 2 is not what the registry would have recorded'],
    'an entry that says it begins before the card': [relink([log[0], log[1], { ...log[2], at: 0 }]), 'entry 2 was refused: only a card whose life checks is recorded: the first event is the issue'],
    'an entry that says it begins past the card’s end': [relink([log[0], log[1], { ...log[2], at: 5 }]), 'entry 2 is not what the registry would have recorded'],
    'an entry that says it begins nowhere': [relink([log[0], log[1], { ...log[2], at: 'x' }]), 'entry 2 was refused: only a card whose life checks is recorded: the first event is the issue'],
    'an entry for another card': [relink([log[0], log[1], { ...log[2], card: log[1].card }]), 'entry 2 was refused: only a card whose life checks is recorded: event 1 is for another card'],
    'a forged give': [relink([log[0], { ...log[2], events: [{ ...log[2].events[0], to: carol.pub }] }]), 'entry 1 was refused: only a card whose life checks is recorded: event 1’s signature does not check'],
    'a fork written in': [[...forkAt2, ...relink([...forkAt2, { ...log[2], n: 3 }]).slice(3)], 'entry 3 was refused: this card’s life parts from the one on record at event 1: the first recorded wins, so this is not the card’s life'],
  };
  for (const [what, [l, why]] of Object.entries(bad)) assert.equal((await replay(l, { rerun })).why, why, what);
  assert.equal((await replay(log)).why, 'entry 3 was refused: event 2 is a receipt, and the registry records a level only once it has re-run it', 'a replay re-runs every level too');
  assert.deepEqual(must(await replay([])).reg, empty());
});

test('fuzz: no log makes replay throw', async () => {
  const { d } = await world(), log = must(await record(empty(), d)).reg.log;
  let s = 7;
  const rnd = (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s % n; };
  const junk = [null, 0, 'x', {}, [null], [{}], [1, 2], { length: 3 }, [{ n: 0, prev: ZERO, card: 'x', at: 0, events: [null], genome: 'x' }]];
  for (let t = 0; t < 40; t++) {
    const e = { ...log[0] }, k = Object.keys(e)[rnd(6)];
    e[k] = [null, 1, 'x', [], {}, -1, ZERO, log[0].events][rnd(8)];
    junk.push([e]);
  }
  for (const j of junk) { const r = await replay(j); assert.ok(r.ok ? canonical(j) === canonical(log) : typeof r.why === 'string', 'refused, or the very log it was'); }
});
