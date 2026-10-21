// kit.test.mjs — every card is born with slots; its owner equips nodes (its own cards of the same business) and tools for
// the card as it stands; the kitted mind couples them, each slot showing what it is worth and a node that adds nothing
// named with its reason; a kit duel scores each side's kitted mind on a batch it was not coupled on, and re-runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotsOf, equip, loadoutOk, kitted, scoresOn, kitChallenge, kitAccept, kitDuel, kitRerun, KEYS, LOADOUT, TOOL_SLOTS, ZERO } from '../src/kit.mjs';
import { ratings, batchOf, seedOf } from '../src/arena.mjs';
import { oof } from '../src/mesh.mjs';
import { organOf, searchOf, fixedOf, mindOf, scoreRow } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { verify, give, addReceipt } from '../src/dossier.mjs';
import { rng, stemGenome, auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { coupleNonNegative, coupled } from '../vendor/dex-frontier/src/compose.mjs';
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
const B = await cardOn([found('toy-b', 10)], { maker, owner: alice, name: 'toy-b', serial: 2 });
const C = await cardOn([found('toy-c', 10)], { maker, owner: alice, name: 'toy-c', serial: 3 });
const A2 = await cardOn([found('toy-a', 5)], { maker, owner: alice, name: 'toy-a-two', serial: 4 });
const N = await cardOn([fixedOf('toy-n', 1, { ...stemGenome(), on: 1, f0: 1 })], { maker, owner: alice, name: 'toy-n', serial: 5, bar: 0.5 });
const T = await cardOn([fixedOf('telco-account', 1, stemGenome())], { maker, owner: alice, name: 'telco-account', serial: 6 });
const Bb = await cardOn([found('toy-b', 10)], { maker, owner: bob, name: 'toy-b', serial: 7 });
const COIN = await cardOn([fixedOf('toy-n', 1, { ...stemGenome(), on: 0 })], { maker, owner: alice, name: 'toy-coin', serial: 10, bar: 0.5 });
const Z = await cardOn([fixedOf('toy-z', 1, stemGenome())], { maker, owner: alice, name: 'toy-z', serial: 8 });
const app = (owner, c = 'ab') => ({ ok: true, form: 'app', id: c.repeat(32), owner: owner.pub });
const resign = async (keys, lo, over) => { const f = { ...Object.fromEntries(Object.entries(lo).filter(([k]) => k !== 'sig')), ...over, by: keys.pub }; return { ...f, sig: await sign(keys, utf8(canonical(f))) }; };
const levelled = async (n) => { let d = A.d; for (let k = 0; k < n; k++) d = (await addReceipt(d, alice, { kind: 'level', n: k })).dossier; return verify(d); };

test('slots: two node slots and two tool slots from birth; a level adds a third node slot, rare a fourth', async () => {
  assert.deepEqual(slotsOf(A.v), { nodes: 2, tools: TOOL_SLOTS, stage: 0, rarity: 'common' });
  assert.equal(TOOL_SLOTS, 2);
  const got = [];
  for (const n of [1, 2, 3, 6]) got.push(slotsOf(await levelled(n)).nodes);
  assert.deepEqual(got, [3, 3, 4, 4]);
  const other = await verify((await addReceipt(A.d, alice, { kind: 'mesh' })).dossier);
  assert.equal(slotsOf(other).nodes, 2, 'only a level receipt is a level');
});

test('equip: the owner signs its kit for the card as it stands; a kit that cannot be carried is refused by name', async () => {
  const r = await equip(alice, A.v, [B.v, C.v], [app(alice)]);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.loadout).sort(), KEYS);
  assert.deepEqual([r.loadout.type, r.loadout.card, r.loadout.head, r.loadout.by], [LOADOUT, A.v.id, A.v.head, alice.pub]);
  assert.deepEqual(r.loadout.nodes, [{ card: B.v.id, head: B.v.head }, { card: C.v.id, head: C.v.head }]);
  assert.deepEqual(r.loadout.tools, ['ab'.repeat(32)]);
  assert.match(r.loadout.sig, /^[0-9a-f]{128}$/);
  assert.deepEqual((await equip(alice, A.v)).loadout.nodes, [], 'an empty kit is a kit');
  const cases = [
    [bob, A.v, [B.v], [], 'only the card’s owner can equip it'], [null, A.v, [], [], 'only the card’s owner can equip it'],
    [alice, { ...A.v, ok: false }, [], [], 'only a card that checks can be kitted'], [alice, null, [], [], 'only a card that checks can be kitted'],
    [alice, A.v, [B.v, C.v, N.v], [], 'this DIGI has 2 node slots'], [alice, A.v, [], [app(alice, 'a1'), app(alice, 'a2'), app(alice, 'a3')], 'this DIGI has 2 tool slots'],
    [alice, A.v, [A.v], [], 'a DIGI cannot be its own node'], [alice, A.v, [B.v, B.v], [], 'the same card is in two slots'],
    [alice, A.v, [Bb.v], [], 'a node is a card the DIGI’s owner also owns'], [alice, A.v, [{ ...B.v, ok: false }], [], 'a node is a card that checks'], [alice, A.v, [null], [], 'a node is a card that checks'],
    [alice, A.v, [T.v], [], 'a node works with its DIGI on the same business’s records: this one is telco, the DIGI custom'],
    [alice, A.v, 'x', [], 'a kit is a list of node cards and a list of tools'], [alice, A.v, [], 'x', 'a kit is a list of node cards and a list of tools'],
    [alice, A.v, [], [{ ...app(alice), form: 'trophy' }], 'a tool is an app item that checks'], [alice, A.v, [], [{ ...app(alice), ok: false }], 'a tool is an app item that checks'],
    [alice, A.v, [], [{ ...app(alice), id: 'x' }], 'a tool is an app item that checks'], [alice, A.v, [], [null], 'a tool is an app item that checks'], [alice, A.v, [], [{ ...app(alice), id: undefined }], 'a tool is an app item that checks'],
    [alice, A.v, [], [app(bob)], 'a tool is an item the DIGI’s owner also holds'], [alice, A.v, [], [app(alice), app(alice)], 'the same tool is in two slots'],
  ];
  for (const [k, v, nodes, tools, why] of cases) assert.equal((await equip(k, v, nodes, tools)).why, why, why);
  const big = await levelled(3);
  assert.equal((await equip(alice, big, [B.v, C.v, N.v, A2.v])).ok, true, 'a rare card carries four nodes');
});

