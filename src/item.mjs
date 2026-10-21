// src/item.mjs — ITEMS: the things a DIGI carries that are not minds, each held, handed on and checked like a card.
//
// An APP item is one of the estate's apps that mint-an-app lists as mintable: a Proven or Works app whose own CI ran on
// GitHub's machines and passed at a pinned commit (mint-an-app's records, vendored byte for byte under vendor/). The item
// carries the app's name, its live page (null where it has none: then its repository is the way in), the commit, the run
// that proved it there, its tier and its licence as recorded (null where none is). It checks against those records: an
// item naming an app the records do not list as mintable, or any other commit, run, tier or licence, does not check. An
// item proves what its app's run proved, and nothing more — carried by a DIGI, it is a tool for its holder; it moves no
// score in a duel or a raid.
//
// An item's life is a chain, as a card's is: its mint (signed by whoever mints it, naming its first holder), then gives,
// each signed by the holder of that moment and naming the hash of the event before. Its id is the hash of its mint. An
// item alone cannot stop its holder signing it away twice — whoever keeps a record of gives settles that, as the card
// registry (src/registry.mjs) does for cards. Minting is free and open: what an item is worth is that it checks.
//
// Pure apart from the signatures (WebCrypto Ed25519); total: junk is refused in plain words, never thrown.
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

export const ITEM = 'digi.item.v1';
export const FORMS = ['app'];
export const TIERS = ['proven', 'works'];
export const MAX_EVENTS = 40;
export const ZERO = '0'.repeat(64);
export const BODY = ['app', 'page', 'run', 'sha', 'spdx', 'tier'];
const MINT = ['body', 'by', 'form', 'prev', 'sig', 'to', 'type'], GIVE = ['by', 'item', 'k', 'prev', 'sig', 'to', 'type'];
const PUB = /^[0-9a-f]{64}$/, SIG = /^[0-9a-f]{128}$/, NAME = /^[A-Za-z0-9._-]{1,100}$/, SHA = /^[0-9a-f]{40}$/;
const no = (why) => ({ ok: false, why });
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
const exactly = (x, keys) => isObj(x) && Object.keys(x).sort().join() === keys.join();
const unsigned = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig'));
const hashOf = (e) => sha256Hex(canonical(e));

/** the repository of an estate app, its way in when it has no live page */
export const repoOf = (app) => 'https://github.com/sjgant80-hub/' + app;

/**
 * The apps an item may be minted for, from mint-an-app's two records (catalogue-data.json and mint-data.json, as
 * parsed): each catalogue row marked mintable, of a tier that ran, with a mint record whose commit and run are its own.
 * → Map(name → body)
 */
export function appsOf(catalogue, mint) {
  const out = new Map(), rows = isObj(catalogue) && Array.isArray(catalogue.rows) ? catalogue.rows : [], recs = isObj(mint) && isObj(mint.apps) ? mint.apps : {};
  for (const r of rows) {
    if (!isObj(r) || r.mintEligible !== true || !TIERS.includes(r.tier) || typeof r.name !== 'string' || !NAME.test(r.name)) continue;
    const m = Object.prototype.hasOwnProperty.call(recs, r.name) ? recs[r.name] : null;
    if (!isObj(m) || !SHA.test(m.sha) || typeof m.runUrl !== 'string') continue;
    if (!new RegExp('^' + repoOf(r.name).replace(/[.]/g, '\\.') + '/actions/runs/[0-9]+$').test(m.runUrl)) continue;
    const page = typeof r.url === 'string' && r.url.startsWith('https://sjgant80-hub.github.io/') ? r.url : null;
    out.set(r.name, { app: r.name, page, run: m.runUrl, sha: m.sha, spdx: typeof m.spdx === 'string' ? m.spdx : null, tier: r.tier });
  }
  return out;
}

