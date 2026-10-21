// estate.mjs - PixelWhisperer Estate: the isometric blockcraft plot a DIGI player grows, drawn from their verified holdings
// and nothing else, so the same holdings give the same picture (and the shared snapshot can be replayed and checked).
//
// Built by Kar for the PixelWhisperer repo. Powered by the Konomi architecture, created by Thomas Frumkin.
//
// The plot is a map of isometric blocks in five districts. A district with n holdings has tilesFor(n) = min(36, 8 + 2n) open
// tiles, so every holding opens two more. Holdings of scorer cards alone draw the first plot, 12 x 12, as it was published:
// SCORER and TOOLS open, TALKER, SWARM and ROUTER fenced grey and marked COMING. Holdings with items or swarms draw the full
// plot: all five districts open, each 6 x 6 so the rule holds to 36 everywhere, on an L of five squares. A scorer card is a
// tower (taller with its level) whose trim is its rarity palette, with its own creature on a sign; a new child's tile is
// highlighted; mesh wires (cyan) join consented cards. Apps and pwas are tool blocks, nodes server blocks, talkers terminal
// blocks, routers antenna blocks; a swarm (a consented team of cards) is a stack of its members' blocks, wired to their towers.
// One source: the cube, the canvas, the palettes and the creature come from kardart.mjs, the lettering from ui.mjs. Integer
// arithmetic only, deterministic, total: bad input is { ok: false, why }, never a throw.
import { DATASETS, RARITIES, FORMS, TIERS, RAR, PIXEL, THEMES, creatureFront } from './kardart.mjs';
import { GLYPHS } from './ui.mjs';

const { newCanvas, rect, dot, at, cube, mul, rng, span, div, PAD } = PIXEL;
const no = (why) => ({ ok: false, why });
const HEX = '0123456789abcdef', DEPT = '-0123456789abcdefghijklmnopqrstuvwxyz';
const isId = (s) => typeof s === 'string' && s.length === 16 && Array.from(s).every((c) => HEX.indexOf(c) >= 0);
const whole = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
const NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
function lettering(names, shown) {   // a player's own names for the districts drawn: nothing to add, { names } in the plot's order, or a refusal
  if (names === undefined) return { ok: true, add: {} };
  if (typeof names !== 'object' || names === null || Array.isArray(names)) return no('names must be an object of district ids to names');
  for (const [id, s] of Object.entries(names)) {
    if (!shown.includes(id)) return no('names letter the districts drawn: ' + id + ' is not one of ' + shown.join(', '));
    if (typeof s !== 'string' || s.length < 1 || s.length > 8) return no('a district name is 1 to 8 characters');
    if (!Array.from(s).every((ch) => NAME_CHARS.includes(ch)) || s[0] === ' ' || s[s.length - 1] === ' ') return no('a district name is written in A-Z, 0-9 and spaces, and starts and ends with a letter or a digit');
  }
  return { ok: true, add: { names: Object.fromEntries(shown.filter((id) => Object.prototype.hasOwnProperty.call(names, id)).map((id) => [id, names[id]])) } };
}

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
/** The full plot, once a player holds items or swarms: every district open and 6 x 6, so the one rule holds to 36 tiles in all
 *  five, on an L of five squares (SCORER, TOOLS and ROUTER along the top edge, TALKER and SWARM below). */
export const ITEM_DISTRICTS = Object.freeze([
  DISTRICTS[0], DISTRICTS[1],
  Object.freeze({ id: 'talker', name: 'TALKER', open: true, i: [0, 6], k: [6, 12], label: [-66, 46], inner: [5, 6] }),
  Object.freeze({ id: 'swarm', name: 'SWARM', open: true, i: [6, 12], k: [6, 12], label: [24, 84], inner: [6, 6] }),
  Object.freeze({ id: 'router', name: 'ROUTER', open: true, i: [12, 18], k: [0, 6], label: [98, 28], inner: [12, 5] }),
]);
/** The published formula: open tiles in a district that holds n blocks (n a whole number), or null for anything else. */
export function tilesFor(n) { return whole(n, 1000000000) ? Math.min(36, 8 + 2 * n) : null; }

