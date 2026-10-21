#!/usr/bin/env node
// tools/drop-check.mjs — CI re-runs the drop on every change: the genesis log replays from nothing to decoder #0001's head,
// every card of one maker; the frozen decoder v1 files hash to the decoder #0001 names; the manifest is exactly what the
// log holds; and the showcase PNGs in cards/ regenerate byte for byte. → DROP OK | DROP BROKEN (exit 1)
//   node tools/drop-check.mjs [--write-showcase]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { cardOf } from '../src/card.mjs';
import { verify } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { paintArt } from '../vendor/pixelwhisperer/kards/kardart.mjs';
import { organOf } from '../src/mind.mjs';
import { drop, ground, setOfDomain, viewOf } from './lib.mjs';

const paint = (f, t, w, h) => paintArt(f, t, w, h), at = (p) => new URL('../' + p, import.meta.url);
const problems = [];
const { m, reg, decoder, files } = await drop();   // throws if the log does not replay with #0001's receipt re-run
for (const [p, h] of Object.entries(m.decoder.files)) if (files[p] !== h) problems.push('decoder/v1/' + p + ' is not the bytes the drop named');
if (decoder !== m.decoder.hash) problems.push('decoder v1 does not hash to the manifest’s decoder');
const first = dossierOf(reg, m.first.card);
if (!first || first.events[1].receipt.decoder !== m.decoder.hash) problems.push('#0001 does not carry the manifest’s decoder');
let regrown = 0;
for (const c of [{ ...m.first, serial: 1 }, ...m.cards]) {
  const v = await verify(dossierOf(reg, c.card));
  if (!v.ok || v.serial !== c.serial || v.genome.organs[0] !== c.recipe) problems.push('card #' + c.serial + ' is not what the manifest says');
  const o = organOf(c.recipe, viewOf(await ground(setOfDomain(c.domain)), c.domain), m.bar);   // every declared score, re-grown here
  if (o.ok && o.gate === c.gate) regrown++; else problems.push('card #' + c.serial + ' re-grows to ' + o.gate + ', not the declared ' + c.gate);
}
if (Object.keys(reg.cards).length !== m.total) problems.push('the log holds ' + Object.keys(reg.cards).length + ' cards, the manifest says ' + m.total);
// the showcase: #0001 and the first card of every department, as PNGs anyone can download from the repository
const show = [m.first, ...[...new Set(m.cards.map((c) => c.domain))].map((d) => m.cards.find((c) => c.domain === d))];
mkdirSync(at('cards/'), { recursive: true });
for (const c of show) {
  const png = (await cardOf(dossierOf(reg, c.card), paint)).png, path = 'cards/' + String(c.serial ?? 1).padStart(4, '0') + '.png';
  if (process.argv.includes('--write-showcase')) writeFileSync(at(path), png);
  else if (!existsSync(at(path)) || Buffer.compare(readFileSync(at(path)), Buffer.from(png)) !== 0) problems.push(path + ' does not regenerate byte for byte');
}
console.log(problems.length ? 'DROP BROKEN · ' + problems.join('; ') : 'DROP OK · ' + m.total + ' cards replayed from nothing to ' + m.log.head.slice(0, 16) + ' · ' + regrown + ' minds re-grown to their declared GATE · decoder v1 ' + decoder.slice(0, 16) + ' over ' + Object.keys(files).length + ' files · ' + show.length + ' showcase PNGs byte-identical');
process.exit(problems.length ? 1 : 0);
