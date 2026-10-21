// src/card.mjs — THE DIGI CARD: a 384 × 576 PNG that carries a whole living DIGI and shows exactly what it carries.
//
// The top sixteen rows are the band: the dossier's bytes (src/dossier.mjs: the sealed genome and every signed event of the
// card's life) laid into the red, green and blue of each pixel, after a magic 'DG1' and a three-byte length — a strip of
// data you can see, declared, never hidden in the low bits of the picture. Everything below is the face: drawn by the art
// engine from the card's facts (its id, title, specialty, stage, rarity, lineage) in the theme its dossier names. So the
// face cannot lie: a reader re-draws it from what the band carries and refuses a card whose picture differs by one pixel.
//
// The art engine is handed in (paint(facts, theme, w, h) → { ok, px }), so a new theme or a new engine never changes this
// codec; the product hands in PixelWhisperer Kards (vendor/pixelwhisperer). Writing is deterministic everywhere: stored
// deflate blocks, so the same dossier makes the same card, byte for byte, in a browser or on CI. Reading accepts any valid
// PNG of the right shape (an editor's re-compression still opens), CRC-checks every chunk before the pixels are read, and
// opens the dossier under its seals before a single fact is drawn: verify before parse, twice over.
//
// The PNG primitives (CRC-32, Adler-32, stored deflate, row filters) are living-seed's card.mjs, vendored unchanged, which
// follows spore-card's chunk discipline. Powered by the Konomi architecture, created by Thomas Frumkin.
import { crc32, cat, zlibStored, unfilter } from '../vendor/dex-frontier/vendor/living-seed/src/card.mjs';
import { decode, encode, verify, facts } from './dossier.mjs';
import { utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

export const W = 384, H = 576, BAND = 16, MAGIC = [0x44, 0x47, 0x31];   // 'DG1'
export const CAPACITY = W * BAND * 3 - 6;                                 // bytes of dossier the band carries
export const MAX_CARD = 1 << 22;                                          // 4 MB: no real card is near it
const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const no = (why) => ({ ok: false, why });
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const chunk = (type, data) => { const body = cat([new Uint8Array([...type].map((c) => c.charCodeAt(0))), data]); return cat([new Uint8Array(u32(data.length)), body, new Uint8Array(u32(crc32(body)))]); };

/** the band's pixels for a dossier's bytes: magic, length, the bytes, then black. → Uint8Array(W × BAND × 3) | null */
export function bandOf(bytes) {
  if (bytes.length > CAPACITY) return null;
  const band = new Uint8Array(W * BAND * 3);
  band.set([...MAGIC, (bytes.length >>> 16) & 255, (bytes.length >>> 8) & 255, bytes.length & 255, ...bytes], 0);
  return band;
}

/** the face a checked dossier draws: the facts, in its theme, by the engine handed in. → { ok, px } | a refusal */
function faceOf(v, paint) {
  const f = facts(v);
  let art;
  try { art = paint(f, v.theme, W, H - BAND); } catch { return no('the art engine failed while drawing this card'); }
  if (!art || art.ok !== true) return no('the art engine could not draw this card: ' + ((art && art.why) || 'no reason given'));
  return art.px instanceof Uint8Array && art.px.length === W * (H - BAND) * 3 ? { ok: true, px: art.px, facts: f } : no('the art engine drew the wrong size of face');
}

/** all of a card's pixels, RGB rows top to bottom */
async function pixelsOf(dossier, paint, opts) {
  const v = await verify(dossier, opts);
  if (!v.ok) return no('only a dossier that checks becomes a card: ' + v.why);
  const band = bandOf(utf8(encode(dossier)));
  if (!band) return no('the dossier is too long for the card’s band');
  const face = faceOf(v, paint);
  if (!face.ok) return face;
  return { ok: true, px: cat([band, face.px]), v, facts: face.facts };
}

/** A card for a dossier, its face drawn by paint. opts.trust: maker keys accepted. → { ok, png, facts } | a refusal */
export async function cardOf(dossier, paint, opts = {}) {
  const p = await pixelsOf(dossier, paint, opts);
  if (!p.ok) return p;
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) raw.set(p.px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);   // filter 0 on every row
  const ihdr = new Uint8Array([...u32(W), ...u32(H), 8, 2, 0, 0, 0]);
  return { ok: true, png: cat([new Uint8Array(SIG), chunk('IHDR', ihdr), chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0))]), facts: p.facts, id: p.v.id };
}

async function inflate(z) {
  const s = new Blob([z]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** a PNG's chunks, every CRC checked first. → [{ type, data }] | a refusal */
export function chunksOf(bytes) {
  const out = [];
  for (let at = 8; at < bytes.length;) {
    const len = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
    if (at + 12 + len > bytes.length) return no('the PNG is cut short');
    const body = bytes.subarray(at + 4, at + 8 + len), crc = ((bytes[at + 8 + len] << 24) | (bytes[at + 9 + len] << 16) | (bytes[at + 10 + len] << 8) | bytes[at + 11 + len]) >>> 0;
    if (crc32(body) !== crc) return no('a chunk of the PNG is damaged');
    out.push({ type: String.fromCharCode(...body.subarray(0, 4)), data: body.subarray(4) });
    at += 12 + len;
    if (out[out.length - 1].type === 'IEND') return out;
  }
  return no('the PNG is not whole');
}

/**
 * Read a card: the PNG's CRCs, then its pixels, then the dossier in the band under its seals, then the face re-drawn from
 * it and compared pixel for pixel. opts.trust: maker keys accepted. → { ok, dossier, id, owner, facts, v } | a refusal
 * naming what failed.
 */
export async function readCard(bytes, paint, opts = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_CARD) return no('not a card');
  if (bytes.length < 8 || SIG.some((b, i) => bytes[i] !== b)) return no('not a PNG');
  const chunks = chunksOf(bytes);
  if (!Array.isArray(chunks)) return chunks;
  if (chunks[0].type !== 'IHDR') return no('the PNG is not whole');
  const d = chunks[0].data, w = ((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0, h = ((d[4] << 24) | (d[5] << 16) | (d[6] << 8) | d[7]) >>> 0;
  if (w !== W || h !== H || d[8] !== 8 || d[9] !== 2 || d[12] !== 0) return no('not a DIGI card (it is not a 384 × 576 RGB picture)');
  const z = cat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  let raw;
  try { raw = await inflate(z); } catch { return no('the picture data does not decompress'); }
  if (raw.length !== H * (1 + W * 3)) return no('the picture data is the wrong size');
  let px;
  try { px = unfilter(raw, W, H); } catch { return no('the picture data is not a PNG’s'); }
  if (MAGIC.some((b, i) => px[i] !== b)) return no('not a DIGI card (no dossier in its band)');
  const n = (px[3] << 16) | (px[4] << 8) | px[5];
  if (n > CAPACITY) return no('not a DIGI card (no dossier in its band)');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(px.subarray(6, 6 + n)); } catch { return no('the band does not hold text'); }
  const dz = decode(text);
  if (!dz.ok) return no('the band does not hold a dossier: ' + dz.why);
  const want = await pixelsOf(dz.dossier, paint, opts);
  if (!want.ok) return no('the card was refused: ' + want.why);
  const at = px.findIndex((b, i) => b !== want.px[i]);   // the first pixel that is not what this life draws
  if (at !== -1) return no(at < W * BAND * 3 ? 'the band holds more than its dossier' : 'the card’s face does not match what it carries');
  return { ok: true, dossier: dz.dossier, id: want.v.id, owner: want.v.owner, facts: want.facts, v: want.v };
}
