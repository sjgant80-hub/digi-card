// kardart.mjs - PixelWhisperer Kards: the pixel-art engine that draws the face of every DIGI card.
//
// Built by Kar (the estate's resident builder) for the PixelWhisperer repo, powered by the Konomi architecture, created by
// Thomas Frumkin. It draws on the work of Gary W. Floyd, Lumiea Systems Research Division, ThunderStruck Service LLC (Open Defensive
// Prior Art, Creative Commons): the rule that a published theme is never edited, enforced by pinned hashes, draws on "From GEP
// Stabilization to Dual-Map Ethical Reasoning," Derivation v0.2, and the rule to draw the lowest-entropy picture that still shows every
// fact draws on "The Laws of Entropy-Time: Rewriting Thermodynamics with the Guided Entropy Principle," February 2026 (credits in
// full: kards/CREDITS.md). paintArt(facts, themeId, w, h) draws a card's face from the card's own facts and nothing else: the same
// facts and theme give the same bytes in any browser, so a reader can re-draw the face and refuse a card whose picture is
// not the one its facts make ("what you see is what you carry").
//
// The rules that make that true, kept by a static test:
//   * integer arithmetic only: no Math.sin / cos / sqrt / pow / random, no Date, no float literal. The only division is
//     div(), a floor of two small whole numbers (exact in every engine); curves come from integer tables and tests.
//   * total: any input that is not a card's facts, a known theme and a size in [64, 1024] comes back { ok:false, why }.
//   * a theme, once published, is never changed. A redesign is a new id (synthwave-v2) and THEMES only ever grows, so an
//     old card still re-draws exactly. Pinned hashes in the tests guard every published theme.
//
// How a face is made: the 16-hex id is whitened (a 4-round Feistel, so sequential ids look unrelated) into a 64-bit
// genome; every one of its bits chooses part of one symmetric voxel creature (head, torso, legs, arms, crown, eyes,
// mouth, back, pattern, colours and a 34-bit speckle). A theme draws that creature its own way (synthwave: a neon
// front view against a striped sun; blockcraft: isometric blocks on a grass island) inside a shared card chrome: title,
// LV bar, rarity frame and stars, a dataset icon, department, generation tally, parent identicons and the id.
const no = (why) => ({ ok: false, why });
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const div = (a, b) => Math.floor(a / b);
const span = (a, b, s = 1) => Array.from({ length: div(b - a + s - 1, s) }, (_, i) => a + i * s);   // a, a+s, ... below b: loops over it carry no comparison to be off by one

// -- the facts -------------------------------------------------------------------------------------------------------
export const DATASETS = Object.freeze(['telco', 'shop', 'bank', 'adult', 'hospital', 'credit', 'custom']);
export const RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary']);
const HEXD = '0123456789abcdef';
const TITLE_CH = " &'.-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DEPT_CH = '-0123456789abcdefghijklmnopqrstuvwxyz';
const only = (s, set) => { for (const ch of s) if (set.indexOf(ch) < 0) return false; return true; };
const isId = (s) => typeof s === 'string' && s.length === 16 && only(s, HEXD);
const whole = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;

/** Are these a card's facts? -> { ok: true, f (the facts, read once, with their dataset and rarity indexes) } | { ok: false, why }. Total. */
export function checkFacts(x) {
  try { return readFacts(x); } catch (e) { return no('the facts could not be read'); }
}
function readFacts(x) {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return no('facts must be an object');
  const { id, title, dataset, department, stage, rarity, generation, parents } = x;
  if (!isId(id)) return no('id must be 16 lowercase hex characters');
  if (typeof title !== 'string' || title.length > 24 || !only(title, TITLE_CH)) return no('title must be at most 24 characters from A-Z a-z 0-9 space & . - and the apostrophe');
  const di = DATASETS.indexOf(dataset);
  if (di < 0) return no('dataset must be one of ' + DATASETS.join(', '));
  if (typeof department !== 'string' || department.length > 16 || !only(department, DEPT_CH)) return no('department must be at most 16 characters from a-z 0-9 and -');
  if (!whole(stage, 99)) return no('stage must be a whole number from 0 to 99');
  const ri = RARITIES.indexOf(rarity);
  if (ri < 0) return no('rarity must be one of ' + RARITIES.join(', '));
  if (!whole(generation, 99)) return no('generation must be a whole number from 0 to 99');
  if (!Array.isArray(parents) || parents.length > 2) return no('parents must be an array of at most 2 ids');
  const kin = [];
  for (let i = 0; i < parents.length; i++) { if (!isId(parents[i])) return no('every parent must be 16 lowercase hex characters'); kin.push(parents[i]); }
  return { ok: true, f: { id, title, dataset, department, stage, rarity, generation, parents: kin, di, ri } };
}
const dim = (n) => Number.isInteger(n) && n >= 64 && n <= 1024;

// -- colour and numbers: colours are packed 0xRRGGBB integers ---------------------------------------------------------
const rgb = (r, g, b) => (r << 16) | (g << 8) | b;
const mul = (c, k) => rgb(Math.min(255, (((c >> 16) & 255) * k) >> 8), Math.min(255, (((c >> 8) & 255) * k) >> 8), Math.min(255, ((c & 255) * k) >> 8));   // k/256 brightness
const mix = (a, b, t) => rgb(((((a >> 16) & 255) * (256 - t)) + (((b >> 16) & 255) * t)) >> 8, ((((a >> 8) & 255) * (256 - t)) + (((b >> 8) & 255) * t)) >> 8, (((a & 255) * (256 - t)) + ((b & 255) * t)) >> 8);   // t/256 of the way to b
function rng(a, b) {   // xorshift32 seeded from two words: the scene's own deterministic dice
  let s = (a ^ Math.imul(b, 0x9e3779b1)) | 0;
  s = s || 0x2545f491;
  return (n) => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) % n; };
}
const hash3 = (x, y, z) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 982451653); h ^= h >>> 13; h = Math.imul(h, 1274126177); return (h >>> 16) & 3; };   // 0..3, the texture noise

// -- the genome: the id, whitened, read bit by bit --------------------------------------------------------------------
const feistel = (x, k) => { let t = Math.imul(x ^ k, 0x85ebca6b); t ^= t >>> 15; t = Math.imul(t, 0xc2b2ae35); return (t ^ (t >>> 13)) >>> 0; };
function whiten(id) {   // id -> two 32-bit words; a bijection of the 64 bits, so no two ids share a genome
  let hi = 0, lo = 0;
  for (let i = 0; i < 8; i++) { hi = hi * 16 + HEXD.indexOf(id[i]); lo = lo * 16 + HEXD.indexOf(id[i + 8]); }
  for (const k of [0x9e3779b1, 0x7f4a7c15, 0x1b873593, 0xe6546b64]) { const t = (hi ^ feistel(lo, k)) >>> 0; hi = lo; lo = t; }
  return [hi, lo];
}
function reader(hi, lo) {
  let n = 0;
  return (bits) => { let v = 0; for (let i = 0; i < bits; i++, n++) v = (v << 1) | ((n < 32 ? hi >>> (31 - n) : lo >>> (63 - n)) & 1); return v; };
}

