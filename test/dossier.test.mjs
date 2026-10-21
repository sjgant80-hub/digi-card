// dossier.test.mjs — a DIGI card's life checks itself: issued by its maker, handed on by its owners, every link signed and
// chained; anything forged, reordered, dropped or re-wrapped is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issue, give, addReceipt, reskin, verify, encode, decode, facts, rarityOf, MAX_EVENTS, DATASETS } from '../src/dossier.mjs';
import { seal } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { encodeSeed, makeSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { fromSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, sha256Hex, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

const key = (s) => fromSeed(sha256Bytes(utf8('digi-card/test/' + s)));
const genomeOf = async (maker, name = 'credit-collections', parents = []) => (await seal({ name, parents, gate: { auc: 0.6 }, organs: [encodeSeed(makeSeed({ domain: name, seed: 1, grow: { population: 40, elites: 8, generations: 30 } }))] }, maker)).text;
const withSig = (e, sig) => ({ ...e, sig });

test('issue → give → receipt → skin: the owner moves with each give, and every fact reads back', async () => {
  const maker = await key('maker'), alice = await key('alice'), bob = await key('bob'), g = await genomeOf(maker);
  const a = await issue(g, maker, { serial: 7, to: alice.pub, theme: 'synthwave-v1', generation: 0 });
  assert.ok(a.ok, a.why);
  let v = await verify(a.dossier);
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.owner, v.maker, v.serial, v.theme, v.gives, v.receipts.length], [alice.pub, maker.pub, 7, 'synthwave-v1', 0, 0]);
  const b = await give(a.dossier, alice, bob.pub); assert.ok(b.ok, b.why);
  const c = await addReceipt(b.dossier, bob, { kind: 'level', before: 700000, after: 720000 }); assert.ok(c.ok, c.why);
  const d = await reskin(c.dossier, bob, 'blockcraft-v1'); assert.ok(d.ok, d.why);
  v = await verify(d.dossier);
  assert.deepEqual([v.owner, v.gives, v.receipts.length, v.theme], [bob.pub, 1, 1, 'blockcraft-v1']);
  assert.deepEqual(d.dossier.events.map((e) => e.type), ['issue', 'give', 'receipt', 'skin']);
  assert.deepEqual(d.dossier.events.map((e) => e.k), [undefined, 1, 2, 3]);
  assert.equal(d.dossier.events[0].prev, sha256Hex(g));
  assert.equal(d.dossier.events[2].prev, sha256Hex(canonical(d.dossier.events[1])));
  assert.deepEqual(facts(v), { id: v.id, title: 'Credit Collections', dataset: 'credit', department: 'collections', stage: 1, rarity: 'uncommon', generation: 0, parents: [] });
  assert.equal(v.head, sha256Hex(canonical(d.dossier.events[3])));
});

test('only the right key signs: the maker issues, the owner of the moment gives, re-skins and earns', async () => {
  const maker = await key('maker'), alice = await key('alice'), bob = await key('bob'), g = await genomeOf(maker);
  assert.equal((await issue(g, alice, { serial: 1, to: alice.pub, theme: 'synthwave-v1' })).why, 'only the genome’s own maker issues its card');
  const a = (await issue(g, maker, { serial: 1, to: alice.pub, theme: 'synthwave-v1' })).dossier;
  for (const r of [await give(a, bob, bob.pub), await give(a, maker, bob.pub), await reskin(a, bob, 'blockcraft-v1'), await addReceipt(a, maker, { k: 1 })]) assert.equal(r.why, 'only the card’s owner can sign its next event');
  const b = (await give(a, alice, bob.pub)).dossier;
  assert.equal((await give(b, alice, alice.pub)).why, 'only the card’s owner can sign its next event', 'a past owner cannot give it again from the chain');
  assert.equal((await verify(a, { trust: [bob.pub] })).why, 'the genome was refused: untrusted maker');
  assert.ok((await verify(a, { trust: [maker.pub] })).ok);
});

