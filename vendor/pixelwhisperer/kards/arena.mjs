// arena.mjs - PixelWhisperer Arena: two scorer cards duel on one batch of cases, drawn from the duel's own record and
// nothing else, so the same duel gives the same picture (a replay can be checked against it).
//
// Built by Kar for the PixelWhisperer repo. Powered by the Konomi architecture, created by Thomas Frumkin.
//
// The two creatures face each other in profile on their rarity's platform, each under a rating badge. For each case of
// the batch a side either hit (ranked it right) or missed; the side that hit where the other missed ranked that case
// better. The scoreboard shows every case: a hit or miss mark for each side and, between them, a block coloured by the
// side that ranked it better (grey for a tie), filling as cases are decided. The latest case puts a hit or miss marker
// over each fighter; the end of a duel is a WIN banner over the winner, a DRAW across both, or REFUSED. A replay can hold one
// decided case in focus (the read-back): it is ringed on the scoreboard, and the middle says how each side did on it, its truth and
// the two scores when given, and which side ranked it better. Integer arithmetic only, deterministic,
// total: bad input is { ok: false, why }, never a throw. One source: the canvas, palettes and creatures come from
// kardart.mjs, the lettering from ui.mjs.
import { RARITIES, RAR, PIXEL, THEMES, creatureSide } from './kardart.mjs';
import { GLYPHS } from './ui.mjs';

const { newCanvas, rect, dot, at, mul, mix, rng, span, div, PAD } = PIXEL;
const no = (why) => ({ ok: false, why });
const HEX = '0123456789abcdef', TITLE = " &'.-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const isId = (s) => typeof s === 'string' && s.length === 16 && Array.from(s).every((c) => HEX.indexOf(c) >= 0);
const whole = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
const RESULTS = ['left', 'right', 'refused', 'draw'];

function side(x, name) {   // one duellist: { id, rarity, rating, title?, kit? }
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return no(name + ' must be an object');
  const { id, rarity, rating, title = '', kit = null } = x, ri = RARITIES.indexOf(rarity);
  if (!isId(id)) return no(name + ' id must be 16 lowercase hex characters');
  if (ri < 0) return no(name + ' rarity must be one of ' + RARITIES.join(', '));
  if (!whole(rating, 9999)) return no(name + ' rating must be a whole number from 0 to 9999');
  if (typeof title !== 'string' || title.length > 16 || !Array.from(title).every((ch) => TITLE.indexOf(ch) >= 0)) return no(name + ' title must be at most 16 characters from A-Z a-z 0-9 space & . - and the apostrophe');
  if (kit !== null && (typeof kit !== 'object' || Array.isArray(kit) || !Number.isInteger(kit.slots) || kit.slots < 2 || kit.slots > 4 || !whole(kit.fielded, kit.slots))) return no(name + ' kit must be { slots: 2 to 4, fielded: 0 to slots }');
  return { ok: true, s: { id, rarity, ri, rating, title, kit: kit === null ? null : { slots: kit.slots, fielded: kit.fielded } } };
}

/**
 * Check a duel. duel: { left: { id, rarity, rating 0-9999, title?, kit?: { slots 2-4, fielded 0-slots } }, right: { ... }, cases: [[leftHit, rightHit], ...] (1 to 192,
 * each 0 or 1), decided?: how many cases are decided so far (default all), result?: null | 'left' | 'right' | 'refused' | 'draw',
 * focus?: { at: a decided case (0 to decided - 1), truth?: 0 | 1, scores?: [left, right] in millionths } (the read-back) }.
 * -> { ok: true, d } | { ok: false, why }
 */
