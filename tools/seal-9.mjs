#!/usr/bin/env node
// tools/seal-9.mjs — organ 9, THE ARENA: the claims, sealed before tools/measure-9.mjs runs.
import { seal } from './organ.mjs';

seal(9, {
  organ: 'the arena: two owned cards fight on one batch both owners’ signatures chose, the better ranking wins, and every duel re-runs',
  population: 'every set with two or more departments in the drop: 40 seeded pairs of its genesis cards, each card handed to its own demo owner, each pair fighting five duels (1,000 duels); twelve kinds of forgery on the first 20 pairs (240); the ratings of all the duels',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Every one of the 1,000 duels re-runs, from its receipt, its two cards, the ground and the two signed records, to the very same receipt.' },
    { id: 'P2', kind: 'property', claim: 'Every duel’s batch is 64 distinct GATE rows of its ground, and no duel reads a TEST row.' },
    { id: 'P3', kind: 'property', claim: 'All 240 forgeries are refused: an edited challenge, a challenge or acceptance signed by a stranger, an acceptance for another challenge, a stale challenge or acceptance after a give, an edited score, winner or self-play flag in a receipt, a ground of another business, a card fighting itself, an acceptance with an extra field.' },
    { id: 'P4', kind: 'property', claim: 'The ratings of all the duels, computed twice in their order, are identical, and their total is exactly 1,000 points times the number of rated cards.' },
    { id: 'Q1', kind: 'prediction', claim: 'In at least 60% of the pairs a majority of five duels decides, the winner is the card with the higher TEST AUC.' },
    { id: 'Q2', kind: 'prediction', claim: 'At least 10% of the decided duels are won by the card with the lower GATE AUC: a duel is a fight, not a lookup of the two scores.' },
    { id: 'Q3', kind: 'prediction', claim: 'The median duel takes at most 250 milliseconds on the measuring machine, signatures included.' },
  ],
}, ['src/arena.mjs', 'tools/lib.mjs']);
