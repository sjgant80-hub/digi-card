#!/usr/bin/env node
// tools/judge-6.mjs — organ 6, judged by the rules tools/seal-6.mjs sealed. node tools/judge-6.mjs [--write | --check]
import { judgeMain } from './organ.mjs';

const WHY = ['not a consent', 'the consent was given for an earlier life of the card: its owner must consent again', 'the consent is not its owner’s'];
const f = (x) => (x / 1e6).toFixed(3);
judgeMain(6, {
  P1: (r) => ({ pass: r.meshes.length > 0 && r.meshes.every((x) => x.left.length === 3 && x.left.every((l, k) => !l.joined && l.why === WHY[k])), saw: r.meshes.map((x) => x.set + ': ' + x.left.map((l) => (l.joined ? 'JOINED' : 'out')).join('/')).join('; ') }),
  P2: (r) => ({ pass: r.meshes.length > 0 && r.meshes.every((x) => x.shareSum === 1e6 && x.ledger.jobs === 100 && x.ledger.ok), saw: r.meshes.map((x) => x.set + ' shares ' + x.shareSum + ', ledger ' + (x.ledger.ok ? 'replays' : 'BROKEN')).join('; ') }),
  P3: (r) => ({ pass: r.meshes.length > 0 && r.meshes.every((x) => x.scoresOnly), saw: r.meshes.filter((x) => x.scoresOnly).length + ' of ' + r.meshes.length + ' couplings re-learned from GATE scores alone, weight for weight' }),
  Q1: (r) => ({ pass: r.beatBest >= Math.min(3, r.meshes.length) && r.meshes.length > 0, saw: r.meshes.map((x) => x.set + ' ' + f(x.test) + ' vs ' + f(x.bestTest) + ' (bound ' + x.vsBest.low95 + ')').join('; ') }),
  Q2: (r) => ({ pass: r.positiveShare > 0 && r.positiveShareAddsOnTest >= 0.7 * r.positiveShare, saw: r.positiveShareAddsOnTest + ' of ' + r.positiveShare + ' members with a positive share add to the mesh on TEST' }),
});