// the order a district's tiles open in: nearest the plot's centre first (Chebyshev rings), then by depth, then across; and the
// order its blocks are placed in: every other tile first (so signs stand apart), then the tiles between
const ring = (i, k, [ci, ck]) => Math.max(Math.abs(i - ci), Math.abs(k - ck));
const tilesOf = (d) => span(0, 36).map((q) => [d.i[0] + (q % 6), d.k[0] + div(q, 6)]);
const ordered = (d, key) => tilesOf(d).map(([i, k]) => [key(i, k), i, k]).sort((a, b) => a[0] - b[0]).map(([, i, k]) => [i, k]);
// A layout: its districts, its ground tiles back to front (by depth, then across), the order each open district's tiles open
// and its blocks stand, what a fenced one says, and how far left and up it sits so it fits the picture.
function plan(ds, note, wide, shift, lift) {
  const opens = {}, slots = {}, ground = [];
  for (const d of ds.filter((x) => x.open)) {
    opens[d.id] = ordered(d, (i, k) => ring(i, k, d.inner) * 144 + k * 12 + i);
    slots[d.id] = ordered(d, (i, k) => ((i - d.inner[0]) % 2 || (k - d.inner[1]) % 2 ? 6000 : 0) + ring(i, k, d.inner) * 144 + k * 12 + i);
  }
  for (const k of span(0, PLOT)) for (const i of span(0, wide)) if (ds.some((d) => i >= d.i[0] && i < d.i[1] && k >= d.k[0] && k < d.k[1])) ground.push([i, k]);
  return { ds, opens, slots, note, ground, shift, lift };
}
const PLAN = plan(DISTRICTS, 'COMING', PLOT, 0, 0), ITEM_PLAN = plan(ITEM_DISTRICTS, '', 18, 18, 6);
function planOf(ids) {   // only the districts named, where they stand on the full plot, centred by their own extent (all five give ITEM_PLAN)
  const ds = ITEM_DISTRICTS.filter((d) => ids.indexOf(d.id) >= 0), left = Math.min(...ds.map((d) => d.i[0] - d.k[1])), right = Math.max(...ds.map((d) => d.i[1] - d.k[0]));
  return plan(ds, '', 18, (left + right) * 3, 6);
}
const ITEM_FORMS = FORMS.slice(1), FOR = { app: 'tools', pwa: 'tools', node: 'tools', talker: 'talker', router: 'router' };   // the district each item stands in

/**
 * Check a player's holdings and put them in canonical order (so the same holdings, in any order, draw the same picture).
 * holdings: { cards: [{ id, dataset, stage, rarity, generation, department?, fresh? }], wires?: [[idA, idB]], tools?: n, levels?: n, snapshot?: bool }
 *   or, for the full plot, items?: [{ id, form: app | pwa | node | talker | router, tier: prototype | works | proven, fresh? }] and
 *   swarms?: [{ id, members: [card ids] }] in place of tools (TOOLS then counts the apps, pwas and nodes; TALKER the talkers;
 *   ROUTER the routers; SWARM the swarms, each a consented team of 2 to 36 of the player's own cards), and districts?: the districts to
 *   draw, SCORER and any of the rest (only those are drawn, nothing fenced; an item or swarm must stand in one of them).
 *   On any plot, names?: { <a district drawn>: 1-8 of A-Z 0-9 and space } letters that district with the player's own name in
 *   place of its own (DIGI's KITTED is { swarm: 'KITTED' }); nothing else moves, and without it nothing changes.
 * -> { ok: true, h } | { ok: false, why }
 */
