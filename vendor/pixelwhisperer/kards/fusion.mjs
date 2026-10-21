// fusion.mjs - PixelWhisperer Fusion Lab: two cards fused into one, drawn from the fusion's own record and nothing else, so
// the same fusion gives the same picture (a replay can be checked against it); and a fused card's family tree, in blocks.
//
// Built by Kar for the PixelWhisperer repo. Powered by the Konomi architecture, created by Thomas Frumkin.
//
// DIGI's rule: two of one owner's cards are fused by trying children, up to twelve; the first child whose GATE beats BOTH
// parents is kept as the fused card, and if none does the fusion is refused. The record is what DIGI keeps of it: the parents'
// GATE, how many children were tried, and the fused card with its GATE when one was kept (a refusal may add the best child's
// GATE). The painter works the verdict out itself (fusionVerdict) and refuses a fused card that does not beat both, so it can
// never show one; a try it holds no score for is drawn as tried and not kept, never as a made-up bar. The parents stand on
// their rarity's pedestals either side, piped into the fusion chamber; under it every try has a slot against the line to beat
// (the better parent's GATE); the chamber shows the two fusing while it runs, then the fused card under a gold KEPT, or a red
// ribbon: REFUSED, NO FUSED CARD BEAT BOTH. paintLineage draws a fused card over its parents and theirs, three generations up,
// each card a block with its creature, and a card the device does not hold as a block marked "?". Integer arithmetic only,
// deterministic, total: bad input is { ok: false, why }, never a throw. One source: the canvas, palettes and creatures come
// from kardart.mjs, the lettering from ui.mjs.
import { RARITIES, RAR, PIXEL, THEMES, creatureFront } from './kardart.mjs';
import { GLYPHS } from './ui.mjs';

const { newCanvas, rect, dot, at, mul, mix, rng, span, div, PAD } = PIXEL;
const no = (why) => ({ ok: false, why });
const HEX = '0123456789abcdef', TITLE = " &'.-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const isId = (s) => typeof s === 'string' && s.length === 16 && Array.from(s).every((c) => HEX.includes(c));
const whole = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
/** The most children a fusion tries before it is refused (DIGI's MAX_TRIES). */
export const MAX_TRIES = 12;

function card(x, name) {   // a card in the lab: { id, rarity, gate (millionths), title? }
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return no(name + ' must be an object');
  const { id, rarity, title = '', gate } = x, ri = RARITIES.indexOf(rarity);
  if (!isId(id)) return no(name + ' id must be 16 lowercase hex characters');
  if (ri < 0) return no(name + ' rarity must be one of ' + RARITIES.join(', '));
  if (typeof title !== 'string' || title.length > 16 || !Array.from(title).every((ch) => TITLE.includes(ch))) return no(name + ' title must be at most 16 characters from A-Z a-z 0-9 space & . - and the apostrophe');
  if (!whole(gate, 1000000)) return no(name + ' gate must be a whole number of millionths from 0 to 1000000');
  return { ok: true, c: { id, rarity, ri, title, gate } };
}

/**
 * Check a fusion. fusion: { a: { id, rarity, gate, title? }, b: { ... } (the parents; GATE in whole millionths), tried: how many
 * children were tried (1 to 12), fused?: { id, rarity, gate, title? } (the fused card, when one was kept: the last child tried,
 * its GATE above both parents'), best?: when none was kept, the best child's GATE (at most the better parent's) or null for no
 * live child (leave it out when it is not known), decided?: how many tries are shown so far (default all) }.
 * -> { ok: true, f: { a, b, tried, fused (or null), best (a GATE, null, or undefined when not known), decided, beat } } | { ok: false, why }
 */
