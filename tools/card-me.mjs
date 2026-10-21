#!/usr/bin/env node
// tools/card-me.mjs — "card me", wired: the drop's maker hands the next genesis card to a claimant's key. It replays the
// drop and the public registry from nothing, signs the give with the maker's key, records it, appends the entry to the
// public registry log (registry/log.json — commit it, and CI replays it on every change), writes the claimant's card as
// a PNG to send them, and drafts the claim-gated reply. The key-holder runs this (Simon, or an automation he controls);
// it never posts and never sends anything itself.
//   node tools/card-me.mjs --key <maker key file> --to <claimant's 64-hex key> [--serial N]
//   node tools/card-me.mjs --demo --to <key>        the public demo maker (for trying it)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { cardOf } from '../src/card.mjs';
import { give } from '../src/dossier.mjs';
import { dossierOf, record } from '../src/registry.mjs';
import { gate, PAGE } from '../src/claims.mjs';
import { demoMaker } from '../src/drop.mjs';
import { paintArt } from '../vendor/pixelwhisperer/kards/kardart.mjs';
import { importPriv } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { drop } from './lib.mjs';
import { checkers } from './checkers.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const to = (arg('--to') || '').toLowerCase(), at = (p) => new URL('../' + p, import.meta.url);
if (!/^[0-9a-f]{64}$/.test(to)) { console.log('--to is the claimant’s key: 64 hex characters (their page shows it under Wallet → Your key)'); process.exit(1); }
const maker = process.argv.includes('--demo') ? await demoMaker() : arg('--key') ? await importPriv(JSON.parse(readFileSync(arg('--key'), 'utf8')).key?.pkcs8 ?? readFileSync(arg('--key'), 'utf8').trim()) : null;
if (!maker) { console.log('--key <maker key file> (or --demo)'); process.exit(1); }
const { m, reg } = await drop();
if (maker.pub !== m.maker) { console.log('this key is not the drop’s maker'); process.exit(1); }
const serial = arg('--serial') ? Number(arg('--serial')) : null;
const free = Object.entries(reg.cards).filter(([, c]) => c.owner === m.maker && c.serial > 1 && (serial === null || c.serial === serial)).sort((a, b) => a[1].serial - b[1].serial);
if (!free.length) { console.log(serial === null ? 'every genesis card has been handed out' : 'card #' + serial + ' is not the maker’s to give'); process.exit(1); }
const [id, c] = free[0], g = await give(dossierOf(reg, id), maker, to);
const r = await record(reg, g.dossier);
if (!r.ok) { console.log('refused: ' + r.why); process.exit(1); }
const pub = existsSync(at('registry/log.json')) ? JSON.parse(readFileSync(at('registry/log.json'), 'utf8')) : [];
pub.push(r.entry);
mkdirSync(at('registry/'), { recursive: true });
writeFileSync(at('registry/log.json'), JSON.stringify(pub) + '\n');
const png = (await cardOf(g.dossier, (f, t, w, h) => paintArt(f, t, w, h))).png, pad = String(c.serial).padStart(4, '0');
mkdirSync(at('out/'), { recursive: true });
writeFileSync(at('out/digi-' + pad + '-' + to.slice(0, 8) + '.png'), png);
const reply = { text: 'Card #' + pad + ' is yours: its seals check and its mind grows on your device, offline. Open the PNG on the page to check it, then re-run every claim: ' + PAGE + '#card=' + pad, claims: [{ kind: 'verified', serial: c.serial }, { kind: 'offline', serial: c.serial }] };
const ok = await gate(reply, checkers());
console.log('GIVEN · card #' + pad + ' (' + id + ') to ' + to.slice(0, 8) + '… · registry/log.json now holds ' + pub.length + ' public entr' + (pub.length === 1 ? 'y' : 'ies') + ' · the card: out/digi-' + pad + '-' + to.slice(0, 8) + '.png');
console.log(ok.ok ? 'REPLY (claim-gated): ' + reply.text : 'the reply did not pass the claim gate: ' + ok.why);
