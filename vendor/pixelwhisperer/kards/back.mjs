// back.mjs - PixelWhisperer Kards: the back of a Kardlings card. Every card game has a back; a Kardlings card's carries the maker's
// mark, so a maker's cards are known face down.
//
// Built by Kar for the PixelWhisperer repo. Powered by the Konomi architecture, created by Thomas Frumkin.
//
// A back is the card's own size (192 x 280 logical pixels, the card's 384 x 560 at 2 x) in every theme: the theme's
// field and frame, the game's emblem (a K, for Kardlings), the maker's mark (the identicon of the maker's Ed25519 public key, in a medallion, with
// the key written short beneath) and the card's edition number. The field's scatter (stars, ore, clouds, confetti) is
// thrown with the maker's dice, so one maker's backs match and another maker's differ. Integer arithmetic only,
// deterministic, total: bad input is { ok: false, why }, never a throw. One source: the canvas and themes come from
// kardart.mjs, the lettering and the identicon from ui.mjs.
import { PIXEL, THEMES } from './kardart.mjs';
import { GLYPHS, identicon } from './ui.mjs';

const { newCanvas, rect, dot, at, mul, mix, rng, span, div, hash3, PAD } = PIXEL;
const no = (why) => ({ ok: false, why });
const HEX = '0123456789abcdef';
const LW = 192, LH = 280;

/** Check a back. back: { maker?: the maker's Ed25519 public key (64 lowercase hex), serial?: the edition number, 0-999999 }.
 *  -> { ok: true, b: { maker, serial } (null where not given) } | { ok: false, why } */
export function checkBack(x) {
  try {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) return no('the back must be an object');
    const { maker = null, serial = null } = x;
    if (maker !== null && (typeof maker !== 'string' || maker.length !== 64 || !Array.from(maker).every((c) => HEX.includes(c)))) return no('the maker must be a public key of 64 lowercase hex characters');
    if (serial !== null && (!Number.isInteger(serial) || serial < 0 || serial > 999999)) return no('serial must be a whole number from 0 to 999999');
    return { ok: true, b: { maker, serial } };
  } catch (e) { return no('the back could not be read'); }
}

// how each theme dresses a back: the field (top and bottom), the frame's three rings, the emblem's fill, edge and ink, the
// lettering and its shadow, the quieter lettering, and the theme's own pattern
const LOOKS = {
  'synthwave-v1': { field: [0x0a0420, 0x82157c], frame: [0x080212, 0xb04ae0, 0xff2bd6], emblem: [0xff2bd6, 0x2be8ff, 0xffffff], text: 0xffffff, shadow: 0x4a1480, dim: 0xbff8ff, night: [0xbff8ff, 0xff2bd6] },
  'blockcraft-v1': { field: [0x6fb4ff, 0x6fb4ff], frame: [0x16161c, 0x9a9aa8, 0xd8dce4], emblem: [0xf0c84a, 0x8a5a33, 0x14141a], text: 0xffffff, shadow: 0x14141a, dim: 0xd8dce4, blocks: [0x5fb83a, 0x8a5a33, 0x84848c] },
  'lcd-v1': { field: [0xd8dccf, 0xd8dccf], frame: [0x0f1210, 0x4a5048, 0x9aa095], emblem: [0x4a5048, 0x0f1210, 0xd8dccf], text: 0x0f1210, shadow: 0xd8dccf, dim: 0x4a5048, screen: true },
  'memphis-v1': { field: [0xffe14a, 0xffe14a], frame: [0x111111, 0xff4fa3, 0xffffff], emblem: [0xff4fa3, 0x111111, 0xffffff], text: 0x111111, shadow: 0xffffff, dim: 0x111111, confetti: [0x111111, 0xffffff, 0xff4fa3, 0x2d9cff], drop: 0x111111 },
  'blueprint-v1': { field: [0x0e3b78, 0x0e3b78], frame: [0x061a38, 0x3468b0, 0xeef5ff], emblem: [0x0e3b78, 0xeef5ff, 0xeef5ff], text: 0xeef5ff, shadow: 0x061a38, dim: 0x9cc3f0, paper: [0x1c4f92, 0x3468b0], ink: [0x061a38, 0x3468b0, 0x9cc3f0, 0xeef5ff] },
};
const LCD = [0x0f1210, 0x4a5048, 0x9aa095, 0xd8dccf];   // the pocket screen's four shades, darkest first
const BAY = [0, 128, 32, 160, 192, 64, 224, 96, 48, 176, 16, 144, 240, 112, 208, 80];   // a 4 x 4 ordered-dither matrix, scaled to 0..255
const ZIG = [0, 1, 2, 1];                                  // a zigzag's rise, step by step

