#!/usr/bin/env node
// tools/seal-2.mjs — organ 2, GERMINATION: the claims, sealed before tools/measure-2.mjs runs.
import { seal } from './organ.mjs';

seal(2, {
  organ: 'germination: a card grows its mind on the device, offline, and it is exactly the mind the drop declared',
  population: 'every genesis card; the deep re-run on every twentieth card by serial',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Every genesis card’s mind, expressed from the recipe it carries on the published bytes, scores exactly the GATE AUC the drop manifest declares, to the millionth.' },
    { id: 'P2', kind: 'property', claim: 'Every one of those expressions runs with the network trapped and never reaches for it.' },
    { id: 'P3', kind: 'property', claim: 'On every twentieth genesis card, the search the manifest names, run again from nothing, finds exactly the mind the card carries.' },
    { id: 'P4', kind: 'property', claim: 'For each bundled set, a file with one byte changed is refused before a row of it is read.' },
    { id: 'Q1', kind: 'prediction', claim: 'At least 99% of genesis cards score above a coin (AUC > 0.5) on TEST, cases nothing in the build ever fitted or selected on.' },
    { id: 'Q2', kind: 'prediction', claim: 'The median drop from a genesis card’s GATE AUC to its TEST AUC is at most 0.020 (cards were admitted on GATE, so some drop is expected).' },
    { id: 'Q3', kind: 'prediction', claim: 'For every department in the drop, the median TEST AUC of its genesis cards is at least 0.600.' },
  ],
}, ['tools/lib.mjs', 'tools/search-worker.mjs']);
