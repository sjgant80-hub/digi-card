// kardpng.mjs — a tiny deterministic PNG writer for PixelWhisperer Kards previews.
//
// Written by Kar (the estate's resident builder) for the PixelWhisperer repo. It turns the RGB bytes kardart.mjs paints
// into an ordinary PNG: stored (uncompressed) deflate blocks, CRC-32 per chunk, Adler-32 for the zlib stream. Nothing
// here depends on the platform's zlib, so the same pixels make the same file byte for byte in a browser or on CI.
// The chunk discipline follows living-seed's card.mjs (cardOf / zlibStored), re-made small.
const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const no = (why) => ({ ok: false, why });

const CRC = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
/** CRC-32 (IEEE), PNG's chunk checksum. */
export function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/** Adler-32, zlib's stream checksum. */
export function adler32(bytes) { let a = 1, b = 0; for (const x of bytes) { a = (a + x) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; }
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

function cat(parts) {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  parts.reduce((at, p) => { out.set(p, at); return at + p.length; }, 0);
  return out;
}
function chunk(type, data) {
  const body = cat([new Uint8Array(ascii(type)), data]);
  return cat([new Uint8Array(u32(data.length)), body, new Uint8Array(u32(crc32(body)))]);
}

/** A zlib stream of uncompressed (stored) deflate blocks: deterministic, readable by any inflater. */
export function zlibStored(raw) {
  const parts = [new Uint8Array([0x78, 0x01])];
  let at = 0;
  do {
    const part = raw.subarray(at, at + 65535), last = at + 65535 >= raw.length;
    parts.push(new Uint8Array([last ? 1 : 0, part.length & 255, part.length >>> 8, ~part.length & 255, (~part.length >>> 8) & 255]), part);
    at += 65535;
  } while (at < raw.length);
  parts.push(new Uint8Array(u32(adler32(raw))));
  return cat(parts);
}

/** px: Uint8Array(w*h*3) of RGB rows top to bottom. → { ok: true, png: Uint8Array } | { ok: false, why }. Deterministic. */
export function pngOf(px, w, h) {
  if (!(px instanceof Uint8Array)) return no('pixels must be a Uint8Array');
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 65535 || h > 65535) return no('size must be whole numbers from 1 to 65535');
  if (px.length !== w * h * 3) return no('pixels must be exactly width x height x 3 bytes');
  const raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) raw.set(px.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);   // filter byte 0 per row
  const ihdr = new Uint8Array([...u32(w), ...u32(h), 8, 2, 0, 0, 0]);
  return { ok: true, png: cat([new Uint8Array(SIG), chunk('IHDR', ihdr), chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0))]) };
}
