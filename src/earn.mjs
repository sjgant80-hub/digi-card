// src/earn.mjs — THE RECORD: what a player makes, and what their party strikes measure, written into the estate's
// contribution ledger (kcc-mesh's contrib.mjs, vendored byte for byte) — each entry with the proof that re-runs it.
//
// A ledger is one economy: reconcile() merges two ledgers only if they began from the same genesis. So a player's record
// begins from the estate's own genesis — the very entry kcc-mesh's ledger/digi.json holds, re-signed here by the demo
// economy's public keeper phrase (Ed25519 is deterministic, so it is the same entry, byte for byte) — and grows with:
//   · the drop's release of each genesis card the player fields: the entry the estate's ledger holds, signed by the
//     drop's public demo maker key at the moment that ledger gives it, gated by its line in drop/manifest.json;
//   · a release for every card the player made (a node minted by a search, a raid's loot, a card grown from their own
//     table, a child they bred), signed by them, its proof the hash of its sealed genome, its lineage its parents;
//   · a release for every app item they minted, signed by them, its proof the item's id (the hash of its mint);
//   · a value for each fielded card of each party strike the player ran, its units the card's measured share in
//     millionths, its proof the hash of the strike's receipt — signed by the demo economy's measurer, which this page
//     plays after it has struck the party again to the very same receipt, as it plays the drop's maker to hand cards out.
// Every entry is recorded only once its gate re-runs here. In the real economy the keeper and the measurer are their
// owners' keys, not public phrases, and a value counts there only once their measurer has re-measured it.
//
// The switch is off by construction: the vendored kernel has no verb that writes it, and this file signs none. The units
// are internal contribution units, not money. Total: junk is refused in plain words, never thrown.
import { canonical, sha256, keysFromPhrase, sign, empty, record } from '../vendor/kcc-mesh/contrib.mjs';
import { gateOf } from '../vendor/kcc-mesh/digi-gate.mjs';
import { open } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { verifyItem } from './item.mjs';

export const PHRASES = Object.freeze({ keeper: 'kcc-mesh/demo/keeper', measurer: 'kcc-mesh/demo/measurer', maker: 'digi-card/genesis/demo-maker' });
export const POLICY = Object.freeze({ makerPpm: 100000, lineagePpm: 50000, earlyUntil: 5000, earlyNum: 3, earlyDen: 2 });
export const DROP_AT = '2026-10-21T12:28:08Z';   // the moment the estate's ledger gives the drop's releases
const no = (why) => ({ ok: false, why });
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const signed = async (keys, fields) => { const s = await sign(keys, fields); return s.ok ? s.entry : null; };

/** the demo economy's keys, from their public phrases: anyone can reproduce every signature this page makes with them */
export async function demoKeys() {
  const [keeper, measurer, maker] = await Promise.all([PHRASES.keeper, PHRASES.measurer, PHRASES.maker].map(keysFromPhrase));
  return { keeper, measurer, maker };
}

/** a record, begun from the estate's genesis. → { ok, ledger, genesis } */
export async function begin() {
  const { keeper, measurer } = await demoKeys();
  const genesis = await signed(keeper, { type: 'genesis', activators: [keeper.pub], measurers: [measurer.pub], policy: { ...POLICY } });
  const r = await record(empty(), genesis);
  return r.ok ? { ok: true, ledger: r.ledger, genesis } : r;
}

/** the drop's release of one genesis card, as the estate's ledger holds it (line: its manifest line; #1's is the first) */
export async function releaseOfDrop(line) {
  if (!isObj(line) || typeof line.card !== 'string' || !Number.isSafeInteger(line.serial)) return no('a drop release names a card’s line in the manifest');
  const { maker } = await demoKeys(), digest = await sha256(canonical(line));
  const entry = await signed(maker, { type: 'release', asset: 'digi:' + line.card, form: 'card', lineage: [], proofs: [{ kind: 'digi-drop', ref: 'digi-card/drop/manifest.json#' + line.serial, digest }], at: DROP_AT });
  return entry ? { ok: true, entry } : no('the drop release could not be signed');
}

/** the release of a card its maker made, signed by that maker: its proof is the hash of its sealed genome */
export async function releaseOfCard(keys, genomeText, at) {
  if (typeof at !== 'string' || !ISO.test(at)) return no('a release is dated: an ISO moment in whole seconds, UTC');
  const g = typeof genomeText === 'string' ? await open(genomeText) : { ok: false };
  if (!g.ok) return no('only a genome that opens under its seal is released');
  if (!keys || g.fields.by !== keys.pub) return no('only a card’s maker releases it');
  const entry = await signed(keys, { type: 'release', asset: 'digi:' + g.id, form: 'card', lineage: g.fields.parents.map((p) => 'digi:' + p), proofs: [{ kind: 'digi-card', ref: 'digi-card/genome/' + g.id, digest: await sha256(genomeText) }], at });
  return entry ? { ok: true, entry } : no('the release could not be signed');
}

