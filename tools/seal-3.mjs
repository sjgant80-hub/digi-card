#!/usr/bin/env node
// tools/seal-3.mjs — organ 3, STAGE BY RECEIPT: the claims, sealed before tools/measure-3.mjs runs.
import { seal } from './organ.mjs';

seal(3, {
  organ: 'stage by receipt: a level is earned by a gain on GATE, carried as a receipt anyone can re-run, and never printed',
  population: 'every tenth genesis card by serial, handed to its own demo owner; each gets three searches from the seeds its life names (seedsFor(head, 3)); the first that lifts its mind by 0.002 on GATE is signed in as a level',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Every level earned re-runs exactly (both minds re-expressed on the same bytes give the receipt’s numbers) and deeply (the search it names, run again, finds the very mind it carries).' },
    { id: 'P2', kind: 'property', claim: 'Five forgeries of every level — a raised score, a lowered start, another ground, another mind, another search — are each refused by the re-run.' },
    { id: 'P3', kind: 'property', claim: 'Every leveled card is recorded by a registry only with the re-runner; without it, the registry refuses the level.' },
    { id: 'Q1', kind: 'prediction', claim: 'Levels earned on GATE hold on TEST: in at least 60% of levels, the new mind’s TEST AUC is above the old mind’s.' },
    { id: 'Q2', kind: 'prediction', claim: 'Across all levels, the mean TEST gain is above zero, with its bootstrap 95% lower bound above zero.' },
    { id: 'Q3', kind: 'prediction', claim: 'At least 25% of the sampled cards earn a level within their three searches.' },
  ],
}, ['tools/lib.mjs', 'tools/search-worker.mjs']);