/** mint an app item for an app the records list, held first by `to` (the minter, if unset). → { ok, item } | a refusal */
export async function mintApp(keys, apps, name, { to } = {}) {
  if (!keys || !PUB.test(keys.pub || '')) return no('an item is minted with an Ed25519 key');
  if (!(apps instanceof Map) || !apps.has(name)) return no('the estate’s records list no mintable app called ' + String(name).slice(0, 100));
  const holder = to === undefined ? keys.pub : to;
  if (typeof holder !== 'string' || !PUB.test(holder)) return no('an item’s holder is an Ed25519 public key');
  const fields = { type: 'mint', form: 'app', body: apps.get(name), to: holder, prev: ZERO, by: keys.pub };
  return { ok: true, item: { v: 1, kind: ITEM, events: [{ ...fields, sig: await sign(keys, utf8(canonical(fields))) }] } };
}

/** the holder hands the item on to another key. → { ok, item } | a refusal */
export async function giveItem(item, holderKeys, to, apps) {
  const v = await verifyItem(item, apps);
  if (!v.ok) return no('only an item that checks can be handed on: ' + v.why);
  if (!holderKeys || holderKeys.pub !== v.owner) return no('only the item’s holder can hand it on');
  if (typeof to !== 'string' || !PUB.test(to)) return no('an item’s holder is an Ed25519 public key');
  if (item.events.length >= MAX_EVENTS) return no('the item’s life is full');
  const fields = { type: 'give', item: v.id, k: item.events.length, prev: v.head, to, by: holderKeys.pub };
  return { ok: true, item: { ...item, events: [...item.events, { ...fields, sig: await sign(holderKeys, utf8(canonical(fields))) }] } };
}

/**
 * Check an item against the apps the records list (appsOf): its mint is signed and names an app exactly as the records
 * hold it, and every give is signed by the holder of its moment and linked to the event before.
 * → { ok, id, form, body, maker, owner, gives, head } | a refusal naming the first thing that fails
 */
export async function verifyItem(item, apps) {
  try {
    if (!exactly(item, ['events', 'kind', 'v']) || item.v !== 1 || item.kind !== ITEM) return no('not an item');
    if (!Array.isArray(item.events) || !item.events.length) return no('an item’s life begins with its mint');
    if (item.events.length > MAX_EVENTS) return no('an item’s life is at most ' + MAX_EVENTS + ' events');
    const m = item.events[0];
    if (!exactly(m, MINT) || m.type !== 'mint' || !FORMS.includes(m.form) || m.prev !== ZERO) return no('the first event is the item’s mint');
    if (!PUB.test(m.by) || !PUB.test(m.to) || !SIG.test(m.sig) || !exactly(m.body, BODY)) return no('the first event is the item’s mint');
    if (!(await verifySig(m.by, m.sig, utf8(canonical(unsigned(m)))))) return no('the mint’s signature does not check');
    const listed = apps instanceof Map ? apps.get(m.body.app) : undefined;
    if (!listed || canonical(listed) !== canonical(m.body)) return no('the estate’s records do not list this app at this commit, run, tier and licence');
    const id = hashOf(m);
    let owner = m.to, head = id;
    for (const [k, e] of item.events.slice(1).entries()) {
      const at = k + 1;
      if (!exactly(e, GIVE) || e.type !== 'give') return no('event ' + at + ' is not a give');
      if (e.item !== id) return no('event ' + at + ' is for another item');
      if (e.k !== at || e.prev !== head) return no('event ' + at + ' is not linked to the one before it');
      if (e.by !== owner) return no('event ' + at + ' was not signed by the item’s holder');
      if (!PUB.test(e.to) || !SIG.test(e.sig)) return no('event ' + at + ' is not a give');
      if (!(await verifySig(e.by, e.sig, utf8(canonical(unsigned(e)))))) return no('event ' + at + '’s signature does not check');
      owner = e.to; head = hashOf(e);
    }
    return { ok: true, id, form: m.form, body: m.body, maker: m.by, owner, gives: item.events.length - 1, head };
  } catch { return no('not an item'); }
}
