// item.test.mjs — an app item names an app exactly as mint-an-app's records hold it (mintable, a tier that ran, its own
// commit and run); it is minted signed, handed on by its holder, and anything else in its life is refused by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appsOf, mintApp, giveItem, verifyItem, repoOf, ITEM, FORMS, TIERS, BODY, MAX_EVENTS, ZERO } from '../src/item.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { key } from './helpers.mjs';

const read = (f) => JSON.parse(readFileSync(new URL('../vendor/mint-an-app/' + f, import.meta.url), 'utf8'));
const APPS = appsOf(read('catalogue-data.json'), read('mint-data.json'));
const [alice, bob, eve] = await Promise.all(['alice', 'bob', 'eve'].map(key));
const signed = async (keys, fields) => ({ ...fields, by: keys.pub, sig: await sign(keys, utf8(canonical({ ...fields, by: keys.pub }))) });
const run = (n, id = 1) => repoOf(n) + '/actions/runs/' + id;

test('the apps: every mintable app of a tier that ran, with its own commit and run, from the vendored records', () => {
  assert.equal(APPS.size, 337);
  assert.deepEqual(APPS.get('acg-assessor'), { app: 'acg-assessor', page: 'https://sjgant80-hub.github.io/acg-assessor/', run: 'https://github.com/sjgant80-hub/acg-assessor/actions/runs/35138819759', sha: '61e8dd7a4602db20f98cfd42b1ba98f7eb351b83', spdx: 'MIT', tier: 'proven' });
  const all = [...APPS.values()];
  assert.ok(all.every((b) => Object.keys(b).sort().join() === BODY.join() && TIERS.includes(b.tier) && b.run.startsWith(repoOf(b.app) + '/actions/runs/')));
  assert.deepEqual([all.filter((b) => b.tier === 'proven').length, all.filter((b) => b.tier === 'works').length], [211, 126]);
  assert.deepEqual([all.filter((b) => b.page === null).length, all.filter((b) => b.spdx === null).length], [34, 71]);
  assert.equal(repoOf('x'), 'https://github.com/sjgant80-hub/x');
});

test('the apps: a row that is not mintable, has not run, or whose record is not its own is left out', () => {
  const rec = (sha = 'a'.repeat(40), runUrl = run('ok')) => ({ sha, runUrl, spdx: 'MIT' });
  const rows = [
    { name: 'ok', tier: 'works', mintEligible: true, url: 'https://sjgant80-hub.github.io/ok/' },
    { name: 'nopage', tier: 'proven', mintEligible: true, url: 'https://elsewhere.example/nopage/' },
    { name: 'shut', tier: 'proven', mintEligible: false, url: null }, { name: 'shut2', tier: 'proven', mintEligible: 'yes', url: null },
    { name: 'proto', tier: 'prototype', mintEligible: true, url: null }, { name: 'bad name', tier: 'works', mintEligible: true, url: null },
    { name: 5, tier: 'works', mintEligible: true }, { name: 'norec', tier: 'works', mintEligible: true }, { name: 'badsha', tier: 'works', mintEligible: true },
    { name: 'norun', tier: 'works', mintEligible: true }, { name: 'otherrun', tier: 'works', mintEligible: true }, { name: 'a.b', tier: 'works', mintEligible: true },
    { name: 'a.c', tier: 'works', mintEligible: true }, { name: 'runtail', tier: 'works', mintEligible: true }, { name: 'constructor', tier: 'works', mintEligible: true },
    { name: 'oddspdx', tier: 'works', mintEligible: true }, 'junk', null, { name: 'x'.repeat(101), tier: 'works', mintEligible: true },
  ];
  const own = (n) => rec(undefined, run(n));   // a record that is otherwise its own: only the rule under test can leave it out
  const apps = { ok: rec(), nopage: { ...rec(), runUrl: run('nopage') }, shut: own('shut'), shut2: own('shut2'), proto: own('proto'), 'bad name': own('bad name'), 5: own('5'), badsha: rec('A'.repeat(40), run('badsha')), norun: { ...rec(), runUrl: null }, otherrun: rec(undefined, run('ok')),
    'a.b': rec(undefined, run('a.b')), 'a.c': rec(undefined, 'https://github.com/sjgant80-hub/aXc/actions/runs/1'), runtail: rec(undefined, run('runtail') + '/x'), oddspdx: { ...rec(undefined, run('oddspdx')), spdx: 7 }, ['x'.repeat(101)]: own('x'.repeat(101)) };
  const got = appsOf({ rows }, { apps });
  assert.deepEqual([...got.keys()], ['ok', 'nopage', 'a.b', 'oddspdx']);
  assert.deepEqual(got.get('ok'), { app: 'ok', page: 'https://sjgant80-hub.github.io/ok/', run: run('ok'), sha: 'a'.repeat(40), spdx: 'MIT', tier: 'works' });
  assert.equal(got.get('nopage').page, null);
  assert.equal(got.get('oddspdx').spdx, null);
  assert.equal(appsOf({ rows: [{ name: 'a.c', tier: 'works', mintEligible: true }] }, { apps: { 'a.c': rec(undefined, 'https://github.com/sjgant80-hub/aXc/actions/runs/1') } }).size, 0, 'a dot in the name is a dot');
  for (const [c, m] of [[null, { apps }], [{ rows: 'x' }, { apps }], [{ rows }, null], [{ rows }, { apps: 'x' }], ['x', 'y']]) assert.equal(appsOf(c, m).size, 0);
});

