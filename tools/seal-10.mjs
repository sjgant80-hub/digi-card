#!/usr/bin/env node
// tools/seal-10.mjs — organ 10, THE KIT AND THE PARTY: the claims, sealed before tools/measure-10.mjs runs.
import { seal } from './organ.mjs';

seal(10, {
  organ: 'the kit and the party: a DIGI fights with the nodes its owner equips, a party of owners strikes a whole business, and an app tool proves what its run proved',
  disclosure: 'Not fully blind: before this seal, on 2026-10-21, tools/measure-10.mjs was dry-run on one kit, one kit duel and two parties per business, with every TEST read replaced by 0, to test the tooling. Only its properties were read (all held: kits measured twice the same, 60 of 60 forgeries refused, parties re-run, shares a million, tools changing nothing, items verifying). One forgery’s refusal message printed one kit duel’s two GATE-batch scores: the kitted side’s 0.798864 against the lone card’s 0.652273 — one of the 300 duels Q3 predicts on. No gate, clear or TEST number of any party, and no TEST number of any kit, was read.',
  population: 'the five businesses whose drop has cards in two or more departments (hospital has none, so no kit and no party there): 20 seeded kits per business — a genesis card as the DIGI and one or two genesis cards of other departments as its nodes, all handed to one demo owner — each kit in three kit duels against another genesis card of the DIGI’s own department fielded alone, and the DIGI alone against the same card in three more; twelve kinds of forgery on the first 20 kits (240); per business a full party of its best genesis card per department, each held by its own demo owner, and 10 seeded parties of a random card per department; every one of the 337 mintable apps as an item, and five forged bodies of each (1,685)',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Every kit measured twice gives the very same numbers, every slot’s worth is the kitted GATE AUC with it less without it, and every one of the 300 kit duels re-runs from its receipt to the very same receipt.' },
    { id: 'P2', kind: 'property', claim: 'All 240 forgeries are refused: a loadout signed by a stranger, a loadout for the card before a give, a node handed on since it was equipped, a node another key holds, a node of another business, more nodes than the slots, the same node twice, a challenge naming another kit, an edited duel score, a flipped winner, a side fielding nodes with no loadout, and a tool another key holds.' },
    { id: 'P3', kind: 'property', claim: 'Every party strike re-runs to the very same receipt, its fielded members’ shares sum to exactly 1,000,000, and its bar is the world boss’s: the best lone genesis search on that business plus 0.010.' },
    { id: 'P4', kind: 'property', claim: 'A tool never moves a score: in every duel a kit carrying a tool fights, its AUC on the batch is exactly that of the same nodes with no tool.' },
    { id: 'P5', kind: 'property', claim: 'Every one of the 337 app items verifies against mint-an-app’s records, handed on once it still verifies, and every one of the 1,685 forged bodies (another commit, run, tier, licence or page) is refused.' },
    { id: 'Q1', kind: 'prediction', claim: 'Of the kits whose nodes lift the DIGI by at least 0.005 on GATE (out of fold), at least 80% also lift it on TEST, the kit coupled on GATE and judged on cases nothing here selects on.' },
    { id: 'Q2', kind: 'prediction', claim: 'Across all kits, the median lift on TEST is at least 0.8 of the median lift on GATE: the kit is not mostly fitted to the cases that chose it.' },
    { id: 'Q3', kind: 'prediction', claim: 'In at least 70% of the decided kit duels, the kitted DIGI beats the card of its own department that fights alone.' },
    { id: 'Q4', kind: 'prediction', claim: 'At least 3 of the 5 world bosses fall to the full party of their business’s best genesis cards.' },
    { id: 'Q5', kind: 'prediction', claim: 'Of all the parties that clear their world boss on GATE, at least 80% score within 0.03 of their GATE AUC on TEST.' },
  ],
}, ['src/kit.mjs', 'src/item.mjs', 'src/raid.mjs', 'src/arena.mjs', 'tools/lib.mjs', 'drop/admission.json', 'vendor/mint-an-app/catalogue-data.json', 'vendor/mint-an-app/mint-data.json']);
