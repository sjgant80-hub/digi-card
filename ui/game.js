// ui/game.js — THE DIGI GAME VIEW: the same page, played. A dock of eight screens (estate, base, cards, evals, mint, mesh,
// send, proof) over the very sections the classic document shows, plus the screens a game needs: the first visit, the
// boot, the base, the estate and the eval runs. Every number on a screen is one the kernels just computed here or one
// read from a committed record, and says which; nothing is drawn inside a card's pixels (frames sit outside the PNG).
//
// This file drives app.js's actions through its `api`, and keeps score — evals, missions, uptime, the training run, the
// births refused, what ran while you were away — from the `digi` events app.js emits, in this browser's storage. Your
// key is never kept there: it lives in the tab and in your key file.
import { S, ready, api } from '../app.js';
import { verify, facts, encode } from '../src/dossier.mjs';
import { cardOf, readCard, W, H, BAND } from '../src/card.mjs';
import { answer, caseAt, scoreRow } from '../src/mind.mjs';
import { auc, decodeSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { SETS } from '../src/data.mjs';
import { standing, hashOf } from '../src/registry.mjs';
import { tally, consent } from '../src/mesh.mjs';
import { THEMES, paintArt } from '../vendor/pixelwhisperer/kards/kardart.mjs';
import { ratings } from '../src/arena.mjs';
import { slotsOf, equip, loadoutOk, kitted, kitChallenge, kitAccept, kitDuel, kitRerun } from '../src/kit.mjs';
import { appsOf, mintApp, giveItem, verifyItem, repoOf } from '../src/item.mjs';
import { begin, releaseOfDrop, releaseOfCard, releaseOfItem, valuesOfClear, gateFor, add, jobOf } from '../src/earn.mjs';
import { credits, allocate, replay as replayLedger, sha256 as kccSha, canonical as kccCanon } from '../vendor/kcc-mesh/contrib.mjs';
import { GROW } from '../src/mind.mjs';
import { bossesOf, strikeSeed, strike as raidStrike, check as checkStrike, standing as raidStanding, lootOf, BAR as RAID_BAR, worldBossesOf, partyStrike, checkClear, worldStanding, partyOf } from '../src/raid.mjs';
import { seal as sealGenome } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { issue as issueCard } from '../src/dossier.mjs';
import { verify as verifyLife } from '../src/dossier.mjs';
import { UI_ICONS, DATASET_ICONS, identicon as keyFace, paintText } from '../vendor/pixelwhisperer/kards/ui.mjs';
import { paintEstate, tilesFor, estateDoors, estateDoorAt } from '../vendor/pixelwhisperer/kards/estate.mjs';
import { paintSlot } from '../vendor/pixelwhisperer/kards/gear.mjs';
import { paintDuel } from '../vendor/pixelwhisperer/kards/arena.mjs';
import { paintBack } from '../vendor/pixelwhisperer/kards/back.mjs';
import { paintFusion, paintLineage } from '../vendor/pixelwhisperer/kards/fusion.mjs';
import { campaign, autoKit } from '../src/campaign.mjs';
import { replay, readBack } from '../src/replay.mjs';
import { SANDBOX, askedFor, boxable } from '../src/sandbox.mjs';
import { bracketOf, playOut, DRAWS_TO_TIE } from '../src/tournament.mjs';
import { reply, asks, vocabOf, sayFeature, sayNumber } from '../src/talker.mjs';
import { mark, MAX_TRIES } from '../src/learn.mjs';
import { join, leave, guildOf, MAX_STATEMENTS } from '../src/guild.mjs';
import { offered, shownDesc, sayOutcome, SHOWN_AS, ORGANS } from '../src/copy.mjs';
import { paintRaid, paintChapter } from '../vendor/pixelwhisperer/kards/raid.mjs';
import { utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { crc32, cat, zlibStored } from '../vendor/dex-frontier/vendor/living-seed/src/card.mjs';

// ── helpers: text is always set as text, never as markup ────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
const fill = (node, ...kids) => { if (node) node.replaceChildren(...kids.flat().filter((k) => k != null && k !== false).map((k) => (k instanceof Node ? k : document.createTextNode(String(k))))); return node; };
const setK = (k, v) => $$('[data-k="' + k + '"]').forEach((n) => { n.textContent = v; });
const pad4 = (n) => String(n).padStart(4, '0');
const six = (m) => (m == null ? '–' : (m / 1e6).toFixed(6));
const four = (m) => (m == null ? '–' : (m / 1e6).toFixed(4));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, calm() || G.skip ? 0 : ms));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* a preference only */ } } };
const line = (cls, ...kids) => el('li', { class: cls }, ...kids);
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const SET_NAMES = { telco: 'Telco', shop: 'Shop', bank: 'Bank', adult: 'Adult', credit: 'Credit', hospital: 'Hospital' };

// ── the "i" taps: one plain sentence behind every term a screen uses ──────────────────────────────────────────────
const INFO = {
  opslog: 'What your cards did since your last visit, and the one thing to do next.',
  evals: 'An eval is one real case the card has never seen: its answer, then what really happened. Optional; skipping a day loses nothing.',
  missions: 'Things to try. They win titles — nothing else, never money.',
  fusion: 'The Fusion lab: two of your cards of one business become one only if the fused card beats both parents on GATE, cases neither grew on, and anyone holding the ground re-runs it. This is model merging and selection: most merges do not beat both parents, and those are refused, never kept.',
  fuse: 'Of one department, the parents’ rule shapes are crossed rule by rule and, half the time, changed once; of two departments, the fused card carries both minds and answers through a coupling learned on GATE. Up to 12 tries run on this device, and the first that beats both is sealed with you as its maker, naming both parents.',
  lineage: 'Who a card was fused from, read from the seals of the cards this device holds. A parent this device does not hold is named by its id, never drawn or guessed.',
  sandbox: 'A tool runs in a box: a frame that never shares this page’s origin, so it cannot read or change anything of the game’s — your cards, this page’s storage — and it never moves a score. Before it opens, its own page is read for what it asked for: the network its security policy lets it reach, and whether it keeps anything in storage (inside the box, its own and empty).',
  replay: 'Watched back: the duel fought again from its own receipt (it must give the very same numbers), then laid out case by case — each side’s call, and whether the case really was a yes. Tap a case to read it back: the very rules of each mind that fired on it.',
  talker: 'The talker: ask your Kardling in plain words. It reads the values your question gives with its business’s own words, then answers yes or no with the rules that fired, says how it decides, or says how good it is, as this device measured it. Anything else, or a question missing a value its rules read, gets an honest “I can’t answer that” and what it would need. It never makes an answer up: the same question always gets the same answer, with a receipt.',
  learn: 'Learn to ask: ten missions that teach asking a card that can tell you no, from asking about one case to turning its answer round with one value. Each is marked by the talker itself, by asking the card again the questions you asked it: nothing stored is trusted, and no model judges.',
  guild: 'A guild: friends standing together. Each of you signs a join with your own key, carrying your estate as you hold it, and the guild draws every member’s estate side by side. Nobody can join anybody else; your later leave takes you out and a later join brings you back. A signature proves who said it, not that it is so, so cards of the drop are checked against the drop. A guild moves no card, no rating and no credit.',
  tournament: 'A tournament: your cards of one business in a bracket, seeded by their ratings, the best two apart until the final. Each match is decided by the first duel receipt between exactly those two cards that is not a draw; if their first three duels are all draws, the tie rule sends the higher seed through, so two evenly matched cards can never stall the bracket; a match with neither yet stays open. Duels of your own cards are practice, so the champion is a practice champion: a title, and nothing else.',
  campaign: 'The campaign: each business is a chapter — first the parts of it no card has cracked, nearest the bar first, then the business itself as a world boss. Chapters run with the least left to clear first; a chapter is cleared only when every boss in it has fallen, read from your strikes and party strikes, which anyone can re-run.',
  organ4: 'Organ 4 wrote its rules down and sealed them in git before it fused a single card, then measured them; each verdict here is read from its committed record. A prediction that failed stays on show.',
  registry: 'This device’s ordered record of every card’s life. It is what stops a card being given away twice.',
  forms: 'The forms a Kardling fights in. Alone: its own mind. Kitted: with your own node cards in its slots. Mesh: with other owners’ cards, each by its owner’s consent. Party: a raid, with friends’ Kardlings. Every one is live.',
  mint: 'Make a card from your own table: a CSV export with a yes/no column. Your rows never leave this device. If its mind does not reach 0.6, nothing is minted.',
  skins: 'A skin changes the picture, never the mind. It is signed into the card’s life, so any reader redraws it.',
  estate: 'One block for every card you hold. More cards open more tiles. Nothing on it is for sale, and it is never ranked.',
  overnight: 'While this page stays open, your cards search for levels. A level is kept only after it re-runs; until then nothing changes.',
  districts: 'What your estate holds, by kind: your cards, the Kardlings you have kitted out, the app tools you hold, your mesh links, and the raid bosses you have felled.',
  bar: 'A department got cards only if its mind ranked unseen cases at least this well (GATE 0.6). These did not, so they have none — kept on the record, not hidden.',
  training: 'Training is a search for a better mind. It must beat the old one by +0.002 on GATE, and re-run, before the level goes up.',
  drop: '1,000 genesis cards whose rules were fixed before the first search. Rerun it to check every seal here, from nothing.',
  life: 'Every event in the card’s life, signed by the right key and linked to the one before. No column holds money: nothing here is for sale.',
  verify: 'Re-checks the card here, in order: the PNG, its data band, its seals, its signatures, this device’s registry, and every pixel of its face.',
  organs: 'The build’s claims, each written down and locked before it was measured, then judged by those rules alone. The ones that failed are shown, not hidden.',
  rules: 'Its whole mind: at most six rules over one department’s columns. Each adds or takes away points; above the line means yes.',
  key: 'Your key is what makes cards yours. It lives in this tab and in the key file you save — never on a server, never in this browser’s storage. Lose the file and you lose the cards.',
  gate: 'How well its mind ranks cases it never grew on: 0.5 is a coin toss, 1.0 is perfect. Every genesis card reached 0.6.',
  boot: 'The page reads the card, checks every seal and every pixel, fetches its public dataset (checked by its hash) and grows its mind here, on your device.',
  give: 'A give hands the card to another key for good. To get it back, they must give it back. Send the same card twice and the second is refused.',
  mesh: 'Cards from one business’s departments answering together. Only scores pass between them, never records. Each card’s share is its measured part of a million.',
  credits: 'Accounting of what your cards measurably added in a mesh. Not money; it cannot be cashed.',
  estatestats: 'Blocks: cards you hold. Levels re-run: levels your cards earned and this device re-checked. Fusions: fused cards that beat both parents, and pairs refused. Mesh links: your cards joined, by your consent, in a mesh.',
  legend: 'A cyan wire joins cards of yours working together in a mesh. A green top marks a card new since your last visit. Grey fenced tiles open as you hold more cards: a district holding n cards opens 8 + 2n tiles, up to 36.',
  test: 'The same measure on cases nothing in the build ever grew on or was chosen by: the honest check.',
  abstain: 'When its rules cannot read a case, it says “I don’t know” instead of guessing.',
  lv: 'Levels earned. A level counts only when a new search beats its mind by 0.002 and anyone can re-run it. Rarity follows the level.',
  gen: 'Generation: 0 for a genesis card; a fused card is one more than its parents.',
  owners: 'How many keys it has passed through. Replay checks its whole signed life.',
  worldboss: 'A whole business, at the best score any lone genesis search reached on it plus 0.010. No card alone has reached it: a party can, of your own cards and friends’ by their owners’ consent. The party’s record names every member card, its owner and its measured share.',
  raids: 'A raid is many players searching one unsolved department, each search signed and re-checkable. The boss’s health is how far the best search so far is from the 0.6 bar. The first strike to clear it fells the boss, and its striker seals the first card of that department — the loot. The best of many tries is luckier than one: the screen always says how many strikes it took.',
  arena: 'Two cards of one business meet on 64 cases both minds were proven on, chosen by both owners’ signatures together. Each side fights as it is kitted: its nodes answer with it, weighed on GATE cases outside the batch; its tools change nothing. The side that ranks the cases better wins. Nothing is staked: a duel moves no card and no credit, and anyone re-runs it from its receipt.',
  kit: 'Your Kardling’s inventory. Node slots hold your own cards of the same business, which answer with it; tool slots hold app items, which ride with it. Every card has its slots from its issue, and levels open more node slots.',
  nodes: 'A node is another card of yours from the same business, for a department your Kardling does not cover. It joins only if it measurably adds: it must answer here, cover something new and beat a coin on GATE.',
  tools: 'A tool is one of the estate’s apps whose own CI passed on GitHub’s machines at the commit it names. It opens from here, and it moves no score.',
  kitted: 'The kitted mind is your Kardling and its nodes coupled into one answer, scored out of fold on GATE. What a slot adds is the score with it, less the score without it.',
  mintnode: 'Minting a node is one search on a department, from a seed your key fixes, like a raid strike. Only a mind that clears 0.6 on GATE is sealed, with you as its maker.',
  mintapp: 'Minting an app tool signs an item naming that app, its commit and the run that proved it. It is free, and it checks only while the estate’s records list the app exactly so.',
  record: 'Your record in the credits ledger: the release of every card and app tool you made, and the measured share of every card in every party you struck — each recorded only once its proof re-runs here, nothing counted twice. Credits are accounting, not money; the switch that would make any allocation live is off.',
  ladder: 'Ratings from the duels this device has seen, in order, from a published table — the same on every device. Self-play is never rated.',
};
/** an "i" button and the sentence it opens, beside the term it explains */
function infoFor(key) {
  if (!INFO[key]) return [];
  const p = el('p', { class: 'g-info', hidden: true }, INFO[key]);
  const b = el('button', { type: 'button', class: 'g-i', 'aria-expanded': 'false', 'aria-label': 'What is this?', title: 'What is this? One plain sentence', onclick: () => { p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); } }, 'i');
  return [b, p];
}
function wireInfo() {
  for (const n of $$('[data-info]')) {
    if (n.querySelector(':scope > .g-i')) continue;
    const [b, p] = infoFor(n.dataset.info);
    if (!b) continue;
    n.append(b);
    if (n.classList.contains('g-chip')) { p.classList.add('g-info-pop'); n.style.position = 'relative'; n.append(p); } else n.after(p);
  }
}

// ── the game's own memory: progress, never the key ──────────────────────────────────────────────────────────────────
const G = { screen: null, skip: false, booting: false, grown: new Map(), tests: new Map(), lifeId: null, plot: null, install: null, sound: false, audio: null,
  st: { v: 1, days: [], seen: null, evals: { day: '', n: 0 }, done: {}, births: { kept: 0, refused: 0 }, refused: 0, searches: {}, log: [] } };
async function loadState() {
  const s = await api.load('game');
  if (s && s.v === 1) G.st = { ...G.st, ...s };
  const d = today();
  if (!G.st.days.includes(d)) G.st.days = [...G.st.days, d].slice(-60);
  G.since = G.st.seen || null;   // what ran after this moment ran while you were away
  G.st.seen = new Date().toISOString();
  await saveState();
}
const saveState = () => api.save('game', G.st);
function note(type, facts = {}) {
  G.st.log = [...G.st.log, { t: new Date().toISOString(), type, ...facts }].slice(-200);
  saveState();
}
/** consecutive days played, forgiving: a single missed day is frozen, not lost */
function uptime() {
  const days = new Set(G.st.days), d = new Date();
  let n = 0, gap = 0;
  for (let i = 0; i < 400; i++) {
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (days.has(k)) { n++; gap = 0; } else if (i > 0 && ++gap > 1) break;
    d.setDate(d.getDate() - 1);
  }
  return Math.max(1, n);
}

// ── sound: off unless the player turns it on; made here, nothing fetched ─────────────────────────────────────────────
const TUNES = { boot: [523, 659, 784], right: [784, 1047], wrong: [330, 247], level: [523, 659, 784, 1047], kept: [659, 988], refused: [220, 165], abstain: [440, 440] };
function bleep(name) {
  if (!G.sound || !TUNES[name]) return;
  try {
    G.audio ||= new AudioContext();
    const a = G.audio, t0 = a.currentTime;
    TUNES[name].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.value = 0.04; o.connect(g); g.connect(a.destination); o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.08); });
  } catch { G.sound = false; }
}

// ── cards on screen: drawn from their lives, framed by their rarity outside the PNG ──────────────────────────────────
/** a card that checked in the Inbox: its back first, with its maker's mark, then turned face up */
async function inboxFlip(id) {
  const d = api.lifeOf(id), v = d ? await verify(d) : null, cv = $('#g-inbox-card');
  if (!v || !v.ok) { $('#g-inbox-box').hidden = true; return; }
  $('#g-inbox-box').hidden = false; $('#g-inbox-ring').className = 'g-ring'; cv.classList.add('g-facedown');
  paintOn(cv, paintBack({ maker: v.maker, serial: v.serial }, v.theme, cv.width, cv.height));
  cv.setAttribute('aria-label', 'The card you opened, face down: its maker’s mark');
  await sleep(400);
  await flipUp(cv, $('#g-inbox-ring'), d);
  cv.setAttribute('aria-label', 'The card you opened: ' + facts(v).title + ' #' + pad4(v.serial));
}
/** exactly one filled NEXT on a screen: this one, and every other action on its screen outline-only */
function soleNext(node) {
  const screen = node && node.closest('section[data-screen]');
  if (screen) for (const n of screen.querySelectorAll('.g-next')) if (n !== node) n.classList.remove('g-next');
}
/** KARDLINGS, lettered by the UI font: 3x for the bar, 2x for a phone */
function paintLogo() {
  let painted = 0;
  for (const [id, k] of [['#g-logo-3', 3], ['#g-logo-2', 2]]) {
    const t = paintText('KARDLINGS', k, '#ffd23c', '#4a1480'), cv = $(id);
    if (!t.ok || !cv) continue;
    cv.width = t.w; cv.height = t.h;
    const x = cv.getContext('2d'), img = x.createImageData(t.w, t.h); img.data.set(t.px); x.putImageData(img, 0, 0); painted++;
  }
  if (painted === 2) $('.g-logo').classList.add('painted');
}
/** the first visit's five steps — card me, boot, kit, arena, estate — each read from what this device has done */
const RAIL = [['cards', 'Card me', 'first', () => api.mine().length > 0], ['boot', 'Boot', 'boot', () => !!G.st.done.boot], ['equip', 'Kit', 'kit', () => Object.keys(G.st.loadouts || {}).length > 0],
  ['eval', 'Arena', 'arena', () => (G.st.duels || []).length > 0], ['estate', 'Estate', 'estate', () => !!G.st.done.estate]];
function renderRail() {
  const rail = $('#g-rail');
  if (!rail) return;
  const done = RAIL.map((s) => s[3]()), now = done.indexOf(false);
  rail.hidden = now < 0;
  fill(rail, RAIL.map(([icon, name, screen], k) => {
    const state = done[k] ? 'done' : k === now ? 'now' : 'next';
    return el('a', { href: '#' + (screen === 'first' && done[k] ? 'cards' : screen), class: state, 'aria-current': k === now ? 'step' : null },
      iconCanvas(UI_ICONS[icon], 2, state === 'done' ? '#86ff92' : state === 'now' ? '#ff2bd6' : '#8f7fbf'), el('span', { class: 'l' }, name), done[k] ? '✓' : null);
  }));
}
/** turn a face-down card face up: a pixel flip (still for reduced motion), the face drawn at its edge */
async function flipUp(canvas, ring, d) {
  if (!calm()) { canvas.classList.add('g-flipping'); await sleep(180); }
  await show(canvas, ring, d);
  canvas.classList.remove('g-facedown'); canvas.setAttribute('aria-label', 'The card booting');
  if (!calm()) { await sleep(180); canvas.classList.remove('g-flipping'); }
}
async function show(canvas, ring, d) {
  const v = await api.drawCard(canvas, d);
  if (ring) { ring.className = 'g-ring' + (v ? ' r-' + facts(v).rarity : ''); }
  return v;
}
const declaredOf = (id) => (S.manifest && (S.manifest.first.card === id ? S.manifest.first : S.manifest.cards.find((c) => c.card === id))) || null;
const featured = () => (S.sel && S.reg.cards[S.sel] ? S.sel : api.mine()[0] || (S.manifest && S.manifest.first.card));
const isGenesis = (v) => S.maker && v.maker === S.maker.pub && v.generation === 0;
const serialLine = (v) => (isGenesis(v) ? '#' + pad4(v.serial) + ' of ' + S.manifest.total.toLocaleString() : '#' + pad4(v.serial) + (v.maker === S.me.pub ? ' · minted by you' : ''));
const whose = (v) => (v.owner === S.me.pub ? 'yours' : v.owner === S.maker.pub ? 'the drop maker’s' : api.short(v.owner));

// ── screens ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const ALIAS = { wallet: 'cards', own: 'mint', open: 'send', drop: 'proof', explorer: 'proof', 'send-s': 'send', 'base-s': 'base', 'estate-s': 'estate', 'evals-s': 'evals', 'boot-s': 'boot', 'first-s': 'first' };
const CLASSIC = ['top', 'what', 'worth', 'words', 'start', 'how', 'blueprint', 'business', 'cost', 'paper', 'faq'];
const SCREENS = ['first', 'boot', 'estate', 'base', 'cards', 'kit', 'fusion', 'talker', 'arena', 'raids', 'evals', 'mint', 'mesh', 'send', 'proof'];
const DOCK = ['estate', 'base', 'cards', 'arena', 'mint', 'mesh', 'send', 'proof'];
const TITLES = { first: 'Kardlings', boot: 'Boot', estate: 'My estate', base: 'Base', cards: 'Cards', kit: 'Kit', fusion: 'Fusion Lab', talker: 'Talker', arena: 'Arena', raids: 'Raids', evals: 'Eval runs', mint: 'Mint station', mesh: 'Mesh', send: 'Send', proof: 'Proof explorer', about: 'About' };

