// gear.mjs - PixelWhisperer Gear: a card's kit slots, drawn from what is in them and nothing else, so the same kit gives the
// same picture.
//
// Built by Kar for the PixelWhisperer repo. Powered by the Konomi architecture, created by Thomas Frumkin.
//
// A card fields NODE slots (another of its owner's cards, coupled with it) and TOOL slots (an app item). paintSlot draws one
// slot on a 56 x 64 tile, readable at phone size: empty, a dashed well; a node, the card's creature framed in its rarity with its measured
// worth on GATE in millionths (+19,727), or dimmed and hatched when it is not joined; a tool, the app's portrait framed in
// its tier. kitBadge is the small overlay a card wears to say how many of its node slots are fielded. Integer arithmetic
// only, deterministic, total: bad input is { ok: false, why }, never a throw. One source: the canvas, palettes and
// portraits come from kardart.mjs, the lettering from ui.mjs.
import { RARITIES, TIERS, RAR, PIXEL, THEMES, creatureFront, itemFront } from './kardart.mjs';
import { GLYPHS } from './ui.mjs';

const { newCanvas, rect, dot, at, mul, span, div, PAD } = PIXEL;
const no = (why) => ({ ok: false, why });
const HEX = '0123456789abcdef';
const isId = (s) => typeof s === 'string' && s.length === 16 && Array.from(s).every((c) => HEX.indexOf(c) >= 0);
const whole = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
const thing = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The two kinds of kit slot. */
export const SLOT_KINDS = Object.freeze(['node', 'tool']);

/**
 * Check a slot. slot: { kind: 'node' | 'tool', card?: { id, rarity } (a node's card), item?: { id, tier } (a tool's app item),
 * worth?: whole millionths of GATE from -999999 to 999999 (default 0), joined?: bool (default true) }. With neither a card nor
 * an item the slot is empty; worth and joined describe a node with a card in it. -> { ok: true, s } | { ok: false, why }
 */
export function checkSlot(x) {
  try {
    if (!thing(x)) return no('the slot must be an object');
    const { kind, card, item, worth, joined } = x;
    if (SLOT_KINDS.indexOf(kind) < 0) return no('kind must be node or tool');
    if ((kind === 'node' && item !== undefined) || (kind === 'tool' && card !== undefined)) return no('a node slot holds a card, a tool slot an item');
    if (card === undefined && (worth !== undefined || joined !== undefined)) return no('worth and joined describe a node with a card in it');
    if (card !== undefined) {
      if (!thing(card)) return no('the card must be an object');
      const ri = RARITIES.indexOf(card.rarity);
      if (!isId(card.id)) return no('the card id must be 16 lowercase hex characters');
      if (ri < 0) return no('the card rarity must be one of ' + RARITIES.join(', '));
      const w = worth === undefined ? 0 : worth, j = joined === undefined ? true : joined;
      if (!Number.isInteger(w) || w < -999999 || w > 999999) return no('worth must be a whole number of millionths from -999999 to 999999');
      if (typeof j !== 'boolean') return no('joined must be true or false');
      return { ok: true, s: { kind, card: { id: card.id, rarity: card.rarity, ri }, worth: w, joined: j } };
    }
    if (item !== undefined) {
      if (!thing(item)) return no('the item must be an object');
      const ti = TIERS.indexOf(item.tier);
      if (!isId(item.id)) return no('the item id must be 16 lowercase hex characters');
      if (ti < 0) return no('the item tier must be one of ' + TIERS.join(', '));
      return { ok: true, s: { kind, item: { id: item.id, tier: item.tier, ti } } };
    }
    return { ok: true, s: { kind } };
  } catch (e) { return no('the slot could not be read'); }
}

/** A worth in millionths as it is read: a sign and thousands separators (+19,727, -39,000, 0). */
export function worthText(w) {
  if (!Number.isInteger(w) || w < -999999 || w > 999999) return null;
  const n = Math.abs(w), head = div(n, 1000), body = head ? head + ',' + String(1000 + (n % 1000)).slice(1) : String(n);
  return (w > 0 ? '+' : w < 0 ? '-' : '') + body;
}

