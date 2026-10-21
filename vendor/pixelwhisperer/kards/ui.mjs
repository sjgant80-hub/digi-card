// ui.mjs - PixelWhisperer UI kit: the font, icons and key identicon that a DIGI screen is built from, so the screens and the
// cards are one thing ("the UI is built from the same blocks as the cards").
//
// Built by Kar for the PixelWhisperer repo. Powered by the Konomi architecture, created by Thomas Frumkin.
//
// One source: the card font, dataset icons and star are kardart.mjs's own tables, imported here, never copied. This module adds
// only what a screen needs on top: the punctuation and symbols a label uses, a real space, the dock and action icons, and an
// identicon for an Ed25519 public key. Integer arithmetic only, deterministic, total (bad input is { ok: false, why }).
import { FONT, ICON_ROWS, STAR_ROWS, PIXEL } from './kardart.mjs';

const { span } = PIXEL;
const no = (why) => ({ ok: false, why });

// -- the UI font: the card font, plus what a label needs. A glyph is 5 x 9: caps sit on rows 0-6, descenders fall to 7-8. --
// Same format as kardart's FONT: 'char startRow rows/joined/by/slashes'. No currency signs: a DIGI page shows no prices.
export const UI_EXTRA = Object.freeze([
  ': 2 ..#../...../...../..#..', '/ 0 ....#/....#/...#./..#../.#.../#..../#....', '< 0 ...#./..#../.#.../#..../.#.../..#../...#.',
  '> 0 .#.../..#../...#./....#/...#./..#../.#...', '= 2 #####/...../#####', '+ 1 ..#../..#../#####/..#../..#..',
  '% 0 ##.../##..#/...#./..#../.#.../#..##/...##', '( 0 ...#./..#../.#.../.#.../.#.../..#../...#.', ') 0 .#.../..#../...#./...#./...#./..#../.#...',
  ', 5 ..#../..#../.#...', '" 0 .#.#./.#.#.', '! 0 ..#../..#../..#../..#../..#../...../..#..', '? 0 .###./#...#/....#/...#./..#../...../..#..',
  '_ 7 #####', '| 0 ..#../..#../..#../..#../..#../..#../..#../..#../..#..', '[ 0 .##../.#.../.#.../.#.../.#.../.#.../.##..',
  '] 0 ..##./...#./...#./...#./...#./...#./..##.',
  '\u2019 0 .##../..#../.#...',                                              // right single quote
  '\u00b7 3 ..#..',                                                           // middle dot
  '\u00d7 1 #...#/.#.#./..#../.#.#./#...#',                                   // multiplication sign
  '\u2264 0 ...##/.##../#..../.##../...##/...../#####',                       // less than or equal
  '\u2265 0 ##.../..##./....#/..##./##.../...../#####',                       // greater than or equal
  '\u2192 1 ..#../...#./#####/...#./..#..',                                   // right arrow
  '\u2190 1 ..#../.#.../#####/.#.../..#..',                                   // left arrow
  '\u2713 1 ....#/...##/#.##./###../.#...',                                   // check
  '\u2717 1 ##.##/.###./..#../.###./##.##',                                   // cross (bolder than the multiplication sign)
]);
const rowsOf = (e) => { const r0 = e.charCodeAt(2) - 48, rows = e.slice(4).split('/'); return Object.freeze(span(0, 9).map((i) => rows[i - r0] || '.....')); };
const table = {};
for (const e of FONT) if (e[0] !== '~') table[e[0]] = rowsOf(e);    // '~' is kardart's internal ellipsis; the UI calls it what it is:
table['\u2026'] = rowsOf(FONT.find((e) => e[0] === '~'));            // the horizontal ellipsis
for (const e of UI_EXTRA) table[e[0]] = rowsOf(e);
table[' '] = rowsOf(' 0 .....');                                     // a real space: an empty glyph with the full advance
/** Every UI glyph: char -> 9 rows of 5 cells ('#' on, '.' off). Advance 6 cells (5 + a 1-cell gap); baseline under row 6. */
export const GLYPHS = Object.freeze({ ...table });
/** The characters the UI font draws, in code point order (an object lists digit keys first, so the order lives here). */
export const CHARSET = Object.keys(table).sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0)).join('');
/** Can this string be drawn in the UI font? */
export const drawable = (s) => typeof s === 'string' && Array.from(s).every((ch) => Object.prototype.hasOwnProperty.call(GLYPHS, ch));
const COLOR = /^#[0-9a-f]{6}$/;
const rgbOf = (hex) => Array.from(hex.slice(1)).reduce((v, ch) => v * 16 + HEX.indexOf(ch), 0);
/**
 * Draw a label as pixels, crisp at any whole scale (where a font rasterizer may soften edges, this never does).
 * -> { ok: true, w, h, px: Uint8Array(w*h*4) RGBA, transparent where there is no ink } | { ok: false, why }.
 * scale 1-16; colour and shadow '#rrggbb' (lowercase); the shadow sits one glyph pixel down and right.
 */