// -- the creature: one symmetric voxel model, 9 wide (x, centre 4), 14 tall (y), 7 deep (z, front = high z) -----------
const MX = 9, MY = 14, MZ = 7, CX = 4;
const LEGS = [[1, 2, 2, 1, 3], [1, 1, 3, 2, 3], [2, 3, 2, 0, 4], [0, 3, 1, 0, 4], [0, 1, 2, 1, 3], [1, 1, 1, 2, 2], [2, 2, 3, 1, 3], [0, 0, 2, 2, 3]];   // inner dx, outer dx, height, z from, z to
const TORSO = [[1, 2, 1, 3], [2, 2, 1, 3], [1, 3, 1, 3], [2, 3, 1, 4], [2, 3, 0, 4], [1, 4, 1, 3], [2, 2, 0, 4], [2, 4, 1, 3]];                          // half width, height, z from, z to
const HEAD = [[1, 3, 1, 4], [2, 3, 1, 4], [2, 2, 0, 4], [1, 2, 1, 3], [3, 3, 1, 4], [2, 4, 1, 4], [3, 2, 0, 4], [1, 4, 2, 4]];
const EYES = [[[1, 6]], [[2, 7], [1, 6]], [[1, 8]], [[1, 7], [0, 6]], [[2, 6]], [[0, 6], [1, 6], [2, 6], [3, 6], [1, 8]], [[1, 6]], [[1, 7]]];       // [dx, voxel class]; 6 dark, 7 white, 8 glow
const SPECK = 34;