export function checkHoldings(x) {
  try {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) return no('holdings must be an object');
    const { cards, wires = [], tools = 0, levels = null, snapshot = false, items, swarms, districts, names } = x;
    const full = items !== undefined || swarms !== undefined || districts !== undefined;
    if (full && Object.prototype.hasOwnProperty.call(x, 'tools')) return no('tools are counted from the items when items or swarms are given');
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
    const h = { cards: order.map(([, card]) => card), wires: links, tools, levels, snapshot };
    if (!full) { const n = lettering(names, DISTRICTS.map((d) => d.id)); return n.ok ? { ok: true, h: { ...h, ...n.add } } : n; }
    const list = items === undefined ? [] : items, teams = swarms === undefined ? [] : swarms, cardIds = new Set(ids);
    if (!Array.isArray(list) || list.length > 1000) return no('items must be an array of at most 1000');
    if (!Array.isArray(teams) || teams.length > 100) return no('swarms must be an array of at most 100');
    const kept = [];
    for (let n = 0; n < list.length; n++) {
      const it = list[n];
      if (typeof it !== 'object' || it === null || Array.isArray(it)) return no('every item must be an object');
      const { id, form, tier, fresh = false } = it, ti = TIERS.indexOf(tier);
      if (!isId(id)) return no('every item id must be 16 lowercase hex characters');
      if (ids.has(id)) return no('a card is held once: ' + id);
      if (ITEM_FORMS.indexOf(form) < 0) return no('an item form must be one of ' + ITEM_FORMS.join(', '));
      if (ti < 0) return no('an item tier must be one of ' + TIERS.join(', '));
      if (typeof fresh !== 'boolean') return no('fresh must be true or false');
      ids.add(id);
      kept.push([String(ITEM_FORMS.indexOf(form)) + String(9 - ti) + id, { id, form, tier, fresh, ti }]);   // by form, the best proven first
    }
    const named = new Set(), crews = [];
    for (let n = 0; n < teams.length; n++) {
      const s = teams[n];
      if (typeof s !== 'object' || s === null || Array.isArray(s)) return no('every swarm must be an object');
      const { id, members } = s;
      if (!isId(id)) return no('every swarm id must be 16 lowercase hex characters');
      if (named.has(id)) return no('a swarm is listed once: ' + id);
      if (!Array.isArray(members) || members.length < 2 || members.length > 36 || !members.every((m) => cardIds.has(m)) || new Set(members).size !== members.length) return no('every swarm has from 2 to 36 members, each a card held, each once');
      named.add(id);
      crews.push({ id, members: [...members].sort() });
    }
    const all = kept.sort().map(([, it]) => it), count = (form) => all.filter((it) => it.form === form).length;
    const teamsInOrder = crews.map((s) => [s.id, s]).sort().map(([, s]) => s);   // by id
    let drawn = null;   // the districts drawn: all five unless the holdings name them
    if (districts !== undefined) {
      if (!Array.isArray(districts) || districts.indexOf('scorer') < 0 || new Set(districts).size !== districts.length || !districts.every((d) => ITEM_DISTRICTS.some((x) => x.id === d))) return no('districts must list scorer and any of tools, talker, swarm and router, each once');
      drawn = ITEM_DISTRICTS.map((d) => d.id).filter((id) => districts.indexOf(id) >= 0);
      const astray = all.find((it) => !drawn.includes(FOR[it.form]));
      if (astray) return no('every item must stand in a district drawn: a ' + astray.form + ' stands in ' + FOR[astray.form]);
      if (teamsInOrder.length && !drawn.includes('swarm')) return no('swarms stand in swarm, which is not among the districts drawn');
    }
    const n = lettering(names, drawn || ITEM_DISTRICTS.map((d) => d.id));
    if (!n.ok) return n;
    return { ok: true, h: { ...h, tools: count('app') + count('pwa') + count('node'), talkers: count('talker'), routers: count('router'), items: all, swarms: teamsInOrder, districts: drawn, ...n.add } };
  } catch (e) { return no('the holdings could not be read'); }
}

/** The numbers an estate shows, from its holdings only: { ok, blocks, cards, tools, links, levels, tiles: { scorer, tools, total } } | { ok: false, why }. */
export function estateStats(holdings) {
  const c = checkHoldings(holdings);
  if (!c.ok) return c;
  const { cards, tools, wires, levels, items, talkers, routers, swarms, districts } = c.h, scorer = tilesFor(cards.length), toolTiles = tilesFor(tools);
  if (!items) return { ok: true, blocks: cards.length + tools, cards: cards.length, tools, links: wires.length, levels, tiles: { scorer, tools: toolTiles, total: scorer + toolTiles } };
  const each = { scorer, tools: toolTiles, talker: tilesFor(talkers), swarm: tilesFor(swarms.length), router: tilesFor(routers) }, shown = districts || ITEM_DISTRICTS.map((d) => d.id);
  const tiles = Object.fromEntries(shown.map((d) => [d, each[d]]));   // the districts drawn, and their total
  tiles.total = shown.reduce((n, d) => n + each[d], 0);
  return { ok: true, blocks: cards.length + items.length + swarms.length, cards: cards.length, items: items.length, tools, talkers, routers, swarms: swarms.length, links: wires.length, levels, tiles };
}

