// worker.js — the slow work, off the page: a search for a level, or a search on an owner's own table. Everything here is
// the same mutation-gated kernel the page uses; the worker only keeps the page responsive while a search runs.
import { SETS, openSet, ownGround, viewOf } from './src/data.mjs';
import { level, organOf, searchOf } from './src/mind.mjs';
import { verify } from './src/dossier.mjs';
import { measure, signRerun, proofOf } from './src/build.mjs';
import { shrink, checkShrink } from './src/shrink.mjs';

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
    } else if (m.op === 'build') {
      // a build's work, by the kernels' own functions (src/build.mjs, src/shrink.mjs) on the cards as sent, each checked
      // here first: measure it, sign a re-run of it (measured again before the signature) and prove it, prove it, shrink
      // it, or check a shrink deeply. The key that signs arrives as the page holds it, for this job only, and is not kept.
      const vs = [];
      for (const d of Array.isArray(m.dossiers) ? m.dossiers : []) {
        const v = await verify(d);
        if (!v.ok) { self.postMessage({ id: m.id, r: { ok: false, why: 'a card does not check: ' + v.why } }); return; }
        vs.push(v);
      }
      let r;
      if (m.do === 'measure') { const x = measure(m.build, vs, g); r = x.ok ? { ok: true, receipt: x.receipt } : x; }
      else if (m.do === 'sign') {
        const s = await signRerun(m.keys, m.receipt, m.build, vs, g);
        r = s.ok ? { ok: true, rerun: s.rerun, proof: await proofOf(m.receipt, m.build, vs, g, [...(m.reruns || []), s.rerun]) } : s;
      } else if (m.do === 'proof') r = await proofOf(m.receipt, m.build, vs, g, m.reruns);
      else if (m.do === 'shrink') r = await shrink(m.keys, m.build, vs, g, { domain: m.domain, k: m.k });
      else if (m.do === 'check-shrink') r = await checkShrink(m.shrink, m.build, vs, g, { deep: true });
      else r = { ok: false, why: 'unknown work' };
      self.postMessage({ id: m.id, r });
    } else self.postMessage({ id: m.id, r: { ok: false, why: 'unknown work' } });
  } catch (e) { self.postMessage({ id: m.id, r: { ok: false, why: String((e && e.message) || e) } }); }
};