function modelOf(g) {
  const v = new Uint8Array(MX * MY * MZ), at = (y, z, x) => (y * MZ + z) * MX + x;
  const put = (dx, y, z, c) => { v[at(y, z, CX + dx)] = c; v[at(y, z, CX - dx)] = c; };
  const box = (d0, d1, y0, y1, z0, z1, c) => { for (let dx = d0; dx <= d1; dx++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(dx, y, z, c); };
  const [l0, l1, lh, lz0, lz1] = LEGS[g.legs], [tw, th, tz0, tz1] = TORSO[g.torso], [hw, hh, hz0, hz1] = HEAD[g.head];
  const ty = lh, hy = lh + th, top = hy + hh;                   // torso base, head base, first free row above the head
  const tf = tz1 + 1, fz = hz1 + 1, zm = div(hz0 + hz1 + 2, 2);   // torso front plane, face plane, head mid depth
  const ey = hy + Math.max(1, hh - 2), sy = hy - 1, az = div(tz0 + tz1 + 2, 2), ax = tw + 1;   // eye row, shoulder row, arm depth, arm column
  box(l0, l1, 0, lh - 1, lz0 + 1, lz1 + 1, 1);
  box(0, tw, ty, hy - 1, tz0 + 1, tz1 + 1, 1);
  box(0, l1, ty, ty, tz0 + 1, tz1 + 1, 1);                                                          // hips: the torso's base row reaches the legs
  if (g.arms === 1) { put(ax, sy, az, 1); put(ax, sy - 1, az, 5); }
  if (g.arms === 2) { put(ax, sy, az, 1); put(ax + 1, sy, az, 3); }
  if (g.arms === 3) { put(ax, sy, az, 1); put(ax, sy + 1, az, 1); put(ax, sy + 2, az, 3); }
  if (g.back === 1) { box(0, 0, ty, ty + 1, 0, tz0, 1); put(0, ty + 2, 0, 3); }                       // tail with a bright tip
  if (g.back === 2) { put(tw + 1, sy, tz0 + 1, 5); put(tw + 1, sy + 1, tz0 + 1, 5); put(tw + 2, sy + 1, tz0 + 1, 3); }   // wings, flush with the torso's back
  box(0, hw, hy, top - 1, hz0 + 1, hz1 + 1, 1);
  if (g.back === 3) box(0, 0, hy, top - 1, hz0, hz0, 4);                                              // mane down the back of the head
  if (g.pattern === 1) box(0, tw - 1, ty, hy - 2, tf, tf, 5);                                         // pale belly
  if (g.pattern === 2) for (let y = ty + 1; y < hy; y += 2) box(0, tw, y, y, tz0 + 1, tz1 + 1, 4);     // stripes
  if (g.pattern === 3) { put(1, ty, tf, 3); put(0, ty + 1, tf, 3); put(hw, hy, fz, 3); }               // spots
  if (g.crown === 1) put(hw, top, zm, 1);                                                             // ears
  if (g.crown === 2) { put(hw, top, zm, 5); put(hw, top + 1, zm, 5); }                               // horns
  if (g.crown === 3) { put(0, top, zm, 4); put(0, top + 1, zm, 4); put(0, top + 2, zm, 8); }         // antenna with a lit tip
  if (g.crown === 4) box(0, hw, top, top, hz0 + 1, hz1 + 1, 3);                                      // cap
  if (g.crown === 5) put(hw + 1, ey, zm, 1);                                                          // side ears
  if (g.crown === 6) box(0, 0, top, top, hz0 + 1, hz1 + 1, 3);                                       // mohawk
  if (g.crown === 7) { put(1, top, zm, 4); put(1, top + 1, zm, 8); }                                 // twin antennae
  for (const [dx, c] of EYES[g.eyes]) put(Math.min(dx, hw), ey, fz, c);
  if (g.eyes === 6 && hh > 2) put(1, ey + 1, fz, 3);                                                  // angry brows
  if (g.mouth === 1) put(0, ey - 1, fz, 6);
  if (g.mouth === 2) box(0, 1, ey - 1, ey - 1, fz, fz, 6);
  if (g.mouth === 3) put(0, ey - 1, fz + 1, 3);                                                       // snout
  let k = 0;   // speckle: flip the tone of body voxels, left half first, the right half follows (the model stays symmetric)
  v.forEach((c, i) => {
    const x = i % MX;
    if (x <= CX && c > 0 && c < 5) {
      if (g.speck[k % SPECK]) { const t = c % 2 ? c + 1 : c - 1; v[i] = t; v[i - x + 2 * CX - x] = t; }
      k++;
    }
  });
  return v;
}

function build(id) {
  const [hi, lo] = whiten(id), t = reader(hi, lo);
  const g = { hueA: t(4), hueB: t(3), head: t(3), torso: t(3), legs: t(3), arms: t(2), crown: t(3), eyes: t(3), mouth: t(2), back: t(2), pattern: t(2), speck: [] };
  for (let i = 0; i < SPECK; i++) g.speck.push(t(1));
  return { ok: true, g, v: modelOf(g), hi, lo };
}
/** The creature an id makes: { ok, g (its genome), v (Uint8Array 9 x 14 x 7 of voxel classes, index (y*7+z)*9+x), hi, lo }. */
export function spriteOf(id) { return isId(id) ? build(id) : no('id must be 16 lowercase hex characters'); }

// -- the canvas: 192 x 280 logical pixels (a card is drawn at 2x), with padding so nothing needs clipping -----------
const LW = 192, LH = 280, PAD = 32;
const WX = 8, WY = 24, WW = 176, WH = 152;       // the art window
const newCanvas = (w = LW, h = LH) => ({ cw: w + 2 * PAD, d: new Uint32Array((w + 2 * PAD) * (h + 2 * PAD)) });   // padded: nothing is clipped, nothing wraps
const rect = (cv, x, y, w, h, c) => { for (let r = 0; r < h; r++) { const o = (y + r + PAD) * cv.cw + x + PAD; cv.d.fill(c, o, o + w); } };
const dot = (cv, x, y, c) => { cv.d[(y + PAD) * cv.cw + x + PAD] = c; };
const at = (cv, x, y) => cv.d[(y + PAD) * cv.cw + x + PAD];
const ring = (cv, i, c) => { rect(cv, i, i, LW - 2 * i, 1, c); rect(cv, i, LH - 1 - i, LW - 2 * i, 1, c); rect(cv, i, i, 1, LH - 2 * i, c); rect(cv, LW - 1 - i, i, 1, LH - 2 * i, c); };
const bevel = (cv, x, y, w, h, light, dark) => { rect(cv, x, y, w, 1, light); rect(cv, x, y, 1, h, light); rect(cv, x, y + h - 1, w, 1, dark); rect(cv, x + w - 1, y, 1, h, dark); };

// -- pixel font 5 x 9 (caps and digits sit on rows 0-6, descenders fall to rows 7-8) and 16 x 16 icons ------------------
const bitmap = (rows, y0 = 0) => { const out = []; rows.forEach((s, y) => Array.from(s).forEach((ch, x) => { if (ch === '#') out.push([x, y + y0]); })); return out; };
/** The card font, 5 x 9: each entry is 'char startRow rows/joined/by/slashes' ('#' on, '.' off). Exported so the UI kit draws from the same source. */
export const FONT = Object.freeze([
  'A 0 .###./#...#/#...#/#####/#...#/#...#/#...#', 'B 0 ####./#...#/#...#/####./#...#/#...#/####.', 'C 0 .###./#...#/#..../#..../#..../#...#/.###.',
  'D 0 ####./#...#/#...#/#...#/#...#/#...#/####.', 'E 0 #####/#..../#..../####./#..../#..../#####', 'F 0 #####/#..../#..../####./#..../#..../#....',
  'G 0 .###./#...#/#..../#.###/#...#/#...#/.###.', 'H 0 #...#/#...#/#...#/#####/#...#/#...#/#...#', 'I 0 .###./..#../..#../..#../..#../..#../.###.',
  'J 0 ..###/...#./...#./...#./...#./#..#./.##..', 'K 0 #...#/#..#./#.#../##.../#.#../#..#./#...#', 'L 0 #..../#..../#..../#..../#..../#..../#####',
  'M 0 #...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', 'N 0 #...#/##..#/#.#.#/#..##/#...#/#...#/#...#', 'O 0 .###./#...#/#...#/#...#/#...#/#...#/.###.',
  'P 0 ####./#...#/#...#/####./#..../#..../#....', 'Q 0 .###./#...#/#...#/#...#/#.#.#/#..#./.##.#', 'R 0 ####./#...#/#...#/####./#.#../#..#./#...#',
  'S 0 .####/#..../#..../.###./....#/....#/####.', 'T 0 #####/..#../..#../..#../..#../..#../..#..', 'U 0 #...#/#...#/#...#/#...#/#...#/#...#/.###.',
  'V 0 #...#/#...#/#...#/#...#/#...#/.#.#./..#..', 'W 0 #...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', 'X 0 #...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  'Y 0 #...#/#...#/.#.#./..#../..#../..#../..#..', 'Z 0 #####/....#/...#./..#../.#.../#..../#####',
  '0 0 .###./#...#/#..##/#.#.#/##..#/#...#/.###.', '1 0 ..#../.##../..#../..#../..#../..#../.###.', '2 0 .###./#...#/....#/...#./..#../.#.../#####',
  '3 0 .###./#...#/....#/..##./....#/#...#/.###.', '4 0 ...#./..##./.#.#./#..#./#####/...#./...#.', '5 0 #####/#..../####./....#/....#/#...#/.###.',
  '6 0 ..##./.#.../#..../####./#...#/#...#/.###.', '7 0 #####/....#/...#./..#../.#.../.#.../.#...', '8 0 .###./#...#/#...#/.###./#...#/#...#/.###.',
  '9 0 .###./#...#/#...#/.####/....#/...#./.##..',
  'a 2 .###./....#/.####/#...#/.####', 'b 0 #..../#..../#.##./##..#/#...#/##..#/#.##.', 'c 2 .###./#...#/#..../#...#/.###.',
  'd 0 ....#/....#/.##.#/#..##/#...#/#..##/.##.#', 'e 2 .###./#...#/#####/#..../.###.', 'f 0 ..##./.#..#/.#.../###../.#.../.#.../.#...',
  'g 2 .####/#...#/#...#/#...#/.####/....#/.###.', 'h 0 #..../#..../#.##./##..#/#...#/#...#/#...#', 'i 0 ..#../...../.##../..#../..#../..#../.###.',
  'j 0 ...#./...../..##./...#./...#./...#./...#./#..#./.##..', 'k 0 #..../#..../#..#./#.#../##.../#.#../#..#.', 'l 0 .##../..#../..#../..#../..#../..#../.###.',
  'm 2 ##.#./#.#.#/#.#.#/#.#.#/#.#.#', 'n 2 #.##./##..#/#...#/#...#/#...#', 'o 2 .###./#...#/#...#/#...#/.###.',
  'p 2 #.##./##..#/#...#/##..#/#.##./#..../#....', 'q 2 .##.#/#..##/#...#/#..##/.##.#/....#/....#', 'r 2 #.##./##..#/#..../#..../#....',
  's 2 .####/#..../.###./....#/####.', 't 0 .#.../.#.../###../.#.../.#.../.#..#/..##.', 'u 2 #...#/#...#/#...#/#..##/.##.#',
  'v 2 #...#/#...#/#...#/.#.#./..#..', 'w 2 #...#/#...#/#.#.#/#.#.#/.#.#.', 'x 2 #...#/.#.#./..#../.#.#./#...#',
  'y 2 #...#/#...#/#...#/.####/....#/#...#/.###.', 'z 2 #####/...#./..#../.#.../#####',
  '& 0 .##../#..#./#.#../.#.../#.#.#/#..#./.##.#', "' 0 ..#../..#../.#...", '. 6 ..#..', '- 3 .###.', '# 0 .#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.', '~ 6 #.#.#',
]);
const GLY = {};
for (const e of FONT) GLY[e[0]] = bitmap(e.slice(4).split('/'), e.charCodeAt(2) - 48);

/** The seven 16 x 16 dataset icons, as rows of '#' cells. Exported for the UI kit. */
export const ICON_ROWS = Object.freeze({
  telco: Object.freeze(['................', '..##........##..', '.#..#..##..#..#.', '.#.#..####..#.#.', '.#.#..####..#.#.', '.#..#..##..#..#.', '..##...##...##..', '.......##.......', '......####......', '......#..#......', '.....##..##.....', '.....#....#.....', '....##....##....', '....#......#....', '...##########...', '................']),
  shop: Object.freeze(['................', '.....######.....', '....#......#....', '....#......#....', '..############..', '..############..', '..##.######.##..', '..############..', '..############..', '..############..', '..############..', '..############..', '..############..', '..############..', '..############..', '................']),
  bank: Object.freeze(['................', '.......##.......', '......####......', '.....######.....', '....########....', '...##########...', '..############..', '................', '...##...##...##.', '...##...##...##.', '...##...##...##.', '...##...##...##.', '...##...##...##.', '..############..', '.##############.', '................']),
  adult: Object.freeze(['................', '.....######.....', '....########....', '....########....', '....########....', '....########....', '.....######.....', '................', '...##########...', '..############..', '..############..', '..############..', '..############..', '..############..', '..############..', '................']),
  hospital: Object.freeze(['................', '..############..', '.##############.', '.#####....#####.', '.#####....#####.', '.#####....#####.', '.##..........##.', '.##..........##.', '.##..........##.', '.##..........##.', '.#####....#####.', '.#####....#####.', '.#####....#####.', '.##############.', '..############..', '................']),
  credit: Object.freeze(['................', '................', '.##############.', '################', '################', '................', '................', '################', '################', '##....##########', '##....##########', '################', '################', '.##############.', '................', '................']),
  custom: Object.freeze(['................', '................', '...##########...', '..############..', '.##.#..##..#.##.', '################', '.##############.', '..############..', '...##########...', '....########....', '.....######.....', '......####......', '.......##.......', '................', '................', '................']),
});
const ICONS = Object.fromEntries(Object.entries(ICON_ROWS).map(([k, rows]) => [k, bitmap(rows)]));
/** The 8 x 8 rarity star. */
export const STAR_ROWS = Object.freeze(['...##...', '...##...', '########', '.######.', '..####..', '..####..', '.##..##.', '.#....#.']);
const STAR = bitmap(STAR_ROWS);

const blit = (cv, list, x, y, c) => { for (const [px, py] of list) dot(cv, x + px, y + py, c); };
function text(cv, s, x, y, c, k = 1) {
  Array.from(s).forEach((ch, i) => { for (const [px, py] of GLY[ch] || []) rect(cv, x + (i * 6 + px) * k, y + py * k, k, k, c); });
}
const tw = (s, k = 1) => s.length * 6 * k - k;       // pixel width of a string
const label = (cv, s, x, y, c, sh, k = 1) => { text(cv, s, x + k, y + k, sh, k); text(cv, s, x, y, c, k); };

// -- rarity palettes and the shared card chrome ----------------------------------------------------------------------
/** The rarity palettes: common grey, uncommon green, rare blue, epic purple, legendary gold; hi, mid and lo tones and the legendary spark. */
export const RAR = Object.freeze([
  { label: 'COMMON', hi: 0xc8ccd6, mid: 0x8a8f9e, lo: 0x4a4e5c, spark: 0xfff6c0 },
  { label: 'UNCOMMON', hi: 0x86ff92, mid: 0x36c44c, lo: 0x147030, spark: 0xfff6c0 },
  { label: 'RARE', hi: 0x80c4ff, mid: 0x3a7ee8, lo: 0x163f98, spark: 0xfff6c0 },
  { label: 'EPIC', hi: 0xdba2ff, mid: 0x9c4ee2, lo: 0x4e1c8e, spark: 0xfff6c0 },
  { label: 'LEGENDARY', hi: 0xffe680, mid: 0xf2b422, lo: 0x8e5a0a, spark: 0xfff6c0 },
].map((r) => Object.freeze(r)));
const DCOL = [0x40e8ff, 0xffa040, 0x86ff92, 0xff6ad0, 0xff5a5a, 0x6aa8ff, 0xffffff];   // dataset colours

function frame(cv, p, t) {
  ring(cv, 0, p.lo); ring(cv, 1, p.mid); ring(cv, 2, p.hi); ring(cv, 3, p.lo);
  if (t >= 2) ring(cv, 5, p.mid);
  if (t >= 1) for (const [x, y] of [[4, 4], [184, 4], [4, 272], [184, 272]]) { rect(cv, x, y, 4, 4, p.hi); rect(cv, x + 1, y + 1, 2, 2, p.lo); }
  if (t >= 3) for (const [x, y] of [[90, 0], [90, LH - 4]]) { rect(cv, x, y, 12, 4, p.hi); rect(cv, x + 2, y + 1, 8, 2, p.lo); }
  if (t >= 4) for (const x of span(12, LW - 12, 12)) { rect(cv, x, 1, 3, 2, p.spark); rect(cv, x, LH - 3, 3, 2, p.spark); }
}

function chip(cv, x, y, pid, look) {   // a parent's identicon: 3 x 6 cells mirrored, coloured by its genome
  const [a, b] = whiten(pid), col = look.body[b & 15], p = look.p;
  rect(cv, x, y, 20, 20, look.ui.chip);
  for (const cy of span(0, 6)) for (const cx of span(0, 3)) if ((a >>> (cy * 3 + cx)) & 1) { rect(cv, x + 1 + cx * 3, y + 1 + cy * 3, 3, 3, col); rect(cv, x + 16 - cx * 3, y + 1 + cy * 3, 3, 3, col); }
  bevel(cv, x, y, 20, 20, p.hi, p.lo);
}

function chrome(cv, f, look) {
  const u = look.ui, p = look.p, dc = look.dcol[f.di];
  rect(cv, 0, 0, LW, 24, u.bg); rect(cv, 0, WY + WH, LW, LH - WY - WH, u.bg); rect(cv, 0, WY, WX, WH, u.bg); rect(cv, WX + WW, WY, LW - WX - WW, WH, u.bg);
  bevel(cv, WX - 1, WY - 1, WW + 2, WH + 2, u.dark, u.light);                            // the art window sunk into the card
  rect(cv, 8, 6, 176, 16, u.plate); bevel(cv, 8, 6, 176, 16, u.light, u.dark);
  label(cv, f.title, 8 + div(176 - tw(f.title), 2), 10, u.text, u.shadow);              // title plate
  rect(cv, 8, 178, 176, 96, u.panel); bevel(cv, 8, 178, 176, 96, u.light, u.dark);
  label(cv, 'LV ' + f.stage, 12, 183, p.hi, u.shadow, 2);                                 // level and its 100-pixel bar
  rect(cv, 74, 184, 102, 10, p.lo); rect(cv, 75, 185, 100, 8, u.bg);
  rect(cv, 75, 185, f.stage, 8, p.mid); rect(cv, 75, 185, f.stage, 2, p.hi);
  for (const i of span(1, 10)) rect(cv, 75 + i * 10, 185, 1, 8, u.bg);
  blit(cv, ICONS[f.dataset], 13, 205, u.shadow); blit(cv, ICONS[f.dataset], 12, 204, dc);   // dataset icon, name, department
  label(cv, f.dataset.toUpperCase(), 32, 205, dc, u.shadow);
  label(cv, f.department, 32, 215, u.text, u.shadow);
  label(cv, p.label, 176 - tw(p.label), 205, p.hi, u.shadow);                             // rarity, spelled and starred
  for (const i of span(0, 5)) blit(cv, STAR, 132 + i * 9, 215, i <= f.ri ? p.hi : p.lo);
  rect(cv, 12, 226, 164, 1, u.rule);
  label(cv, 'GEN ' + f.generation, 12, 230, u.text, u.shadow);                            // lineage: generation tally, parents
  for (const i of span(0, div(f.generation, 10))) rect(cv, 12 + i * 7, 242, 5, 4, p.hi);
  for (const i of span(0, f.generation % 10)) rect(cv, 12 + i * 4, 248, 2, 3, p.mid);
  if (f.parents.length) {
    chip(cv, 122, 229, f.parents[0], look);
    rect(cv, 146, 238, 5, 1, p.hi); rect(cv, 148, 236, 1, 5, p.hi);
    if (f.parents.length > 1) chip(cv, 156, 229, f.parents[1], look);
    else for (const i of span(0, 20, 2)) { dot(cv, 156 + i, 229, p.lo); dot(cv, 156 + i, 248, p.lo); dot(cv, 156, 229 + i, p.lo); dot(cv, 175, 229 + i, p.lo); }
  } else { blit(cv, STAR, 124, 235, p.hi); label(cv, 'GENESIS', 135, 235, u.text, u.shadow); }
  rect(cv, 12, 254, 164, 1, u.rule);
  label(cv, '#' + f.id.slice(0, 8) + '~', 12, 259, u.text, u.shadow);                    // the id, then its 64 bits as a barcode
  for (const i of span(0, 16)) for (const b of span(0, 4)) rect(cv, 104 + (i * 4 + b) + div(i * 4 + b, 8), 258, 1, (HEXD.indexOf(f.id[i]) >> (3 - b)) & 1 ? 12 : 5, p.hi);
}

// -- themes: the colours, and a scene that draws the art window -------------------------------------------------------
const SYNTH_BODY = [0xff3ca0, 0xdc32e6, 0x28e6f0, 0x3c78ff, 0x9650ff, 0x3cf0be, 0xaaff46, 0xffe646, 0xff8c3c, 0xff6464, 0xe6c8ff, 0x5a46dc, 0xff96d2, 0x78fff0, 0x7832aa, 0xaab4d2];
const SYNTH_ACC = [0xfff05a, 0x3cfafa, 0xff46c8, 0xffffff, 0x82ff64, 0xff9632, 0xaa64ff, 0xff5a5a];
const BLOCK_BODY = [0x60a840, 0x3c7832, 0xf0a0aa, 0xe6e6e1, 0x82828a, 0xf0d25a, 0xe68232, 0xc83c32, 0x3c6ec8, 0x46c8c8, 0x8246be, 0xc846aa, 0x8c5a32, 0x322d41, 0x329682, 0x96d23c];
const BLOCK_ACC = [0xfac832, 0xdc3c32, 0x50e6e6, 0x3cdc6e, 0xaa5ae6, 0xf0f0f0, 0xff9628, 0xff78be];
const classColors = (body, acc, ink, g) => { const b = body[g.hueA], a = acc[g.hueB]; return [0, b, mul(b, 205), a, mul(a, 205), mix(b, 0xffffff, 110), ink, 0xf2f2f2, mix(a, 0xffffff, 100)]; };

const FLAG = 0x1000000;   // marks an opaque pixel in a sprite buffer (colour 0 is a real colour)

const SKY_S = [0x0a0420, 0x14082e, 0x240a44, 0x3a0d5c, 0x5a1070, 0x82157c, 0xb01c82, 0xd9287c, 0xf04a70, 0xff7a63, 0xffa457, 0xffd25a];
const NEAR1 = [[-1, 0], [1, 0], [0, -1], [0, 1]], NEAR2 = [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]];   // the outline's and the glow's neighbours
const SW = MX * 8 + 8, SH = MY * 8 + 8;   // the front-view sprite buffer: 8 px per voxel and a 4 px margin for outlines
const edgeK = (i, j) => (j === 0 ? 40 : 0) + (i === 0 ? 20 : 0) - (j === 7 ? 56 : 0) - (i === 7 ? 36 : 0);   // a voxel's bevel: lit top and left, shaded bottom and right
function frontSprite(sp, shade) {   // the creature from the front, the front-most voxel of each column; shade(class, depth, i, j, x, y) -> colour
  const px = new Uint32Array(SW * SH);
  for (const y of span(0, MY)) for (const x of span(0, MX)) {
    const z = span(0, MZ).reverse().find((q) => sp.v[(y * MZ + q) * MX + x]), c = sp.v[(y * MZ + z) * MX + x];   // the front-most voxel of this column, if any
    if (c) for (const j of span(0, 8)) for (const i of span(0, 8)) { const row = (MY - 1 - y) * 8 + j; px[(row + 4) * SW + x * 8 + i + 4] = shade(c, z, i, j, x * 8 + i, row) | FLAG; }
  }
  return px;
}
const solidAt = (px, i, j) => px[j * SW + i] & FLAG, nearAt = (px, list, i, j) => list.some(([dx, dy]) => solidAt(px, i + dx, j + dy));
function synthScene(cv, f, sp, look) {
  const p = look.p, r = rng(sp.hi, sp.lo ^ 0x51ed270b), D = (x, y, c) => dot(cv, WX + x, WY + y, c), R = (x, y, w, h, c) => rect(cv, WX + x, WY + y, w, h, c), H = 92, XS = span(0, WW);
  for (const y of span(0, H)) { const b = div(y * 12, H), e = y * 12 - b * H; for (const x of XS) D(x, y, SKY_S[Math.min(11, b + (e > 64 && (x + y) % 2 ? 1 : 0))]); }
  for (const i of span(0, 12 + 8 * f.ri)) {   // stars: more of them the rarer the card
    const x = r(WW), y = r(58), c = [0xffffff, 0xbff8ff, 0xffc0f0][r(3)];
    D(x, y, c);
    if (f.ri >= 3 && i % 3 === 0) { D(x - 1, y, c); D(x + 1, y, c); D(x, y - 1, c); D(x, y + 1, c); }
  }
  R(0, H, WW, 1, p.hi); R(0, H + 1, WW, 1, p.mid);   // the horizon, in the rarity's colour
  for (const y of span(38, H)) {   // the sun, its lower half cut into ever thicker stripes
    const dy = y - 78, yy = Math.max(0, y - 56), c = mix(0xffe45e, 0xff2a8a, div((y - 38) * 256, 54));
    if (yy % 7 >= div(yy, 6)) for (const x of span(48, 129)) if ((x - 88) * (x - 88) + dy * dy <= 1600) D(x, y, c);
  }
  const hts = span(0, 12).map((i) => (i % 2 ? 6 : 18) + r(i % 2 ? 8 : 16));
  for (const x of XS) {   // mountains: a ridge of integer line segments, outlined in neon
    const s = div(x, 16), t = x - s * 16, h = div(hts[s] * (16 - t) + hts[s + 1] * t, 16);
    R(x, H - h, 1, h, 0x1a0836); D(x, H - h, 0x3df5ff); D(x, H - h + 1, 0x7a2fb8);
  }
  for (const y of span(H + 2, WH)) R(0, y, WW, 1, mix(0x3a0f6e, 0x0a0220, div((y - H) * 256, WH - H)));
  for (const d of [3, 7, 12, 19, 28, 39, 52]) R(0, H + d, WW, 1, 0xff2bd6);
  for (const m of span(0, 8)) for (const y of span(H + 2, WH)) {   // the grid's verticals fan out from the vanishing point
    const d = y - H, a = div(m * 22 * d, 59), b = div(m * 22 * (d + 1), 59), x0 = Math.max(0, 88 + a), x1 = Math.max(0, 88 - b);
    R(x0, y, Math.min(WW, 89 + b) - x0, 1, 0xff2bd6);   // each line from where it is on this row to where it is on the next, clipped to the window
    R(x1, y, Math.min(WW, 89 - a) - x1, 1, 0xff2bd6);
  }
  const cc = classColors(look.body, look.acc, look.ui.ink, sp.g);   // a voxel is 8 x 8 px, darker the deeper it sits
  const px = frontSprite(sp, (c, z, i, j) => mul(cc[c], (c === 8 ? 256 : 256 - (MZ - 1 - z) * 14) + edgeK(i, j)));
  for (const j of span(2, SH - 2)) for (const i of span(2, SW - 2)) if (!solidAt(px, i, j)) {   // neon outline, then a dithered glow
    if (nearAt(px, NEAR1, i, j)) D(48 + i, 22 + j, p.hi);
    else if (nearAt(px, NEAR2, i, j) && (i + j) % 2) D(48 + i, 22 + j, p.mid);
  }
  for (const j of span(0, SH)) for (const i of span(0, SW)) if (solidAt(px, i, j)) D(48 + i, 22 + j, px[j * SW + i] & 0xffffff);
  for (const q of span(0, 32)) for (const i of span(4, SW - 4)) {   // its reflection in the floor, fading
    const s = px[(SH - 5 - q) * SW + i];
    if (s & FLAG) D(48 + i, 138 + q, mix(at(cv, WX + 48 + i, WY + 138 + q), s & 0xffffff, 130 - q * 3));
  }
  for (const i of span(0, Math.max(0, f.ri - 2) * 3)) { const x = r(WW - 4), y = r(60); R(x, y, 2, 2, p.hi); }   // gold-dust for the rare
  for (const y of span(0, WH, 3)) for (const x of XS) D(x, y, mul(at(cv, WX + x, WY + y), 232));   // CRT scanlines
}