// how each theme dresses a slot (pocket-screen colours sit on its four shades: black, 0x555555, 0xaaaaaa, white)
const LOOKS = {
  'synthwave-v1': { bg: 0x120626, well: 0x0e0420, text: 0xffffff, shadow: 0x4a1480, dim: 0x9c84c8, good: 0x86ff92, bad: 0xff7a8a, off: 0x5a4a7a, ink: 'hi' },
  'blockcraft-v1': { bg: 0x3c3c46, well: 0x1c1c22, text: 0xffffff, shadow: 0x14141a, dim: 0x9a9aa8, good: 0x86ff92, bad: 0xff7a8a, off: 0x6e6e78, ink: 'hi' },
  'lcd-v1': { bg: 0x555555, well: 0x000000, text: 0xffffff, shadow: 0x000000, dim: 0xaaaaaa, good: 0xffffff, bad: 0xaaaaaa, off: 0xaaaaaa, ink: 'hi', lcd: [0x0f1210, 0x4a5048, 0x9aa095, 0xd8dccf] },
  'memphis-v1': { bg: 0xfff1d6, well: 0x1b1740, text: 0x111111, shadow: 0xffffff, dim: 0x5a5a64, good: 0x16a34a, bad: 0xdc2626, off: 0x9aa3b2, ink: 'lo' },
  'blueprint-v1': { bg: 0x0e3b78, well: 0x061a38, text: 0xeef5ff, shadow: 0x061a38, dim: 0x9cc3f0, good: 0x7ff0ff, bad: 0xff7a5a, off: 0x3468b0, ink: 'hi', ramp: [0x0e3b78, 0x3468b0, 0x9cc3f0, 0xeef5ff] },
};
const inked = (L, c) => (L.ramp ? L.ramp[(((c >> 16) & 255) * 77 + ((c >> 8) & 255) * 150 + (c & 255) * 29) >> 14] : c);   // a drawing inks every colour in one of four blues, by brightness
const BAY = [0, 128, 32, 160, 192, 64, 224, 96, 48, 176, 16, 144, 240, 112, 208, 80];
const TW = 56, TH = 64, TIER_WORD = { prototype: 'PROTO', works: 'WORKS', proven: 'PROVEN' };

function letters(cv, s, x, y, c, sh, k = 1) {
  for (const [col, off] of [[sh, k], [c, 0]]) Array.from(s).forEach((ch, n) => (GLYPHS[ch] || GLYPHS[' ']).forEach((row, r) => Array.from(row).forEach((cell, q) => { if (cell === '#') rect(cv, x + (n * 6 + q) * k + off, y + r * k + off, k, k, col); })));
}
const centred = (cv, s, y, c, sh, k = 1) => letters(cv, s, div(TW - (s.length * 6 - 1) * k, 2), y, c, sh, k);

/**
 * Draw a slot. slot as checkSlot takes it; themeId one of THEMES; w, h whole numbers from 32 to 2048. The slot is a 56 x 64
 * pixel-art tile at the largest whole scale that fits, centred. -> { ok: true, px: Uint8Array(w*h*3) RGB rows, scale: k } |
 * { ok: false, why }. Never throws.
 */
