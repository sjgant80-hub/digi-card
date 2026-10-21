#!/usr/bin/env node
// tools/seal-11.mjs — organ 11, THE CAMPAIGN AND KIT IT FOR ME: the claims, sealed before tools/measure-11.mjs runs.
import { seal } from './organ.mjs';

seal(11, {
  organ: 'the campaign and kit it for me: the raids read as chapters from their receipts alone, and a DIGI kitted for its owner by measured forward selection',
  disclosure: 'Not fully blind: before this seal, on 2026-10-22, tools/measure-11.mjs was dry-run with DRY=1 and SMALL=1 (2 DIGIs a business, 1 foreign pool, 50 receipt sets), every TEST read replaced by 0, to test the tooling. No TEST row was read, and only its properties were read: all held. An earlier full DRY=1 run was stopped before it wrote anything.',
  population: 'the five businesses whose drop has cards in two or more departments: 20 seeded DIGIs per business, each a genesis card handed to a demo owner with a seeded collection of 8 other genesis cards of its business, and auto-kitted from that collection; 4 foreign pools per business; the drop’s own admission record for the campaign, read from 1,000 seeded receipt sets',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Every one of the 100 auto-kits is the very same kit with the very same numbers when run twice with its collection in either order; every step lifts the kitted GATE AUC; at every step the node chosen scores the highest kitted GATE of every candidate that joins, ties to the lower card id; and in all 20 foreign pools no auto-kit picks a card another key holds, a card of another business, or the DIGI itself.' },
    { id: 'P2', kind: 'property', claim: 'Every raid boss and every world boss of the drop’s admission record stands in exactly one chapter, the chapters in order of what they have left; and across 1,000 seeded receipt sets every chapter reads as cleared exactly when every boss in it has fallen, the chapter to play is the first not cleared, and the campaign reads the same with its receipts in either order.' },
    { id: 'P3', kind: 'property', claim: 'Every auto-kit measures again exactly what it says: the DIGI kitted with the nodes it hands over scores its stated GATE, and alone its stated starting GATE.' },
    { id: 'Q1', kind: 'prediction', claim: 'Of the auto-kits that lift their DIGI by at least 0.005 on GATE (out of fold), at least 80% also lift it on TEST, the cases nothing here selects on.' },
    { id: 'Q2', kind: 'prediction', claim: 'Over the auto-kits of two nodes or more, the median TEST lift with every node is at least the median TEST lift with its first node alone: the nodes chosen after the first do not, typically, give back on TEST what the first one gained.' },
    { id: 'Q3', kind: 'prediction', claim: 'At least 70% of the auto-kits score at least as well on TEST as a seeded random kit of the same size from the same collection: the kit is chosen by measurement, not luck.' },
  ],
}, ['src/campaign.mjs', 'src/kit.mjs', 'src/raid.mjs', 'tools/lib.mjs', 'drop/admission.json']);
