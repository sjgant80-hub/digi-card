// src/registry.mjs — THE REGISTRY: where a card's life is recorded, so a card cannot be sold twice.
//
// A card carries its whole life, every event signed by the owner of the moment, and that is enough to prove what the
// card IS. It cannot prove what the card is NOT: an owner holding the keys can sign the same card to two buyers, and both
// chains check. So ownership is settled the way every title is settled — by a record kept in order: the first give
// RECORDED wins. A later chain that forks from the recorded one at any event is refused for good, naming the event.
//
// The registry is an append-only log. Each entry names the card, where its new events begin, the events themselves (the
// genome too, at the card's first entry), and the hash of the entry before — so the log is a chain, and any copy of it
// can be re-run from nothing: replay() re-records every entry and demands the same entry back, re-checking every seal
// and every signature on the way. Nothing in the log is believed; all of it is re-run. What the log adds is only ORDER —
// which of two forks came first — and that is the one thing a registry is trusted for: whoever keeps the log (a device
// for its own wallet; a public repository, whose CI replays the log on every change, for the drop) decides arrivals, and
// cannot forge a single event into a card.
//
// A maker's serials are its editions: one card per serial per maker, or the second is refused. A receipt (a level
// earned) is recorded only once it has been re-run here: the re-runner is handed in (src/receipt.mjs), so the registry
// never takes a level on a card's word. Pure apart from the signatures; total: junk is refused in plain words.
import { verify } from './dossier.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

export const ZERO = '0'.repeat(64);
export const MAX_LOG = 100000;
const no = (why) => ({ ok: false, why });
const same = (a, b) => canonical(a) === canonical(b);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const exactly = (x, keys) => Object.prototype.toString.call(x) === '[object Object]' && Object.keys(x).sort().join() === keys.join();

/** an empty registry: no entries, no cards */
export const empty = () => ({ log: [], cards: {}, serials: {}, head: ZERO });

/** the hash an entry is known by: the next entry names it */
export const hashOf = (entry) => sha256Hex(canonical(entry));

/** the card's life as the registry holds it, or null if it has never been recorded */
export function dossierOf(reg, id) {
  const c = own(reg.cards, id) ? reg.cards[id] : null;
  return c && { v: 1, genome: c.genome, events: c.events.slice() };
}

/** who the registry says owns a card, or null if it has never been recorded */
export function ownerOf(reg, id) {
  return own(reg.cards, id) ? reg.cards[id].owner : null;
}

/** how many of the first events two lives share */
const shared = (a, b) => { let k = 0; while (k < a.length && k < b.length && same(a[k], b[k])) k++; return k; };

/**
 * Where a checked card in hand stands against the registry (read only; verify the card first):
 *   unrecorded — the registry has never seen this card     current — the card in hand is the life on record
 *   ahead      — the life on record, with events after it   behind  — the registry holds a later life of this card
 *   forked     — its life parts from the one on record at event k: the first recorded wins, so the card in hand is not
 *                the card's life
 * → { standing, at?, owner? }
 */
export function standing(reg, dossier, id) {
  const c = own(reg.cards, id) ? reg.cards[id] : null;
  if (!c) return { standing: 'unrecorded' };
  const k = shared(c.events, dossier.events);
  if (k < c.events.length && k < dossier.events.length) return { standing: 'forked', at: k, owner: c.owner };
  if (k < c.events.length) return { standing: 'behind', at: k, owner: c.owner };
  return { standing: k < dossier.events.length ? 'ahead' : 'current', at: k, owner: c.owner };
}

/**
 * Record a card's life: a new card's whole life, or the events it has grown since the last record. opts.trust: maker
 * keys accepted. opts.rerun(receipt, v, k, dossier) → { ok, why }: re-runs a receipt (src/mind.mjs rerun) (required when the life carries receipts
 * the registry has not yet recorded). → { ok, reg (a new registry; the old one is untouched), entry, outcome:
 * 'recorded' | 'grown' | 'already recorded' } | a refusal naming why.
 */
export async function record(reg, dossier, opts = {}) {
  const v = await verify(dossier, opts);
  if (!v.ok) return no('only a card whose life checks is recorded: ' + v.why);
  if (reg.log.length >= MAX_LOG) return no('the registry is full');
  const c = own(reg.cards, v.id) ? reg.cards[v.id] : null;
  const s = standing(reg, dossier, v.id);
  if (s.standing === 'forked') return no('this card’s life parts from the one on record at event ' + s.at + ': the first recorded wins, so this is not the card’s life');
  if (s.standing === 'behind') return no('the registry holds a later life of this card (' + c.events.length + ' events; this one has ' + dossier.events.length + ')');
  if (s.standing === 'current') return { ok: true, reg, entry: null, outcome: 'already recorded' };
  const serial = v.maker + ':' + v.serial;
  if (!c && own(reg.serials, serial)) return no('serial ' + v.serial + ' of this maker is already card ' + reg.serials[serial]);
  const at = c ? c.events.length : 0, fresh = dossier.events.slice(at);
  for (const [i, e] of fresh.entries()) {
    if (e.type !== 'receipt') continue;
    if (typeof opts.rerun !== 'function') return no('event ' + (at + i) + ' is a receipt, and the registry records a level only once it has re-run it');
    let r;
    try { r = await opts.rerun(e.receipt, v, at + i, dossier); } catch { r = null; }
    if (!r || r.ok !== true) return no('event ' + (at + i) + '’s receipt did not re-run: ' + ((r && r.why) || 'no reason given'));
  }
  const entry = { n: reg.log.length, prev: reg.head, card: v.id, at, events: fresh, ...(c ? {} : { genome: dossier.genome }) };
  const cards = { ...reg.cards, [v.id]: { genome: dossier.genome, events: dossier.events.slice(), owner: v.owner, maker: v.maker, serial: v.serial } };
  const serials = c ? reg.serials : { ...reg.serials, [serial]: v.id };
  return { ok: true, reg: { log: [...reg.log, entry], cards, serials, head: hashOf(entry) }, entry, outcome: c ? 'grown' : 'recorded' };
}

const ENTRY = ['at', 'card', 'events', 'n', 'prev'], FIRST = ['at', 'card', 'events', 'genome', 'n', 'prev'];

/**
 * Re-run a registry's whole log from nothing: every entry re-recorded, and each must come back exactly as written —
 * the same number, the same link to the entry before, the same events, every seal and signature checked again. opts as
 * record(). → { ok, reg } | a refusal naming the first entry that is not what the registry would have recorded.
 */
export async function replay(log, opts = {}) {
  if (!Array.isArray(log)) return no('not a registry log');
  if (log.length > MAX_LOG) return no('the registry is full');
  let reg = empty();
  for (const [n, entry] of log.entries()) {
    if ((!exactly(entry, ENTRY) && !exactly(entry, FIRST)) || !Array.isArray(entry.events)) return no('entry ' + n + ' is not a registry entry');
    if (entry.n !== n || entry.prev !== reg.head) return no('entry ' + n + ' is not linked to the one before it');
    const held = dossierOf(reg, entry.card);
    // the events go where the entry says they begin, so a fork written into the log meets the record as a fork
    const dossier = held ? { ...held, events: [...held.events.slice(0, entry.at), ...entry.events] } : { v: 1, genome: entry.genome, events: entry.events };
    const r = await record(reg, dossier, opts);
    if (!r.ok) return no('entry ' + n + ' was refused: ' + r.why);
    if (!r.entry || !same(r.entry, entry)) return no('entry ' + n + ' is not what the registry would have recorded');
    reg = r.reg;
  }
  return { ok: true, reg };
}
