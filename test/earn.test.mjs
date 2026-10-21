// earn.test.mjs — a player's record is the estate's economy: it begins from the estate's very genesis, takes the drop's
// releases byte for byte as the estate's ledger holds them, the player's own releases signed by them, and a party's
// measured shares as values; every entry passes its gate, nothing counts twice, and the switch stays off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { begin, demoKeys, releaseOfDrop, releaseOfCard, releaseOfItem, valuesOfClear, gateFor, add, jobOf, PHRASES, POLICY, DROP_AT } from '../src/earn.mjs';
import * as earn from '../src/earn.mjs';
import { canonical, sha256, idOf, sign, record, empty, allocate, credits } from '../vendor/kcc-mesh/contrib.mjs';
import { seal } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { fixedOf } from '../src/mind.mjs';
import { mintApp, verifyItem, repoOf } from '../src/item.mjs';
import { stemGenome } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { key } from './helpers.mjs';

const json = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const manifest = json('drop/manifest.json'), organ6 = json('data/organ-6/record.json');
const first = { ...manifest.first, serial: 1 }, second = manifest.cards.find((c) => c.serial === 2);
const [alice, bob] = await Promise.all(['alice', 'bob'].map(key));
const AT = '2026-10-21T20:00:00Z';
const genomeOf = async (keys, name, parents = []) => (await seal({ name, parents, gate: { auc: 0.6 }, organs: [fixedOf('toy-a', 1, stemGenome())] }, keys)).text;
const A = await genomeOf(alice, 'toy-a'), B = await genomeOf(bob, 'toy-b');
const idOfGenome = async (text) => (await (await import('../vendor/dex-frontier/vendor/living-seed/src/genome.mjs')).open(text)).id;
const aId = await idOfGenome(A), bId = await idOfGenome(B);
const run = (n) => repoOf(n) + '/actions/runs/1';
const APPS = new Map([['ok', { app: 'ok', page: null, run: run('ok'), sha: 'a'.repeat(40), spdx: 'MIT', tier: 'works' }]]);
const resign = async (keys, e, over) => (await sign(keys, { ...Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig' && k !== 'by')), ...over })).entry;

test('the record begins from the estate’s very genesis, and takes the drop’s releases byte for byte as the estate holds them', async () => {
  const b = await begin(), { keeper, measurer, maker } = await demoKeys();
  assert.equal(b.ok, true);
  assert.equal(await idOf(b.genesis), '23515300306c165ebbb986eafeca3651b5c7203fa0852eef2d174416436c23cc', 'kcc-mesh ledger/digi.json entry 0');
  assert.deepEqual([b.ledger.genesis.activators, b.ledger.genesis.measurers, b.ledger.genesis.policy], [[keeper.pub], [measurer.pub], POLICY]);
  assert.deepEqual(PHRASES, { keeper: 'kcc-mesh/demo/keeper', measurer: 'kcc-mesh/demo/measurer', maker: 'digi-card/genesis/demo-maker' });
  assert.equal(maker.pub, manifest.maker);
  assert.equal(DROP_AT, '2026-10-21T12:28:08Z');
  const r = await releaseOfDrop(first);
  assert.equal(await idOf(r.entry), '962035496e746abe84c34f7e1fe61884ec42760e0a35997807b531e5f9a3d6f1', 'kcc-mesh ledger/digi.json entry 1');
  const gate = await gateFor({ manifest, organ6 });
  const l = await add(b.ledger, [r.entry, (await releaseOfDrop(second)).entry, r.entry], gate);
  assert.deepEqual([l.added, l.skipped, l.refused], [2, 1, []]);
  for (const x of [null, {}, { card: 'x' }, { card: 'x', serial: 1.5 }, { card: 5, serial: 1 }]) assert.equal((await releaseOfDrop(x)).why, 'a drop release names a card’s line in the manifest');
  const forged = await releaseOfDrop({ ...second, gate: second.gate + 1 });
  assert.equal((await gate(forged.entry)).why, 'the card’s line in the manifest is not the one this proof hashed');
  assert.equal((await (await gateFor({}))(r.entry)).why, 'this device holds no drop manifest');
});

test('a card its maker made: released by them, its proof the hash of its genome, its lineage its parents', async () => {
  const r = await releaseOfCard(alice, A, AT);
  assert.equal(r.ok, true);
  assert.deepEqual([r.entry.type, r.entry.asset, r.entry.form, r.entry.lineage, r.entry.at, r.entry.by], ['release', 'digi:' + aId, 'card', [], AT, alice.pub]);
  assert.deepEqual(r.entry.proofs, [{ kind: 'digi-card', ref: 'digi-card/genome/' + aId, digest: await sha256(A) }]);
  const genomes = new Map([['digi:' + aId, A], ['digi:' + bId, B]]), gate = await gateFor({ genomes });
  const l0 = (await begin()).ledger;
  assert.deepEqual((await add(l0, [r.entry], gate)).added, 1);
  assert.equal((await releaseOfCard(bob, A, AT)).why, 'only a card’s maker releases it');
  assert.equal((await releaseOfCard(null, A, AT)).why, 'only a card’s maker releases it');
  for (const t of ['x', 5, null]) assert.equal((await releaseOfCard(alice, t, AT)).why, 'only a genome that opens under its seal is released');
  for (const at of ['2026-10-21', 5, null, '2026-10-21T20:00:00.000Z']) assert.equal((await releaseOfCard(alice, A, at)).why, 'a release is dated: an ISO moment in whole seconds, UTC', String(at));
  assert.equal((await (await gateFor({}))(r.entry)).why, 'this device holds no genome for digi:' + aId);
  assert.equal((await gate(await resign(alice, r.entry, { proofs: [{ ...r.entry.proofs[0], digest: 'f'.repeat(64) }] }))).why, 'the genome here is not the one its proof hashed');
  assert.equal((await gate(await resign(bob, r.entry, {}))).why, 'its genome is not sealed by the one who released it');
  assert.equal((await gate(await resign(alice, r.entry, { asset: 'digi:' + bId }))).why, 'the genome here is not the one its proof hashed');
  const C = await genomeOf(alice, 'toy-c', [aId]), cId = await idOfGenome(C), child = await releaseOfCard(alice, C, AT);
  assert.deepEqual(child.entry.lineage, ['digi:' + aId]);
  const g2 = await gateFor({ genomes: new Map([...genomes, ['digi:' + cId, C]]) });
  const early = await add(l0, [child.entry], g2);
  assert.match(early.refused[0], /^its parent digi:[0-9a-f]{16} is not recorded here$/);
  const late = await add(l0, [r.entry, child.entry], g2);
  assert.deepEqual([late.added, late.refused], [2, []]);
});

test('an app item its maker minted: released by them, its proof the item’s id', async () => {
  const item = (await mintApp(alice, APPS, 'ok')).item, v = await verifyItem(item, APPS);
  const r = await releaseOfItem(alice, item, APPS, AT);
  assert.deepEqual([r.entry.asset, r.entry.form, r.entry.lineage, r.entry.proofs], ['item:' + v.id, 'app', [], [{ kind: 'mint-an-app', ref: run('ok'), digest: v.id }]]);
  const gate = await gateFor({ items: new Map([['item:' + v.id, item]]), apps: APPS });
  assert.deepEqual(await gate(r.entry), { ok: true });
  assert.equal((await releaseOfItem(bob, item, APPS, AT)).why, 'only an item’s maker releases it');
  assert.equal((await releaseOfItem(null, item, APPS, AT)).why, 'only an item’s maker releases it');
  assert.match((await releaseOfItem(alice, item, new Map(), AT)).why, /^only an item that checks is released: /);
  assert.equal((await releaseOfItem(alice, item, APPS, 'now')).why, 'a release is dated: an ISO moment in whole seconds, UTC');
  assert.match((await (await gateFor({ apps: APPS }))(r.entry)).why, /^its item does not check: this device holds no such item$/);
  assert.match((await (await gateFor({ items: new Map([['item:' + v.id, item]]), apps: new Map() }))(r.entry)).why, /^its item does not check: /);
  assert.equal((await gate(await resign(bob, r.entry, {}))).why, 'its item is not the one its proof names, minted by the one who released it');
  assert.equal((await gate(await resign(alice, r.entry, { proofs: [{ ...r.entry.proofs[0], digest: 'f'.repeat(64) }] }))).why, 'its item is not the one its proof names, minted by the one who released it');
});

test('a party strike: one value per fielded card with a share, signed by the demo measurer, gated by the strike struck again', async () => {
  const clear = { kind: 'clear', party: 'raid-toy', set: 'toy', data: 'toy:x', bar: 600000, gate: 650000, members: [{ card: aId, head: '0'.repeat(64), owner: alice.pub, contribution: 5, share: 700000 }, { card: bId, head: '0'.repeat(64), owner: bob.pub, contribution: 2, share: 300000 }, { card: 'c'.repeat(16), head: '0'.repeat(64), owner: bob.pub, contribution: 0, share: 0 }] };
  const v = await valuesOfClear(clear, AT), digest = await sha256(canonical(clear)), { measurer } = await demoKeys();
  assert.equal(v.digest, digest);
  assert.equal(v.entries.length, 2, 'a share of nothing is not a value');
  assert.deepEqual(Object.fromEntries(Object.entries(v.entries[0]).filter(([k]) => k !== 'sig')), { type: 'value', asset: 'digi:' + aId, basis: 'mesh-share', job: jobOf('toy', digest), units: 700000, proofs: [{ kind: 'digi-party', ref: 'digi-card/party/toy', digest }], at: AT, by: measurer.pub });
  assert.equal(jobOf('toy', digest), 'party-toy-' + digest.slice(0, 16));
  const genomes = new Map([['digi:' + aId, A], ['digi:' + bId, B]]), gate = await gateFor({ genomes, clears: new Map([[digest, clear]]) });
  const releases = [(await releaseOfCard(alice, A, AT)).entry, (await releaseOfCard(bob, B, AT)).entry];
  const l0 = (await begin()).ledger;
  const before = await add(l0, v.entries, gate);
  assert.deepEqual(before.refused, ['asset digi:' + aId + ' is not recorded here', 'asset digi:' + bId + ' is not recorded here'], 'a value needs its card released first');
  const l = await add(l0, [...releases, ...v.entries, ...v.entries], gate);
  assert.deepEqual([l.added, l.skipped, l.refused], [4, 2, []]);
  const c = credits(l.ledger);
  assert.equal(c.ok, true);
  assert.deepEqual([BigInt(c.credits[alice.pub]) + BigInt(c.credits[bob.pub]), c.scale], [3000000n, 2], 'a million units of shares, weighed 3/2 for being early, kept in halves');
  assert.equal(allocate(l.ledger).why, 'the switch is off: no allocation is live (a sandbox allocation can be computed by anyone)');
  assert.equal(l.ledger.switch, null);
  assert.equal((await gate(await resign(measurer, v.entries[0], { units: 1 }))).why, 'that strike did not measure this share for this card');
  assert.equal((await gate(await resign(measurer, v.entries[0], { job: 'party-toy-x' }))).why, 'its job is not that strike’s');
  assert.equal((await gate(await resign(measurer, v.entries[0], { asset: 'digi:' + 'd'.repeat(16) }))).why, 'that strike did not measure this share for this card');
  assert.equal((await (await gateFor({}))(v.entries[0])).why, 'this device has not struck that party again');
  const notMeasurer = await add(l.ledger, [await resign(alice, v.entries[0], { job: jobOf('toy', digest) + 'x' })], gate);
  assert.deepEqual(notMeasurer.refused, ['values are signed by a measurer the genesis names']);
  for (const x of [null, {}, { ...clear, kind: 'strike' }, { ...clear, set: 5 }, { ...clear, members: 'x' }, { ...clear, gate: 0.5 }]) assert.equal((await valuesOfClear(x, AT)).why, 'values are read off a party’s strike');
  assert.equal((await valuesOfClear(clear, 'today')).why, 'a value is dated: an ISO moment in whole seconds, UTC');
  assert.equal((await valuesOfClear({ ...clear, members: [null, { card: aId, share: -1 }, ...clear.members] }, AT)).entries.length, 2);
  assert.equal((await valuesOfClear({ ...clear, members: [...clear.members, { card: 'e'.repeat(16), share: 1 }] }, AT)).entries.length, 3, 'one unit is a value');
});

test('the estate’s own mesh values pass the drop’s gate; anything else has no gate here; the switch has no verb', async () => {
  const m = organ6.meshes[0], x = m.members.find((y) => y.share > 0), { measurer } = await demoKeys();
  const value = (await sign(measurer, { type: 'value', asset: 'digi:' + x.card, basis: 'mesh-share', job: 'organ6-' + m.set, units: x.share, proofs: [{ kind: 'digi-organ', ref: 'digi-card/data/organ-6/record.json#' + m.set, digest: await sha256(canonical(m)) }], at: DROP_AT })).entry;
  assert.deepEqual(await (await gateFor({ manifest, organ6 }))(value), { ok: true });
  assert.equal((await (await gateFor({}))(value)).why, 'this device holds no drop manifest');
  const gate = await gateFor({ manifest });
  assert.equal((await gate({ type: 'give', proofs: [{ kind: 'x' }] })).why, 'there is no gate here for a give proved by x');
  assert.equal((await gate({ type: 'value', proofs: [{ kind: 'digi-card' }] })).why, 'there is no gate here for a value proved by digi-card');
  assert.equal((await gate({ type: 'value', proofs: [{ kind: 'mint-an-app' }] })).why, 'there is no gate here for a value proved by mint-an-app');
  assert.equal((await gate({ type: 'release', proofs: [{ kind: 'digi-party' }] })).why, 'there is no gate here for a release proved by digi-party');
  for (const e of [null, {}, { proofs: [] }, { proofs: 'x' }]) assert.equal((await gate(e)).why, 'it carries no proof');
  assert.deepEqual(Object.keys(earn).filter((k) => /switch|activat|money|pay|cash|sell|trade|withdraw|convert|fiat/i.test(k)), []);
  assert.equal((await add(null, [], gate)).why, 'add records a list of entries into a ledger');
  assert.equal((await add((await begin()).ledger, 'x', gate)).why, 'add records a list of entries into a ledger');
  void empty; void record;
});