test('loadout: the owner’s, for the card and every node as they stand; anything else lapses or is refused', async () => {
  const lo = (await equip(alice, A.v, [B.v, C.v], [app(alice)])).loadout, tools = [app(alice)];
  assert.deepEqual(await loadoutOk(lo, A.v, [B.v, C.v], tools), { ok: true });
  const given = await verify((await give(A.d, alice, bob.pub)).dossier);
  const movedB = await verify((await addReceipt(B.d, alice, { kind: 'mesh' })).dossier);
  const cases = [
    [{ ...lo, extra: 1 }, A.v, [B.v, C.v], tools, 'not a loadout'], [{ ...lo, type: 'x' }, A.v, [B.v, C.v], tools, 'not a loadout'], [null, A.v, [B.v, C.v], tools, 'not a loadout'],
    [{ ...lo, nodes: 'x' }, A.v, [B.v, C.v], tools, 'not a loadout'], [{ ...lo, tools: 'x' }, A.v, [B.v, C.v], tools, 'not a loadout'],
    [{ ...lo, card: 'x' }, A.v, [B.v, C.v], tools, 'not a loadout'], [{ ...lo, head: 'x' }, A.v, [B.v, C.v], tools, 'not a loadout'], [{ ...lo, by: 'x' }, A.v, [B.v, C.v], tools, 'not a loadout'], [{ ...lo, sig: 'x' }, A.v, [B.v, C.v], tools, 'not a loadout'],
    [{ ...lo, nodes: [{ card: B.v.id }] }, A.v, [B.v], tools, 'not a loadout'], [{ ...lo, nodes: [{ card: 'x', head: B.v.head }] }, A.v, [B.v], tools, 'not a loadout'], [{ ...lo, nodes: [{ card: B.v.id, head: 'x' }] }, A.v, [B.v], tools, 'not a loadout'],
    [{ ...lo, tools: ['x'] }, A.v, [B.v, C.v], tools, 'not a loadout'], [{ ...lo, tools: [5] }, A.v, [B.v, C.v], tools, 'not a loadout'],
    [{ ...lo, tools: [] }, A.v, [B.v, C.v], [], 'the loadout’s signature does not check'],
    [lo, B.v, [B.v, C.v], tools, 'the loadout is for another card'], [lo, null, [B.v, C.v], tools, 'the loadout is for another card'], [lo, { ...A.v, ok: false }, [B.v, C.v], tools, 'the loadout is for another card'],
    [lo, given, [B.v, C.v], tools, 'the card has changed since this kit was equipped: its owner equips it again'],
    [await resign(eve, lo, {}), A.v, [B.v, C.v], tools, 'the loadout is not its card’s owner’s'],
    [lo, A.v, [B.v], tools, 'these are not the nodes and tools the loadout names'], [lo, A.v, [B.v, C.v], [], 'these are not the nodes and tools the loadout names'],
    [lo, A.v, [C.v, B.v], tools, 'these are not the nodes and tools the loadout names'], [lo, A.v, [B.v, null], tools, 'these are not the nodes and tools the loadout names'],
    [lo, A.v, [B.v, C.v], [app(alice, 'cd')], 'these are not the nodes and tools the loadout names'], [lo, A.v, [B.v, C.v], [null], 'these are not the nodes and tools the loadout names'],
    [lo, A.v, 'x', tools, 'these are not the nodes and tools the loadout names'], [lo, A.v, [B.v, C.v], 'x', 'these are not the nodes and tools the loadout names'],
    [lo, A.v, 'ab', tools, 'these are not the nodes and tools the loadout names'], [lo, A.v, [B.v, C.v], 'a', 'these are not the nodes and tools the loadout names'],
    [lo, A.v, null, tools, 'these are not the nodes and tools the loadout names'], [lo, A.v, [B.v, C.v], null, 'these are not the nodes and tools the loadout names'],
    [lo, A.v, [B.v, C.v, N.v], tools, 'these are not the nodes and tools the loadout names'], [lo, A.v, [B.v, C.v], [...tools, app(alice, 'cd')], 'these are not the nodes and tools the loadout names'],
    [lo, A.v, [movedB, C.v], tools, 'node 1 has changed since it was equipped: its owner equips it again'],
    [await resign(alice, lo, { nodes: [{ card: Bb.v.id, head: Bb.v.head }] }), A.v, [Bb.v], tools, 'a node is a card the DIGI’s owner also owns'],
  ];
  for (const [l, v, nodes, t, why] of cases) assert.equal((await loadoutOk(l, v, nodes, t)).why, why, why);
  assert.deepEqual(await loadoutOk((await equip(alice, A.v)).loadout, A.v), { ok: true }, 'the nodes and tools default to none');
});