const SKY_B = [0x3f8cf5, 0x56a0fa, 0x6fb4ff, 0x88c4ff, 0xa0d2ff, 0xb4dcff, 0xc6e6ff, 0xd8f0ff];
const SKY_N = [0x070b2a, 0x0b1240, 0x101a56, 0x16246c, 0x1d3082, 0x263b94, 0x2f47a4, 0x3a54b2];
const TOP = [2, 4, 6, 6, 4, 2];                                       // an isometric block is 12 px wide: its top diamond's six rows, half-widths
const LEFT = [3, 3, 4, 4, 5, 5], RIGHT = [5, 5, 4, 4, 3, 3];         // and the diamond's lowest row above each of the side faces' six columns
function cube(cv, px, py, c, seed, lit, strip = 0, sc = 0) {   // an isometric block: top, left face (front), right face; noise gives it a texture
  const shade = (base, k, x, y) => mul(base, div(k * (232 + hash3(x, y, seed) * 12), 256));
  for (const r of span(0, 6)) for (const x of span(px - TOP[r], px + TOP[r])) dot(cv, x, py + r, shade(c, lit[0], x, py + r));
  for (const dx of span(0, 6)) for (const r of span(0, 6)) {
    const base = r < strip ? sc : c, yl = py + LEFT[dx] + 1 + r, yr = py + RIGHT[dx] + 1 + r;
    dot(cv, px - 6 + dx, yl, shade(base, div(lit[1] * (dx === 0 ? 150 : 256), 256), px - 6 + dx, yl));
    dot(cv, px + dx, yr, shade(base, div(lit[2] * (dx === 5 ? 150 : 256), 256), px + dx, yr));
  }
}
function blockScene(cv, f, sp, look) {
  const p = look.p, r = rng(sp.lo, sp.hi ^ 0x2f6e2b1d), D = (x, y, c) => dot(cv, WX + x, WY + y, c), R = (x, y, w, h, c) => rect(cv, WX + x, WY + y, w, h, c), H = 92;
  const night = f.ri >= 3, sky = night ? SKY_N : SKY_B, dk = night ? 140 : 256;          // epic and legendary cards live under a night sky
  for (const y of span(0, H)) { const b = div(y * 8, H), e = y * 8 - b * H; for (const x of span(0, WW)) D(x, y, sky[Math.min(7, b + (e > 60 && (x + y) % 2 ? 1 : 0))]); }
  if (night) for (const i of span(0, 30)) D(r(WW), r(70), 0xe8ecff);
  for (const i of span(0, 3)) { const x = r(140), y = 10 + r(44); R(x, y, 32, 6, mul(0xffffff, dk)); R(x + 6, y - 5, 18, 5, mul(0xffffff, dk)); R(x + 2, y + 6, 28, 3, mul(0xdce8f8, dk)); }   // blocky clouds
  const sx = 10 + r(150), sy = 6 + r(26);
  R(sx, sy, 14, 14, night ? 0xb8c4e8 : 0xffd84a); R(sx + 2, sy + 2, 10, 10, night ? 0xf4f6ff : 0xfff6b0);   // a square sun, or moon, in front of the clouds
  for (const c of span(0, 11)) { const h = 14 + r(22); R(c * 16, H - h, 16, h, mul(0x2f6f2a, dk)); R(c * 16, H - h, 16, h - div(h, 2), mul(0x3f8a34, dk)); R(c * 16, H - h, 16, 3, mul(0x5cb347, dk)); }   // far hills
  for (const y of span(H, WH)) R(0, y, WW, 1, mul(mix(0x2f6fe0, 0x1a3c96, div((y - H) * 256, WH - H)), dk));   // water
  for (const i of span(0, 16)) R(r(WW - 9), H + 4 + r(WH - H - 8), 4 + r(5), 1, mul(0x7aa8f4, dk));
  const ox = WX + 82, oy = WY + 70, ore = [[-4, 8], [-3, 8], [-4, 9], [-2, 10], [-1, 10], [1, 7], [1, 8], [2, 8], [2, 9], [3, 10]];
  for (const j of span(-3, 0)) for (const k of span(0, 7)) for (const i of span(0, 9)) {   // the island: stone, dirt, grass, back to front
    const px = ox + (i - k) * 6, py = oy + (i + k) * 3 - j * 6;
    if (j === -1) cube(cv, px, py, 0x5fb83a, i * 7 + k, [256, 204, 154], 2, 0x4f9e30);
    else cube(cv, px, py, j === -2 ? 0x8a5a33 : 0x84848c, i * 7 + k + 99 * -j, [256, 204, 154]);
    if (j < -1 && (i === 8 || k === 6) && r(3) === 0) for (const q of span(0, 5)) { const o = ore[q + (i === 8 ? 5 : 0)]; dot(cv, px + o[0], py + o[1], q % 2 ? p.mid : p.hi); }
  }
  const cc = classColors(look.body, look.acc, look.ui.ink, sp.g);
  sp.v.forEach((c, n) => {   // the creature's voxels, in the same order: height, then depth, then width
    const i = n % MX, k = div(n, MX) % MZ, j = div(n, MX * MZ);
    if (c) cube(cv, ox + (i - k) * 6, oy + (i + k) * 3 - j * 6, cc[c], i * 31 + j * 17 + k, c === 8 ? [256, 244, 230] : [256, 204, 154]);
  });
  for (const i of span(0, Math.max(0, f.ri - 2) * 3)) { const x = r(WW - 4), y = r(60); R(x, y, 2, 2, p.hi); }   // gold-dust for the rare
}

