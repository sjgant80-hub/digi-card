#!/usr/bin/env node
// tools/judge-5.mjs — organ 5, judged by the rules tools/seal-5.mjs sealed. node tools/judge-5.mjs [--write | --check]
import { judgeMain } from './organ.mjs';

judgeMain(5, {
  P1: (r) => ({ pass: r.recorded === r.honest && r.honest >= r.cards + 2000 && r.ownedByLastBuyer === r.cards, saw: r.recorded + ' of ' + r.honest + ' honest gives recorded; ' + r.ownedByLastBuyer + ' of ' + r.cards + ' cards owned by their last buyer' }),
  P2: (r) => ({ pass: r.doubles === 300 && r.doubleRefused === r.doubles && r.firstKept === r.doubles, saw: r.doubleRefused + ' of ' + r.doubles + ' double sales refused; the first buyer kept the card ' + r.firstKept + ' times' }),
  P3: (r) => ({ pass: r.forged === 100 && r.forgedRefused === r.forged, saw: r.forgedRefused + ' of ' + r.forged + ' gives signed by a non-owner refused' }),
  P4: (r) => ({ pass: r.replay.ok && r.replay.same, saw: r.replay.entries + ' entries replayed from nothing: ' + (r.replay.same ? 'the very same registry' : 'a different registry') }),
  P5: (r) => ({ pass: r.mind.traded === 50 && r.mind.same === r.mind.traded, saw: r.mind.same + ' of ' + r.mind.traded + ' traded cards’ minds scored their declared GATE for their new owner' }),
  Q1: (r) => ({ pass: r.replay.ms <= 120000, saw: r.replay.entries + ' entries in ' + (r.replay.ms / 1000).toFixed(1) + ' s' }),
});
