#!/usr/bin/env node
// tools/measure-3.mjs — organ 3, STAGE BY RECEIPT, measured as tools/seal-3.mjs sealed it. Writes data/organ-3/record.json.
import { writeFileSync } from 'node:fs';
import { give, addReceipt, verify } from '../src/dossier.mjs';
import { dossierOf, record } from '../src/registry.mjs';
import { IDS } from '../src/data.mjs';
import { mindOf, organOf, rerun, searchOf, seedsFor, lifts, GROW } from '../src/mind.mjs';
import { demoMaker } from '../src/drop.mjs';
import { drop, ground, setOfDomain, viewOf, searchAll, owner, testOf, meanLow } from './lib.mjs';

const { m, reg } = await drop(), maker = await demoMaker();
const sample = m.cards.filter((_, k) => k % 10 === 0);
console.log('organ 3 · ' + sample.length + ' cards, three searches each');
const lives = [];
for (const [k, c] of sample.entries()) {
  const o = await owner('level-' + k), d = (await give(dossierOf(reg, c.card), maker, o.pub)).dossier, v = await verify(d);
  lives.push({ c, o, d, v, seeds: seedsFor(v.head, 3) });
}
const found = await searchAll(lives.flatMap(({ c, seeds }) => seeds.map((seed) => ({ set: setOfDomain(c.domain), domain: c.domain, seed, grow: GROW }))));
const levels = [], earned = [];
let tried = 0, registryWith = 0, registryWithout = 0;
for (const [k, L] of lives.entries()) {
  const g = await ground(setOfDomain(L.c.domain)), now = mindOf(L.v, g);
  tried++;
  const hit = L.seeds.map((seed, j) => ({ seed, r: found[k * 3 + j] })).find(({ r }) => r && r.state !== 'failed' && lifts(now.gate, r.gate));
  if (!hit) continue;
  const receipt = { kind: 'level', data: IDS[setOfDomain(L.c.domain)], domain: L.c.domain, recipe: hit.r.fixed, found: searchOf(L.c.domain, hit.seed, GROW), before: now.gate, after: hit.r.gate };
  const d2 = (await addReceipt(L.d, L.o, receipt)).dossier;
  earned.push({ L, g, now, hit, receipt, d2, v2: await verify(d2), kEv: d2.events.length - 1 });
}
// the deep re-runs repeat a search each, so they run on the pool: the very rerun() kernel, in parallel
const deepJobs = earned.flatMap(({ L, receipt, d2, kEv, hit }) => [receipt, { ...receipt, found: searchOf(L.c.domain, hit.seed + 1, GROW) }].map((r) => ({ op: 'rerun', set: setOfDomain(L.c.domain), receipt: r, dossier: d2, k: kEv, deep: true })));
const deep = await searchAll(deepJobs);
for (const [j, { L, g, receipt, d2, v2, kEv }] of earned.entries()) {
  const shallow = rerun(receipt, v2, kEv, d2, { ground: g }), deepR = deep[2 * j];
  const other = m.cards.find((x) => x.domain === L.c.domain && x.recipe !== L.c.recipe && x.recipe !== receipt.recipe);
  const otherSet = Object.keys(IDS).find((s) => s !== setOfDomain(L.c.domain));
  const forged = {
    'a raised score': { ...receipt, after: receipt.after + 1 },
    'a lowered start': { ...receipt, before: receipt.before - 1 },
    'another ground': { ...receipt, data: IDS[otherSet] },
    'another mind': { ...receipt, recipe: other.recipe },
  };
  const refused = Object.fromEntries(Object.entries(forged).map(([name, r]) => [name, !rerun(r, v2, kEv, d2, { ground: g }).ok]));
  refused['another search'] = !deep[2 * j + 1].ok;
  let reg2 = (await record(reg, L.d)).reg;
  const withR = await record(reg2, d2, { rerun: (rc, vv, kk, dd) => rerun(rc, vv, kk, dd, { ground: g }) }), without = await record(reg2, d2);
  if (withR.ok) registryWith++;
  if (!without.ok) registryWithout++;
  const after = mindOf(v2, g);
  levels.push({ serial: L.c.serial, domain: L.c.domain, seed: earned[j].hit.seed, before: receipt.before, after: receipt.after, testBefore: testOf(L.v, g), testAfter: testOf(v2, g), shallow: shallow.ok, deep: deepR.ok, refused, afterGate: after.gate });
}
const gains = levels.map((l) => l.testAfter - l.testBefore);
const out = { kind: 'digi-card.organ-3.record', v: 1, sampled: tried, leveled: levels.length, registry: { withRerun: registryWith, refusedWithout: registryWithout },
  testUp: levels.filter((l) => l.testAfter > l.testBefore).length, meanTestGain: gains.length ? Math.round(gains.reduce((a, b) => a + b, 0) / gains.length) : null, meanTestGainLow95: gains.length ? Math.round(meanLow(gains)) : null, levels };
writeFileSync(new URL('../data/organ-3/record.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('leveled ' + levels.length + '/' + tried + ' · TEST up in ' + out.testUp + ' · mean TEST gain ' + out.meanTestGain + ' (low95 ' + out.meanTestGainLow95 + ')');