test('mint: signed by the minter, held first by it or by the key it names; anything not listed is refused', async () => {
  const r = await mintApp(alice, APPS, 'acg-assessor');
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.item).sort(), ['events', 'kind', 'v']);
  assert.deepEqual([r.item.v, r.item.kind, r.item.events.length], [1, ITEM, 1]);
  const m = r.item.events[0];
  assert.deepEqual(Object.keys(m).sort(), ['body', 'by', 'form', 'prev', 'sig', 'to', 'type']);
  assert.deepEqual([m.type, m.form, m.body, m.to, m.prev, m.by], ['mint', 'app', APPS.get('acg-assessor'), alice.pub, ZERO, alice.pub]);
  assert.match(m.sig, /^[0-9a-f]{128}$/);
  assert.equal((await mintApp(alice, APPS, 'acg-assessor', { to: bob.pub })).item.events[0].to, bob.pub);
  assert.deepEqual(FORMS, ['app']);
  assert.equal((await mintApp(null, APPS, 'acg-assessor')).why, 'an item is minted with an Ed25519 key');
  assert.equal((await mintApp({ pub: 'x' }, APPS, 'acg-assessor')).why, 'an item is minted with an Ed25519 key');
  assert.equal((await mintApp({}, APPS, 'acg-assessor')).why, 'an item is minted with an Ed25519 key');
  assert.equal((await mintApp(alice, APPS, 'no-such-app')).why, 'the estate’s records list no mintable app called no-such-app');
  assert.equal((await mintApp(alice, {}, 'acg-assessor')).why, 'the estate’s records list no mintable app called acg-assessor');
  assert.equal((await mintApp(alice, APPS, 'x'.repeat(150))).why, 'the estate’s records list no mintable app called ' + 'x'.repeat(100));
  for (const to of ['x', 5, null]) assert.equal((await mintApp(alice, APPS, 'acg-assessor', { to })).why, 'an item’s holder is an Ed25519 public key', String(to));
});

test('verify: an item checks against the records; its id is its mint’s hash; a changed or unlisted app does not check', async () => {
  const item = (await mintApp(alice, APPS, 'acg-assessor')).item, m = item.events[0];
  assert.deepEqual(await verifyItem(item, APPS), { ok: true, id: sha256Hex(canonical(m)), form: 'app', body: m.body, maker: alice.pub, owner: alice.pub, gives: 0, head: sha256Hex(canonical(m)) });
  const remint = async (over) => ({ ...item, events: [await signed(alice, { ...Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'sig' && k !== 'by')), ...over })] });
  const listed = 'the estate’s records do not list this app at this commit, run, tier and licence';
  const cases = [
    [null, 'not an item'], ['x', 'not an item'], [{ ...item, extra: 1 }, 'not an item'], [{ ...item, v: 2 }, 'not an item'], [{ ...item, kind: 'digi.v1' }, 'not an item'],
    [{ ...item, events: [] }, 'an item’s life begins with its mint'], [{ ...item, events: 'x' }, 'an item’s life begins with its mint'],
    [{ ...item, events: Array.from({ length: MAX_EVENTS + 1 }, () => m) }, 'an item’s life is at most 40 events'],
    [{ ...item, events: [{ ...m, extra: 1 }] }, 'the first event is the item’s mint'], [await remint({ type: 'give' }), 'the first event is the item’s mint'],
    [await remint({ form: 'trophy' }), 'the first event is the item’s mint'], [await remint({ prev: 'f'.repeat(64) }), 'the first event is the item’s mint'],
    [{ ...item, events: [{ ...m, by: 'x' }] }, 'the first event is the item’s mint'], [{ ...item, events: [{ ...m, to: 'x' }] }, 'the first event is the item’s mint'],
    [{ ...item, events: [{ ...m, sig: 'x' }] }, 'the first event is the item’s mint'], [await remint({ body: { ...m.body, extra: 1 } }), 'the first event is the item’s mint'], [await remint({ body: 'x' }), 'the first event is the item’s mint'],
    [{ ...item, events: [{ ...m, to: bob.pub }] }, 'the mint’s signature does not check'],
    [await remint({ body: { ...m.body, sha: 'b'.repeat(40) } }), listed], [await remint({ body: { ...m.body, tier: 'works' } }), listed], [await remint({ body: { ...m.body, spdx: null } }), listed],
    [await remint({ body: { ...m.body, run: m.body.run + '0' } }), listed], [await remint({ body: { ...m.body, page: null } }), listed], [await remint({ body: { ...m.body, app: 'no-such-app' } }), listed],
  ];
  for (const [x, why] of cases) assert.equal((await verifyItem(x, APPS)).why, why, why);
  assert.equal((await verifyItem(item, new Map())).why, listed);
  assert.equal((await verifyItem(item, null)).why, listed);
  assert.equal((await verifyItem(item, {})).why, listed);
  const recast = await remint({ body: APPS.get('KonomiLang') });
  assert.equal((await verifyItem(recast, APPS)).ok, true, 'any listed app, exactly as listed');
});

