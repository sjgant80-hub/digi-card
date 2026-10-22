#!/usr/bin/env node
// tools/seal-15.mjs — organ 15, THE GUILD: the claims, sealed before tools/measure-15.mjs runs.
import { seal } from './organ.mjs';

seal(15, {
  organ: 'the guild: the estates of keys that each consented, drawn together — nobody joins anybody else, a later leave takes a key out, and what a member signs is drawn exactly as signed',
  disclosure: 'Not fully blind on its properties, and said so: src/guild.mjs was written and gated (witness CLEAN 47/47) before this seal, with tests of these very rules on made-up keys, so P1 to P3 are properties the kernel was built to make true; the measurement tests them at scale on real drop cards, against expected members worked out in the measuring tool apart from the kernel. Before this seal, on 2026-10-22, tools/measure-15.mjs was dry-run twice with SMALL=1 ON OTHER SEEDS (30 guilds, into dry-record.json) to test the tooling, and only its properties were read: the first compared whole results across orders (a refusal’s place in the list moves with its statement, so none matched) and seeded no guild past twelve or of exactly twelve, so the tool now compares members and reasons and makes one guild in twenty exactly twelve and one past twelve; the second held every property. It reads no record row at all.',
  population: '400 seeded guilds of demo owners (one in twenty exactly twelve all joining, one in twenty thirteen or fourteen all joining, the rest 1 to 14), each owner’s estate made of 1 to 6 real drop cards as the drop records them (one owner in eight lying about one card’s department), each owner signing 1 to 4 joins and leaves in its own numbering (one in ten signing two different statements under its last number); against every guild an estate changed after signing, a key borrowed, a statement for another guild and a statement with no signature; and 20 members with twenty drop cards each, signing a join',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Every guild of at most twelve standing members holds exactly the keys whose highest clean-numbered statement is a join (a number signed two different ways is clean for neither), in the order of their keys, and refuses every attack with its reason; every guild with more than twelve standing is refused, saying how many stand.' },
    { id: 'P2', kind: 'property', claim: 'Every guild is the very same in three orders of its statements.' },
    { id: 'P3', kind: 'property', claim: 'Every member’s estate in every guild draws to exactly the picture of the estate it signed; every honest member’s drop cards match the drop; and every member who signed a drop card with a wrong department is caught by the drop.' },
    { id: 'Q1', kind: 'prediction', claim: 'A guild of twelve members is read, every signature checked, in a median under 2,000 ms on the machine that measures it.' },
    { id: 'Q2', kind: 'prediction', claim: 'A member with twenty drop cards signs a join whose code, as a player copies it, is under 6,000 characters.' },
  ],
}, ['src/guild.mjs', 'vendor/pixelwhisperer/kards/estate.mjs', 'tools/lib.mjs']);
