// estate.mjs - PixelWhisperer Estate: the isometric blockcraft plot a DIGI player grows, drawn from their verified holdings
// and nothing else, so the same holdings give the same picture (and the shared snapshot can be replayed and checked).
//
// Built by Kar for the PixelWhisperer repo. Powered by the Konomi architecture, created by Thomas Frumkin; drawing on the work of
// Gary W. Floyd, Lumiea Systems Research Division, ThunderStruck Service LLC (credits in full: kards/CREDITS.md).
//
// The plot is a 12 x 12 map of isometric blocks in five districts. SCORER and TOOLS are open: a district with n holdings has
// tilesFor(n) = min(36, 8 + 2n) open tiles, so a new player starts with 16 (a 4 x 4 plot's worth) and every holding opens two
// more. TALKER, SWARM and ROUTER are fenced grey and marked COMING. A scorer card is a tower (taller with its level) whose
// trim is its rarity palette, with its own creature on a sign; a new child's tile is highlighted; mesh wires (cyan) join
// consented cards. One source: the cube, the canvas, the palettes and the creature come from kardart.mjs, the lettering
// from ui.mjs. Integer arithmetic only, deterministic, total: bad input is { ok: false, why }, never a throw.
import { DATASETS, RARITIES, RAR, PIXEL, THEMES, creatureFront } from './kardart.mjs';
import { GLYPHS } from './ui.mjs';

const { newCanvas, rect, dot, at, cube, mul, rng, span, div, PAD } = PIXEL;
const no = (why) => ({ ok: false, why });
const HEX = '0123456789abcdef', DEPT = '-0123456789abcdefghijklmnopqrstuvwxyz';
const isId = (s) => typeof s === 'string' && s.length === 16 && Array.from(s).every((c) => HEX.indexOf(c) >= 0);
const whole = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;

/** The plot is PLOT x PLOT tiles. */
export const PLOT = 12;
/** The five districts, by tile range [i0, i1) x [k0, k1) (i runs right and down the screen, k left and down), each with where its name
 *  is lettered (a screen offset from the plot's top corner: the open ones outside the plot's edge, clear of their blocks). The open ones grow from their inner corner, the one by the plot's centre. */
export const DISTRICTS = Object.freeze([
  Object.freeze({ id: 'scorer', name: 'SCORER', open: true, i: [0, 6], k: [0, 6], label: [-48, 2], inner: [5, 5] }),
  Object.freeze({ id: 'tools', name: 'TOOLS', open: true, i: [6, 12], k: [0, 6], label: [50, 4], inner: [6, 5] }),
  Object.freeze({ id: 'talker', name: 'TALKER', open: false, i: [0, 4], k: [6, 12], label: [-52, 31] }),
  Object.freeze({ id: 'swarm', name: 'SWARM', open: false, i: [4, 8], k: [6, 12], label: [-16, 45] }),
  Object.freeze({ id: 'router', name: 'ROUTER', open: false, i: [8, 12], k: [6, 12], label: [22, 57] }),
]);
/** The published formula: open tiles in a district that holds n blocks (n a whole number), or null for anything else. */
export function tilesFor(n) { return whole(n, 1000000000) ? Math.min(36, 8 + 2 * n) : null; }

// the order a district's tiles open in: nearest the plot's centre first (Chebyshev rings), then by depth, then across; and the
// order its blocks are placed in: every other tile first (so signs stand apart), then the tiles between
const ring = (i, k, [ci, ck]) => Math.max(Math.abs(i - ci), Math.abs(k - ck));
const tilesOf = (d) => span(0, 36).map((q) => [d.i[0] + (q % 6), d.k[0] + div(q, 6)]);
const ordered = (d, key) => tilesOf(d).map(([i, k]) => [key(i, k), i, k]).sort((a, b) => a[0] - b[0]).map(([, i, k]) => [i, k]);
const OPENS = {}, SLOTS = {};
for (const d of DISTRICTS.filter((x) => x.open)) {
  OPENS[d.id] = ordered(d, (i, k) => ring(i, k, d.inner) * 144 + k * 12 + i);
  SLOTS[d.id] = ordered(d, (i, k) => ((i - d.inner[0]) % 2 || (k - d.inner[1]) % 2 ? 6000 : 0) + ring(i, k, d.inner) * 144 + k * 12 + i);
}