export function checkFusion(x) {
  try {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) return no('the fusion must be an object');
    const A = card(x.a, 'a');
    if (!A.ok) return A;
    const B = card(x.b, 'b');
    if (!B.ok) return B;
    if (A.c.id === B.c.id) return no('a card is not fused with itself');
    const { tried, fused = null, best } = x, beat = Math.max(A.c.gate, B.c.gate);
    if (!Number.isInteger(tried) || tried < 1 || tried > MAX_TRIES) return no('tried must be a whole number from 1 to 12');
    const F = fused === null ? { ok: true, c: null } : card(fused, 'the fused card');
    if (!F.ok) return F;
    if (F.c && [A.c.id, B.c.id].includes(F.c.id)) return no('the fused card is a new card, not one of its parents');
    if (F.c && F.c.gate <= beat) return no('a fused card beats both parents: its gate must be above both of theirs');
    if (F.c && best !== undefined) return no('best is for a refused fusion: a kept one shows its fused card\x27s GATE');
    if (best !== undefined && best !== null && !whole(best, beat)) return no('the best try of a refused fusion did not beat both parents: a whole number of millionths up to the better parent\x27s GATE, or null');
    const decided = x.decided === undefined ? tried : x.decided;
    if (!whole(decided, tried)) return no('decided must be a whole number from 0 to the number tried');
    return { ok: true, f: { a: A.c, b: B.c, tried, fused: F.c, best, decided, beat } };
  } catch (e) { return no('the fusion could not be read'); }
}

/** The published verdict: kept (true) when the fused card beat both parents, refused (false) when none did, null while the
 *  tries are still being shown. -> { ok: true, kept, beat, gate (the fused card's GATE once kept, else null), tried, tries } | { ok: false, why } */
export function fusionVerdict(x) {
  const c = checkFusion(x);
  if (!c.ok) return c;
  const { tried, decided, beat, fused } = c.f, kept = decided === tried ? fused !== null : null;
  return { ok: true, kept, beat, gate: kept ? fused.gate : null, tried: decided, tries: tried };
}

// how each theme dresses the lab: the wall, the floor, the lettering, the two parents' colours, the glass and steel, the bars
// (on the pocket screen every colour is chosen to land on one of its four shades exactly: black, 0x555555, 0xaaaaaa, white)
const LOOKS = {
  'synthwave-v1': { sky: [0x0a0420, 0x3a0d5e], floor: 0x1a0836, line: 0xff2bd6, panel: 0x120626, edge: 0xff2bd6, text: 0xffffff, shadow: 0x4a1480, left: 0x2be8ff, right: 0xff4fa3, glass: 0x7a5ad8, metal: 0x8a80a8, shine: 0xe0d8ff, form: 0xbff8ff, bar: 0x8a80a8, empty: 0x3a2466, wire: 0x2be8ff, pt: [0xffffff, 0x4a1480], star: 0xbff8ff },
  'blockcraft-v1': { sky: [0x56a0fa, 0xc6e6ff], floor: 0x84848c, line: 0x6a6a72, panel: 0x32323a, edge: 0x9a9aa8, text: 0xffffff, shadow: 0x14141a, left: 0x3c8cff, right: 0xff5a3c, glass: 0xc6e6ff, metal: 0x9a9aa8, shine: 0xffffff, form: 0x14141a, bar: 0x9a9aa8, empty: 0x54545e, wire: 0x8a5a33, pt: [0xffffff, 0x14141a], cloud: 0xffffff },
  'lcd-v1': { sky: [0xaaaaaa, 0xaaaaaa], floor: 0x555555, line: 0x000000, panel: 0x000000, edge: 0x555555, text: 0xffffff, shadow: 0x000000, left: 0xffffff, right: 0xaaaaaa, glass: 0xffffff, metal: 0x555555, shine: 0xffffff, form: 0x000000, bar: 0xaaaaaa, empty: 0x555555, wire: 0x000000, pt: [0xffffff, 0x000000], cloud: 0xffffff, lcd: [0x0f1210, 0x4a5048, 0x9aa095, 0xd8dccf] },
  'memphis-v1': { sky: [0xffe14a, 0xffe14a], floor: 0xffffff, line: 0x111111, panel: 0x1b1740, edge: 0xff4fa3, text: 0x111111, shadow: 0xffffff, left: 0x2d9cff, right: 0xff4fa3, glass: 0xffffff, metal: 0x111111, shine: 0xffffff, form: 0x1b1740, bar: 0xd7dbe4, empty: 0x3a3466, wire: 0x111111, pt: [0xffffff, 0x111111], confetti: [0x111111, 0xffffff, 0xff4fa3, 0x2d9cff] },
  'blueprint-v1': { sky: [0x0e3b78, 0x0e3b78], floor: 0x0b2f60, line: 0x3468b0, panel: 0x061a38, edge: 0x5d93d8, text: 0xeef5ff, shadow: 0x061a38, left: 0x7ff0ff, right: 0xfff35a, glass: 0x3468b0, metal: 0x9cc3f0, shine: 0xeef5ff, form: 0xeef5ff, bar: 0x5d93d8, empty: 0x1c4f92, wire: 0x9cc3f0, pt: [0xeef5ff, 0x061a38], grid: [0x1c4f92, 0x3468b0], ramp: [0x0e3b78, 0x3468b0, 0x9cc3f0, 0xeef5ff] },
};
const inked = (L, c) => (L.ramp ? L.ramp[(((c >> 16) & 255) * 77 + ((c >> 8) & 255) * 150 + (c & 255) * 29) >> 14] : c);   // a drawing inks every colour in one of four blues, by brightness
const BAY = [0, 128, 32, 160, 192, 64, 224, 96, 48, 176, 16, 144, 240, 112, 208, 80];
const W = 240, FLOOR = 96, PANEL = 104, S = 4, GOLD = [0xffd23c, 0x8a6214];   // the lab is 240 x 160: creatures stand on the floor at 4 px per voxel
const HW = [6, 11, 14, 16, 18, 19, 20, 21, 22, 22, ...span(0, 52).map(() => 22)];   // the chamber's half-width, row by row from the top of its dome
const fmt = (n) => div(n, 1000000) + '.' + String(10000 + div(n % 1000000, 100)).slice(1);   // millionths as 0.0000, as the raids print them
const tall = (g, beat) => Math.min(36, Math.max(1, div((g - beat + 20000) * 36, 40000)));   // a bar's height: the line to beat sits halfway, 0.02 either side fills it