function route() {
  const h = decodeURIComponent((location.hash || '').slice(1));
  if (/^card=\d{1,4}$/.test(h)) return go('proof', { keepHash: true });
  if (CLASSIC.includes(h)) return toClassic(false, h);
  const s = ALIAS[h] || h;
  if (SCREENS.includes(s)) return go(s, { keepHash: true });
  return go(api.mine().length ? 'estate' : 'first', { keepHash: true });
}
function go(screen, opts = {}) {
  if (!document.documentElement.classList.contains('game')) return;
  G.screen = screen;
  $$('section[data-screen]').forEach((s) => s.classList.toggle('on', s.dataset.screen === screen));
  $$('#g-dock a').forEach((a) => { if (a.dataset.go === screen || (a.dataset.group || '').split(' ').includes(screen)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.title = TITLES[screen] + ' · Kardlings';
  if (!opts.keepHash && location.hash !== '#' + screen) history.replaceState(null, '', '#' + screen);
  if (!opts.keepScroll) scrollTo(0, 0);
  const h = $('section[data-screen="' + screen + '"].on h2, section[data-screen="' + screen + '"].on .g-h');
  if (opts.focus !== false && h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  render(screen);
}
function render(screen) {
  ({ first: renderFirst, estate: renderEstate, base: renderBase, cards: renderCards, kit: renderKit, fusion: renderFusion, talker: renderTalker, arena: () => { renderArena(); renderTournament(); }, raids: () => { renderCampaign(); renderRaids(); renderWorld(); }, evals: renderEvals, mint: () => {}, mesh: renderMesh, send: renderSend, proof: renderProof }[screen] || (() => {}))();
  renderTop(); renderRail();
}

// ── the top bar ──────────────────────────────────────────────────────────────────────────────────────────────────────
function renderTop() {
  setK('g-blocks', String(api.mine().length));
  const t = S.mesh && S.ledger.length ? tally(S.ledger, S.mesh.m) : null;
  setK('g-credits', String(t && t.ok ? t.totals[S.me.pub] || 0 : 0));
  setK('g-uptime', uptime() + 'd');
  const tag = $('#g-key-tag');
  if (tag) { tag.textContent = S.keySaved ? 'saved' : 'not saved'; tag.className = 'g-tag ' + (S.keySaved ? 'ok' : 'bad'); }
  identicon($('#g-idn'), S.me.pub);
}
/** a key's face, PixelWhisperer's identicon: two keys look different at a glance (it proves nothing; the key does) */
function identicon(canvas, pub) {
  if (!canvas || !pub) return;
  const f = keyFace(pub, 4);
  if (f.ok) putRGB(canvas, f.px, 40, 40);
}
/** RGB rows onto a canvas of that size */
/** a painting from the art engine on a canvas, if it painted; a picture that cannot be drawn leaves the canvas as it was */
function paintOn(canvas, painted) { if (!canvas || !painted || !painted.ok) return false; putRGB(canvas, painted.px, canvas.width, canvas.height); return true; }
/** the art engine's letters only: A–Z a–z 0–9 space & . - and the apostrophe, cut to length */
const artText = (s, n) => String(s).replace(/[^A-Za-z0-9 &'.-]/g, '').slice(0, n).trim();
/** a kit slot, drawn by PixelWhisperer's gear painter: the card or the app item in it, its worth, or an empty well */
function slotArt(slot, label) {
  const c = el('canvas', { width: 112, height: 128, class: 'g-slotart', role: 'img', 'aria-label': label });
  paintOn(c, paintSlot(slot, plotTheme(), 112, 128));
  return c;
}
function putRGB(canvas, px, w, h) {
  canvas.width = w; canvas.height = h;
  const x = canvas.getContext('2d'), img = x.createImageData(w, h);
  for (let i = 0, j = 0; i < px.length; i += 3, j += 4) { img.data[j] = px[i]; img.data[j + 1] = px[i + 1]; img.data[j + 2] = px[i + 2]; img.data[j + 3] = 255; }
  x.putImageData(img, 0, 0);
}
/** a 16 × 16 icon of '#' cells, drawn at a whole scale in one colour */
function iconCanvas(rows, k, color, label) {
  const c = el('canvas', { width: 16 * k, height: 16 * k, class: 'g-icon', 'aria-hidden': label ? null : 'true', role: label ? 'img' : null, 'aria-label': label || null }), x = c.getContext('2d');
  x.fillStyle = color;
  rows.forEach((row, y) => Array.from(row).forEach((cell, i) => { if (cell === '#') x.fillRect(i * k, y * k, k, k); }));
  return c;
}
const SET_COLOUR = { telco: '#40e8ff', shop: '#ffa040', bank: '#ffd23c', adult: '#dba2ff', credit: '#86ff92', hospital: '#ff7a8a', custom: '#7dff8a' };

// ── first visit ──────────────────────────────────────────────────────────────────────────────────────────────────────
function renderFirst() {
  const before = Object.values(S.reg.cards).filter((c) => c.owner !== S.me.pub && (G.st.pubs || []).includes(c.owner)).length;
  setK('g-away-cards', String(before));
  const back = $('#g-first-back');
  if (back) back.hidden = !before;
}
/** remember the public half of a key that has held cards here, so a returning player is told to open their key file */
function rememberPub() { if (S.me && api.mine().length && !(G.st.pubs || []).includes(S.me.pub)) { G.st.pubs = [...(G.st.pubs || []), S.me.pub].slice(-8); saveState(); } }
async function firstCard() {
  const btn = $('#g-first-cardme');
  btn.disabled = true; btn.textContent = 'Signing your card…';
  const id = await api.cardMe({ domain: 'telco-account', quiet: true });   // a first card whose rules read no protected characteristic
  btn.disabled = false; btn.textContent = 'Card me';
  if (id) bootCard(id);
}

// ── boot: the card is read and checked, its data fetched and checked, its mind grown — then the score, matched ───────
async function bootCard(id) {
  if (G.booting) return;
  G.booting = true; G.skip = false;
  try {
    go('boot', { focus: false });
    const d = api.lifeOf(id), v = await verify(d);
    if (!v.ok) { fill($('#g-boot-steps'), line('r', '✗ ' + v.why)); return; }
    const f = facts(v);
    fill($('#g-boot-name'), f.title + ' ' + serialLine(v));
    // face down first: the back carries its maker's mark; the face is shown only once it re-draws and matches
    const cardCv = $('#g-boot-card');
    paintOn(cardCv, paintBack({ maker: v.maker, serial: v.serial }, v.theme, cardCv.width, cardCv.height));
    cardCv.classList.add('g-facedown'); cardCv.setAttribute('aria-label', 'The card, face down: its maker’s mark, until its picture re-draws'); $('#g-boot-ring').className = 'g-ring';
    const bytes = utf8(encode(d)).length;
    fill($('#g-boot-band'), 'Band · ' + bytes.toLocaleString() + ' bytes · the top 16 rows');
    fill($('#g-boot-gate'), '0.000000'); fill($('#g-boot-match')); fill($('#g-boot-rows')); fill($('#g-boot-rules')); fill($('#g-boot-protected')); fill($('#g-boot-say'));
    const steps = ['The file is whole · every checksum (CRC) passes', 'Its data strip reads · ' + bytes.toLocaleString() + ' bytes in one exact form', 'Its signatures check · ' + d.events.length, 'Its picture is redrawn and matches · ' + (W * (H - BAND)).toLocaleString() + ' pixels', 'Data · fetching', 'Mind · growing'];
    const lis = steps.map((s) => line('wait', '· ' + s));
    fill($('#g-boot-steps'), lis);
    const scan = $('#g-scan');
    scan.classList.remove('on'); void scan.offsetWidth; scan.classList.add('on');   // the band's 16 rows, read top to bottom (beside the card, never on it)
    const png = await cardOf(d, api.paint), r = await readCard(png.png, api.paint);
    const fail = r.ok ? -1 : /PNG|chunk|picture|CRC/.test(r.why) ? 0 : /band|dossier/.test(r.why) ? 1 : /face/.test(r.why) ? 3 : 2;
    for (let k = 0; k < 4; k++) {
      await sleep(160);
      if (k === fail) { lis[k].className = 'r'; lis[k].textContent = '✗ ' + steps[k] + ' — ' + r.why; bleep('refused'); return; }
      lis[k].className = 'k'; lis[k].textContent = '✓ ' + steps[k];
      if (k === 3) { await flipUp(cardCv, $('#g-boot-ring'), d); }
    }
    lis[4].className = 'm'; lis[4].textContent = '→ Data · fetching';
    await api.select(id);
    let rows = null;
    const g = await api.groundFor(v, (t) => { lis[4].textContent = '→ Data · ' + t; });
    rows = g.ds.y.length;
    lis[4].className = 'k'; lis[4].textContent = '✓ ' + (SET_NAMES[api.setOf(v)] || 'Your table') + ' data fetched · ' + rows.toLocaleString() + ' rows · fingerprint (hash) checked';
    lis[5].className = 'm';
    const grown = await api.actGrow();
    if (!grown || grown.gate == null) { lis[5].className = 'r'; lis[5].textContent = '✗ Mind · ' + (grown && grown.error ? grown.error : 'it did not clear its bar here: it abstains, always'); bleep('abstain'); return; }
    G.grown.set(id, grown);
    const rules = grown.mind.organs.filter((o) => o.body).flatMap((o) => o.body.rules);
    lis[5].className = 'k'; lis[5].textContent = '✓ Its mind grows here · ' + rules.length + ' rules · ' + grown.ms + ' ms';
    // the score counts up to the number this device computed, then is set beside the one declared
    const target = grown.gate, gateBox = $('#g-boot-gate'), t0 = performance.now(), span = calm() || G.skip ? 0 : 900;
    await new Promise((done) => { const tick = (t) => { const p = span ? Math.min(1, (t - t0) / span) : 1; gateBox.textContent = six(Math.round(target * p)); if (p < 1) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
    const dec = grown.declared;
    fill($('#g-boot-match'), dec == null ? el('span', { class: 'g-tag cy' }, v.receipts.some((x) => x.kind === 'level') ? 'levelled · its receipts carry its numbers' : 'your own card · no drop number to match')
      : dec === target ? [el('span', { class: 'g-dim' }, 'declared ' + six(dec)), el('span', { class: 'g-tag ok' }, 'matches')] : [el('span', { class: 'g-dim' }, 'declared ' + six(dec)), el('span', { class: 'g-tag bad' }, 'does not match')]);
    fill($('#g-boot-rows'), 'On ' + grown.rows.toLocaleString() + ' cases it never grew on');
    bleep(dec == null || dec === target ? 'boot' : 'wrong');
    for (const o of grown.mind.organs.filter((x) => x.body)) for (const rule of o.body.rules) {
      await sleep(90);
      $('#g-boot-rules').append(line(rule.w > 0 ? 'k' : 'r', rule.feat + ' ' + (rule.op === '<=' ? '≤' : '>') + ' ' + rule.v, el('b', { class: rule.w > 0 ? 'up' : 'down' }, (rule.w > 0 ? '+' : '') + rule.w)));
    }
    const thr = grown.mind.threshold, outcome = SETS[api.setOf(v)] ? sayOutcome(api.setOf(v), SETS[api.setOf(v)].outcome) : 'yes';
    fill($('#g-boot-say'), 'Score above ' + thr + ' → yes: it ' + outcome);
    if (!G.st.done.boot) { G.st.done.boot = true; saveState(); } renderRail();
    const hit = [...new Set(rules.map((x) => api.protectedOf(x.feat)).filter(Boolean))];
    if (hit.length) fill($('#g-boot-protected'), el('p', { class: 'g-warn' }, '⚠ Reads ' + hit.join(', ') + ' — protected characteristics (Equality Act 2010). A research mind on a public dataset: check you may lawfully use these columns before it informs a decision about a person.'));
    note('boot', { id, gate: target, matches: dec == null ? null : dec === target });
    renderKeep();
    offerInstall();
  } catch (e) { $('#g-boot-steps').append(line('r', '✗ ' + String(e.message || e))); } finally { G.booting = false; }
}
function renderKeep() {
  const keep = $('#g-keep');
  if (!keep) return;
  fill($('#g-keep-why'), S.keySaved ? 'Your key file is saved · open it here next time to hold your cards' : 'Your key lives only in this tab until you save it');
  $('#g-keep-why').className = 'g-small ' + (S.keySaved ? 'g-okt' : 'g-badt');
  $('#g-save-key').textContent = S.keySaved ? 'Save my key file again' : 'Save my key file';
}
function offerInstall() {
  if (G.install && store.get('digi-install') !== 'no') $('#g-install').hidden = false;
}

// ── base ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function renderBase() {
  const id = featured();
  if (!id) return;
  const d = api.lifeOf(id), v = await show($('#g-feat'), $('#g-feat-ring'), d);
  if (!v) return;
  const f = facts(v), dec = declaredOf(id), grown = G.grown.get(id);
  fill($('#g-feat-title'), f.title);
  fill($('#g-feat-serial'), serialLine(v));
  const tag = $('#g-feat-tag'); tag.textContent = isGenesis(v) ? 'genesis' : 'gen ' + v.generation; tag.className = 'g-tag ' + (isGenesis(v) ? 'ok' : 'cy');
  fill($('#g-feat-line'), el('span', { class: 'g-dim' }, (SET_NAMES[f.dataset] || 'Your own') + ' · ' + f.department), el('span', { class: 'g-tag cy' }, grown ? 'GATE ' + four(grown.gate) + ' · measured here' : dec && !v.receipts.length ? 'GATE ' + four(dec.gate) + ' · declared' : 'boot to measure'),
    el('span', { class: 'g-tag' }, f.rarity + ' lv' + f.stage), el('span', { class: 'g-tag' + (v.owner === S.me.pub ? ' ok' : '') }, whose(v)));
  fill($('#g-feat-note'), v.owner === S.me.pub ? '' : 'Not yours: boot it, eval it, verify it — only its owner can train, fuse, skin or send it.');
  // ops log: what ran while you were away, then the one next thing
  const since = G.since, away = G.st.log.filter((x) => since && x.t > since);
  const searches = away.filter((x) => x.type === 'search').length, levels = away.filter((x) => x.type === 'level').length, refused = away.filter((x) => x.type === 'refused' || (x.type === 'search' && !x.kept) || (x.type === 'birth' && !x.kept)).length;
  fill($('#g-away'), since && away.length ? [line('', searches + ' search' + (searches === 1 ? '' : 'es') + ' ran'), line('k', levels + ' level' + (levels === 1 ? '' : 's') + ' kept · re-run'), line('r', refused + ' refused')] : line('x', since ? 'Nothing ran while you were away' : 'Your first visit'), line('y', 'Next · ' + nextThing()));
  renderEvalsMini();
  renderTicker();
  renderSkins(v, d);
}
function nextThing() {
  if (!api.mine().length) return 'card me';
  if (!S.keySaved) return 'save your key file — it is what makes your cards yours; lose it and you lose them';
  if (S.storedKey) return 'remove your key from this browser (Cards)';
  if (!G.grown.size) return 'boot your card';
  if (G.st.evals.day !== today() || G.st.evals.n < 3) return 'eval a test case';
  if (!G.st.done.drop) return 'rerun the drop';
  return 'train a card · or mint one from your table';
}
function renderEvalsMini() {
  const n = G.st.evals.day === today() ? G.st.evals.n : 0;
  fill($('#g-evals-mini'), el('a', { class: 'g-line m', href: '#evals' }, 'Ask your card about 3 real cases', el('small', {}, Math.min(n, 3) + ' of 3')),
    el('div', { class: 'g-bar' }, el('i', { style: 'width:' + Math.round((Math.min(n, 3) / 3) * 100) + '%;background:#7dff8a' })),
    MISSIONS.map((m) => el('a', { class: 'g-line ' + (G.st.done[m.key] ? 'k' : 'y'), href: m.href }, (G.st.done[m.key] ? '✓ ' : 'Mission · ') + m.name)));
}
function renderTicker() {
  let issued = 0, gives = 0, levels = 0, births = 0;
  for (const id of Object.keys(S.reg.cards)) {
    const d = api.lifeOf(id);
    if (!d) continue;
    issued++;
    for (const e of d.events) { if (e.type === 'give') gives++; else if (e.type === 'receipt' && e.receipt.kind === 'level') levels++; }
    if (d.events[0] && d.events[0].generation > 0) births++;
  }
  const refused = G.st.refused + G.st.births.refused;
  fill($('#g-ticker'), line('k', 'Levels, each re-checked · ' + levels), line('r', 'Forged or broken cards turned away · ' + refused), line('', 'Fused cards kept · ' + births), line('', 'Cards handed from key to key · ' + gives.toLocaleString()), line('y', 'Genesis cards issued · ' + issued.toLocaleString()),
    line('x', S.manifest.total.toLocaleString() + ' genesis cards · the rules for making them were fixed before the first one was made'), line('x', 'Log head ' + S.manifest.log.head.slice(0, 8) + '…' + S.manifest.log.head.slice(-4)));
}
function renderSkins(v, d) {
  const box = $('#g-skins');
  if (!box) return;
  const f = facts(v), mine = v.owner === S.me.pub;
  fill(box, Object.keys(THEMES).map((theme) => {
    const c = el('canvas', { width: 384, height: 560, 'aria-hidden': 'true' }), art = paintArt(f, theme, 384, 560);
    if (art.ok) { const x = c.getContext('2d'), img = x.createImageData(384, 560); for (let i = 0, j = 0; i < art.px.length; i += 3, j += 4) { img.data[j] = art.px[i]; img.data[j + 1] = art.px[i + 1]; img.data[j + 2] = art.px[i + 2]; img.data[j + 3] = 255; } x.putImageData(img, 0, 0); }
    return el('button', { type: 'button', 'aria-pressed': String(theme === v.theme), 'aria-label': 'Wear the ' + theme + ' skin', disabled: !mine || theme === v.theme, onclick: async () => { await api.select(v.id); await api.actSkin(theme); renderBase(); } }, c, theme.replace(/-v\d+$/, ''));
  }));
  fill($('#g-skin-note'), mine ? 'A skin changes only the picture; the mind does not change · the change is signed into the card' : 'Only its owner can change its skin');
  void d;
}

// ── estate ───────────────────────────────────────────────────────────────────────────────────────────────────────────
async function holdings() {
  const out = [];
  for (const id of api.mine()) { const v = await verify(api.lifeOf(id)); if (v.ok) out.push({ id, v, f: facts(v) }); }
  return out;
}
async function renderEstate() {
  if (!G.st.done.estate) { G.st.done.estate = true; saveState(); renderRail(); }
  const held = await holdings();
  const levels = held.reduce((n, h) => n + h.v.receipts.filter((r) => r.kind === 'level').length, 0);
  const born = held.filter((h) => h.v.generation > 0).length;
  const links = S.mesh ? S.mesh.m.fielded.filter((x) => x.owner === S.me.pub).length : 0;
  fill($('#g-estate-stats'), [['Blocks', held.length], ['Levels, re-checked', levels], ['Fusions kept', born], ['Fusions refused', G.st.births.refused], ['Mesh links', links]].flatMap(([k, n]) => [el('dt', {}, k), el('dd', {}, String(n))]));
  const sets = {};
  for (const h of held) sets[h.f.dataset] = (sets[h.f.dataset] || 0) + 1;
  const kits = held.filter((h) => (G.st.loadouts || {})[h.id]).length, tools = (await heldItems()).length, felled = Object.keys(G.st.loot || {}).length;
  fill($('#g-districts'), line('k', 'Cards', el('small', {}, String(held.length))), line(kits ? 'k' : '', 'Kitted Kardlings', el('small', {}, String(kits))), line(tools ? 'k' : '', 'App tools', el('small', {}, String(tools))), line(links ? 'k' : '', 'Mesh links', el('small', {}, String(links))), line(felled ? 'k' : '', 'Bosses felled', el('small', {}, String(felled))));
  const away = G.st.log.filter((x) => G.since && x.t > G.since);
  const bred = away.filter((x) => x.type === 'birth'), kept = bred.filter((x) => x.kept).length;
  fill($('#g-overnight'), line('', away.filter((x) => x.type === 'search').length + ' searches ran'), line('k', away.filter((x) => x.type === 'level').length + ' levels kept · re-run'), line('', bred.length + ' fused · ' + kept + ' kept'), line('r', away.filter((x) => x.type === 'search' && !x.kept).length + ' searches refused'));
  await drawPlot(held);
  await renderGuild();
}
/** what the painter is handed: the verified holdings, the consented wires between them, the levels — nothing else */
/** what the estate holds besides cards: the app tools this key holds, and each Kardling kitted with nodes as a swarm of its cards */
async function worldOf(held) {
  const ids = new Set(held.map((h) => h.id)), items = new Map(), swarms = [];
  for (const { v } of await heldItems()) { const id = v.body.sha.slice(0, 16); if (!items.has(id)) items.set(id, { id, form: 'app', tier: v.body.tier }); }
  for (const h of held) {
    const k = await kitOf(h.v);
    const members = k.ok ? [h.id, ...k.lo.nodes.map((n) => n.card).filter((c) => ids.has(c))] : [];
    if (members.length >= 2) swarms.push({ id: h.id, members });
  }
  return { items: [...items.values()], swarms };
}
/** what the painter is handed: the verified holdings, the consented wires between them, the levels, the tools and kits —
 *  drawn as only the districts DIGI holds (scorer, tools, swarm), so no district on the plot is fenced off as not yet open,
 *  and the swarm district lettered KITTED: in DIGI it holds each DIGI kitted with its nodes */
function holdingsOf(held, snapshot = false, world = { items: [], swarms: [] }) {
  const since = G.since, fresh = (id) => !!(since && G.st.log.some((e) => e.id === id && e.t > since && (e.type === 'card' || e.type === 'birth' || e.type === 'minted')));
  const ids = new Set(held.map((h) => h.id)), mineIn = S.mesh ? S.mesh.m.members.filter((m) => m.joined && ids.has(m.card)).map((m) => m.card) : [];
  return { cards: held.map((h) => ({ id: h.id, dataset: h.f.dataset, department: String(h.f.department).slice(0, 16), stage: h.f.stage, rarity: h.f.rarity, generation: h.f.generation, fresh: fresh(h.id) })),
    wires: mineIn.slice(1).map((id, k) => [mineIn[k], id]), levels: held.reduce((n, h) => n + h.v.receipts.filter((r) => r.kind === 'level').length, 0), snapshot,
    items: world.items, swarms: world.swarms, districts: ['scorer', 'tools', 'swarm'], names: { swarm: 'KITTED' }, ...(snapshot ? {} : { landmarks: LANDMARK_DOORS }) };
}
/** the map's doors, each to a screen of the game: the three districts to what they hold, the five landmarks to their own screens */
const DOOR = Object.freeze({ scorer: 'cards', tools: 'kit', swarm: 'kit', arena: 'arena', raids: 'raids', fusion: 'fusion', mint: 'mint', proof: 'proof' });
const LANDMARK_DOORS = ['arena', 'raids', 'fusion', 'mint', 'proof'];
/** a tap on the map goes through the door under it: estateDoorAt reads the plot's own grid, so two districts whose boxes
 *  overlap never send a tap to the wrong one */
function plotTap(e) {
  if (!G.doors) return;
  const r = e.currentTarget.getBoundingClientRect(), { H, w, h } = G.doors;
  const x = Math.min(w - 1, Math.max(0, Math.floor(((e.clientX - r.left) * w) / r.width))), y = Math.min(h - 1, Math.max(0, Math.floor(((e.clientY - r.top) * h) / r.height)));
  const at = estateDoorAt(H, w, h, x, y);
  if (at.ok && at.door && DOOR[at.door]) location.hash = '#' + DOOR[at.door];
}
// ── the guild (Phase 8): the estates of keys that each consented, drawn together (src/guild.mjs). Reputation only ──────
const guildState = () => (G.st.guild ||= { name: '', statements: [], n: 0 });
const codeOf = (x) => btoa(unescape(encodeURIComponent(JSON.stringify(x))));
const fromCode = (c) => { try { return JSON.parse(decodeURIComponent(escape(atob(String(c).replace(/\s+/g, ''))))); } catch { return null; } };
/** my estate as a guild takes it: my plot exactly as the painter draws it here, without the doors of my own game */
async function myEstate() {
  const held = await holdings(), h = holdingsOf(held, false, await worldOf(held));
  delete h.landmarks;
  return h;
}
function guildCode(say, s) {
  const box = el('textarea', { class: 'g-code', rows: '3', readonly: '', 'aria-label': say }, codeOf(s));
  fill($('#g-gd-mine'), el('p', { class: 'g-small' }, say), box, el('div', { class: 'g-row' }, el('button', { type: 'button', class: 'g-btn', onclick: async () => { try { await navigator.clipboard.writeText(box.value); bleep('kept'); } catch { box.select(); } } }, 'Copy')));
}
async function renderGuild() {
  const st = guildState(), name = $('#g-gd-name');
  if (st.name && !name.value) name.value = st.name;
  if (!st.name) { setK('g-gd-n', ''); fill($('#g-gd-members'), line('', 'No guild yet', el('small', {}, 'name one and join with your estate, then send your code to each friend'))); return fill($('#g-gd-map')); }
  const g = await guildOf(st.statements, st.name);
  if (!g.ok) { fill($('#g-gd-out'), el('p', { class: 'g-badt' }, g.why)); return; }
  setK('g-gd-n', st.name + ' · ' + g.members.length + ' member' + (g.members.length === 1 ? '' : 's'));
  // a drop card is checked against the drop: its business and department as the drop recorded them
  const drop = new Map((S.manifest ? S.manifest.cards : []).map((c) => [c.card, c.domain]));
  fill($('#g-gd-members'), g.members.length ? g.members.map((m) => {
    const fromDrop = m.holdings.cards.filter((c) => drop.has(c.id)), match = fromDrop.filter((c) => drop.get(c.id) === c.dataset + '-' + c.department).length;
    return line((m.by === S.me.pub ? 'k ' : '') + 'g-two', (m.by === S.me.pub ? 'You · ' : '') + 'key ' + m.by.slice(0, 8) + '…', el('small', {}, m.cards + ' card' + (m.cards === 1 ? '' : 's') + ' and ' + m.levels + ' level' + (m.levels === 1 ? '' : 's') + ', as signed' + (fromDrop.length ? ' · ' + match + ' of ' + fromDrop.length + ' drop cards match the drop' : '')));
  }) : line('', 'Nobody stands in ' + st.name + ' yet', el('small', {}, 'join with your estate, or add a member’s code')));
  fill($('#g-gd-out'), g.refused.length ? el('p', { class: 'g-small g-dim' }, g.refused.length + ' statement' + (g.refused.length === 1 ? '' : 's') + ' refused: ' + [...new Set(g.refused.map((r) => r.why))].join('; ')) : null);
  fill($('#g-gd-map'), g.members.map((m) => {
    const cv = el('canvas', { width: '360', height: '240', role: 'img', 'aria-label': 'The estate of key ' + m.by.slice(0, 8) + ', as it signed it' }), art = paintEstate(m.holdings, plotTheme(), 360, 240);
    if (art.ok) putRGB(cv, art.px, 360, 240);
    return el('figure', { class: 'g-gd-tile' }, cv, el('figcaption', { class: 'g-small' }, (m.by === S.me.pub ? 'You' : 'key ' + m.by.slice(0, 8) + '…') + ' · ' + m.cards + ' card' + (m.cards === 1 ? '' : 's')));
  }));
}
async function guildSign(act) {
  const st = guildState(), name = $('#g-gd-name').value.trim().toLowerCase();
  if (act === 'join' && name !== st.name) { st.name = name; st.statements = []; }   // a new guild starts its own list
  if (!st.name) return fill($('#g-gd-out'), el('p', { class: 'g-badt' }, 'Name the guild first.'));
  const n = (st.n || 0) + 1, r = act === 'join' ? await join(S.me, st.name, await myEstate(), n) : await leave(S.me, st.name, n);
  if (!r.ok) return fill($('#g-gd-out'), el('p', { class: 'g-badt' }, r.why));
  st.n = n; st.statements = [...st.statements, r.statement].slice(-MAX_STATEMENTS); saveState();
  guildCode(act === 'join' ? 'Your join, signed with your key. Send this code to each member, and add theirs below:' : 'Your leave, signed. Send it to the members so their guild drops you too:', r.statement);
  await renderGuild();
}
async function guildAdd() {
  const st = guildState(), got = fromCode($('#g-gd-paste').value), list = Array.isArray(got) ? got : got ? [got] : [];
  if (!list.length) return fill($('#g-gd-out'), el('p', { class: 'g-badt' }, 'That is not a guild code.'));
  if (!st.name && list[0] && typeof list[0].guild === 'string') { st.name = list[0].guild; $('#g-gd-name').value = st.name; }
  const known = new Set(st.statements.map((s) => JSON.stringify(s))), fresh = list.filter((s) => !known.has(JSON.stringify(s)));
  st.statements = [...st.statements, ...fresh].slice(-MAX_STATEMENTS); saveState();
  $('#g-gd-paste').value = '';
  await renderGuild();
}
async function guildAll() {
  const st = guildState();
  if (!st.statements.length) return fill($('#g-gd-out'), el('p', { class: 'g-badt' }, 'There is nothing in this guild to copy yet.'));
  guildCode('Every statement this guild holds, signed by each member: give it to a new member so they see the whole guild.', st.statements);
}
const plotTheme = () => (document.documentElement.dataset.ui === 'blockcraft' ? 'blockcraft-v1' : 'synthwave-v1');
async function drawPlot(held) {
  const c = $('#g-plot'), open = tilesFor(held.length), world = await worldOf(held);
  setK('g-plot-open', 'Scorer ' + open + ' tiles · tools ' + tilesFor(world.items.length) + ' · kitted ' + tilesFor(world.swarms.length));
  fill($('#g-plot-rule'), 'The published rule: a district holding n blocks opens 8 + 2n tiles, up to 36 · SCORER holds your cards, TOOLS your app tools, KITTED each Kardling kitted with its nodes · drawn from your holdings only, by PixelWhisperer’s estate painter');
  if (!c) return;
  const H = holdingsOf(held, false, world), art = paintEstate(H, plotTheme(), c.width, c.height);
  if (!art.ok) return fill($('#g-plot-rule'), 'The estate could not be drawn: ' + art.why);
  putRGB(c, art.px, c.width, c.height);
  // the same doors, from the same layout the picture was drawn from, as real links for a keyboard or a screen reader
  const doors = estateDoors(H, c.width, c.height);
  G.doors = doors.ok ? { H, w: c.width, h: c.height } : null;
  fill($('#g-plot-doors'), doors.ok ? doors.doors.filter((d) => DOOR[d.id]).map((d) => el('a', { class: 'g-door', href: '#' + DOOR[d.id] }, d.name)) : null);
  G.plot = { held: held.length, open };
}
function pngOfCanvas(c) {
  const w = c.width, h = c.height, rgba = c.getContext('2d').getImageData(0, 0, w, h).data, raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = (y * w + i) * 4, t = y * (1 + w * 3) + 1 + i * 3; raw[t] = rgba[s]; raw[t + 1] = rgba[s + 1]; raw[t + 2] = rgba[s + 2]; }
  const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const chunk = (type, data) => { const body = cat([new Uint8Array([...type].map((ch) => ch.charCodeAt(0))), data]); return cat([new Uint8Array(u32(data.length)), body, new Uint8Array(u32(crc32(body)))]); };
  return cat([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', new Uint8Array([...u32(w), ...u32(h), 8, 2, 0, 0, 0])), chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0))]);
}
async function shareSnapshot() {
  const held = await holdings(), levels = held.reduce((n, h) => n + h.v.receipts.filter((r) => r.kind === 'level').length, 0);
  const text = 'My Kardlings estate · ' + held.length + ' block' + (held.length === 1 ? '' : 's') + ' · ' + levels + ' level' + (levels === 1 ? '' : 's') + ' re-run · every card re-runs on your device: ' + location.origin + location.pathname;
  // the snapshot is painted afresh, with its title and stats bands, from the holdings alone
  const snap = el('canvas', { width: 1200, height: 630 }), art = paintEstate(holdingsOf(held, true, await worldOf(held)), plotTheme(), 1200, 630);   // the size a shared link previews at
  if (!art.ok) return fill($('#g-snap-out'), el('p', { class: 'g-badt g-small' }, 'The snapshot could not be drawn: ' + art.why));
  putRGB(snap, art.px, 1200, 630);
  const png = pngOfCanvas(snap), file = new File([png], 'digi-estate.png', { type: 'image/png' });
  const out = $('#g-snap-out');
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); fill(out, el('p', { class: 'g-okt g-small' }, 'Shared.')); return; }
  } catch { /* the player closed the share sheet */ }
  api.download(png, 'digi-estate.png');
  fill(out, el('p', { class: 'g-small' }, 'Saved digi-estate.png. Post it with: ' + text));
}

// ── cards: the collection, and the card inspected ────────────────────────────────────────────────────────────────────
let admission = null, openSet = 'telco';
async function renderCards() {
  admission ||= await fetch('drop/admission.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const held = await holdings(), bySet = {}, admitted = {};
  for (const h of held) (bySet[h.f.dataset] ||= []).push(h);
  for (const dpt of (admission && admission.departments) || []) (admitted[dpt.set] ||= []).push(dpt);
  const sets = [...Object.keys(SET_NAMES), 'custom'];
  fill($('#g-dsets'), sets.map((s) => {
    const depts = (admitted[s] || []).filter((x) => x.admitted), have = new Set((bySet[s] || []).map((h) => h.f.department)).size;
    const label = s === 'custom' ? 'Your own' : SET_NAMES[s], count = s === 'custom' ? String((bySet.custom || []).length) : depts.length ? have + ' of ' + depts.length : 'none';
    return el('button', { type: 'button', role: 'tab', 'aria-selected': String(openSet === s), class: count === 'none' ? 'none' : '', onclick: () => { openSet = s; renderCards(); } }, DATASET_ICONS[s] ? iconCanvas(DATASET_ICONS[s], 2, SET_COLOUR[s]) : null, label, el('b', {}, count));
  }));
  fill($('#g-set-h'), (openSet === 'custom' ? 'Your own' : SET_NAMES[openSet]) + (openSet === 'custom' ? ' · cards minted from your tables' : ' · ' + ((admitted[openSet] || []).filter((x) => x.admitted).length) + ' departments in the drop'),
    openSet !== 'custom' && SETS[openSet] ? el('small', {}, SETS[openSet].title + ' · its cards predict who ' + SETS[openSet].outcome) : null);
  const grid = $('#g-slotgrid'), slots = [];
  if (openSet === 'custom') {
    for (const h of bySet.custom || []) slots.push(heldSlot(h));
    if (!slots.length) slots.push(el('div', { class: 'g-slot' }, el('div', { class: 'g-sil' }, 'Mint your first'), el('a', { class: 'g-btn', href: '#mint' }, 'Mint a Kardling from your table')));
  } else {
    for (const dpt of admitted[openSet] || []) {
      const dep = dpt.domain.slice(openSet.length + 1), mineHere = (bySet[openSet] || []).filter((h) => h.f.department === dep);
      if (mineHere.length) slots.push(heldSlot(mineHere[0], mineHere.slice(1)));
      else if (dpt.admitted) { const n = S.manifest.cards.filter((c) => c.domain === dpt.domain).length; slots.push(el('div', { class: 'g-slot' }, el('div', { class: 'g-sil' }, el('span', {}, dep), el('span', { class: 'g-small' }, n + ' in the drop')), el('span', { class: 'g-goldt g-small' }, 'Get one'), el('span', { class: 'g-dim g-small' }, 'card me · breed · mint'))); }
      else slots.push(el('div', { class: 'g-slot' }, el('div', { class: 'g-sil' }, el('span', {}, dep), el('span', { class: 'g-badt g-small' }, 'No card'), el('span', { class: 'g-badt g-small' }, 'under the 0.6 bar')), el('span', { class: 'g-small' }, 'best GATE ' + four(Math.max(...dpt.gates)))));
    }
  }
  fill(grid, slots);
  fill($('#g-gaps'), ((admission && admission.departments) || []).filter((x) => !x.admitted).map((x) => line('r', x.domain.replace('-', ' '), el('small', {}, four(Math.max(...x.gates))))));
  if (S.sel && S.reg.cards[S.sel]) renderInspect();
}
function heldSlot(h, more = []) {
  const c = el('canvas', { class: 'g-card2', width: W, height: H, 'aria-hidden': 'true' }), ring = el('div', { class: 'g-ring' }, c);
  show(c, ring, api.lifeOf(h.id));
  return el('div', { class: 'g-slot' }, el('button', { type: 'button', class: 'g-held', 'aria-label': 'Inspect ' + h.f.title + ' ' + serialLine(h.v), onclick: () => inspect(h.id) }, ring),
    el('span', { class: 'g-small' }, h.f.department + ' ' + '#' + pad4(h.v.serial)), el('span', { class: 'g-tag' }, h.f.rarity + ' lv' + h.f.stage),
    more.length ? el('div', { class: 'g-more' }, more.map((m) => el('button', { type: 'button', onclick: () => inspect(m.id) }, '#' + pad4(m.v.serial)))) : null);
}
async function inspect(id) {
  await api.select(id);
  $('#detail').scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
}
let tab = 'reruns';
async function renderInspect() {
  const id = S.sel, d = api.lifeOf(id);
  if (!d) return;
  const v = await verify(d);
  if (!v.ok) return;
  const f = facts(v), grown = G.grown.get(id), dec = declaredOf(id), test = G.tests.get(id), mine = v.owner === S.me.pub;
  $('#g-detail-ring').className = 'g-ring r-' + f.rarity;
  fill($('#g-in-title'), f.title + ' ' + serialLine(v));
  fill($('#g-in-tags'), el('span', { class: 'g-tag ok' }, 'scorer'), el('span', { class: 'g-tag' }, f.rarity + ' lv' + f.stage), el('span', { class: 'g-tag' }, 'gen ' + f.generation), el('span', { class: 'g-tag cy' }, (SET_NAMES[f.dataset] || 'your own') + ' · ' + f.department), el('span', { class: 'g-tag' + (mine ? ' ok' : '') }, whose(v)));
  const gives = d.events.filter((e) => e.type === 'give').length;
  const tile = (l, val, btn, info) => { const [i, p] = info ? infoFor(info) : []; return el('div', { class: 'g-tile' }, el('span', { class: 'l' }, l, i || null), el('span', { class: 'v' }, val), p || null, btn || null); };
  const b = (label, fn) => el('button', { type: 'button', onclick: fn }, label);
  fill($('#g-tiles'),
    tile('GATE AUC', grown ? six(grown.gate) : dec && !v.receipts.length ? six(dec.gate) + ' · declared' : 'boot to measure', b('Rerun', () => bootCard(id)), 'gate'),
    tile('TEST AUC', test ? six(test.auc) : 'not run here', b('Rerun', () => runTest(id)), 'test'),
    tile('Abstain', test ? (test.abstain / test.n * 100).toFixed(1) + '%' : 'not run here', b('Rerun', () => runTest(id)), 'abstain'),
    tile('Rules ≤6', grown ? String(grown.mind.organs.filter((o) => o.body).reduce((n, o) => n + o.body.rules.length, 0)) : 'boot to read', null, 'rules'),
    tile('LV', String(f.stage), null, 'lv'), tile('Gen', String(f.generation), null, 'gen'),
    tile('Owners', String(gives + 1), b('Replay', async () => { tab = 'life'; renderTabs(); await api.actVerify(); }), 'owners'));
  const sr = G.st.searches[id], best = sr ? Math.max(0, sr.best) : 0;
  $('#g-train-bar').style.width = Math.min(100, Math.round((best / 2000) * 100)) + '%';
  fill($('#g-train-say'), sr ? 'Best gain found +' + (best / 1e6).toFixed(4) + ' of +0.0020 needed · ' + sr.tried + ' search' + (sr.tried === 1 ? '' : 'es') : 'No search run here yet · press Train');
  fill($('#g-pane-rules'), grown ? [el('ol', { class: 'g-lines g-rules' }, grown.mind.organs.filter((o) => o.body).flatMap((o) => o.body.rules.map((rule) => line(rule.w > 0 ? 'k' : 'r', rule.feat + ' ' + (rule.op === '<=' ? '≤' : '>') + ' ' + rule.v, el('b', { class: rule.w > 0 ? 'up' : 'down' }, (rule.w > 0 ? '+' : '') + rule.w))))),
    el('p', { class: 'g-small g-dim' }, 'Score above ' + grown.mind.threshold + ' → yes')] : el('p', { class: 'g-dim' }, 'Boot it to print its rules: they are read off its data as it grows.'));
  fill($('#g-pane-life'), el('div', { class: 'g-tw' }, lifeTable(d)));
  for (const n of ['#g-a-train', '#g-a-breed', '#g-a-skin']) $(n).disabled = !mine;
  renderTabs();
}
function lifeTable(d) {
  return el('table', { class: 'g-table' }, el('thead', {}, el('tr', {}, ['n', 'type', 'signer', 'what', 'hash'].map((h) => el('th', {}, h)))),
    el('tbody', {}, d.events.map((e, k) => { const h = hashOf(e), row = el('tr', {}, el('td', {}, String(k)), el('td', {}, e.type), el('td', {}, e.by.slice(0, 8)),
      el('td', {}, e.type === 'issue' ? 'to ' + (e.to === S.me.pub ? 'you' : e.to.slice(0, 8)) + ' · ' + e.theme : e.type === 'give' ? 'to ' + (e.to === S.me.pub ? 'you' : e.to.slice(0, 8)) : e.type === 'skin' ? e.theme : e.receipt.kind === 'level' ? 'level ' + four(e.receipt.before) + ' → ' + four(e.receipt.after) : e.receipt.kind),
      el('td', {}, h.slice(0, 8) + (k && e.prev !== hashOf(d.events[k - 1]) ? ' ✗' : ' ✓'))); return row; })));
}
function renderTabs() {
  for (const t of ['rules', 'reruns', 'life']) { $('#g-tab-' + t).setAttribute('aria-selected', String(tab === t)); $('#g-pane-' + t).hidden = tab !== t; }
}
async function runTest(id) {
  const d = api.lifeOf(id), v = await verify(d), g = await api.groundFor(v), grown = G.grown.get(id) || (await (async () => { await api.select(id); return api.actGrow(); })());
  if (!grown || grown.gate == null) return;
  G.grown.set(id, grown);
  const rows = g.ds.testRows;   // scored exactly as the sealed organs score TEST (tools/lib.mjs testAuc)
  let abstain = 0, right = 0;
  for (const i of rows) { const a = answer(grown.mind, caseAt(g, i)); if (a.verdict !== 'VERIFIED') abstain++; else if (a.label === g.ds.y[i]) right++; }
  G.tests.set(id, { auc: Math.round(auc(rows.map((i) => scoreRow(grown.mind, g, i)), rows.map((i) => g.ds.y[i])) * 1e6), n: rows.length, abstain, right });
  renderInspect();
  if (G.screen === 'evals') renderEvals();
}

// ── the fusion lab: two of your cards of one business, fused only into a card that beats both on GATE and re-runs ─────
// The work is app.js fuse() (src/breed.mjs, organ 4), the same code the classic view's Fuse runs; this screen picks the
// pair, shows the parents, the kept card or the refusal with its numbers, the lineage the device can read, and organ 4's
// sealed verdicts from its committed record.
const FUS = { a: null, b: null, busy: false, last: null };
let organ4 = null;
async function renderFusion() {
  const mine = await myCards(null), pa = $('#g-fu-a'), pb = $('#g-fu-b');
  const opt = (m) => el('option', { value: m.id }, m.f.title + ' #' + pad4(m.v.serial));
  fill(pa, mine.length ? mine.map(opt) : el('option', { value: '' }, 'card me first'));
  if (mine.some((m) => m.id === (FUS.a || S.sel))) pa.value = FUS.a || S.sel;
  FUS.a = pa.value || null;
  const a = mine.find((m) => m.id === FUS.a), partners = a ? mine.filter((m) => m.id !== a.id && m.f.dataset === a.f.dataset) : [];
  fill(pb, partners.length ? partners.map(opt) : el('option', { value: '' }, a ? 'no other card of yours on this business' : 'card me first'));
  if (partners.some((m) => m.id === FUS.b)) pb.value = FUS.b;
  FUS.b = pb.value || null;
  const b = partners.find((m) => m.id === FUS.b);
  for (const [side, m] of [['a', a], ['b', b]]) {
    const face = $('#g-fu-' + side + '-face');
    if (m) await show(face, $('#g-fu-' + side + '-ring'), api.lifeOf(m.id));
    else { face.getContext('2d').clearRect(0, 0, face.width, face.height); $('#g-fu-' + side + '-ring').className = 'g-ring'; }
    fill($('#g-fu-' + side + '-line'), m ? m.f.title + ' #' + pad4(m.v.serial) + ' · ' + m.f.department + ' · ' + m.f.rarity + ' · ' + (m.f.generation ? 'generation ' + m.f.generation : 'genesis')
      : side === 'a' ? 'Card me first: then you have a card to fuse.' : a ? 'You hold no other card of this business: press Card me, or mint a node in the Kit.' : '');
  }
  $('#g-fu-go').disabled = !(a && b) || FUS.busy;
  await renderLineage(FUS.last && FUS.last.kept ? FUS.last.child.id : FUS.a);
  await renderFusionProof();
}
async function fusionGo() {
  if (!FUS.a || !FUS.b || FUS.busy) return;
  FUS.busy = true; $('#g-fu-go').disabled = true; $('#g-fu-go').classList.add('g-next');
  const out = $('#g-fu-out'), tries = (n) => n + (n === 1 ? ' try' : ' tries');
  try {
    const x = await api.fuse(FUS.a, FUS.b, (s) => fill(out, el('p', { class: 'g-small' }, s)));
    FUS.last = x;
    if (x.ok) drawFusion(x);
    if (!x.ok) { bleep('refused'); fill(out, el('p', { class: 'g-badt' }, x.why)); }
    else if (!x.kept) {
      bleep('refused');
      fill(out, el('p', { class: 'g-win bad' }, 'Refused: no fused card beat both'), el('p', { class: 'g-small' }, x.why + '.'),
        el('p', { class: 'g-small g-dim' }, 'Most fusions do not beat both parents, and those are never kept: that is the gate working. ' + tries(x.r.tries) + ' ran here, and nothing was sealed.'),
        el('a', { class: 'g-btn hot big g-next', id: 'g-fu-next', href: '#fusion', onclick: (e) => { e.preventDefault(); $('#g-fu-go').classList.add('g-next'); e.currentTarget.classList.remove('g-next'); $('#g-fu-b').focus(); } }, 'Next · pick another pair →'), el('p', { class: 'g-teach' }, 'Most merges do not beat both parents: refusing them is the selection.'));
      soleNext(out.querySelector('.g-next'));
    } else {
      bleep('kept');
      const c = el('canvas', { class: 'g-card2', width: 384, height: 576, role: 'img', 'aria-label': 'The fused card' }), ring = el('div', { class: 'g-ring' }, c);
      fill(out, el('p', { class: 'g-win ok' }, 'Kept · a fused card'), el('div', { class: 'g-cardcol' }, ring),
        el('p', {}, 'GATE ' + six(x.r.gate) + ', beating both parents (' + six(x.r.parents[0]) + ' and ' + six(x.r.parents[1]) + ') after ' + tries(x.r.tries)),
        el('p', { class: x.check.ok ? 'g-okt' : 'g-badt' }, x.check.ok ? '✓ Re-run here: it holds, naming both parents' : '✗ ' + x.check.why),
        el('a', { class: 'g-btn hot big g-next', id: 'g-fu-next', href: '#kit', onclick: () => { KIT.card = null; S.sel = x.child.id; } }, 'Next · kit the fused card →'), el('p', { class: 'g-teach' }, 'Kit: choosing an agent’s tools and parts, each measured for what it adds.'));
      soleNext(out.querySelector('.g-next'));
      await show(c, ring, api.lifeOf(x.child.id));
    }
  } catch (e) { fill(out, el('p', { class: 'g-badt' }, String(e.message || e))); }
  finally { FUS.busy = false; await renderFusion(); }
}
/** the fusion drawn from its own record: both parents with their GATE, how many tries, and the fused card when one was kept */
async function drawFusion(x) {
  const cv = $('#g-fu-art'), [va, vb] = await Promise.all([FUS.a, FUS.b].map((id) => verify(api.lifeOf(id)))), side = (v, gate) => ({ id: v.id, rarity: facts(v).rarity, gate, title: artText(facts(v).title, 16) });
  const fusion = { a: side(va, x.parents[0]), b: side(vb, x.parents[1]), tried: x.r.tries, ...(x.kept ? { fused: side(x.child, x.r.gate) } : {}) };
  cv.hidden = !paintOn(cv, paintFusion(fusion, plotTheme(), cv.width, cv.height));
  cv.setAttribute('aria-label', 'The fusion, drawn: ' + facts(va).title + ' and ' + facts(vb).title + ', ' + x.r.tries + ' tr' + (x.r.tries === 1 ? 'y' : 'ies') + (x.kept ? ', a fused card kept' : ', refused: no fused card beat both'));
}
/** a card's family tree for the painter: four generations at most; a card this device does not hold is its id alone */
async function treeOf(id, depth = 0) {
  const d = api.lifeOf(id), v = d ? await verify(d) : null;
  if (!v || !v.ok) return { id };
  const f = facts(v), node = { id, rarity: f.rarity };
  if (f.parents.length === 2 && depth < 3) node.parents = [await treeOf(f.parents[0], depth + 1), await treeOf(f.parents[1], depth + 1)];
  return node;
}
/** a card's lineage, walked back through the seals this device holds; a parent it does not hold is named, never drawn */
async function renderLineage(id) {
  const rows = [], seen = new Set();
  const walk = async (cid, depth) => {
    if (!cid || seen.has(cid) || depth > 4 || rows.length >= 15) return;
    seen.add(cid);
    const pad = depth ? '└ '.padStart(depth * 2 + 2, ' ') : '', d = api.lifeOf(cid);
    if (!d) { rows.push(line('x', pad + 'a parent this device does not hold', el('small', {}, String(cid).slice(0, 8)))); return; }
    const v = await verify(d);
    if (!v.ok) { rows.push(line('r', pad + 'a card that does not check here', el('small', {}, String(cid).slice(0, 8)))); return; }
    const f = facts(v);
    rows.push(line(f.generation ? 'k' : '', pad + f.title + ' #' + pad4(v.serial), el('small', {}, f.generation ? 'generation ' + f.generation + ' · fused from two' : 'genesis')));
    for (const p of f.parents) await walk(p, depth + 1);
  };
  await walk(id, 0);
  fill($('#g-fu-lineage'), rows.length ? rows : line('x', 'Card me first: a lineage starts at a card you hold'));
  const tree = $('#g-fu-tree');
  tree.hidden = !id || !paintOn(tree, paintLineage(await treeOf(id), plotTheme(), tree.width, tree.height));
}
/** organ 4's sealed rules, each with its verdict read from the committed record */
async function renderFusionProof() {
  organ4 ||= await fetch('data/organ-4/verdict.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const v = organ4 && Array.isArray(organ4.verdicts) ? organ4.verdicts : [];
  fill($('#g-fu-proof'), v.length ? v.map((x) => line((x.pass ? 'k' : 'y') + ' g-two', '4 · ' + x.id + ' · ' + (x.pass ? 'held' : x.kind === 'prediction' ? 'failed — kept' : 'FAILED'), el('small', { 'data-quote': 'sealed' }, String(x.saw)))) : line('x', 'Organ 4’s record could not be read here'));
}

// ── eval runs ────────────────────────────────────────────────────────────────────────────────────────────────────────
const MISSIONS = [{ key: 'drop', name: 'Re-check all 1,000 genesis cards on this device', href: '#proof' }, { key: 'own', name: 'Make a card from your own spreadsheet', href: '#mint' }, { key: 'breed', name: 'Fuse two cards into one that beats both its parents', href: '#fusion' }];
const TITLES_EARNED = { evals3: 'Band reader', drop: 'Decoder', own: 'Maker', breed: 'Fuser' };
function renderEvals() {
  const n = G.st.evals.day === today() ? G.st.evals.n : 0, id = featured(), v = id && S.reg.cards[id];
  fill($('#g-today'), el('div', { class: 'g-line m' }, 'Ask your card about 3 real cases', el('small', {}, Math.min(n, 3) + ' of 3')), el('div', { class: 'g-bar' }, el('i', { style: 'width:' + Math.round((Math.min(n, 3) / 3) * 100) + '%;background:#7dff8a' })),
    el('p', { class: 'g-small g-dim' }, v ? 'On #' + pad4(v.serial) + ' · change the card in Cards' : 'Card me first'));
  fill($('#g-missions'), [...MISSIONS, { key: 'evals3', name: 'Ask your card about 3 real cases in a day', href: '#evals' }].map((m) => line(G.st.done[m.key] ? 'k' : 'y', el('a', { href: m.href }, (G.st.done[m.key] ? '✓ ' : '') + m.name), G.st.done[m.key] ? el('small', {}, 'title · ' + TITLES_EARNED[m.key]) : null)));
  $('#g-eval-run').disabled = !id;
}
async function runEval() {
  const id = featured();
  if (!id) return;
  const out = $('#g-eval-out');
  fill(out, el('p', { class: 'g-dim' }, 'Reading a real TEST case…'));
  await api.select(id);
  const r = await api.actAsk(false);
  if (!r) return fill(out, el('p', { class: 'g-badt' }, 'It could not be asked here: see the card’s panel in Cards.'));
  const d = api.lifeOf(id), v = await verify(d), f = facts(v), { a, truth, row, mind } = r, set = api.setOf(v), outcome = SETS[set] ? SETS[set].outcome : 'yes';
  G.grown.set(id, G.grown.get(id) || { gate: mind.gate, mind, declared: null });
  const rules = mind.organs.filter((o) => o.body).flatMap((o) => o.body.rules), firedKey = (x) => x.feat + x.op + x.v;
  const fired = new Set(a.verdict === 'VERIFIED' ? a.fired.map(firedKey) : []);
  const g = await api.groundFor(v), x = caseAt(g, row);
  fill(out, el('h3', {}, 'TEST case ' + row + ' · ' + (SET_NAMES[f.dataset] || 'your own'), el('span', { class: 'g-tag cy' }, 'a real test row')),
    el('div', { class: 'g-tw' }, el('table', { class: 'g-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'what it reads'), el('th', {}, 'this case'), el('th', {}, 'rule'), el('th', {}, 'fired'))),
      el('tbody', {}, rules.map((rule) => el('tr', {}, el('td', {}, rule.feat), el('td', {}, String(x[rule.feat])), el('td', {}, (rule.op === '<=' ? '≤ ' : '> ') + rule.v + ' → ' + (rule.w > 0 ? '+' : '') + rule.w), el('td', { class: fired.has(firedKey(rule)) ? 'g-okt' : 'g-dim' }, fired.has(firedKey(rule)) ? 'yes' : '–')))))),
    a.verdict === 'VERIFIED' ? [el('p', { class: 'g-row' }, el('span', {}, 'Score ' + a.score + (a.label ? ' > ' : ' ≤ ') + a.threshold), el('b', { class: 'g-hot', style: 'font-size:27px;font-weight:400' }, '→ ' + (a.label ? 'yes: it ' + outcome : 'no'))),
      el('p', { class: 'g-row' }, 'What really happened · ' + (truth ? 'yes' : 'no'), el('span', { class: 'g-tag ' + (truth === a.label ? 'ok' : 'bad') }, truth === a.label ? 'right' : 'wrong on this one'))]
      : [el('p', { style: 'font-size:27px', class: 'g-goldt' }, 'Abstained · ' + a.why), el('p', { class: 'g-dim' }, 'No guess: a case for a person.')],
    el('p', { class: 'g-small g-dim' }, 'Its whole TEST record re-runs in Cards → Reruns to → TEST AUC.'));
  bleep(a.verdict !== 'VERIFIED' ? 'abstain' : truth === a.label ? 'right' : 'wrong');
  if (G.st.evals.day !== today()) G.st.evals = { day: today(), n: 0 };
  G.st.evals.n++;
  if (G.st.evals.n >= 3) G.st.done.evals3 = true;
  saveState(); renderEvals(); renderTop();
}

// ── play: the arena ─────────────────────────────────────────────────────────────────────────────────────────────
const A = { last: null, tab: 'drop', pending: null };
const dropOwner = () => S.maker;   // the drop's public demo key: it accepts here as it hands out cards here
async function renderArena() {
  const mine = [];
  for (const id of api.mine()) { const v = await verify(api.lifeOf(id)); if (v.ok && api.setOf(v)) mine.push({ id, v, f: facts(v) }); }
  const pick = $('#g-ar-mine'), keep = pick.value || S.sel;
  fill(pick, mine.length ? mine.map((m) => el('option', { value: m.id }, m.f.title + ' #' + pad4(m.v.serial))) : el('option', { value: '' }, 'card me first'));
  if (mine.some((m) => m.id === keep)) pick.value = keep;
  await arenaSides();
  renderLadder();
}
async function arenaSides() {
  const id = $('#g-ar-mine').value;
  if (!id) return;
  const v = await show($('#g-ar-a'), $('#g-ar-a-ring'), api.lifeOf(id)), set = api.setOf(v), rate = (ratings(G.st.duels || []).ratings || {})[id];
  fill($('#g-ar-a-line'), facts(v).title + ' #' + pad4(v.serial) + ' · rating ' + (rate ?? 1000) + ' · ' + kitLine(await sideFor(v)) + ' · ', el('a', { href: '#kit' }, 'kit'));
  // the drop's cards of the same business still held by its maker, best first, and a few at random
  const pool = S.manifest.cards.filter((c) => c.domain.split('-')[0] === set && S.reg.cards[c.card] && S.reg.cards[c.card].owner === S.maker.pub && c.card !== id);
  const top = [...pool].sort((a, b) => b.gate - a.gate).slice(0, 6), rest = pool.filter((c) => !top.includes(c)).filter((c, k) => k % 11 === 0).slice(0, 6);
  const foe = $('#g-ar-foe'), keepFoe = foe.value;
  fill(foe, [...top, ...rest].map((c) => el('option', { value: c.card }, '#' + pad4(c.serial) + ' · ' + c.domain.replace(set + '-', '') + ' · GATE ' + four(c.gate))));
  if (keepFoe && [...foe.options].some((o) => o.value === keepFoe)) foe.value = keepFoe;
  const own = $('#g-ar-own');
  const ownSame = [];
  for (const x of api.mine()) if (x !== id) { const w = await verify(api.lifeOf(x)); if (w.ok && api.setOf(w) === set) ownSame.push({ x, w }); }
  fill(own, ownSame.length ? ownSame.map(({ x, w }) => el('option', { value: x }, facts(w).title + ' #' + pad4(w.serial))) : el('option', { value: '' }, 'no other card of yours on this business'));
  await showFoe();
}
async function showFoe() {
  const id = A.tab === 'drop' ? $('#g-ar-foe').value : A.tab === 'mine' ? $('#g-ar-own').value : A.pending && A.pending.foe;
  if (!id || !api.lifeOf(id)) { fill($('#g-ar-b-line'), A.tab === 'friend' ? 'Their card appears once you paste their challenge or answer' : 'No opponent here yet'); return; }
  const v = await show($('#g-ar-b'), $('#g-ar-b-ring'), api.lifeOf(id));
  fill($('#g-ar-b-line'), facts(v).title + ' #' + pad4(v.serial) + ' · ' + whose(v));
}
function arenaTab(t) {
  A.tab = t;
  for (const k of ['drop', 'mine', 'friend']) { $('#g-ar-t-' + k).setAttribute('aria-selected', String(k === t)); $('#g-ar-p-' + k).hidden = k !== t; }
  $('#g-ar-fight').hidden = t === 'friend';
  showFoe();
}
async function fightWith(vA, vB, keysA, keysB, nonce) {
  // each side fights as its owner kitted it here; the drop's maker fields its cards alone
  const g = await api.groundFor(vA), sA = keysA === S.me ? await sideFor(vA) : alone(vA), sB = keysB === S.me ? await sideFor(vB) : alone(vB);
  const ch = await kitChallenge(keysA, vA, sA.loadout, nonce);
  if (!ch.ok) return { ok: false, why: ch.why };
  const ac = await kitAccept(keysB, vB, sB.loadout, ch.challenge);
  if (!ac.ok) return { ok: false, why: ac.why };
  const signed = { challenge: ch.challenge, accept: ac.accept };
  return { ...(await kitDuel(sA, sB, g, signed)), signed, g, sides: { a: sA, b: sB } };
}
async function arenaFight() {
  $('#g-ar-fight').classList.add('g-next');
  const aId = $('#g-ar-mine').value, bId = A.tab === 'drop' ? $('#g-ar-foe').value : $('#g-ar-own').value;
  if (!aId || !bId) return fill($('#g-ar-result'), el('p', { class: 'g-badt' }, A.tab === 'mine' ? 'You hold no other card of this business: card me, fuse or mint one.' : 'Pick a fighter and an opponent.'));
  const btn = $('#g-ar-fight'); btn.disabled = true; btn.textContent = 'Fighting…';
  try {
    const vA = await verify(api.lifeOf(aId)), vB = await verify(api.lifeOf(bId));
    const nonce = 'd' + ((G.st.duels || []).length + 1) + '-' + Date.now().toString(36);
    const r = await fightWith(vA, vB, S.me, A.tab === 'drop' ? dropOwner() : S.me, nonce);
    showDuel(r, vA, vB);
  } catch (e) { fill($('#g-ar-result'), el('p', { class: 'g-badt' }, String(e.message || e))); }
  finally { btn.disabled = false; btn.textContent = 'Fight'; }
}
function showDuel(r, vA, vB) {
  if (!r.ok) { fill($('#g-ar-result'), el('p', { class: 'g-badt' }, 'Refused · ' + r.why)); bleep('refused'); return; }
  const x = r.receipt, pos = r.y.filter((t) => t === 1).length, cut = (sc) => [...sc].sort((p, q) => q - p)[Math.max(0, pos - 1)], lineA = cut(r.scores.a), lineB = cut(r.scores.b);
  // each case: which side called it right, each calling yes for its top cases, as many as the batch holds (the AUC, not
  // this, decides the duel)
  fill($('#g-ar-batch'), r.batch.map((row, k) => { const okA = (r.scores.a[k] >= lineA) === (r.y[k] === 1), okB = (r.scores.b[k] >= lineB) === (r.y[k] === 1); return el('i', { class: okA && okB ? 'both' : okA ? 'a' : okB ? 'b' : 'none', title: 'case ' + row + ': ' + (okA ? 'yours right' : 'yours wrong') + ' · ' + (okB ? 'theirs right' : 'theirs wrong') }); }));
  const you = x.winner === 'a' ? 'ok' : x.winner === 'b' ? 'bad' : 'draw', before = ratings(G.st.duels || []).ratings || {};
  G.st.duels = [...(G.st.duels || []), x].slice(-500);
  A.last = { receipt: x, signed: r.signed, vA, vB, sides: r.sides };
  const after = ratings(G.st.duels).ratings || {}, move = x.self ? null : (after[vA.id] ?? 1000) - (before[vA.id] ?? 1000);
  note('duel', { id: vA.id, won: x.winner === 'a' });
  saveState();
  fill($('#g-ar-result'), el('p', { class: 'g-win ' + you }, x.winner === 'a' ? 'You win' : x.winner === 'b' ? 'They win' : 'A draw'),
    el('p', {}, 'Your mind ' + six(x.a.auc) + ' · theirs ' + six(x.b.auc) + ' (AUC on the batch)'),
    el('p', { class: 'g-small' }, 'Yours fought ' + kitLine(r.sides.a) + ' · theirs ' + kitLine(r.sides.b)),
    el('p', { class: 'g-small g-dim' }, x.self ? 'Practice: one owner on both sides, so no rating moves' : 'Rating ' + (move >= 0 ? '+' : '') + move + ' → ' + (after[vA.id] ?? 1000)),
    el('p', { class: 'g-small g-dim' }, 'Each side calls yes for its top ' + pos + ' cases (as many yeses as the batch holds) · cyan: only yours called it right · pink: only theirs · grey: both · dark: neither'),
    el('a', { class: 'g-btn hot big g-next', id: 'g-ar-next', href: '#estate' }, 'Next · see your estate →'), el('p', { class: 'g-teach' }, 'Estate: your portfolio of verified agents.'));
  soleNext($('#g-ar-result').querySelector('.g-next'));
  const sideArt = (v, sd, k, rating) => ({ id: v.id, rarity: facts(v).rarity, rating: Math.max(0, Math.min(9999, rating)), title: artText(facts(v).title, 16), kit: sd && sd.loadout && k ? { slots: slotsOf(v).nodes, fielded: Math.min(slotsOf(v).nodes, k.fielded.length - 1) } : null });
  A.art = { left: sideArt(vA, r.sides && r.sides.a, r.kits && r.kits.a, after[vA.id] ?? 1000), right: sideArt(vB, r.sides && r.sides.b, r.kits && r.kits.b, after[vB.id] ?? 1000),
    cases: r.batch.map((row, k) => [(r.scores.a[k] >= lineA) === (r.y[k] === 1) ? 1 : 0, (r.scores.b[k] >= lineB) === (r.y[k] === 1) ? 1 : 0]), result: x.winner === 'a' ? 'left' : x.winner === 'b' ? 'right' : 'draw' };
  const drawn = paintOn($('#g-ar-duelart'), paintDuel(A.art, plotTheme(), 480, 320));
  $('#g-ar-duelart').hidden = !drawn;
  $('#g-ar-duelart').setAttribute('aria-label', 'The duel, drawn: ' + facts(vA).title + ' against ' + facts(vB).title + ', ' + (x.winner === 'a' ? 'yours wins' : x.winner === 'b' ? 'theirs wins' : 'a draw') + ', every case marked');
  $('#g-ar-rerun').disabled = false; $('#g-ar-receipt').disabled = false; $('#g-ar-watch').disabled = false; $('#g-ar-watchbox').hidden = true;
  bleep(you === 'ok' ? 'kept' : you === 'bad' ? 'wrong' : 'abstain');
  renderLadder(); fill($('#g-ar-a-line'), facts(vA).title + ' #' + pad4(vA.serial) + ' · rating ' + (after[vA.id] ?? 1000));
}
/** watch the last duel back: fought again from its receipt, then case by case, each case readable */
async function arenaWatch() {
  if (!A.last) return;
  const box = $('#g-ar-watchbox'), lineEl = $('#g-ar-watch-line'), out = $('#g-ar-watch-out');
  box.hidden = false; fill($('#g-ar-readback')); fill(out); fill(lineEl, 'Fighting it again from its receipt…');
  const g = await api.groundFor(A.last.vA), r = await replay(A.last.receipt, A.last.sides.a, A.last.sides.b, g, A.last.signed);
  if (!r.ok) return fill(lineEl, el('span', { class: 'g-badt' }, '✗ ' + r.why));
  const cells = r.frames.map((f) => el('button', { type: 'button', class: 'g-case ' + (f.a.right && f.b.right ? 'both' : f.a.right ? 'mine' : f.b.right ? 'theirs' : 'none'), 'aria-label': 'Case ' + (f.k + 1) + ': really ' + (f.y ? 'yes' : 'no') + ', yours ' + (f.a.right ? 'right' : 'wrong') + ', theirs ' + (f.b.right ? 'right' : 'wrong'), onclick: () => arenaReadBack(r, f, g) }));
  fill(out, el('div', { class: 'g-cases' }, cells));
  let a = 0, b = 0;
  for (const f of r.frames) {
    if (f.a.right) a++; if (f.b.right) b++;
    cells[f.k].classList.add('seen');
    fill(lineEl, 'Case ' + (f.k + 1) + ' of ' + r.frames.length + ' · really ' + (f.y ? 'yes' : 'no') + ' · yours called ' + (f.a.call ? 'yes' : 'no') + (f.a.right ? ' (right)' : ' (wrong)') + ' · theirs ' + (f.b.call ? 'yes' : 'no') + (f.b.right ? ' (right)' : ' (wrong)') + ' · so far ' + a + ' to ' + b);
    await sleep(60);
  }
  fill(lineEl, '✓ The very same receipt · yours called ' + r.right.a + ' of ' + r.frames.length + ' right, theirs ' + r.right.b + ' · AUC on the batch ' + six(r.receipt.a.auc) + ' against ' + six(r.receipt.b.auc) + ' · tap a case to read it back');
}
/** one case of a watched duel, read back: each fielded mind's rules that fired on it, and its score */
function arenaReadBack(r, f, g) {
  const side = (k, name) => { const b = readBack(k, g, f.row); return b.ok ? b.minds.map((m) => el('div', {}, el('p', { class: 'g-small' }, name + ' · ' + (m.score === null ? 'no answer here' : 'score ' + m.score)), el('ul', { class: 'g-lines' }, m.fired.length ? m.fired.map((x) => line(x.w > 0 ? 'k' : 'r', x.feat + ' ' + (x.op === '<=' ? '≤' : '>') + ' ' + x.v, el('small', {}, (x.w > 0 ? '+' : '') + x.w))) : line('x', 'no rule fired')))) : el('p', { class: 'g-badt' }, b.why); };
  fill($('#g-ar-readback'), el('h4', {}, 'Case ' + (f.k + 1) + ' · really ' + (f.y ? 'yes' : 'no')), side(r.kits.a, 'Yours'), side(r.kits.b, 'Theirs'));
  // the case ringed on the duel's picture (PixelWhisperer's focus), the result banner left off while a case is read (with
  // both, CASE n and WIN overlap at every size: told to PixelWhisperer 2026-10-22; the panel above says who won): its truth, and both scores when they sit on the 0-to-1
  // scale the picture reads; a score outside it is told only in the read-back above, never squeezed onto the scale
  if (A.art) {
    const onScale = (s) => Number.isFinite(s) && s >= 0 && s <= 1, sc = onScale(f.a.score) && onScale(f.b.score) ? { scores: [Math.round(f.a.score * 1e6), Math.round(f.b.score * 1e6)] } : {};
    if (paintOn($('#g-ar-duelart'), paintDuel({ ...A.art, result: null, focus: { at: f.k, truth: f.y ? 1 : 0, ...sc } }, plotTheme(), 480, 320))) $('#g-ar-duelart').setAttribute('aria-label', 'The duel, drawn, with case ' + (f.k + 1) + ' ringed: really ' + (f.y ? 'yes' : 'no'));
  }
}
/** the tournament of your cards of one business: seeded, played out from the receipts, each open match one duel away */
async function renderTournament() {
  const mine = await myCards(null), sets = [...new Set(mine.map((m) => m.f.dataset))].filter((s) => mine.filter((m) => m.f.dataset === s).length >= 2), pick = $('#g-tn-set');
  if (!sets.length) { fill(pick, el('option', { value: '' }, 'two cards of one business first')); fill($('#g-tn-rounds'), line('x', 'Hold two or more cards of one business: press Card me, or mint a node in the Kit.')); return fill($('#g-tn-title')); }
  const keep = pick.value; fill(pick, sets.map((s) => el('option', { value: s }, SETS[s] ? SETS[s].title : s))); if (sets.includes(keep)) pick.value = keep;
  const cards = mine.filter((m) => m.f.dataset === pick.value).slice(0, 8), byCard = new Map(cards.map((m) => [m.id, m])), name = (id) => (byCard.get(id) ? '#' + pad4(byCard.get(id).v.serial) + ' ' + byCard.get(id).f.department : 'a bye');
  const receipts = G.st.duels || [], b = bracketOf(cards.map((m) => m.id), receipts), p = b.ok ? playOut(b, receipts) : b;
  if (!p.ok) return fill($('#g-tn-rounds'), line('r', p.why));
  const label = (n, total) => (n === total - 1 ? 'Final' : n === total - 2 ? 'Semi-final' : 'Round ' + (n + 1));
  // drawn duels so far between exactly a match's two cards: at DRAWS_TO_TIE the tie rule sends the higher seed through
  const drawsOf = (a, b) => receipts.filter((x) => x && x.kind === 'duel' && x.winner === 'draw' && x.a && x.b && ((x.a.card === a && x.b.card === b) || (x.a.card === b && x.b.card === a))).length;
  const said = (m) => (m.by === 'bye' ? name(m.winner) + ' advances'
    : m.tie ? name(m.winner) + ' went through on the tie rule: ' + DRAWS_TO_TIE + ' draws, so the higher seed'
      : name(m.winner) + ' won · duel ' + (m.by + 1));
  fill($('#g-tn-rounds'), p.rounds.flatMap((round, n) => round.map((m) => line((m.open ? 'x' : 'k') + ' g-two', label(n, p.rounds.length) + ' · ' + (m.a ? name(m.a) : 'to be decided') + ' v ' + (m.b ? name(m.b) : m.by === 'bye' ? 'a bye' : 'to be decided'),
    m.open && m.a && m.b ? el('span', { class: 'g-row' }, el('button', { type: 'button', class: 'g-btn', onclick: () => tournamentFight(m.a, m.b) }, 'Fight this match'),
      drawsOf(m.a, m.b) ? el('small', {}, drawsOf(m.a, m.b) + ' of ' + DRAWS_TO_TIE + ' draws before the tie rule') : null)
      : el('small', {}, m.open ? 'open' : said(m))))));
  fill($('#g-tn-title'), p.champion ? '★ ' + p.title + ': ' + name(p.champion) + ' — a title, and nothing else' : '');
}
async function tournamentFight(aId, bId) {
  const vA = await verify(api.lifeOf(aId)), vB = await verify(api.lifeOf(bId)), r = await fightWith(vA, vB, S.me, S.me, 'tournament-' + Date.now());
  if (!r.ok) return fill($('#g-tn-title'), el('span', { class: 'g-badt' }, 'The match could not be fought: ' + r.why));
  G.st.duels = [...(G.st.duels || []), r.receipt].slice(-500); saveState(); renderLadder();
  await renderTournament();
}
async function arenaRerun() {
  if (!A.last) return;
  const g = await api.groundFor(A.last.vA), r = await kitRerun(A.last.receipt, A.last.sides.a, A.last.sides.b, g, A.last.signed);
  $('#g-ar-result').append(el('p', { class: r.ok ? 'g-okt' : 'g-badt' }, r.ok ? '✓ Re-fought here: the very same receipt' : '✗ ' + r.why));
}
function renderLadder() {
  const r = ratings(G.st.duels || []), rows = Object.entries(r.ratings || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
  fill($('#g-ar-ladder'), rows.length ? rows.map(([id, pts]) => line(api.mine().includes(id) ? 'k' : '', '#' + pad4((S.reg.cards[id] || {}).serial || 0) + ' ' + ((S.manifest.cards.find((c) => c.card === id) || {}).domain || id.slice(0, 8)), el('small', {}, pts + ' · ' + (r.played[id] || 0) + ' duels'))) : line('x', 'No duels between two players here yet · a duel between two different players moves both ratings'));
}
// a friend: the challenge (or the answer) travels as text, with the card's whole life, so their device holds what it fights
const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const dec = (s) => { try { return JSON.parse(decodeURIComponent(escape(atob(String(s).trim())))); } catch { return null; } };
async function arenaCopy() {
  const id = $('#g-ar-mine').value;
  if (!id) return;
  const v = await verify(api.lifeOf(id)), side = await sideFor(v), ch = await kitChallenge(S.me, v, side.loadout, 'f' + Date.now().toString(36));
  if (!ch.ok) return fill($('#g-ar-friend-out'), el('p', { class: 'g-badt' }, ch.why));
  const code = enc({ kind: 'digi.duel.challenge', challenge: ch.challenge, card: api.lifeOf(id), kit: kitCode(side) });
  A.pending = { mine: id, challenge: ch.challenge, side };
  try { await navigator.clipboard.writeText(code); fill($('#g-ar-friend-out'), el('p', { class: 'g-okt g-small' }, 'Copied (' + Math.round(code.length / 1024) + ' KB). Send it to them; paste their answer here.')); }
  catch { $('#g-ar-code').value = code; fill($('#g-ar-friend-out'), el('p', { class: 'g-small' }, 'Copy the text above and send it to them.')); }
}
async function arenaPaste() {
  const o = dec($('#g-ar-code').value), out = $('#g-ar-friend-out');
  if (!o || !o.card) return fill(out, el('p', { class: 'g-badt' }, 'That is not a Kardlings challenge or answer.'));
  const them = await verifyLife(o.card);
  if (!them.ok) return fill(out, el('p', { class: 'g-badt' }, 'Their card does not check: ' + them.why));
  const kept = await api.keep(o.card);   // their card's life, recorded here like any card opened here
  if (!kept.ok && kept.why) { /* already held, or a later life is here: the duel checks the heads itself */ }
  const theirs = await sideFromCode(them, o.kit);
  if (!theirs.ok) return fill(out, el('p', { class: 'g-badt' }, theirs.why));
  if (o.kind === 'digi.duel.challenge') {
    const id = $('#g-ar-mine').value;
    if (!id) return fill(out, el('p', { class: 'g-badt' }, 'Pick your fighter first.'));
    const v = await verify(api.lifeOf(id)), mine = await sideFor(v), ac = await kitAccept(S.me, v, mine.loadout, o.challenge);
    if (!ac.ok) return fill(out, el('p', { class: 'g-badt' }, ac.why));
    const g = await api.groundFor(them), r = await kitDuel(theirs, mine, g, { challenge: o.challenge, accept: ac.accept });
    A.pending = { foe: them.id }; await showFoe();
    if (r.ok) { r.signed = { challenge: o.challenge, accept: ac.accept }; r.g = g; r.sides = { a: theirs, b: mine }; }
    const answer = enc({ kind: 'digi.duel.answer', challenge: o.challenge, accept: ac.accept, card: api.lifeOf(id), kit: kitCode(mine) });
    $('#g-ar-code').value = answer;
    fill(out, el('p', { class: 'g-small' }, 'Fought here. Send them the answer now in the box (or copy it): their device fights the very same duel.'));
    showDuel(r, them, v);
    return;
  }
  if (o.kind === 'digi.duel.answer') {
    if (!A.pending || !A.pending.challenge || A.pending.challenge.sig !== o.challenge.sig) return fill(out, el('p', { class: 'g-badt' }, 'This answers a challenge this tab did not send.'));
    const v = await verify(api.lifeOf(A.pending.mine)), mine = A.pending.side || alone(v), g = await api.groundFor(v), r = await kitDuel(mine, theirs, g, { challenge: o.challenge, accept: o.accept });
    A.pending = { foe: them.id }; await showFoe();
    if (r.ok) { r.signed = { challenge: o.challenge, accept: o.accept }; r.g = g; r.sides = { a: mine, b: theirs }; }
    showDuel(r, v, them);
    return;
  }
  fill(out, el('p', { class: 'g-badt' }, 'That is not a Kardlings challenge or answer.'));
}

// ── play: raids ─────────────────────────────────────────────────────────────────────────────────────────────────
const R = { running: new Set() };
/** the campaign: every chapter, cleared or now or later, each boss in it felled or standing, from the receipts alone */
async function renderCampaign() {
  admission ||= await fetch('drop/admission.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const c = campaign(admission, G.st.strikes || [], (G.st.clears || []).map((x) => x.clear)), box = $('#g-cp-chapters');
  if (!c.ok || !c.chapters.length) return fill(box, line('x', 'The admission record did not load.'));
  fill(box, c.chapters.map((ch) => {
    const title = SETS[ch.set] ? SETS[ch.set].title : ch.set, down = ch.raids.filter((r) => r.fallen).length;
    const bosses = [...ch.raids.map((r) => r.domain.slice(ch.set.length + 1) + (r.fallen ? ' ✓' : '')), 'the whole business' + (ch.world.fallen ? ' ✓' : '')];
    return line((ch.cleared ? 'k' : ch.n === c.now ? 'm' : 'x') + ' g-two', 'Chapter ' + ch.n + ' · ' + title + (ch.cleared ? ' · cleared' : ch.n === c.now ? ' · now' : ''),
      el('small', {}, (ch.raids.length ? down + ' of ' + ch.raids.length + ' raid boss' + (ch.raids.length === 1 ? '' : 'es') + ' down, then ' : '') + 'its world boss · ' + bosses.join(' → ')));
  }));
  // the chapter drawn by PixelWhisperer's paintChapter: its bosses on a path, the world boss's crest, health on one scale,
  // fallen ones under a gold check, as the receipts say — the one to play now unless another is picked
  const pick = $('#g-cp-pick'), keep = Number(pick.value) || 0;
  fill(pick, c.chapters.map((ch) => el('option', { value: String(ch.n) }, 'Chapter ' + ch.n + ' · ' + (SETS[ch.set] ? SETS[ch.set].title : ch.set) + (ch.cleared ? ' · cleared' : ch.n === c.now ? ' · now' : ''))));
  const show = c.chapters.find((ch) => ch.n === keep) || c.chapters.find((ch) => ch.n === c.now) || c.chapters[c.chapters.length - 1];
  pick.value = String(show.n);
  const art = paintChapter({ n: show.n, set: show.set, raids: show.raids.map((r) => ({ domain: r.domain, best: r.best, fallen: r.fallen })), world: { best: show.world.best, bar: show.world.bar, fallen: show.world.fallen }, now: show.n === c.now }, plotTheme(), 720, 480);
  $('#g-cp-art').hidden = !art.ok;
  if (art.ok) { putRGB($('#g-cp-art'), art.px, 720, 480); $('#g-cp-art').setAttribute('aria-label', 'Chapter ' + show.n + ', drawn: ' + (show.raids.length ? show.raids.filter((r) => r.fallen).length + ' of ' + show.raids.length + ' raid bosses fallen, then its world boss' : 'its world boss alone') + (show.world.fallen ? ' (fallen)' : '') + (show.cleared ? ' · cleared' : show.n === c.now ? ' · now' : '')); }
}
async function renderRaids() {
  admission ||= await fetch('drop/admission.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const bosses = bossesOf(admission), st = raidStanding(bosses, G.st.strikes || []), box = $('#g-rd-bosses');
  if (!bosses.length) return fill(box, el('p', { class: 'g-dim' }, 'The admission record did not load.'));
  const loot = {};
  for (const [dom, id] of Object.entries(G.st.loot || {})) { const d = api.lifeOf(id), v = d ? await verify(d) : null; if (v && v.ok) loot[dom] = { id, rarity: facts(v).rarity, title: artText(facts(v).title, 24) }; }
  fill(box, bosses.map((b) => {
    const r = st.raids[b.domain], mine = (G.st.strikes || []).filter((s) => s.domain === b.domain && s.by === S.me.pub).length;
    const go = el('button', { type: 'button', class: 'g-btn hot', disabled: R.running.has(b.domain) || r.fallen, onclick: () => raidGo(b, mine) }, R.running.has(b.domain) ? 'Striking…' : r.fallen ? 'Fallen' : 'Strike');
    const pic = el('canvas', { width: 240, height: 160, class: 'g-bossart', role: 'img', 'aria-label': b.domain.replace('-', ' ') + ': ' + (r.fallen ? 'fallen' : six(r.hp) + ' from the bar') });
    const raidArt = { dataset: b.set, department: b.domain.slice(b.set.length + 1), best: r.best, attempts: Math.min(99999, r.strikes) };
    if ((r.fallen && !loot[b.domain]) || !paintOn(pic, paintRaid(r.fallen ? { ...raidArt, loot: loot[b.domain] } : raidArt, plotTheme(), 240, 160))) pic.hidden = true;
    return el('div', { class: 'g-boss' + (r.fallen ? ' down' : '') }, pic, el('h3', {}, b.domain.replace('-', ' ')),
      el('p', { class: 'g-small g-dim' }, 'The ' + b.domain.slice(b.set.length + 1) + ' records of ' + (SETS[b.set] ? SETS[b.set].title.toLowerCase() : b.set) + ' · the question: ' + (SETS[b.set] ? sayOutcome(b.set, SETS[b.set].outcome) : 'yes or no') + '? · no mind of these columns alone has answered it well enough yet'),
      pic.hidden ? el('div', { class: 'g-hp', role: 'img', 'aria-label': 'Health ' + six(r.hp) + ' from the bar' }, el('i', { style: 'width:' + Math.min(100, Math.round((r.hp / 100000) * 100)) + '%' })) : null,
      el('p', { class: 'g-small' }, r.fallen ? 'Fallen after ' + r.kill.after + ' strike' + (r.kill.after === 1 ? '' : 's') + ' · ' + six(r.kill.gate) + ' by ' + (r.kill.by === S.me.pub ? 'you' : api.short(r.kill.by)) : 'Best so far ' + six(r.best) + ' of the 0.600000 it needs to fall · ' + six(r.hp) + ' to go'),
      el('p', { class: 'g-small g-dim' }, 'Genesis tried ' + b.searched + ' · raid strikes ' + r.strikes + ' (' + mine + ' yours) · ' + Object.keys(r.strikers).length + ' striker' + (Object.keys(r.strikers).length === 1 ? '' : 's')),
      el('div', { class: 'g-row' }, go, r.fallen && r.kill.by === S.me.pub && !G.st.loot?.[b.domain] ? el('button', { type: 'button', class: 'g-btn gold', onclick: () => raidLoot(b) }, 'Seal the loot') : null,
        G.st.loot?.[b.domain] ? el('a', { class: 'g-btn', href: '#cards' }, 'Your ' + b.domain.split('-')[1] + ' card') : null));
  }));
}
async function raidGo(b, k) {
  const out = $('#g-rd-out');
  R.running.add(b.domain); renderRaids();
  try {
    fill(out, el('p', { class: 'g-small' }, 'Fetching the ' + b.set + ' records (checked by their hash) for a strike on ' + b.domain + '…'));
    const g = await api.groundOf(b.set, (t) => fill(out, el('p', { class: 'g-small' }, t)));
    const seed = strikeSeed(S.me.pub, b.domain, k), t0 = Date.now(), tick = setInterval(() => fill(out, el('p', { class: 'g-small' }, 'Strike ' + (k + 1) + ' on ' + b.domain + ': a search on its FIT rows (seed ' + seed + ') — ' + Math.round((Date.now() - t0) / 1000) + ' s')), 500);
    const w = await api.work({ op: 'search', set: b.set, own: null, domain: b.domain, seed, bar: RAID_BAR / 1e6, grow: GROW });
    clearInterval(tick);
    if (!w.ok) return fill(out, el('p', { class: 'g-badt' }, 'The strike could not run: ' + w.why));
    const s = await raidStrike(S.me, g, b.domain, k, { organ: { ok: true, fixed: w.fixed, gate: w.gate } });
    const c = s.ok ? await checkStrike(s.strike, g) : s;
    if (!c.ok) return fill(out, el('p', { class: 'g-badt' }, 'The strike did not check here: ' + c.why));
    G.st.strikes = [...(G.st.strikes || []), s.strike].slice(-2000);
    note('strike', { id: b.domain, gate: s.strike.gate, kept: s.strike.gate >= RAID_BAR });
    saveState();
    const cleared = s.strike.gate >= RAID_BAR;
    fill(out, el('p', { class: cleared ? 'g-okt' : '' }, (cleared ? '★ The boss falls: ' : 'Strike ' + (k + 1) + ': ') + six(s.strike.gate) + ' on GATE' + (cleared ? ' — seal the loot' : ' (the bar is 0.600000)') + ' · re-checked here'));
    bleep(cleared ? 'level' : 'refused');
  } catch (e) { fill(out, el('p', { class: 'g-badt' }, String(e.message || e))); }
  finally { R.running.delete(b.domain); renderRaids(); }
}
/** seal a strike that cleared the bar as the first card of its department, with this key as maker. → { ok, id } | why */
async function sealLoot(s) {
  const l = lootOf(s);
  if (!l.ok) return l;
  const sealed = await sealGenome(l.genome, S.me);
  if (!sealed.ok) return { ok: false, why: sealed.why };
  const serial = 1 + Object.values(S.reg.cards).filter((c) => c.maker === S.me.pub).reduce((m, c) => Math.max(m, c.serial), 0);
  const c = await issueCard(sealed.text, S.me, { serial, to: S.me.pub, theme: 'synthwave-v1', generation: 0 });
  const kept = c.ok ? await api.keep(c.dossier) : c;
  if (!kept.ok) return { ok: false, why: kept.why };
  const id = kept.entry ? kept.entry.card : sealed.id;
  note('minted', { id }); saveState();
  await api.renderWallet();
  return { ok: true, id };
}
async function raidLoot(b) {
  const st = raidStanding(bossesOf(admission), G.st.strikes || []), r = st.raids[b.domain], s = (G.st.strikes || []).find((x) => x.domain === b.domain && x.by === r.kill.by && x.k === r.kill.k);
  const sealed = await sealLoot(s);
  if (!sealed.ok) return fill($('#g-rd-out'), el('p', { class: 'g-badt' }, sealed.why));
  G.st.loot = { ...(G.st.loot || {}), [b.domain]: sealed.id };
  saveState();
  fill($('#g-rd-out'), el('p', { class: 'g-okt' }, '★ Sealed: the first ' + b.domain + ' card, with you as its maker. It is in your collection.'));
  renderRaids();
}
async function raidShare() {
  const mine = (G.st.strikes || []).filter((s) => s.by === S.me.pub), code = btoa(unescape(encodeURIComponent(JSON.stringify({ kind: 'digi.raid.strikes', strikes: mine }))));
  try { await navigator.clipboard.writeText(code); fill($('#g-rd-out'), el('p', { class: 'g-okt g-small' }, 'Copied your ' + mine.length + ' strike' + (mine.length === 1 ? '' : 's') + '. A friend adds them to their raid; each is re-checked on arrival.')); }
  catch { const t = $('#g-rd-code'); t.hidden = false; t.value = code; fill($('#g-rd-out'), el('p', { class: 'g-small' }, 'Copy the text above and send it.')); }
}
async function raidImport() {
  const t = $('#g-rd-code');
  if (t.hidden || !t.value.trim()) { t.hidden = false; t.value = ''; t.focus(); return fill($('#g-rd-out'), el('p', { class: 'g-small' }, 'Paste a friend’s strikes in the box, then press Add a friend’s strikes again.')); }
  let o = null;
  try { o = JSON.parse(decodeURIComponent(escape(atob(t.value.trim())))); } catch { o = null; }
  if (!o || o.kind !== 'digi.raid.strikes' || !Array.isArray(o.strikes)) return fill($('#g-rd-out'), el('p', { class: 'g-badt' }, 'Those are not Kardlings raid strikes.'));
  const bosses = bossesOf(admission), have = new Set((G.st.strikes || []).map((s) => s.sig));
  let added = 0, refused = 0;
  for (const s of o.strikes.slice(0, 500)) {
    const b = bosses.find((x) => x.domain === s.domain);
    if (!b || have.has(s.sig)) continue;
    const c = await checkStrike(s, await api.groundOf(b.set));
    if (c.ok) { G.st.strikes = [...(G.st.strikes || []), s]; have.add(s.sig); added++; } else refused++;
  }
  saveState(); t.value = ''; t.hidden = true;
  fill($('#g-rd-out'), el('p', { class: added ? 'g-okt' : '' }, added + ' strike' + (added === 1 ? '' : 's') + ' added, each re-checked here' + (refused ? ' · ' + refused + ' refused' : '')));
  renderRaids();
}

// ── cards: the kit ──────────────────────────────────────────────────────────────────────────────────────────────────
// Every card carries its slots from birth (slotsOf). The owner fills them here with nodes — its own cards of the same
// business — and tools — app items — measures the kitted mind on this device, and signs the loadout. A node is minted
// the way a raid strikes: one search on a department the Kardling lacks, from a seed the owner's key fixes, sealed only if
// it clears 0.6 on GATE. A tool is minted from mint-an-app's records, vendored byte for byte.
const KIT = { card: null, nodes: [], tools: [], measured: null, tier: 'proven', busy: new Set() };
let appRecords = null;
async function appsLoaded() {
  if (appRecords) return appRecords;
  const [c, m] = await Promise.all(['catalogue-data.json', 'mint-data.json'].map((f) => fetch('vendor/mint-an-app/' + f).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  if (!c || !m) return null;
  appRecords = { apps: appsOf(c, m), rows: new Map((Array.isArray(c.rows) ? c.rows : []).filter((r) => r && typeof r.name === 'string').map((r) => [r.name, r])) };
  return appRecords;
}
/** the app items this key holds, each checked against the records */
async function heldItems() {
  const rec = await appsLoaded(), out = [];
  if (!rec) return out;
  for (const item of G.st.items || []) { const v = await verifyItem(item, rec.apps); if (v.ok && v.owner === S.me.pub) out.push({ item, v }); }
  return out;
}
/** a card's stored loadout, and what it names, checked as they all stand now */
async function kitOf(v) {
  const lo = (G.st.loadouts || {})[v.id];
  if (!lo) return { lo: null, nodes: [], tools: [], items: [], ok: false, why: 'not kitted yet' };
  const held = await heldItems(), nodes = [], tools = [], items = [];
  for (const n of Array.isArray(lo.nodes) ? lo.nodes : []) { const d = api.lifeOf(n.card); nodes.push(d ? await verify(d) : { ok: false }); }
  for (const t of Array.isArray(lo.tools) ? lo.tools : []) { const h = held.find((x) => x.v.id === t); tools.push(h ? h.v : { ok: false }); items.push(h ? h.item : null); }
  const r = await loadoutOk(lo, v, nodes, tools);
  return { lo, nodes, tools, items, ok: r.ok, why: r.why || '' };
}
const alone = (v) => ({ v, loadout: null, nodes: [], tools: [], items: [] });
/** a side for a duel: the card with its loadout while that still checks, else the card alone */
async function sideFor(v) { const k = await kitOf(v); return k.ok ? { v, loadout: k.lo, nodes: k.nodes, tools: k.tools, items: k.items } : alone(v); }
const kitLine = (side) => (side && side.loadout ? 'kitted · ' + side.nodes.length + ' node' + (side.nodes.length === 1 ? '' : 's') + ', ' + side.tools.length + ' tool' + (side.tools.length === 1 ? '' : 's') : 'alone');
/** a side's kit as it travels to a friend: the loadout, its node cards' lives and its tool items */
const kitCode = (side) => (side.loadout ? { loadout: side.loadout, nodes: side.nodes.map((n) => api.lifeOf(n.id)), items: side.items } : null);
/** a friend's side from what their code carried: every node card and tool checked here before it fights */
async function sideFromCode(v, kit) {
  if (!kit) return { ok: true, ...alone(v) };
  const rec = await appsLoaded(), nodes = [], tools = [];
  for (const d of (Array.isArray(kit.nodes) ? kit.nodes : []).slice(0, 4)) {
    const n = await verifyLife(d);
    if (!n.ok) return { ok: false, why: 'A node of theirs does not check: ' + n.why };
    await api.keep(d); nodes.push(n);
  }
  for (const it of (Array.isArray(kit.items) ? kit.items : []).slice(0, 2)) {
    const t = rec ? await verifyItem(it, rec.apps) : { ok: false, why: 'the estate’s app records did not load here' };
    if (!t.ok) return { ok: false, why: 'A tool of theirs does not check: ' + t.why };
    tools.push(t);
  }
  return { ok: true, v, loadout: kit.loadout, nodes, tools, items: kit.items };
}
const domainsOf = (v) => v.genome.organs.map((o) => { const d = decodeSeed(o, { guard: false }); return d.ok ? d.seed.domain : ''; });
// ── the talker (Phase 7): a card asked in plain words, answering only from its own rules (src/talker.mjs) ───────────
const TK = { vocab: null, id: null, busy: false, ranges: {} };
/** the lowest and highest value each column holds in a business's records, to say when a question goes past them */
const rangesOf = (g) => (TK.ranges[g.id] ||= Object.fromEntries(g.ds.features.map((f) => { let lo = Infinity, hi = -Infinity; for (const x of g.ds.cols[f]) { if (x < lo) lo = x; if (x > hi) hi = x; } return [f, [lo, hi]]; })));
/** what the talker answers with: the card's mind as this device grows it (the boot's own steps, kept per card), its
 *  business's words, the columns the business holds, and the score measured here — or why there is none */
async function talkerCtx(id) {
  TK.vocab ||= await fetch('data/vocab.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const v = await verify(api.lifeOf(id)), set = v.ok ? api.setOf(v) : null, voc = TK.vocab && set ? vocabOf(TK.vocab, set) : null;
  if (!v.ok) return { why: 'This card does not check: ' + v.why };
  if (!voc) return { why: 'This card’s business has no words here yet: a card grown on your own table is asked through its own columns, in the Kit.' };
  let grown = G.grown.get(id);
  const g = await api.groundFor(v);
  if (!grown) {
    await api.select(id);
    grown = await api.actGrow();
    if (!grown || grown.gate == null) return { why: 'Its mind does not answer on these records: no department of it cleared its bar here.' };
    G.grown.set(id, grown);
  }
  return { ctx: { mind: grown.mind, voc, features: g.ds.features, gate: grown.gate, rows: null }, ranges: rangesOf(g) };
}
async function renderTalker() {
  const mine = await myCards(null), pick = $('#g-tk-card');
  fill(pick, mine.length ? mine.map((m) => el('option', { value: m.id }, m.f.title + ' #' + pad4(m.v.serial))) : el('option', { value: '' }, 'card me first'));
  if (mine.some((m) => m.id === (TK.id || S.sel))) pick.value = TK.id || S.sel;
  TK.id = pick.value || null;
  const m = mine.find((x) => x.id === TK.id), face = $('#g-tk-face');
  if (m) await show(face, $('#g-tk-ring'), api.lifeOf(m.id));
  else { face.getContext('2d').clearRect(0, 0, face.width, face.height); $('#g-tk-ring').className = 'g-ring'; }
  fill($('#g-tk-line'), m ? m.f.title + ' #' + pad4(m.v.serial) + ' · ' + m.f.department + ' · ' + m.f.rarity : 'Card me first: then you have a Kardling to ask.');
  $('#g-tk-ask').disabled = !m || TK.busy;
  if (!m) return fill($('#g-tk-asks'));
  if (!G.grown.has(m.id)) fill($('#g-tk-asks'), el('small', { class: 'g-dim' }, 'Growing its mind here first, as Boot does…'));
  const c = await talkerCtx(m.id);
  if (TK.id !== m.id) return;   // another card was chosen while this one grew
  renderLearn(c.ctx || null);
  fill($('#g-tk-asks'), c.ctx ? asks(c.ctx).map((q) => el('button', { type: 'button', class: 'g-btn g-ask', onclick: () => { $('#g-tk-q').value = q; talkerAsk(); } }, q)) : el('small', { class: 'g-badt' }, c.why));
}
/** the ten missions, marked by asking this card again the questions it was asked (src/learn.mjs) */
function renderLearn(ctx) {
  const ms = mark(((G.st.talks || {})[TK.id]) || [], ctx), done = ms.filter((m) => m.passed).length;
  setK('g-tk-learn-n', done + ' of ' + ms.length);
  fill($('#g-tk-learn'), ms.map((m) => line((m.passed ? 'k' : '') + ' g-two', (m.passed ? '✓ ' : '') + m.title, el('small', {}, m.how))));
}
async function talkerAsk() {
  const out = $('#g-tk-out'), q = $('#g-tk-q').value.trim();
  if (TK.busy || !TK.id) return;
  if (!q) return fill(out, el('p', { class: 'g-small g-dim' }, 'Type a question first, or press one of the questions above.'));
  TK.busy = true; $('#g-tk-ask').disabled = true;
  try {
    fill(out, el('p', { class: 'g-small' }, 'Reading your question with its business’s own words…'));
    const c = await talkerCtx(TK.id);
    if (!c.ctx) { fill(out, el('p', { class: 'g-badt' }, c.why)); return; }
    const r = reply(q, c.ctx), ok = r.verdict === 'VERIFIED';
    // the question is kept with its card (the last MAX_TRIES), so the missions can ask it of the card again
    G.st.talks = { ...(G.st.talks || {}), [TK.id]: [...((G.st.talks || {})[TK.id] || []), q].slice(-MAX_TRIES) }; saveState();
    renderLearn(c.ctx);
    // a value past anything in the records still gets the rules' answer, said with that warning: nothing it grew on was like it
    const past = ok ? Object.entries(r.receipt.case || {}).filter(([f, x]) => c.ranges[f] && (x < c.ranges[f][0] || x > c.ranges[f][1])) : [];
    fill(out, el('p', { class: 'g-row' }, el('span', { class: 'g-tag ' + (ok ? 'ok' : 'cy') }, ok ? 'answered from its rules' : 'it cannot answer that')), el('p', { class: 'g-tk-said' }, r.text),
      past.length ? el('p', { class: 'g-small g-badt' }, 'Past its records: ' + past.map(([f, x]) => sayFeature(f, c.ctx.voc) + ' ' + sayNumber(x) + ' (its records hold ' + sayNumber(c.ranges[f][0]) + ' to ' + sayNumber(c.ranges[f][1]) + ')').join('; ') + '. Its rules still answer, but nothing it grew on was like this.') : null);
    $('#g-tk-rc-box').hidden = false;
    fill($('#g-tk-rc'), JSON.stringify(r.receipt, null, 1));
    bleep(ok ? 'kept' : 'abstain');
  } finally { TK.busy = false; $('#g-tk-ask').disabled = false; }
}

async function myCards(set) {
  const out = [];
  for (const id of api.mine()) { const w = await verify(api.lifeOf(id)); if (w.ok && api.setOf(w) && (!set || api.setOf(w) === set)) out.push({ id, v: w, f: facts(w) }); }
  return out;
}

async function renderKit() {
  const mine = await myCards(null), pick = $('#g-kit-card');
  fill(pick, mine.length ? mine.map((m) => el('option', { value: m.id }, m.f.title + ' #' + pad4(m.v.serial))) : el('option', { value: '' }, 'card me first'));
  const want = KIT.card || S.sel;
  if (mine.some((m) => m.id === want)) pick.value = want;
  const id = pick.value;
  if (!id) { fill($('#g-kit-nodes')); fill($('#g-kit-tools')); fill($('#g-kit-line'), 'Card me first: then you have a Kardling to kit out.'); fill($('#g-kit-depts')); return renderKitApps(); }
  const v = await verify(api.lifeOf(id)), k = await kitOf(v);
  if (KIT.card !== id) {
    KIT.card = id; KIT.measured = null;
    KIT.nodes = k.lo ? k.lo.nodes.map((n) => n.card).filter((c) => api.lifeOf(c)) : [];
    KIT.tools = k.lo ? [...k.lo.tools] : [];
  }
  await show($('#g-kit-face'), $('#g-kit-ring'), api.lifeOf(id));
  const s = slotsOf(v), f = facts(v);
  fill($('#g-kit-line'), f.title + ' #' + pad4(v.serial) + ' · ' + f.rarity + ' · ' + (k.ok ? 'equipped: ' + k.lo.nodes.length + ' node' + (k.lo.nodes.length === 1 ? '' : 's') + ', ' + k.lo.tools.length + ' tool' + (k.lo.tools.length === 1 ? '' : 's') : k.lo ? 'its kit lapsed: ' + k.why : 'not kitted yet: it fights alone'));
  fill($('#g-kit-nslots'), s.nodes + ' of 4 open');
  renderSheet(v, f, s);
  await renderKitNodes(v, s);
  await renderKitTools();
  await renderKitDepts(v);
  await renderKitApps();
}
/** the character sheet: what it covers, where it fights, and its record, every line read from receipts on this device */
function renderSheet(v, f, s) {
  const duels = (G.st.duels || []).filter((x) => x.a && (x.a.card === v.id || x.b.card === v.id)), side = (x) => (x.a.card === v.id ? 'a' : 'b');
  const rated = duels.filter((x) => !x.self), won = rated.filter((x) => x.winner === side(x)).length, drawn = rated.filter((x) => x.winner === 'draw').length, rate = (ratings(G.st.duels || []).ratings || {})[v.id] ?? 1000;
  const parties = (G.st.clears || []).filter((c) => c.clear.members.some((m) => m.card === v.id)), share = parties.reduce((n, c) => n + c.clear.members.find((m) => m.card === v.id).share, 0);
  const domains = domainsOf(v).filter(Boolean), set = api.setOf(v);
  fill($('#g-kit-sheet'), [['Raid role', 'covers ' + (domains.join(' + ') || 'its own table')], ['Arena', set ? 'ready on ' + (SETS[set] ? SETS[set].title : 'its own table') + ' — its mind cleared 0.6 on GATE' : 'its own table only'],
    ['Level · rarity', f.stage + ' · ' + f.rarity + ' (' + s.nodes + ' node slots)'], ['Duels, rated', rated.length + ' · won ' + won + ', lost ' + (rated.length - won - drawn) + ', drawn ' + drawn], ['Rating', String(rate)],
    ['Party strikes', parties.length + (parties.length ? ' · share ' + share.toLocaleString() + ' millionths in all' : '')], ['Lineage', v.generation ? 'generation ' + v.generation + ' · parents ' + v.genome.parents.map((p) => p.slice(0, 6)).join(', ') : 'genesis']].flatMap(([k, x]) => [el('dt', {}, k), el('dd', {}, x)]));
}
async function renderKitNodes(v, s) {
  const same = (await myCards(api.setOf(v))).filter((m) => m.id !== v.id), worth = new Map(((KIT.measured && KIT.measured.slots) || []).map((x) => [x.card, x]));
  KIT.nodes = KIT.nodes.filter((c) => same.some((m) => m.id === c)).slice(0, s.nodes);
  const out = [];
  for (let i = 0; i < 4; i++) {
    const name = el('b', {}, 'Node slot ' + (i + 1));
    if (i >= s.nodes) { out.push(el('div', { class: 'g-kslot locked' }, name, el('small', {}, i === 2 ? 'opens when this Kardling levels once' : 'opens at rare: three levels'), el('a', { class: 'g-btn', href: '#cards' }, 'Train it'))); continue; }
    const id = KIT.nodes[i];
    if (id) {
      const m = same.find((x) => x.id === id), w = worth.get(id);
      const shown = w && w.joined ? Math.max(-999999, Math.min(999999, w.contribution)) : 0;
      out.push(el('div', { class: 'g-kslot full' }, slotArt({ kind: 'node', card: { id: m.id, rarity: m.f.rarity }, worth: shown, joined: w ? w.joined : true }, 'Node slot ' + (i + 1) + ': ' + m.f.title + (w ? (w.joined ? ', adds ' + shown + ' millionths' : ', not joined') : '')), name, el('span', {}, m.f.title + ' #' + pad4(m.v.serial)), el('small', {}, m.f.department + (w ? (w.joined ? ' · adds ' + (w.contribution >= 0 ? '+' : '') + six(w.contribution) : ' · ' + w.why) : ' · measure it to see what it adds')),
        el('button', { type: 'button', class: 'g-btn', onclick: () => { KIT.nodes.splice(i, 1); KIT.measured = null; renderKit(); } }, 'Take out')));
      continue;
    }
    const free = same.filter((m) => !KIT.nodes.includes(m.id));
    if (!free.length) { out.push(el('div', { class: 'g-kslot empty' }, slotArt({ kind: 'node' }, 'Node slot ' + (i + 1) + ', empty'), name, el('small', {}, 'Empty · no other card of yours on this business yet: mint a node, or Card me'))); continue; }
    const sel = el('select', { 'aria-label': 'A card for node slot ' + (i + 1) }, free.map((m) => el('option', { value: m.id }, m.f.title + ' #' + pad4(m.v.serial) + ' · ' + m.f.department)));
    out.push(el('div', { class: 'g-kslot empty' }, slotArt({ kind: 'node' }, 'Node slot ' + (i + 1) + ', empty'), name, sel, el('button', { type: 'button', class: 'g-btn cy', onclick: () => { KIT.nodes.push(sel.value); KIT.measured = null; renderKit(); } }, 'Put it in')));
  }
  fill($('#g-kit-nodes'), out);
}
async function renderKitTools() {
  const held = await heldItems();
  KIT.tools = KIT.tools.filter((t) => held.some((h) => h.v.id === t)).slice(0, 2);
  fill($('#g-kit-tools'), [0, 1].map((i) => {
    const h = held.find((x) => x.v.id === KIT.tools[i]), name = el('b', {}, 'Tool slot ' + (i + 1));
    if (!h) {
      const free = held.filter((x) => !KIT.tools.includes(x.v.id));
      if (!free.length) return el('div', { class: 'g-kslot empty' }, slotArt({ kind: 'tool' }, 'Tool slot ' + (i + 1) + ', empty'), name, el('small', {}, 'Empty · mint an app tool from the list'));
      const sel = el('select', { 'aria-label': 'A tool for tool slot ' + (i + 1) }, free.map((x) => el('option', { value: x.v.id }, x.v.body.app)));
      return el('div', { class: 'g-kslot empty' }, slotArt({ kind: 'tool' }, 'Tool slot ' + (i + 1) + ', empty'), name, sel, el('button', { type: 'button', class: 'g-btn cy', onclick: () => { KIT.tools.push(sel.value); renderKit(); } }, 'Put it in'));
    }
    const b = h.v.body;
    return el('div', { class: 'g-kslot full' }, slotArt({ kind: 'tool', item: { id: b.sha.slice(0, 16), tier: b.tier } }, 'Tool slot ' + (i + 1) + ': ' + b.app + ', ' + b.tier), name, el('span', {}, b.app + ' ', el('span', { class: 'g-tag ' + (b.tier === 'proven' ? 'ok' : 'cy') }, b.tier)), el('small', {}, 'commit ' + b.sha.slice(0, 7) + (b.spdx ? ' · ' + b.spdx : '')),
      el('span', { class: 'g-row' }, el('button', { type: 'button', class: 'g-btn', onclick: () => toolOpen(b) }, 'Open'), el('a', { class: 'g-btn', href: b.run, target: '_blank', rel: 'noopener noreferrer' }, 'Its proof'),
        el('button', { type: 'button', class: 'g-btn', onclick: () => { KIT.tools.splice(i, 1); renderKit(); } }, 'Take out')));
  }));
  const give = $('#g-kit-give-item');
  if (give) fill(give, held.length ? held.map((x) => el('option', { value: x.v.id }, x.v.body.app + ' · ' + x.v.id.slice(0, 8))) : el('option', { value: '' }, 'no tool held yet'));
}
async function renderKitDepts(v) {
  admission ||= await fetch('drop/admission.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const set = api.setOf(v), deps = admission && Array.isArray(admission.departments) ? admission.departments.filter((d) => d && d.set === set) : [];
  if (!deps.length) return fill($('#g-kit-depts'), line('x', 'A card grown on your own table knows its one department: it fights alone, or in a mesh of that table.'));
  const own = new Set(domainsOf(v)), same = await myCards(set);
  fill($('#g-kit-depts'), deps.map((d) => {
    const short = d.domain.replace(set + '-', ''), held = same.find((m) => m.id !== v.id && domainsOf(m.v).includes(d.domain));
    if (own.has(d.domain)) return line('k', short, el('small', {}, 'your Kardling’s own'));
    if (held) return line('k', short, el('small', {}, 'you hold #' + pad4(held.v.serial) + (KIT.nodes.includes(held.id) ? ' · in a slot' : ' · put it in a slot')));
    if (d.admitted !== true) return line('y', short, el('a', { href: '#raids' }, 'a raid boss · strike it in Raids'));
    const n = (G.st.strikes || []).filter((x) => x.domain === d.domain && x.by === S.me.pub).length;
    return line('', short, el('button', { type: 'button', class: 'g-btn hot', disabled: KIT.busy.has(d.domain), onclick: () => nodeMint(d.domain) }, KIT.busy.has(d.domain) ? 'Searching…' : n ? 'Search again (' + (n + 1) + ')' : 'Mint a node'));
  }));
}
async function nodeMint(domain) {
  const v = await verify(api.lifeOf(KIT.card)), set = api.setOf(v), out = $('#g-kit-mint-out');
  KIT.busy.add(domain); renderKitDepts(v);
  try {
    const g = await api.groundOf(set, (t) => fill(out, el('p', { class: 'g-small' }, t)));
    const k = (G.st.strikes || []).filter((x) => x.domain === domain && x.by === S.me.pub).length, seed = strikeSeed(S.me.pub, domain, k), t0 = Date.now();
    const tick = setInterval(() => fill(out, el('p', { class: 'g-small' }, 'Search ' + (k + 1) + ' on ' + domain + ', from seed ' + seed + ' (your key fixes it) — ' + Math.round((Date.now() - t0) / 1000) + ' s')), 500);
    const w = await api.work({ op: 'search', set, own: null, domain, seed, bar: RAID_BAR / 1e6, grow: GROW });
    clearInterval(tick);
    if (!w.ok) return fill(out, el('p', { class: 'g-badt' }, 'The search could not run: ' + w.why));
    const s = await raidStrike(S.me, g, domain, k, { organ: { ok: true, fixed: w.fixed, gate: w.gate } });
    const c = s.ok ? await checkStrike(s.strike, g) : s;
    if (!c.ok) return fill(out, el('p', { class: 'g-badt' }, 'The search did not check here: ' + c.why));
    G.st.strikes = [...(G.st.strikes || []), s.strike].slice(-2000);
    saveState();
    if (s.strike.gate < RAID_BAR) {
      note('strike', { id: domain, gate: s.strike.gate, kept: false }); bleep('refused');
      return fill(out, el('p', {}, 'Search ' + (k + 1) + ' found ' + six(s.strike.gate) + ' on GATE: under the 0.6 bar, so nothing is minted. The next search starts from another seed.'));
    }
    const sealed = await sealLoot(s.strike);
    if (!sealed.ok) return fill(out, el('p', { class: 'g-badt' }, sealed.why));
    if (KIT.nodes.length < slotsOf(v).nodes) { KIT.nodes.push(sealed.id); KIT.measured = null; }
    bleep('level');
    fill(out, el('p', { class: 'g-okt' }, '★ Minted: a ' + domain + ' node, ' + six(s.strike.gate) + ' on GATE, sealed with you as its maker' + (KIT.nodes.includes(sealed.id) ? ' and put in a slot. Measure it, then equip.' : '. Your node slots are full: it waits in Cards.')));
  } catch (e) { fill(out, el('p', { class: 'g-badt' }, String(e.message || e))); }
  finally { KIT.busy.delete(domain); renderKit(); }
}
/** Kit it for me: the card of yours that lifts this Kardling most, then the next, while one lifts it and a slot is open (src/campaign.mjs) */
async function kitAuto() {
  if (!KIT.card) return;
  const v = await verify(api.lifeOf(KIT.card)), out = $('#g-kit-measure'), mine = await myCards(api.setOf(v)), others = mine.filter((m) => m.id !== v.id);
  fill(out, el('p', { class: 'g-small' }, 'Trying your ' + others.length + ' other card' + (others.length === 1 ? '' : 's') + ' of this business, one slot at a time, each measured here…'));
  const g = await api.groundFor(v), k = autoKit(v, others.map((m) => m.v), g);
  if (!k.ok) return fill(out, el('p', { class: 'g-badt' }, k.why));
  KIT.nodes = [...k.nodes]; KIT.measured = null;
  await renderKitNodes(v, slotsOf(v));
  const named = (id) => { const m = others.find((x) => x.id === id); return m ? '#' + pad4(m.v.serial) + ' · ' + m.f.department : id.slice(0, 8); };
  fill(out, el('p', { class: 'g-win ' + (k.steps.length ? 'ok' : 'draw') }, k.steps.length ? 'Kitted for you ' + six(k.gate) : 'Nothing of yours lifts it'),
    el('p', {}, 'Alone ' + six(k.alone) + (k.steps.length ? ' · lift +' + six(k.gate - k.alone) + ' · out of fold on GATE' : '')),
    el('ul', { class: 'g-lines' }, k.steps.map((s, i) => line('k', 'Step ' + (i + 1) + ' · ' + named(s.card), el('small', {}, 'adds +' + six(s.adds))))),
    el('p', { class: 'g-small g-dim' }, 'Each step took the card of yours that lifted the kitted score most; it stopped when none lifted it or the slots were full. Equip it to fight with it. Whether lifts like these hold on TEST is organ 11’s question, sealed before it was measured.'));
}
/** open a tool in its box: its own page read first for what it asked for; a page elsewhere opens in its own tab */
async function toolOpen(b) {
  const page = b.page || repoOf(b.app), box = $('#g-box'), frame = $('#g-box-frame');
  box.hidden = false; fill($('#g-box-name'), b.app); frame.removeAttribute('src');
  if (!boxable(page, location.href)) { fill($('#g-box-asked'), line('y', 'Its page is on another address, so it cannot go in a box here', el('a', { class: 'g-btn', href: page, target: '_blank', rel: 'noopener noreferrer' }, 'Open it in its own tab'))); return; }
  fill($('#g-box-asked'), line('', 'Reading what its page asked for…'));
  const html = await fetch(page).then((r) => (r.ok ? r.text() : '')).catch(() => ''), a = askedFor(html);
  if (frame.getAttribute('sandbox') !== SANDBOX.join(' ')) { fill($('#g-box-asked'), line('r', 'The box is not the box: it will not open')); return; }
  fill($('#g-box-asked'), line('k', 'In a box: scripts and forms only — never this page’s origin, a pop-up, a download or the top window'), line(a.policy ? 'k' : 'y', a.network), line(a.policy ? 'k' : 'y', a.frames), line('', a.storage), line('', 'It never moves a score: duels and raids are won by the card’s mind'));
  frame.setAttribute('src', page);
}
async function kitMeasure() {
  if (!KIT.card) return;
  const v = await verify(api.lifeOf(KIT.card)), out = $('#g-kit-measure');
  fill(out, el('p', { class: 'g-small' }, 'Fetching the records (checked by their hash) and expressing every mind here…'));
  const g = await api.groundFor(v), nodes = await Promise.all(KIT.nodes.map((c) => verify(api.lifeOf(c)))), k = kitted(v, nodes, g);
  if (!k.ok) return fill(out, el('p', { class: 'g-badt' }, k.why));
  KIT.measured = k; note('kit', { id: v.id, gate: k.gate, lift: k.lift });
  const plus = (m) => (m >= 0 ? '+' : '') + six(m);
  fill(out, el('p', { class: 'g-win ' + (k.lift > 0 ? 'ok' : 'draw') }, 'Kitted ' + six(k.gate)), el('p', {}, 'Alone ' + six(k.alone) + ' · lift ' + plus(k.lift) + ' · out of fold on ' + k.rows.toLocaleString() + ' GATE cases'),
    el('ul', { class: 'g-lines' }, line('k', 'Your Kardling', el('small', {}, 'adds ' + plus(k.own))), k.slots.map((x, i) => line(x.joined ? 'k' : 'r', 'Node ' + (i + 1) + ' · ' + (x.domains || '–'), el('small', {}, x.joined ? 'adds ' + plus(x.contribution) : x.why)))),
    el('p', { class: 'g-small g-dim' }, 'Adds: the kitted score with it, less the score without it. Whether a lift on GATE holds on TEST, cases nothing here was chosen by, is measured by organ 10, not assumed here.'));
  await renderKitNodes(v, slotsOf(v));
}
async function kitEquip() {
  if (!KIT.card) return;
  const v = await verify(api.lifeOf(KIT.card)), out = $('#g-kit-out');
  const nodes = await Promise.all(KIT.nodes.map((c) => verify(api.lifeOf(c)))), held = await heldItems(), tools = KIT.tools.map((t) => (held.find((h) => h.v.id === t) || {}).v);
  const r = await equip(S.me, v, nodes, tools);
  if (!r.ok) { bleep('refused'); return fill(out, el('p', { class: 'g-badt' }, 'Refused · ' + r.why)); }
  G.st.loadouts = { ...(G.st.loadouts || {}), [v.id]: r.loadout };
  note('equip', { id: v.id, nodes: nodes.length, tools: tools.length });
  saveState(); bleep('kept');
  fill(out, el('p', { class: 'g-okt' }, '✓ Equipped · signed by your key for this card and each node as they stand. It fights kitted in the arena now. Give a card away, level it, or move a node, and you equip again.'),
    el('a', { class: 'g-btn hot big g-next', id: 'g-kit-next', href: '#arena' }, 'Next · fight in the arena →'), el('p', { class: 'g-teach' }, 'Arena: a head-to-head eval on cases both sides’ signatures chose.'));
  soleNext(out.querySelector('.g-next'));
  renderKit();
}
async function renderKitApps() {
  const rec = await appsLoaded(), box = $('#g-kit-apps'), n = $('#g-kit-apps-note');
  for (const t of ['proven', 'works']) $('#g-kit-t-' + t).setAttribute('aria-selected', String(KIT.tier === t));
  if (!rec) { fill(n); return fill(box, line('r', 'The estate’s app records did not load.')); }
  const q = String($('#g-kit-q').value || '').trim().toLowerCase(), desc = (b) => String((rec.rows.get(b.app) || {}).desc || '');
  const all = [...rec.apps.values()].filter((b) => offered(b.app) && b.tier === KIT.tier && (!q || b.app.toLowerCase().includes(q) || desc(b).toLowerCase().includes(q))), shown = all.slice(0, 20);
  fill(box, shown.length ? shown.map((b) => line('', el('span', {}, el('b', { 'data-quote': 'sourced' }, b.app), el('small', { class: 'g-dim' }, ' ' + shownDesc(desc(b)).slice(0, 80))), el('button', { type: 'button', class: 'g-btn', onclick: () => appMint(b.app), 'aria-label': 'Mint ' + b.app + ' as a tool' }, 'Mint this tool'))) : line('x', 'No ' + KIT.tier + ' app matches that'));
  fill(n, all.length.toLocaleString() + ' ' + KIT.tier + ' app' + (all.length === 1 ? '' : 's') + (all.length > shown.length ? ' · showing ' + shown.length + ': type a name or a word to find one' : '') + ' · each passed its own CI on GitHub’s machines at the commit it names (mint-an-app’s records) · minting is free');
}
async function appMint(name) {
  const rec = await appsLoaded(), out = $('#g-kit-out');
  if (!rec) return;
  const r = await mintApp(S.me, rec.apps, name), v = r.ok ? await verifyItem(r.item, rec.apps) : r;
  if (!v.ok) return fill(out, el('p', { class: 'g-badt' }, 'Refused · ' + v.why));
  G.st.items = [...(G.st.items || []), r.item].slice(-200);
  note('item', { app: name }); saveState();
  if (KIT.card && KIT.tools.length < 2) KIT.tools.push(v.id);
  fill(out, el('p', { class: 'g-okt' }, '✓ ' + name + ' is yours: an item signed by your key, checked against its commit and the run that proved it' + (KIT.tools.includes(v.id) ? ', and in a tool slot. Equip to carry it.' : '. Your tool slots are full; it waits in your items.')));
  renderKit();
}
async function itemGive() {
  const rec = await appsLoaded(), out = $('#g-kit-give-out'), id = $('#g-kit-give-item').value, to = String($('#g-kit-give-to').value || '').trim().toLowerCase();
  const at = (G.st.items || []).findIndex((it) => it.events && it.events[0] && hashOf(it.events[0]) === id);
  if (!rec || at < 0) return fill(out, el('p', { class: 'g-badt' }, 'Pick a tool you hold.'));
  const r = await giveItem(G.st.items[at], S.me, to, rec.apps);
  if (!r.ok) { bleep('refused'); return fill(out, el('p', { class: 'g-badt' }, 'Refused · ' + r.why)); }
  G.st.items = G.st.items.map((it, k) => (k === at ? r.item : it));
  KIT.tools = KIT.tools.filter((t) => t !== id);
  note('item-give', { id }); saveState(); bleep('kept');
  const code = btoa(unescape(encodeURIComponent(JSON.stringify({ kind: 'digi.item', item: r.item }))));
  try { await navigator.clipboard.writeText(code); fill(out, el('p', { class: 'g-okt g-small' }, '✓ Handed on, signed by you. The item’s whole life is copied: send it to them.')); }
  catch { fill(out, el('p', { class: 'g-small' }, '✓ Handed on, signed by you. Send them this:'), el('textarea', { rows: 3, readonly: true, 'aria-label': 'The item, to send' }, code)); }
  renderKit();
}
/** take an item someone handed to this key: its whole life, checked here, held by this key */
async function itemTake() {
  const rec = await appsLoaded(), out = $('#g-kit-give-out'), box = $('#g-kit-take-code');
  let o = null;
  try { o = JSON.parse(decodeURIComponent(escape(atob(String(box.value || '').trim())))); } catch { o = null; }
  if (!rec || !o || o.kind !== 'digi.item') return fill(out, el('p', { class: 'g-badt' }, 'That is not a Kardlings item.'));
  const v = await verifyItem(o.item, rec.apps);
  if (!v.ok) { bleep('refused'); return fill(out, el('p', { class: 'g-badt' }, 'Refused · ' + v.why)); }
  if (v.owner !== S.me.pub) return fill(out, el('p', { class: 'g-badt' }, 'Refused · it is held by another key, not yours'));
  G.st.items = [...(G.st.items || []).filter((it) => !(it.events && it.events[0] && hashOf(it.events[0]) === v.id)), o.item].slice(-200);
  note('item', { app: v.body.app }); saveState(); bleep('kept'); box.value = '';
  fill(out, el('p', { class: 'g-okt' }, '✓ ' + v.body.app + ' is yours: its whole life checked here, handed to your key'));
  renderKit();
}


// ── play: the world bosses, for a party ───────────────────────────────────────────────────────────────────────────
// A whole business at the best score a lone genesis search reached on it, plus 0.010. The party is your own cards of that
// business and the members friends send you, each consenting for this raid by its owner's signature; it is assembled as a
// mesh, and its receipt names every fielded card, its owner and its measured share. Anyone holding the cards and the
// consents strikes again to the very same receipt.
const P = { friends: {}, busy: new Set() };
async function renderWorld() {
  admission ||= await fetch('drop/admission.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const bosses = worldBossesOf(admission), st = worldStanding(bosses, (G.st.clears || []).map((c) => c.clear)), box = $('#g-pt-bosses');
  if (!bosses.length) return fill(box, el('p', { class: 'g-dim' }, 'The admission record did not load.'));
  const mine = await myCards(null);
  fill(box, bosses.map((b) => {
    const r = st.raids[b.set], have = mine.filter((m) => api.setOf(m.v) === b.set).length, friends = (P.friends[b.set] || []).length, last = [...(G.st.clears || [])].reverse().find((c) => c.clear.set === b.set);
    const go = el('button', { type: 'button', class: 'g-btn hot', disabled: P.busy.has(b.set) || !(have + friends), onclick: () => partyGo(b) }, P.busy.has(b.set) ? 'Striking…' : 'Strike together');
    return el('div', { class: 'g-boss' + (r.fallen ? ' down' : '') }, el('h3', {}, SETS[b.set] ? SETS[b.set].title : b.set),
      el('div', { class: 'g-hp', role: 'img', 'aria-label': 'Health ' + six(r.hp) + ' from the bar' }, el('i', { style: 'width:' + Math.min(100, Math.round(r.hp / 400)) + '%' })),
      el('p', { class: 'g-small' }, r.fallen ? 'Fallen after ' + r.first.after + ' party strike' + (r.first.after === 1 ? '' : 's') + ' · ' + six(r.first.gate) + ' by ' + r.first.members + ' cards of ' + r.first.owners + ' owner' + (r.first.owners === 1 ? '' : 's') : 'Best party ' + six(r.best) + ' · the bar ' + six(b.bar) + ' · ' + six(r.hp) + ' to go'),
      el('p', { class: 'g-small g-dim' }, 'Best lone genesis search ' + six(b.best) + ' · ' + b.departments + ' departments · your cards ' + have + (friends ? ' · friends’ ' + friends : '') + ' · party strikes ' + r.strikes),
      el('div', { class: 'g-row' }, go, el('button', { type: 'button', class: 'g-btn', disabled: !have, onclick: () => partyCopy(b) }, 'Copy my party code'), el('button', { type: 'button', class: 'g-btn', onclick: () => partyAdd(b) }, 'Add a friend’s members'),
        last ? el('button', { type: 'button', class: 'g-btn cy', onclick: () => partyAgain(b) }, 'Strike it again') : null));
  }));
}
async function partyGo(b) {
  const out = $('#g-pt-out');
  P.busy.add(b.set); renderWorld();
  try {
    const g = await api.groundOf(b.set, (t) => fill(out, el('p', { class: 'g-small' }, t)));
    const cands = [];
    for (const m of await myCards(b.set)) cands.push({ v: m.v, consent: (await consent(S.me, m.v, partyOf(b.set))).consent, life: api.lifeOf(m.id) });
    cands.push(...(P.friends[b.set] || []));
    fill(out, el('p', { class: 'g-small' }, 'Assembling ' + cands.length + ' card' + (cands.length === 1 ? '' : 's') + ': each must answer here and beat a coin on GATE, one per department…'));
    const r = await partyStrike(b, cands.map((c) => ({ v: c.v, consent: c.consent })), g);
    if (!r.ok) { bleep('refused'); return fill(out, el('p', { class: 'g-badt' }, 'The party could not strike: ' + r.why)); }
    G.st.clears = [...(G.st.clears || []), { clear: r.clear, cards: cands.map((c) => ({ card: c.life, consent: c.consent })) }].slice(-40);
    note('party', { set: b.set, gate: r.clear.gate, cleared: r.cleared });
    saveState();
    const vOf = new Map(cands.map((c) => [c.v.id, c.v]));
    fill(out, el('p', { class: r.cleared ? 'g-okt' : '' }, (r.cleared ? '★ The world boss falls: the party scored ' : 'The party scored ') + six(r.clear.gate) + ' on GATE against the bar ' + six(b.bar) + ' (its best card alone ' + six(r.best) + ')'),
      el('ul', { class: 'g-lines' }, r.clear.members.map((x) => line('k', '#' + pad4(vOf.get(x.card).serial) + ' ' + facts(vOf.get(x.card)).department, el('small', {}, (x.owner === S.me.pub ? 'yours' : api.short(x.owner)) + ' · share ' + x.share.toLocaleString())))),
      el('p', { class: 'g-small g-dim' }, 'Shares are parts of a million: what each member adds to the party, measured by leaving it out · ' + r.clear.members.length + ' fielded, ' + (r.mesh.members.length - r.clear.members.length) + ' on the bench · the receipt re-runs from the cards and the consents'));
    bleep(r.cleared ? 'level' : 'refused');
  } catch (e) { fill(out, el('p', { class: 'g-badt' }, String(e.message || e))); }
  finally { P.busy.delete(b.set); renderWorld(); }
}
async function partyCopy(b) {
  const out = $('#g-pt-out'), members = [];
  for (const m of await myCards(b.set)) members.push({ card: api.lifeOf(m.id), consent: (await consent(S.me, m.v, partyOf(b.set))).consent });
  const code = btoa(unescape(encodeURIComponent(JSON.stringify({ kind: 'digi.party', set: b.set, members }))));
  try { await navigator.clipboard.writeText(code); fill(out, el('p', { class: 'g-okt g-small' }, 'Copied your ' + members.length + ' card' + (members.length === 1 ? '' : 's') + ', each with your consent for this raid only. A friend adds them to their party; every card is checked on arrival.')); }
  catch { const t = $('#g-pt-code'); t.hidden = false; t.value = code; fill(out, el('p', { class: 'g-small' }, 'Copy the text above and send it.')); }
}
async function partyAdd(b) {
  const t = $('#g-pt-code'), out = $('#g-pt-out');
  if (t.hidden || !t.value.trim()) { t.hidden = false; t.value = ''; t.focus(); return fill(out, el('p', { class: 'g-small' }, 'Paste a friend’s party code in the box, then press Add a friend’s members again.')); }
  let o = null;
  try { o = JSON.parse(decodeURIComponent(escape(atob(t.value.trim())))); } catch { o = null; }
  if (!o || o.kind !== 'digi.party' || o.set !== b.set || !Array.isArray(o.members)) return fill(out, el('p', { class: 'g-badt' }, 'That is not a party code for ' + (SETS[b.set] ? SETS[b.set].title : b.set) + '.'));
  let added = 0, refused = 0;
  const have = new Set((P.friends[b.set] || []).map((f) => f.v.id));
  for (const x of o.members.slice(0, 12)) {
    const v = await verifyLife(x.card);
    if (!v.ok || v.owner === S.me.pub || have.has(v.id)) { refused++; continue; }
    await api.keep(x.card);
    P.friends[b.set] = [...(P.friends[b.set] || []), { v, consent: x.consent, life: x.card }]; have.add(v.id); added++;
  }
  t.value = ''; t.hidden = true;
  fill(out, el('p', { class: added ? 'g-okt' : 'g-badt' }, added + ' card' + (added === 1 ? '' : 's') + ' added to your party, each checked here' + (refused ? ' · ' + refused + ' refused' : '') + '. Their consents are checked when the party strikes.'));
  renderWorld();
}
async function partyAgain(b) {
  const out = $('#g-pt-out'), last = [...(G.st.clears || [])].reverse().find((c) => c.clear.set === b.set);
  if (!last) return;
  const g = await api.groundOf(b.set, (t) => fill(out, el('p', { class: 'g-small' }, t))), cands = [];
  for (const x of last.cards) { const v = await verifyLife(x.card); cands.push({ v, consent: x.consent }); }
  const r = await checkClear(last.clear, b, cands, g);
  $('#g-pt-out').append(el('p', { class: r.ok ? 'g-okt' : 'g-badt' }, r.ok ? '✓ Struck again here: the very same receipt' : '✗ ' + r.why));
}


// ── proof: your record, in the estate's contribution ledger ──────────────────────────────────────────────────────
// The record is the estate's economy (src/earn.mjs): it begins from the estate's genesis, takes the drop's release of
// every genesis card you field, your own release of every card and app tool you made, and a value for every card of
// every party strike you ran — each party struck again here first. Nothing counts twice; the switch is off.
const REC = { busy: false };
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const dropLine = (id) => (S.manifest.first.card === id ? { ...S.manifest.first, serial: 1 } : S.manifest.cards.find((c) => c.card === id));
async function recordUpdate() {
  if (REC.busy) return;
  const out = $('#g-rec-out');
  REC.busy = true; $('#g-rec-go').disabled = true;
  try {
    let ledger = G.st.record;
    if (!ledger) { const b = await begin(); if (!b.ok) return fill(out, el('p', { class: 'g-badt' }, b.why)); ledger = b.ledger; }
    const at = nowIso(), rec = await appsLoaded(), genomes = new Map(), items = new Map(), clears = new Map(), entries = [], drops = new Set();
    const wantDrop = (id) => { if (dropLine(id) && !ledger.assets['digi:' + id]) drops.add(id); };
    // the cards you hold: the drop's release of each genesis card, your own release of each card you made (parents first)
    const held = await holdings(), made = [];
    for (const h of held) {
      if (h.v.maker === S.maker.pub) wantDrop(h.id);
      else if (h.v.maker === S.me.pub) { const text = api.lifeOf(h.id).genome; genomes.set('digi:' + h.id, text); made.push({ text, gen: h.v.generation, parents: h.v.genome.parents }); }
    }
    for (const m of made) for (const p of m.parents) wantDrop(p);
    // every party strike you ran, struck again here before a single value of it is recorded
    for (const c of G.st.clears || []) {
      const digest = await sha256Of(c.clear), job = jobOf(c.clear.set, digest);
      if (Object.keys(ledger.values).some((k) => k.endsWith('|' + job))) continue;
      fill(out, el('p', { class: 'g-small' }, 'Striking the ' + c.clear.set + ' party again before its values are recorded…'));
      const g = await api.groundOf(c.clear.set), boss = worldBossesOf(admission || {}).find((b) => b.set === c.clear.set), cands = [];
      for (const x of c.cards) cands.push({ v: await verifyLife(x.card), consent: x.consent });
      if (!boss || !(await checkClear(c.clear, boss, cands, g)).ok) continue;
      clears.set(digest, c.clear);
      for (const x of c.clear.members) wantDrop(x.card);
      entries.push(...(await valuesOfClear(c.clear, at)).entries);
    }
    const front = [];
    for (const id of drops) front.push((await releaseOfDrop(dropLine(id))).entry);
    for (const m of made.sort((a, b) => a.gen - b.gen)) { const r = await releaseOfCard(S.me, m.text, at); if (r.ok) front.push(r.entry); }
    for (const it of G.st.items || []) {
      const v = rec ? await verifyItem(it, rec.apps) : { ok: false };
      if (!v.ok || v.maker !== S.me.pub) continue;
      items.set('item:' + v.id, it);
      const r = await releaseOfItem(S.me, it, rec.apps, at);
      if (r.ok) front.push(r.entry);
    }
    const gate = await gateFor({ manifest: S.manifest, genomes, items, apps: rec ? rec.apps : null, clears });
    const r = await add(ledger, [...front, ...entries], gate);
    G.st.record = r.ledger; note('record', { added: r.added }); saveState();
    fill(out, el('p', { class: r.refused.length ? '' : 'g-okt' }, '✓ ' + r.added + ' new entr' + (r.added === 1 ? 'y' : 'ies') + ' recorded, each through its gate here · ' + r.skipped + ' already held'),
      r.refused.length ? el('p', { class: 'g-small g-dim' }, r.refused.length + ' not recorded — ' + [...new Set(r.refused)].slice(0, 3).join(' · ') + (r.refused.some((w) => /is not recorded here/.test(w)) ? ' (a friend’s own card is released in their record, not yours)' : '')) : null);
    renderRecord();
  } catch (e) { fill(out, el('p', { class: 'g-badt' }, String(e.message || e))); }
  finally { REC.busy = false; $('#g-rec-go').disabled = false; }
}
function renderRecord() {
  const l = G.st.record, box = $('#g-rec-stats');
  if (!l) return fill(box, el('p', { class: 'g-dim g-small' }, 'Nothing recorded on this device yet. Mint a node, mint a tool, or strike a world boss with a party, then bring the record up to date.'));
  const by = (t) => l.log.filter((x) => x.entry.type === t).length, c = credits(l), mine = c.ok ? c.credits[S.me.pub] || '0' : '0', pool = 1000000, a = allocate(l, { sandbox: true, pool });
  fill(box, el('dl', { class: 'g-stats' }, [['Entries', l.log.length], ['Releases', by('release')], ['Values measured', by('value')], ['Your credit', BigInt(mine) === 0n ? '0' : (Number(BigInt(mine)) / (c.scale || 1)).toLocaleString()], ['Sandbox part of ' + pool.toLocaleString(), a.ok ? (a.parts[S.me.pub] || 0).toLocaleString() : '–'], ['The switch', l.switch === null ? 'off' : 'on']].flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, String(v))])),
    el('p', { class: 'g-small g-dim' }, 'Head ' + l.head.slice(0, 16) + '… · the estate’s demo economy (its genesis ' + l.log[0].entry.by.slice(0, 8) + '…) · units are internal contribution units, not money · a sandbox part shows how a pool would split by this record; nothing is allocated'));
}
async function recordReplay() {
  const out = $('#g-rec-out'), l = G.st.record;
  if (!l) return;
  const rec = await appsLoaded(), genomes = new Map(), items = new Map(), clears = new Map();
  for (const h of await holdings()) if (h.v.maker === S.me.pub) genomes.set('digi:' + h.id, api.lifeOf(h.id).genome);
  for (const it of G.st.items || []) { const v = rec ? await verifyItem(it, rec.apps) : { ok: false }; if (v.ok) items.set('item:' + v.id, it); }
  for (const c of G.st.clears || []) clears.set(await sha256Of(c.clear), c.clear);
  const t0 = performance.now(), r = await replayLedger(l.log, { gate: await gateFor({ manifest: S.manifest, genomes, items, apps: rec ? rec.apps : null, clears }) });
  fill(out, el('p', { class: r.ok && r.ledger.head === l.head ? 'g-okt' : 'g-badt' }, r.ok ? (r.ledger.head === l.head ? '✓ Replayed here from nothing in ' + Math.round(performance.now() - t0) + ' ms: ' + l.log.length + ' entries, every signature and every gate holds' : '✗ It replays to another head') : '✗ ' + r.why));
}
function recordSave() {
  if (!G.st.record) return;
  api.download(new TextEncoder().encode(JSON.stringify({ schema: G.st.record.schema, note: 'A Kardlings player’s contribution record: the estate’s demo economy, every entry gated where it was made. Internal units, not money; the switch is off.', head: G.st.record.head, log: G.st.record.log }, null, 1)), 'digi-record-' + G.st.record.head.slice(0, 8) + '.json');
}
const sha256Of = (x) => kccSha(kccCanon(x));

// ── mesh, send, proof ────────────────────────────────────────────────────────────────────────────────────────────────
function renderMesh() {
  const box = $('#g-meshslots');
  if (!S.mesh) return fill(box, el('p', { class: 'g-dim' }, 'Pick a business and assemble its mesh: each department’s best-proven card is fielded, the rest wait on the bench. Hospital forms no mesh — every department is under the bar.'));
  const { m } = S.mesh;
  fill(box, m.members.filter((x) => x.joined).map((x) => {
    const c = el('canvas', { class: 'g-card2', width: W, height: H, 'aria-hidden': 'true' }), ring = el('div', { class: 'g-ring' }, c);
    show(c, ring, api.lifeOf(x.card));
    return el('div', { class: 'g-slot' }, el('span', {}, String(x.domains || '').replace(/^\w+-/, '')), ring, el('span', { class: 'g-goldt g-small' }, '#' + pad4((S.reg.cards[x.card] || {}).serial || 0)), el('b', { class: 'g-hot', style: 'font-weight:400' }, 'share ' + (x.share != null ? x.share.toLocaleString() : '–')), el('span', { class: 'g-tag ok' }, 'consent signed'));
  }), el('p', { class: 'g-small g-dim', style: 'flex-basis:100%' }, 'Shares in parts of a million · sum 1,000,000 · bench ' + (m.members.length - m.fielded.length) + ' · only scores cross, never records · credits are accounting, not money'));
}
async function renderSend() {
  const id = S.sel && S.reg.cards[S.sel] ? S.sel : api.mine()[0];
  if (!id) return fill($('#g-send-which'), 'Card me first: then you hold a card to send.');
  if (id !== S.sel) await api.select(id);
  const v = await show($('#g-send-card'), $('#g-send-ring'), api.lifeOf(id));
  if (v) fill($('#g-send-which'), facts(v).title + ' #' + pad4(v.serial) + ' · ' + whose(v));
}
async function renderProof() {
  const m = S.manifest;
  fill($('#g-drop-stats'), [['Genesis', m.total.toLocaleString() + ' cards'], ['Departments', String(new Set(m.cards.map((c) => c.domain)).size)], ['Decoder', m.decoder.hash.slice(0, 8) + '…' + m.decoder.hash.slice(-4)], ['Log head', m.log.head.slice(0, 8) + '…' + m.log.head.slice(-4)], ['Rules sealed', 'before the 1st search'], ['Maker key', m.demo ? 'public demo key' : 'its owner’s']].flatMap(([k, x]) => [el('dt', {}, k), el('dd', {}, x)]));
  G.lifeId ||= featured();
  await renderLife();
  renderOrgans();
  renderRecord();
}
async function renderLife() {
  const d = api.lifeOf(G.lifeId);
  if (!d) return;
  const v = await verify(d);
  fill($('#g-life-name'), v.ok ? facts(v).title + ' #' + pad4(v.serial) : G.lifeId);
  const t = $('#g-life');
  t.replaceWith(Object.assign(lifeTable(d), { id: 'g-life' }));
  fill($('#g-chain'), ['CRC', 'Band', 'Seals', 'Signatures', 'Registry', 'Pixels'].map((s) => el('li', {}, s)));
  fill($('#g-verify-ms'));
}
async function verifyChain() {
  const id = G.lifeId, d = api.lifeOf(id), steps = ['CRC', 'Band', 'Seals', 'Signatures', 'Registry', 'Pixels'], t0 = performance.now();
  const png = await cardOf(d, api.paint), r = await readCard(png.png, api.paint);
  const fail = r.ok ? -1 : /PNG|chunk|picture|CRC/.test(r.why) ? 0 : /band|dossier/.test(r.why) ? 1 : /genome|seal/.test(r.why) ? 2 : /face|pixel/.test(r.why) ? 5 : 3;
  const s = r.ok ? standing(S.reg, d, r.id) : null, regOk = s && s.standing === 'current';
  const ms = Math.round(performance.now() - t0);
  fill($('#g-chain'), steps.map((x, k) => el('li', { class: fail === k || (k === 4 && r.ok && !regOk) ? 'bad' : fail === -1 || k < fail ? 'ok' : '' }, x + (fail === k || (k === 4 && r.ok && !regOk) ? ' ✗' : fail === -1 || k < fail ? ' ✓' : ''))));
  fill($('#g-verify-ms'), r.ok ? (regOk ? 'Every check passed here in ' + ms + ' ms' : 'The card checks; the registry here holds another life of it (' + (s && s.standing) + ')') : 'Refused: ' + r.why);
  if (r.ok && regOk) bleep('kept'); else bleep('refused');
}
let organs = null;
async function renderOrgans() {
  organs ||= await Promise.all(Array.from({ length: ORGANS }, (_, i) => i + 1).map(async (k) => {
    const [v, p] = await Promise.all(['verdict', 'prereg'].map((f) => fetch('data/organ-' + k + '/' + f + '.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)));
    return { k, name: p ? p.organ : 'organ ' + k, blind: !(p && p.disclosure), held: v ? v.verdicts.filter((x) => x.pass).length : 0, all: v ? v.verdicts.length : 0 };
  }));
  const held = organs.reduce((n, o) => n + o.held, 0), all = organs.reduce((n, o) => n + o.all, 0);
  fill($('#g-organs'), organs.map((o) => line(o.held === o.all ? 'k' : 'y', o.k + ' · ' + (SHOWN_AS[o.k] ? SHOWN_AS[o.k] + ' (sealed as ‘' + String(o.name).split(/[:—]/)[0].trim() + '’)' : String(o.name).split(/[:—]/)[0].trim().slice(0, 28)) + (o.blind ? '' : ' · not blind'), el('small', {}, o.held + '/' + o.all))), line('m', held + ' of ' + all + ' sealed rules held', el('small', {}, (all - held) + ' failed · kept on show')));
}
async function find() {
  const q = ($('#g-find').value || '').trim().toLowerCase(), out = $('#g-find-out');
  let id = null;
  if (/^#?\d{1,4}$/.test(q)) { const n = Number(q.replace('#', '')); id = n === 1 ? S.manifest.first.card : (S.manifest.cards.find((c) => c.serial === n) || {}).card || Object.keys(S.reg.cards).find((k) => S.reg.cards[k].serial === n && S.reg.cards[k].maker === S.me.pub); }
  else if (/^[0-9a-f]{64}$/.test(q)) {
    const owned = Object.entries(S.reg.cards).filter(([, c]) => c.owner === q);
    fill(out, el('p', { class: 'g-small' }, owned.length + ' card' + (owned.length === 1 ? '' : 's') + ' held by that key in this device’s registry' + (owned.length ? ':' : '')), el('p', { class: 'g-row' }, owned.slice(0, 12).map(([k, c]) => el('button', { type: 'button', onclick: () => { G.lifeId = k; renderLife(); } }, '#' + pad4(c.serial)))));
    return;
  } else if (/^[0-9a-f]{4,16}$/.test(q)) id = Object.keys(S.reg.cards).find((k) => k.startsWith(q));
  if (!id) return fill(out, el('p', { class: 'g-badt g-small' }, 'Nothing in this device’s registry matches that.'));
  G.lifeId = id; fill(out); renderLife();
}

// ── score kept from what happened ────────────────────────────────────────────────────────────────────────────────────
function onEvent({ detail: e }) {
  switch (e.type) {
    case 'card': note('card', { id: e.id }); rememberPub(); break;
    case 'search': {
      const s = (G.st.searches[e.id] ||= { best: -1e9, tried: 0 });
      s.tried++; if (e.after != null && e.before != null) s.best = Math.max(s.best, e.after - e.before);
      note('search', { id: e.id, kept: !!e.kept }); break;
    }
    case 'level': note('level', { id: e.id }); bleep('level'); break;
    case 'birth': if (e.kept) { G.st.births.kept++; G.st.done.breed = true; note('birth', { id: e.id, kept: true }); bleep('kept'); } else { G.st.births.refused++; note('birth', { kept: false }); bleep('refused'); } break;
    case 'opened': if (!e.ok) { G.st.refused++; note('refused', { what: 'card' }); bleep('refused'); $('#g-inbox-box').hidden = true; } else inboxFlip(e.id); break;
    case 'refused': G.st.refused++; note('refused', { what: e.what }); break;
    case 'minted': if (e.ok) { G.st.done.own = true; note('minted', { id: e.id }); bleep('kept'); } else note('minted', { ok: false }); break;
    case 'drop': if (e.ok) { G.st.done.drop = true; saveState(); fill($('#g-rerun-out'), 'it re-runs · ' + e.ms + ' ms'); } else fill($('#g-rerun-out'), 'it did not re-run'); break;
    case 'key': renderTop(); renderKeep(); rememberPub(); if (e.restored && api.mine().length && G.screen === 'first') go('estate'); break;
    case 'working': { const b = $('#g-work'); if (b) { b.textContent = e.on ? 'Stop working' : 'Work overnight'; b.setAttribute('aria-pressed', String(!!e.on)); } break; }
    case 'select': if (G.screen === 'cards') renderInspect(); break;
    case 'mesh': if (G.screen === 'mesh') renderMesh(); break;
    default: break;
  }
  if (G.screen && ['estate', 'base'].includes(G.screen) && ['level', 'birth', 'card', 'minted', 'key'].includes(e.type)) render(G.screen);
  else renderTop();
}

// ── the view itself: classic or game, the chrome, plain text, sound, the keys ────────────────────────────────────────
function toClassic(remember, at) {
  if (remember) store.set('digi-view', 'classic');
  document.documentElement.classList.remove('game');
  $('#g-classic-bar').hidden = false;
  if (at) { const n = document.getElementById(at); if (n) n.scrollIntoView(); }
}
function toGame() {
  store.set('digi-view', 'game');
  document.documentElement.classList.add('game');
  $('#g-classic-bar').hidden = true;
  go(api.mine().length ? 'estate' : 'first');
}
function wire() {
  const on = (s, ev, fn) => { const n = $(s); if (n) n.addEventListener(ev, fn); };
  addEventListener('digi', onEvent);
  addEventListener('hashchange', () => { if (document.documentElement.classList.contains('game')) route(); else if (!CLASSIC.includes((location.hash || '').slice(1))) { /* the classic view scrolls itself */ } });
  on('#g-first-cardme', 'click', firstCard);
  on('#g-cardme', 'click', async () => { const id = await api.cardMe({ quiet: true }); if (id) bootCard(id); });
  on('#g-boot', 'click', () => { const id = featured(); if (id) bootCard(id); });
  on('#g-boot-again', 'click', () => { if (S.sel) bootCard(S.sel); });
  on('#g-eval', 'click', () => { go('evals'); runEval(); });
  on('#g-eval-run', 'click', runEval);
  on('#g-save-key', 'click', async () => { await api.saveKeyFile(); renderKeep(); renderTop(); });
  on('#g-a-boot', 'click', () => bootCard(S.sel));
  on('#g-a-eval', 'click', () => { go('evals'); runEval(); });
  on('#g-a-train', 'click', async () => { tab = 'reruns'; renderTabs(); await api.actLevel(); renderInspect(); });
  on('#g-a-breed', 'click', () => { FUS.a = S.sel; FUS.b = null; FUS.last = null; location.hash = '#fusion'; });
  on('#g-fu-a', 'change', () => { FUS.a = $('#g-fu-a').value || null; FUS.b = null; FUS.last = null; fill($('#g-fu-out')); renderFusion(); });
  on('#g-fu-b', 'change', () => { FUS.b = $('#g-fu-b').value || null; FUS.last = null; fill($('#g-fu-out')); renderFusion(); });
  on('#g-fu-go', 'click', fusionGo);
  on('#g-a-skin', 'click', async () => { await api.actSkin(); renderInspect(); });
  on('#g-a-verify', 'click', () => api.actVerify());
  on('#g-a-png', 'click', () => api.actDownload());
  on('#g-a-share', 'click', async () => {
    const d = api.lifeOf(S.sel), v = await verify(d), png = await cardOf(d, api.paint), file = new File([png.png], 'digi-' + pad4(v.serial) + '-' + v.id + '.png', { type: 'image/png' });
    const text = facts(v).title + ' #' + pad4(v.serial) + ' · a Kardling card · open it and every claim re-runs: ' + location.origin + location.pathname + '#send';
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } catch { return; }
    api.download(png.png, file.name);
  });
  on('#g-ar-mine', 'change', arenaSides); on('#g-ar-foe', 'change', showFoe); on('#g-ar-own', 'change', showFoe);
  on('#g-ar-t-drop', 'click', () => arenaTab('drop')); on('#g-ar-t-mine', 'click', () => arenaTab('mine')); on('#g-ar-t-friend', 'click', () => arenaTab('friend'));
  on('#g-ar-fight', 'click', arenaFight); on('#g-ar-rerun', 'click', arenaRerun);
  on('#g-ar-receipt', 'click', () => { if (A.last) api.download(new TextEncoder().encode(JSON.stringify({ kind: 'digi.duel', receipt: A.last.receipt, challenge: A.last.signed.challenge, accept: A.last.signed.accept, loadouts: { a: A.last.sides.a.loadout, b: A.last.sides.b.loadout } }, null, 1)), 'digi-duel-' + A.last.receipt.seed.slice(0, 8) + '.json'); });
  on('#g-kit-card', 'change', () => { KIT.card = null; S.sel = $('#g-kit-card').value; renderKit(); });
  on('#g-kit-measure-go', 'click', kitMeasure); on('#g-kit-equip', 'click', kitEquip);
  on('#g-kit-t-proven', 'click', () => { KIT.tier = 'proven'; renderKitApps(); }); on('#g-kit-t-works', 'click', () => { KIT.tier = 'works'; renderKitApps(); });
  on('#g-kit-q', 'input', () => renderKitApps());
  on('#g-kit-auto', 'click', kitAuto);
  on('#g-ar-watch', 'click', arenaWatch);
  on('#g-box-close', 'click', () => { $('#g-box-frame').removeAttribute('src'); $('#g-box').hidden = true; });
  on('#g-tn-set', 'change', () => renderTournament());
  on('#g-cp-pick', 'change', () => renderCampaign());
  on('#g-tk-card', 'change', () => { TK.id = $('#g-tk-card').value || null; fill($('#g-tk-out')); $('#g-tk-rc-box').hidden = true; renderTalker(); });
  on('#g-tk-ask', 'click', () => talkerAsk());
  on('#g-gd-join', 'click', () => guildSign('join')); on('#g-gd-leave', 'click', () => guildSign('leave')); on('#g-gd-add', 'click', guildAdd); on('#g-gd-all', 'click', guildAll);
  on('#g-tk-q', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); talkerAsk(); } });
  on('#g-kit-give', 'click', itemGive); on('#g-kit-take', 'click', itemTake);
  on('#g-rec-go', 'click', recordUpdate); on('#g-rec-replay', 'click', recordReplay); on('#g-rec-save', 'click', recordSave);
  on('#g-ar-copy', 'click', arenaCopy); on('#g-ar-paste', 'click', arenaPaste);
  on('#g-rd-share', 'click', raidShare); on('#g-rd-import', 'click', raidImport);
  const toTab = (t) => () => { tab = t; renderTabs(); };
  on('#g-tab-rules', 'click', toTab('rules')); on('#g-tab-reruns', 'click', toTab('reruns')); on('#g-tab-life', 'click', toTab('life'));
  on('#g-work', 'click', () => api.workOvernight());
  on('#g-snapshot', 'click', shareSnapshot); on('#g-plot', 'click', plotTap);
  on('#g-rerun', 'click', () => api.rerunDrop());
  on('#g-verify', 'click', verifyChain);
  on('#g-find-go', 'click', find); on('#g-find', 'keydown', (e) => { if (e.key === 'Enter') find(); });
  on('#g-classic', 'click', () => toClassic(true));
  on('#g-back', 'click', toGame);
  on('#g-ui-theme', 'click', () => { const r = document.documentElement, ui = r.dataset.ui === 'blockcraft' ? 'synthwave' : 'blockcraft'; if (ui === 'blockcraft') r.dataset.ui = 'blockcraft'; else delete r.dataset.ui; store.set('digi-ui', ui); setK('g-ui-name', ui); });
  on('#g-plain', 'click', () => { const p = document.documentElement.classList.toggle('plain'); store.set('digi-plain', p ? '1' : '0'); setK('g-plain', p ? 'on' : 'off'); $('#g-plain').setAttribute('aria-pressed', String(p)); });
  on('#g-tilt', 'click', () => { const t = document.documentElement.classList.toggle('tilt'); store.set('digi-tilt', t ? '1' : '0'); setK('g-tilt', t ? 'on' : 'off'); $('#g-tilt').setAttribute('aria-pressed', String(t)); });
  // the tilt, if chosen and motion is welcome: the card leans toward the pointer, a few degrees, the PNG itself untouched
  addEventListener('pointermove', (e) => {
    if (!document.documentElement.classList.contains('tilt') || calm()) return;
    const ring = e.target && e.target.closest && e.target.closest('.g-ring');
    $$('.g-ring.leaning').forEach((r) => { if (r !== ring) { r.classList.remove('leaning'); r.style.transform = ''; } });
    if (!ring) return;
    const b = ring.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
    ring.classList.add('leaning'); ring.style.transform = 'perspective(900px) rotateY(' + (x * 8).toFixed(1) + 'deg) rotateX(' + (-y * 8).toFixed(1) + 'deg)';
  });
  on('#g-sound', 'click', () => { G.sound = !G.sound; store.set('digi-sound', G.sound ? '1' : '0'); setK('g-sound', G.sound ? 'on' : 'off'); $('#g-sound').setAttribute('aria-pressed', String(G.sound)); bleep('boot'); });
  on('#g-install', 'click', async () => { if (!G.install) return; G.install.prompt(); const c = await G.install.userChoice.catch(() => null); if (!c || c.outcome !== 'accepted') store.set('digi-install', 'no'); $('#g-install').hidden = true; G.install = null; });
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); G.install = e; if (G.grown.size) offerInstall(); });
  addEventListener('keydown', (e) => {
    if (!document.documentElement.classList.contains('game') || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
    if (/^[1-8]$/.test(e.key)) { go(DOCK[Number(e.key) - 1]); e.preventDefault(); }
    else if (e.key === 'Escape') { G.skip = true; if (G.screen !== 'boot') go('base'); }
  });
  addEventListener('pagehide', () => { G.st.seen = new Date().toISOString(); saveState(); });
}
/** the dock wears PixelWhisperer's own icons */
const DOCK_ICON = { arena: 'evals' };   // Play holds the arena, the raids and the evals: it wears the evals icon
function dockIcons() { for (const a of $$('#g-dock a')) { const icon = UI_ICONS[a.dataset.go] || UI_ICONS[DOCK_ICON[a.dataset.go]]; if (icon && !a.querySelector('canvas')) a.prepend(iconCanvas(icon, 2, '#2be8ff')); } }
async function start() {
  dockIcons(); paintLogo();
  wireInfo();
  if (store.get('digi-plain') === '1') { document.documentElement.classList.add('plain'); setK('g-plain', 'on'); }
  if (store.get('digi-sound') === '1') { G.sound = true; setK('g-sound', 'on'); }
  if (store.get('digi-tilt') === '1') { document.documentElement.classList.add('tilt'); setK('g-tilt', 'on'); }
  setK('g-ui-name', document.documentElement.dataset.ui === 'blockcraft' ? 'blockcraft' : 'synthwave');
  if (!document.documentElement.classList.contains('game')) $('#g-classic-bar').hidden = false;
  wire();
  // the first screen shows at once, its button waiting while the drop replays here; a browser that cannot sign gets the
  // classic page, which says why
  if (document.documentElement.classList.contains('game')) $$('section[data-screen]').forEach((s) => s.classList.toggle('on', s.dataset.screen === 'first'));
  addEventListener('digi', (e) => { if (e.detail.type === 'failed') toClassic(false, 'top'); });
  await ready;
  await loadState();
  const b = $('#g-first-cardme'); b.disabled = false;
  fill($('#g-first-status'), S.manifest ? S.manifest.total.toLocaleString() + ' genesis cards replayed and checked here' : 'The drop could not be checked here: see the classic view');
  route();
}
start();
