// src/data.mjs — THE GROUND a DIGI grows on: real records, checked to the byte before a row of them is read.
//
// Six real public datasets ship with the card (data/SOURCES.json says where each came from, under what licence, and how
// its columns are read). Each is cut into departments — the records one team of a business keeps — by dex-frontier's
// loaders, vendored unchanged: every encoding and every split (FIT, where a mind is grown; GATE, where it must prove
// itself; TEST, which nothing in this repository fits or selects on) is fixed there, before any measurement.
//
// A file is opened only if its SHA-256 is the published one, so "this mind scored 0.739 on credit collections" always
// means the same 30,000 clients, on any device. A ground's id — the set's name and the hash of its files' hashes — is
// what a level's receipt names, so a level is re-run only on the very bytes it was earned on.
//
// An owner's own table is a ground too (ownGround): a CSV, a yes/no column to predict, and up to sixteen measured columns;
// it is split the same seeded way, and its id is its own bytes' hash. It never leaves the device: the receipts a card
// earns on it say which bytes, so anyone holding the same table can re-run them, and nobody else can claim to have.
// Pure and total: a bad file is refused with its reason, never thrown.
import { loadTelco, loadShop, silo } from '../vendor/dex-frontier/src/silos.mjs';
import { loadBank, loadAdult, FRESH_SPLIT } from '../vendor/dex-frontier/src/fresh.mjs';
import { loadHospital, loadCredit } from '../vendor/dex-frontier/src/fresh2.mjs';
import { splitRows, MAXFEATS } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sha256Hex, toHexStr } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';

/** each bundled set: its files (in data/), the published SHA-256 of each, and the loader that reads them */
export const SETS = {
  telco: { title: 'Telecom customers', outcome: 'left the company', files: { 'telco-churn.csv': '16320c9c1ec72448db59aa0a26a0b95401046bef5d02fd3aeb906448e3055e91' }, read: ([a]) => loadTelco(a) },
  shop: { title: 'Online shop sessions', outcome: 'bought', files: { 'online_shoppers_intention.csv': 'd8e130ba51532985f93281a73ce299e6ce150cb915769a7962a11e595eadd6a1' }, read: ([a]) => loadShop(a) },
  bank: { title: 'Bank marketing calls', outcome: 'subscribed', files: { 'bank-additional-full.csv': '74adfc578bf77a7ff4bb1ba4a9f8709d9e3c6907342959c2c8416847e0afb4d8' }, read: ([a]) => loadBank(a) },
  adult: { title: 'Census adults', outcome: 'earns over $50k', files: { 'adult.data': '5b00264637dbfec36bdeaab5676b0b309ff9eb788d63554ca0a249491c86603d', 'adult.test': 'a2a9044bc167a35b2361efbabec64e89d69ce82d9790d2980119aac5fd7e9c05' }, read: ([a, b]) => loadAdult(a, b) },
  hospital: { title: 'Hospital stays', outcome: 'readmitted within 30 days', files: { 'diabetic_data.csv': '0689e7ec031237dc63031b938805c48377748761a3b26acab621567afa24df97' }, read: ([a]) => loadHospital(a) },
  credit: { title: 'Credit card clients', outcome: 'defaulted', files: { 'credit-default.csv': '4edce6da569b2c30788a85fd98a9bafb1a983e8ca1a7aac875dd7ff853cbd0bb' }, read: ([a]) => loadCredit(a) },
};
export const MAX_OWN = 8 << 20;          // an owner's table, at most 8 MB
export const MAX_OWN_ROWS = 200000;
const SLUG = /^[a-z][a-z0-9-]{0,23}$/;
const no = (why) => ({ ok: false, why });
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** SHA-256 of bytes, hex: WebCrypto's (every browser that runs the page, and Node, has it) */
export const digest = async (bytes) => toHexStr(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)));

/** a ground's id: the set's name and the hash of its files' published hashes */
export const idOf = (set, hashes) => set + ':' + sha256Hex(Object.entries(hashes).map(([f, h]) => f + ' ' + h).join('\n')).slice(0, 16);
export const IDS = Object.fromEntries(Object.entries(SETS).map(([s, d]) => [s, idOf(s, d.files)]));

/**
 * Open a bundled set from its files' bytes ({ name: Uint8Array }): each must be the published bytes, then it is read.
 * The hash is WebCrypto's (fast on a phone).
 * → { ok, id, set, ds } | a refusal naming the file.
 */
