#!/usr/bin/env node
// tools/seal-8.mjs — organ 8, SCALE: the claims, sealed before tools/measure-8.mjs runs.
import { seal } from './organ.mjs';

seal(8, {
  organ: 'scale: as cards spread and join, the mesh keeps climbing and the record of every life stays re-runnable',
  population: 'every set with two or more departments in the drop: its departments join a mesh one at a time in the drop’s order, each fielding its best genesis card; and a registry of the drop plus 9,000 trades of its cards among 1,000 demo owners, from one seeded stream',
  rules: [
    { id: 'P1', kind: 'property', claim: 'A registry of the drop and 9,000 trades replays from nothing to the very same cards, owners and head.' },
    { id: 'P2', kind: 'property', claim: 'At every step of every mesh’s growth, the shares of its fielded cards sum to exactly 1,000,000.' },
    { id: 'Q1', kind: 'prediction', claim: 'On every set, the mesh with all its departments scores above its first department alone on TEST.' },
    { id: 'Q2', kind: 'prediction', claim: 'On every set, the mesh’s TEST AUC never falls by more than 0.005 as a department joins.' },
    { id: 'Q3', kind: 'prediction', claim: 'The registry of about 10,000 entries replays from nothing in at most 300 seconds on the measuring machine.' },
  ],
}, ['tools/lib.mjs']);
