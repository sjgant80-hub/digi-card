#!/usr/bin/env node
// tools/superseded.mjs — a RED organ that a later organ measured the fix for. The red is never edited and never hidden:
// this passes only when the red organ's committed verdict is still exactly what its own sealed rules give, the
// properties it names as failed are exactly the ones that failed (a new failure is not covered), and the organ that
// measured the fix was sealed before it was measured and held every one of its properties.
//   node tools/superseded.mjs --organ <k>   → SUPERSEDED ✓ (exit 0) or ✗ (exit 1)
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { judge } from './organ.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const no = (why) => { console.log('SUPERSEDED ✗ · ' + why); process.exit(1); };

/** the verdict text an organ's own sealed rules give over its own record, exactly as tools/organ.mjs writes it */
async function verdictOf(k) {
  const pre = read('data/organ-' + k + '/prereg.json'), rec = read('data/organ-' + k + '/record.json');
  const { RULES } = await import(new URL('tools/judge-' + k + '.mjs', ROOT).href);
  const verdicts = judge(JSON.parse(pre), JSON.parse(rec), RULES);
  return { verdicts, text: JSON.stringify({ kind: 'digi-card.organ-' + k + '.verdict', v: 1, prereg: sha(pre).slice(0, 16), record: sha(rec).slice(0, 16), verdicts }, null, 1) + '\n' };
}

const at = process.argv.indexOf('--organ'), k = Number(process.argv[at + 1]);
if (at < 0 || !Number.isInteger(k) || k < 1) no('name the red organ: --organ <k>');
const f = 'data/organ-' + k + '/superseded.json';
if (!existsSync(new URL(f, ROOT))) no('organ ' + k + ' is red and nothing says a later organ measured its fix');
const s = JSON.parse(read(f));
if (s.kind !== 'digi-card.organ-' + k + '.superseded' || !Number.isInteger(s.by) || s.by <= k || !Array.isArray(s.failed) || typeof s.why !== 'string' || !s.why) no(f + ' is not a superseded record');

const red = await verdictOf(k);
if (read('data/organ-' + k + '/verdict.json') !== red.text) no('organ ' + k + '’s committed verdict is not what its sealed rules give');
const failed = red.verdicts.filter((v) => !v.pass && v.kind !== 'prediction').map((v) => v.id).sort();
if (JSON.stringify(failed) !== JSON.stringify([...s.failed].sort())) no('organ ' + k + ' failed ' + (failed.join(', ') || 'nothing') + ', but ' + f + ' names ' + (s.failed.join(', ') || 'nothing'));
if (!failed.length) no('organ ' + k + ' is not red: nothing to supersede');

const by = s.by;
if (!existsSync(new URL('data/organ-' + by + '/verdict.json', ROOT))) no('organ ' + by + ' has not been judged');
const fix = await verdictOf(by);
if (read('data/organ-' + by + '/verdict.json') !== fix.text) no('organ ' + by + '’s committed verdict is not what its sealed rules give');
const fixFailed = fix.verdicts.filter((v) => !v.pass && v.kind !== 'prediction').map((v) => v.id);
if (fixFailed.length) no('organ ' + by + ', which measured the fix, failed ' + fixFailed.join(', '));
try { execFileSync(process.execPath, [new URL('tools/order.mjs', ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '--organ', String(by)], { stdio: 'ignore' }); }
catch { no('organ ' + by + ' was not provably sealed before it was measured'); }

console.log('SUPERSEDED ✓ · organ ' + k + ' is RED as sealed (' + failed.join(', ') + ' failed — kept) · the fix was measured by organ ' + by + ', sealed first, every property held · ' + s.why);