export async function openSet(set, bytes) {
  if (typeof set !== 'string' || !own(SETS, set)) return no('there is no bundled set called ' + String(set).slice(0, 40));
  const files = SETS[set].files, texts = [];
  for (const [name, hash] of Object.entries(files)) {
    const b = bytes && own(bytes, name) ? bytes[name] : null;
    if (!(b instanceof Uint8Array)) return no('data/' + name + ' is missing');
    if ((await digest(b)) !== hash) return no('data/' + name + ' is not the published bytes');
    texts.push(new TextDecoder().decode(b));
  }
  const ds = SETS[set].read(texts);
  return ds.ok ? { ok: true, id: IDS[set], set, ds } : no('data/' + Object.keys(files)[0] + ' could not be read: ' + ds.error);
}

/** one department of an opened ground by the domain its minds carry (credit-collections), as a mind sees it: only its
 *  own columns, FIT to grow on and GATE to be judged on. → view | null */
export function viewOf(ground, domain) {
  if (ground.custom) return domain === ground.ds.name ? ground.view : null;
  const short = typeof domain === 'string' && domain.startsWith(ground.ds.name + '-') ? domain.slice(ground.ds.name.length + 1) : null;
  return short !== null && own(ground.ds.silos, short) ? silo(ground.ds, short) : null;
}

/** the departments of a ground, by the domain name their minds carry */
export const departments = (ground) => (ground.custom ? [ground.ds.name] : Object.keys(ground.ds.silos).map((s) => ground.ds.name + '-' + s));

const cells = (line) => line.split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
const NUM = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;

/**
 * An owner's own table: CSV text (a header row, comma-separated), the column to predict and which of its values is the
 * case, and a name. Every other column that is a number on every row is a measurement (at most sixteen, in the file's
 * order); a column with words in it is left out, said so. TEST, GATE and FIT are cut the bundled sets' seeded way.
 * → { ok, id, set: 'own', ds, view, custom: true, used, left } | a refusal naming the row or column.
 */
export function ownGround(text, { target, positive, name } = {}) {
  if (typeof text !== 'string' || !text.length) return no('the table is empty');
  if (text.length > MAX_OWN) return no('the table is larger than 8 MB');
  if (typeof name !== 'string' || !SLUG.test(name)) return no('the name is lower-case letters, digits and hyphens, at most 24, starting with a letter');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 3) return no('the table needs a header and at least two rows');
  if (lines.length - 1 > MAX_OWN_ROWS) return no('the table has more than 200,000 rows');
  const head = cells(lines[0]);
  if (new Set(head).size !== head.length) return no('two columns share a name');
  const t = head.indexOf(target);
  if (t < 0) return no('there is no column called ' + String(target).slice(0, 40));
  const rows = [];
  for (let k = 1; k < lines.length; k++) {
    const c = cells(lines[k]);
    if (c.length !== head.length) return no('row ' + k + ' has ' + c.length + ' cells, not ' + head.length);
    rows.push(c);
  }
  const y = rows.map((c) => (c[t] === String(positive) ? 1 : 0)), pos = y.reduce((a, b) => a + b, 0);
  if (pos < 10 || rows.length - pos < 10) return no('the column to predict needs at least ten rows of each answer (it has ' + pos + ' of ' + String(positive).slice(0, 40) + ')');
  const numeric = head.map((h, j) => j !== t && rows.every((c) => NUM.test(c[j])));
  const used = head.filter((h, j) => numeric[j]).slice(0, MAXFEATS), left = head.filter((h, j) => j !== t && !used.includes(h));
  if (!used.length) return no('no column besides the one to predict is a number on every row');
  const cols = Object.fromEntries(used.map((h) => [h, rows.map((c) => Number(c[head.indexOf(h)]))]));
  const all = rows.map((_, i) => i), test = splitRows({ y }, all, FRESH_SPLIT.test, FRESH_SPLIT.testSeed), gate = splitRows({ y }, test.rest, FRESH_SPLIT.gate, FRESH_SPLIT.gateSeed);
  const ds = { ok: true, name, title: name, outcome: String(positive), features: used, cols, y, n: rows.length, fitRows: gate.rest, gateRows: gate.held, testRows: test.held, silos: { [name]: used } };
  const view = { ok: true, name, features: used, cols, y, n: rows.length, trainRows: gate.rest, heldRows: gate.held };
  // the id binds the question to the bytes: the same table asked about another column is another ground
  return { ok: true, id: 'own:' + sha256Hex([name, target, String(positive), text].join(String.fromCharCode(10))).slice(0, 16), set: 'own', ds, view, custom: true, used, left };
}