const UI_S = { bg: 0x120626, plate: 0x24094a, panel: 0x1a0836, chip: 0x0e0420, text: 0xffffff, shadow: 0x4a1480, light: 0xb04ae0, dark: 0x080212, rule: 0x4a1a80, ink: 0x0c0418 };
const UI_B = { bg: 0x32323a, plate: 0x4a4a54, panel: 0x3c3c46, chip: 0x1c1c22, text: 0xffffff, shadow: 0x14141a, light: 0x9a9aa8, dark: 0x16161c, rule: 0x24242c, ink: 0x1b1b24 };
// -- lcd-v1: a four-shade handheld screen. Every pixel of a card is one of four shades; the creature is dithered onto them. --
const LCD = [   // per rarity, darkest to lightest: grey, green, blue, purple, gold
  [0x0f1210, 0x4a5048, 0x9aa095, 0xd8dccf],
  [0x0f380f, 0x306230, 0x8bac0f, 0xc8e078],
  [0x08143a, 0x1f3f8f, 0x5f8fe8, 0xb8d4ff],
  [0x1c0a38, 0x522a8a, 0xa06ad8, 0xe0c8ff],
  [0x2a1a02, 0x7a4e08, 0xd09a20, 0xffe890],
];
const BAY = [0, 128, 32, 160, 192, 64, 224, 96, 48, 176, 16, 144, 240, 112, 208, 80];   // a 4 x 4 ordered-dither matrix, scaled to 0..255
const LCD_BODY = [0x3c3c3c, 0x5a5a5a, 0x787878, 0x969696, 0xb4b4b4, 0xd2d2d2, 0x484848, 0x666666, 0x848484, 0xa2a2a2, 0xc0c0c0, 0xdedede, 0x505050, 0x707070, 0x909090, 0xb0b0b0];   // a creature's tone is its genome's grey
const LCD_ACC = [0xf0f0f0, 0x282828, 0xc8c8c8, 0x646464, 0xe0e0e0, 0x383838, 0xaaaaaa, 0x8c8c8c];
const lum = (c) => (((c >> 16) & 255) * 77 + ((c >> 8) & 255) * 150 + (c & 255) * 29) >> 8;
const lcdLook = (f) => {
  const [d0, d1, d2, d3] = LCD[f.ri];
  return { ui: { bg: d0, plate: d1, panel: d0, chip: d0, text: d3, shadow: d0, light: d2, dark: d0, rule: d1, ink: d0 }, p: { label: RAR[f.ri].label, hi: d3, mid: d2, lo: d1, spark: d3 }, body: span(0, 16).map((i) => (i % 2 ? d3 : d2)), dcol: span(0, 7).map(() => d3), ramp: LCD[f.ri] };
};
function lcdScene(cv, f, sp, look) {
  const [d0, d1, d2, d3] = look.ramp, r = rng(sp.hi ^ 0x1c0de5, sp.lo), D = (x, y, c) => dot(cv, WX + x, WY + y, c), R = (x, y, w, h, c) => rect(cv, WX + x, WY + y, w, h, c), H = 96, XS = span(0, WW);
  for (const y of span(0, H)) for (const x of XS) D(x, y, BAY[((y & 3) << 2) + (x & 3)] < Math.max(0, y - 40) * 5 ? d2 : d3);   // a sky that darkens toward the horizon
  for (const i of span(0, 3)) { const x = r(140), y = 8 + r(40); R(x + 4, y, 14, 3, d2); R(x, y + 3, 24, 3, d2); R(x + 2, y + 6, 20, 1, d1); }   // pixel clouds
  const sx = 24 + r(128), sy = 14 + r(20);
  for (const y of span(sy - 12, sy + 13)) for (const x of span(sx - 12, sx + 13)) { const d = (x - sx) * (x - sx) + (y - sy) * (y - sy); if (d <= 144) D(x, y, d >= 100 ? d1 : d3); }   // a sun, ringed
  const hts = span(0, 12).map(() => 8 + r(14));
  for (const x of XS) { const s = div(x, 16), t = x - s * 16, h = div(hts[s] * (16 - t) + hts[s + 1] * t, 16); R(x, H - h, 1, h, d1); D(x, H - h, d0); }   // far hills
  for (const y of span(H, WH)) for (const x of XS) D(x, y, (y - H) % 8 === 0 || (x + (div(y - H, 8) % 2) * 8) % 16 === 0 ? d1 : d2);   // a brick floor
  R(0, H, WW, 1, d0);
  for (const y of span(131, 146)) for (const x of span(42, 135)) {   // a round stage under the creature, an integer ellipse
    const dx = x - 88, dy = y - 138;
    if (dx * dx * 49 + dy * dy * 2116 <= 103684) D(x, y, dx * dx * 25 + dy * dy * 1936 <= 48400 ? d3 : d0);
  }
  const cc = classColors(LCD_BODY, LCD_ACC, d0, sp.g);
  const px = frontSprite(sp, (c, z, i, j, x, y) => {   // eyes the darkest shade, whites the lightest, the rest dithered by brightness
    if (c > 6) return d3;
    if (c === 6) return d0;
    const s = Math.min(255, (lum(cc[c]) * (256 - (MZ - 1 - z) * 10 + edgeK(i, j))) >> 8) * 2;
    return look.ramp[1 + (s >> 8) + ((s & 255) > BAY[((y & 3) << 2) + (x & 3)] ? 1 : 0)];
  });
  for (const j of span(2, SH - 2)) for (const i of span(2, SW - 2)) if (!solidAt(px, i, j) && nearAt(px, NEAR1, i, j)) D(48 + i, 22 + j, d0);
  for (const j of span(0, SH)) for (const i of span(0, SW)) if (solidAt(px, i, j)) D(48 + i, 22 + j, px[j * SW + i] & 0xffffff);
  for (const i of span(0, Math.max(0, f.ri - 1) * 2)) { const x = r(WW - 6) + 3, y = r(60) + 3; D(x, y, d0); D(x - 1, y, d0); D(x + 1, y, d0); D(x, y - 1, d0); D(x, y + 1, d0); }   // glints for the rare
}