// how each theme dresses the plot: background, lettering, wires and the snapshot's bands
const LOOKS = {
  'synthwave-v1': { bg: 0x120626, star: 0xbff8ff, text: 0xffffff, shadow: 0x4a1480, dim: 0x9c84c8, wire: 0x2be8ff, band: 0x1a0836, bandText: 0xffd23c },
  'blockcraft-v1': { bg: 0x6fb4ff, cloud: 0xffffff, text: 0xffffff, shadow: 0x14141a, dim: 0xd8dce4, wire: 0x2be8ff, band: 0x32323a, bandText: 0xffffff },
  'lcd-v1': { bg: 0x6fb4ff, cloud: 0xffffff, text: 0xffffff, shadow: 0x14141a, dim: 0xd8dce4, wire: 0x2be8ff, band: 0x32323a, bandText: 0xffffff, lcd: [0x0f1210, 0x4a5048, 0x9aa095, 0xd8dccf] },
  'memphis-v1': { bg: 0xffe14a, confetti: [0x111111, 0xffffff, 0xff4fa3, 0x2d9cff], text: 0x111111, shadow: 0xffffff, dim: 0x5a5a64, wire: 0x2be8ff, band: 0xfff1d6, bandText: 0x111111 },
  'blueprint-v1': { bg: 0x0e3b78, grid: [0x1c4f92, 0x3468b0], text: 0xeef5ff, shadow: 0x061a38, dim: 0x9cc3f0, wire: 0x7ff0ff, band: 0x0b2f60, bandText: 0xeef5ff, ramp: [0x0e3b78, 0x3468b0, 0x9cc3f0, 0xeef5ff] },
};
const BAY = [0, 128, 32, 160, 192, 64, 224, 96, 48, 176, 16, 144, 240, 112, 208, 80];
const TOOL = [0x4ad6e0, 0x4a7ee8, 0xd060c8, 0x9ad84a, 0xf0c84a, 0xff8a4a];   // tool blocks, in turn
const BLOCK = { node: 0x4a4f5c, talker: 0x2a9d8f, router: 0x3c414c }, LINK = { form: 'link' };   // the other item blocks' colours; a swarm's blocks are linked
const DCOL = [0x40e8ff, 0xffa040, 0x86ff92, 0xff6ad0, 0xff5a5a, 0x6aa8ff, 0xffffff];   // the dataset colours the cards use

