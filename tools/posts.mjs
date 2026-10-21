#!/usr/bin/env node
// tools/posts.mjs — the drop's public posts, drafted from the drop itself and passed through the claim gate with checkers
// that re-run every claim now. Writes docs/posts.json: what Grok (or Simon) may post, each with the claims it rests on.
// Posting is the drop owner's act, never this tool's: it drafts and checks; a person publishes.
//   node tools/posts.mjs            → docs/posts.json (only posts that pass), and a line per post
import { writeFileSync, mkdirSync } from 'node:fs';
import { gate, PAGE } from '../src/claims.mjs';
import { checkers } from './checkers.mjs';
import { drop } from './lib.mjs';

const { m } = await drop();
const best = [...m.cards].sort((a, b) => b.gate - a.gate)[0], pad = (s) => String(s).padStart(4, '0'), three = (g) => (g / 1e6).toFixed(3);
export const DRAFTS = (m) => [
  { text: 'Decoder #0001 is out: ' + m.total.toLocaleString('en') + ' DIGI cards, each a picture whose pixels carry a working mind grown on real records. Hold #0001 and re-run the whole drop yourself: ' + PAGE,
    claims: [{ kind: 'drop' }] },
  { text: 'DIGI #' + pad(best.serial) + ' (' + best.domain + ') scores ' + three(best.gate) + ' on cases it never grew on, and it grows on your device with the network off. Re-run it yourself: ' + PAGE,
    claims: [{ kind: 'grown', serial: best.serial }, { kind: 'offline', serial: best.serial }] },
  { text: 'Say "card me" and get a DIGI card: its seals check, its owner is you, and its mind grows offline on real records. No server, no chain. Re-run every claim: ' + PAGE,
    claims: [{ kind: 'verified', serial: 2 }, { kind: 'offline', serial: 2 }] },
  { text: 'A DIGI card levels up only by a gain anyone can re-run: the receipt carries both minds and both scores. Rarity is earned, never printed. Re-run a level yourself: ' + PAGE,
    claims: [{ kind: 'verified', serial: 1 }] },
  { text: 'Owned DIGI cards of one business answer as one: on credit, ' + '{mesh}' + '. Each owner is credited by measured share. Re-run it: ' + PAGE,
    claims: [{ kind: 'mesh', set: 'credit' }] },
];

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/posts.mjs');
if (isMain) {
  const C = checkers(), out = [];
  for (const d of DRAFTS(m)) {
    let post = d;
    if (d.text.includes('{mesh}')) { const r = await C.mesh(d.claims[0]); post = { ...d, text: d.text.replace('{mesh}', r.ok ? r.says[0] + ' cards score ' + r.says[1] + ' on cases none grew on, against ' + r.says[2] + ' for the best of them alone' : 'the mesh') }; }
    const g = await gate(post, C);
    console.log((g.ok ? 'PASS ' : 'REFUSED ') + post.text.slice(0, 90) + '… ' + (g.ok ? '' : g.why));
    if (g.ok) out.push({ ...post, vouched: g.says });
  }
  mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../docs/posts.json', import.meta.url), JSON.stringify({ kind: 'digi-card.posts', v: 1, note: 'drafted and claim-gated by tools/posts.mjs; a person publishes them', posts: out }, null, 1) + '\n');
}