function letters(cv, s, x, y, c, sh, k = 1) {   // the UI font at k pixels per cell, with a drop shadow
  for (const [col, off] of [[sh, k], [c, 0]]) Array.from(s).forEach((ch, n) => (GLYPHS[ch] || GLYPHS[' ']).forEach((row, r) => Array.from(row).forEach((cell, q) => { if (cell === '#') rect(cv, x + (n * 6 + q) * k + off, y + r * k + off, k, k, col); })));
}
const width = (s, k = 1) => (s.length * 6 - 1) * k;
const centred = (cv, s, cx, y, c, sh, k = 1) => letters(cv, s, cx - div(width(s, k), 2), y, c, sh, k);
const voxel = (fr, q) => (fr.px[q * 4] << 16) | (fr.px[q * 4 + 1] << 8) | fr.px[q * 4 + 2];

// The canvas is a whole number of 240-wide stretches, every one decorated alike, with the scene in the middle one: at any width or
// height the scene itself looks exactly the same, and nothing is ever drawn outside the canvas.
function backdrop(cv, L, fw, lh, oy, seed, lab) {
  const top = lab ? FLOOR : 160;   // the lab has a floor and a panel; a family tree is all wall
  rect(cv, 0, 0, fw, oy, L.sky[0]);
  for (const y of span(0, top)) rect(cv, 0, oy + y, fw, 1, mix(L.sky[0], L.sky[1], div(y * 256, top)));
  rect(cv, 0, oy + top, fw, lh - oy - top, lab ? L.panel : L.sky[1]);
  if (L.grid) { for (const x of span(4, fw, 8)) rect(cv, x, 0, 1, oy + top, (x - 4) % 40 ? L.grid[0] : L.grid[1]); for (const y of span(4, oy + top, 8)) rect(cv, 0, y, fw, 1, (y - 4) % 40 ? L.grid[0] : L.grid[1]); }   // grid paper
  for (const x0 of span(0, fw, W)) {   // the wall's decoration, the same in every stretch
    const r = rng(seed, 11);
    if (L.star) for (const n of span(0, 36)) dot(cv, x0 + r(W), oy + r(top - 8), L.star);
    if (L.cloud) for (const n of span(0, 3)) { const x = x0 + r(W - 30), y = oy + 8 + r(div(top, 3)); rect(cv, x, y, 28, 5, L.cloud); rect(cv, x + 6, y - 4, 14, 4, L.cloud); }
    if (L.confetti) for (const n of span(0, 30)) rect(cv, x0 + r(W - 2), oy + r(top - 8), 2, 2, L.confetti[r(4)]);
  }
  if (lab) {   // the lab floor, ruled, and the panel's edge
    rect(cv, 0, oy + FLOOR, fw, PANEL - FLOOR, L.floor);
    for (const x of span(0, fw, 12)) rect(cv, x, oy + FLOOR, 1, PANEL - FLOOR, L.line);
    rect(cv, 0, oy + PANEL, fw, 1, L.edge);
  }
}

