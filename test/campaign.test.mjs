// campaign.test.mjs — the raids as chapters, easiest first, cleared only by receipts; and a DIGI kitted for you by
// forward selection, measured: the node that lifts it most, while one lifts it and a slot is open, ties to the lower id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaptersOf, campaign, autoKit, byId } from '../src/campaign.mjs';
import { kitted } from '../src/kit.mjs';
import { KEYS, CLEAR } from '../src/raid.mjs';
import { organOf, searchOf, fixedOf } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { addReceipt, verify } from '../src/dossier.mjs';
import { rng, stemGenome } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { key, toy, SMALL, cardOn } from './helpers.mjs';

// x: two raid bosses and a world boss; y: only its world boss; z: one raid boss and its world boss
const ADM = { departments: [
  { domain: 'x-a', set: 'x', admitted: true, gates: [700000, 650000] },
  { domain: 'x-b', set: 'x', admitted: false, gates: [500000] },
  { domain: 'x-c', set: 'x', admitted: false, gates: [550000, 580000] },
  { domain: 'y-a', set: 'y', admitted: true, gates: [800000] },
  { domain: 'z-a', set: 'z', admitted: false, gates: [590000] },
] };
const strikeOn = (domain, gate) => Object.fromEntries(KEYS.map((k) => [k, k === 'domain' ? domain : k === 'gate' ? gate : k === 'k' ? gate : 'x']));
const clearOn = (set, gate) => Object.fromEntries(CLEAR.map((k) => [k, k === 'set' ? set : k === 'gate' ? gate : k === 'kind' ? 'clear' : k === 'members' ? [{ owner: 'o' }] : 'x']));

test('chapters: each business one, its raid bosses nearest the bar first, its world boss last; least left first', () => {
  const ch = chaptersOf(ADM);
  assert.deepEqual(ch.map((c) => [c.n, c.set, c.left]), [[1, 'y', 10000], [2, 'z', 30000], [3, 'x', 130000]]);
  assert.deepEqual(ch[2].raids, [{ domain: 'x-c', best: 580000, hp: 20000 }, { domain: 'x-b', best: 500000, hp: 100000 }], 'nearest the bar first, whatever the names');
  assert.deepEqual([byId('a', 'b'), byId('b', 'a'), byId('a', 'a')], [-1, 1, 0], 'a three-way compare, 0 only for the same text');
  assert.deepEqual(ch[2].world, { set: 'x', best: 700000, bar: 710000, hp: 10000 });
  assert.deepEqual([ch[0].raids, ch[1].raids, ch[1].world], [[], [{ domain: 'z-a', best: 590000, hp: 10000 }], { set: 'z', best: 590000, bar: 610000, hp: 20000 }]);
  const tie = chaptersOf({ departments: [{ domain: 'q-a', set: 'q', admitted: true, gates: [700000] }, { domain: 'p-a', set: 'p', admitted: true, gates: [700000] }, { domain: 'p-b', set: 'p', admitted: false, gates: [590000] }, { domain: 'p-c', set: 'p', admitted: false, gates: [590000] }] });
  assert.deepEqual(tie.map((c) => c.set), ['q', 'p']);
  assert.deepEqual(tie[1].raids.map((r) => r.domain), ['p-b', 'p-c'], 'equal distances by name');
  const named = chaptersOf({ departments: [{ domain: 'b-a', set: 'b', admitted: true, gates: [700000] }, { domain: 'a-a', set: 'a', admitted: true, gates: [700000] }] });
  assert.deepEqual(named.map((c) => c.set), ['a', 'b'], 'equal chapters by name');
  for (const junk of [null, {}, { departments: 'x' }, 5]) assert.deepEqual(chaptersOf(junk), []);
});

