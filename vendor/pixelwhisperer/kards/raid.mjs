// raid.mjs - PixelWhisperer Raids: the bosses are the departments no card has yet cleared the 0.6 bar on, drawn from the
// raid's own record and nothing else, so the same raid gives the same picture.
//
// Built by Kar for the PixelWhisperer repo. Powered by the Konomi architecture, created by Thomas Frumkin.
//
// Eight bosses, one per department that never cleared 0.6: five in the hospital (admissions, clinical, pharmacy, history,
// discharge), bank credit, adult employer and credit billing. Each is a 32 x 32 sprite built from rectangles and ellipses,
// then shaded and outlined by one rule so all eight share a style. A boss's health is its distance to the bar, the
// published rule bossHealth(best) = max(0, 600000 - best) in millionths of GATE; the bar is full at chance (0.5) and empty
// at 0.6. When a card's GATE reaches 0.6 the boss falls, and the loot is that first card of its department. Integer
// arithmetic only, deterministic, total: bad input is { ok: false, why }, never a throw. One source: the canvas, palettes
// and creatures come from kardart.mjs, the lettering from ui.mjs.
import { RARITIES, RAR, PIXEL, THEMES, creatureFront } from './kardart.mjs';
import { GLYPHS } from './ui.mjs';

const { newCanvas, rect, dot, at, mul, mix, rng, span, div, PAD } = PIXEL;
const no = (why) => ({ ok: false, why });
const HEX = '0123456789abcdef', TITLE = " &'.-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const isId = (s) => typeof s === 'string' && s.length === 16 && Array.from(s).every((c) => HEX.indexOf(c) >= 0);
const whole = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;