/**
 * Check a player's holdings and put them in canonical order (so the same holdings, in any order, draw the same picture).
 * holdings: { cards: [{ id, dataset, stage, rarity, generation, department?, fresh? }], wires?: [[idA, idB]], tools?: n, levels?: n, snapshot?: bool }
 * -> { ok: true, h } | { ok: false, why }
 */
export function checkHoldings(x) {
  try {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) return no('holdings must be an object');
    const { cards, wires = [], tools = 0, levels = null, snapshot = false } = x;
    if (!Array.isArray(cards) || cards.length > 1000) return no('cards must be an array of at most 1000');
    if (!Array.isArray(wires) || wires.length > 4000) return no('wires must be an array of at most 4000 pairs');
    if (!whole(tools, 999)) return no('tools must be a whole number from 0 to 999');
    if (levels !== null && !whole(levels, 999999)) return no('levels must be a whole number from 0 to 999999');
    if (typeof snapshot !== 'boolean') return no('snapshot must be true or false');
    const held = [], ids = new Set();
    for (let n = 0; n < cards.length; n++) {
      const c = cards[n];
      if (typeof c !== 'object' || c === null || Array.isArray(c)) return no('every card must be an object');
      const { id, dataset, stage, rarity, generation, department = '', fresh = false } = c;
      if (!isId(id)) return no('every card id must be 16 lowercase hex characters');
      if (ids.has(id)) return no('a card is held once: ' + id);
      if (DATASETS.indexOf(dataset) < 0) return no('dataset must be one of ' + DATASETS.join(', '));
      if (!whole(stage, 99)) return no('stage must be a whole number from 0 to 99');
      const ri = RARITIES.indexOf(rarity);
      if (ri < 0) return no('rarity must be one of ' + RARITIES.join(', '));
      if (!whole(generation, 99)) return no('generation must be a whole number from 0 to 99');
      if (typeof department !== 'string' || department.length > 16 || !Array.from(department).every((ch) => DEPT.indexOf(ch) >= 0)) return no('department must be at most 16 characters from a-z 0-9 and -');
      if (typeof fresh !== 'boolean') return no('fresh must be true or false');
      ids.add(id);
      held.push({ id, dataset, stage, rarity, generation, department, fresh, ri });
    }
    const pairs = new Set(), links = [];
    for (let n = 0; n < wires.length; n++) {
      const w = wires[n];
      if (!Array.isArray(w) || w.length !== 2 || !ids.has(w[0]) || !ids.has(w[1])) return no('every wire must join two held cards');
      if (w[0] === w[1]) return no('a wire joins two different cards');
      const pair = [w[0], w[1]].sort(), key = pair.join(':');
      if (pairs.has(key)) return no('a wire is listed once');
      pairs.add(key);
      links.push(pair);
    }
    const order = held.map((card) => [String(9 - card.ri) + String(199 - card.stage) + card.id, card]).sort();   // rarest and highest first: they take the tiles nearest the centre
    links.sort();
    return { ok: true, h: { cards: order.map(([, card]) => card), wires: links, tools, levels, snapshot } };
  } catch (e) { return no('the holdings could not be read'); }
}

/** The numbers an estate shows, from its holdings only: { ok, blocks, cards, tools, links, levels, tiles: { scorer, tools, total } } | { ok: false, why }. */
export function estateStats(holdings) {
  const c = checkHoldings(holdings);
  if (!c.ok) return c;
  const { cards, tools, wires, levels } = c.h, scorer = tilesFor(cards.length), toolTiles = tilesFor(tools);
  return { ok: true, blocks: cards.length + tools, cards: cards.length, tools, links: wires.length, levels, tiles: { scorer, tools: toolTiles, total: scorer + toolTiles } };
}