test('campaign: a chapter is cleared only when every boss in it has fallen, read from the receipts alone', () => {
  const start = campaign(ADM, [], []);
  assert.deepEqual([start.ok, start.now, start.chapters.map((c) => c.cleared)], [true, 1, [false, false, false]]);
  assert.deepEqual(campaign(ADM, [], [clearOn('y', 809999)]).now, 1, 'a party below the bar does not fell it');
  const y = campaign(ADM, [], [clearOn('y', 810000)]);
  assert.deepEqual([y.now, y.chapters[0].cleared, y.chapters[0].world.fallen], [2, true, true]);
  const zHalf = campaign(ADM, [strikeOn('z-a', 600000)], [clearOn('y', 810000)]);
  assert.deepEqual([zHalf.now, zHalf.chapters[1].raids[0].fallen, zHalf.chapters[1].world.fallen, zHalf.chapters[1].cleared], [2, true, false, false], 'a raid felled, its world boss standing');
  const zWorldOnly = campaign(ADM, [], [clearOn('y', 810000), clearOn('z', 610000)]);
  assert.deepEqual([zWorldOnly.now, zWorldOnly.chapters[1].cleared], [2, false], 'a world boss felled, its raid boss standing');
  const all = campaign(ADM, [strikeOn('z-a', 600000), strikeOn('x-b', 600000), strikeOn('x-c', 650000)], [clearOn('y', 810000), clearOn('z', 610000), clearOn('x', 720000)]);
  assert.deepEqual([all.now, all.chapters.map((c) => c.cleared)], [null, [true, true, true]]);
  assert.deepEqual(campaign(ADM, [strikeOn('x-b', 599999)], []).chapters[2].raids.find((r) => r.domain === 'x-b').fallen, false);
  for (const [s, c] of [['x', []], [[], null], [5, 5]]) assert.equal(campaign(ADM, s, c).why, 'a campaign reads the strikes and the party strikes');
  assert.deepEqual(campaign(null, [], []), { ok: true, chapters: [], now: null });
});

// three departments that each carry the outcome, and one of pure noise (as the kit's own tests)
const base = toy({ departments: ['a', 'b', 'c'] }), r = rng(5);
const n1 = base.ds.y.map(() => Math.round(r() * 100)), n2 = base.ds.y.map(() => Math.round(r() * 100));
const ground = { ...base, ds: { ...base.ds, cols: { ...base.ds.cols, n1, n2 }, features: [...base.ds.features, 'n1', 'n2'], silos: { ...base.ds.silos, n: ['n1', 'n2'] } } };
const found = (domain, seed) => organOf(searchOf(domain, seed, SMALL), viewOf(ground, domain), 0.6).fixed;
const [maker, alice, bob] = await Promise.all(['maker', 'alice', 'bob'].map(key));
const A = await cardOn([found('toy-a', 2)], { maker, owner: alice, name: 'toy-a' });
const B = await cardOn([found('toy-b', 10)], { maker, owner: alice, name: 'toy-b', serial: 2 });
const C = await cardOn([found('toy-c', 10)], { maker, owner: alice, name: 'toy-c', serial: 3 });
const A2 = await cardOn([found('toy-a', 5)], { maker, owner: alice, name: 'toy-a-two', serial: 4 });
const N = await cardOn([fixedOf('toy-n', 1, { ...stemGenome(), on: 1, f0: 1 })], { maker, owner: alice, name: 'toy-n', serial: 5, bar: 0.5 });
const T = await cardOn([fixedOf('telco-account', 1, stemGenome())], { maker, owner: alice, name: 'telco-account', serial: 6 });
const Bb = await cardOn([found('toy-b', 10)], { maker, owner: bob, name: 'toy-b', serial: 7 });

test('kit it for me: the node that lifts the kitted GATE most, then the next, while one lifts it — never a card not yours, of another business, or itself', () => {
  const k = autoKit(A.v, [Bb.v, T.v, A.v, N.v, A2.v, C.v, B.v, null, 5, {}], ground);
  assert.equal(k.ok, true);
  assert.equal(k.alone, kitted(A.v, [], ground).gate);
  assert.ok(k.nodes.length >= 1 && k.nodes.length <= 2 && k.nodes.every((id) => [B.v.id, C.v.id].includes(id)), 'only its own cards of other departments that join');
  const byId = new Map([B.v, C.v, A2.v, N.v].map((v) => [v.id, v]));
  assert.equal(k.gate, kitted(A.v, k.nodes.map((id) => byId.get(id)), ground).gate, 'the kit it hands over measures what it says');
  let at = k.alone;
  k.steps.forEach((s, i) => {
    assert.ok(s.adds > 0 && s.gate === at + s.adds, 'each step lifts it');
    const tried = [B.v, C.v, A2.v, N.v].filter((v) => !k.nodes.slice(0, i).includes(v.id)).map((v) => ({ id: v.id, m: kitted(A.v, [...k.nodes.slice(0, i).map((id) => byId.get(id)), v], ground) })).filter((x) => x.m.ok && x.m.slots[i].joined);
    assert.ok(tried.every((x) => x.m.gate <= s.gate), 'the best of what joins at that step');
    at = s.gate;
  });
  assert.deepEqual(k.steps.map((s) => s.card), k.nodes);
  assert.deepEqual(autoKit(A.v, [B.v, C.v, A2.v, N.v], ground), autoKit(A.v, [N.v, A2.v, C.v, B.v], ground), 'the same cards, in any order, give the same kit');
  assert.deepEqual(autoKit(A.v, [A2.v, N.v, Bb.v, T.v], ground), { ok: true, nodes: [], alone: k.alone, gate: k.alone, steps: [] }, 'nothing that joins and lifts: no kit');
  assert.deepEqual(autoKit(A.v, [], ground).nodes, []);
});

