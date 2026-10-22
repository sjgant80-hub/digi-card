// tournament.test.mjs — a bracket seeded by the cards' ratings, padded with byes, each match decided only by a duel
// receipt between exactly its two cards; an open match holds everything after it; the champion takes a title, nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bracketOf, playOut, byId, MAX_ENTRANTS, DRAWS_TO_TIE } from '../src/tournament.mjs';
import { ratings } from '../src/arena.mjs';

const C = (n) => n.toString(16).padStart(16, '0');
const duel = (a, b, winner, self = false) => ({ kind: 'duel', data: 'toy', a: { card: C(a), head: 'h', kit: 'k', auc: 1 }, b: { card: C(b), head: 'h', kit: 'k', auc: 1 }, challenge: 'c', accept: 'x', seed: 's', n: 64, winner, self });

test('seeding: by rating, higher first, ties to the lower card id; byes pad to a power of two; 1 meets the last seed', () => {
  // card 3 beat 1, then 2 (rated higher by then, so 2 lost less); 4 is unrated at 1000
  const rec = [duel(3, 1, 'a'), duel(3, 2, 'a')], r = ratings(rec).ratings;
  const b = bracketOf([C(1), C(2), C(3), C(4)], rec);
  assert.equal(b.ok, true);
  assert.ok(r[C(3)] > 1000 && r[C(2)] < 1000 && r[C(1)] < r[C(2)], 'the published ratings, read in order');
  assert.deepEqual(b.seeds, [C(3), C(4), C(2), C(1)], 'by rating, higher first');
  assert.deepEqual([b.size, b.first], [4, [[C(3), C(1)], [C(4), C(2)]]], '1 meets 4, 2 meets 3');
  assert.deepEqual(bracketOf([C(3), C(1), C(2)], []).seeds, [C(1), C(2), C(3)], 'equal ratings to the lower id');
  const five = bracketOf([C(1), C(2), C(3), C(4), C(5)], []);
  assert.deepEqual([five.size, five.first], [8, [[C(1), null], [C(4), C(5)], [C(2), null], [C(3), null]]], 'the top seeds get the byes');
  assert.deepEqual(bracketOf([C(2), C(1)], []).first, [[C(1), C(2)]]);
  assert.deepEqual([byId('a', 'b'), byId('b', 'a'), byId('a', 'a')], [-1, 1, 0]);
  assert.equal(MAX_ENTRANTS, 64);
  assert.equal(bracketOf(Array.from({ length: 64 }, (_, i) => C(i + 1)), []).size, 64);
  for (const bad of [null, [C(1)], [C(1), C(1)], [C(1), 'x'], Array.from({ length: 65 }, (_, i) => C(i + 1)), [C(1), 5]]) assert.equal(bracketOf(bad, []).why, 'a bracket is 2 to 64 different cards');
  assert.deepEqual(bracketOf([C(2), C(1)], 'junk').seeds, [C(1), C(2)], 'junk receipts rate nobody');
  assert.deepEqual(bracketOf([C(2), C(1)], [duel(2, 1, 'a'), { junk: 1 }]).seeds, [C(2), C(1)], 'a junk receipt among real ones is read past');
});

test('play out: each match decided by the first decisive receipt naming exactly its two cards; byes advance; the champion takes a title', () => {
  const b = bracketOf([C(1), C(2), C(3), C(4)], []);   // [[1,4],[2,3]]
  assert.deepEqual(b.first, [[C(1), C(4)], [C(2), C(3)]]);
  const none = playOut(b, []);
  assert.deepEqual([none.champion, none.title, none.rounds[0].map((m) => m.open), none.rounds[1][0].open], [null, null, [true, true], true]);
  const semi = playOut(b, [duel(4, 1, 'a'), duel(2, 3, 'draw'), duel(9, 2, 'a'), duel(3, 2, 'b')]);
  assert.deepEqual(semi.rounds[0].map((m) => [m.winner, m.by]), [[C(4), 0], [C(2), 3]], 'a draw and a receipt of another card decide nothing; either side order counts');
  assert.deepEqual([semi.rounds[1][0].a, semi.rounds[1][0].b, semi.rounds[1][0].open, semi.champion], [C(4), C(2), true, null]);
  const won = playOut(b, [duel(4, 1, 'a'), duel(3, 2, 'b'), duel(4, 2, 'b'), duel(4, 2, 'a')]);
  assert.deepEqual([won.champion, won.title, won.practice, won.rounds[1][0].by], [C(2), 'Champion', false, 2], 'the first decisive receipt, not a later one');
  const half = playOut(b, [duel(4, 1, 'a')]);
  assert.deepEqual([half.rounds[1][0].a, half.rounds[1][0].b, half.rounds[1][0].open], [C(4), null, true], 'an open side is never a bye');
  const practice = playOut(b, [duel(4, 1, 'a', true), duel(3, 2, 'b'), duel(4, 2, 'b')]);
  assert.deepEqual([practice.champion, practice.title, practice.practice], [C(2), 'Practice champion', true], 'one owner against itself is practice');
  const byes = playOut(bracketOf([C(1), C(2), C(3)], []), [duel(2, 3, 'a'), duel(1, 2, 'a')]);
  assert.deepEqual([byes.rounds[0][0].by, byes.rounds[0][0].winner, byes.champion], ['bye', C(1), C(1)]);
  const lowBye = playOut({ ok: true, first: [[null, C(5)], [C(6), C(7)]] }, [duel(6, 7, 'b'), duel(7, 5, 'b')]);
  assert.deepEqual([lowBye.rounds[0][0].winner, lowBye.rounds[0][0].by, lowBye.champion], [C(5), 'bye', C(5)], 'a bye on either side');
  for (const [bb, rr] of [[null, []], [{ ok: false }, []], [b, null], [{ ok: true, first: 'x' }, []]]) assert.equal(playOut(bb, rr).why, 'play a bracket out from a list of receipts');
  assert.deepEqual(playOut(b, [null, 5, { kind: 'duel' }, duel(4, 1, 'a')]).rounds[0][0].by, 3, 'junk among the receipts is read past, and counted in their order');
});

