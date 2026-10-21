#!/usr/bin/env node
// tools/seal-1.mjs — organ 1, THE CARD: the claims, sealed before tools/measure-1.mjs runs.
import { seal } from './organ.mjs';

seal(1, {
  organ: 'the card: a PNG that carries its whole life and shows exactly what it carries',
  population: 'every genesis card in drop/log.json (the drop as committed); the forgery suite on every tenth card by serial',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Every genesis card, written as a PNG with the real art engine and read back, returns exactly its dossier (canonical bytes equal), with its facts.' },
    { id: 'P2', kind: 'property', claim: 'Every genesis card written twice is byte-identical: the same life makes the same card.' },
    { id: 'P3', kind: 'property', claim: 'On every tenth genesis card, each of 12 forgeries — a face pixel flipped, a byte after the dossier, another card’s face, a changed owner, a changed serial, a changed genome byte, a re-wrapped dossier, a cut-short file, a damaged chunk, the wrong size, an event signed by a stranger, the magic removed — is refused, every one.' },
    { id: 'P4', kind: 'property', claim: 'Reading a card touches no network: every read on the sampled cards runs with the network trapped and never reaches for it.' },
    { id: 'P5', kind: 'property', claim: 'A level signed into a card by its own owner with made-up numbers still reads (a card proves what it is), and is refused by the registry, which re-runs every level before recording it — on every sampled card.' },
    { id: 'Q1', kind: 'prediction', claim: 'The median time to read and fully check a card (CRCs, seals, signatures, redrawn face) is at most 250 ms on the measuring machine.' },
  ],
}, ['tools/lib.mjs', 'vendor/pixelwhisperer/kards/kardart.mjs']);