test('kit it for me: a third slot once levelled, ties to the lower id, and junk refused', async () => {
  let d = A.d; d = (await addReceipt(d, alice, { kind: 'level', n: 0 })).dossier;
  const lv = await verify(d), k = autoKit(lv, [B.v, C.v], ground);
  assert.equal(k.ok, true);
  assert.ok(k.nodes.length <= 3);
  const twin = await cardOn([found('toy-b', 10)], { maker, owner: alice, name: 'toy-b-twin', serial: 9 });
  const pick = autoKit(A.v, [B.v, twin.v], ground);
  assert.deepEqual(pick.nodes, [[B.v.id, twin.v.id].sort()[0]], 'two identical minds: the lower card id, and the twin then covers nothing new');
  for (const bad of [null, {}, { ok: false }]) assert.equal(autoKit(bad, [], ground).why, 'only a card that checks can be kitted');
  for (const bad of ['x', null, 5]) assert.equal(autoKit(A.v, bad, ground).why, 'kit it from a list of your cards');
  assert.equal(autoKit(T.v, [], ground).ok, false, 'a DIGI dormant on this ground cannot be kitted here');
});

test('kit it for me: never more nodes than the DIGI has slots, and never a node that joins but adds nothing', async () => {
  // four departments that each carry the outcome (each alone only past a 0.5 bar): three nodes would lift a two-slot DIGI, and it takes two
  const g4 = toy({ departments: ['a', 'b', 'c', 'd'], seed: 21, n: 2000 }), f4 = (domain, seed) => organOf(searchOf(domain, seed, SMALL), viewOf(g4, domain), 0.5).fixed;
  const D4 = await cardOn([f4('toy-a', 3)], { maker, owner: alice, name: 'toy-a', bar: 0.5 }), more = [];
  for (const [d, s] of [['toy-b', 4], ['toy-c', 5], ['toy-d', 6]]) more.push((await cardOn([f4(d, s)], { maker, owner: alice, name: d, serial: more.length + 2, bar: 0.5 })).v);
  const k4 = autoKit(D4.v, more, g4);
  assert.equal(k4.nodes.length, 2, 'two node slots, two nodes');
  const third = more.find((v) => !k4.nodes.includes(v.id)), byIdOf = new Map(more.map((v) => [v.id, v]));
  assert.ok(kitted(D4.v, [...k4.nodes.map((id) => byIdOf.get(id)), third], g4).gate > k4.gate, 'a third would have lifted it: only the slots stopped it');
  // a department whose columns copy another's: the same rule on it scores the DIGI's very scores, joins, and adds nothing
  const g2 = toy({ departments: ['a', 'b'], seed: 31 });
  g2.ds.cols.b1 = [...g2.ds.cols.a1]; g2.ds.cols.b2 = [...g2.ds.cols.a2];
  const G = { ...stemGenome(), on: 1, f0: 0 };
  const same = await cardOn([fixedOf('toy-a', 1, G)], { maker, owner: alice, name: 'toy-a', bar: 0.5 }), twin = await cardOn([fixedOf('toy-b', 1, G)], { maker, owner: alice, name: 'toy-b', serial: 2, bar: 0.5 });
  const both = kitted(same.v, [twin.v], g2);
  assert.deepEqual([both.ok, both.slots[0].joined, both.gate - both.alone], [true, true, 0], 'the twin joins and adds exactly nothing');
  assert.deepEqual(autoKit(same.v, [twin.v], g2).nodes, [], 'a node that adds nothing is not taken');
});