test('kitted: the DIGI and its nodes couple; every slot shows its worth; a node that adds nothing is named with why', () => {
  const rows = ground.ds.gateRows, y = rows.map((i) => ground.ds.y[i]), col = (v) => rows.map((i) => scoreRow(mindOf(v, ground), ground, i));
  const k = kitted(A.v, [B.v, C.v, N.v], ground);
  assert.equal(k.ok, true);
  assert.equal(k.rows, rows.length);
  const whole = Math.round(oof([col(A.v), col(B.v), col(C.v)], y) * 1e6), alone = Math.round(oof([col(A.v)], y) * 1e6);
  assert.deepEqual([k.gate, k.alone, k.lift], [whole, alone, whole - alone]);
  assert.ok(k.lift > 0, 'two departments more than the DIGI knows lift it on GATE');
  assert.equal(k.own, whole - Math.round(oof([col(B.v), col(C.v)], y) * 1e6));
  assert.deepEqual(k.slots.map((s) => [s.card, s.domains, s.joined, s.why]), [[B.v.id, 'toy-b', true, null], [C.v.id, 'toy-c', true, null], [N.v.id, 'toy-n', false, k.slots[2].why]]);
  assert.match(k.slots[2].why, /^it does not lead a coin on GATE \(bound -?0\.\d+\)$/);
  assert.deepEqual(k.slots.map((s) => s.gate), [mindOf(B.v, ground).gate, mindOf(C.v, ground).gate, mindOf(N.v, ground).gate]);
  assert.equal(k.slots[0].contribution, whole - Math.round(oof([col(A.v), col(C.v)], y) * 1e6));
  assert.equal(k.slots[1].contribution, whole - Math.round(oof([col(A.v), col(B.v)], y) * 1e6));
  assert.equal(k.slots[2].contribution, 0);
  assert.deepEqual(k.fielded.map((f) => f.card), [A.v.id, B.v.id, C.v.id]);
  assert.equal(kitted(A.v, [COIN.v], ground).slots[0].why, 'it does not lead a coin on GATE (bound 0)', 'a flat score leads a coin by exactly nothing');
  const twice = kitted(A.v, [A2.v, B.v], ground);
  assert.deepEqual(twice.slots.map((s) => [s.joined, s.why]), [[false, 'what it knows is covered already: toy-a'], [true, null]]);
  const z = kitted(A.v, [Z.v, null, { ...B.v, ok: false }], ground);
  assert.deepEqual(z.slots.map((s) => [s.card, s.gate, s.joined, s.why]), [[Z.v.id, null, false, 'it is dormant here: no department of its mind answers on this ground'], [null, null, false, 'the card does not check'], [null, null, false, 'the card does not check']]);
  assert.deepEqual([z.gate, z.lift, z.own], [alone, 0, alone - 500000]);
  assert.equal(kitted(Z.v, [], ground).why, 'the DIGI must answer on this ground: a card of another business is dormant here');
  assert.equal(kitted(null, [], ground).why, 'only a card that checks can be kitted');
  assert.equal(kitted({ ...A.v, ok: false }, [], ground).why, 'only a card that checks can be kitted');
  assert.equal(kitted(A.v, 'x', ground).why, 'a kit is a list of node cards');
  assert.equal(kitted(A.v, [], null).why, 'the kit could not be measured here');
});