test('every forgery is refused: a changed field, a dropped or reordered event, a stolen signature, a re-wrapped form', async () => {
  const maker = await key('maker'), alice = await key('alice'), bob = await key('bob'), eve = await key('eve'), g = await genomeOf(maker);
  const a = (await issue(g, maker, { serial: 1, to: alice.pub, theme: 'synthwave-v1' })).dossier, b = (await give(a, alice, bob.pub)).dossier, c = (await reskin(b, bob, 'blockcraft-v1')).dossier;
  const [e0, e1, e2] = c.events, set = (k, f) => ({ ...c, events: c.events.map((e, j) => (j === k ? f(e) : e)) });
  const bad = {
    'a changed owner': [set(1, (e) => ({ ...e, to: eve.pub })), 'event 1’s signature does not check'],
    'a changed serial': [set(0, (e) => ({ ...e, serial: 2 })), 'event 0’s signature does not check'],
    'a changed theme': [set(2, (e) => ({ ...e, theme: 'synthwave-v1' })), 'event 2’s signature does not check'],
    'a dropped event': [{ ...c, events: [e0, e2] }, 'event 1 is not linked to the one before it'],
    'a reordered chain': [{ ...c, events: [e0, e2, e1] }, 'event 1 is not linked to the one before it'],
    'two issues': [{ ...c, events: [e0, e0] }, 'a card is issued once'],
    'no issue first': [{ ...c, events: [e1, e2] }, 'the first event is the issue'],
    'a signature from another event': [set(1, (e) => withSig(e, e2.sig)), 'event 1’s signature does not check'],
    'a stranger’s give': [set(1, (e) => ({ ...e, by: eve.pub })), 'event 1 was not signed by the card’s owner'],
    'a bad k': [set(1, (e) => ({ ...e, k: 5 })), 'event 1 is out of place'],
    'another card’s event': [set(1, (e) => ({ ...e, card: '0123456789abcdef' })), 'event 1 is for another card'],
    'an extra field': [set(1, (e) => ({ ...e, note: 'x' })), 'event 1 is not a dossier event'],
    'a missing field': [set(1, ({ k, ...e }) => e), 'event 1 is not a dossier event'],
    'an unknown type': [set(1, (e) => ({ ...e, type: 'sell' })), 'event 1 is not a dossier event'],
    'an event that is a list': [set(1, () => [1]), 'event 1 is not a dossier event'],
    'a null event': [set(1, () => null), 'event 1 is not a dossier event'],
    'a changed genome': [{ ...c, genome: c.genome.replace('credit-collections', 'credit-collectionz') }, 'the genome was refused: signature'],
    'a genome that is not text': [{ ...c, genome: 5 }, 'the genome was refused: not a genome'],
    'no events': [{ ...c, events: [] }, 'a dossier’s life begins with its issue'],
    'events not a list': [{ ...c, events: 'x' }, 'a dossier’s life begins with its issue'],
    'too many events': [{ ...c, events: Array(41).fill(e0) }, 'a card’s life is at most 40 events'],
    'not v1': [{ ...c, v: 2 }, 'not a version 1 dossier'],
    'a dossier that is a list': [[c], 'not a dossier'],
    'a malformed signature': [set(1, (e) => withSig(e, 'zz')), 'event 1 is not signed'],
    'a list where an owner key goes': [set(1, (e) => ({ ...e, to: [eve.pub] })), 'event 1: the owner is an Ed25519 public key'],
    'a list where a theme goes': [set(2, (e) => ({ ...e, theme: ['synthwave-v1'] })), 'event 2: the theme is a published theme id, like synthwave-v1'],
    'an issue by a stranger': [set(0, (e) => ({ ...e, by: eve.pub })), 'the card was not issued by its genome’s maker'],
  };
  for (const [what, [d, why]] of Object.entries(bad)) assert.equal((await verify(d)).why, why, what);
  assert.ok((await verify(c)).ok);
  const theirs = (await issue(g, maker, { serial: 1, to: eve.pub, theme: 'synthwave-v1' })).dossier;
  assert.equal((await verify({ ...c, events: [theirs.events[0], e1, e2] })).ok, false, 'a chain grafted onto another issue');
  for (const junk of [null, 'x', 5, {}, { v: 1 }]) assert.equal((await verify(junk)).why, 'not a dossier');
  assert.equal((await verify({ v: 1, genome: 'x', events: [{}] })).why, 'the genome was refused: not a genome');
  const text = encode(c);
  assert.deepEqual(decode(text).dossier, c);
  assert.equal(decode(text.replace('{', '{ ')).why, 'the dossier is not in its one byte form', 'whitespace is not its form');
  assert.equal(decode(JSON.stringify({ events: c.events, genome: c.genome, v: 1, x: 1 })).why, 'not a dossier');
  assert.equal(decode(JSON.stringify({ v: 1, events: c.events, genome: c.genome })).why, 'the dossier is not in its one byte form');
  for (const junk of [5, null, 'not json', '[]', '{"v":1}', 'x'.repeat(18000)]) assert.equal(decode(junk).why, 'not a dossier');
  assert.equal(decode('x'.repeat(18001)).why, 'a dossier is at most 18000 bytes');
  assert.equal(decode('€'.repeat(6000)).why, 'not a dossier', 'six thousand euro signs are 18000 bytes');
  assert.equal(decode('€'.repeat(6001)).why, 'a dossier is at most 18000 bytes', 'the bound is bytes, not characters');
});

