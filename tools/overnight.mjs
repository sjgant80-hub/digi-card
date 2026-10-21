#!/usr/bin/env node
// tools/overnight.mjs — a wallet works overnight on its owner's own machine: every card searches for a level (three
// seeds from its life, on a pool of workers), and every level found is signed in by the owner's key, re-run here, and
// written back. The same gate as the page: only a gain that re-runs is kept. Schedule it nightly (cron, Task Scheduler).
//   node tools/overnight.mjs <wallet.json> [--searches 3]
// wallet.json: { "key": { "pub": hex, "pkcs8": hex }, "cards": [dossier, …] } — the page's "Back up my key" file plus
// the cards' dossiers. The key never leaves the machine; nothing is sent anywhere.
import { readFileSync, writeFileSync } from 'node:fs';
import { verify, addReceipt } from '../src/dossier.mjs';
import { rerun, seedsFor, lifts, searchOf, mindOf, GROW } from '../src/mind.mjs';
import { IDS } from '../src/data.mjs';
import { importPriv } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { ground, setOfDomain, searchAll } from './lib.mjs';

const path = process.argv[2], n = Number(process.argv[process.argv.indexOf('--searches') + 1]) || 3;
if (!path) { console.log('node tools/overnight.mjs <wallet.json> [--searches 3]'); process.exit(1); }
const wallet = JSON.parse(readFileSync(path, 'utf8')), keys = await importPriv(wallet.key.pkcs8);
if (keys.pub !== wallet.key.pub) { console.log('the wallet’s key does not match its public half'); process.exit(1); }
const work = [];
for (const [i, d] of wallet.cards.entries()) {
  const v = await verify(d), domain = v.ok ? v.genome.organs[0].split(' ')[2] : '', set = setOfDomain(domain);
  if (!v.ok || v.owner !== keys.pub || !IDS[set]) { console.log('card ' + (i + 1) + ': skipped (' + (v.ok ? (v.owner !== keys.pub ? 'not yours' : 'not on a bundled ground') : v.why) + ')'); continue; }
  work.push({ i, d, v, domain, set, seeds: seedsFor(v.head, n) });
}
const found = await searchAll(work.flatMap((w) => w.seeds.map((seed) => ({ set: w.set, domain: w.domain, seed, grow: GROW }))));
let levels = 0;
for (const [j, w] of work.entries()) {
  const g = await ground(w.set), now = mindOf(w.v, g).gate;
  const hit = w.seeds.map((seed, k) => ({ seed, r: found[j * n + k] })).find(({ r }) => r && r.state !== 'failed' && lifts(now, r.gate));
  if (!hit) { console.log('#' + String(w.v.serial).padStart(4, '0') + ': no level tonight (' + n + ' searches)'); continue; }
  const receipt = { kind: 'level', data: IDS[w.set], domain: w.domain, recipe: hit.r.fixed, found: searchOf(w.domain, hit.seed, GROW), before: now, after: hit.r.gate };
  const next = await addReceipt(w.d, keys, receipt), v2 = next.ok && (await verify(next.dossier));
  const check = v2 && rerun(receipt, v2, next.dossier.events.length - 1, next.dossier, { ground: g });
  if (!check || !check.ok) { console.log('#' + String(w.v.serial).padStart(4, '0') + ': a level did not re-run, so it was not kept'); continue; }
  wallet.cards[w.i] = next.dossier; levels++;
  console.log('#' + String(w.v.serial).padStart(4, '0') + ': LEVEL ' + (now / 1e6).toFixed(6) + ' → ' + (hit.r.gate / 1e6).toFixed(6) + ' on GATE, re-run and kept');
}
writeFileSync(path, JSON.stringify(wallet, null, 1) + '\n');
console.log(levels + ' level(s) earned tonight across ' + work.length + ' card(s); the wallet is written back.');
