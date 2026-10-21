// tools/search-worker.mjs — one worker for tools/genesis.mjs and the organ measurements: opens each ground once (its
// files checked to the byte), then runs what it is handed — a search (live or cut, it says which), or a level's re-run
// (deep re-runs repeat the search, so they come here too). The kernels are the same; the worker only adds a core.
import { parentPort } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { SETS, openSet, viewOf } from '../src/data.mjs';
import { organOf, searchOf, rerun } from '../src/mind.mjs';
import { verify } from '../src/dossier.mjs';
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

parentPort.on('message', async (job) => {
  try {
    if (job.op === 'rerun') {
      const v = await verify(job.dossier);
      parentPort.postMessage(v.ok ? rerun(job.receipt, v, job.k, job.dossier, { ground: await ground(job.set), deep: job.deep }) : { ok: false, why: v.why });
      return;
    }
    const { set, domain, seed, grow } = job, found = searchOf(domain, seed, grow), o = organOf(found, viewOf(await ground(set), domain), BAR);
    parentPort.postMessage(o.ok ? { domain, seed, found, fixed: o.fixed, gate: o.gate, state: o.state } : { domain, seed, found, state: 'failed', why: o.why });
  } catch (e) { parentPort.postMessage({ domain: job.domain, seed: job.seed, ok: false, state: 'failed', why: String(e && e.message) }); }
});
