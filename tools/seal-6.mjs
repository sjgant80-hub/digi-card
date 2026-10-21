#!/usr/bin/env node
// tools/seal-6.mjs — organ 6, THE MESH AND ITS LEDGER: the claims, sealed before tools/measure-6.mjs runs.
import { seal } from './organ.mjs';

seal(6, {
  organ: 'the mesh: owned cards of one business answer as one, by consent, and each owner is credited by measured contribution',
  population: 'every set with two or more departments in the drop; for each department, its three best genesis cards by declared GATE, each handed to a different demo owner who signs a consent for the mesh',
  disclosure: 'NOT BLIND: on 2026-10-21, before this seal, tools/measure-6.mjs was dry-run on a provisional 693-card drop to test the tooling, and that run read TEST (the mesh beat its best member on TEST in 4 of 5 sets; 12 of 13 positive shares added on TEST). These rules were committed in 4b27df3 before that run and are unchanged; treat Q1 and Q2 as checks, not blind predictions.',
  rules: [
    { id: 'P1', kind: 'property', claim: 'No card joins without its owner’s consent for its current life: on every mesh, a card with no consent, one whose consent was for an earlier life (it has been sold since), and one whose consent is signed by someone else are all left out, each with its reason.' },
    { id: 'P2', kind: 'property', claim: 'On every mesh the fielded members’ shares sum to exactly 1,000,000, and a ledger of 100 jobs replays with every credit exactly cases × share.' },
    { id: 'P3', kind: 'property', claim: 'On every mesh, only scores cross between members: the coupling is learned from the members’ scores on GATE and nothing else.' },
    { id: 'Q1', kind: 'prediction', claim: 'The mesh beats its best single fielded member on TEST with a paired-bootstrap 95% lower bound above zero, on at least 3 of the sets (on all of them, if fewer than 3 have two departments).' },
    { id: 'Q2', kind: 'prediction', claim: 'Of the members with a positive share, at least 70% also add to the mesh on TEST (its TEST AUC with them, minus without them, coupling re-learned on GATE, is above zero).' },
  ],
}, ['tools/lib.mjs']);