// -- the bosses: each a drawing on a 32 x 32 grid of palette slots (0 none, 1 ink, 2 body, 3 body shade, 4 accent,
// 5 second accent, 6 glow, 7 white, 8 body light). R a rectangle, M a rectangle and its mirror, E an ellipse (centre and
// radii in half pixels, so a shape can sit on the grid's centre line), P one cell.
const BOSS_ART = [
  { key: 'hospital-admissions', name: 'THE WAITING ROOM', pal: [0x5a8fd6, 0xff4a4a, 0xc8a064, 0xffe14a], draw: (R, M, E, P) => {
    R(14, 1, 4, 3, 4); R(15, 4, 2, 1, 1);                                   // the NOW SERVING lamp
    R(8, 5, 16, 9, 2); M(10, 8, 4, 2, 6); M(12, 7, 2, 1, 1); R(13, 11, 6, 1, 1);   // head, eyes, brows, mouth
    R(5, 14, 22, 13, 2); R(9, 16, 14, 6, 1); M(10, 17, 3, 4, 4); R(15, 18, 2, 1, 4); R(15, 20, 2, 1, 4);   // body and its number display
    R(12, 23, 8, 1, 1); R(13, 24, 6, 6, 7); R(14, 26, 4, 1, 1); R(14, 28, 3, 1, 1);   // the ticket it never stops printing
    M(1, 15, 4, 9, 5); M(2, 14, 2, 1, 1); M(2, 18, 2, 1, 1); M(2, 20, 2, 1, 1);       // clipboards for hands
    M(8, 27, 5, 4, 2);
  } },
  { key: 'hospital-clinical', name: 'THE TRIAGE EYE', pal: [0x3cb4a0, 0xff4a6a, 0x9aa3b2, 0x50e6ff], draw: (R, M, E, P) => {
    E(31, 30, 26, 24, 2);                                                   // the body: one great blob
    R(15, 2, 2, 6, 4); R(13, 4, 6, 2, 4);                                   // a red cross on its brow
    R(10, 8, 12, 1, 1); E(31, 30, 14, 12, 7); E(31, 30, 9, 9, 6); E(31, 30, 4, 4, 1); P(17, 13, 7);   // a lid, then the eye
    M(8, 20, 1, 5, 5); R(8, 24, 16, 1, 5); R(15, 25, 2, 2, 5);              // the stethoscope
    M(5, 25, 3, 6, 2); M(10, 26, 3, 5, 2);                                  // tentacles
  } },
  { key: 'hospital-pharmacy', name: 'THE PILL GOLEM', pal: [0xe8443a, 0x4a8cff, 0xf2f2e6, 0x14141a], draw: (R, M, E, P) => {
    E(31, 18, 18, 14, 2); R(7, 9, 18, 8, 2);                                // the red half of the capsule
    R(7, 17, 18, 6, 7); E(31, 44, 18, 12, 7); R(7, 16, 18, 1, 1);           // its white half and the seam
    M(10, 10, 3, 3, 7); M(11, 11, 1, 2, 1); M(9, 8, 4, 1, 1); R(12, 19, 8, 2, 1); M(13, 19, 1, 1, 7);   // eyes, brows, a grim mouth
    M(1, 14, 3, 4, 4); M(4, 14, 3, 4, 7);                                   // arms: two more capsules
    M(10, 27, 4, 3, 4); M(2, 4, 4, 2, 4); M(4, 7, 2, 2, 7);                 // feet, and pills in orbit
  } },
  { key: 'hospital-history', name: 'THE CHART LICH', pal: [0x5a4a7a, 0xe8d8a8, 0x8a6a3a, 0x7aff6a], draw: (R, M, E, P) => {
    E(31, 20, 16, 16, 2);                                                   // the hood
    for (const y of span(12, 31)) { const half = 5 + div(y - 12, 2); R(16 - half, y, 2 * half, 1, 2); }   // the robe, widening to the floor
    E(31, 22, 10, 10, 1); M(12, 10, 2, 2, 6);                               // no face, two green eyes
    R(6, 20, 20, 7, 4); M(4, 19, 2, 9, 5); R(8, 22, 12, 1, 1); R(8, 24, 15, 1, 1); M(6, 18, 2, 2, 7);   // the chart it reads from, bony fingers
    R(1, 6, 4, 5, 4); R(2, 8, 2, 1, 1); R(27, 4, 4, 5, 4); R(28, 6, 2, 1, 1);   // loose pages, floating
  } },
  { key: 'hospital-discharge', name: 'THE REVOLVING DOOR', pal: [0x7a5a3a, 0x3cdc6e, 0x9aa3b2, 0xffe14a], draw: (R, M, E, P) => {
    R(10, 1, 12, 4, 4); R(12, 2, 8, 2, 7);                                  // the EXIT sign
    R(7, 6, 18, 21, 5); R(9, 8, 14, 19, 2);                                 // frame and door
    R(11, 10, 10, 6, 1); M(13, 12, 2, 2, 6); M(11, 18, 4, 6, 3); R(20, 21, 2, 2, 6);   // its window, eyes in the dark, panels, handle
    M(1, 13, 6, 3, 2); M(1, 11, 2, 3, 2);                                   // arms reaching out
    M(9, 27, 3, 3, 2); R(14, 27, 4, 4, 2);                                  // a ghost's tail under it
  } },
  { key: 'bank-credit', name: 'THE VAULT WYRM', pal: [0x2e8b57, 0xd4af37, 0x9aa3b2, 0xff4a2a], draw: (R, M, E, P) => {
    M(5, 1, 3, 6, 4);                                                       // horns of gold
    E(31, 22, 22, 16, 2); M(9, 8, 4, 2, 6); M(8, 7, 5, 1, 1);               // head, eyes, brows
    R(11, 13, 10, 5, 3); M(13, 14, 1, 1, 1); M(11, 18, 1, 1, 7); M(13, 18, 1, 1, 7);   // snout, nostrils, teeth
    M(1, 12, 7, 2, 2); M(1, 14, 5, 2, 2); M(2, 16, 4, 2, 2); M(3, 18, 3, 2, 2);   // wings
    R(8, 19, 16, 11, 2); E(31, 50, 12, 12, 5); E(31, 50, 8, 8, 4); E(31, 50, 4, 4, 1);   // its belly is a vault door
  } },
  { key: 'adult-employer', name: 'THE BRIEFCASE TITAN', pal: [0x2a2e3a, 0x8a5a2a, 0xd4af37, 0xff4a2a], draw: (R, M, E, P) => {
    R(12, 1, 8, 2, 1); M(11, 2, 2, 3, 1);                                   // the handle
    R(5, 4, 22, 12, 4); M(8, 5, 3, 2, 5); R(5, 9, 22, 1, 1); M(9, 11, 4, 2, 6);   // a briefcase for a head, clasps, eyes
    R(6, 16, 20, 12, 2); R(14, 16, 4, 7, 7); R(15, 17, 2, 8, 6); M(11, 16, 3, 6, 3);   // the suit, the shirt, the tie
    M(1, 16, 5, 11, 2); M(1, 27, 5, 3, 4); M(8, 28, 6, 3, 2);               // arms, fists, legs
  } },
  { key: 'credit-billing', name: 'THE INVOICE HYDRA', pal: [0x6a3a8a, 0xf4f0e0, 0xff4a8a, 0xffe14a], draw: (R, M, E, P) => {
    E(31, 50, 24, 10, 2); M(9, 24, 3, 2, 5);                                // the body
    R(14, 7, 4, 15, 4); M(6, 11, 3, 11, 4);                                 // three necks of paper tape
    for (const y of [9, 12, 15, 18]) R(15, y, 2, 1, 1);
    for (const y of [13, 16, 19]) M(7, y, 1, 1, 1);                         // lines of charges printed on them
    R(11, 2, 10, 7, 2); M(13, 4, 2, 2, 6); R(13, 7, 6, 1, 1);               // the middle head
    M(3, 6, 8, 6, 2); M(5, 8, 1, 1, 6); M(8, 8, 1, 1, 6); M(5, 10, 4, 1, 1);   // and the two either side
  } },
];