export function paintText(text, scale = 2, color = '#ffffff', shadow = null) {
  if (!drawable(text) || Array.from(text).length > 200) return no('the text must be at most 200 characters the UI font draws');
  if (!Number.isInteger(scale) || scale < 1 || scale > 16) return no('scale must be a whole number from 1 to 16');
  if (typeof color !== 'string' || !COLOR.test(color) || (shadow !== null && (typeof shadow !== 'string' || !COLOR.test(shadow)))) return no('colours must be #rrggbb in lowercase hex');
  const chars = Array.from(text), off = shadow === null ? 0 : scale, w = Math.max(1, chars.length * 6 - 1) * scale + off, h = 9 * scale + off, px = new Uint8Array(w * h * 4);
  for (const [c, dx] of (shadow === null ? [] : [[rgbOf(shadow), off]]).concat([[rgbOf(color), 0]])) chars.forEach((ch, n) => GLYPHS[ch].forEach((row, r) => Array.from(row).forEach((cell, q) => {
    if (cell === '#') for (const y of span(0, scale)) for (const x of span(0, scale)) {
      const o = (((r * scale + y + dx) * w) + (n * 6 + q) * scale + x + dx) * 4;
      px[o] = c >> 16; px[o + 1] = (c >> 8) & 255; px[o + 2] = c & 255; px[o + 3] = 255;
    }
  })));
  return { ok: true, w, h, px };
}