test('the tie rule: three drawn receipts of exactly two cards, nothing decisive before them, and the higher seed advances', () => {
  // organ 12 (2026-10-22): two minds that score every batch the same draw for ever, and two of five real brackets stalled
  assert.equal(DRAWS_TO_TIE, 3);
  const b = bracketOf([C(1), C(2), C(3), C(4)], []);   // seeds 1,2,3,4 · [[1,4],[2,3]]
  const tied = playOut(b, [duel(1, 4, 'draw'), duel(4, 1, 'draw'), duel(2, 9, 'draw'), duel(1, 4, 'draw')]);
  assert.deepEqual(tied.rounds[0][0], { a: C(1), b: C(4), winner: C(1), by: 3, open: false, tie: true }, 'the higher seed, at the third draw of exactly its two cards');
  assert.equal('tie' in playOut(b, [duel(1, 4, 'a')]).rounds[0][0], false, 'a match a receipt decided is no tie');
  // the higher seed wins the tie on either side of the match
  const flip = playOut({ ok: true, seeds: [C(4), C(1)], first: [[C(1), C(4)]] }, [duel(1, 4, 'draw'), duel(1, 4, 'draw'), duel(1, 4, 'draw')]);
  assert.deepEqual([flip.rounds[0][0].winner, flip.champion, flip.title], [C(4), C(4), 'Champion'], 'the seed decides, not the side');
  // a decisive receipt among the first three decides as it always did, even after two draws
  const late = playOut(b, [duel(1, 4, 'draw'), duel(1, 4, 'draw'), duel(1, 4, 'b')]);
  assert.deepEqual([late.rounds[0][0].winner, late.rounds[0][0].by, 'tie' in late.rounds[0][0]], [C(4), 2, false]);
  // after three draws the tie has settled it: a later decisive receipt changes nothing
  const after = playOut(b, [duel(1, 4, 'draw'), duel(1, 4, 'draw'), duel(1, 4, 'draw'), duel(1, 4, 'b')]);
  assert.deepEqual([after.rounds[0][0].winner, after.rounds[0][0].by, after.rounds[0][0].tie], [C(1), 2, true]);
  // two draws are not three: the match waits
  assert.equal(playOut(b, [duel(1, 4, 'draw'), duel(1, 4, 'draw')]).rounds[0][0].open, true);
  // a drawn receipt of one owner against itself makes the tie practice, as any deciding duel of its kind does
  const self = playOut({ ok: true, seeds: [C(1), C(4)], first: [[C(1), C(4)]] }, [duel(1, 4, 'draw'), duel(1, 4, 'draw', true), duel(1, 4, 'draw')]);
  assert.deepEqual([self.champion, self.title, self.practice], [C(1), 'Practice champion', true]);
  const notSelf = playOut({ ok: true, seeds: [C(1), C(4)], first: [[C(1), C(4)]] }, [duel(1, 4, 'draw'), duel(1, 4, 'draw'), duel(1, 4, 'draw'), duel(1, 4, 'draw', true)]);
  assert.deepEqual([notSelf.title, notSelf.practice], ['Champion', false], 'a self duel after the third draw is not one of the three');
  // a bracket handed in without its seeds, or without one of these two, cannot say who is higher: the match stays open
  assert.equal(playOut({ ok: true, first: [[C(1), C(4)]] }, [duel(1, 4, 'draw'), duel(1, 4, 'draw'), duel(1, 4, 'draw')]).rounds[0][0].open, true);
  assert.equal(playOut({ ok: true, seeds: [C(1)], first: [[C(1), C(4)]] }, [duel(1, 4, 'draw'), duel(1, 4, 'draw'), duel(1, 4, 'draw')]).rounds[0][0].open, true);
  assert.equal(playOut({ ok: true, seeds: [C(4)], first: [[C(1), C(4)]] }, [duel(1, 4, 'draw'), duel(1, 4, 'draw'), duel(1, 4, 'draw')]).rounds[0][0].open, true);
  assert.equal(playOut({ ok: true, seeds: 'x', first: [[C(1), C(4)]] }, [duel(1, 4, 'draw'), duel(1, 4, 'draw'), duel(1, 4, 'draw')]).rounds[0][0].open, true);
  // a whole bracket of minds that cannot be told apart still names a champion: the top seed, every match a tie
  const all = [], pair = (x, y) => { for (let i = 0; i < 3; i++) all.push(duel(x, y, 'draw')); };
  pair(1, 4); pair(2, 3); pair(1, 2);
  const flat = playOut(b, all);
  assert.deepEqual([flat.champion, flat.title, flat.rounds.flat().every((m) => m.tie === true)], [C(1), 'Champion', true]);
});