// -- memphis-v1: eighties pop. Flat colour, confetti, a checker floor, a heavy outline and a hard shadow. --
const MEM_BG = [0xffe14a, 0x19d3c5, 0xff8fc8, 0xb8a4ff, 0x7ee8a0, 0xffb36b];
const MEM_ALT = [0xff4fa3, 0x7a4bff, 0x2d9cff, 0xffffff];
const ZIG = [0, 1, 2, 1];   // a zigzag's rise and fall over four pixels
const MEM_CONF = [0x111111, 0xffffff, 0xff4fa3, 0x2d9cff, 0xffe14a];
const MEM_BODY = [0xff4fa3, 0x19d3c5, 0xffe14a, 0x7a4bff, 0xff7a3c, 0x3ddc84, 0x4aa8ff, 0xff6b6b, 0xc2ff4a, 0xff9ad5, 0x00c2ff, 0xb388ff, 0xff9f1c, 0x2ec4b6, 0xe84393, 0x6c5ce7];
const MEM_ACC = [0x111111, 0xffffff, 0xffe14a, 0x19d3c5, 0xff4fa3, 0x7a4bff, 0xff7a3c, 0x3ddc84];
const MEM_UI = { bg: 0x1b1740, plate: 0xff4fa3, panel: 0xfff1d6, chip: 0x1b1740, text: 0x111111, shadow: 0xffe14a, light: 0xffffff, dark: 0x111111, rule: 0x111111, ink: 0x111111 };
const MEM_RAR = [   // strong, light and pale tones per rarity (the pale one is what an unfilled star looks like): grey, green, blue, purple, gold
  [0x646b79, 0x9aa3b2, 0xd7dbe4], [0x16a34a, 0x4ade80, 0xc9f5d9], [0x2563eb, 0x60a5fa, 0xcfe0ff], [0x9333ea, 0xc084fc, 0xeadbfe], [0xd97706, 0xfbbf24, 0xfeebc1],
];
const MEM_DCOL = [0x0891b2, 0xea580c, 0x15803d, 0xdb2777, 0xdc2626, 0x2563eb, 0x111111];
const memphisLook = (f) => ({ ui: MEM_UI, p: { label: RAR[f.ri].label, hi: MEM_RAR[f.ri][0], mid: MEM_RAR[f.ri][1], lo: MEM_RAR[f.ri][2], spark: 0xfff6c0 }, body: MEM_BODY, dcol: MEM_DCOL });
function memphisScene(cv, f, sp, look) {
  const r = rng(sp.lo ^ 0x3e3f15, sp.hi), D = (x, y, c) => dot(cv, WX + x, WY + y, c), R = (x, y, w, h, c) => rect(cv, WX + x, WY + y, w, h, c), bg = MEM_BG[r(6)], alt = MEM_ALT[r(4)];
  R(0, 0, WW, WH, bg);
  const cx = 40 + r(96), cy = 46 + r(24);
  for (const y of span(cy - 36, cy + 37)) for (const x of span(cx - 36, cx + 37)) { const d = (x - cx) * (x - cx) + (y - cy) * (y - cy); if (d <= 1296) D(x, y, d > 1024 ? 0x111111 : alt); }   // a big disc, heavily outlined
  for (const i of span(0, 26)) {   // terrazzo confetti: dots, triangles, bars, zigzags, rings
    const x = r(WW - 14) + 4, y = r(112) + 2, c = MEM_CONF[r(5)], k = r(5);
    if (k === 0) for (const q of span(0, 49)) { const dx = (q % 7) - 3, dy = div(q, 7) - 3; if (dx * dx + dy * dy <= 9) D(x + dx, y + dy, c); }
    if (k === 1) for (const q of span(0, 7)) R(x + 6 - q, y + q, q * 2 + 1, 1, c);
    if (k === 2) for (const q of span(0, 10)) R(x + q, y + q, 3, 1, c);
    if (k === 3) for (const q of span(0, 16)) { const z = ZIG[q % 4]; D(x + q, y + z, c); D(x + q, y + z + 1, c); }
    if (k === 4) for (const q of span(0, 81)) { const dx = (q % 9) - 4, dy = div(q, 9) - 4, d = dx * dx + dy * dy; if (d <= 16 && d >= 8) D(x + dx, y + dy, c); }
  }
  const px0 = r(2) ? 6 : 128;
  for (const j of span(0, 3)) for (const i of span(0, 7)) R(px0 + i * 6, 8 + j * 6, 6, 6, (i + j) % 2 ? 0x111111 : 0xffffff);   // a checker patch
  R(0, 114, WW, 2, 0xff4fa3); R(0, 116, WW, 2, 0x111111);
  for (const y of span(118, WH)) for (const x of span(0, WW)) D(x, y, (div(y - 118, 8) + div(x, 11)) % 2 ? 0x111111 : 0xffffff);   // a checker floor
  const cc = classColors(MEM_BODY, MEM_ACC, 0x111111, sp.g), px = frontSprite(sp, (c, z, i, j) => mul(cc[c], 256 + edgeK(i, j)));
  for (const j of span(0, SH)) for (const i of span(0, SW)) if (solidAt(px, i, j)) D(48 + i + 6, 22 + j + 5, 0x1b1740);   // a hard drop shadow
  for (const j of span(2, SH - 2)) for (const i of span(2, SW - 2)) if (!solidAt(px, i, j) && (nearAt(px, NEAR1, i, j) || nearAt(px, NEAR2, i, j))) D(48 + i, 22 + j, 0x111111);   // a two-pixel outline
  for (const j of span(0, SH)) for (const i of span(0, SW)) if (solidAt(px, i, j)) D(48 + i, 22 + j, px[j * SW + i] & 0xffffff);
  for (const i of span(0, Math.max(0, f.ri - 1) * 2)) { const x = r(WW - 12) + 6, y = r(60) + 6; R(x - 2, y, 5, 1, 0x111111); R(x, y - 2, 1, 5, 0x111111); D(x, y, 0xffffff); }   // sparkles for the rare
}

