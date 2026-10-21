#!/usr/bin/env node
// tools/genesis.mjs — THE GENESIS: every search behind the drop, then the drop itself. Nothing is picked by hand.
//
//   node tools/genesis.mjs --searches [--workers 10]     admission + searches → drop/searches.jsonl, drop/admission.json
//   node tools/genesis.mjs --mint [--key <file>]         the cards, decoder #0001, the drop log → drop/, decoder/v1/
//
// THE RULES (committed before the first search ran; tools/order.mjs can prove it from git):
//   · every department of the six bundled sets is a candidate (23 of them);
//   · ADMISSION: a department's first ADMIT_SEEDS genesis seeds are searched (seed-library's search, the dex-frontier
//     nodes' size: population 40, elites 8, 30 generations, on FIT; graded on GATE); it is admitted if at least
//     ADMIT_LIVE of them clear the 0.6 bar. Nothing on TEST is read, by this tool or anything it calls;
//   · the plan: serials 2..TOTAL go to the admitted departments in turn (planOf); each department's searches continue,
//     seed after seed in its genesisSeeds order, until it has a live mind for every serial it was given, or CAP_FACTOR ×
//     its share of seeds have been searched — then any serial it cannot fill passes to the next department in turn;
//   · DECODER #0001 carries the best mind of the whole genesis (the highest GATE score; ties to the earlier department,
//     then the earlier seed), and that mind is no other card's;
//   · every search, live or cut, is written to drop/searches.jsonl: the cut ones are part of the record.
// The maker is the demo key (src/drop.mjs) unless --key names a file holding a maker's private key (pkcs8 hex) — the
// real drop's owner runs that, on their own machine; the searches do not depend on the key, so they are not re-run.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { SETS, openSet, viewOf, departments } from '../src/data.mjs';
import { organOf, GROW } from '../src/mind.mjs';
import { planOf, mintGenesis, genesisSeeds, demoMaker, decoderHash, dropReceipt, checkDrop, themeOf, BAR } from '../src/drop.mjs';
import { issue, addReceipt, verify } from '../src/dossier.mjs';
import { empty, record } from '../src/registry.mjs';
import { seal } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { importPriv } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, toHexStr } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';

export const TOTAL = 1000, ADMIT_SEEDS = 8, ADMIT_LIVE = 4, CAP_FACTOR = 4;
const ROOT = new URL('../', import.meta.url), at = (p) => new URL(p, ROOT);
const SEARCHES = at('drop/searches.jsonl');
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };

/** every candidate department, by set, in the bundled order */
async function candidates() {
  const out = [];
  for (const set of Object.keys(SETS)) {
    const bytes = Object.fromEntries(Object.keys(SETS[set].files).map((f) => [f, new Uint8Array(readFileSync(at('data/' + f)))]));
    const g = await openSet(set, bytes);
    if (!g.ok) throw new Error(g.why);
    for (const domain of departments(g)) out.push({ set, domain, ground: g });
  }
  return out;
}

const cached = () => (existsSync(SEARCHES) ? readFileSync(SEARCHES, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const key = (r) => r.domain + ' ' + r.seed;

/** run searches on a pool of workers, appending each result to the cache as it lands */
async function runAll(jobs, workers) {
  const have = new Map(cached().map((r) => [key(r), r])), todo = jobs.filter((j) => !have.has(key(j)));
  if (!todo.length) return have;
  console.log('searching ' + todo.length + ' (' + (jobs.length - todo.length) + ' cached) on ' + workers + ' workers');
  let next = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(workers, todo.length) }, () => new Promise((resolve, reject) => {
    const w = new Worker(new URL('./search-worker.mjs', import.meta.url));
    const feed = () => { if (next >= todo.length) { w.terminate(); resolve(); return; } w.postMessage({ ...todo[next++], grow: GROW }); };
    w.on('message', (r) => {
      appendFileSync(SEARCHES, JSON.stringify(r) + '\n'); have.set(key(r), r); done++;
      if (done % 20 === 0 || done === todo.length) console.log('  ' + done + '/' + todo.length + ' · ' + Math.round((Date.now() - t0) / 1000) + 's');
      feed();
    });
    w.on('error', reject);
    feed();
  })));
  return have;
}

