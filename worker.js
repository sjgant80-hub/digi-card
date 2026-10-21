// worker.js — the slow work, off the page: a search for a level, or a search on an owner's own table. Everything here is
// the same mutation-gated kernel the page uses; the worker only keeps the page responsive while a search runs.
import { SETS, openSet, ownGround, viewOf } from './src/data.mjs';
import { level, organOf, searchOf } from './src/mind.mjs';
import { verify } from './src/dossier.mjs';

const grounds = new Map();
async function groundOf(set) {
  if (!grounds.has(set)) {
    const bytes = {};
    for (const f of Object.keys(SETS[set].files)) bytes[f] = new Uint8Array(await (await fetch('data/' + f)).arrayBuffer());
    const g = await openSet(set, bytes);
    if (!g.ok) throw new Error(g.why);
    grounds.set(set, g);
  }
  return grounds.get(set);
}

self.onmessage = async ({ data: m }) => {
  try {
    const g = m.own ? ownGround(m.own.text, m.own.opts) : await groundOf(m.set);
    if (!g.ok) { self.postMessage({ id: m.id, r: { ok: false, why: g.why } }); return; }
    if (m.op === 'level') {
      const v = await verify(m.dossier);
      self.postMessage({ id: m.id, r: v.ok ? level(v, g, { domain: m.domain, seed: m.seed }) : { ok: false, why: v.why } });
    } else if (m.op === 'search') {
      const o = organOf(searchOf(m.domain, m.seed), viewOf(g, m.domain), m.bar);
      self.postMessage({ id: m.id, r: o.ok ? { ok: true, fixed: o.fixed, gate: o.gate, state: o.state, found: searchOf(m.domain, m.seed) } : o });
    } else self.postMessage({ id: m.id, r: { ok: false, why: 'unknown work' } });
  } catch (e) { self.postMessage({ id: m.id, r: { ok: false, why: String((e && e.message) || e) } }); }
};