test('the values a record must hold: serial, owner key, theme id, generation, receipt shape', async () => {
  const maker = await key('maker'), alice = await key('alice'), g = await genomeOf(maker);
  const ok = { serial: 1, to: alice.pub, theme: 'synthwave-v1', generation: 0 };
  assert.equal((await issue(g, maker, { ...ok, serial: 0 })).why, 'the serial is a whole number from 1');
  assert.equal((await issue(g, maker, { ...ok, serial: 1.5 })).why, 'the serial is a whole number from 1');
  assert.equal((await issue(g, maker, { ...ok, generation: 100 })).why, 'the generation is 0 to 99');
  assert.equal((await issue(g, maker, { ...ok, generation: -1 })).why, 'the generation is 0 to 99');
  assert.equal((await issue(g, maker, { ...ok, generation: 1.5 })).why, 'the generation is 0 to 99');
  assert.equal((await issue(g, maker, { ...ok, to: [alice.pub] })).why, 'the owner is an Ed25519 public key');
  assert.equal((await issue(g, maker, { ...ok, theme: ['synthwave-v1'] })).why, 'the theme is a published theme id, like synthwave-v1');
  assert.ok((await issue(g, maker, { ...ok, generation: 99 })).ok); assert.ok((await issue(g, maker, { ...ok, serial: 1 })).ok);
  assert.equal((await issue(g, maker, { ...ok, to: 'abc' })).why, 'the owner is an Ed25519 public key');
  for (const theme of ['synthwave', 'Synthwave-v1', 'x-v1', 'synthwave-v0', 'synthwave-v1000', 'a'.repeat(17) + '-v1']) assert.equal((await issue(g, maker, { ...ok, theme })).why, 'the theme is a published theme id, like synthwave-v1', theme);
  for (const theme of ['synthwave-v1', 'blockcraft-v12', 'ab-v999']) assert.ok((await issue(g, maker, { ...ok, theme })).ok, theme);
  assert.equal((await issue('not a genome', maker, ok)).why, 'only a genome that opens can be issued: not a genome');
  const a = (await issue(g, maker, ok)).dossier;
  for (const receipt of [null, [1], 'r']) assert.equal((await addReceipt(a, alice, receipt)).why, 'a receipt is a record');
  for (const receipt of [{ auc: 0.7 }, { x: NaN }, { x: undefined === 1 ? 1 : new Date(0) }]) assert.equal((await addReceipt(a, alice, receipt)).why, 'a receipt holds only whole numbers, text, lists and records (scores in millionths)');
  assert.equal((await give(a, alice, 'nope')).why, 'the owner is an Ed25519 public key');
  assert.equal((await reskin(a, alice, 'nope')).why, 'the theme is a published theme id, like synthwave-v1');
  assert.equal((await give({ v: 1, genome: g, events: [] }, alice, alice.pub)).why, 'only a dossier that checks can grow: a dossier’s life begins with its issue');
});

test('a card’s life is bounded: at most MAX_EVENTS events, and the band’s bytes', async () => {
  const maker = await key('maker'), alice = await key('alice'), g = await genomeOf(maker);
  let d = (await issue(g, maker, { serial: 1, to: alice.pub, theme: 'synthwave-v1' })).dossier;
  for (let k = 1; k < MAX_EVENTS; k++) d = (await reskin(d, alice, k % 2 ? 'blockcraft-v1' : 'synthwave-v1')).dossier;
  assert.equal(d.events.length, MAX_EVENTS);
  assert.ok((await verify(d)).ok);
  assert.equal((await reskin(d, alice, 'synthwave-v1')).why, 'the card’s life is full: carry it on to a fresh card');
  assert.equal((await verify({ ...d, events: [...d.events, d.events[1]] })).why, 'a card’s life is at most 40 events');
  const big = (await issue(g, maker, { serial: 1, to: alice.pub, theme: 'synthwave-v1' })).dossier;
  assert.equal((await addReceipt(big, alice, { pad: 'x'.repeat(18000) })).why, 'the card’s life no longer fits its band: carry it on to a fresh card');
  const room = 18000 - utf8(encode((await addReceipt(big, alice, { pad: '' })).dossier)).length;
  const full = await addReceipt(big, alice, { pad: 'x'.repeat(room) });
  assert.ok(full.ok, full.why); assert.equal(utf8(encode(full.dossier)).length, 18000, 'exactly the band’s bytes still fits');
  assert.equal((await addReceipt(big, alice, { pad: 'x'.repeat(room + 1) })).why, 'the card’s life no longer fits its band: carry it on to a fresh card');
  assert.equal(decode(encode(full.dossier)).ok, true, 'and still decodes');
  const euros = Math.floor(room / 3);
  assert.ok((await addReceipt(big, alice, { pad: '€'.repeat(euros) })).ok, 'a three-byte character counts three');
  assert.equal((await addReceipt(big, alice, { pad: '€'.repeat(euros + 1) })).why, 'the card’s life no longer fits its band: carry it on to a fresh card');
});

