#!/usr/bin/env node
// tools/measure-6.mjs — organ 6, THE MESH AND ITS LEDGER, measured as tools/seal-6.mjs sealed it. Writes data/organ-6/record.json.
import { writeFileSync } from 'node:fs';
import { give, verify } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { consent, assemble, work, tally } from '../src/mesh.mjs';
import { mindOf, scoreRow } from '../src/mind.mjs';
import { demoMaker } from '../src/drop.mjs';
import { coupleNonNegative, coupled } from '../vendor/dex-frontier/src/compose.mjs';
import { lead } from '../vendor/dex-frontier/src/stats.mjs';
import { auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { drop, ground, setOfDomain, owner, milli } from './lib.mjs';

const { m, reg } = await drop(), maker = await demoMaker();
const sets = {};
for (const c of m.cards) ((sets[setOfDomain(c.domain)] ||= {})[c.domain] ||= []).push(c);
const meshes = [];
for (const [set, depts] of Object.entries(sets)) {
  if (Object.keys(depts).length < 2) continue;
  const g = await ground(set), name = 'organ-6-' + set, cands = [];
  let k = 0;
  for (const cs of Object.values(depts)) for (const c of [...cs].sort((a, b) => b.gate - a.gate || a.serial - b.serial).slice(0, 3)) {
    const o = await owner('mesh-' + set + '-' + k++), v = await verify((await give(dossierOf(reg, c.card), maker, o.pub)).dossier);
    cands.push({ v, consent: (await consent(o, v, name)).consent, o });
  }
  // the three who must be left out: no consent; a consent for an earlier life; a consent signed by someone else
  const extra = [...Object.values(depts)[0]].sort((a, b) => b.gate - a.gate || a.serial - b.serial).slice(3, 6);   // three cards no candidate is
  const o1 = await owner('mesh-' + set + '-none'), o2 = await owner('mesh-' + set + '-sold'), o3 = await owner('mesh-' + set + '-other'), buyer = await owner('mesh-' + set + '-buyer');
  const v1 = await verify((await give(dossierOf(reg, extra[0].card), maker, o1.pub)).dossier);
  const d2 = (await give(dossierOf(reg, extra[1].card), maker, o2.pub)).dossier, v2 = await verify(d2), old = (await consent(o2, v2, name)).consent, v2b = await verify((await give(d2, o2, buyer.pub)).dossier);
  const v3 = await verify((await give(dossierOf(reg, extra[2].card), maker, o3.pub)).dossier), wrong = (await consent(o3, v3, name)).consent;
  const imposter = (await consent(o1, v1, name)).consent;
  const outsiders = [{ v: v1, consent: null }, { v: v2b, consent: old }, { v: v3, consent: { ...wrong, by: o1.pub, sig: imposter.sig } }];
  const mesh = await assemble(name, [...cands.map(({ v, consent: c }) => ({ v, consent: c })), ...outsiders], g);
  const left = outsiders.map(({ v }) => mesh.members.find((x) => x.card === v.id)).map((x) => ({ joined: x.joined, why: x.why }));
  // only scores: re-learn the coupling from the fielded members' GATE scores alone and compare
  const rows = g.ds.gateRows, y = rows.map((i) => g.ds.y[i]), cols = mesh.fielded.map((f) => rows.map((i) => scoreRow(f.mind, g, i)));
  const fromScores = coupleNonNegative(cols, y), scoresOnly = JSON.stringify(fromScores.weights) === JSON.stringify(mesh.coupling.weights);
  // TEST: the mesh against its best single member, and each member's leave-one-out on TEST
  const t = g.ds.testRows, ty = t.map((i) => g.ds.y[i]), tcols = mesh.fielded.map((f) => t.map((i) => scoreRow(f.mind, g, i)));
  const meshTest = t.map((_, r) => coupled(mesh.coupling, tcols.map((c) => c[r])));
  const singles = tcols.map((c) => milli(auc(c, ty))), best = singles.indexOf(Math.max(...singles)), vsBest = lead(meshTest, tcols[best], ty, 2000, 99);
  const loo = mesh.fielded.map((f, j) => {
    if (cols.length < 2) return milli(auc(meshTest, ty)) - 500000;
    const keep = cols.filter((_, q) => q !== j), c = coupleNonNegative(keep, y), tk = tcols.filter((_, q) => q !== j);
    return milli(auc(meshTest, ty)) - milli(auc(t.map((_, r) => coupled(c, tk.map((x) => x[r]))), ty));
  });
  let log = [];
  for (let j = 0; j < 100; j++) log = work(mesh, log, { job: 'job-' + j, cases: 100 + j * 37 }).log;
  const tl = tally(log, mesh), shares = mesh.members.filter((x) => x.joined).map((x) => x.share);
  const fieldedShare = mesh.fielded.map((f) => mesh.members.find((x) => x.card === f.card).share);
  meshes.push({ set, candidates: cands.length, fielded: mesh.fielded.length, gate: mesh.gate, bestGate: mesh.best, test: milli(auc(meshTest, ty)), bestTest: singles[best], vsBest, shareSum: shares.reduce((a, b) => a + b, 0),
    ledger: { jobs: log.length, ok: tl.ok }, left, scoresOnly, members: mesh.fielded.map((f, j) => ({ card: f.card, share: fieldedShare[j], testLoo: loo[j], test: singles[j] })) });
  console.log(set + ': mesh TEST ' + milli(auc(meshTest, ty)) + ' vs best single ' + singles[best] + ' (bound ' + vsBest.low95 + ')');
}
const pos = meshes.flatMap((x) => x.members.filter((y) => y.share > 0));
const out = { kind: 'digi-card.organ-6.record', v: 1, meshes, beatBest: meshes.filter((x) => x.vsBest.low95 > 0).length, positiveShare: pos.length, positiveShareAddsOnTest: pos.filter((y) => y.testLoo > 0).length };
writeFileSync(new URL('../data/organ-6/record.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('beats its best member on TEST in ' + out.beatBest + ' of ' + meshes.length + ' · positive shares adding on TEST ' + out.positiveShareAddsOnTest + '/' + out.positiveShare);
