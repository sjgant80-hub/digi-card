// tools/search-worker.mjs — one search worker for tools/genesis.mjs: opens each ground once (its files checked to the
// byte), then runs every search it is handed and returns what the search found, live or cut.
import { parentPort } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { SETS, openSet, viewOf } from '../src/data.mjs';
import { organOf, searchOf } from '../src/mind.mjs';
import { BAR } from '../src/drop.mjs';

const grounds = new Map();
async function ground(set) {
  if (!grounds.has(set)) {
    const bytes = Object.fromEntries(Object.keys(SETS[set].files).map((f) => [f, new Uint8Array(readFileSync(new URL('../data/' + f, import.meta.url)))]));
    const g = await openSet(set, bytes);
    if (!g.ok) throw new Error(g.why);
    grounds.set(set, g);
  }
  return grounds.get(set);
}

parentPort.on('message', async ({ set, domain, seed, grow }) => {
  try {
    const found = searchOf(domain, seed, grow), o = organOf(found, viewOf(await ground(set), domain), BAR);
    parentPort.postMessage(o.ok ? { domain, seed, found, fixed: o.fixed, gate: o.gate, state: o.state } : { domain, seed, found, state: 'failed', why: o.why });
  } catch (e) { parentPort.postMessage({ domain, seed, state: 'failed', why: String(e && e.message) }); }
});
