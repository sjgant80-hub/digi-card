// src/drop.mjs — THE DROP: the genesis cards, minted the same way every time, and decoder #0001, which lets anyone
// re-run the whole drop from one card.
//
// A genesis card is one search (seed-library's, from a seed derived from its department's name) on one department's
// FIT rows; it enters the drop only if the mind it finds clears the 0.6 bar on GATE, and then the card carries that mind
// in its fixed form. Its genome is sealed by the drop's maker and issued, serial by serial, to the maker, then recorded
// in the drop's registry log. Nothing is chosen by hand: the plan, the seeds and the bar decide, and the search behind
// every card is named in the manifest, so anyone can run it again and get the very same mind.
//
// Decoder #0001 is the first card: a genesis mind like the others, whose life also carries the DROP receipt — the hash of
// the decoder (the exact source files that read, check and draw a card), the head of the registry log holding every
// other genesis card, and how many there are. Hold #0001 and you can check everything: replay the log to its head, hash
// the decoder you are running, and compare. It leads with "re-run it yourself", never with what it cannot prove.
//
// The maker key here is a DEMO key, derived from a public phrase so anyone can reproduce every seal; the real drop is
// sealed with its owner's own key (tools/genesis.mjs --key), which changes every card's id and nothing else.
import { seal } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { fromSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, sha256Hex, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { issue } from './dossier.mjs';
import { seedsFor } from './mind.mjs';
import { replay } from './registry.mjs';

export const BAR = 0.6;
export const THEMES = ['synthwave-v1', 'blockcraft-v1'];
export const DEMO_PHRASE = 'digi-card/genesis/demo-maker';
export const DROP_KEYS = ['cards', 'decoder', 'kind', 'log'];
const no = (why) => ({ ok: false, why });
const exactly = (x, keys) => Object.prototype.toString.call(x) === '[object Object]' && Object.keys(x).sort().join() === keys.join();

/** the demo maker: keys from a public phrase (a real drop uses its owner's own) */
export const demoMaker = () => fromSeed(sha256Bytes(utf8(DEMO_PHRASE)));
/** the seeds a department's genesis searches run, in order */
export const genesisSeeds = (domain, n) => seedsFor('digi-card/genesis/' + domain, n);
/** a card's face theme by serial: the two published themes in turn */
export const themeOf = (serial) => THEMES[serial % THEMES.length];

/**
 * The plan: serials 2..total shared among the departments in turn (serial 1 is the decoder). → [{ serial, domain }]
 */
export function planOf(domains, total) {
  if (!Array.isArray(domains) || !domains.length) return [];
  return Array.from({ length: Math.max(0, total - 1) }, (_, k) => ({ serial: k + 2, domain: domains[k % domains.length] }));
}

/**
 * One genesis card from a mind a search found: sealed and issued to the maker. organ — organOf(searchOf(domain, seed),
 * view, BAR). → { ok, dossier, entry: { serial, card, domain, found, recipe, gate } } | a refusal
 */
export async function mintGenesis(organ, { found, serial, keys }) {
  if (!organ || organ.ok !== true) return no('the search did not grow a mind here');
  if (organ.state !== 'live') return no('the mind it found does not clear the ' + BAR + ' bar on GATE (' + organ.gate + ')');
  const g = await seal({ name: organ.domain, parents: [], gate: { auc: BAR }, organs: [organ.fixed] }, keys);
  if (!g.ok) return no('the genome could not be sealed: ' + g.why);
  const d = await issue(g.text, keys, { serial, to: keys.pub, theme: themeOf(serial), generation: 0 });
  if (!d.ok) return no('the card could not be issued: ' + d.why);
  return { ok: true, dossier: d.dossier, entry: { serial, card: g.id, domain: organ.domain, found, recipe: organ.fixed, gate: organ.gate } };
}

/** the decoder's hash: the exact files that read, check and draw a card, by path and SHA-256 */
export const decoderHash = (files) => sha256Hex(canonical(files));   // canonical() sorts the paths itself

/** the receipt decoder #0001 carries: the decoder's hash, the registry log's head, and how many cards that log holds */
export const dropReceipt = ({ decoder, log, cards }) => ({ kind: 'drop', decoder, log, cards });

/**
 * Re-run a drop receipt: the decoder this device runs hashes to the receipt's, and the drop's registry log — its first
 * `cards` entries — replays from nothing (every seal and signature checked again) to the receipt's head, every one a
 * card of the same maker. → { ok, reg } | a refusal naming what differs
 */
export async function checkDrop(receipt, { decoder, log, maker } = {}) {
  if (!exactly(receipt, DROP_KEYS) || receipt.kind !== 'drop') return no('it is not a drop receipt');
  if (receipt.decoder !== decoder) return no('the decoder this device runs is not the one the drop names');
  if (!Array.isArray(log) || !Number.isSafeInteger(receipt.cards) || receipt.cards < 1 || receipt.cards > log.length) return no('the drop log does not hold the cards the receipt names');
  const r = await replay(log.slice(0, receipt.cards));
  if (!r.ok) return no('the drop log does not replay: ' + r.why);
  if (r.reg.head !== receipt.log) return no('the drop log replays to another head');
  const makers = new Set(Object.values(r.reg.cards).map((c) => c.maker));
  if (makers.size !== 1 || (maker && !makers.has(maker))) return no('the drop’s cards are not all of one maker');
  return { ok: true, reg: r.reg };
}