function grid(draw) {   // run a boss's drawing, then shade its body (lit from the top left) and outline everything in ink
  const g = new Uint8Array(34 * 34), at = (x, y) => y * 34 + x + 35;   // a margin of one empty cell all round: every neighbour can be read
  const R = (x, y, w, h, c) => { for (const yy of span(y, y + h)) for (const xx of span(x, x + w)) g[at(xx, yy)] = c; };
  const M = (x, y, w, h, c) => { R(x, y, w, h, c); R(32 - x - w, y, w, h, c); };
  const E = (cx2, cy2, rx2, ry2, c) => {
    for (const y of span(0, 32)) for (const x of span(0, 32)) { const dx = 2 * x + 1 - cx2, dy = 2 * y + 1 - cy2; if (dx * dx * ry2 * ry2 + dy * dy * rx2 * rx2 <= rx2 * rx2 * ry2 * ry2) g[at(x, y)] = c; }
  };
  draw(R, M, E, (x, y, c) => { g[at(x, y)] = c; });
  const out = new Uint8Array(32 * 32);
  for (const y of span(0, 32)) for (const x of span(0, 32)) {
    const c = g[at(x, y)], near = (dx, dy) => g[at(x + dx, y + dy)];
    if (c === 2) out[y * 32 + x] = !near(1, 0) || !near(0, 1) ? 3 : !near(-1, 0) || !near(0, -1) ? 8 : 2;
    else out[y * 32 + x] = c || (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1) ? 1 : 0);
  }
  return out;
}
const colorsOf = (pal) => [0, 0x14101c, pal[0], mul(pal[0], 160), pal[1], pal[2], pal[3], 0xf4f4f4, mix(pal[0], 0xffffff, 80)];
const ART = BOSS_ART.map((b) => ({ ...b, g: grid(b.draw), col: colorsOf(b.pal) }));
const BY = Object.fromEntries(ART.map((b) => [b.key, b]));

/** The eight bosses, one per department that never cleared 0.6: { key: 'dataset-department', dataset, department, name }. */
export const BOSSES = Object.freeze(ART.map((b) => Object.freeze({ key: b.key, dataset: b.key.slice(0, b.key.indexOf('-')), department: b.key.slice(b.key.indexOf('-') + 1), name: b.name })));
/** The published rule: a boss's health is its distance to the bar, in millionths of GATE: max(0, 600000 - best). No score yet is
 *  a distance of the whole bar (600000). best: a whole number from 0 to 1000000, or null; anything else is null. */