const short = (s) => (s.length > 13 ? s.slice(0, 12) + '\u2026' : s);   // a title in its side of the lab: 13 characters, or 12 and an ellipsis
function parent(cv, p, x0, tag, col, L, tx) {   // a parent on its rarity's pedestal, its GATE on a badge over it, its title above in its own side
  const R = RAR[p.ri], fr = creatureFront(p.id), cx = x0 + 18, t = tag + ' ' + fmt(p.gate);
  rect(cv, x0 - 4, FLOOR - 3, 44, 3, R.hi); rect(cv, x0 - 4, FLOOR, 44, 2, R.lo);
  for (const q of span(0, 126)) if (fr.px[q * 4 + 3]) rect(cv, x0 + (q % 9) * S, FLOOR - 59 + div(q, 9) * S, S, S, inked(L, voxel(fr, q)));
  rect(cv, cx - 26, 22, 52, 11, R.lo); rect(cv, cx - 26, 22, 52, 1, col); rect(cv, cx - 26, 32, 52, 1, col);
  centred(cv, t, cx, 23, 0xffffff, R.lo);
  if (p.title) letters(cv, short(p.title), tx(width(short(p.title))), 9, L.text, L.shadow);
}

/**
 * Draw a fusion. fusion as checkFusion takes it; themeId one of THEMES; w, h whole numbers from 64 to 2048. The picture is a
 * 240 x 160 pixel-art canvas at the largest whole scale that fits, each logical pixel a k x k block.
 * -> { ok: true, px: Uint8Array(w*h*3) RGB rows, scale: k } | { ok: false, why }. Never throws.
 */