function letters(cv, s, x, y, c, sh) {   // the UI font at one pixel per cell, with a drop shadow
  for (const [col, off] of [[sh, 1], [c, 0]]) Array.from(s).forEach((ch, n) => (GLYPHS[ch] || GLYPHS[' ']).forEach((row, r) => Array.from(row).forEach((cell, q) => { if (cell === '#') dot(cv, x + n * 6 + q + off, y + r + off, col); })));
}
const width = (s) => s.length * 6 - 1;
const LEFT = [3, 3, 4, 4, 5, 5];   // the cube's left face: its top row in each of its six columns (as kardart draws it)
const onLeft = (cv, px, py, dx, r, c) => dot(cv, px - 6 + dx, py + LEFT[dx] + 1 + r, c);
function face(cv, form, px, py) {   // what a block carries on its face: a tool's screen, a pwa's phone and bolt, a server's slits and lights, a terminal's text and speech
  if (form === 'tool' || form === 'app') { rect(cv, px - 4, py + 7, 3, 2, 0x14141a); dot(cv, px - 3, py + 7, 0x86ff92); }
  if (form === 'pwa') { for (const r of span(0, 4)) { onLeft(cv, px, py, 2, r + 1, 0x14141a); onLeft(cv, px, py, 3, r + 1, 0x14141a); } onLeft(cv, px, py, 3, 2, 0xffe646); onLeft(cv, px, py, 2, 3, 0xffe646); }
  if (form === 'node') for (const dx of span(1, 5)) { onLeft(cv, px, py, dx, 1, 0x14141a); onLeft(cv, px, py, dx, 3, 0x14141a); if (dx > 3) { onLeft(cv, px, py, dx, 2, 0x86ff92); onLeft(cv, px, py, dx, 4, 0xffb347); } }
  if (form === 'talker') {
    for (const dx of span(1, 5)) for (const r of span(1, 4)) onLeft(cv, px, py, dx, r, r === 2 && dx < 4 ? 0x86ff92 : 0x0c1a14);
    rect(cv, px - 3, py - 9, 7, 4, 0xffffff); dot(cv, px - 2, py - 5, 0xffffff); dot(cv, px - 3, py - 4, 0xffffff);   // a speech bubble over it
    for (const x of [-2, 0, 2]) dot(cv, px + x, py - 7, 0x14141a);
  }
  if (form === 'router') {   // an antenna: a mast with a crossbar, a lit tip, its signal either side, and its lights
    rect(cv, px, py - 9, 1, 10, 0xb4b4bc); rect(cv, px - 2, py - 5, 5, 1, 0xb4b4bc); dot(cv, px, py - 10, 0xff5a5a);
    for (const [x, y] of [[-3, -9], [-4, -8], [3, -9], [4, -8]]) dot(cv, px + x, py + y, 0x2be8ff);
    onLeft(cv, px, py, 2, 2, 0x86ff92); onLeft(cv, px, py, 4, 3, 0x86ff92);
  }
  if (form === 'link') { onLeft(cv, px, py, 2, 2, 0x2be8ff); onLeft(cv, px, py, 3, 2, 0x2be8ff); }   // a swarm's block: the link that holds it to the team
}
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
    if (L.grid) { for (const x of span(4, lw, 8)) rect(cv, x, 0, 1, lh, (x - 4) % 40 ? L.grid[0] : L.grid[1]); for (const y of span(4, lh, 8)) rect(cv, 0, y, lw, 1, (y - 4) % 40 ? L.grid[0] : L.grid[1]); }   // grid paper
    const P = H.districts ? planOf(H.districts) : H.items ? ITEM_PLAN : PLAN, band = H.snapshot ? 12 : 0, cx = div(lw, 2) - P.shift, oy = div(lh - 128 - 2 * band, 2) + 50 + band - P.lift;
    const pos = (i, j, kk) => [cx + (i - kk) * 6, oy + (i + kk) * 3 - j * 6];

    // what stands where: towers in SCORER; the first plot's tool blocks, or each item in its own district; swarms in SWARM
    const open = new Set(), fresh = new Set(), locked = new Set(), district = (id) => P.ds.find((d) => d.id === id);
    const towers = H.cards.slice(0, 36).map((card, n) => ({ card, i: P.slots.scorer[n][0], kk: P.slots.scorer[n][1] }));
    const kit = H.items || P.slots.tools.slice(0, Math.min(H.tools, 36)).map(() => ({ form: 'tool' })), blocks = [], counts = { tools: H.tools, talker: H.talkers, router: H.routers };
    for (const where of (H.items ? ['tools', 'talker', 'router'] : ['tools']).filter((id) => P.opens[id])) {
      kit.filter((it) => (FOR[it.form] || 'tools') === where).slice(0, 36).forEach((it, n) => blocks.push({ it, i: P.slots[where][n][0], kk: P.slots[where][n][1], col: BLOCK[it.form] || TOOL[n % 6] }));
      P.opens[where].slice(0, tilesFor(counts[where])).forEach(([i, kk]) => open.add(i * PLOT + kk));
    }
    const byId = new Map(H.cards.map((card) => [card.id, card])), stacks = (H.swarms || []).slice(0, 36).map((sw, n) => ({ sw, i: P.slots.swarm[n][0], kk: P.slots.swarm[n][1], tall: Math.min(4, sw.members.length) }));
    if (H.swarms && P.opens.swarm) P.opens.swarm.slice(0, tilesFor(H.swarms.length)).forEach(([i, kk]) => open.add(i * PLOT + kk));
    P.opens.scorer.slice(0, tilesFor(H.cards.length)).forEach(([i, kk]) => open.add(i * PLOT + kk));
    for (const t of towers.concat(blocks, stacks)) { open.add(t.i * PLOT + t.kk); if ((t.card || t.it || t.sw).fresh) fresh.add(t.i * PLOT + t.kk); }   // a block always stands on open ground
    for (const d of P.ds.filter((x) => !x.open)) for (const kk of span(d.k[0], d.k[1])) for (const i of span(d.i[0], d.i[1])) locked.add(i * PLOT + kk);

    // the ground: two layers, grass on the open tiles, grey stone on the fenced ones
    for (const j of [-2, -1]) for (const [i, kk] of P.ground) {
      const [px, py] = pos(i, j, kk), lit = [256, 204, 154], t = i * PLOT + kk;
      if (j === -2) cube(cv, px, py, 0x8a5a33, t + 7, lit);
      else if (fresh.has(t)) cube(cv, px, py, 0x9ef06a, t, lit, 2, 0x7ad04a);
      else if (open.has(t)) cube(cv, px, py, 0x5fb83a, t, lit, 2, 0x4f9e30);
      else if (locked.has(t)) cube(cv, px, py, 0x6e6e78, t, lit, 2, 0x5a5a62);
      else cube(cv, px, py, 0x8e8e96, t, lit, 2, 0x76767e);
    }
    for (const d of P.ds.filter((x) => !x.open)) for (const kk of span(d.k[0], d.k[1])) for (const i of span(d.i[0], d.i[1])) {   // a fence round each locked district
      const edge = i === d.i[0] || kk === d.k[0] || i === d.i[1] - 1 || kk === d.k[1] - 1;
      if (edge && (i + kk) % 2 === 0) { const [px, py] = pos(i, -1, kk); rect(cv, px - 1, py - 1, 2, 5, 0x3a3a40); dot(cv, px - 1, py - 2, 0xb4b4bc); dot(cv, px, py - 2, 0xb4b4bc); }
    }

    // the blocks: towers (stone, capped in the card's rarity), item blocks, swarm stacks; drawn layer by layer, back to front
    const vox = [];
    for (const t of towers) {
      const p = RAR[t.card.ri], tall = div(t.card.stage, 25);
      for (const j of span(0, tall)) vox.push([j, t.kk, t.i, 0xb4b4bc, [256, 204, 154]]);
      vox.push([tall, t.kk, t.i, p.hi, [256, 190, 140]]);
      t.top = pos(t.i, tall, t.kk);
    }
    for (const b of blocks) vox.push([0, b.kk, b.i, b.col, [256, 204, 154], b.it]);
    for (const s of stacks) {   // a swarm: one block for each of its first four members, in that member's rarity, linked
      for (const j of span(0, s.tall)) vox.push([j, s.kk, s.i, RAR[byId.get(s.sw.members[j]).ri].hi, [256, 204, 154], LINK]);
      s.top = pos(s.i, s.tall - 1, s.kk);
    }
    vox.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    for (const [j, kk, i, col, lit, it] of vox) {
      const [px, py] = pos(i, j, kk);
      if (it && it.tier) cube(cv, px, py, col, i * 13 + kk * 7 + j, lit, 1, RAR[it.ti].hi); else cube(cv, px, py, col, i * 13 + kk * 7 + j, lit);   // an item's top edge is trimmed in its tier
      if (it) face(cv, it.form, px, py);
      if (it && it.fresh) { rect(cv, px + 3, py - 2, 3, 1, 0xffffff); rect(cv, px + 4, py - 3, 1, 3, 0xffffff); }   // a new item sparkles, as a new child does
    }
    // mesh wires between consented cards, and from each swarm to its members; then each card's sign: its creature, framed in its rarity
    const where = new Map(towers.map((t) => [t.card.id, t])), wires = H.wires.map(([a, b]) => [where.get(a), where.get(b)]);
    for (const s of stacks) for (const m of s.sw.members) wires.push([s, where.get(m)]);
    for (const [ta, tb] of wires) if (ta && tb) { line(cv, ta.top[0], ta.top[1] + 1, tb.top[0], tb.top[1] + 1, mul(L.wire, 150)); line(cv, ta.top[0], ta.top[1], tb.top[0], tb.top[1], L.wire); }
    for (const t of towers.slice().sort((a, b) => a.i + a.kk - (b.i + b.kk) || a.kk - b.kk)) {
      const p = RAR[t.card.ri], fr = creatureFront(t.card.id), x0 = t.top[0] - 5, y0 = t.top[1] - 17;
      rect(cv, x0, y0, 11, 16, p.lo); rect(cv, x0, y0, 11, 1, p.hi); rect(cv, x0, y0 + 15, 11, 1, p.hi); rect(cv, x0, y0, 1, 16, p.hi); rect(cv, x0 + 10, y0, 1, 16, p.hi);
      for (const q of span(0, 126)) if (fr.px[q * 4 + 3]) dot(cv, x0 + 1 + (q % 9), y0 + 1 + div(q, 9), (fr.px[q * 4] << 16) | (fr.px[q * 4 + 1] << 8) | fr.px[q * 4 + 2]);
      dot(cv, x0 + 9, y0 + 1, DCOL[DATASETS.indexOf(t.card.dataset)]);   // its dataset, as a pip in the corner
      if (t.card.fresh) { rect(cv, x0 + 4, y0 - 5, 3, 1, 0xffffff); rect(cv, x0 + 5, y0 - 6, 1, 3, 0xffffff); }   // a new child sparkles
    }

    // district names (or the player's own), lettered over the ground like signage; on the first plot the fenced ones say they are coming
    for (const d of P.ds) {
      const px = cx + d.label[0], py = oy + d.label[1], name = (H.names && H.names[d.id]) || d.name;
      letters(cv, name, px - div(width(name), 2), py, d.open ? L.text : L.dim, L.shadow);
      if (!d.open) letters(cv, P.note, px - div(width(P.note), 2), py + 10, L.dim, L.shadow);
    }
    if (H.cards.length > 36) { const more = '+' + (H.cards.length - 36) + ' MORE', px = cx - 48, py = oy + 12; letters(cv, more, px - div(width(more), 2), py, L.text, L.shadow); }
    for (const [id, n] of H.items ? [['tools', H.tools], ['talker', H.talkers], ['router', H.routers], ['swarm', H.swarms.length]].filter(([d]) => P.opens[d]) : []) if (n > 36) {   // past 36 in a district: how many more
      const d = district(id), more = '+' + (n - 36) + ' MORE';
      letters(cv, more, cx + d.label[0] - div(width(more), 2), oy + d.label[1] + 10, L.text, L.shadow);
    }

    // the snapshot's bands: what it is, and the numbers it was drawn from
    if (H.snapshot) {
      const s = estateStats(holdings), fit = (str) => str.slice(0, div(lw - 8, 6));
      rect(cv, 0, 0, lw, band, L.band); rect(cv, 0, lh - band, lw, band, L.band);
      letters(cv, fit('MY DIGI ESTATE'), 4, 2, L.bandText, L.band);
      const parts = [s.blocks + ' BLOCKS', s.tiles.total + ' TILES', s.links + ' MESH LINKS', ...(s.levels === null ? [] : [s.levels + ' LEVELS RERUN'])];
      const line = parts.reduce((acc, part) => (acc === null ? part : width(acc + ' \u00b7 ' + part) <= lw - 8 ? acc + ' \u00b7 ' + part : acc), null);   // whole items only, as many as fit
      letters(cv, fit(line), 4, lh - band + 2, L.bandText, L.band);
    }
    if (L.ramp) for (const y of span(0, lh)) for (const x of span(0, lw)) { const q = at(cv, x, y); dot(cv, x, y, L.ramp[(((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 14]); }   // a drawing: four blues, by brightness
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
