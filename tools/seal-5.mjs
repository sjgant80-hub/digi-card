#!/usr/bin/env node
// tools/seal-5.mjs — organ 5, TRADE AND OWNERSHIP: the claims, sealed before tools/measure-5.mjs runs.
import { seal } from './organ.mjs';

seal(5, {
  organ: 'trade and ownership: a card changes hands by its owner’s signature, a double sale is refused for good, and the mind goes with the card',
  population: 'the drop’s cards (not #0001) handed out in serial order to 200 demo owners; then 2,000 trades between random owners, 300 attempted double sales (one owner signing one life to two buyers) and 100 gives signed by someone who does not own the card, all from one seeded stream',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Every honest give — the hand-out and every trade — is recorded, and afterwards each card’s owner in the registry is the last buyer it was given to.' },
    { id: 'P2', kind: 'property', claim: 'Every attempted double sale is refused, naming the event where the second chain parts from the first recorded one; the first buyer keeps the card.' },
    { id: 'P3', kind: 'property', claim: 'Every give signed by someone who does not own the card is refused.' },
    { id: 'P4', kind: 'property', claim: 'The whole registry log, replayed from nothing, gives the very same cards, owners and head.' },
    { id: 'P5', kind: 'property', claim: 'The mind goes with the card: for 50 traded cards, the mind their new owner expresses scores exactly the GATE the drop declared.' },
    { id: 'Q1', kind: 'prediction', claim: 'Replaying the whole log from nothing takes at most 120 seconds on the measuring machine.' },
  ],
}, ['tools/lib.mjs']);