export function paintFusion(fusion, themeId, w, h) {
  try {
    const c = checkFusion(fusion);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return no('unknown theme');
    if (!whole(w, 2048) || !whole(h, 2048) || w < 64 || h < 64) return no('width and height must be whole numbers from 64 to 2048');
    const F = c.f, L = LOOKS[themeId], k = Math.max(1, Math.min(div(w, 240), div(h, 160))), lw = div(w + k - 1, k), lh = Math.max(160, div(h + k - 1, k));
    const n = div(lw, W), FW = W * (2 * n + 1), oy = div(lh - 160, 2), full = newCanvas(FW, lh);
    const seed = Array.from(F.a.id + F.b.id).reduce((a, ch) => Math.imul(a ^ HEX.indexOf(ch), 0x9e3779b1) >>> 0, 0x2545f491);   // the parents' wall: it stays put as the tries run
    backdrop(full, L, FW, lh, oy, seed, true);
    const cv = { cw: full.cw, d: full.d.subarray(oy * full.cw + n * W) };   // the lab itself, 240 x 160, in the middle on the same pixels
    const V = fusionVerdict(fusion);

    // the pipes from each pedestal into the chamber; while it fuses, light runs along them
    for (const [x0, x1, col] of [[52, 99, L.left], [142, 188, L.right]]) {
      rect(cv, x0, 74, x1 - x0, 5, L.metal); rect(cv, x0, 75, x1 - x0, 3, mul(col, 110));
      if (V.kept === null) for (const q of span(0, 4)) rect(cv, x0 + (F.decided * 7 + q * 12) % (x1 - x0 - 2), 76, 2, 1, col);
    }
    parent(cv, F.a, 16, 'A', L.left, L, () => 3); parent(cv, F.b, 188, 'B', L.right, L, (tw) => 237 - tw);

    // the chamber: the glass tints the wall behind it, then what is inside, then its steel and its glint
    for (const y of span(0, 62)) for (const x of span(120 - HW[y], 121 + HW[y])) dot(cv, x, 30 + y, mix(at(cv, x, 30 + y), L.glass, 104));
    if (V.kept) {   // the fused card stands in the chamber
      const fr = creatureFront(F.fused.id);
      for (const q of span(0, 126)) if (fr.px[q * 4 + 3]) rect(cv, 102 + (q % 9) * S, 36 + div(q, 9) * S, S, S, inked(L, voxel(fr, q)));
    }
    if (V.kept === null && F.decided) {   // the two fusing: each voxel from one parent or the other, in turn, as one silhouette
      const fa = creatureFront(F.a.id), fb = creatureFront(F.b.id);
      for (const q of span(0, 126)) { const fr = (q % 9 + div(q, 9) + F.decided) % 2 ? fb : fa; if (fr.px[q * 4 + 3]) rect(cv, 102 + (q % 9) * S, 36 + div(q, 9) * S, S, S, L.form); }
    }
    for (const y of span(0, 62)) { dot(cv, 120 - HW[y], 30 + y, L.metal); dot(cv, 120 + HW[y], 30 + y, L.metal); }
    for (const y of span(40, 88, 3)) dot(cv, 104, y, L.shine);
    rect(cv, 96, 92, 49, 4, L.metal); rect(cv, 96, 92, 49, 1, L.shine); rect(cv, 117, 27, 7, 3, L.metal);   // the base and the cap
    if (V.kept) { rect(cv, 98, 95, 45, 1, RAR[F.fused.ri].hi); if (F.fused.title) centred(cv, F.fused.title, 120, 97, L.text, L.shadow); }

    // the panel: a slot for each try against the line to beat (the better parent's GATE), each parent's GATE ticked at the side
    const yb = 146;
    for (const x of span(44, 197, 4)) rect(cv, x, yb - 18, 2, 1, GOLD[0]);
    for (const [g, x, lx, tag, col] of [[F.a.gate, 36, 29, 'A', L.left], [F.b.gate, 198, 205, 'B', L.right]]) {
      rect(cv, x, yb - tall(g, F.beat), 6, 1, col);
      letters(cv, tag, lx, yb - tall(g, F.beat) - 4, col, L.pt[1]);
    }
    if (V.kept === false && Number.isInteger(F.best)) for (const x of span(46, 195, 6)) rect(cv, x, yb - tall(F.best, F.beat), 3, 1, L.bar);   // a refusal's best child, at or under the line
    span(0, MAX_TRIES).forEach((m) => {
      const x = 48 + m * 12;
      if (V.kept && m === F.tried - 1) rect(cv, x, yb - tall(V.gate, F.beat), 8, tall(V.gate, F.beat), GOLD[0]);   // the kept try, over the line at its own GATE
      else if (m < F.decided) { rect(cv, x, yb - 6, 8, 6, L.bar); rect(cv, x + 2, yb - 4, 4, 2, L.empty); }   // tried, and did not beat both (its score is not drawn: DIGI keeps none)
      else if (m < F.tried) rect(cv, x, yb - 2, 8, 2, L.empty);   // tried, not yet shown
      else rect(cv, x + 3, yb - 1, 2, 1, L.empty);   // never tried
    });
    letters(cv, 'BEAT ' + fmt(F.beat), 4, 150, L.pt[0], L.pt[1]);
    centred(cv, 'TRY ' + F.decided + '/' + F.tried, 120, 150, L.pt[0], L.pt[1]);
    const end = V.kept ? 'GATE ' + fmt(V.gate) : V.kept === false && F.best === null ? 'NO LIVE CHILD' : V.kept === false && F.best !== undefined ? 'BEST ' + fmt(F.best) : '';
    letters(cv, end, 236 - width(end), 150, L.pt[0], L.pt[1]);

    // the verdict over the chamber
    if (V.kept === null) centred(cv, F.decided ? 'FUSING' : 'READY', 120, 4, L.text, L.shadow, 2);
    if (V.kept) {   // a gold stamp: KEPT, a fused card
      rect(cv, 84, 1, 72, 26, GOLD[0]); rect(cv, 84, 1, 72, 1, 0xffffff); rect(cv, 84, 26, 72, 1, GOLD[1]); rect(cv, 84, 1, 1, 26, 0xfff1a8); rect(cv, 155, 1, 1, 26, GOLD[1]);
      centred(cv, 'KEPT', 120, 3, 0xffffff, GOLD[1], 2);
      centred(cv, 'A FUSED CARD', 120, 18, GOLD[1], 0xfff1a8);
    }
    if (V.kept === false) {   // refused: a red ribbon across the lab
      rect(cv, 0, 44, W, 32, 0x7a1020); rect(cv, 0, 44, W, 2, 0xff5a5a); rect(cv, 0, 74, W, 2, 0xff5a5a);
      for (const x of span(0, W, 8)) for (const q of span(0, 4)) { dot(cv, x + q, 47 + q, 0x9a2030); dot(cv, x + q + 4, 72 - q, 0x9a2030); }
      centred(cv, 'REFUSED', 120, 47, 0xffffff, 0x3a0810, 2);
      centred(cv, 'NO FUSED CARD BEAT BOTH', 120, 64, 0xffd0d0, 0x3a0810);
    }
    return { ok: true, ...finish(full, L, lw, lh, FW, n, w, h, k) };
  } catch (e) { return no('the fusion could not be painted'); }
}

