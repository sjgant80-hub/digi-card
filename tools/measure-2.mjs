#!/usr/bin/env node
// tools/measure-2.mjs — organ 2, GERMINATION, measured as tools/seal-2.mjs sealed it. Writes data/organ-2/record.json.
import { writeFileSync, readFileSync } from 'node:fs';
import { SETS, openSet } from '../src/data.mjs';
import { organOf, GROW } from '../src/mind.mjs';
import { probeOffline, auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { drop, ground, setOfDomain, viewOf, searchAll, milli } from './lib.mjs';

const { m } = await drop();
const cards = [{ ...m.first, serial: 1 }, ...m.cards];
console.log('organ 2 · ' + cards.length + ' cards');
const rows = [];
let declared = 0, trapped = 0, touched = 0;
for (const c of cards) {
  const g = await ground(setOfDomain(c.domain)), view = viewOf(g, c.domain);
  const p = probeOffline(() => organOf(c.recipe, view, m.bar));
  if (p.ok) trapped++;
  if (p.networkTouched) touched++;
  const o = p.result;
  if (o && o.ok && o.gate === c.gate) declared++;
  // TEST: the rows nothing fitted or selected on — read here, by the sealed measurement, for the first time
  const t = g.ds.testRows, score = (i) => o.body.rules.reduce((s, r) => s + ((r.op === '>' ? view.cols[r.feat][i] > r.v : view.cols[r.feat][i] <= r.v) ? r.w : 0), 0);
  rows.push({ serial: c.serial, domain: c.domain, gate: c.gate, test: milli(auc(t.map(score), t.map((i) => g.ds.y[i]))) });
}
const deep = cards.filter((_, k) => k % 20 === 0), found = await searchAll(deep.map((c) => ({ set: setOfDomain(c.domain), domain: c.domain, seed: Number(c.found.split(' ')[3]), grow: GROW })));
const deepSame = deep.filter((c, k) => found[k] && found[k].fixed === c.recipe).length;
const bytes = {};
for (const set of Object.keys(SETS)) {
  const files = Object.fromEntries(Object.keys(SETS[set].files).map((f) => [f, new Uint8Array(readFileSync(new URL('../data/' + f, import.meta.url)))]));
  const first = Object.keys(files)[0], changed = files[first].slice(); changed[1000] ^= 1;
  const r = await openSet(set, { ...files, [first]: changed });
  bytes[set] = r.ok ? 'opened' : r.why;
}
const by = {};
for (const r of rows) (by[r.domain] ||= []).push(r);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[(s.length - 1) >> 1]; };
const out = { kind: 'digi-card.organ-2.record', v: 1, cards: cards.length, declared, offline: { ran: trapped, touched }, deep: { tried: deep.length, same: deepSame },
  changedBytes: bytes, aboveCoin: rows.filter((r) => r.test > 500000).length, medianDrop: med(rows.map((r) => r.gate - r.test)),
  departments: Object.fromEntries(Object.entries(by).map(([d, rs]) => [d, { cards: rs.length, medianGate: med(rs.map((r) => r.gate)), medianTest: med(rs.map((r) => r.test)) }])), rows };
writeFileSync(new URL('../data/organ-2/record.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('declared ' + declared + '/' + cards.length + ' · deep ' + deepSame + '/' + deep.length + ' · above a coin on TEST ' + out.aboveCoin + ' · median GATE→TEST drop ' + out.medianDrop);