// -- icons: 16 x 16 rows of '#' cells, the same style as the dataset icons --------------------------------------------
const I = (...rows) => Object.freeze(rows);
/** The dock (ESTATE ... PROOF) and action (BOOT ... LOCK) icons. */
export const UI_ICONS = Object.freeze({
  estate: I('................', '.......##.......', '......####......', '.....######.....', '....########....', '...##########...', '..############..', '................', '...##########...', '...##########...', '...###....###...', '...###....###...', '...###....###...', '...###....###...', '.##############.', '................'),
  base: I('................', '.##############.', '.#............#.', '.#.##.........#.', '.#............#.', '.#.#####......#.', '.#............#.', '.#.###........#.', '.#............#.', '.##############.', '.......##.......', '.......##.......', '....########....', '................', '................', '................'),
  cards: I('................', '....#########...', '....#.......#...', '.#########..#...', '.#.......#..#...', '.#.#####.#..#...', '.#.#...#.#..#...', '.#.#...#.#..#...', '.#.#####.#..#...', '.#.......#..#...', '.#.......####...', '.#.####..#......', '.#.......#......', '.#########......', '................', '................'),
  evals: I('................', '................', '............##..', '............##..', '........##..##..', '........##..##..', '....##..##..##..', '....##..##..##..', '....##..##..##..', '##..##..##..##..', '##..##..##..##..', '##..##..##..##..', '################', '................', '................', '................'),
  mint: I('................', '.....######.....', '.....######.....', '.......##.......', '.......##.......', '.......##.......', '...##########...', '...##########...', '................', '..#..........#..', '.#.##########.#.', '...#........#...', '...#..####..#...', '...#........#...', '...##########...', '................'),
  mesh: I('................', '..##........##..', '.####......####.', '.####......####.', '..##.#....#.##..', '......#..#......', '.......##.......', '......####......', '......####......', '.......##.......', '......#..#......', '..##.#....#.##..', '.####......####.', '.####......####.', '..##........##..', '................'),
  send: I('................', '................', '.........#......', '.........##.....', '.........###....', '.############...', '.#############..', '.############...', '.........###....', '.........##.....', '.........#......', '................', '.##............#', '.##............#', '.###############', '................'),
  proof: I('................', '.##############.', '.#............#.', '.#..........#.#.', '.#.........##.#.', '.#........##..#.', '.#.#.....##...#.', '.#.##...##....#.', '.#..##.##.....#.', '..#..###.....#..', '..#...#......#..', '...#........#...', '....#......#....', '.....#....#.....', '......####......', '................'),
  boot: I('................', '.......##.......', '.......##.......', '...##..##..##...', '..##...##...##..', '.##....##....##.', '.#.....##.....#.', '.#............#.', '.#............#.', '.##..........##.', '..##........##..', '...##########...', '.....######.....', '................', '................', '................'),
  eval: I('................', '................', '................', '.....######.....', '...##......##...', '..#..........#..', '.#.....#......#.', '.#......#.....#.', '#........#.....#', '#.........##...#', '#.........##...#', '################', '................', '................', '................', '................'),
  train: I('................', '................', '................', '................', '..##........##..', '.###........###.', '.###........###.', '################', '################', '.###........###.', '.###........###.', '..##........##..', '................', '................', '................', '................'),
  breed: I('................', '................', '..####....####..', '.######..######.', '################', '################', '################', '.##############.', '..############..', '...##########...', '....########....', '.....######.....', '......####......', '.......##.......', '................', '................'),
  skin: I('................', '................', '.....######.....', '...##########...', '..##.####.####..', '.##############.', '.###.########.##', '.##############.', '.######...######', '.#####.....#####', '.######...######', '..#############.', '...##########...', '.....######.....', '................', '................'),
  share: I('................', '...........###..', '..........#####.', '..........#####.', '.........#.###..', '.......##.......', '..###.#.........', '.#####..........', '.#####..........', '..###.#.........', '.......##.......', '.........#.###..', '..........#####.', '..........#####.', '...........###..', '................'),
  verify: I('................', '.....######.....', '...##......##...', '..#..........#..', '.#............#.', '.#..........#.#.', '#..........##..#', '#..#......##...#', '#..##....##....#', '#...##..##.....#', '.#...####.....#.', '.#....##......#.', '..#..........#..', '...##......##...', '.....######.....', '................'),
  key: I('................', '................', '................', '................', '.####...........', '#....#..........', '#.##.##########.', '#.##.#.....#.#..', '#....#.....#.#..', '.####...........', '................', '................', '................', '................', '................', '................'),
  lock: I('................', '.....######.....', '....##....##....', '....#......#....', '....#......#....', '..############..', '..############..', '..#####..#####..', '..#####..#####..', '..######.#####..', '..############..', '..############..', '..############..', '................', '................', '................'),
});
/** The dataset icons and the rarity star, from kardart.mjs (the cards draw with these very tables). */
export const DATASET_ICONS = ICON_ROWS;
export const STAR = STAR_ROWS;
/** The dock, in DOCK key order 1-8. */
export const DOCK = Object.freeze(['estate', 'base', 'cards', 'evals', 'mint', 'mesh', 'send', 'proof']);
/** The action icons. */
export const ACTIONS = Object.freeze(['boot', 'eval', 'train', 'breed', 'skin', 'share', 'verify', 'key', 'lock']);

