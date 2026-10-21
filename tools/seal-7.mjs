#!/usr/bin/env node
// tools/seal-7.mjs — organ 7, THE DROP AND THE CLAIM GATE: the claims, sealed before tools/measure-7.mjs runs.
import { seal } from './organ.mjs';

seal(7, {
  organ: 'the drop: decoder #0001 re-runs the whole genesis; a claimed card works for its claimant; the public voice says only what re-runs',
  population: 'the drop as committed; the drafted posts of tools/posts.mjs; twelve drafts that overreach; 100 "card me" claims of serials 2 to 101 by fresh demo claimants',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Decoder #0001’s drop receipt re-runs: the genesis log replays from nothing to its head, every card of one maker, and the frozen decoder v1 files hash to the decoder it names.' },
    { id: 'P2', kind: 'property', claim: 'Every drafted post passes the claim gate with checkers that re-run each of its claims now; and each of twelve drafts that overreach (self-aware, conscious, alive, AGI, a price, a currency sign, investment, a guarantee, the moon, an unvouched number, no link, no re-run) is refused, for its own reason.' },
    { id: 'P3', kind: 'property', claim: 'In 100 "card me" claims, the maker’s give to a fresh key makes a card that reads on the claimant’s side, records in a registry the claimant replays from the drop, names the claimant as owner, and grows a mind with the network trapped that scores exactly its declared GATE.' },
  ],
}, ['tools/lib.mjs', 'tools/checkers.mjs', 'tools/posts.mjs', 'vendor/pixelwhisperer/kards/kardart.mjs']);