export function checkDuel(x) {
  try {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) return no('the duel must be an object');
    const L = side(x.left, 'left');
    if (!L.ok) return L;
    const R = side(x.right, 'right');
    if (!R.ok) return R;
    if (L.s.id === R.s.id) return no('a card does not duel itself');
    const { cases, result = null } = x;
    if (!Array.isArray(cases) || cases.length < 1 || cases.length > 192) return no('cases must be an array of 1 to 192');
    const marks = [];
    for (let n = 0; n < cases.length; n++) {
      const c = cases[n];
      if (!Array.isArray(c) || c.length !== 2 || (c[0] !== 0 && c[0] !== 1) || (c[1] !== 0 && c[1] !== 1)) return no('every case must be [leftHit, rightHit], each 0 or 1');
      marks.push([c[0], c[1]]);
    }
    const decided = x.decided === undefined ? marks.length : x.decided;
    if (!whole(decided, marks.length)) return no('decided must be a whole number from 0 to the number of cases');
    if (result !== null && RESULTS.indexOf(result) < 0) return no('result must be left, right, refused, draw or null');
    const F = x.focus === undefined ? { ok: true, f: null } : focusOf(x.focus, decided);
    if (!F.ok) return F;
    return { ok: true, d: { left: L.s, right: R.s, cases: marks, decided, result, focus: F.f } };
  } catch (e) { return no('the duel could not be read'); }
}

function focusOf(f, decided) {   // the case a replay reads back: which, its truth and the two scores when known
  if (typeof f !== 'object' || f === null || Array.isArray(f)) return no('focus must be an object');
  const { at, truth = null, scores = null } = f;
  if (!Number.isInteger(at) || at < 0 || at >= decided) return no('focus must be on a decided case: at from 0 to decided - 1');
  if (truth !== null && truth !== 0 && truth !== 1) return no('a case\'s truth is 0 or 1');
  if (scores !== null && (!Array.isArray(scores) || scores.length !== 2 || !scores.every((v) => whole(v, 1000000)))) return no('scores are [left, right], each a whole number of millionths from 0 to 1000000');
  return { ok: true, f: { at, truth, scores: scores === null ? null : [scores[0], scores[1]] } };
}
const fmt = (n) => div(n, 1000000) + '.' + String(10000 + div(n % 1000000, 100)).slice(1);   // millionths as 0.0000

/** The tally of the decided cases: a side ranked a case better when it hit and the other missed; anything else is a tie.
 *  -> { ok: true, left, right, ties, decided, cases } | { ok: false, why } */
export function duelScore(x) {
  const c = checkDuel(x);
  if (!c.ok) return c;
  const done = c.d.cases.slice(0, c.d.decided);
  return { ok: true, left: done.filter(([a, b]) => a > b).length, right: done.filter(([a, b]) => b > a).length, ties: done.filter(([a, b]) => a === b).length, decided: c.d.decided, cases: c.d.cases.length };
}