export function paintSlot(slot, themeId, w, h) {
  try {
    const c = checkSlot(slot);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return no('unknown theme');
    if (!whole(w, 2048) || !whole(h, 2048) || w < 32 || h < 32) return no('width and height must be whole numbers from 32 to 2048');
    const S = c.s, L = LOOKS[themeId], k = Math.max(1, Math.min(div(w, TW), div(h, TH))), lw = div(w + k - 1, k), lh = div(h + k - 1, k);
    const FW = Math.max(TW, lw), FH = Math.max(TH, lh), full = newCanvas(FW, FH);
    rect(full, 0, 0, FW, FH, L.bg);
    const cv = { cw: full.cw, d: full.d.subarray(div(FH - TH, 2) * full.cw + div(FW - TW, 2)) };   // the tile, centred on the same pixels
    const held = S.card || S.item, p = held ? RAR[S.card ? S.card.ri : S.item.ti] : null, ring = held ? (S.card && !S.joined ? L.off : p.hi) : L.dim;
    rect(cv, 0, 0, TW, TH, 0x000000); rect(cv, 1, 1, TW - 2, TH - 2, ring); rect(cv, 2, 2, TW - 4, TH - 4, held ? p.lo : L.bg); rect(cv, 3, 3, TW - 6, TH - 6, L.bg);
    if (!held) for (const x of span(4, TW - 4, 4)) { dot(cv, x, 1, L.bg); dot(cv, x, TH - 2, L.bg); }   // an empty slot's frame is dashed
    if (!held) for (const y of span(4, TH - 4, 4)) { dot(cv, 1, y, L.bg); dot(cv, TW - 2, y, L.bg); }
    centred(cv, S.kind.toUpperCase(), 4, held ? L.text : L.dim, L.shadow);
    rect(cv, 12, 15, 32, 34, L.well);   // the well a portrait sits in
    if (held) {
      const fr = S.card ? creatureFront(S.card.id) : itemFront('app', S.item.id), dim = S.card && !S.joined;
      for (const q of span(0, 126)) if (fr.px[q * 4 + 3]) { const col = (fr.px[q * 4] << 16) | (fr.px[q * 4 + 1] << 8) | fr.px[q * 4 + 2]; rect(cv, 19 + (q % 9) * 2, 18 + div(q, 9) * 2, 2, 2, inked(L, dim ? mul(col, 110) : col)); }
      if (dim) for (const n of span(0, 16)) for (const q of span(0, 34)) if ((q + n * 4) % 8 === 0) dot(cv, 12 + n * 2, 15 + q, L.off);   // not joined: hatched over
      const word = S.card ? (S.joined ? worthText(S.worth) : 'UNJOINED') : TIER_WORD[S.item.tier], tone = S.card ? (!S.joined ? L.dim : S.worth > 0 ? L.good : S.worth < 0 ? L.bad : L.dim) : p[L.ink];
      centred(cv, word, 52, tone, L.shadow);
    } else {   // empty: a dashed well and a plus
      for (const x of span(12, 44, 3)) { dot(cv, x, 15, L.dim); dot(cv, x, 48, L.dim); }
      for (const y of span(15, 49, 3)) { dot(cv, 12, y, L.dim); dot(cv, 43, y, L.dim); }
      rect(cv, 27, 26, 2, 12, L.dim); rect(cv, 22, 31, 12, 2, L.dim);
      centred(cv, 'EMPTY', 52, L.dim, L.shadow);
    }
    if (L.lcd) for (const y of span(0, FH)) for (const x of span(0, FW)) {   // the pocket screen: four shades, ordered dither
      const q = at(full, x, y), v = (((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 8, s3 = v * 3;
      dot(full, x, y, L.lcd[(s3 >> 8) + ((s3 & 255) > BAY[((y & 3) << 2) + (x & 3)] ? 1 : 0)]);
    }
    const sx = div(FW - lw, 2), sy = div(FH - lh, 2), px = new Uint8Array(w * h * 3);
    span(0, h).forEach((y) => {
      const row = (div(y, k) + sy + PAD) * full.cw + PAD + sx;
      span(0, w).forEach((x) => { const q = full.d[row + div(x, k)], o = (y * w + x) * 3; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; });
    });
    return { ok: true, px, scale: k };
  } catch (e) { return no('the slot could not be painted'); }
}

/**
 * The kitted overlay: how many of a card's node slots are fielded, as a row of pips on a dark pill, to lay over a card.
 * fielded 0..slots, slots 2..4, scale 1..16. -> { ok: true, w, h, px: RGBA } | { ok: false, why }
 */
export function kitBadge(fielded, slots, scale = 1) {
  if (!Number.isInteger(slots) || slots < 2 || slots > 4) return no('slots must be a whole number from 2 to 4');
  if (!whole(fielded, slots)) return no('fielded must be a whole number from 0 to the slots');
  if (!Number.isInteger(scale) || scale < 1 || scale > 16) return no('scale must be a whole number from 1 to 16');
  const W = slots * 5 + 3, H = 9, cells = new Uint32Array(W * H), put = (x, y, ww, hh, c) => { for (const yy of span(y, y + hh)) for (const xx of span(x, x + ww)) cells[yy * W + xx] = c; };
  put(0, 0, W, H, 0xffffff); put(1, 1, W - 2, H - 2, 0x0e0420);
  for (const n of span(0, slots)) { const x = 3 + n * 5; if (n < fielded) put(x, 2, 3, 5, 0x2be8ff); else { put(x, 2, 3, 5, 0x4a4e5c); put(x + 1, 3, 1, 3, 0x0e0420); } }
  const w = W * scale, h = H * scale, px = new Uint8Array(w * h * 4);
  for (const y of span(0, h)) for (const x of span(0, w)) { const q = cells[div(y, scale) * W + div(x, scale)], o = (y * w + x) * 4; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; px[o + 3] = 255; }
  return { ok: true, w, h, px };
}
