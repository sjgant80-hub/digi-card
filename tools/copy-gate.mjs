#!/usr/bin/env node
// tools/copy-gate.mjs — src/copy.mjs over files: every word DIGI's copy never uses, and every bare quote of organ 10.
// An .html file is read as it shows (src/copy.mjs pageText); anything else as written.
//   node tools/copy-gate.mjs index.html README.md llms.txt   → one line a hit; exit 1 if any
import { readFileSync } from 'node:fs';
import { copyHits, organ10Bare, pageText } from '../src/copy.mjs';

let hits = 0;
for (const f of process.argv.slice(2)) {
  const raw = readFileSync(f, 'utf8'), text = /\.html?$/.test(f) ? pageText(raw) : raw;
  for (const h of copyHits(text)) { hits++; console.log(f + ' · ' + h.word + ' · ' + h.context); }
  for (const c of organ10Bare(text)) { hits++; console.log(f + ' · organ 10 without its caveat · ' + c); }
}
console.log(hits ? 'COPY BROKEN · ' + hits + ' hit' + (hits === 1 ? '' : 's') : 'COPY OK');
process.exit(hits ? 1 : 0);