export function bossHealth(best) {
  if (best === null) return 600000;
  return whole(best, 1000000) ? Math.max(0, 600000 - best) : null;
}
/** A boss's sprite: { ok: true, w: 32 * scale, h: 32 * scale, px: RGBA, transparent around it } | { ok: false, why }. */
export function bossSprite(key, scale = 1) {
  if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(BY, key)) return no('the boss must be one of ' + BOSSES.map((b) => b.key).join(', '));
  if (!Number.isInteger(scale) || scale < 1 || scale > 16) return no('scale must be a whole number from 1 to 16');
  const b = BY[key], side = 32 * scale, px = new Uint8Array(side * side * 4);
  for (const y of span(0, side)) for (const x of span(0, side)) {
    const c = b.g[div(y, scale) * 32 + div(x, scale)], o = (y * side + x) * 4;
    if (c) { const q = b.col[c]; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; px[o + 3] = 255; }
  }
  return { ok: true, w: side, h: side, px };
}

/**
 * Check a raid. raid: { dataset, department (one of the eight bosses), best: GATE in millionths 0-1000000 or null (no score
 * yet), attempts?: 0-99999, loot?: { id, rarity, title? } (the first card to clear the bar: given exactly when best >= 600000) }.
 * -> { ok: true, r } | { ok: false, why }
 */
export function checkRaid(x) {
  try {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) return no('the raid must be an object');
    const { dataset, department, best, attempts = 0, loot } = x, key = dataset + '-' + department;
    if (typeof dataset !== 'string' || typeof department !== 'string' || !Object.prototype.hasOwnProperty.call(BY, key)) return no('the boss must be one of ' + BOSSES.map((b) => b.key).join(', '));
    if (best !== null && !whole(best, 1000000)) return no('best must be a whole number of millionths from 0 to 1000000, or null');
    if (!whole(attempts, 99999)) return no('attempts must be a whole number from 0 to 99999');
    const fallen = best !== null && best >= 600000;
    if (fallen !== (loot !== undefined)) return no(fallen ? 'a fallen boss leaves loot: the first card to clear the bar' : 'loot comes only when the boss falls');
    if (!fallen) return { ok: true, r: { key, best, attempts, loot: null } };
    if (typeof loot !== 'object' || loot === null || Array.isArray(loot)) return no('loot must be an object');
    const { id, rarity, title = '' } = loot, ri = RARITIES.indexOf(rarity);
    if (!isId(id)) return no('the loot id must be 16 lowercase hex characters');
    if (ri < 0) return no('the loot rarity must be one of ' + RARITIES.join(', '));
    if (typeof title !== 'string' || title.length > 24 || !Array.from(title).every((ch) => TITLE.indexOf(ch) >= 0)) return no('the loot title must be at most 24 characters from A-Z a-z 0-9 space & . - and the apostrophe');
    return { ok: true, r: { key, best, attempts, loot: { id, rarity, ri, title } } };
  } catch (e) { return no('the raid could not be read'); }
}

// how each theme lights the raid: a darker sky than the arena's, the bar and the lettering (pocket-screen colours sit on its four shades)
const LOOKS = {
  'synthwave-v1': { sky: [0x05010f, 0x3a0d5c], floor: 0x1a0836, line: 0xff2bd6, text: 0xffffff, shadow: 0x4a1480, dim: 0x9c84c8, bar: 0xff3c5a, barBack: 0x2a0a1a, frame: 0xffffff, gold: 0xffd23c, star: 0xbff8ff },
  'blockcraft-v1': { sky: [0x070b2a, 0x2f47a4], floor: 0x5a5a62, line: 0x46464e, text: 0xffffff, shadow: 0x14141a, dim: 0xb8bcc8, bar: 0xe8302a, barBack: 0x2a1a1a, frame: 0xd8dce4, gold: 0xffd84a, star: 0xe8ecff },
  'lcd-v1': { sky: [0x555555, 0x555555], floor: 0xaaaaaa, line: 0x000000, text: 0xffffff, shadow: 0x000000, dim: 0xaaaaaa, bar: 0xffffff, barBack: 0x000000, frame: 0xffffff, gold: 0xffffff, star: 0xaaaaaa, lcd: [0x0f1210, 0x4a5048, 0x9aa095, 0xd8dccf] },
  'memphis-v1': { sky: [0x7a4bff, 0x7a4bff], floor: 0x1b1740, line: 0xff4fa3, text: 0xffffff, shadow: 0x111111, dim: 0xffe14a, bar: 0xff4fa3, barBack: 0x1b1740, frame: 0x111111, gold: 0xffe14a, confetti: [0x111111, 0xffffff, 0xff4fa3, 0xffe14a] },
};
const BAY = [0, 128, 32, 160, 192, 64, 224, 96, 48, 176, 16, 144, 240, 112, 208, 80];
const W = 240, FLOOR = 110;
const fmt = (n) => div(n, 1000000) + '.' + String(10000 + div(n % 1000000, 100)).slice(1);   // millionths as 0.0000