test('give: the holder hands it on; every later event is the holder’s of its moment and linked to the one before', async () => {
  const item = (await mintApp(alice, APPS, 'acg-assessor')).item, id = (await verifyItem(item, APPS)).id;
  const one = (await giveItem(item, alice, bob.pub, APPS)).item;
  assert.equal(one.events.length, 2);
  const g = one.events[1];
  assert.deepEqual(Object.keys(g).sort(), ['by', 'item', 'k', 'prev', 'sig', 'to', 'type']);
  assert.deepEqual([g.type, g.item, g.k, g.prev, g.to, g.by], ['give', id, 1, id, bob.pub, alice.pub]);
  const v1 = await verifyItem(one, APPS);
  assert.deepEqual([v1.ok, v1.owner, v1.gives, v1.maker, v1.head], [true, bob.pub, 1, alice.pub, sha256Hex(canonical(g))]);
  const two = (await giveItem(one, bob, eve.pub, APPS)).item;
  assert.deepEqual([(await verifyItem(two, APPS)).owner, two.events[2].k, two.events[2].prev], [eve.pub, 2, sha256Hex(canonical(g))]);
  assert.equal((await giveItem(one, alice, eve.pub, APPS)).why, 'only the item’s holder can hand it on');
  assert.equal((await giveItem(one, null, eve.pub, APPS)).why, 'only the item’s holder can hand it on');
  for (const to of ['x', null, 7]) assert.equal((await giveItem(one, bob, to, APPS)).why, 'an item’s holder is an Ed25519 public key');
  assert.equal((await giveItem({ ...item, v: 2 }, alice, bob.pub, APPS)).why, 'only an item that checks can be handed on: not an item');
  assert.equal((await giveItem(item, alice, bob.pub, new Map())).why, 'only an item that checks can be handed on: the estate’s records do not list this app at this commit, run, tier and licence');
  let full = item, k = 0;
  while (full.events.length < MAX_EVENTS) full = (await giveItem(full, k++ % 2 ? bob : alice, k % 2 ? bob.pub : alice.pub, APPS)).item;
  assert.equal((await verifyItem(full, APPS)).gives, MAX_EVENTS - 1);
  assert.equal((await giveItem(full, (await verifyItem(full, APPS)).owner === alice.pub ? alice : bob, eve.pub, APPS)).why, 'the item’s life is full');
  const regive = async (keys, over) => ({ ...one, events: [one.events[0], await signed(keys, { ...Object.fromEntries(Object.entries(g).filter(([kk]) => kk !== 'sig' && kk !== 'by')), ...over })] });
  const cases = [
    [{ ...one, events: [one.events[0], { ...g, extra: 1 }] }, 'event 1 is not a give'], [await regive(alice, { type: 'mint' }), 'event 1 is not a give'], [{ ...one, events: [one.events[0], null] }, 'event 1 is not a give'],
    [await regive(alice, { item: 'f'.repeat(64) }), 'event 1 is for another item'],
    [await regive(alice, { k: 2 }), 'event 1 is not linked to the one before it'], [await regive(alice, { prev: 'f'.repeat(64) }), 'event 1 is not linked to the one before it'],
    [await regive(bob, {}), 'event 1 was not signed by the item’s holder'],
    [{ ...one, events: [one.events[0], { ...g, to: 'x' }] }, 'event 1 is not a give'], [{ ...one, events: [one.events[0], { ...g, sig: 'x' }] }, 'event 1 is not a give'],
    [{ ...one, events: [one.events[0], { ...g, to: eve.pub }] }, 'event 1’s signature does not check'],
  ];
  for (const [x, why] of cases) assert.equal((await verifyItem(x, APPS)).why, why, why);
});
