#!/usr/bin/env node
// tools/order.mjs — proves from git that an organ was sealed before it was measured, on the very code and data the seal
// pinned: the last commit to touch the seal must be a strict ancestor of the commit that first added the record, and every
// pinned file must be byte-identical in that commit. dex-frontier's and living-seed's tools/order.mjs, on this repo.
//   node tools/order.mjs --organ <k>   → ORDER ✓ or ✗ (exit 1)
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const fileHash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ROOT = new URL('../', import.meta.url);
const run = { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 };
const git = (...a) => execFileSync('git', a, { ...run, encoding: 'utf8' });
const commits = (opts, path) => git('log', ...opts, '--format=%H', '--', path).trim().split('\n').filter(Boolean);
/** files git keeps byte for byte (marked -text): a carriage return in them is their own, not a checkout's */
const binary = () => readFileSync(new URL('.gitattributes', ROOT), 'utf8').split('\n').filter((l) => / -text\s*$/.test(l)).map((l) => l.split(/\s+/)[0]);
const isBinary = (p) => binary().some((g) => (g.includes('*') ? new RegExp('^' + g.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$').test(p) : g === p));

/** seal: pin every file's bytes, refusing a carriage return in a text file (Windows and Linux must hash the same bytes) */
export function pin(paths) {
  return Object.fromEntries(paths.map((p) => {
    const bytes = readFileSync(new URL(p, ROOT));
    if (!isBinary(p) && bytes.includes(13)) throw new Error(p + ' holds a carriage return');
    return [p, fileHash(bytes)];
  }));
}

/** → { ok, why } */
export function order(prereg, sealPath, later) {
  const seal = commits(['-1'], sealPath)[0];
  if (!seal) return { ok: false, why: 'the seal is not committed' };
  for (const path of later) {
    const record = commits(['--diff-filter=A'], path).pop();
    if (!record) return { ok: false, why: path + ' is not committed' };
    if (seal === record) return { ok: false, why: 'the seal and ' + path + ' came in the same commit' };
    try { git('merge-base', '--is-ancestor', seal, record); } catch { return { ok: false, why: 'the seal as it stands was not committed before ' + path }; }
    for (const [p, hash] of Object.entries(prereg.files)) {
      let bytes;
      try { bytes = execFileSync('git', ['show', record + ':' + p], run); } catch { return { ok: false, why: p + ' is missing from the commit that added ' + path }; }
      if (fileHash(bytes) !== hash) return { ok: false, why: p + ' changed between the seal and ' + path };
    }
  }
  return { ok: true, why: 'sealed in ' + seal.slice(0, 7) + ', then ' + later.map((p) => p.split('/').pop() + ' in ' + commits(['--diff-filter=A'], p).pop().slice(0, 7)).join(', ') + ' — on the ' + Object.keys(prereg.files).length + ' files it pinned, byte for byte' };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/order.mjs');
if (isMain) {
  const k = process.argv[process.argv.indexOf('--organ') + 1], seal = 'data/organ-' + k + '/prereg.json';
  const r = order(JSON.parse(readFileSync(new URL(seal, ROOT), 'utf8')), seal, ['data/organ-' + k + '/record.json']);
  console.log((r.ok ? 'ORDER ✓ organ ' + k + ' · ' : 'ORDER ✗ organ ' + k + ' · ') + r.why);
  process.exit(r.ok ? 0 : 1);
}