function letters(cv, s, x, y, c, sh, k = 1) {
  for (const [col, off] of [[sh, k], [c, 0]]) Array.from(s).forEach((ch, n) => (GLYPHS[ch] || GLYPHS[' ']).forEach((row, r) => Array.from(row).forEach((cell, q) => { if (cell === '#') rect(cv, x + (n * 6 + q) * k + off, y + r * k + off, k, k, col); })));
}
const width = (s, k = 1) => (s.length * 6 - 1) * k;
const centred = (cv, s, cx, y, c, sh, k = 1) => letters(cv, s, cx - div(width(s, k), 2), y, c, sh, k);

// The canvas is a whole number of 240-wide stretches, every one decorated alike, with the raid in the middle one: at any width
// or height the raid itself looks exactly the same, and nothing is ever drawn outside the canvas.
function backdrop(cv, L, fw, lh, oy, seed) {
  const fl = oy + FLOOR;
  rect(cv, 0, 0, fw, oy, L.sky[0]);
  for (const y of span(0, FLOOR)) rect(cv, 0, oy + y, fw, 1, mix(L.sky[0], L.sky[1], div(y * 256, FLOOR)));
  for (const x0 of span(0, fw, W)) {
    const r = rng(seed[0], seed[1]);
    if (L.star) for (const n of span(0, 48)) dot(cv, x0 + r(W), oy + r(FLOOR - 4), L.star);
    if (L.confetti) for (const n of span(0, 30)) rect(cv, x0 + r(W - 2), oy + r(FLOOR - 4), 2, 2, L.confetti[r(4)]);
  }
  rect(cv, 0, fl, fw, lh - fl, L.floor);
  for (const d of [1, 4]) rect(cv, 0, fl + d, fw, 1, L.line);   // the floor's edge; the rest stays plain under the lettering
}

/**
 * Draw a raid. raid as checkRaid takes it; themeId one of THEMES; w, h whole numbers from 64 to 2048. A standing boss shows
 * its health bar; a fallen one breaks apart beside its loot card. The picture is a 240 x 160 pixel-art canvas at the
 * largest whole scale that fits. -> { ok: true, px: Uint8Array(w*h*3) RGB rows, scale: k } | { ok: false, why }. Never throws.
 */
