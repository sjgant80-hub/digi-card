#!/usr/bin/env node
// tools/seal-12.mjs — organ 12, THE ARENA WATCHED AND THE TOURNAMENT: the claims, sealed before tools/measure-12.mjs runs.
import { seal } from './organ.mjs';

seal(12, {
  organ: 'the arena watched and the tournament: a duel replayed case by case to its own receipt and read back by the rules that fired, and a bracket decided only by its duel receipts',
  disclosure: 'Not fully blind: before this seal, on 2026-10-22, tools/measure-12.mjs was dry-run with SMALL=1 (2 duels a business, brackets of 4, 50 receipt sets) to test the tooling. Only its properties were read (all held); no duel’s winner, no tally of cases called right and no bracket’s champion was read. Organ 12 reads no TEST row at all.',
  population: 'the five businesses whose drop has cards in two or more departments: 20 kit duels per business between genesis cards handed to demo owners (the challenger with 0 to 2 nodes of other departments, the defender alone, of the challenger’s department), each replayed and every case read back; one bracket per business of 8 genesis cards, each with its own demo owner, every match fought as a duel; and 1,000 seeded receipt sets of 2 to 16 entrants with draws, junk and duels of one owner against itself',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Every one of the 100 duels replays to the very same receipt; its cases, laid out, give back the receipt’s two AUCs exactly; and each side calls exactly as many yeses as the batch holds real yeses.' },
    { id: 'P2', kind: 'property', claim: 'On every case of every replayed duel, each fielded mind’s read-back gives the very score the duel used for it, and for every mind of one department the weights of its rules that fired sum to that score.' },
    { id: 'P3', kind: 'property', claim: 'Across the 1,000 receipt sets every bracket plays out the same however its entrants are listed; every decided match is decided by the first receipt, in order, naming exactly its two cards that is not a draw; no match is decided while a side of it is open; a champion is named exactly when the final is decided, its title practice exactly when a deciding duel was one owner against itself; and all 5 real brackets play out to a champion that is no practice champion.' },
    { id: 'Q1', kind: 'prediction', claim: 'In at least 80% of the decided duels whose sides called different numbers of cases right, the side that called more right also has the higher AUC: the watched-back tally agrees with the receipt.' },
    { id: 'Q2', kind: 'prediction', claim: 'In the 5 real brackets, the card with the higher declared GATE AUC wins at least 60% of the matches between cards of different declared AUC: the arena’s 64 cases reflect the score a card was proven on.' },
  ],
}, ['src/replay.mjs', 'src/tournament.mjs', 'src/kit.mjs', 'src/arena.mjs', 'tools/lib.mjs']);
