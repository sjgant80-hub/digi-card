// tools/checkers.mjs — the claim gate's checkers for the drop's public posts: each re-runs its claim now, from the drop
// as committed, and vouches only for the numbers it just re-ran.
import { cardOf, readCard } from '../src/card.mjs';
import { give, verify } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { organOf } from '../src/mind.mjs';
import { consent, assemble } from '../src/mesh.mjs';
import { checkDrop, demoMaker } from '../src/drop.mjs';
import { paintArt } from '../vendor/pixelwhisperer/kards/kardart.mjs';
import { probeOffline } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { drop, ground, setOfDomain, viewOf, owner } from './lib.mjs';

const paint = (f, t, w, h) => paintArt(f, t, w, h), pad = (s) => String(s).padStart(4, '0'), three = (g) => (g / 1e6).toFixed(3);
const D = drop();
const cardBy = async (serial) => { const { m } = await D; return serial === 1 ? { ...m.first, serial: 1 } : m.cards.find((c) => c.serial === serial); };

export function checkers() {
  return {
    async drop() {
      const { m, reg, decoder, glog } = await D, r = await checkDrop(dossierOf(reg, m.first.card).events[1].receipt, { decoder, log: glog, maker: m.maker });
      return r.ok ? { ok: true, says: [String(m.total), '0001'] } : r;
    },
    async grown({ serial }) {
      const { m } = await D, c = await cardBy(serial);
      if (!c) return { ok: false, why: 'no genesis card #' + serial };
      const o = organOf(c.recipe, viewOf(await ground(setOfDomain(c.domain)), c.domain), m.bar);
      return o.ok && o.gate === c.gate ? { ok: true, says: [pad(serial), three(o.gate), String(o.gate / 1e6)] } : { ok: false, why: 'its mind scores ' + o.gate + ' here, not the declared ' + c.gate };
    },
    async offline({ serial }) {
      const { m } = await D, c = await cardBy(serial), view = viewOf(await ground(setOfDomain(c.domain)), c.domain);
      const p = probeOffline(() => organOf(c.recipe, view, m.bar));
      return p.ok && !p.networkTouched && p.result.ok ? { ok: true, says: [pad(serial)] } : { ok: false, why: 'it reached for the network' };
    },
    async verified({ serial }) {
      const { reg } = await D, c = await cardBy(serial), r = await readCard((await cardOf(dossierOf(reg, c.card), paint)).png, paint);
      return r.ok ? { ok: true, says: [pad(serial)] } : r;
    },
    async mesh({ set }) {
      const { m, reg } = await D, maker = await demoMaker(), g = await ground(set), name = 'post-' + set, cands = [];
      const depts = [...new Set(m.cards.filter((c) => setOfDomain(c.domain) === set).map((c) => c.domain))];
      let k = 0;
      for (const d of depts) for (const c of m.cards.filter((x) => x.domain === d).sort((a, b) => b.gate - a.gate || a.serial - b.serial).slice(0, 3)) {
        const o = await owner('mesh-' + set + '-' + k++), v = await verify((await give(dossierOf(reg, c.card), maker, o.pub)).dossier);
        cands.push({ v, consent: (await consent(o, v, name)).consent });
      }
      const r = await assemble(name, cands, g);
      return r.ok ? { ok: true, says: [String(r.fielded.length), three(r.gate), three(r.best)] } : r;
    },
  };
}
