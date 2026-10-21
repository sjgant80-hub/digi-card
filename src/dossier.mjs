// src/dossier.mjs — THE DOSSIER: everything a DIGI card carries, as one canonical record that checks itself.
//
// A DIGI card is a living-seed genome (the mind's recipe, sealed by its maker) plus its life as a chain of signed events:
//   issue    the maker issues the card: its serial, its first owner, its face's theme, its generation
//   give     the owner hands it to another key (a trade is a re-signing)
//   receipt  a level earned: a gated improvement, carried with what it takes to re-run it (src/receipt.mjs re-runs it)
//   skin     the owner re-skins it with another published theme (the face changes; the mind does not)
// Each event names the hash of the one before it (prev; the first names the genome's), so nothing can be dropped from the
// middle or moved, and each is signed by whoever is entitled to it: the issue by the genome's own maker, every later event
// by the card's owner at that moment. The genome is opened under its seal and the chain checked link by link before a
// single fact is read from it (verify before parse, as living-seed checks a genome).
//
// A card has a FORM: the kind of mind it carries and how it is put to work. Every card issued until now is form 'card' (a
// scorer) and a version 1 dossier, byte for byte as it was. A card of another form is a version 2 dossier whose issue names
// its form, so the form is signed by the maker and nobody can relabel a card; a reader that knows only version 1 (decoder
// #0001) refuses it in plain words instead of misreading it. FORMS holds only the forms this repository can put to work:
//   card     a scorer: it scores and ranks its department's cases, and abstains where its rules cannot read one
//   chat     a talker: the same verified mind, answering questions in words (src/chat.mjs), and abstaining otherwise
//
// Ownership is the chain: the owner is whoever the last give names. A card alone cannot stop its owner signing it away
// twice — two chains that share a beginning are a double sale — so the registry (src/registry.mjs) settles it: the first
// give recorded there wins. That is said wherever ownership is.
//
// Canonical JSON throughout (living-seed's canon.mjs: sorted keys, no whitespace, integers only), so a signed event has one
// byte form and cannot be re-wrapped. Pure apart from the signatures (WebCrypto Ed25519, the same in Node and every modern
// browser); total: junk is refused in plain words, never thrown.
import { open } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { decodeSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

export const TAG = 'digi.v1';
export const MAX_EVENTS = 40;           // a card's life fits its band; a longer one moves to a fresh card
export const MAX_BYTES = 18000;         // the dossier's canonical text in UTF-8 bytes, at most (the card's band holds 18,426)
export const DATASETS = ['telco', 'shop', 'bank', 'adult', 'hospital', 'credit'];
export const RARITY = [[10, 'legendary'], [6, 'epic'], [3, 'rare'], [1, 'uncommon'], [0, 'common']];   // by stage, highest first
export const FORMS = ['card', 'chat'];   // the forms a card can carry; 'card' is version 1, every other form version 2

const PUB = /^[0-9a-f]{64}$/, SIG = /^[0-9a-f]{128}$/, THEME = /^[a-z][a-z0-9]{1,15}-v[1-9][0-9]{0,2}$/;
/** a plain record with exactly these keys (one test: arrays, null and every primitive fail it) */
const exactly = (x, keys) => Object.prototype.toString.call(x) === '[object Object]' && Object.keys(x).sort().join() === keys.join();
const KEYS = { issue: ['by', 'card', 'generation', 'prev', 'serial', 'sig', 'theme', 'to', 'type'], issue2: ['by', 'card', 'form', 'generation', 'prev', 'serial', 'sig', 'theme', 'to', 'type'], give: ['by', 'card', 'k', 'prev', 'sig', 'to', 'type'], receipt: ['by', 'card', 'k', 'prev', 'receipt', 'sig', 'type'], skin: ['by', 'card', 'k', 'prev', 'sig', 'theme', 'type'] };
const no = (why) => ({ ok: false, why });
const bytesOf = (text) => utf8(text).length;   // what the band carries is bytes, and € is three of them
const hashOf = (event) => sha256Hex(canonical(event));
const unsigned = (event) => Object.fromEntries(Object.entries(event).filter(([k]) => k !== 'sig'));

/** the stage's rarity: a level is earned by receipts, and rarity follows the level */
export const rarityOf = (stage) => RARITY.find(([at]) => stage >= at)[1];

/** a record of the chain, signed by keys; prev is the hash of what came before */
async function signed(fields, keys) {
  const event = { ...fields, by: keys.pub };
  return { ...event, sig: await sign(keys, utf8(canonical(event))) };
}

/** the canonical text of a dossier: the one byte form a card carries */
export const encode = (dossier) => canonical(dossier);

/** read a dossier's text: it must parse, have exactly the dossier's shape, and be its own canonical form */
export function decode(text) {
  if (typeof text !== 'string') return no('not a dossier');
  if (bytesOf(text) > MAX_BYTES) return no('a dossier is at most ' + MAX_BYTES + ' bytes');
  let d;
  try { d = JSON.parse(text); } catch { return no('not a dossier'); }
  if (!exactly(d, ['events', 'genome', 'v'])) return no('not a dossier');
  return canonical(d) === text ? { ok: true, dossier: d } : no('the dossier is not in its one byte form');
}

/**
 * The maker issues a card for a sealed genome: serial (1…), the first owner's key, the face's theme, its generation.
 * → { ok, dossier } | a refusal
 */
export async function issue(genomeText, makerKeys, { serial, to, theme, generation = 0, form = 'card' }) {
  const g = await open(genomeText);
  if (!g.ok) return no('only a genome that opens can be issued: ' + g.why);
  if (g.fields.by !== makerKeys.pub) return no('only the genome’s own maker issues its card');
  if (!FORMS.includes(form)) return no('the form is one of ' + FORMS.join(', '));
  const fields = { type: 'issue', card: g.id, serial, to, theme, generation, prev: sha256Hex(genomeText), ...(form === 'card' ? {} : { form }) };
  const bad = check(fields);
  if (bad) return no(bad);
  return { ok: true, dossier: { v: form === 'card' ? 1 : 2, genome: genomeText, events: [await signed(fields, makerKeys)] } };
}

function check(f) {
  if (f.type === 'issue') {
    if (!Number.isSafeInteger(f.serial) || f.serial < 1) return 'the serial is a whole number from 1';
    if (!Number.isSafeInteger(f.generation) || f.generation < 0 || f.generation > 99) return 'the generation is 0 to 99';
  }
  if (f.type === 'issue' || f.type === 'give') { if (typeof f.to !== 'string' || !PUB.test(f.to)) return 'the owner is an Ed25519 public key'; }
  if (f.type === 'issue' || f.type === 'skin') { if (typeof f.theme !== 'string' || !THEME.test(f.theme)) return 'the theme is a published theme id, like synthwave-v1'; }
  if (f.type === 'receipt') {
    if (!f.receipt || typeof f.receipt !== 'object' || Array.isArray(f.receipt)) return 'a receipt is a record';
    try { canonical(f.receipt); } catch { return 'a receipt holds only whole numbers, text, lists and records (scores in millionths)'; }
  }
  return '';
}

/** append an event the current owner signs: give (to), receipt (receipt) or skin (theme). → { ok, dossier } | a refusal */
async function append(dossier, ownerKeys, fields) {
  const v = await verify(dossier);
  if (!v.ok) return no('only a dossier that checks can grow: ' + v.why);
  if (v.owner !== ownerKeys.pub) return no('only the card’s owner can sign its next event');
  if (dossier.events.length >= MAX_EVENTS) return no('the card’s life is full: carry it on to a fresh card');
  const last = dossier.events[dossier.events.length - 1], all = { ...fields, card: v.id, k: dossier.events.length, prev: hashOf(last) };
  const bad = check(all);
  if (bad) return no(bad);
  const next = { ...dossier, events: [...dossier.events, await signed(all, ownerKeys)] };
  return bytesOf(encode(next)) > MAX_BYTES ? no('the card’s life no longer fits its band: carry it on to a fresh card') : { ok: true, dossier: next };
}
export const give = (dossier, ownerKeys, to) => append(dossier, ownerKeys, { type: 'give', to });
export const addReceipt = (dossier, ownerKeys, receipt) => append(dossier, ownerKeys, { type: 'receipt', receipt });
export const reskin = (dossier, ownerKeys, theme) => append(dossier, ownerKeys, { type: 'skin', theme });

/**
 * Check a dossier: the genome opens under its seal, the issue is its maker's, and every later event is signed by the
 * owner of that moment and names the hash of the event before. opts.trust: maker keys this device accepts (any, if
 * unset). → { ok, id, maker, owner, serial, generation, theme, gives, receipts, genome: fields } | a refusal naming the
 * first link that fails.
 */
export async function verify(dossier, opts = {}) {
  try {
    if (!exactly(dossier, ['events', 'genome', 'v'])) return no('not a dossier');
    if (dossier.v !== 1 && dossier.v !== 2) return no('not a version 1 or 2 dossier');
    if (!Array.isArray(dossier.events) || !dossier.events.length) return no('a dossier’s life begins with its issue');
    if (dossier.events.length > MAX_EVENTS) return no('a card’s life is at most ' + MAX_EVENTS + ' events');
    const g = await open(dossier.genome, opts.trust ? { trust: opts.trust } : {});
    if (!g.ok) return no('the genome was refused: ' + g.why);
    let owner = null, theme = null, prev = sha256Hex(dossier.genome), serial = 0, generation = 0, gives = 0, form = 'card';
    const receipts = [];
    for (const [k, e] of dossier.events.entries()) {
      const type = Object.prototype.toString.call(e) === '[object Object]' ? e.type : '', shape = type === 'issue' && dossier.v === 2 ? 'issue2' : type, want = type !== 'issue2' && exactly(e, KEYS[shape] || []) ? KEYS[shape] : null;
      if (!want) return no('event ' + k + ' is not a dossier event');
      if (k === 0 && e.type !== 'issue') return no('the first event is the issue');
      if (k > 0 && e.type === 'issue') return no('a card is issued once');
      if (e.card !== g.id) return no('event ' + k + ' is for another card');
      if (e.prev !== prev) return no('event ' + k + ' is not linked to the one before it');
      if (k > 0 && e.k !== k) return no('event ' + k + ' is out of place');
      const bad = check(e);
      if (bad) return no('event ' + k + ': ' + bad);
      if (k === 0 && e.by !== g.fields.by) return no('the card was not issued by its genome’s maker');
      if (k > 0 && e.by !== owner) return no('event ' + k + ' was not signed by the card’s owner');
      if (!SIG.test(e.sig)) return no('event ' + k + ' is not signed');
      if (!(await verifySig(e.by, e.sig, utf8(canonical(unsigned(e)))))) return no('event ' + k + '’s signature does not check');
      if (e.type === 'issue') {
        ({ to: owner, theme, serial, generation } = e);
        if (dossier.v === 2 && (e.form === 'card' || !FORMS.includes(e.form))) return no('a version 2 card names a form other than card: one of ' + FORMS.slice(1).join(', '));
        form = dossier.v === 2 ? e.form : 'card';
      }
      else if (e.type === 'give') { owner = e.to; gives++; }
      else if (e.type === 'receipt') receipts.push(e.receipt);
      else theme = e.theme;
      prev = hashOf(e);
    }
    return { ok: true, id: g.id, maker: g.fields.by, owner, serial, generation, theme, form, gives, receipts, genome: g.fields, head: prev };
  } catch { return no('not a dossier'); }
}

/**
 * What the card's face shows, read from a checked dossier: the art engine draws exactly these facts. The dataset and
 * department come from its mind's departments (a child bred across departments shows them joined, customer-payments);
 * the stage is its levels — receipts of kind 'level' only, each one re-run before any registry records it.
 */
export function facts(v) {
  const domains = v.genome.organs.map((o) => { const d = decodeSeed(o, { guard: false }); return d.ok ? d.seed.domain : v.genome.name; });
  const head = domains[0].split('-')[0], dataset = DATASETS.includes(head) && domains.every((d) => d.startsWith(head + '-')) ? head : 'custom';
  const department = (dataset === 'custom' ? domains : domains.map((d) => d.slice(head.length + 1))).join('-').slice(0, 16).replace(/-+$/, '');
  const title = v.genome.name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').slice(0, 24).trim();
  const stage = Math.min(99, v.receipts.filter((r) => r.kind === 'level').length);
  return { id: v.id, title, dataset, department, stage, rarity: rarityOf(stage), generation: v.generation, parents: v.genome.parents.slice() };
}