function finish(full, L, lw, lh, FW, n, w, h, k) {   // the pocket screen's shades, then the scene in the middle of the picture, k x k a pixel
  if (L.lcd) for (const y of span(0, lh)) for (const x of span(0, FW)) {
    const q = at(full, x, y), v = (((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 8, s3 = v * 3;
    dot(full, x, y, L.lcd[(s3 >> 8) + ((s3 & 255) > BAY[((y & 3) << 2) + (x & 3)] ? 1 : 0)]);
  }
  const sx = n * W + div(W - lw, 2), px = new Uint8Array(w * h * 3);   // narrower than the scene: its middle shows
  span(0, h).forEach((y) => {
    const row = (div(y, k) + PAD) * full.cw + PAD + sx;
    span(0, w).forEach((x) => { const q = full.d[row + div(x, k)], o = (y * w + x) * 3; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; });
  });
  return { px, scale: k };
}

/**
 * Check a family tree. tree: { id, rarity, parents?: [tree, tree] } (a card, and the two it was fused from, if it was), at most
 * four generations: the card and three above it. A card the device does not hold is { id } alone, with no rarity and no parents:
 * it is drawn as unknown, never invented. -> { ok: true, t: { id, ri (null: not held here), parents } } | { ok: false, why }
 */
export function checkLineage(x) {
  try {
    const walk = (node, depth) => {
      if (typeof node !== 'object' || node === null || Array.isArray(node)) return no('every card in the tree must be an object');
      const { id, rarity, parents = [] } = node, held = rarity !== undefined, ri = RARITIES.indexOf(rarity);
      if (!isId(id)) return no('every card id must be 16 lowercase hex characters');
      if (held && ri < 0) return no('every rarity must be one of ' + RARITIES.join(', ') + ' (or none, for a card this device does not hold)');
      if (!Array.isArray(parents) || (parents.length !== 0 && parents.length !== 2)) return no('a card has two parents, or none');
      if (!held && parents.length) return no('a card this device does not hold is drawn alone: its parents are not known here');
      if (parents.length && depth === 3) return no('a tree shows four generations: the card and three above it');
      const ps = [];
      for (const p of parents) { const r = walk(p, depth + 1); if (!r.ok) return r; ps.push(r.t); }
      if (ps.length && ps[0].id === ps[1].id) return no('a card is not fused with itself');
      if (ps.some((p) => p.id === id)) return no('a card is not its own parent');
      return { ok: true, t: { id, ri: held ? ri : null, parents: ps } };
    };
    return walk(x, 0);
  } catch (e) { return no('the tree could not be read'); }
}

/**
 * Draw a family tree: the card at the top, its two parents under it, theirs under them, each a block in its rarity with its
 * creature, joined by wires; a card the device does not hold is a dashed block with a question mark. tree as checkLineage takes it; themeId, w, h as paintFusion.
 * -> { ok: true, px, scale } | { ok: false, why }. Never throws.
 */
export function paintLineage(tree, themeId, w, h) {
  try {
    const c = checkLineage(tree);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return no('unknown theme');
    if (!whole(w, 2048) || !whole(h, 2048) || w < 64 || h < 64) return no('width and height must be whole numbers from 64 to 2048');
    const L = LOOKS[themeId], k = Math.max(1, Math.min(div(w, 240), div(h, 160))), lw = div(w + k - 1, k), lh = Math.max(160, div(h + k - 1, k));
    const n = div(lw, W), FW = W * (2 * n + 1), oy = div(lh - 160, 2), full = newCanvas(FW, lh);
    backdrop(full, L, FW, lh, oy, Array.from(c.t.id).reduce((a, ch) => Math.imul(a ^ HEX.indexOf(ch), 0x9e3779b1) >>> 0, 0x2545f491), false);
    const cv = { cw: full.cw, d: full.d.subarray(oy * full.cw + n * W) };
    const draw = (t, g, s) => {   // generation g (0 at the top), slot s across it: a 20 x 30 block, centred over its column
      const cx = 8 + div(224 * (2 * s + 1), 2 << g), y = 4 + g * 40;
      if (t.ri === null) {   // not held here: a dashed outline and a question mark, nothing invented
        for (const q of span(0, 20, 2)) { dot(cv, cx - 10 + q, y, L.wire); dot(cv, cx - 10 + q, y + 29, L.wire); }
        for (const q of span(0, 30, 2)) { dot(cv, cx - 10, y + q, L.wire); dot(cv, cx + 9, y + q, L.wire); }
        centred(cv, '?', cx, y + 8, L.text, L.shadow, 2);
        return;
      }
      const R = RAR[t.ri], fr = creatureFront(t.id);
      if (t.parents.length) {   // wires down to its two parents
        const l = 8 + div(224 * (4 * s + 1), 4 << g), r = 8 + div(224 * (4 * s + 3), 4 << g);
        rect(cv, cx, y + 30, 1, 5, L.wire); rect(cv, l, y + 35, r - l + 1, 1, L.wire); rect(cv, l, y + 35, 1, 5, L.wire); rect(cv, r, y + 35, 1, 5, L.wire);
        t.parents.forEach((p, m) => draw(p, g + 1, 2 * s + m));
      }
      rect(cv, cx - 10, y, 20, 30, R.hi); rect(cv, cx - 9, y + 1, 18, 28, inked(L, R.lo));
      for (const q of span(0, 126)) if (fr.px[q * 4 + 3]) rect(cv, cx - 9 + (q % 9) * 2, y + 1 + div(q, 9) * 2, 2, 2, inked(L, voxel(fr, q)));
    };
    draw(c.t, 0, 0);
    if (c.t.parents.length) { const g0 = GOLD[0]; rect(cv, 108, 2, 24, 1, g0); rect(cv, 108, 35, 24, 1, g0); rect(cv, 108, 2, 1, 34, g0); rect(cv, 131, 2, 1, 34, g0); }   // a fused card: a gold ring
    return { ok: true, ...finish(full, L, lw, lh, FW, n, w, h, k) };
  } catch (e) { return no('the tree could not be painted'); }
}
