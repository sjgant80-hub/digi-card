// card.test.mjs — a DIGI card is a PNG that carries its whole dossier in a visible band and shows exactly what it carries:
// it reads back byte for byte, survives an editor re-saving it, and is refused, in plain words, the moment its bytes, its
// band or its face say something other than its signed life.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, inflateSync } from 'node:zlib';
import { cardOf, readCard, bandOf, chunksOf, W, H, BAND, CAPACITY, MAX_CARD } from '../src/card.mjs';
import { issue, addReceipt, reskin, encode, facts, verify } from '../src/dossier.mjs';
import { seal } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { crc32, cat } from '../vendor/dex-frontier/vendor/living-seed/src/card.mjs';
import { encodeSeed, makeSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { fromSeed, sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, sha256Hex, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

const key = (s) => fromSeed(sha256Bytes(utf8('digi-card/test/' + s)));
const genomeOf = async (maker, name = 'credit-collections') => (await seal({ name, parents: [], gate: { auc: 0.6 }, organs: [encodeSeed(makeSeed({ domain: name, seed: 1, grow: { population: 40, elites: 8, generations: 30 } }))] }, maker)).text;

// a stand-in art engine: every pixel depends on every fact and the theme, so any change to what the card carries shows
const THEMES = ['synthwave-v1', 'blockcraft-v1'];
const paint = (f, theme, w, h) => {
  if (!THEMES.includes(theme)) return { ok: false, why: 'unknown theme ' + theme };
  const s = [...canonical(f) + theme].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
  const px = new Uint8Array(w * h * 3);
  for (let i = 0; i < px.length; i++) px[i] = ((s >>> (i % 25)) + i * 7) & 255;
  return { ok: true, px };
};

const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const chunk = (type, data) => { const body = cat([utf8(type), data]); return cat([new Uint8Array(u32(data.length)), body, new Uint8Array(u32(crc32(body)))]); };
const SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = ({ w = W, h = H, depth = 8, color = 2, interlace = 0 } = {}) => chunk('IHDR', new Uint8Array([...u32(w), ...u32(h), depth, color, 0, 0, interlace]));
const png = (...chunks) => cat([SIG, ...chunks, chunk('IEND', new Uint8Array(0))]);
/** a card's pixels, read the plain way: inflate, drop each row's filter byte (the writer uses filter 0 throughout) */
const pixelsIn = (card) => { const raw = inflateSync(Buffer.from(cat(chunksOf(card).filter((c) => c.type === 'IDAT').map((c) => c.data)))), px = new Uint8Array(W * H * 3); for (let y = 0; y < H; y++) px.set(raw.subarray(y * (1 + W * 3) + 1, (y + 1) * (1 + W * 3)), y * W * 3); return px; };
/** PNG row filters 0–4 (the encoder an editor runs), so a re-saved card can be built */
function filtered(px, pick) {
  const st = W * 3, out = new Uint8Array(H * (st + 1));
  for (let y = 0; y < H; y++) {
    const f = pick(y);
    out[y * (st + 1)] = f;
    for (let i = 0; i < st; i++) {
      const a = i >= 3 ? px[y * st + i - 3] : 0, b = y ? px[(y - 1) * st + i] : 0, c = y && i >= 3 ? px[(y - 1) * st + i - 3] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= Math.min(pb, pc) ? a : pb <= pc ? b : c][f];
      out[y * (st + 1) + 1 + i] = (px[y * st + i] - pred) & 255;
    }
  }
  return out;
}
/** a card re-saved from pixels: any filters, real compression, the data split across IDAT chunks */
const resaved = (px, { pick = () => 0, parts = 1, extra = [] } = {}) => {
  const z = deflateSync(filtered(px, pick)), size = Math.ceil(z.length / parts);
  return png(ihdr(), ...extra, ...Array.from({ length: parts }, (_, k) => chunk('IDAT', z.subarray(k * size, (k + 1) * size))));
};

async function world() {
  const maker = await key('maker'), alice = await key('alice'), eve = await key('eve'), g = await genomeOf(maker);
  const d = (await issue(g, maker, { serial: 1, to: alice.pub, theme: 'synthwave-v1' })).dossier;
  return { maker, alice, eve, g, d, card: (await cardOf(d, paint)).png };
}

test('a card carries its dossier and shows it: it reads back exactly, and the same life makes the same card, byte for byte', async () => {
  const { alice, d, card } = await world();
  const v = await verify(d), made = await cardOf(d, paint);
  assert.ok(made.ok, made.why);
  assert.deepEqual([made.id, made.facts], [v.id, facts(v)]);
  assert.deepEqual(made.png, card, 'deterministic');
  const raw = W * 3 + 1, zlib = 2 + Math.ceil(H * raw / 65535) * 5 + H * raw + 4;
  assert.equal(card.length, 8 + 25 + 12 + zlib + 12, 'signature, IHDR, one IDAT of stored blocks, IEND');
  assert.deepEqual([...card.subarray(16, 29)], [...u32(384), ...u32(576), 8, 2, 0, 0, 0]);
  const px = pixelsIn(card), text = encode(d), bytes = utf8(text);
  assert.deepEqual([...px.subarray(0, 6)], [0x44, 0x47, 0x31, bytes.length >>> 16, (bytes.length >>> 8) & 255, bytes.length & 255]);
  assert.deepEqual(px.subarray(6, 6 + bytes.length), bytes, 'the band is the dossier’s own bytes, in the open');
  assert.ok(px.subarray(6 + bytes.length, W * BAND * 3).every((b) => b === 0), 'then black to the end of the band');
  assert.deepEqual(px.subarray(W * BAND * 3), paint(facts(v), 'synthwave-v1', W, H - BAND).px, 'the face is the art engine’s, untouched');
  const r = await readCard(card, paint);
  assert.ok(r.ok, r.why);
  assert.deepEqual([r.dossier, r.id, r.owner, r.facts, r.v.serial], [d, v.id, alice.pub, facts(v), 1]);
});

test('the face moves with the life: a level earned or a new skin redraws it, and the card reads back each time', async () => {
  const { alice, d, card } = await world();
  const earned = (await addReceipt(d, alice, { kind: 'grow', before: 700000, after: 720000 })).dossier;
  const skinned = (await reskin(d, alice, 'blockcraft-v1')).dossier;
  const [a, b] = [(await cardOf(earned, paint)).png, (await cardOf(skinned, paint)).png];
  for (const [c, want] of [[a, earned], [b, skinned]]) { const r = await readCard(c, paint); assert.ok(r.ok, r.why); assert.deepEqual(r.dossier, want); }
  const face = (c) => pixelsIn(c).subarray(W * BAND * 3);
  assert.notDeepEqual(face(a), face(card), 'stage 1 draws another face');
  assert.notDeepEqual(face(b), face(card), 'another theme draws another face');
  assert.equal((await readCard(a, paint)).facts.stage, 1);
});

test('a card survives an editor re-saving it: any row filters, real compression, split data, extra chunks, bytes after the end', async () => {
  const { d, card } = await world();
  const px = pixelsIn(card);
  for (const opts of [{ pick: (y) => y % 5, parts: 3 }, { pick: () => 4 }, { pick: () => 1, extra: [chunk('tEXt', utf8('Software\0an editor'))] }, { pick: (y) => (y * 7) % 5, parts: 40 }]) {
    const r = await readCard(resaved(px, opts), paint);
    assert.ok(r.ok, r.why); assert.deepEqual(r.dossier, d);
  }
  const padded = new Uint8Array(MAX_CARD); padded.set(card);
  assert.ok((await readCard(padded, paint)).ok, 'bytes after IEND are not read, up to the size limit');
  const over = new Uint8Array(MAX_CARD + 1); over.set(card);
  assert.equal((await readCard(over, paint)).why, 'not a card');
});

test('a damaged or foreign file is refused before its pixels are read, each for its own reason', async () => {
  const { card } = await world();
  const px = pixelsIn(card), good = deflateSync(filtered(px, () => 0)), idat = chunksOf(card).findIndex((c) => c.type === 'IDAT');
  const flip = (at) => { const c = card.slice(); c[at] ^= 1; return c; };
  const cases = {
    'not a card': [[...card], 'not a card'],
    'a string': ['card', 'not a card'],
    'seven bytes': [card.subarray(0, 7), 'not a PNG'],
    'another signature': [flip(1), 'not a PNG'],
    'cut short': [card.subarray(0, card.length - 30), 'the PNG is cut short'],
    'a damaged chunk': [flip(card.length - 40), 'a chunk of the PNG is damaged'],
    'a damaged header': [flip(20), 'a chunk of the PNG is damaged'],
    'no IEND': [card.subarray(0, card.length - 12), 'the PNG is not whole'],
    'IEND first': [cat([SIG, chunk('IEND', new Uint8Array(0)), ihdr()]), 'the PNG is not whole'],
    'no IHDR first': [png(chunk('IDAT', good), ihdr()), 'the PNG is not whole'],
    'nothing after the signature': [SIG, 'the PNG is not whole'],
    'too wide': [png(ihdr({ w: 385 }), chunk('IDAT', good)), 'not a DIGI card (it is not a 384 × 576 RGB picture)'],
    'too short': [png(ihdr({ h: 575 }), chunk('IDAT', good)), 'not a DIGI card (it is not a 384 × 576 RGB picture)'],
    '16-bit': [png(ihdr({ depth: 16 }), chunk('IDAT', good)), 'not a DIGI card (it is not a 384 × 576 RGB picture)'],
    'with alpha': [png(ihdr({ color: 6 }), chunk('IDAT', good)), 'not a DIGI card (it is not a 384 × 576 RGB picture)'],
    'interlaced': [png(ihdr({ interlace: 1 }), chunk('IDAT', good)), 'not a DIGI card (it is not a 384 × 576 RGB picture)'],
    'a short header': [png(chunk('IHDR', new Uint8Array([...u32(W), ...u32(H), 8, 2, 0, 0])), chunk('IDAT', good)), 'not a DIGI card (it is not a 384 × 576 RGB picture)'],
    'no picture data': [png(ihdr()), 'the picture data does not decompress'],
    'data that is not zlib': [png(ihdr(), chunk('IDAT', utf8('not zlib at all'))), 'the picture data does not decompress'],
    'too little data': [png(ihdr(), chunk('IDAT', deflateSync(filtered(px, () => 0).subarray(0, 1000)))), 'the picture data is the wrong size'],
    'a row filter that does not exist': [png(ihdr(), chunk('IDAT', deflateSync(filtered(px, () => 0).map((b, i) => (i === (W * 3 + 1) * 9 ? 5 : b))))), 'the picture data is not a PNG’s'],
  };
  assert.equal(idat, 1);
  for (const [what, [bytes, why]] of Object.entries(cases)) assert.equal((await readCard(bytes, paint)).why, why, what);
});

test('the band must hold exactly one dossier that checks, and nothing else', async () => {
  const { alice, eve, g, d, card } = await world();
  const px = pixelsIn(card), bytes = utf8(encode(d));
  const band = (b) => { const p = px.slice(); p.fill(0, 0, W * BAND * 3); p.set(b, 0); return resaved(p); };
  const head = (n) => [0x44, 0x47, 0x31, n >>> 16, (n >>> 8) & 255, n & 255];
  const forged = { ...d, events: [{ ...d.events[0], serial: 2 }] }, fb = utf8(encode(forged));
  const cases = {
    'another magic': [[0x44, 0x47, 0x32, ...head(bytes.length).slice(3), ...bytes], 'not a DIGI card (no dossier in its band)'],
    'a length past the band': [head(CAPACITY + 1), 'not a DIGI card (no dossier in its band)'],
    'a band full to its last byte': [[...head(CAPACITY), ...new Uint8Array(CAPACITY).fill(0x78)], 'the band does not hold a dossier: a dossier is at most 18000 bytes'],
    'bytes that are not text': [[...head(2), 0xff, 0xfe], 'the band does not hold text'],
    'text that is not a dossier': [[...head(5), ...utf8('hello')], 'the band does not hold a dossier: not a dossier'],
    'a dossier not in its one form': [[...head(bytes.length + 1), ...utf8(encode(d) + ' ')], 'the band does not hold a dossier: the dossier is not in its one byte form'],
    'a forged dossier': [[...head(fb.length), ...fb], 'the card was refused: only a dossier that checks becomes a card: event 0’s signature does not check'],
    'a byte after the dossier': [[...head(bytes.length), ...bytes, 1], 'the band holds more than its dossier'],
    'a byte at the band’s very end': [Object.assign(new Uint8Array(W * BAND * 3), { [W * BAND * 3 - 1]: 1 }).map((b, i) => (i < 6 + bytes.length ? [...head(bytes.length), ...bytes][i] : b)), 'the band holds more than its dossier'],
  };
  for (const [what, [b, why]] of Object.entries(cases)) assert.equal((await readCard(band(b), paint)).why, why, what);
  assert.ok((await readCard(band([...head(bytes.length), ...bytes]), paint)).ok, 'the honest band, re-saved, still reads');
  assert.equal((await readCard(card, paint, { trust: [eve.pub] })).why, 'the card was refused: only a dossier that checks becomes a card: the genome was refused: untrusted maker');
  assert.ok((await readCard(card, paint, { trust: [(await key('maker')).pub] })).ok, 'a device that trusts the maker reads it');
  assert.ok(g && alice);
});

test('the face cannot lie: one pixel off, or a face from another life, and the card is refused', async () => {
  const { alice, d, card } = await world();
  const px = pixelsIn(card), first = W * BAND * 3;
  for (const at of [first, first + 1, px.length - 1, first + 12345]) {
    const p = px.slice(); p[at] ^= 1;
    assert.equal((await readCard(resaved(p), paint)).why, 'the card’s face does not match what it carries', 'pixel ' + at);
  }
  const earned = pixelsIn((await cardOf((await addReceipt(d, alice, { kind: 'grow', before: 1, after: 2 })).dossier, paint)).png);
  const lie = px.slice(); lie.set(earned.subarray(first), first);
  assert.equal((await readCard(resaved(lie), paint)).why, 'the card’s face does not match what it carries', 'a stage-1 face on a stage-0 life');
  const stolen = earned.slice(); stolen.set(px.subarray(first), first);
  assert.equal((await readCard(resaved(stolen), paint)).why, 'the card’s face does not match what it carries', 'an earned life wearing an unearned face');
});

test('the art engine is handed in: it is called with the facts, and whatever it cannot draw is refused in its own words', async () => {
  const { d, card } = await world();
  const v = await verify(d), calls = [];
  await cardOf(d, (...a) => { calls.push(a); return paint(...a); });
  assert.deepEqual(calls, [[facts(v), 'synthwave-v1', 384, 560]]);
  const engines = {
    'a theme it does not have': [(f, t, w, h) => (t === 'synthwave-v1' ? { ok: false, why: 'unknown theme ' + t } : paint(f, t, w, h)), 'the art engine could not draw this card: unknown theme synthwave-v1'],
    'nothing back': [() => null, 'the art engine could not draw this card: no reason given'],
    'a refusal without a reason': [() => ({ ok: false }), 'the art engine could not draw this card: no reason given'],
    'a yes that is not true': [(...a) => ({ ...paint(...a), ok: 1 }), 'the art engine could not draw this card: no reason given'],
    'a throw': [() => { throw new Error('boom'); }, 'the art engine failed while drawing this card'],
    'a face one pixel short': [(f, t, w, h) => ({ ok: true, px: new Uint8Array(w * h * 3 - 3) }), 'the art engine drew the wrong size of face'],
    'a face one pixel long': [(f, t, w, h) => ({ ok: true, px: new Uint8Array(w * h * 3 + 3) }), 'the art engine drew the wrong size of face'],
    'a face that is a list': [(f, t, w, h) => ({ ok: true, px: Array(w * h * 3).fill(0) }), 'the art engine drew the wrong size of face'],
  };
  for (const [what, [engine, why]] of Object.entries(engines)) {
    assert.equal((await cardOf(d, engine)).why, why, what);
    assert.equal((await readCard(card, engine)).why, 'the card was refused: ' + why, what + ' (reading)');
  }
  assert.equal((await readCard(card, (f, t, w, h) => ({ ok: true, px: new Uint8Array(w * h * 3) }))).why, 'the card’s face does not match what it carries', 'another engine draws another face');
});

test('only a dossier that checks, and fits, becomes a card', async () => {
  const { alice, d } = await world();
  assert.equal((await cardOf({ v: 1 }, paint)).why, 'only a dossier that checks becomes a card: not a dossier');
  assert.equal((await cardOf({ ...d, events: [] }, paint)).why, 'only a dossier that checks becomes a card: a dossier’s life begins with its issue');
  // a life past the band is signed by hand here (the dossier itself refuses to grow one): the card still refuses it
  const v = await verify(d), e0 = d.events[0];
  const body = { type: 'receipt', receipt: { pad: 'x'.repeat(CAPACITY) }, card: v.id, k: 1, prev: sha256Hex(canonical(e0)), by: alice.pub };
  const long = { ...d, events: [e0, { ...body, sig: await sign(alice, utf8(canonical(body))) }] };
  assert.ok((await verify(long)).ok, 'it checks');
  assert.equal((await cardOf(long, paint)).why, 'the dossier is too long for the card’s band');
  assert.equal(bandOf(new Uint8Array(CAPACITY + 1)), null);
  const full = bandOf(new Uint8Array(CAPACITY).fill(7));
  assert.deepEqual([full.length, ...full.subarray(0, 6), full[full.length - 1]], [W * BAND * 3, 0x44, 0x47, 0x31, CAPACITY >>> 16, (CAPACITY >>> 8) & 255, CAPACITY & 255, 7]);
  assert.equal(CAPACITY, 18426);
});

test('fuzz: no bytes make the reader throw; a mangled card is refused, never misread', async () => {
  const { d, card } = await world();
  let s = 2026;
  const rnd = (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s % n; };
  for (let t = 0; t < 60; t++) {
    const junk = new Uint8Array(rnd(400)).map(() => rnd(256));
    if (t % 3 === 0) junk.set(SIG.subarray(0, Math.min(8, junk.length)));
    const r = await readCard(junk, paint);
    assert.equal(r.ok, false); assert.equal(typeof r.why, 'string');
  }
  const px = pixelsIn(card);
  for (let t = 0; t < 40; t++) {
    const p = px.slice(); p[rnd(p.length)] ^= 1 + rnd(255);
    const r = await readCard(resaved(p, { pick: () => rnd(5) }), paint);
    assert.equal(r.ok, false, 'a changed pixel is always seen'); assert.equal(typeof r.why, 'string');
  }
  for (let t = 0; t < 40; t++) {
    const c = card.slice(); c[8 + rnd(c.length - 8)] ^= 1 + rnd(255);
    const r = await readCard(c, paint);
    assert.ok(r.ok === false || canonical(r.dossier) === canonical(d), 'a changed byte is refused or changed nothing that counts');
  }
});