// how each theme dresses the plot: background, lettering, wires and the snapshot's bands
const LOOKS = {
  'synthwave-v1': { bg: 0x120626, star: 0xbff8ff, text: 0xffffff, shadow: 0x4a1480, dim: 0x9c84c8, wire: 0x2be8ff, band: 0x1a0836, bandText: 0xffd23c },
  'blockcraft-v1': { bg: 0x6fb4ff, cloud: 0xffffff, text: 0xffffff, shadow: 0x14141a, dim: 0xd8dce4, wire: 0x2be8ff, band: 0x32323a, bandText: 0xffffff },
  'lcd-v1': { bg: 0x6fb4ff, cloud: 0xffffff, text: 0xffffff, shadow: 0x14141a, dim: 0xd8dce4, wire: 0x2be8ff, band: 0x32323a, bandText: 0xffffff, lcd: [0x0f1210, 0x4a5048, 0x9aa095, 0xd8dccf] },
  'memphis-v1': { bg: 0xffe14a, confetti: [0x111111, 0xffffff, 0xff4fa3, 0x2d9cff], text: 0x111111, shadow: 0xffffff, dim: 0x5a5a64, wire: 0x2be8ff, band: 0xfff1d6, bandText: 0x111111 },
};
const BAY = [0, 128, 32, 160, 192, 64, 224, 96, 48, 176, 16, 144, 240, 112, 208, 80];
const TOOL = [0x4ad6e0, 0x4a7ee8, 0xd060c8, 0x9ad84a, 0xf0c84a, 0xff8a4a];   // tool blocks, in turn
const DCOL = [0x40e8ff, 0xffa040, 0x86ff92, 0xff6ad0, 0xff5a5a, 0x6aa8ff, 0xffffff];   // the dataset colours the cards use

function letters(cv, s, x, y, c, sh) {   // the UI font at one pixel per cell, with a drop shadow
  for (const [col, off] of [[sh, 1], [c, 0]]) Array.from(s).forEach((ch, n) => (GLYPHS[ch] || GLYPHS[' ']).forEach((row, r) => Array.from(row).forEach((cell, q) => { if (cell === '#') dot(cv, x + n * 6 + q + off, y + r + off, col); })));
}
const width = (s) => s.length * 6 - 1;
function line(cv, x0, y0, x1, y1, c) {   // a straight line in whole steps: each point rounded to the nearest pixel, integers only
  const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (const t of span(0, n + 1)) dot(cv, x0 + div(2 * (x1 - x0) * t + n, 2 * n), y0 + div(2 * (y1 - y0) * t + n, 2 * n), c);
}

/**
 * Draw an estate. holdings as checkHoldings takes them; themeId one of THEMES; w, h whole numbers from 64 to 2048.
 * The picture is a pixel-art canvas at the largest whole scale that fits (at least 240 x 160 logical pixels), each logical
 * pixel a k x k block. snapshot: true adds a title band and a stats band, for the shared ESTATE SNAPSHOT PNG.
 * -> { ok: true, px: Uint8Array(w*h*3) RGB rows, scale: k } | { ok: false, why }. Never throws.
 */