// how each theme dresses the arena: sky, floor, lettering, and the two sides' colours (left and right, a tie, an empty slot)
// (on the pocket screen every colour is chosen to land on one of its four shades exactly: black, 0x555555, 0xaaaaaa, white)
const LOOKS = {
  'synthwave-v1': { sky: [0x0a0420, 0x5a1070], floor: 0x1a0836, line: 0xff2bd6, panel: 0x120626, edge: 0xff2bd6, text: 0xffffff, shadow: 0x4a1480, left: 0x2be8ff, right: 0xff4fa3, tie: 0x8a80a8, empty: 0x3a2466, miss: 0x8a1c3c, win: [0xffffff, null], star: 0xbff8ff },
  'blockcraft-v1': { sky: [0x56a0fa, 0xc6e6ff], floor: 0x5fb83a, line: 0x4f9e30, panel: 0x32323a, edge: 0x9a9aa8, text: 0xffffff, shadow: 0x14141a, left: 0x3c8cff, right: 0xff5a3c, tie: 0x9a9aa8, empty: 0x54545e, miss: 0x6a2a24, win: [0xffffff, null], cloud: 0xffffff },
  'lcd-v1': { sky: [0xaaaaaa, 0xaaaaaa], floor: 0x555555, line: 0x000000, panel: 0x000000, edge: 0x555555, text: 0xffffff, shadow: 0x000000, left: 0xffffff, right: 0x555555, tie: 0xaaaaaa, empty: 0x555555, miss: 0x000000, win: [0x000000, 0xaaaaaa], cloud: 0xffffff, lcd: [0x0f1210, 0x4a5048, 0x9aa095, 0xd8dccf] },
  'memphis-v1': { sky: [0xffe14a, 0xffe14a], floor: 0xffffff, line: 0x111111, panel: 0x1b1740, edge: 0xff4fa3, text: 0x111111, shadow: 0xffffff, left: 0x2d9cff, right: 0xff4fa3, tie: 0xd7dbe4, empty: 0x3a3466, miss: 0x5a1a3a, win: [0xffffff, null], confetti: [0x111111, 0xffffff, 0xff4fa3, 0x2d9cff] },
  'blueprint-v1': { sky: [0x0e3b78, 0x0e3b78], floor: 0x0b2f60, line: 0x3468b0, panel: 0x061a38, edge: 0x5d93d8, text: 0xeef5ff, shadow: 0x061a38, left: 0x7ff0ff, right: 0xfff35a, tie: 0x9cc3f0, empty: 0x1c4f92, miss: 0xff7a5a, win: [0x061a38, 0x9cc3f0], grid: [0x1c4f92, 0x3468b0], ramp: [0x0e3b78, 0x3468b0, 0x9cc3f0, 0xeef5ff] },
};
const inked = (L, c) => (L.ramp ? L.ramp[(((c >> 16) & 255) * 77 + ((c >> 8) & 255) * 150 + (c & 255) * 29) >> 14] : c);   // a drawing inks every colour in one of four blues, by brightness
const BAY = [0, 128, 32, 160, 192, 64, 224, 96, 48, 176, 16, 144, 240, 112, 208, 80];
const W = 240, FLOOR = 100, PANEL = 108, S = 5;   // the arena is 240 wide; the creatures stand on the floor at 5 px per voxel, the scoreboard below

function letters(cv, s, x, y, c, sh, k = 1) {   // the UI font at k pixels per cell, with a drop shadow
  for (const [col, off] of [[sh, k], [c, 0]]) Array.from(s).forEach((ch, n) => (GLYPHS[ch] || GLYPHS[' ']).forEach((row, r) => Array.from(row).forEach((cell, q) => { if (cell === '#') rect(cv, x + (n * 6 + q) * k + off, y + r * k + off, k, k, col); })));
}
const width = (s, k = 1) => (s.length * 6 - 1) * k;
const centred = (cv, s, cx, y, c, sh, k = 1) => letters(cv, s, cx - div(width(s, k), 2), y, c, sh, k);
function line(cv, x0, y0, x1, y1, c) {   // a straight line in whole steps, each point rounded to the nearest pixel
  const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (const t of span(0, n + 1)) dot(cv, x0 + div(2 * (x1 - x0) * t + n, 2 * n), y0 + div(2 * (y1 - y0) * t + n, 2 * n), c);
}

