// helpers.mjs — what the organ tests share: demo keys from public phrases, a small real-shaped ground (fast enough for
// the witness to re-run every test once per mutant), and a card issued on it.
import { rng } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { seal } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { fromSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { issue, verify } from '../src/dossier.mjs';

export const key = (s) => fromSeed(sha256Bytes(utf8('digi-card/test/' + s)));
export const SMALL = { population: 8, elites: 2, generations: 4 };

/**
 * A ground of n rows whose outcome rises with the first column of each department (and noise): departments a, b, …
 * each of two columns. → an opened ground, as src/data.mjs makes them
 */
export function toy({ n = 600, departments = ['a', 'b'], seed = 11 } = {}) {
  const r = rng(seed), cols = {}, y = [];
  for (const d of departments) { cols[d + '1'] = []; cols[d + '2'] = []; }
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const d of departments) { const v1 = Math.round(r() * 100), v2 = Math.round(r() * 100); cols[d + '1'].push(v1); cols[d + '2'].push(v2); s += v1; }
    y.push(s + r() * 60 * departments.length > 60 * departments.length + 30 * (departments.length - 1) ? 1 : 0);
  }
  const all = Array.from({ length: n }, (_, i) => i);
  const ds = { ok: true, name: 'toy', features: Object.keys(cols), cols, y, n, fitRows: all.filter((i) => i % 4 < 2), gateRows: all.filter((i) => i % 4 === 2), testRows: all.filter((i) => i % 4 === 3), silos: Object.fromEntries(departments.map((d) => [d, [d + '1', d + '2']])) };
  return { ok: true, id: 'toy:' + String(seed).padStart(16, '0'), set: 'toy', ds };
}

/** a card whose genome carries these organs, sealed by maker and issued to owner. → { d, v, genome } */
export async function cardOn(organs, { maker, owner, bar = 0.6, name = 'toy-a', parents = [], serial = 1, generation = 0 } = {}) {
  const g = await seal({ name, parents, gate: { auc: bar }, organs }, maker);
  if (!g.ok) throw new Error(g.why);
  const d = (await issue(g.text, maker, { serial, to: owner.pub, theme: 'synthwave-v1', generation })).dossier;
  return { d, v: await verify(d), genome: g.text };
}
