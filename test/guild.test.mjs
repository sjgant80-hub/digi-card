// guild.test.mjs — a guild is exactly the keys that each signed a join for it, each by its highest clean number; a forged,
// borrowed, foreign, doubled or thirteenth member is refused with its reason; the guild is the same in any order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, leave, statementOk, guildOf, GUILD, MAX_MEMBERS, MAX_STATEMENTS, MAX_BYTES } from '../src/guild.mjs';
import def from '../src/guild.mjs';
import { fromSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

const key = (k) => fromSeed(sha256Bytes(utf8('guild-test/' + k)));
const card = (n, extra = {}) => ({ id: n.toString(16).padStart(16, '0'), dataset: 'telco', department: 'customer', stage: 1, rarity: 'common', generation: 0, ...extra });
const estate = (n = 1) => ({ cards: Array.from({ length: n }, (_, i) => card(i + 1)), levels: n, items: [], swarms: [], districts: ['scorer', 'tools', 'swarm'], names: { swarm: 'KITTED' } });
const ids = (g) => g.members.map((m) => m.by);

test('a key joins by its own signature, carrying its estate; the guild reads it back', async () => {
  const a = await key('a'), j = await join(a, 'night-owls', estate(2), 1);
  assert.equal(j.ok, true, j.why);
  assert.deepEqual(Object.keys(j.statement).sort(), ['act', 'by', 'guild', 'holdings', 'kind', 'n', 'sig']);
  assert.deepEqual([j.statement.kind, j.statement.act, j.statement.by, j.statement.n], [GUILD, 'join', a.pub, 1]);
  assert.deepEqual(await statementOk(j.statement, 'night-owls'), { ok: true });
  const g = await guildOf([j.statement], 'night-owls');
  assert.deepEqual([g.ok, g.guild, ids(g), g.members[0].cards, g.members[0].levels, g.members[0].n, g.refused], [true, 'night-owls', [a.pub], 2, 2, 1, []]);
  assert.deepEqual(g.members[0].holdings, estate(2), 'the estate is exactly what it signed');
  assert.equal(def, guildOf);
  assert.deepEqual([MAX_MEMBERS, MAX_STATEMENTS, MAX_BYTES], [12, 240, 65536]);
  const noLevels = await join(a, 'night-owls', { ...estate(1), levels: null }, 1);
  assert.equal((await guildOf([noLevels.statement], 'night-owls')).members[0].levels, 0, 'an estate with no level count counts none');
});

test('nobody joins anybody else: forged, borrowed, foreign and malformed statements are refused, each with its reason', async () => {
  const a = await key('a'), b = await key('b'), j = (await join(a, 'night-owls', estate(), 1)).statement;
  const cases = [
    [{ ...j, by: b.pub }, 'the statement’s signature does not check'],
    [{ ...j, holdings: estate(3) }, 'the statement’s signature does not check'],
    [{ ...j, n: 2 }, 'the statement’s signature does not check'],
    [{ ...j, sig: 'ab'.repeat(32) }, 'the statement’s signature does not check'],
    [{ ...j, sig: 7 }, 'the statement’s signature does not check'],
    [(await join(a, 'day-larks', estate(), 1)).statement, 'the statement is for another guild'],
    [{ ...j, kind: 'x' }, 'not a guild statement'],
    [{ ...j, act: 'stay' }, 'not a guild statement'],
    [{ ...j, extra: 1 }, 'not a guild statement'],
    [Object.fromEntries(Object.entries(j).filter(([k]) => k !== 'holdings')), 'not a guild statement'],
    [{ ...(await leave(a, 'night-owls', 2)).statement, holdings: estate() }, 'not a guild statement'],
    [{ ...j, by: 'nope' }, 'the statement names no key'],
    [{ ...j, n: 0 }, 'the statement is not numbered'],
    [{ ...j, n: 1.5 }, 'the statement is not numbered'],
    [{ ...j, holdings: { ...estate(), snapshot: true } }, 'a member’s estate is its plot, not a snapshot'],
    [{ ...j, holdings: { ...estate(), landmarks: ['arena'] } }, 'a member’s estate carries no doors: those are the screens of its own game'],
    [{ ...j, holdings: 'x' }, 'an estate is a record of holdings'],
    [null, 'not a guild statement'], [7, 'not a guild statement'], ['x', 'not a guild statement'],
  ];
  for (const [s, why] of cases) {
    assert.deepEqual(await statementOk(s, 'night-owls'), { ok: false, why }, why);
  }
  const bad = await statementOk({ ...j, holdings: { ...estate(), cards: [card(1, { rarity: 'mythic' })] } }, 'night-owls');
  assert.match(bad.why, /^the estate is not one the painter can draw: rarity must be one of/);
  const g = await guildOf([j, ...cases.map(([s]) => s)], 'night-owls');
  assert.deepEqual([ids(g), g.refused.length, g.refused[0]], [[a.pub], cases.length, { at: 1, why: cases[0][1] }], 'the good statement stands, every bad one is said');
});

test('a member’s highest clean number stands: leave, come back, and two different statements under one number are neither', async () => {
  const a = await key('a'), b = await key('b');
  const j1 = (await join(a, 'night-owls', estate(1), 1)).statement, l2 = (await leave(a, 'night-owls', 2)).statement, j3 = (await join(a, 'night-owls', estate(3), 3)).statement;
  const bj = (await join(b, 'night-owls', estate(1), 1)).statement;
  assert.deepEqual(ids(await guildOf([j1, l2, bj], 'night-owls')), [b.pub], 'a later leave takes it out');
  assert.deepEqual(ids(await guildOf([l2, j1, bj], 'night-owls')), [b.pub], 'in any order');
  const back = await guildOf([j3, l2, j1, bj], 'night-owls');
  assert.deepEqual([ids(back).sort(), back.members.find((m) => m.by === a.pub).cards], [[a.pub, b.pub].sort(), 3], 'a later join brings it back, with its later estate');
  assert.deepEqual(ids(await guildOf([(await leave(a, 'night-owls', 1)).statement, (await join(a, 'night-owls', estate(), 2)).statement], 'night-owls')), [a.pub], 'a join after a leave stands');
  // the same statement twice is one statement
  assert.deepEqual([(await guildOf([j1, j1], 'night-owls')).refused, ids(await guildOf([j1, j1], 'night-owls'))], [[], [a.pub]]);
  // two different statements as number 2: neither stands; number 1 does, and the double is said
  const two = (await join(a, 'night-owls', estate(2), 2)).statement, other = (await leave(a, 'night-owls', 2)).statement;
  const g = await guildOf([j1, two, other], 'night-owls');
  assert.deepEqual([ids(g), g.members[0].n, g.refused], [[a.pub], 1, [{ at: null, why: 'a key signed two different statements as number 2: ' + a.pub.slice(0, 16) }]]);
  const only = await guildOf([two, other], 'night-owls');
  assert.deepEqual([ids(only), only.refused.length], [[], 1], 'with no clean number left, the key stands nowhere');
  // three statements under one number, two of them the same, are still a double
  assert.deepEqual(ids(await guildOf([two, two, other, j1], 'night-owls')), [a.pub]);
  assert.equal((await guildOf([two, other, two], 'night-owls')).refused.length, 1, 'a double is said once');
});

test('the guild is the same in any order, holds at most twelve, and reads at most 240 statements', async () => {
  const keys = await Promise.all(Array.from({ length: 13 }, (_, i) => key('m' + i)));
  const js = await Promise.all(keys.map(async (k, i) => (await join(k, 'big', estate((i % 3) + 1), 1)).statement));
  const twelve = await guildOf(js.slice(0, 12), 'big'), back = await guildOf(js.slice(0, 12).reverse(), 'big');
  assert.equal(twelve.members.length, 12);
  assert.deepEqual(twelve, back, 'the same guild however its statements arrived');
  assert.deepEqual(ids(twelve), [...ids(twelve)].sort(), 'members in the order of their keys');
  assert.deepEqual(await guildOf(js, 'big'), { ok: false, why: 'a guild holds at most 12 members: 13 stand here' });
  const left = await guildOf([...js, (await leave(keys[12], 'big', 2)).statement], 'big');
  assert.equal(left.members.length, 12, 'one leaving brings it back to twelve');
  assert.deepEqual(await guildOf(Array(241).fill(js[0]), 'big'), { ok: false, why: 'a guild is read from at most 240 statements' });
  assert.equal((await guildOf(Array(240).fill(js[0]), 'big')).members.length, 1, '240 is read');
  for (const [s, g, why] of [[js, 'Big', 'a guild is named in lower-case letters, digits and hyphens, at most 32'], [js, 'a'.repeat(33), 'a guild is named in lower-case letters, digits and hyphens, at most 32'], ['x', 'big', 'a guild is read from a list of statements'], [null, 'big', 'a guild is read from a list of statements']]) {
    assert.deepEqual(await guildOf(s, g), { ok: false, why }, why);
  }
  assert.equal((await guildOf([], 'a' + 'b'.repeat(31))).ok, true, 'a name of 32 is a name');
});

test('a statement is refused before it is signed when it cannot be one', async () => {
  const a = await key('a');
  assert.deepEqual(await join(a, 'Night', estate(), 1), { ok: false, why: 'a guild is named in lower-case letters, digits and hyphens, at most 32' });
  assert.deepEqual(await join(a, 'night', estate(), 0), { ok: false, why: 'a member numbers its statements 1, 2, 3 …' });
  assert.deepEqual(await leave(a, 'night', 1e9 + 1), { ok: false, why: 'a member numbers its statements 1, 2, 3 …' });
  assert.equal((await leave(a, 'night', 1e9)).ok, true, 'a billion is a number');
  assert.deepEqual(await join({ pub: 'x' }, 'night', estate(), 1), { ok: false, why: 'a statement is signed by a key' });
  assert.deepEqual(await join(null, 'night', estate(), 1), { ok: false, why: 'a statement is signed by a key' });
  assert.deepEqual(await join({ pub: a.pub }, 'night', estate(), 1), { ok: false, why: 'the key could not sign' }, 'a public key alone cannot sign');
  assert.deepEqual(await join(a, 'night', { ...estate(), snapshot: true }, 1), { ok: false, why: 'a member’s estate is its plot, not a snapshot' });
  const big = { ...estate(), cards: Array.from({ length: 1000 }, (_, i) => card(i + 1, { department: 'a-long-departmen' })) };
  assert.deepEqual(await join(a, 'night', big, 1), { ok: false, why: 'the statement is longer than 65,536 bytes' });
  assert.deepEqual(await join(a, 'night', { ...estate(), levels: 0.5 }, 1).then((r) => r.ok), false, 'a level count that is no whole number is no estate');
});

test('the size limit is exact: a statement of 65,536 bytes is signed and read; one byte more is neither', async () => {
  const { canonical } = await import('../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs');
  const { sign } = await import('../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs');
  const a = await key('a'), size = (h, g) => utf8(canonical({ kind: GUILD, guild: g, act: 'join', n: 1, by: a.pub, holdings: h })).length;
  // cards with 16-letter departments until the statement is over the limit, then one letter off at a time: each letter
  // is one byte, so it lands on the limit exactly
  const cards = [];
  while (size({ ...estate(0), cards }, 'g') <= MAX_BYTES) cards.push(card(cards.length + 1, { department: 'a'.repeat(16) }));
  for (let i = 0; size({ ...estate(0), cards }, 'g') > MAX_BYTES; i = cards[i].department.length > 1 ? i : i + 1) cards[i] = { ...cards[i], department: cards[i].department.slice(0, -1) };
  const h = { ...estate(0), cards };
  assert.equal(size(h, 'g'), MAX_BYTES, 'exactly the limit');
  const at = await join(a, 'g', h, 1);
  assert.equal(at.ok, true, 'exactly the limit is signed: ' + at.why);
  assert.deepEqual(await statementOk(at.statement, 'g'), { ok: true }, 'and read');
  assert.deepEqual(await join(a, 'gg', h, 1), { ok: false, why: 'the statement is longer than 65,536 bytes' }, 'one byte more is not signed');
  // signed by hand at one byte over, the reader refuses it too
  const s = { kind: GUILD, guild: 'gg', act: 'join', n: 1, by: a.pub, holdings: h };
  assert.deepEqual(await statementOk({ ...s, sig: await sign(a, utf8(canonical(s))) }, 'gg'), { ok: false, why: 'the statement cannot be read in one exact form' });
});