// The canvas is a whole number of 240-wide stretches, every one decorated alike, with the arena in the middle one: at any width
// or height the arena itself looks exactly the same, and nothing is ever drawn outside the canvas.
function backdrop(cv, L, fw, lh, oy, ax, seed) {
  const fl = oy + FLOOR, pn = oy + PANEL;
  rect(cv, 0, 0, fw, oy, L.sky[0]);
  for (const y of span(0, FLOOR)) rect(cv, 0, oy + y, fw, 1, mix(L.sky[0], L.sky[1], div(y * 256, FLOOR)));
  if (L.grid) { for (const x of span(4, fw, 8)) rect(cv, x, 0, 1, oy + FLOOR, (x - 4) % 40 ? L.grid[0] : L.grid[1]); for (const y of span(4, oy + FLOOR, 8)) rect(cv, 0, y, fw, 1, (y - 4) % 40 ? L.grid[0] : L.grid[1]); }   // grid paper
  for (const x0 of span(0, fw, W)) {   // the sky's decoration, clear of the names above
    const r = rng(seed[0], seed[1]);
    if (L.star) for (const n of span(0, 40)) dot(cv, x0 + r(W), oy + 26 + r(FLOOR - 40), L.star);
    if (L.cloud) for (const n of span(0, 3)) { const x = x0 + r(W - 30), y = oy + 32 + r(24); rect(cv, x, y, 28, 5, L.cloud); rect(cv, x + 6, y - 4, 14, 4, L.cloud); }
    if (L.confetti) for (const n of span(0, 30)) rect(cv, x0 + r(W - 2), oy + 26 + r(FLOOR - 34), 2, 2, L.confetti[r(4)]);
  }
  rect(cv, 0, fl, fw, PANEL - FLOOR, L.floor);
  if (L.confetti) for (const y of span(fl, pn)) for (const x of span(0, fw)) { if ((div(y - fl, 4) + div(x, 12)) % 2) dot(cv, x, y, L.line); }   // a checker floor
  else {   // a floor ruled toward the arena's vanishing point
    for (const d of [2, 5]) rect(cv, 0, fl + d, fw, 1, L.line);
    for (const m of span(0, 13)) line(cv, ax + 120 + (m - 6) * 12, fl, ax + 120 + (m - 6) * 18, pn - 1, L.line);
  }
  rect(cv, 0, pn, fw, lh - pn, L.panel); rect(cv, 0, pn, fw, 1, L.edge);   // the scoreboard's band
}

function fighter(cv, s, x0, faceLeft, dimmed, L) {   // the creature in profile, on its rarity's platform
  const p = RAR[s.ri], fr = creatureSide(s.id);
  rect(cv, x0 - 6, FLOOR, 7 * S + 12, 3, p.hi); rect(cv, x0 - 6, FLOOR + 3, 7 * S + 12, 2, p.lo);
  for (const q of span(0, 98)) if (fr.px[q * 4 + 3]) {
    const col = inked(L, (fr.px[q * 4] << 16) | (fr.px[q * 4 + 1] << 8) | fr.px[q * 4 + 2]), x = q % 7;
    rect(cv, x0 + (faceLeft ? 6 - x : x) * S, FLOOR - 14 * S + div(q, 7) * S, S, S, dimmed ? mul(col, 140) : col);
  }
}

function badge(cv, s, cx, L) {   // the rating on a badge in the card's rarity, its title above
  const p = RAR[s.ri], t = String(s.rating);
  rect(cv, cx - 16, 11, 32, 11, p.lo); rect(cv, cx - 16, 11, 32, 1, p.hi); rect(cv, cx - 16, 21, 32, 1, p.hi); rect(cv, cx - 16, 11, 1, 11, p.hi); rect(cv, cx + 15, 11, 1, 11, p.hi);
  rect(cv, cx - 3, 22, 7, 1, p.hi); rect(cv, cx - 1, 23, 3, 1, p.hi);   // its point
  centred(cv, t, cx, 12, 0xffffff, p.lo);
  if (s.title) centred(cv, s.title, cx, 1, L.text, L.shadow);
  if (s.kit) for (const n of span(0, s.kit.slots)) {   // kitted: one pip for each node slot, lit when it is fielded
    const x = cx - div(s.kit.slots * 5 - 2, 2) + n * 5;
    rect(cv, x, 25, 3, 5, n < s.kit.fielded ? 0x2be8ff : 0x4a4e5c);   // the same pips as gear.mjs's kitBadge
    if (n >= s.kit.fielded) rect(cv, x + 1, 26, 1, 3, 0x0e0420);
  }
}