async function searches() {
  mkdirSync(at('drop/'), { recursive: true });
  const workers = Number(arg('--workers', Math.max(1, cpus().length - 2)));
  const all = await candidates();
  let have = await runAll(all.flatMap(({ set, domain }) => genesisSeeds(domain, ADMIT_SEEDS).map((seed) => ({ set, domain, seed }))), workers);
  const admission = all.map(({ set, domain }) => {
    const first = genesisSeeds(domain, ADMIT_SEEDS).map((s) => have.get(domain + ' ' + s));
    return { set, domain, searched: ADMIT_SEEDS, live: first.filter((r) => r.state === 'live').length, gates: first.map((r) => r.gate ?? null), admitted: first.filter((r) => r.state === 'live').length >= ADMIT_LIVE };
  });
  const admitted = admission.filter((a) => a.admitted).map((a) => a.domain);
  const want = Object.fromEntries(admitted.map((d) => [d, 0]));
  for (const p of planOf(admitted, TOTAL)) want[p.domain]++;
  for (const d of admitted) want[d] += 1;   // a spare each: decoder #0001 takes the best mind of the whole genesis
  for (let round = 1; ; round++) {
    const jobs = [];
    for (const { set, domain } of all.filter((c) => admitted.includes(c.domain))) {
      const cap = CAP_FACTOR * want[domain] + ADMIT_SEEDS, seeds = genesisSeeds(domain, cap);
      const live = seeds.filter((s) => have.has(domain + ' ' + s) && have.get(domain + ' ' + s).state === 'live').length;
      const searched = seeds.filter((s) => have.has(domain + ' ' + s)).length;
      if (live >= want[domain] || searched >= cap) continue;
      seeds.filter((s) => !have.has(domain + ' ' + s)).slice(0, Math.ceil((want[domain] - live) * 1.5) + 2).forEach((seed) => jobs.push({ set, domain, seed }));
    }
    if (!jobs.length) break;
    console.log('round ' + round + ': ' + jobs.length + ' more searches');
    have = await runAll([...have.values()].map((r) => ({ domain: r.domain, seed: r.seed })).concat(jobs), workers);
  }
  writeFileSync(at('drop/admission.json'), JSON.stringify({ kind: 'digi-card.genesis-admission', v: 1, rule: { seeds: ADMIT_SEEDS, live: ADMIT_LIVE, bar: BAR, grow: GROW }, departments: admission, admitted, want }, null, 1) + '\n');
  console.log('admitted ' + admitted.length + ' of ' + all.length + ': ' + admitted.join(', '));
  console.log('not admitted: ' + admission.filter((a) => !a.admitted).map((a) => a.domain + ' (' + a.live + '/' + ADMIT_SEEDS + ' live)').join(', '));
}

/** the files that read, check and draw a card: every module reachable by import from the reader's entry points */
export function decoderFiles(entries = ['src/card.mjs', 'src/registry.mjs', 'src/mind.mjs', 'src/drop.mjs', 'vendor/pixelwhisperer/kards/kardart.mjs']) {
  const seen = new Set(), queue = entries.filter((e) => existsSync(at(e)));
  while (queue.length) {
    const p = queue.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    for (const [, rel] of readFileSync(at(p), 'utf8').matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s+'(\.{1,2}\/[^']+)'/g)) queue.push(new URL(rel, at(p)).pathname.slice(ROOT.pathname.length));
  }
  return [...seen].sort();
}

