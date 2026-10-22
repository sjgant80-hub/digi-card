// hero.mjs - PixelWhisperer Hero: a hero's plate, drawn from its record and nothing else, so the same hero gives the same
// picture.
//
// Built by Kar for the PixelWhisperer repo. Powered by the Konomi architecture, created by Thomas Frumkin.
//
// A Kardling hero is one of its player's cards, crowned. paintHero draws its plate on a 192 x 60 tile: the crest of its
// business (the dataset icon the cards wear) under a crown, its name, its class, and six gems for the six steps of its level,
// each lit or not as the hero's own record says (a level is how many are lit; they light in any order). HERO_ICON is the
// crown alone, for a dock. Integer arithmetic only, deterministic, total: bad input is { ok: false, why }, never a throw.
// One source: the canvas, palettes and dataset icons come from kardart.mjs, the lettering from ui.mjs.
import { PIXEL, THEMES, ICON_ROWS } from './kardart.mjs';
import { GLYPHS } from './ui.mjs';

const { newCanvas, rect, dot, at, span, div, PAD } = PIXEL;
const no = (why) => ({ ok: false, why });
const whole = (n, max) => Number.isInteger(n) && n <= max;   // the floor is the size check's own (48)
const thing = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The businesses a hero can be of (the dataset icons, without the owner's own table). */
export const HERO_SETS = Object.freeze(Object.keys(ICON_ROWS).filter((k) => k !== 'custom'));
/** The steps a hero's level lights. */
export const HERO_STEPS = 6;
/** The longest name or class a plate letters. */
export const HERO_TEXT = 22;
/** The crown, 16 x 16 rows of '#' cells in the dock icons' style. */
export const HERO_ICON = Object.freeze(['................', '................', '.#.....##.....#.', '.##...####...##.', '.###.######.###.', '.##############.', '.##############.',
  '.#.##.##.##.#.#.', '.##############.', '.##############.', '..############..', '................', '..############..', '..############..', '................', '................']);

const CROWN = ['#....#....#', '##..###..##', '###########', '#.#.#.#.#.#', '###########', '###########'];
const GEM = ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'];
const TW = 192, TH = 60;
const sayable = (s) => typeof s === 'string' && s.length > 0 && s.length <= HERO_TEXT && s.trim() === s && Array.from(s).every((ch) => Object.prototype.hasOwnProperty.call(GLYPHS, ch));

/**
 * Check a hero's plate. hero: { name, title (its class), set (one of HERO_SETS), lit: HERO_STEPS booleans }; name and title
 * 1 to HERO_TEXT characters the UI font draws (lettered in capitals), no space at either end. The level is how many are lit.
 * -> { ok: true, h: { name, title, set, lit, level } } | { ok: false, why }
 */
export function checkHero(x) {
  try {
    if (!thing(x)) return no('the hero must be an object');
    const { name, title, set, lit } = x;
    if (!sayable(name)) return no('the name must be 1 to ' + HERO_TEXT + ' characters the font draws, with no space at either end');
    if (!sayable(title)) return no('the class must be 1 to ' + HERO_TEXT + ' characters the font draws, with no space at either end');
    if (HERO_SETS.indexOf(set) < 0) return no('the business must be one of ' + HERO_SETS.join(', '));
    if (!Array.isArray(lit) || lit.length !== HERO_STEPS || !lit.every((b) => typeof b === 'boolean')) return no('lit must be ' + HERO_STEPS + ' true or false values');
    return { ok: true, h: { name, title, set, lit: lit.slice(), level: lit.filter((b) => b).length } };
  } catch (e) { return no('the hero could not be read'); }
}

// how each theme dresses a plate (pocket-screen colours sit on its four shades: black, 0x555555, 0xaaaaaa, white)
const LOOKS = {
  'synthwave-v1': { bg: 0x120626, well: 0x0e0420, text: 0xffffff, shadow: 0x4a1480, dim: 0x9c84c8, gold: 0xffd23c, gem: 0x2be8ff, off: 0x5a4a7a, crest: 0xff3ca0 },
  'blockcraft-v1': { bg: 0x3c3c46, well: 0x1c1c22, text: 0xffffff, shadow: 0x14141a, dim: 0x9a9aa8, gold: 0xffe646, gem: 0x86ff92, off: 0x6e6e78, crest: 0xaaff46 },
  'lcd-v1': { bg: 0x555555, well: 0x000000, text: 0xffffff, shadow: 0x000000, dim: 0xaaaaaa, gold: 0xffffff, gem: 0xffffff, off: 0xaaaaaa, crest: 0xaaaaaa, lcd: [0x0f1210, 0x4a5048, 0x9aa095, 0xd8dccf] },
  'memphis-v1': { bg: 0xfff1d6, well: 0x1b1740, text: 0x111111, shadow: 0xffffff, dim: 0x5a5a64, gold: 0xf59e0b, gem: 0x0ea5e9, off: 0x9aa3b2, crest: 0xec4899 },
  'blueprint-v1': { bg: 0x0e3b78, well: 0x061a38, text: 0xeef5ff, shadow: 0x061a38, dim: 0x9cc3f0, gold: 0xeef5ff, gem: 0x7ff0ff, off: 0x3468b0, crest: 0x9cc3f0 },
};
const BAY = [0, 128, 32, 160, 192, 64, 224, 96, 48, 176, 16, 144, 240, 112, 208, 80];
function letters(cv, s, x, y, c, sh) {
  for (const [col, off] of [[sh, 1], [c, 0]]) Array.from(s).forEach((ch, n) => GLYPHS[ch].forEach((row, r) => Array.from(row).forEach((cell, q) => { if (cell === '#') dot(cv, x + n * 6 + q + off, y + r + off, col); })));
}
const shape = (cv, rows, x, y, c, k = 1) => rows.forEach((row, r) => Array.from(row).forEach((cell, q) => { if (cell === '#') rect(cv, x + q * k, y + r * k, k, k, c); }));

/**
 * Draw a hero's plate. hero as checkHero takes it; themeId one of THEMES; w, h whole numbers from 48 to 2048. The plate is a
 * 192 x 60 pixel-art tile at the largest whole scale that fits, centred. -> { ok: true, px: Uint8Array(w*h*3) RGB rows,
 * scale: k, level } | { ok: false, why }. Never throws.
 */
export function paintHero(hero, themeId, w, h) {
  try {
    const c = checkHero(hero);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return no('unknown theme');
    if (!whole(w, 2048) || !whole(h, 2048) || w < 48 || h < 48) return no('width and height must be whole numbers from 48 to 2048');
    const H = c.h, L = LOOKS[themeId], k = Math.max(1, Math.min(div(w, TW), div(h, TH))), lw = div(w + k - 1, k), lh = div(h + k - 1, k);
    const FW = Math.max(TW, lw), FH = Math.max(TH, lh), full = newCanvas(FW, FH);
    rect(full, 0, 0, FW, FH, L.bg);
    const cv = { cw: full.cw, d: full.d.subarray(div(FH - TH, 2) * full.cw + div(FW - TW, 2)) };   // the tile, centred on the same pixels
    rect(cv, 0, 0, TW, TH, 0x000000); rect(cv, 1, 1, TW - 2, TH - 2, L.gold); rect(cv, 2, 2, TW - 4, TH - 4, L.bg);   // a gold frame: a crowned card
    rect(cv, 6, 6, 44, 48, L.well);                                                                                 // the crest's well
    shape(cv, CROWN, 17, 9, L.gold, 2);                                                                             // the crown, 22 x 12
    shape(cv, ICON_ROWS[H.set], 12, 22, L.crest, 2);                                                                // the business, 32 x 32
    letters(cv, H.name.toUpperCase(), 56, 8, L.text, L.shadow);
    letters(cv, H.title.toUpperCase(), 56, 21, L.dim, L.shadow);
    H.lit.forEach((on, n) => { const x = 56 + n * 11; shape(cv, GEM, x, 38, on ? L.gem : L.off); if (!on) rect(cv, x + 2, 41, 3, 1, L.well); });   // an unlit gem is hollow
    letters(cv, 'LV ' + H.level, 124 + 6, 37, L.gold, L.shadow);
    if (L.lcd) for (const y of span(0, FH)) for (const x of span(0, FW)) {   // the pocket screen: four shades, ordered dither
      const q = at(full, x, y), v = (((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 8, s3 = v * 3;
      dot(full, x, y, L.lcd[(s3 >> 8) + ((s3 & 255) > BAY[((y & 3) << 2) + (x & 3)] ? 1 : 0)]);
    }
    const sx = div(FW - lw, 2), sy = div(FH - lh, 2), px = new Uint8Array(w * h * 3);
    span(0, h).forEach((y) => {
      const row = (div(y, k) + sy + PAD) * full.cw + PAD + sx;
      span(0, w).forEach((x) => { const q = full.d[row + div(x, k)], o = (y * w + x) * 3; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; });
    });
    return { ok: true, px, scale: k, level: H.level };
  } catch (e) { return no('the hero could not be painted'); }
}