test('scores on a batch: alone, the card’s own score; kitted, coupled on GATE outside the batch', () => {
  const batch = batchOf(ground, 'seed-1'), alone = kitted(A.v, [], ground), k = kitted(A.v, [B.v, C.v], ground);
  assert.deepEqual(scoresOn(alone, ground, batch), batch.map((i) => scoreRow(mindOf(A.v, ground), ground, i)));
  const out = new Set(batch), rest = ground.ds.gateRows.filter((i) => !out.has(i)), minds = [A.v, B.v, C.v].map((v) => mindOf(v, ground));
  const c = coupleNonNegative(minds.map((m) => rest.map((i) => scoreRow(m, ground, i))), rest.map((i) => ground.ds.y[i]));
  assert.deepEqual(scoresOn(k, ground, batch), batch.map((i) => coupled(c, minds.map((m) => scoreRow(m, ground, i)))));
});

test('kit challenge and acceptance: each owner signs for its card as it stands and the hash of its kit', async () => {
  const lo = (await equip(alice, A.v, [B.v, C.v])).loadout;
  const ch = (await kitChallenge(alice, A.v, lo, 'n1')).challenge;
  assert.deepEqual(Object.keys(ch).sort(), ['by', 'card', 'head', 'kit', 'nonce', 'sig', 'type']);
  assert.deepEqual([ch.type, ch.card, ch.head, ch.kit, ch.nonce, ch.by], ['digi.kit-challenge.v1', A.v.id, A.v.head, sha256Hex(canonical(lo)), 'n1', alice.pub]);
  assert.equal((await kitChallenge(alice, A.v, null, 'n1')).challenge.kit, ZERO);
  assert.equal((await kitChallenge(bob, A.v, lo, 'n1')).why, 'only the card’s owner can send its challenge');
  assert.equal((await kitChallenge(null, A.v, lo, 'n1')).why, 'only the card’s owner can send its challenge');
  assert.equal((await kitChallenge(alice, null, lo, 'n1')).why, 'only a card that checks can challenge');
  assert.equal((await kitChallenge(alice, { ...A.v, ok: false }, lo, 'n1')).why, 'only a card that checks can challenge');
  for (const n of ['', 'A', '-x', 'a'.repeat(65), 7]) assert.equal((await kitChallenge(alice, A.v, lo, n)).why, 'a nonce is up to 64 lowercase letters, digits and hyphens', String(n));
  assert.equal((await kitChallenge(alice, A.v, lo, 'a'.repeat(64))).ok, true);
  const ac = (await kitAccept(bob, Bb.v, null, ch)).accept;
  assert.deepEqual(Object.keys(ac).sort(), ['by', 'card', 'challenge', 'head', 'kit', 'sig', 'type']);
  assert.deepEqual([ac.type, ac.card, ac.head, ac.kit, ac.challenge, ac.by], ['digi.kit-accept.v1', Bb.v.id, Bb.v.head, ZERO, sha256Hex(canonical(ch)), bob.pub]);
  const loB = (await equip(bob, Bb.v)).loadout;
  assert.equal((await kitAccept(bob, Bb.v, loB, ch)).accept.kit, sha256Hex(canonical(loB)));
  assert.equal((await kitAccept(eve, Bb.v, null, ch)).why, 'only the card’s owner can accept for it');
  assert.equal((await kitAccept(null, Bb.v, null, ch)).why, 'only the card’s owner can accept for it');
  assert.equal((await kitAccept(bob, null, null, ch)).why, 'only a card that checks can accept');
  assert.equal((await kitAccept(bob, { ...Bb.v, ok: false }, null, ch)).why, 'only a card that checks can accept');
  assert.equal((await kitAccept(alice, A.v, null, ch)).why, 'a card cannot fight itself');
  for (const bad of [{ ...ch, extra: 1 }, { ...ch, type: 'digi.challenge.v1' }, { ...ch, card: 'x' }, { ...ch, head: 'x' }, { ...ch, kit: 'x' }, { ...ch, by: 'x' }, { ...ch, sig: 'x' }, { ...ch, nonce: 'A' }, null]) assert.equal((await kitAccept(bob, Bb.v, null, bad)).why, 'not a challenge');
  assert.equal((await kitAccept(bob, Bb.v, null, { ...ch, nonce: 'n2' })).why, 'the challenge’s signature does not check');
});