// a theme's look for a card: its interface colours, rarity palette, creature palettes and dataset colours. A theme that says nothing uses the shared rarity palette.
const plainLook = (f, th) => ({ ui: th.ui, p: RAR[f.ri], body: th.body, acc: th.acc, dcol: DCOL });   // (the shared rarity palette, grey, green, blue, purple, gold)
/** Every published theme, by versioned id. APPEND ONLY: a published theme is never changed (a redesign is a new id). */
export const THEMES = Object.freeze({
  'synthwave-v1': Object.freeze({ id: 'synthwave-v1', name: 'Synthwave', blurb: 'A neon creature against a striped sun and a perspective grid.', ui: Object.freeze(UI_S), body: SYNTH_BODY, acc: SYNTH_ACC, scene: synthScene }),
  'blockcraft-v1': Object.freeze({ id: 'blockcraft-v1', name: 'Blockcraft', blurb: 'A blocky voxel creature on a grass island, drawn in isometric blocks.', ui: Object.freeze(UI_B), body: BLOCK_BODY, acc: BLOCK_ACC, scene: blockScene }),
  'lcd-v1': Object.freeze({ id: 'lcd-v1', name: 'Pocket LCD', blurb: 'A four-shade handheld screen: the creature dithered onto a brick battlefield, in the ramp of its rarity.', look: lcdLook, scene: lcdScene }),
  'memphis-v1': Object.freeze({ id: 'memphis-v1', name: 'Memphis Pop', blurb: 'Eighties pop: flat colour, confetti, a checker floor, a heavy outline and a hard shadow.', look: memphisLook, scene: memphisScene }),
});