export function paintRaid(raid, themeId, w, h) {
  try {
    const c = checkRaid(raid);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return no('unknown theme');
    if (!whole(w, 2048) || !whole(h, 2048) || w < 64 || h < 64) return no('width and height must be whole numbers from 64 to 2048');
    const Q = c.r, B = BY[Q.key], L = LOOKS[themeId], k = Math.max(1, Math.min(div(w, 240), div(h, 160))), lw = div(w + k - 1, k), lh = Math.max(160, div(h + k - 1, k));
    const n = div(lw, W), FW = W * (2 * n + 1), oy = div(lh - 160, 2), full = newCanvas(FW, lh);   // n stretches either side: always enough, as n * 240 > lw - 240
    const seed = [ART.indexOf(B) * 7919 + Q.attempts, Q.best === null ? 1 : Q.best + 2], r = rng(seed[1], seed[0]);
    backdrop(full, L, FW, lh, oy, seed);
    const cv = { cw: full.cw, d: full.d.subarray(oy * full.cw + n * W) };   // the raid, 240 x 160, drawn in the middle on the same pixels
    const hp = bossHealth(Q.best), boss = BOSSES[ART.indexOf(B)];
    if (!Q.loot) {   // the boss stands: the sprite at 3 px a cell, its name, its health and what it is the distance to
      for (const n of span(0, 1024)) if (B.g[n]) rect(cv, 72 + (n % 32) * 3, 14 + div(n, 32) * 3, 3, 3, B.col[B.g[n]]);
      centred(cv, B.name, 120, 2, L.text, L.shadow);
      const fill = div(Math.min(hp, 100000) * 158, 100000);
      rect(cv, 40, 116, 160, 10, L.frame); rect(cv, 41, 117, 158, 8, L.barBack); rect(cv, 41, 117, fill, 8, L.bar); rect(cv, 41, 117, fill, 2, mix(L.bar, 0xffffff, 110));
      letters(cv, 'HP ' + fmt(hp), 40, 130, L.text, L.shadow);
      const best = Q.best === null ? 'NO SCORE YET' : 'BEST ' + fmt(Q.best);
      letters(cv, best, 200 - width(best), 130, L.text, L.shadow);
      centred(cv, (boss.dataset + ' \u00b7 ' + boss.department + ' \u00b7 ' + Q.attempts + (Q.attempts === 1 ? ' try' : ' tries')).toUpperCase(), 120, 143, L.dim, L.shadow);
    } else {   // the boss falls: broken into bands that slip and sink, darker as they go; beside it, the loot
      for (const n of span(0, 1024)) if (B.g[n]) {
        const band = div(div(n, 32), 4), slip = (band % 2 ? 1 : -1) * (2 + band) * 2;
        rect(cv, 24 + (n % 32) * 3 + slip, 16 + div(n, 32) * 3 + band, 3, 3, mul(B.col[B.g[n]], 200 - band * 12));
      }
      for (const n of span(0, 14)) { const x = 18 + r(108), y = FLOOR - 4 + r(6); rect(cv, x, y, 3, 3, B.col[2 + r(4)]); }   // shards on the floor
      rect(cv, 0, 2, W, 20, mul(L.gold, 120)); rect(cv, 0, 2, W, 1, L.gold); rect(cv, 0, 21, W, 1, L.gold);
      centred(cv, 'BOSS FALLS', 120, 4, L.gold, 0x000000, 2);
      const p = RAR[Q.loot.ri], fr = creatureFront(Q.loot.id), x0 = 152, y0 = 32;   // the loot: the first card of its department
      rect(cv, x0, y0, 52, 72, p.lo); rect(cv, x0 + 2, y0 + 2, 48, 68, p.mid); rect(cv, x0 + 4, y0 + 4, 44, 64, 0x0e0420);
      for (const q of span(0, 126)) if (fr.px[q * 4 + 3]) rect(cv, x0 + 8 + (q % 9) * 4, y0 + 8 + div(q, 9) * 4, 4, 4, (fr.px[q * 4] << 16) | (fr.px[q * 4 + 1] << 8) | fr.px[q * 4 + 2]);
      for (const [dx, dy] of [[-3, 6], [55, 20], [-4, 50], [54, 60]]) { rect(cv, x0 + dx, y0 + dy, 3, 1, L.gold); rect(cv, x0 + dx + 1, y0 + dy - 1, 1, 3, L.gold); }   // it glints
      centred(cv, 'LOOT', x0 + 26, y0 - 9, L.gold, L.shadow);
      if (Q.loot.title) centred(cv, Q.loot.title, 120, 120, L.text, L.shadow);
      centred(cv, ('FIRST ' + boss.department + ' CARD \u00b7 GATE ' + fmt(Q.best)).toUpperCase(), 120, 132, L.text, L.shadow);
      centred(cv, B.name + ' \u00b7 CLEARED', 120, 144, L.dim, L.shadow);
    }
    if (L.lcd) for (const y of span(0, lh)) for (const x of span(0, FW)) {   // the pocket screen: four shades, ordered dither
      const q = at(full, x, y), v = (((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 8, s3 = v * 3;
      dot(full, x, y, L.lcd[(s3 >> 8) + ((s3 & 255) > BAY[((y & 3) << 2) + (x & 3)] ? 1 : 0)]);
    }
    const sx = n * W + div(W - lw, 2), px = new Uint8Array(w * h * 3);   // the raid in the middle of the picture (narrower than it: its middle shows)
    span(0, h).forEach((y) => {
      const row = (div(y, k) + PAD) * full.cw + PAD + sx;
      span(0, w).forEach((x) => { const q = full.d[row + div(x, k)], o = (y * w + x) * 3; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; });
    });
    return { ok: true, px, scale: k };
  } catch (e) { return no('the raid could not be painted'); }
}
