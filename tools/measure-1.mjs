#!/usr/bin/env node
// tools/measure-1.mjs — organ 1, THE CARD, measured as tools/seal-1.mjs sealed it. Writes data/organ-1/record.json.
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cardOf, readCard, W, H, BAND } from '../src/card.mjs';
import { encode, verify, addReceipt, give } from '../src/dossier.mjs';
import { dossierOf, record } from '../src/registry.mjs';
import { IDS } from '../src/data.mjs';
import { rerun, searchOf } from '../src/mind.mjs';
import { paintArt } from '../vendor/pixelwhisperer/kards/kardart.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { drop, ground, setOfDomain, offline, pngOf, pixelsOf, owner } from './lib.mjs';
import { demoMaker } from '../src/drop.mjs';

const paint = (f, t, w, h) => paintArt(f, t, w, h), sha = (b) => createHash('sha256').update(b).digest('hex');
const { reg, m } = await drop(), maker = await demoMaker(), stranger = await owner('stranger');
const ids = Object.keys(reg.cards).sort((a, b) => reg.cards[a].serial - reg.cards[b].serial);
console.log('organ 1 · ' + ids.length + ' cards');
let roundtrip = 0, identical = 0;
const times = [], bad = [];
for (const id of ids) {
  const d = dossierOf(reg, id), c = await cardOf(d, paint), c2 = await cardOf(d, paint);
  const t0 = performance.now(), r = await readCard(c.png, paint); times.push(performance.now() - t0);
  if (r.ok && canonical(r.dossier) === canonical(d) && r.id === id) roundtrip++; else bad.push(id);
  if (sha(c.png) === sha(c2.png)) identical++;
}
times.sort((a, b) => a - b);
const sample = ids.filter((_, k) => k % 10 === 0), F = W * BAND * 3;
const classes = {};
const tally = (name, r) => { (classes[name] ||= { tried: 0, refused: 0, why: {} }); classes[name].tried++; if (!r.ok) { classes[name].refused++; classes[name].why[r.why.split(':')[0]] = (classes[name].why[r.why.split(':')[0]] || 0) + 1; } };
let offlineReads = 0, touched = 0, fakeRead = 0, fakeRefused = 0;
for (const [k, id] of sample.entries()) {
  const d = dossierOf(reg, id), png = (await cardOf(d, paint)).png, px = pixelsOf(png, W, H), other = pixelsOf((await cardOf(dossierOf(reg, sample[(k + 1) % sample.length]), paint)).png, W, H);
  const withBand = (bytes) => { const p = px.slice(); p.fill(0, 0, F); p.set([0x44, 0x47, 0x31, bytes.length >>> 16, (bytes.length >>> 8) & 255, bytes.length & 255, ...bytes], 0); return pngOf(p, W, H); };
  const reband = (d2) => withBand(utf8(encode(d2)));
  const e0 = d.events[0];
  const forgeries = {
    'a face pixel flipped': () => { const p = px.slice(); p[F + ((k * 7919) % (px.length - F))] ^= 1; return pngOf(p, W, H); },
    'a byte after the dossier': () => { const p = px.slice(); p[F - 1] = 1; return pngOf(p, W, H); },
    'another card’s face': () => { const p = px.slice(); p.set(other.subarray(F), F); return pngOf(p, W, H); },
    'a changed owner': () => reband({ ...d, events: [{ ...e0, to: stranger.pub }, ...d.events.slice(1)] }),
    'a changed serial': () => reband({ ...d, events: [{ ...e0, serial: e0.serial + 1 }, ...d.events.slice(1)] }),
    'a changed genome byte': () => reband({ ...d, genome: d.genome.replace(/organ ◊ seed\.v1 ([a-z]+)/, (s, x) => s.replace(x, x.slice(0, -1) + (x.endsWith('a') ? 'b' : 'a'))) }),
    'a re-wrapped dossier': () => withBand(utf8(encode(d) + ' ')),
    'a cut-short file': () => png.subarray(0, png.length - 100),
    'a damaged chunk': () => { const b = png.slice(); b[png.length - 50] ^= 1; return b; },
    'the wrong size': () => { const p = px.slice(0, W * (H - 1) * 3); return pngOf(p, W, H - 1); },
    'an event signed by a stranger': async () => { const g = await give(d, maker, stranger.pub); const e = g.dossier.events[1]; return reband({ ...d, events: [...d.events, { ...e, by: stranger.pub }] }); },
    'the magic removed': () => { const p = px.slice(); p[0] = 0; return pngOf(p, W, H); },
  };
  for (const [name, make] of Object.entries(forgeries)) tally(name, await readCard(await make(), paint));
  const o = await offline(() => readCard(png, paint));
  if (o.ok && o.result.ok) offlineReads++;
  if (o.touched) touched++;
  // a fake level, signed by the card's own owner (the maker holds every genesis card): it reads, and the registry refuses it
  const c = m.cards.find((x) => x.card === id) || m.first, g = await ground(setOfDomain(c.domain));
  const fake = await addReceipt(d, maker, { kind: 'level', data: IDS[setOfDomain(c.domain)], domain: c.domain, recipe: c.recipe, found: searchOf(c.domain, 1), before: c.gate, after: c.gate + 5000 });
  if (fake.ok && (await readCard((await cardOf(fake.dossier, paint)).png, paint)).ok) fakeRead++;
  const rec = fake.ok ? await record(reg, fake.dossier, { rerun: (rc, v, kk, dd) => (rc.kind === 'level' ? rerun(rc, v, kk, dd, { ground: g }) : { ok: true }) }) : { ok: false };
  if (fake.ok && !rec.ok) fakeRefused++;
}
const out = { kind: 'digi-card.organ-1.record', v: 1, cards: ids.length, roundtrip, identical, failedRoundtrip: bad, sample: sample.length, forgeries: classes,
  offline: { reads: offlineReads, touched }, fakeLevel: { tried: sample.length, read: fakeRead, refused: fakeRefused }, readMs: { median: Math.round(times[(times.length - 1) >> 1]), p90: Math.round(times[Math.floor(times.length * 0.9)]) }, machine: process.platform + ' ' + process.arch + ' node ' + process.version };
writeFileSync(new URL('../data/organ-1/record.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('roundtrip ' + roundtrip + '/' + ids.length + ' · identical ' + identical + ' · forgeries ' + Object.values(classes).reduce((s, c) => s + c.refused, 0) + '/' + Object.values(classes).reduce((s, c) => s + c.tried, 0) + ' refused · median read ' + out.readMs.median + ' ms · fake levels refused ' + fakeRefused + '/' + sample.length);