/** The drawing kit, shared with the estate painter so both draw with one set of primitives: a padded integer canvas, rects,
 *  dots, the isometric cube, bitmaps, colour arithmetic and the deterministic dice. */
export const PIXEL = Object.freeze({ newCanvas, rect, dot, at, cube, blit, bitmap, mul, mix, rng, span, div, hash3, PAD });

/** A creature from the front at one pixel per voxel, in the blockcraft palette, for signs, chips and portraits.
 *  -> { ok: true, w: 9, h: 14, px: Uint8Array(9*14*4) RGBA, alpha 0 where there is no voxel } | { ok: false, why }. */
export function creatureFront(id) {
  if (!isId(id)) return no('id must be 16 lowercase hex characters');
  const sp = build(id), cc = classColors(BLOCK_BODY, BLOCK_ACC, UI_B.ink, sp.g), big = frontSprite(sp, (c, z) => mul(cc[c], 256 - (MZ - 1 - z) * 14)), px = new Uint8Array(MX * MY * 4);
  for (const y of span(0, MY)) for (const x of span(0, MX)) {
    const q = big[(y * 8 + 4) * SW + x * 8 + 4], o = (y * MX + x) * 4;
    if (q & FLAG) { px[o] = (q >> 16) & 255; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; px[o + 3] = 255; }
  }
  return { ok: true, w: MX, h: MY, px };
}

// -- the painter ----------------------------------------------------------------------------------------------------
/**
 * Draw a card's face. facts: { id, title, dataset, department, stage, rarity, generation, parents } as the DIGI card
 * defines them. -> { ok: true, px: Uint8Array(w*h*3) } (RGB rows, top to bottom) | { ok: false, why }. Never throws.
 */
export function paintArt(facts, themeId, w, h) {
  try {
    const c = checkFacts(facts);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !has(THEMES, themeId)) return no('unknown theme');
    if (!dim(w) || !dim(h)) return no('width and height must be whole numbers from 64 to 1024');
    const f = c.f, th = THEMES[themeId], look = (th.look || plainLook)(f, th), sp = build(f.id), cv = newCanvas();
    th.scene(cv, f, sp, look);
    chrome(cv, f, look);
    frame(cv, look.p, f.ri);
    const px = new Uint8Array(w * h * 3), cols = span(0, w).map((x) => div(x * LW, w));   // nearest pixel: at 384 x 560 every logical pixel is exactly 2 x 2
    span(0, h).forEach((y) => {
      const row = (div(y * LH, h) + PAD) * cv.cw + PAD;
      cols.forEach((cx, x) => { const q = cv.d[row + cx], o = (y * w + x) * 3; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; });
    });
    return { ok: true, px };
  } catch (e) { return no('the card could not be painted'); }
}
