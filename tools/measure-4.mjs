#!/usr/bin/env node
// tools/measure-4.mjs — organ 4, BREEDING, measured as tools/seal-4.mjs sealed it. Writes data/organ-4/record.json.
import { writeFileSync } from 'node:fs';
import { give, issue, verify } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { breed, birthCheck } from '../src/breed.mjs';
import { demoMaker, themeOf } from '../src/drop.mjs';
import { open } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { drop, ground, setOfDomain, owner, testOf } from './lib.mjs';

const { m, reg } = await drop(), maker = await demoMaker();
const by = {};
for (const c of m.cards) (by[c.domain] ||= []).push(c);
for (const d of Object.keys(by)) by[d].sort((a, b) => a.serial - b.serial);
const pairs = [];
for (const [d, cs] of Object.entries(by)) for (let i = 0; i < 5 && 2 * i + 1 < cs.length; i++) pairs.push({ kind: 'same', a: cs[2 * i], b: cs[2 * i + 1] });
const sets = {};
for (const d of Object.keys(by)) (sets[setOfDomain(d)] ||= []).push(d);
for (const ds of Object.values(sets)) for (let j = 0; j + 1 < ds.length; j++) for (let i = 0; i < 5; i++) pairs.push({ kind: 'cross', a: by[ds[j]][10 + i], b: by[ds[j + 1]][10 + i] });
console.log('organ 4 · ' + pairs.length + ' pairs');
const rows = [];
for (const [k, p] of pairs.entries()) {
  const breeder = await owner('breeder-' + k), g = await ground(setOfDomain(p.a.domain));
  const va = await verify((await give(dossierOf(reg, p.a.card), maker, breeder.pub)).dossier), vb = await verify((await give(dossierOf(reg, p.b.card), maker, breeder.pub)).dossier);
  const r = await breed(va, vb, g, breeder, { seed: 1 });
  const row = { kind: p.kind, a: p.a.serial, b: p.b.serial, domains: [p.a.domain, p.b.domain], born: r.born, tries: r.tries };
  if (r.born) {
    const child = await issue(r.genome, breeder, { serial: 1, to: breeder.pub, theme: themeOf(1), generation: Math.max(va.generation, vb.generation) + 1 });
    const vc = await verify(child.dossier), seal = await open(r.genome), bc = birthCheck(vc, va, vb, g);
    Object.assign(row, { gate: r.gate, parentsGate: r.parents, check: bc.ok, lineage: seal.fields.parents.join() === [va.id, vb.id].join() && seal.fields.by === breeder.pub && seal.fields.gate.auc === Math.max(va.genome.gate.auc, vb.genome.gate.auc) && vc.generation === 1,
      test: testOf(vc, g), parentsTest: [testOf(va, g), testOf(vb, g)] });
  } else Object.assign(row, { why: r.why });
  rows.push(row);
}
const born = (kind) => rows.filter((r) => r.kind === kind && r.born), over = (r) => r.test > Math.max(...r.parentsTest);
const out = { kind: 'digi-card.organ-4.record', v: 1, pairs: rows.length,
  same: { pairs: rows.filter((r) => r.kind === 'same').length, born: born('same').length, overOnTest: born('same').filter(over).length },
  cross: { pairs: rows.filter((r) => r.kind === 'cross').length, born: born('cross').length, overOnTest: born('cross').filter(over).length }, rows };
writeFileSync(new URL('../data/organ-4/record.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('same: ' + out.same.born + '/' + out.same.pairs + ' born, ' + out.same.overOnTest + ' over both on TEST · cross: ' + out.cross.born + '/' + out.cross.pairs + ' born, ' + out.cross.overOnTest + ' over both on TEST');