test('facts: the dataset and department from the genome’s organ, rarity by stage, a child’s parents and generation', async () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 9, 10, 99].map(rarityOf), ['common', 'uncommon', 'uncommon', 'rare', 'rare', 'epic', 'epic', 'legendary', 'legendary']);
  assert.deepEqual(DATASETS, ['telco', 'shop', 'bank', 'adult', 'hospital', 'credit']);
  const maker = await key('maker'), alice = await key('alice');
  const custom = await genomeOf(maker, 'my-own-churn-model-long-name-x');
  const v = await verify((await issue(custom, maker, { serial: 3, to: alice.pub, theme: 'synthwave-v1' })).dossier);
  assert.deepEqual(facts(v), { id: v.id, title: 'My Own Churn Model Long', dataset: 'custom', department: 'my-own-churn-mod', stage: 0, rarity: 'common', generation: 0, parents: [] });
  const bare = await genomeOf(maker, 'telco');
  assert.equal(facts(await verify((await issue(bare, maker, { serial: 1, to: alice.pub, theme: 'synthwave-v1' })).dossier)).dataset, 'custom', 'a dataset name alone, with no department, is custom');
  const p1 = '0123456789abcdef', p2 = 'fedcba9876543210', child = await genomeOf(maker, 'telco-account', [p1, p2]);
  const cv = await verify((await issue(child, maker, { serial: 9, to: alice.pub, theme: 'blockcraft-v1', generation: 2 })).dossier);
  assert.deepEqual(facts(cv), { id: cv.id, title: 'Telco Account', dataset: 'telco', department: 'account', stage: 0, rarity: 'common', generation: 2, parents: [p1, p2] });
  let d = (await issue(child, maker, { serial: 9, to: alice.pub, theme: 'blockcraft-v1' })).dossier;
  for (let k = 0; k < 12; k++) d = (await addReceipt(d, alice, { kind: 'level', n: k })).dossier;
  for (const other of [{ kind: 'drop', n: 1 }, { kind: 'levels', n: 2 }, { n: 3 }, { kind: 'Level' }]) d = (await addReceipt(d, alice, other)).dossier;
  const f = facts(await verify(d));
  assert.deepEqual([f.stage, f.rarity], [12, 'legendary'], 'only levels count toward the stage');
  const two = async (domains) => (await seal({ name: 'two-departments', parents: [p1], gate: { auc: 0.6 }, organs: domains.map((dm) => encodeSeed(makeSeed({ domain: dm, seed: 1, grow: { population: 40, elites: 8, generations: 30 } }))) }, maker)).text;
  const across = facts(await verify((await issue(await two(['credit-customer', 'credit-payments']), maker, { serial: 4, to: alice.pub, theme: 'synthwave-v1', generation: 1 })).dossier));
  assert.deepEqual([across.dataset, across.department, across.title], ['credit', 'customer+payment', 'Two Departments'], 'a child of two departments shows both');
  const mixed = facts(await verify((await issue(await two(['credit-customer', 'telco-account']), maker, { serial: 5, to: alice.pub, theme: 'synthwave-v1' })).dossier));
  assert.deepEqual([mixed.dataset, mixed.department], ['custom', 'credit-customer'], 'two datasets: custom, cut at sixteen');
  const trail = facts(await verify((await issue(await two(['credit-customer', 'credit-x']), maker, { serial: 6, to: alice.pub, theme: 'synthwave-v1' })).dossier));
  assert.deepEqual([trail.dataset, trail.department], ['credit', 'customer+x']);
  const cut = facts(await verify((await issue(await two(['credit-abcdefghijklmno', 'credit-x']), maker, { serial: 7, to: alice.pub, theme: 'synthwave-v1' })).dossier));
  assert.equal(cut.department, 'abcdefghijklmno', 'a join cut at sixteen drops its dangling plus');
});