function letters(cv, s, x, y, c, sh, k = 1) {   // UI-font lettering, k pixels a cell, its shadow k down and right
  for (const [col, off] of [[sh, k], [c, 0]]) Array.from(s).forEach((ch, n) => (GLYPHS[ch] || GLYPHS[' ']).forEach((row, r) => Array.from(row).forEach((cell, q) => { if (cell === '#') rect(cv, x + (n * 6 + q) * k + off, y + r * k + off, k, k, col); })));
}
const centred = (cv, s, y, c, sh, k = 1) => letters(cv, s, div(LW - (s.length * 6 - 1) * k, 2), y, c, sh, k);

function field(cv, L, r) {   // the theme's ground inside the frame, its scatter thrown with the maker's dice
  for (const y of span(8, LH - 8)) rect(cv, 8, y, LW - 16, 1, mix(L.field[0], L.field[1], div((y - 8) * 256, LH - 16)));
  if (L.night) {   // a neon night: stars above, a grid running to the horizon below
    for (const n of span(0, 60)) dot(cv, 10 + r(LW - 20), 10 + r(150), L.night[0]);
    for (const y of [186, 194, 205, 219, 236, 256]) rect(cv, 8, y, LW - 16, 1, L.night[1]);
    for (const m of span(0, 13)) { const a = (m - 6) * 6, b = (m - 6) * 30; for (const t of span(0, 92)) dot(cv, 96 + a + div((b - a) * t, 92), 180 + t, L.night[1]); }
  }
  if (L.blocks) {   // a wall of blocks built up from the bottom of the field: stone, dirt, a row of grass; ore in the stone, clouds in the sky
    for (const k of span(0, 11)) for (const bx of span(0, 11)) {
      const y = LH - 24 - k * 16, x = 8 + bx * 16, kind = k === 10 ? 0 : k > 6 ? 1 : 2;
      for (const q of span(0, 256)) dot(cv, x + (q % 16), y + div(q, 16), mul(L.blocks[kind], 216 + hash3(x + (q % 16), y + div(q, 16), kind) * 14));
      if (kind === 2 && r(4) === 0) for (const q of span(0, 5)) rect(cv, x + 3 + r(9), y + 3 + r(9), 2, 2, [0x50e6e6, 0xfac832, 0xdc3c32][r(3)]);
    }
    for (const n of span(0, 3)) { const x = 10 + r(130), y = 18 + r(24); rect(cv, x, y, 34, 6, 0xffffff); rect(cv, x + 6, y - 5, 20, 5, 0xffffff); }
  }
  if (L.screen) for (const y of span(8, LH - 8)) for (const x of span(8, LW - 8)) {   // the screen's glow, ordered-dithered from its lightest shade to the next
    dot(cv, x, y, div((y - 8) * 256, LH - 16) > BAY[(y % 4) * 4 + (x % 4)] ? LCD[2] : LCD[3]);
  }
  if (L.confetti) for (const n of span(0, 40)) {   // terrazzo: squares, slashes and zigzags
    const x = 12 + r(LW - 30), y = 12 + r(LH - 30), c = L.confetti[r(4)], k = r(3);
    if (k === 0) rect(cv, x, y, 4, 4, c);
    if (k === 1) for (const q of span(0, 8)) rect(cv, x + q, y + q, 3, 1, c);
    if (k === 2) for (const q of span(0, 12)) rect(cv, x + q, y + ZIG[q % 4], 1, 2, c);
  }
  if (L.paper) {   // grid paper: a line every 8 pixels, every fifth one heavier
    for (const x of span(12, LW - 8, 8)) rect(cv, x, 8, 1, LH - 16, (x - 12) % 40 ? L.paper[0] : L.paper[1]);
    for (const y of span(12, LH - 8, 8)) rect(cv, 8, y, LW - 16, 1, (y - 12) % 40 ? L.paper[0] : L.paper[1]);
  }
}