test('kit duel: each kitted mind scores the batch both signatures draw; the receipt re-runs and the ladder reads it', async () => {
  const lo = (await equip(alice, A.v, [B.v, C.v])).loadout, sideA = { v: A.v, loadout: lo, nodes: [B.v, C.v] }, sideB = { v: Bb.v, loadout: null };
  const ch = (await kitChallenge(alice, A.v, lo, 'n1')).challenge, ac = (await kitAccept(bob, Bb.v, null, ch)).accept, signed = { challenge: ch, accept: ac };
  const d = await kitDuel(sideA, sideB, ground, signed);
  assert.equal(d.ok, true);
  const seed = seedOf(ch, ac), batch = batchOf(ground, seed), y = batch.map((i) => ground.ds.y[i]);
  assert.deepEqual(d.batch, batch);
  assert.deepEqual(d.y, y);
  const sa = scoresOn(kitted(A.v, [B.v, C.v], ground), ground, batch), sb = scoresOn(kitted(Bb.v, [], ground), ground, batch);
  assert.deepEqual(d.scores, { a: sa, b: sb });
  const a = Math.round(auc(sa, y) * 1e6), b = Math.round(auc(sb, y) * 1e6);
  assert.deepEqual(d.receipt, { kind: 'duel', data: ground.id, a: { card: A.v.id, head: A.v.head, kit: sha256Hex(canonical(lo)), auc: a }, b: { card: Bb.v.id, head: Bb.v.head, kit: ZERO, auc: b }, challenge: sha256Hex(canonical(ch)), accept: sha256Hex(canonical(ac)), seed, n: 64, winner: a > b ? 'a' : 'b', self: false });
  assert.ok(a > b, 'three departments, kitted, out-rank one');
  assert.equal(d.kits.a.slots.length, 2);
  assert.deepEqual(await kitRerun(d.receipt, sideA, sideB, ground, signed), { ok: true });
  assert.equal((await kitRerun({ ...d.receipt, b: { ...d.receipt.b, auc: 1 } }, sideA, sideB, ground, signed)).why, 're-fought here, it gives ' + a + ' against ' + b + ', not the receipt’s ' + a + ' against 1');
  assert.equal((await kitRerun({ ...d.receipt, winner: 'b' }, sideA, sideB, ground, signed)).why, 're-fought here, it gives ' + a + ' against ' + b + ', not the receipt’s ' + a + ' against ' + b);
  assert.match((await kitRerun(d.receipt, { ...sideA, nodes: [B.v] }, sideB, ground, signed)).why, /^the duel does not re-fight: /);
  for (const bad of [null, { ...d.receipt, kind: 'level' }, { ...d.receipt, a: 'x' }, { ...d.receipt, a: { ...d.receipt.a, kit: 'x' } }, { ...d.receipt, a: { card: A.v.id } }]) assert.equal((await kitRerun(bad, sideA, sideB, ground, signed)).why, 'not a kit duel receipt');
  const loT = (await equip(alice, A.v, [B.v], [app(alice)])).loadout, sideT = { v: A.v, loadout: loT, nodes: [B.v], tools: [app(alice)] };
  const chT = (await kitChallenge(alice, A.v, loT, 't1')).challenge, acT = (await kitAccept(bob, Bb.v, null, chT)).accept;
  const withTool = await kitDuel(sideT, sideB, ground, { challenge: chT, accept: acT });
  assert.equal(withTool.ok, true, 'a side carrying a tool fights');
  assert.deepEqual(withTool.scores.a, scoresOn(kitted(A.v, [B.v], ground), ground, withTool.batch), 'a tool changes no score');
  const twin = await cardOn([found('toy-b', 10)], { maker, owner: alice, name: 'toy-b-twin', serial: 11 });
  const chD = (await kitChallenge(alice, twin.v, null, 'd1')).challenge, acD = (await kitAccept(bob, Bb.v, null, chD)).accept;
  const drawn = await kitDuel({ v: twin.v, loadout: null }, sideB, ground, { challenge: chD, accept: acD });
  assert.deepEqual([drawn.receipt.a.auc === drawn.receipt.b.auc, drawn.receipt.winner], [true, 'draw'], 'the same mind on both sides: a draw');
  const chL = (await kitChallenge(bob, Bb.v, null, 'l1')).challenge, acL = (await kitAccept(alice, A.v, null, chL)).accept;
  const lost = await kitDuel(sideB, { v: A.v, loadout: null }, ground, { challenge: chL, accept: acL });
  assert.equal(lost.receipt.winner, lost.receipt.b.auc > lost.receipt.a.auc ? 'b' : 'a');
  const lad = ratings([d.receipt]);
  assert.equal(lad.ok, true);
  assert.equal(lad.ratings[A.v.id] + lad.ratings[Bb.v.id], 2000);
  assert.ok(lad.ratings[A.v.id] > 1000);
  const unsigned = await kitDuel({ v: A.v, loadout: null }, { v: (await cardOn([found('toy-a', 2)], { maker, owner: bob, name: 'toy-a-twin', serial: 9 })).v, loadout: null }, ground, {});
  assert.equal(unsigned.why, 'not a challenge');
});