// -- identicon: a key's face, for the YOUR KEY chip and the RIG operator ------------------------------------------------
const HEX = '0123456789abcdef';
const ID_FG = [0xff3ca0, 0xdc32e6, 0x28e6f0, 0x3c78ff, 0x9650ff, 0x3cf0be, 0xaaff46, 0xffe646, 0xff8c3c, 0xff6464, 0xe6c8ff, 0x86ff92, 0xff96d2, 0x78fff0, 0xffd23c, 0x80c4ff];
const ID_ACC = [0xffffff, 0xffd23c, 0x2be8ff, 0xff2bd6, 0x86ff92, 0xff8c3c, 0xdba2ff, 0xffe680];
const ID_BG = [0x0e0420, 0x120626, 0x14141a, 0x0b1240];
const hexc = (c) => '#' + (c + 0x1000000).toString(16).slice(1);
const swirl = (x, k) => { let t = Math.imul(x ^ k, 0x85ebca6b); t ^= t >>> 15; t = Math.imul(t, 0xc2b2ae35); return (t ^ (t >>> 13)) >>> 0; };
/**
 * An Ed25519 public key (64 lowercase hex characters) as a 10 x 10 pixel face: an 8 x 8 mirrored pattern inside a border.
 * -> { ok: true, size: 10, cells: Uint8Array(100) (0 background, 1 colour, 2 accent, 3 border), colors: { bg, fg, accent, border }
 *    as '#rrggbb', px: Uint8Array((10*scale)^2 * 3) RGB rows } | { ok: false, why }. Every bit of the key is folded in.
 */
export function identicon(pubHex, scale = 1) {
  if (typeof pubHex !== 'string' || pubHex.length !== 64 || !Array.from(pubHex).every((ch) => HEX.indexOf(ch) >= 0)) return no('the key must be 64 lowercase hex characters');
  if (!Number.isInteger(scale) || scale < 1 || scale > 32) return no('scale must be a whole number from 1 to 32');
  let a = 0x9e3779b9, b = 0x7f4a7c15, c = 0x1b873593;
  for (const w of span(0, 8)) {   // eight 32-bit words, each folded into three running hashes
    const word = Array.from(pubHex.slice(w * 8, w * 8 + 8)).reduce((v, ch) => v * 16 + HEX.indexOf(ch), 0);
    a = swirl(a ^ word, 0x2545f491); b = swirl(b ^ word, a); c = swirl(c ^ word, b);
  }
  const fg = ID_FG[b & 15], acc = ID_ACC[(b >>> 4) & 7], bg = ID_BG[(b >>> 7) & 3], border = PIXEL.mul(fg, 112);
  const cells = new Uint8Array(100);
  for (const y of span(0, 10)) for (const x of span(0, 10)) {
    const inner = x > 0 && x < 9 && y > 0 && y < 9, cx = x < 5 ? x - 1 : 8 - x, bit = (y - 1) * 4 + cx;
    cells[y * 10 + x] = inner ? ((a >>> bit) & 1 ? 1 + ((c >>> bit) & (c >>> (31 - bit)) & 1) : 0) : 3;
  }
  const col = [bg, fg, acc, border], side = 10 * scale, px = new Uint8Array(side * side * 3);
  for (const y of span(0, side)) for (const x of span(0, side)) {
    const k = col[cells[PIXEL.div(y, scale) * 10 + PIXEL.div(x, scale)]], o = (y * side + x) * 3;
    px[o] = k >> 16; px[o + 1] = (k >> 8) & 255; px[o + 2] = k & 255;
  }
  return { ok: true, size: 10, cells, colors: { bg: hexc(bg), fg: hexc(fg), accent: hexc(acc), border: hexc(border) }, px };
}