function emblem(cv, L) {   // the game's mark: a diamond 120 wide and 88 high, edged, a K for Kardlings in the middle
  const [fill, edge, ink] = L.emblem;
  for (const [off, c] of L.drop ? [[4, L.drop], [0, 0]] : [[0, 0]]) for (const y of span(44, 133)) for (const x of span(36, 157)) {
    const d = Math.abs(x - 96) * 44 + Math.abs(y - 88) * 60;
    if (d <= 2640) dot(cv, x + off, y + off, off ? c : d > 2400 ? edge : fill);
  }
  centred(cv, 'K', 71, ink, edge, 5);
}

/**
 * Draw a card's back. back as checkBack takes it; themeId one of THEMES; w, h whole numbers from 64 to 1024 (a Kardlings card:
 * 384 x 560). -> { ok: true, px: Uint8Array(w*h*3) RGB rows } | { ok: false, why }. Never throws.
 */
export function paintBack(back, themeId, w, h) {
  try {
    const c = checkBack(back);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return no('unknown theme');
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 64 || h < 64 || w > 1024 || h > 1024) return no('width and height must be whole numbers from 64 to 1024');
    const B = c.b, L = LOOKS[themeId], cv = newCanvas(LW, LH);
    const seed = B.maker ? Array.from(B.maker.slice(0, 16)).reduce((a, ch) => Math.imul(a ^ HEX.indexOf(ch), 0x9e3779b1) >>> 0, 0x2545f491) : 0x51ed270b;
    const r = rng(seed, 7);   // the maker's dice: the same maker throws the same scatter, whatever the edition
    L.frame.forEach((col, i) => rect(cv, i * 2, i * 2, LW - i * 4, LH - i * 4, col));
    field(cv, L, r);
    rect(cv, 8, 8, LW - 16, 1, L.frame[2]); rect(cv, 8, LH - 9, LW - 16, 1, L.frame[2]); rect(cv, 8, 8, 1, LH - 16, L.frame[2]); rect(cv, LW - 9, 8, 1, LH - 16, L.frame[2]);
    centred(cv, 'KARDLINGS', 16, L.text, L.shadow, 2);
    emblem(cv, L);
    rect(cv, 64, 151, 64, 76, L.frame[0]); rect(cv, 66, 153, 60, 72, L.frame[1]); rect(cv, 68, 155, 56, 68, L.frame[0]);   // the maker's medallion
    centred(cv, B.maker ? 'MADE BY' : 'UNSIGNED', 140, L.dim, L.shadow);
    if (B.maker) {   // the maker's identicon, in the theme's inks where it keeps a palette of its own
      const id = identicon(B.maker, 5), ink = (q) => (L.ink ? L.ink[(id.px[q] * 77 + id.px[q + 1] * 150 + id.px[q + 2] * 29) >> 14] : (id.px[q] << 16) | (id.px[q + 1] << 8) | id.px[q + 2]);
      for (const q of span(0, 2500)) dot(cv, 71 + (q % 50), 158 + div(q, 50), ink(q * 3));
      centred(cv, B.maker.slice(0, 4) + '\u2026' + B.maker.slice(60), 211, L.frame[2], L.frame[0]);
    } else for (const q of span(0, 7)) rect(cv, 75 + q * 6, 187 + ZIG[q % 4], 4, 4, L.frame[1]);   // no mark: a broken line where it would be
    if (B.serial !== null) centred(cv, 'NO ' + String(1000000 + B.serial).slice(1), LH - 26, L.text, L.shadow, 2);
    if (L.screen) for (const y of span(0, LH)) for (const x of span(0, LW)) {   // the pocket screen: every pixel one of its four shades
      const q = at(cv, x, y);
      dot(cv, x, y, LCD[(((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 14]);
    }
    const px = new Uint8Array(w * h * 3), cols = span(0, w).map((x) => div(x * LW, w));   // nearest pixel, as a face is scaled
    span(0, h).forEach((y) => {
      const row = (div(y * LH, h) + PAD) * cv.cw + PAD;
      cols.forEach((cx, x) => { const q = cv.d[row + cx], o = (y * w + x) * 3; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; });
    });
    return { ok: true, px };
  } catch (e) { return no('the back could not be painted'); }
}
