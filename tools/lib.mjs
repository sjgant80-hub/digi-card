// tools/lib.mjs — what the organ measurements share: the grounds from disk (checked to the byte), the drop replayed from
// nothing, demo owners from public phrases, TEST scoring (only the sealed measurements read TEST), the network trap, and
// a pool of search workers.
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { SETS, openSet, viewOf } from '../src/data.mjs';
import { mindOf, scoreRow } from '../src/mind.mjs';
import { replay } from '../src/registry.mjs';
import { checkDrop, decoderHash } from '../src/drop.mjs';
import { auc, rng } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { fromSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url), at = (p) => new URL(p, ROOT);
export const json = (p) => JSON.parse(readFileSync(at(p), 'utf8'));
export const milli = (x) => Math.round(x * 1e6);

const grounds = new Map();
/** a bundled set opened from data/, its files checked to the byte */
export async function ground(set) {
  if (!grounds.has(set)) {
    const bytes = Object.fromEntries(Object.keys(SETS[set].files).map((f) => [f, new Uint8Array(readFileSync(at('data/' + f)))]));
    const g = await openSet(set, bytes);
    if (!g.ok) throw new Error(g.why);
    grounds.set(set, g);
  }
  return grounds.get(set);
}
export const setOfDomain = (d) => d.split('-')[0];

/** the drop: manifest, log, and the registry it replays to, with #0001's receipt re-run against decoder v1 */
export async function drop() {
  const m = json('drop/manifest.json'), log = json('drop/log.json');
  const files = Object.fromEntries(Object.keys(m.decoder.files).map((p) => [p, createHash('sha256').update(readFileSync(at('decoder/v1/' + p))).digest('hex')]));
  const decoder = decoderHash(files), glog = log.slice(0, m.first.receipt.cards);
  const r = await replay(log, { rerun: (rc) => checkDrop(rc, { decoder, log: glog, maker: m.maker }) });
  if (!r.ok) throw new Error('the drop does not replay: ' + r.why);
  return { m, log, glog, reg: r.reg, decoder, files };
}

/** demo owners: keys from public phrases, so every signature in a measurement can be reproduced */
export const owner = (k) => fromSeed(sha256Bytes(utf8('digi-card/organs/owner/' + k)));

/** a mind's AUC on the ground's TEST rows (the sealed measurement is the only reader of TEST) */
export function testAuc(mind, g) {
  if (mind.gate === null) return null;
  const rows = g.ds.testRows;
  return milli(auc(rows.map((i) => scoreRow(mind, g, i)), rows.map((i) => g.ds.y[i])));
}
export const testOf = (v, g) => testAuc(mindOf(v, g), g);

/** run fn (async) with every network door of this process trapped; → { ok, touched, result, error } */
export async function offline(fn) {
  const g = globalThis, saved = { fetch: g.fetch, XMLHttpRequest: g.XMLHttpRequest, WebSocket: g.WebSocket };
  let touched = false;
  const mark = () => { touched = true; throw new Error('network blocked'); };
  g.fetch = mark; g.XMLHttpRequest = function () { mark(); }; g.WebSocket = function () { mark(); };
  try { const result = await fn(); return { ok: true, touched, result, error: null }; }
  catch (e) { return { ok: false, touched, result: null, error: String(e && e.message) }; }
  finally { g.fetch = saved.fetch; g.XMLHttpRequest = saved.XMLHttpRequest; g.WebSocket = saved.WebSocket; }
}

/** a seeded sampler */
export const sampler = (seed) => { const r = rng(seed); return { int: (n) => Math.floor(r() * n), pick: (xs) => xs[Math.floor(r() * xs.length)] }; };

/** 95% lower bound of a mean, by bootstrap over the items (seeded) */
export function meanLow(xs, n = 2000, seed = 7) {
  const r = rng(seed), means = [];
  for (let k = 0; k < n; k++) { let s = 0; for (let j = 0; j < xs.length; j++) s += xs[Math.floor(r() * xs.length)]; means.push(s / xs.length); }
  means.sort((a, b) => a - b);
  return means[Math.floor(0.025 * n)];
}

/** searches on a pool of workers (tools/search-worker.mjs): jobs [{ set, domain, seed, grow }] → results in order */
export async function searchAll(jobs, workers = Math.max(1, cpus().length - 2)) {
  const out = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(workers, jobs.length) }, () => new Promise((resolve, reject) => {
    const w = new Worker(new URL('./search-worker.mjs', import.meta.url));
    let mine = -1;
    const feed = () => { if (next >= jobs.length) { w.terminate(); resolve(); return; } mine = next++; w.postMessage(jobs[mine]); };
    w.on('message', (r) => { out[mine] = r; feed(); });
    w.on('error', reject);
    feed();
  })));
  return out;
}
export { viewOf, mindOf };

// ── raw PNG pixels, for forging cards in the measurements (the same primitives the codec writes with) ───────────────
import { inflateSync } from 'node:zlib';
import { crc32, cat, zlibStored } from '../vendor/dex-frontier/vendor/living-seed/src/card.mjs';
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const chunk = (type, data) => { const body = cat([utf8(type), data]); return cat([new Uint8Array(u32(data.length)), body, new Uint8Array(u32(crc32(body)))]); };
/** a stored-deflate RGB PNG of these pixels (filter 0 on every row) */
export function pngOf(px, w, h) {
  const raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) raw.set(px.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  return cat([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', new Uint8Array([...u32(w), ...u32(h), 8, 2, 0, 0, 0])), chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0))]);
}
/** a card's pixels, read back the plain way (cards are written with filter 0) */
export function pixelsOf(png, w, h) {
  const z = [];
  for (let at = 8; at < png.length;) { const len = ((png[at] << 24) | (png[at + 1] << 16) | (png[at + 2] << 8) | png[at + 3]) >>> 0, type = String.fromCharCode(...png.subarray(at + 4, at + 8)); if (type === 'IDAT') z.push(png.subarray(at + 8, at + 8 + len)); at += 12 + len; }
  const raw = inflateSync(Buffer.concat(z)), px = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) px.set(raw.subarray(y * (1 + w * 3) + 1, (y + 1) * (1 + w * 3)), y * w * 3);
  return px;
}
