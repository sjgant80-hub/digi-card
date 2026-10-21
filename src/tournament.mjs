// src/tournament.mjs — THE TOURNAMENT: a bracket of cards, seeded by their ratings, each match decided by a duel receipt
// between exactly those two cards and nothing else.
//
// The entrants are seeded by their arena rating from the same receipts (src/arena.mjs ratings: higher first, ties to the
// lower card id), padded with byes to a power of two, and paired in the standard order (1 against the last seed, 2
// against the one before, and so on), so the best two can meet only in the final. A match is decided by the first duel
// receipt, in the receipts' own order, that names exactly its two cards and is not a draw: its winner advances, and a
// bye advances the card that has it. A match with no such receipt stays open, and so does everything after it. The
// champion's title is its banner — and that is all it is: a bracket moves no rating, no card and no credit. A bracket
// decided by any duel of one owner against itself is practice, and its title says so. Pure and total.
import { ratings } from './arena.mjs';

export const MAX_ENTRANTS = 64;
const CARD = /^[0-9a-f]{16}$/;
const no = (why) => ({ ok: false, why });
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
/** the order cards are read in when their ratings are equal: a three-way compare, 0 only for the same id */
export const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const duelOf = (x) => isObj(x) && x.kind === 'duel' && isObj(x.a) && isObj(x.b) && CARD.test(x.a.card) && CARD.test(x.b.card) && ['a', 'b', 'draw'].includes(x.winner);

/** a bracket: { ok, size, seeds, first: [[card | null, card | null], …] } | a refusal */
export function bracketOf(entrants, receipts) {
  if (!Array.isArray(entrants) || entrants.length < 2 || entrants.length > MAX_ENTRANTS || !entrants.every((id) => typeof id === 'string' && CARD.test(id)) || new Set(entrants).size !== entrants.length) return no('a bracket is 2 to 64 different cards');
  const r = ratings(Array.isArray(receipts) ? receipts.filter(duelOf) : []), rate = (id) => (r.ok && Number.isInteger(r.ratings[id]) ? r.ratings[id] : 1000);
  const seeds = [...entrants].sort((a, b) => rate(b) - rate(a) || byId(a, b));
  let size = 2, order = [1, 2];
  while (size < seeds.length) size *= 2;
  while (order.length < size) order = order.flatMap((s) => [s, order.length * 2 + 1 - s]);
  const slots = order.map((s) => seeds[s - 1] || null), first = [];
  for (let i = 0; i < size; i += 2) first.push([slots[i], slots[i + 1]]);
  return { ok: true, size, seeds, first };
}

/**
 * The bracket played out from the receipts: { ok, rounds: [[{ a, b, winner, by, open }]], champion, practice, title }.
 * by is the deciding receipt's index in the receipts, or 'bye'; an open match (no deciding receipt yet, or a side still
 * to be decided) has winner null, and nothing it feeds can be decided — an open side is never a bye.
 */
export function playOut(bracket, receipts) {
  if (!isObj(bracket) || bracket.ok !== true || !Array.isArray(bracket.first) || !Array.isArray(receipts)) return no('play a bracket out from a list of receipts');
  const duels = receipts.map((x, i) => [x, i]).filter(([x]) => duelOf(x)), rounds = [], OPEN = undefined;
  let pairs = bracket.first, practice = false;
  for (;;) {
    const round = pairs.map(([a, b]) => {
      if (a === OPEN || b === OPEN) return { a: a === OPEN ? null : a, b: b === OPEN ? null : b, winner: null, by: null, open: true };
      if (a && !b) return { a, b: null, winner: a, by: 'bye', open: false };
      if (!a && b) return { a: null, b, winner: b, by: 'bye', open: false };
      const hit = duels.find(([x]) => x.winner !== 'draw' && ((x.a.card === a && x.b.card === b) || (x.a.card === b && x.b.card === a)));
      if (!hit) return { a, b, winner: null, by: null, open: true };
      const [x, at] = hit;
      if (x.self === true) practice = true;
      return { a, b, winner: x.winner === 'a' ? x.a.card : x.b.card, by: at, open: false };
    });
    rounds.push(round);
    if (round.length === 1) break;
    pairs = [];
    for (let i = 0; i < round.length; i += 2) pairs.push([round[i].open ? OPEN : round[i].winner, round[i + 1].open ? OPEN : round[i + 1].winner]);
  }
  const final = rounds[rounds.length - 1][0], champion = final.open ? null : final.winner;
  return { ok: true, rounds, champion, practice, title: champion ? (practice ? 'Practice champion' : 'Champion') : null };
}