async function mint() {
  const keys = arg('--key') ? await importPriv(readFileSync(arg('--key'), 'utf8').trim()) : await demoMaker();
  const adm = JSON.parse(readFileSync(at('drop/admission.json'), 'utf8')), have = new Map(cached().map((r) => [key(r), r]));
  const all = await candidates(), groundOf = Object.fromEntries(all.map((c) => [c.domain, c.ground]));
  const lists = Object.fromEntries(adm.admitted.map((d) => [d, genesisSeeds(d, CAP_FACTOR * adm.want[d] + ADMIT_SEEDS).map((s) => have.get(d + ' ' + s)).filter((r) => r && r.state === 'live')]));
  const pool = adm.admitted.flatMap((d) => lists[d]);
  const best = pool.reduce((b, r) => (r.gate > b.gate ? r : b));
  lists[best.domain] = lists[best.domain].filter((r) => r !== best);
  const order = [...adm.admitted], plan = [];
  for (let serial = 2, k = 0; serial <= TOTAL; serial++) {
    let tries = 0;
    while (!lists[order[k % order.length]].length && tries++ < order.length) k++;
    if (tries > order.length) break;
    plan.push({ serial, r: lists[order[k % order.length]].shift() });
    k++;
  }
  console.log('minting ' + plan.length + ' cards and decoder #0001 with maker ' + keys.pub.slice(0, 16) + '…');
  let reg = empty();
  const cards = [];
  for (const { serial, r } of plan) {
    const organ = organOf(r.fixed, viewOf(groundOf[r.domain], r.domain), BAR);
    if (organ.gate !== r.gate) throw new Error('serial ' + serial + ': the fixed mind re-expresses to ' + organ.gate + ', not the searched ' + r.gate);
    const m = await mintGenesis(organ, { found: r.found, serial, keys });
    if (!m.ok) throw new Error('serial ' + serial + ': ' + m.why);
    const rec = await record(reg, m.dossier);
    if (!rec.ok) throw new Error('serial ' + serial + ': ' + rec.why);
    reg = rec.reg; cards.push(m.entry);
  }
  // decoder v1: the exact files that read, check and draw a card, frozen at the drop, and the hash #0001 carries
  const files = {};
  for (const p of decoderFiles()) { mkdirSync(dirname(fileURLToPath(at('decoder/v1/' + p))), { recursive: true }); copyFileSync(at(p), at('decoder/v1/' + p)); files[p] = toHexStr(sha256Bytes(readFileSync(at(p)))); }
  const decoder = decoderHash(files), receipt = dropReceipt({ decoder, log: reg.head, cards: reg.log.length });
  const organ = organOf(best.fixed, viewOf(groundOf[best.domain], best.domain), BAR);
  const g = await seal({ name: 'decoder', parents: [], gate: { auc: BAR }, organs: [organ.fixed] }, keys);
  let d = (await issue(g.text, keys, { serial: 1, to: keys.pub, theme: themeOf(1), generation: 0 })).dossier;
  d = (await addReceipt(d, keys, receipt)).dossier;
  const genesisLog = reg.log;
  const rec = await record(reg, d, { rerun: (r) => checkDrop(r, { decoder, log: genesisLog, maker: keys.pub }) });
  if (!rec.ok) throw new Error('#0001: ' + rec.why);
  reg = rec.reg;
  const v = await verify(d);
  const manifest = { kind: 'digi-card.genesis-manifest', v: 1, maker: keys.pub, demo: !arg('--key'), total: reg.log.length, bar: BAR, grow: GROW,
    decoder: { hash: decoder, files }, log: { head: reg.head, cards: reg.log.length, file: 'drop/log.json' },
    first: { serial: 1, card: v.id, name: 'decoder', domain: best.domain, found: best.found, recipe: organ.fixed, gate: organ.gate, receipt }, cards };
  writeFileSync(at('drop/log.json'), JSON.stringify(reg.log) + '\n');
  writeFileSync(at('drop/manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log('DROP · ' + reg.log.length + ' cards · log head ' + reg.head.slice(0, 16) + ' · decoder ' + decoder.slice(0, 16) + ' over ' + Object.keys(files).length + ' files · #0001 = ' + v.id + ' (' + best.domain + ', GATE ' + organ.gate + ')');
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/genesis.mjs');
if (isMain) {
  if (process.argv.includes('--searches')) await searches();
  else if (process.argv.includes('--mint')) await mint();
  else console.log('node tools/genesis.mjs --searches | --mint [--key <file>]');
}