test('kit duel: a forged, stale or mismatched side is refused by name', async () => {
  const lo = (await equip(alice, A.v, [B.v, C.v])).loadout, sideA = { v: A.v, loadout: lo, nodes: [B.v, C.v] }, sideB = { v: Bb.v, loadout: null };
  const ch = (await kitChallenge(alice, A.v, lo, 'n1')).challenge, ac = (await kitAccept(bob, Bb.v, null, ch)).accept, signed = { challenge: ch, accept: ac };
  const resigned = async (keys, e, over) => { const f = { ...Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig')), ...over, by: keys.pub }; return { ...f, sig: await sign(keys, utf8(canonical(f))) }; };
  const chZero = (await kitChallenge(alice, A.v, null, 'n1')).challenge, acZero = (await kitAccept(bob, Bb.v, null, chZero)).accept;
  const movedB = await verify((await addReceipt(B.d, alice, { kind: 'mesh' })).dossier);
  const cases = [
    [sideA, sideB, { challenge: null, accept: ac }, 'not a challenge'], [sideA, sideB, { challenge: ch, accept: null }, 'not an acceptance'],
    [sideA, sideB, { challenge: ch, accept: { ...ac, sig: 'f'.repeat(128) } }, 'the acceptance’s signature does not check'],
    [sideA, sideB, { challenge: ch, accept: (await kitAccept(bob, Bb.v, null, (await kitChallenge(alice, A.v, lo, 'n2')).challenge)).accept }, 'the acceptance is for another challenge'],
    [sideB, sideB, signed, 'the challenge is not for this card as it stands'], [sideA, sideA, signed, 'the acceptance is not for this card as it stands'],
    [{ ...sideA, v: await verify((await addReceipt(A.d, alice, { kind: 'mesh' })).dossier) }, sideB, signed, 'the challenge is not for this card as it stands'],
    [sideA, { ...sideB, v: await verify((await addReceipt(Bb.d, bob, { kind: 'mesh' })).dossier) }, signed, 'the acceptance is not for this card as it stands'],
    [{ v: null }, sideB, signed, 'both cards must check'], [sideA, { v: { ...Bb.v, ok: false } }, signed, 'both cards must check'], [null, sideB, signed, 'both cards must check'],
    [sideA, sideB, { challenge: await resigned(eve, ch, {}), accept: (await kitAccept(bob, Bb.v, null, await resigned(eve, ch, {}))).accept }, 'the challenge was not signed by its card’s owner'],
    [sideA, sideB, { challenge: ch, accept: await resigned(eve, ac, {}) }, 'the acceptance was not signed by its card’s owner'],
    [{ ...sideA, loadout: null }, sideB, signed, 'the challenge names another kit'], [sideA, { ...sideB, loadout: lo }, signed, 'the acceptance names another kit'],
    [{ v: A.v, loadout: null, nodes: [B.v] }, sideB, { challenge: chZero, accept: acZero }, 'a side with no loadout fields its card alone'],
    [{ v: A.v, loadout: null, tools: [app(alice)] }, sideB, { challenge: chZero, accept: acZero }, 'a side with no loadout fields its card alone'],
    [{ ...sideA, nodes: [movedB, C.v] }, sideB, signed, 'node 1 has changed since it was equipped: its owner equips it again'],
    [{ ...sideA, nodes: undefined }, sideB, signed, 'these are not the nodes and tools the loadout names'],
  ];
  for (const [a, b, s, why] of cases) assert.equal((await kitDuel(a, b, ground, s)).why, why, why);
  assert.equal((await kitDuel({ v: A.v, loadout: null }, sideB, ground, { challenge: chZero, accept: acZero })).ok, true, 'no loadout: the card alone, nodes and tools defaulting to none');
  // the same card on both sides, and a card that is dormant on this ground
  const selfCh = (await kitChallenge(alice, A.v, null, 'n1')).challenge, selfAc = await resigned(alice, { type: 'digi.kit-accept.v1', card: A.v.id, head: A.v.head, kit: ZERO, challenge: sha256Hex(canonical(selfCh)) }, {});
  assert.equal((await kitDuel({ v: A.v, loadout: null }, { v: A.v, loadout: null }, ground, { challenge: selfCh, accept: selfAc })).why, 'a card cannot fight itself');
  const zCh = (await kitChallenge(alice, Z.v, null, 'n1')).challenge, zAc = (await kitAccept(bob, Bb.v, null, zCh)).accept;
  assert.equal((await kitDuel({ v: Z.v, loadout: null }, sideB, ground, { challenge: zCh, accept: zAc })).why, 'both cards must answer on this ground: a card of another business is dormant here');
  const small = toy({ n: 200, departments: ['a', 'b'] });
  assert.equal((await kitDuel({ v: A.v, loadout: null }, sideB, small, { challenge: chZero, accept: acZero })).why, 'this ground holds fewer than 64 GATE cases');
  assert.equal((await kitDuel({ v: A.v, loadout: null }, sideB, null, { challenge: chZero, accept: acZero })).why, 'both cards must answer on this ground: a card of another business is dormant here');
  const self = await kitDuel({ v: A.v, loadout: null }, { v: B.v, loadout: null }, ground, { challenge: (await kitChallenge(alice, A.v, null, 's')).challenge, accept: (await kitAccept(alice, B.v, null, (await kitChallenge(alice, A.v, null, 's')).challenge)).accept });
  assert.equal(self.receipt.self, true);
  assert.equal(ratings([self.receipt]).skipped, 1);
});
