#!/usr/bin/env node
// tools/vendor-check.mjs — every vendored file is byte-identical to its source at the commit vendor/SOURCES.json pins.
// Each file's SHA-256 is checked against the record; with --sources, also against `git show <commit>:<path>` in the source
// repositories on this machine (C:/Users/sjgan/<repo>), so the record itself is proven, not just believed.
//   node tools/vendor-check.mjs [--sources]   → VENDOR OK | VENDOR DRIFT (exit 1)
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url), sha = (b) => createHash('sha256').update(b).digest('hex');
const src = JSON.parse(readFileSync(new URL('vendor/SOURCES.json', ROOT), 'utf8'));
let bad = 0, n = 0;
for (const s of src.sources) {
  for (const [path, { from, sha256 }] of Object.entries(s.files)) {
    n++;
    const have = sha(readFileSync(new URL(path, ROOT)));
    if (have !== sha256) { bad++; console.log('DRIFT ' + path + ' is not the recorded bytes'); continue; }
    if (process.argv.includes('--sources')) {
      const theirs = sha(execFileSync('git', ['show', s.commit + ':' + from], { cwd: s.local, maxBuffer: 1 << 26 }));
      if (theirs !== sha256) { bad++; console.log('DRIFT ' + path + ' is not ' + s.repo + '@' + s.commit.slice(0, 7) + ':' + from); }
    }
  }
}
console.log(bad ? 'VENDOR DRIFT · ' + bad + ' of ' + n + ' files' : 'VENDOR OK · ' + n + ' files byte-identical to their sources' + (process.argv.includes('--sources') ? ' (checked against the source repositories)' : ''));
process.exit(bad ? 1 : 0);
