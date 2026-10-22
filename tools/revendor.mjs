#!/usr/bin/env node
// tools/revendor.mjs — vendor a source repository again at one commit, byte for byte: every file vendor/SOURCES.json lists
// for it is read from that commit (git show, in the repository's local checkout), written over the vendored copy if its
// bytes changed, and re-hashed into SOURCES.json; the commit is pinned. A file the source does not yet list is added to
// SOURCES.json by hand first. Then node tools/vendor-check.mjs must say VENDOR OK.
//   node tools/revendor.mjs <owner/repo> <full 40-hex commit>
// NEVER while an organ's record is still to be committed: vendor/SOURCES.json is in every organ's BASE pins.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [repo, sha] = process.argv.slice(2);
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !/^[0-9a-f]{40}$/.test(sha || '')) { console.error('usage: node tools/revendor.mjs <owner/repo> <full 40-hex commit>'); process.exit(1); }
const at = (p) => new URL('../' + p, import.meta.url);
const S = JSON.parse(readFileSync(at('vendor/SOURCES.json'), 'utf8')), src = S.sources.find((x) => x.repo === repo);
if (!src) { console.error(repo + ' is not a vendored source (vendor/SOURCES.json)'); process.exit(1); }
const changed = [];
for (const [path, rec] of Object.entries(src.files)) {
  const bytes = execFileSync('git', ['show', sha + ':' + rec.from], { cwd: src.local, maxBuffer: 1 << 26 });
  const h = createHash('sha256').update(bytes).digest('hex');
  if (h !== rec.sha256) { changed.push(path); writeFileSync(at(path), bytes); rec.sha256 = h; }
}
src.commit = sha;
const crlf = readFileSync(at('vendor/SOURCES.json'), 'utf8').includes('\r\n');
let out = JSON.stringify(S, null, 1) + '\n';
if (crlf) out = out.replace(/\n/g, '\r\n');
writeFileSync(at('vendor/SOURCES.json'), out);
console.log('pinned ' + repo + ' at ' + sha.slice(0, 7) + ' · changed: ' + (changed.join(', ') || 'none') + ' · now run node tools/vendor-check.mjs');
