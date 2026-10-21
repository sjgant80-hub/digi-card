// data.test.mjs — a ground is opened only on its published bytes; its departments are the dex-frontier cuts; an owner's
// own table becomes a ground with its question bound into its id; every bad file is refused with its reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SETS, IDS, idOf, openSet, viewOf, departments, ownGround, digest, MAX_OWN, MAX_OWN_ROWS } from '../src/data.mjs';
import { sha256Bytes, toHexStr, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';

const file = (name) => new Uint8Array(readFileSync(new URL('../data/' + name, import.meta.url)));

test('the six bundled sets: published hashes, ids from them, and the departments each is cut into', async () => {
  assert.deepEqual(Object.keys(SETS), ['telco', 'shop', 'bank', 'adult', 'hospital', 'credit']);
  for (const [s, d] of Object.entries(SETS)) {
    assert.equal(IDS[s], idOf(s, d.files));
    assert.match(IDS[s], new RegExp('^' + s + ':[0-9a-f]{16}$'));
    for (const [f, h] of Object.entries(d.files)) assert.equal(await digest(file(f)), h, f + ' is the committed byte for byte');
  }
  assert.equal(idOf('x', { a: '1', b: '2' }), 'x:' + toHexStr(sha256Bytes(utf8('a 1\nb 2'))).slice(0, 16));
  assert.equal(await digest(utf8('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const g = await openSet('telco', { 'telco-churn.csv': file('telco-churn.csv') });
  assert.deepEqual([g.ok, g.id, g.set, g.ds.n], [true, IDS.telco, 'telco', 7043]);
  assert.deepEqual(departments(g), ['telco-customer', 'telco-services', 'telco-account']);
  const v = viewOf(g, 'telco-account');
  assert.deepEqual([v.name, v.features, v.trainRows, v.heldRows], ['telco-account', g.ds.silos.account, g.ds.fitRows, g.ds.gateRows]);
  assert.ok(g.ds.testRows.every((i) => !v.trainRows.includes(i) && !v.heldRows.includes(i)), 'TEST is apart from FIT and GATE');
  for (const d of ['telco-nothing', 'shop-browsing', 'telco-', 'telco', 'telco-constructor', null, 7]) assert.equal(viewOf(g, d), null, String(d));
  const a = await openSet('adult', { 'adult.data': file('adult.data'), 'adult.test': file('adult.test') });
  assert.deepEqual([a.ok, departments(a)], [true, ['adult-person', 'adult-work', 'adult-employer', 'adult-tax']]);
});

test('a set is opened only on the published bytes: a missing, changed or unreadable file is refused by name', async () => {
  const t = file('telco-churn.csv'), changed = t.slice(); changed[100] ^= 1;
  assert.equal((await openSet('telco', {})).why, 'data/telco-churn.csv is missing');
  assert.equal((await openSet('telco')).why, 'data/telco-churn.csv is missing');
  assert.equal((await openSet('telco', { 'telco-churn.csv': [...t] })).why, 'data/telco-churn.csv is missing', 'bytes, not a list');
  assert.equal((await openSet('telco', { 'telco-churn.csv': changed })).why, 'data/telco-churn.csv is not the published bytes');
  assert.equal((await openSet('adult', { 'adult.data': file('adult.data') })).why, 'data/adult.test is missing');
  assert.equal((await openSet('mars', {})).why, 'there is no bundled set called mars');
  assert.equal((await openSet('constructor', {})).why, 'there is no bundled set called constructor');
  assert.equal((await openSet(5, {})).why, 'there is no bundled set called 5');
  const junk = utf8('not,a\ntable'), saved = SETS.fake;
  SETS.fake = { files: { 'junk.csv': toHexStr(sha256Bytes(junk)) }, read: () => ({ ok: false, error: 'no rows' }) };
  try { assert.equal((await openSet('fake', { 'junk.csv': junk })).why, 'data/junk.csv could not be read: no rows'); } finally { delete SETS.fake; assert.equal(saved, undefined); }
});

test('an owner’s own table: numeric columns are its measurements, the question is bound into its id, and it is cut the same seeded way', () => {
  const rows = Array.from({ length: 200 }, (_, i) => [i % 50, (i * 37) % 100, i % 3 ? 'north' : 'south', i % 4 === 0 ? 'yes' : 'no'].join(','));
  const text = ['tenure,spend,region,left', ...rows].join('\n');
  const g = ownGround(text, { target: 'left', positive: 'yes', name: 'my-shop' });
  assert.ok(g.ok, g.why);
  assert.deepEqual([g.set, g.custom, g.used, g.left, g.ds.n, g.ds.features, g.ds.silos], ['own', true, ['tenure', 'spend'], ['region'], 200, ['tenure', 'spend'], { 'my-shop': ['tenure', 'spend'] }]);
  assert.match(g.id, /^own:[0-9a-f]{16}$/);
  assert.equal(g.ds.y.reduce((a, b) => a + b, 0), 50);
  assert.deepEqual([g.ds.fitRows.length + g.ds.gateRows.length + g.ds.testRows.length, new Set([...g.ds.fitRows, ...g.ds.gateRows, ...g.ds.testRows]).size], [200, 200]);
  assert.deepEqual([g.view.name, g.view.trainRows, g.view.heldRows, viewOf(g, 'my-shop'), viewOf(g, 'other')], ['my-shop', g.ds.fitRows, g.ds.gateRows, g.view, null]);
  assert.deepEqual(departments(g), ['my-shop']);
  assert.deepEqual(ownGround(text, { target: 'left', positive: 'yes', name: 'my-shop' }), g, 'the same table is the same ground');
  assert.notEqual(ownGround(text, { target: 'left', positive: 'no', name: 'my-shop' }).id, g.id, 'another question is another ground');
  assert.notEqual(ownGround(text, { target: 'left', positive: 'yes', name: 'my-shop-2' }).id, g.id);
  assert.notEqual(ownGround(text + '\n1,2,north,yes', { target: 'left', positive: 'yes', name: 'my-shop' }).id, g.id);
  const crlf = ownGround(text.split('\n').join('\r\n'), { target: 'left', positive: 'yes', name: 'my-shop' });
  assert.deepEqual([crlf.ds.n, crlf.used], [200, ['tenure', 'spend']], 'Windows line ends read the same');
  const quoted = ownGround(['"tenure","left"', ...Array.from({ length: 40 }, (_, i) => '"' + i + '","' + (i % 2 ? 'y' : 'n') + '"')].join('\n'), { target: 'left', positive: 'y', name: 'q' });
  assert.deepEqual([quoted.ok, quoted.used, quoted.ds.cols.tenure[5]], [true, ['tenure'], 5]);
  const wide = ownGround([Array.from({ length: 20 }, (_, k) => 'c' + k).join(',') + ',t', ...Array.from({ length: 30 }, (_, i) => [...Array.from({ length: 20 }, (_, k) => i * k), i % 2].join(','))].join('\n'), { target: 't', positive: '1', name: 'wide' });
  assert.deepEqual([wide.used.length, wide.left], [16, ['c16', 'c17', 'c18', 'c19']], 'at most sixteen measurements, the rest said');
  assert.equal(ownGround(['x,t', ...Array.from({ length: 30 }, (_, i) => '1e3,' + (i % 2))].join('\n'), { target: 't', positive: '1', name: 'sci' }).ds.cols.x[0], 1000);
});

test('an owner’s table is refused, with its reason, for every way it can be wrong', () => {
  const good = ['a,t', ...Array.from({ length: 30 }, (_, i) => i + ',' + (i % 2))].join('\n'), q = { target: 't', positive: '1', name: 'ok' };
  const cases = {
    'nothing': ['', q, 'the table is empty'],
    'not text': [5, q, 'the table is empty'],
    'too big': ['x'.repeat(MAX_OWN + 1), q, 'the table is larger than 8 MB'],
    'a bad name': [good, { ...q, name: 'My Shop' }, 'the name is lower-case letters, digits and hyphens, at most 24, starting with a letter'],
    'a long name': [good, { ...q, name: 'a'.repeat(25) }, 'the name is lower-case letters, digits and hyphens, at most 24, starting with a letter'],
    'no name': [good, { target: 't', positive: '1' }, 'the name is lower-case letters, digits and hyphens, at most 24, starting with a letter'],
    'a header only': ['a,t\n1,0', q, 'the table needs a header and at least two rows'],
    'a twice-named column': [good.replace('a,t', 't,t'), q, 'two columns share a name'],
    'no such column': [good, { ...q, target: 'z' }, 'there is no column called z'],
    'a ragged row': [good + '\n1,2,3', q, 'row 31 has 3 cells, not 2'],
    'too few cases': [['a,t', ...Array.from({ length: 30 }, (_, i) => i + ',' + (i < 9 ? 1 : 0))].join('\n'), q, 'the column to predict needs at least ten rows of each answer (it has 9 of 1)'],
    'too few others': [['a,t', ...Array.from({ length: 30 }, (_, i) => i + ',' + (i < 21 ? 1 : 0))].join('\n'), q, 'the column to predict needs at least ten rows of each answer (it has 21 of 1)'],
    'no numbers': [['a,t', ...Array.from({ length: 30 }, (_, i) => 'w' + i + ',' + (i % 2))].join('\n'), q, 'no column besides the one to predict is a number on every row'],
  };
  for (const [what, [text, opts, why]] of Object.entries(cases)) assert.equal(ownGround(text, opts).why, why, what);
  assert.ok(ownGround(['a,t', ...Array.from({ length: 30 }, (_, i) => i + ',' + (i < 10 ? 1 : 0))].join('\n'), q).ok, 'ten of each is enough');
  assert.ok(ownGround(['a,t', ...Array.from({ length: 30 }, (_, i) => i + ',' + (i < 20 ? 1 : 0))].join('\n'), q).ok);
  assert.ok(ownGround(good, { ...q, name: 'a'.repeat(24) }).ok);
  assert.ok(ownGround(good + '\n'.repeat(MAX_OWN - good.length), q).ok, 'exactly 8 MB is not larger than 8 MB');
  assert.equal(ownGround('a,t\n1,1\n2,0', q).why, 'the column to predict needs at least ten rows of each answer (it has 1 of 1)', 'a header and two rows is a table');
  assert.ok(ownGround(['t,a', ...Array.from({ length: 30 }, (_, i) => (i % 2) + ',' + i)].join('\n'), q).ok, 'the column to predict may come first');
  assert.equal(ownGround(['a,t', ...Array.from({ length: MAX_OWN_ROWS + 1 }, (_, i) => '1,' + (i % 2))].join('\n'), q).why, 'the table has more than 200,000 rows');
  assert.ok(ownGround(['a,t', ...Array.from({ length: MAX_OWN_ROWS }, (_, i) => '1,' + (i % 2))].join('\n'), q).ok, 'exactly the most rows is fine');
});