/**
 * Draw a duel. duel as checkDuel takes it; themeId one of THEMES; w, h whole numbers from 64 to 2048. The picture is a
 * 240 x 160 pixel-art canvas at the largest whole scale that fits, each logical pixel a k x k block.
 * -> { ok: true, px: Uint8Array(w*h*3) RGB rows, scale: k } | { ok: false, why }. Never throws.
 */
export function paintDuel(duel, themeId, w, h) {
  try {
    const c = checkDuel(duel);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return no('unknown theme');
    if (!whole(w, 2048) || !whole(h, 2048) || w < 64 || h < 64) return no('width and height must be whole numbers from 64 to 2048');
    const D = c.d, L = LOOKS[themeId], k = Math.max(1, Math.min(div(w, 240), div(h, 160))), lw = div(w + k - 1, k), lh = Math.max(160, div(h + k - 1, k));
    const n = div(lw, W), FW = W * (2 * n + 1), oy = div(lh - 160, 2), full = newCanvas(FW, lh);   // n stretches either side: always enough, as n * 240 > lw - 240
    backdrop(full, L, FW, lh, oy, n * W, [D.left.rating * 10000 + D.right.rating, D.cases.length * 31 + D.decided]);
    const cv = { cw: full.cw, d: full.d.subarray(oy * full.cw + n * W) };   // the arena itself, 240 x 160, drawn in the middle on the same pixels
    const done = D.cases.slice(0, D.decided), won = (x) => D.result === x;
    fighter(cv, D.left, 28, false, won('right') || won('refused'), L);   // the loser, or both when the duel is refused, dimmed; a draw dims neither
    fighter(cv, D.right, 177, true, won('left') || won('refused'), L);
    badge(cv, D.left, 45, L); badge(cv, D.right, 194, L);

    const sc = { left: done.filter(([a, b]) => a > b).length, right: done.filter(([a, b]) => b > a).length };   // the middle: the tally and where the duel stands
    if (!D.focus) {
      centred(cv, 'VS', 120, 32, L.text, L.shadow, 2);
      const l = String(sc.left), rr = String(sc.right);
      letters(cv, l, 113 - width(l, 2), 58, L.left, L.shadow, 2); centred(cv, ':', 120, 58, L.text, L.shadow, 2); letters(cv, rr, 128, 58, L.right, L.shadow, 2);
      centred(cv, D.decided ? 'CASE ' + D.decided + '/' + D.cases.length : 'READY', 120, 84, L.text, L.shadow);
    }

    if (D.result === null && D.decided && !D.focus) {   // the latest case: a hit or a miss beside each fighter
      const [a, b] = done[D.decided - 1];
      centred(cv, a ? '\u2713' : '\u2717', 77, 34, a ? L.left : L.miss, L.shadow, 2);
      centred(cv, b ? '\u2713' : '\u2717', 163, 34, b ? L.right : L.miss, L.shadow, 2);
    }

    const cols = Math.min(48, D.cases.length), x0 = 120 - div(cols * 4 - 1, 2), top = PANEL + 3 + (4 - div(D.cases.length + 47, 48)) * 6;
    D.cases.forEach(([a, b], n) => {   // the scoreboard: every case of the batch, 48 to a line, filling as cases are decided
      const x = x0 + (n % 48) * 4, y = top + div(n, 48) * 12;
      if (n < D.decided) {
        rect(cv, x, y, 3, 2, a ? L.left : L.miss);
        rect(cv, x, y + 3, 3, 5, a > b ? L.left : b > a ? L.right : L.tie);
        rect(cv, x, y + 9, 3, 2, b ? L.right : L.miss);
      } else rect(cv, x, y + 3, 3, 5, L.empty);
    });

    if (D.result === 'refused') {   // the duel is refused: a red ribbon across the fighters
      rect(cv, 0, 26, W, 22, 0x7a1020); rect(cv, 0, 26, W, 2, 0xff5a5a); rect(cv, 0, 46, W, 2, 0xff5a5a);
      for (const x of span(0, W, 8)) for (const q of span(0, 4)) { dot(cv, x + q, 29 + q, 0x9a2030); dot(cv, x + q + 4, 44 - q, 0x9a2030); }
      centred(cv, 'REFUSED', 120, 29, 0xffffff, 0x3a0810, 2);
    }
    if (D.result === 'draw') {   // a draw: one ribbon across both fighters in the tie's colour, each end in its side's
      rect(cv, 0, 26, W, 22, L.tie); rect(cv, 0, 26, 40, 22, L.left); rect(cv, 200, 26, 40, 22, L.right); rect(cv, 0, 26, W, 2, 0xffffff); rect(cv, 0, 46, W, 2, 0xffffff);
      centred(cv, 'DRAW', 120, 29, 0xffffff, 0x000000, 2);
    }
    for (const [who, cx, col] of [['left', 45, L.left], ['right', 194, L.right]]) if (won(who)) {   // the winner's banner
      rect(cv, cx - 30, 30, 60, 22, col); rect(cv, cx - 30, 30, 60, 2, 0xffffff); rect(cv, cx - 30, 50, 60, 2, mul(col, 150));
      rect(cv, cx - 34, 34, 4, 14, mul(col, 170)); rect(cv, cx + 30, 34, 4, 14, mul(col, 170));
      centred(cv, 'WIN', cx, 32, L.win[0], L.win[1] === null ? mul(col, 110) : L.win[1], 2);
    }

    if (D.focus) {   // the read-back: the case in focus, ringed on the scoreboard, and how each side did on it in the middle
      const F = D.focus, [a, b] = D.cases[F.at], x = x0 + (F.at % 48) * 4, y = top + div(F.at, 48) * 12;
      rect(cv, x - 1, y - 2, 5, 1, L.text); rect(cv, x - 1, y + 12, 5, 1, L.text); rect(cv, x - 2, y - 2, 1, 15, L.text); rect(cv, x + 4, y - 2, 1, 15, L.text);
      centred(cv, 'CASE ' + (F.at + 1), 120, 30, L.text, L.shadow, 2);
      centred(cv, a ? '\u2713' : '\u2717', 92, 50, a ? L.left : L.miss, L.shadow, 2); centred(cv, b ? '\u2713' : '\u2717', 148, 50, b ? L.right : L.miss, L.shadow, 2);
      if (F.scores) { centred(cv, fmt(F.scores[0]), 92, 67, L.left, L.shadow); centred(cv, fmt(F.scores[1]), 148, 67, L.right, L.shadow); }
      if (F.truth !== null) centred(cv, F.truth ? 'TRUE: YES' : 'TRUE: NO', 120, 77, L.text, L.shadow);
      centred(cv, a > b ? 'LEFT RANKED BETTER' : b > a ? 'RIGHT RANKED BETTER' : 'A TIE ON THIS CASE', 120, 88, a > b ? L.left : b > a ? L.right : L.tie, L.shadow);
    }

    if (L.lcd) for (const y of span(0, lh)) for (const x of span(0, FW)) {   // the pocket screen: four shades, ordered dither
      const q = at(full, x, y), v = (((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 8, s3 = v * 3;
      dot(full, x, y, L.lcd[(s3 >> 8) + ((s3 & 255) > BAY[((y & 3) << 2) + (x & 3)] ? 1 : 0)]);
    }
    const sx = n * W + div(W - lw, 2), px = new Uint8Array(w * h * 3);   // the arena in the middle of the picture (narrower than it: its middle shows)
    span(0, h).forEach((y) => {
      const row = (div(y, k) + PAD) * full.cw + PAD + sx;
      span(0, w).forEach((x) => { const q = full.d[row + div(x, k)], o = (y * w + x) * 3; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; });
    });
    return { ok: true, px, scale: k };
  } catch (e) { return no('the duel could not be painted'); }
}