/** the release of an app item its maker minted, signed by that maker: its proof is the item's id */
export async function releaseOfItem(keys, item, apps, at) {
  if (typeof at !== 'string' || !ISO.test(at)) return no('a release is dated: an ISO moment in whole seconds, UTC');
  const v = await verifyItem(item, apps);
  if (!v.ok) return no('only an item that checks is released: ' + v.why);
  if (!keys || v.maker !== keys.pub) return no('only an item’s maker releases it');
  const entry = await signed(keys, { type: 'release', asset: 'item:' + v.id, form: 'app', lineage: [], proofs: [{ kind: 'mint-an-app', ref: v.body.run, digest: v.id }], at });
  return entry ? { ok: true, entry } : no('the release could not be signed');
}

/** the job a party strike's values are recorded on: its business and the start of its receipt's hash */
export const jobOf = (set, digest) => 'party-' + set + '-' + digest.slice(0, 16);

/** a value for every fielded card of a party strike with a share above nothing, signed by the demo measurer */
export async function valuesOfClear(clear, at) {
  if (typeof at !== 'string' || !ISO.test(at)) return no('a value is dated: an ISO moment in whole seconds, UTC');
  if (!isObj(clear) || clear.kind !== 'clear' || typeof clear.set !== 'string' || !Array.isArray(clear.members)) return no('values are read off a party’s strike');
  const text = canonical(clear);
  if (text === null) return no('values are read off a party’s strike');
  const { measurer } = await demoKeys(), digest = await sha256(text), entries = [];
  for (const m of clear.members) {
    if (!isObj(m) || !Number.isSafeInteger(m.share) || m.share < 1) continue;
    entries.push(await signed(measurer, { type: 'value', asset: 'digi:' + m.card, basis: 'mesh-share', job: jobOf(clear.set, digest), units: m.share, proofs: [{ kind: 'digi-party', ref: 'digi-card/party/' + clear.set, digest }], at }));
  }
  return { ok: true, entries, digest };
}

/**
 * The gate a record's entries pass, from what this device holds: the drop's manifest (and organ 6's record, for the
 * estate's own mesh values), the genomes of the cards it releases (asset → sealed text), the app items (asset → item)
 * with mint-an-app's records, and the party strikes this device struck again (receipt hash → receipt).
 * → gate(entry) → { ok } | a refusal
 */
export async function gateFor({ manifest, organ6 = { meshes: [] }, genomes = new Map(), items = new Map(), apps = null, clears = new Map() } = {}) {
  const drop = manifest ? await gateOf(manifest, organ6) : null;
  return async (e) => {
    const p = e && Array.isArray(e.proofs) ? e.proofs[0] : null;
    if (!p) return no('it carries no proof');
    if (e.type === 'release' && p.kind === 'digi-drop') return drop ? drop(e) : no('this device holds no drop manifest');
    if (e.type === 'release' && p.kind === 'digi-card') {
      const text = genomes.get(e.asset);
      if (!text) return no('this device holds no genome for ' + e.asset);
      if ((await sha256(text)) !== p.digest) return no('the genome here is not the one its proof hashed');
      const g = await open(text);
      return g.ok && 'digi:' + g.id === e.asset && g.fields.by === e.by ? { ok: true } : no('its genome is not sealed by the one who released it');
    }
    if (e.type === 'release' && p.kind === 'mint-an-app') {
      const v = items.has(e.asset) ? await verifyItem(items.get(e.asset), apps) : { ok: false, why: 'this device holds no such item' };
      if (!v.ok) return no('its item does not check: ' + v.why);
      return 'item:' + v.id === e.asset && v.id === p.digest && v.maker === e.by ? { ok: true } : no('its item is not the one its proof names, minted by the one who released it');
    }
    if (e.type === 'value' && p.kind === 'digi-party') {
      const c = clears.get(p.digest);
      if (!c) return no('this device has not struck that party again');
      const m = c.members.find((x) => 'digi:' + x.card === e.asset);
      if (e.job !== jobOf(c.set, p.digest)) return no('its job is not that strike’s');
      return m && m.share === e.units ? { ok: true } : no('that strike did not measure this share for this card');
    }
    if (e.type === 'value' && p.kind === 'digi-organ') return drop ? drop(e) : no('this device holds no drop manifest');
    return no('there is no gate here for a ' + e.type + ' proved by ' + p.kind);
  };
}

/** record entries in order through the gate; an entry the record holds already is skipped. → { ok, ledger, added, skipped, refused } */
export async function add(ledger, entries, gate) {
  if (!ledger || !Array.isArray(entries)) return no('add records a list of entries into a ledger');
  let l = ledger, added = 0, skipped = 0;
  const refused = [];
  for (const e of entries) {
    const r = await record(l, e, { gate });
    if (r.ok) { l = r.ledger; added++; } else if (/already recorded/.test(r.why)) skipped++; else refused.push(r.why);
  }
  return { ok: true, ledger: l, added, skipped, refused };
}
