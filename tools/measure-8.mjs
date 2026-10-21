#!/usr/bin/env node
// tools/measure-8.mjs — organ 8, SCALE, measured as tools/seal-8.mjs sealed it. Writes data/organ-8/record.json.
import { writeFileSync } from 'node:fs';
import { give, verify } from '../src/dossier.mjs';
import { dossierOf, record, replay, ownerOf } from '../src/registry.mjs';
import { consent, assemble } from '../src/mesh.mjs';
import { scoreRow } from '../src/mind.mjs';
import { checkDrop, demoMaker } from '../src/drop.mjs';
import { coupled } from '../vendor/dex-frontier/src/compose.mjs';
import { auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { drop, ground, setOfDomain, owner, sampler, milli } from './lib.mjs';

const { m, reg: dropReg, decoder, glog } = await drop(), maker = await demoMaker();
// the mesh, growing one department at a time
const order = [...new Set(m.cards.map((c) => c.domain))], sets = {};
for (const d of order) (sets[setOfDomain(d)] ||= []).push(d);
const growth = [];
for (const [set, depts] of Object.entries(sets)) {
  if (depts.length < 2) continue;
  const g = await ground(set), name = 'organ-8-' + set, t = g.ds.testRows, ty = t.map((i) => g.ds.y[i]), cands = [], steps = [];
  for (const [k, d] of depts.entries()) {
    const c = m.cards.filter((x) => x.domain === d).sort((a, b) => b.gate - a.gate || a.serial - b.serial)[0];
    const o = await owner('scale-' + set + '-' + k), v = await verify((await give(dossierOf(dropReg, c.card), maker, o.pub)).dossier);
    cands.push({ v, consent: (await consent(o, v, name)).consent });
    const mesh = await assemble(name, cands, g), tcols = mesh.fielded.map((f) => t.map((i) => scoreRow(f.mind, g, i)));
    steps.push({ departments: k + 1, fielded: mesh.fielded.length, gate: mesh.gate, test: milli(auc(t.map((_, r) => coupled(mesh.coupling, tcols.map((x) => x[r]))), ty)), shareSum: mesh.members.filter((x) => x.joined).reduce((s, x) => s + x.share, 0) });
  }
  growth.push({ set, steps });
  console.log(set + ': ' + steps.map((s) => s.test).join(' → '));
}
// the registry at scale: the drop, then 9,000 trades among 1,000 owners
const S = sampler(8), owners = await Promise.all(Array.from({ length: 1000 }, (_, k) => owner('scale-owner-' + k))), keyOf = Object.fromEntries(owners.map((o) => [o.pub, o]));
const cards = m.cards.map((c) => c.card);
let reg = dropReg;
for (const [k, id] of cards.entries()) reg = (await record(reg, (await give(dossierOf(reg, id), maker, owners[k % 1000].pub)).dossier)).reg;
for (let t = 0; t < 9000 - cards.length; t++) {
  const id = S.pick(cards), holder = keyOf[ownerOf(reg, id)], to = owners[S.int(1000)];
  if (to.pub === holder.pub) { t--; continue; }
  const x = await record(reg, (await give(dossierOf(reg, id), holder, to.pub)).dossier);
  if (x.ok) reg = x.reg;
}
const bytes = Buffer.byteLength(JSON.stringify(reg.log));
const t0 = performance.now(), again = await replay(reg.log, { rerun: (rc) => checkDrop(rc, { decoder, log: glog, maker: m.maker }) }), ms = Math.round(performance.now() - t0);
const same = again.ok && canonical({ c: again.reg.cards, h: again.reg.head }) === canonical({ c: reg.cards, h: reg.head });
const out = { kind: 'digi-card.organ-8.record', v: 1, growth, registry: { entries: reg.log.length, bytes, ms, ok: again.ok, same, owners: new Set(Object.values(reg.cards).map((c) => c.owner)).size } };
writeFileSync(new URL('../data/organ-8/record.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('registry ' + reg.log.length + ' entries, ' + Math.round(bytes / 1e6) + ' MB, replayed in ' + ms + ' ms, same ' + same);