export function paintEstate(holdings, themeId, w, h) {
  try {
    const c = checkHoldings(holdings);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return no('unknown theme');
    if (!whole(w, 2048) || !whole(h, 2048) || w < 64 || h < 64) return no('width and height must be whole numbers from 64 to 2048');
    const H = c.h, L = LOOKS[themeId], k = Math.max(1, Math.min(div(w, 240), div(h, 160))), lw = div(w + k - 1, k), lh = div(h + k - 1, k);
    const cv = newCanvas(lw, lh), seed = H.cards.reduce((a, card) => Math.imul(a ^ HEX.indexOf(card.id[0]) ^ (HEX.indexOf(card.id[15]) << 4), 0x9e3779b1) >>> 0, H.tools + 1);
    const r = rng(seed, H.cards.length * 31 + H.wires.length);
    rect(cv, 0, 0, lw, lh, L.bg);
    if (L.star) for (const n of span(0, 40)) dot(cv, r(lw), r(lh), L.star);
    if (L.cloud) for (const n of span(0, 3)) { const x = r(lw), y = r(div(lh, 3)); rect(cv, x, y, 28, 5, L.cloud); rect(cv, x + 6, y - 4, 14, 4, L.cloud); }
    if (L.confetti) for (const n of span(0, 30)) rect(cv, r(lw), r(lh), 2, 2, L.confetti[r(4)]);
    const band = H.snapshot ? 12 : 0, cx = div(lw, 2), oy = div(lh - 128 - 2 * band, 2) + 50 + band;
    const pos = (i, j, kk) => [cx + (i - kk) * 6, oy + (i + kk) * 3 - j * 6];

    // the ground: two layers, grass on the open tiles, grey stone on the fenced ones
    const open = new Set(), fresh = new Set(), locked = new Set();
    const towers = H.cards.slice(0, 36).map((card, n) => ({ card, i: SLOTS.scorer[n][0], kk: SLOTS.scorer[n][1] }));
    const tools = SLOTS.tools.slice(0, Math.min(H.tools, 36));
    OPENS.scorer.slice(0, tilesFor(H.cards.length)).forEach(([i, kk]) => open.add(i * PLOT + kk));
    OPENS.tools.slice(0, tilesFor(H.tools)).forEach(([i, kk]) => open.add(i * PLOT + kk));
    for (const t of towers) { open.add(t.i * PLOT + t.kk); if (t.card.fresh) fresh.add(t.i * PLOT + t.kk); }   // a block always stands on open ground
    for (const [i, kk] of tools) open.add(i * PLOT + kk);
    for (const d of DISTRICTS.filter((x) => !x.open)) for (const kk of span(d.k[0], d.k[1])) for (const i of span(d.i[0], d.i[1])) locked.add(i * PLOT + kk);
    for (const j of [-2, -1]) for (const kk of span(0, PLOT)) for (const i of span(0, PLOT)) {
      const [px, py] = pos(i, j, kk), lit = [256, 204, 154], t = i * PLOT + kk;
      if (j === -2) cube(cv, px, py, 0x8a5a33, t + 7, lit);
      else if (fresh.has(t)) cube(cv, px, py, 0x9ef06a, t, lit, 2, 0x7ad04a);
      else if (open.has(t)) cube(cv, px, py, 0x5fb83a, t, lit, 2, 0x4f9e30);
      else if (locked.has(t)) cube(cv, px, py, 0x6e6e78, t, lit, 2, 0x5a5a62);
      else cube(cv, px, py, 0x8e8e96, t, lit, 2, 0x76767e);
    }
    for (const d of DISTRICTS.filter((x) => !x.open)) for (const kk of span(d.k[0], d.k[1])) for (const i of span(d.i[0], d.i[1])) {   // a fence round each locked district
      const edge = i === d.i[0] || kk === d.k[0] || i === d.i[1] - 1 || kk === d.k[1] - 1;
      if (edge && (i + kk) % 2 === 0) { const [px, py] = pos(i, -1, kk); rect(cv, px - 1, py - 1, 2, 5, 0x3a3a40); dot(cv, px - 1, py - 2, 0xb4b4bc); dot(cv, px, py - 2, 0xb4b4bc); }
    }

    // the blocks: towers (stone, capped in the card's rarity), tool blocks; drawn layer by layer, back to front
    const vox = [];
    for (const t of towers) {
      const p = RAR[t.card.ri], tall = div(t.card.stage, 25);
      for (const j of span(0, tall)) vox.push([j, t.kk, t.i, 0xb4b4bc, [256, 204, 154]]);
      vox.push([tall, t.kk, t.i, p.hi, [256, 190, 140]]);
      t.top = pos(t.i, tall, t.kk);
    }
    tools.forEach(([i, kk], n) => vox.push([0, kk, i, TOOL[n % 6], [256, 204, 154], true]));
    vox.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    for (const [j, kk, i, col, lit, tool] of vox) {
      const [px, py] = pos(i, j, kk);
      cube(cv, px, py, col, i * 13 + kk * 7 + j, lit);
      if (tool) { rect(cv, px - 4, py + 7, 3, 2, 0x14141a); dot(cv, px - 3, py + 7, 0x86ff92); }   // a tool block's little screen
    }
    // mesh wires between consented cards, then each card's sign: its creature, framed in its rarity
    const where = new Map(towers.map((t) => [t.card.id, t]));
    for (const [a, b] of H.wires) {
      const ta = where.get(a), tb = where.get(b);
      if (ta && tb) { line(cv, ta.top[0], ta.top[1] + 1, tb.top[0], tb.top[1] + 1, mul(L.wire, 150)); line(cv, ta.top[0], ta.top[1], tb.top[0], tb.top[1], L.wire); }
    }
    for (const t of towers.slice().sort((a, b) => a.i + a.kk - (b.i + b.kk) || a.kk - b.kk)) {
      const p = RAR[t.card.ri], fr = creatureFront(t.card.id), x0 = t.top[0] - 5, y0 = t.top[1] - 17;
      rect(cv, x0, y0, 11, 16, p.lo); rect(cv, x0, y0, 11, 1, p.hi); rect(cv, x0, y0 + 15, 11, 1, p.hi); rect(cv, x0, y0, 1, 16, p.hi); rect(cv, x0 + 10, y0, 1, 16, p.hi);
      for (const q of span(0, 126)) if (fr.px[q * 4 + 3]) dot(cv, x0 + 1 + (q % 9), y0 + 1 + div(q, 9), (fr.px[q * 4] << 16) | (fr.px[q * 4 + 1] << 8) | fr.px[q * 4 + 2]);
      dot(cv, x0 + 9, y0 + 1, DCOL[DATASETS.indexOf(t.card.dataset)]);   // its dataset, as a pip in the corner
      if (t.card.fresh) { rect(cv, x0 + 4, y0 - 5, 3, 1, 0xffffff); rect(cv, x0 + 5, y0 - 6, 1, 3, 0xffffff); }   // a new child sparkles
    }

    // district names, lettered over the ground like signage; the locked ones say they are coming
    for (const d of DISTRICTS) {
      const px = cx + d.label[0], py = oy + d.label[1];
      letters(cv, d.name, px - div(width(d.name), 2), py, d.open ? L.text : L.dim, L.shadow);
      if (!d.open) letters(cv, 'COMING', px - div(width('COMING'), 2), py + 10, L.dim, L.shadow);
    }
    if (H.cards.length > 36) { const more = '+' + (H.cards.length - 36) + ' MORE', px = cx - 48, py = oy + 12; letters(cv, more, px - div(width(more), 2), py, L.text, L.shadow); }

    // the snapshot's bands: what it is, and the numbers it was drawn from
    if (H.snapshot) {
      const s = estateStats(holdings), fit = (str) => str.slice(0, div(lw - 8, 6));
      rect(cv, 0, 0, lw, band, L.band); rect(cv, 0, lh - band, lw, band, L.band);
      letters(cv, fit('MY DIGI ESTATE'), 4, 2, L.bandText, L.band);
      const parts = [s.blocks + ' BLOCKS', s.tiles.total + ' TILES', s.links + ' MESH LINKS', ...(s.levels === null ? [] : [s.levels + ' LEVELS RERUN'])];
      const line = parts.reduce((acc, part) => (acc === null ? part : width(acc + ' \u00b7 ' + part) <= lw - 8 ? acc + ' \u00b7 ' + part : acc), null);   // whole items only, as many as fit
      letters(cv, fit(line), 4, lh - band + 2, L.bandText, L.band);
    }
    if (L.lcd) for (const y of span(0, lh)) for (const x of span(0, lw)) {   // the pocket screen: four shades, ordered dither
      const q = at(cv, x, y), v = (((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 8, s3 = v * 3;
      dot(cv, x, y, L.lcd[(s3 >> 8) + ((s3 & 255) > BAY[((y & 3) << 2) + (x & 3)] ? 1 : 0)]);
    }
    const px = new Uint8Array(w * h * 3);
    span(0, h).forEach((y) => {
      const row = (div(y, k) + PAD) * cv.cw + PAD;
      span(0, w).forEach((x) => { const q = cv.d[row + div(x, k)], o = (y * w + x) * 3; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; });
    });
    return { ok: true, px, scale: k };
  } catch (e) { return no('the estate could not be painted'); }
}
