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
import { auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { SETS } from '../src/data.mjs';
import { standing, hashOf } from '../src/registry.mjs';
import { tally } from '../src/mesh.mjs';
import { THEMES, paintArt } from '../vendor/pixelwhisperer/kards/kardart.mjs';
import { UI_ICONS, DATASET_ICONS, identicon as keyFace } from '../vendor/pixelwhisperer/kards/ui.mjs';
import { paintEstate, tilesFor } from '../vendor/pixelwhisperer/kards/estate.mjs';
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
  opslog: 'What your cards did since your last visit, and the one thing worth doing next.',
  evals: 'An eval is one real case the card has never seen: its answer, then what really happened. Optional; skipping a day loses nothing.',
  missions: 'Things worth trying. They earn titles — nothing else, never money.',
  registry: 'This device’s ordered record of every card’s life. It is what stops a card being given away twice.',
  forms: 'The shapes a DIGI takes. Scorer (decisions) is live; Talker, Swarm and Router are coming, and show here only once they are proven.',
  mint: 'Make a card from your own table: a CSV export with a yes/no column. Your rows never leave this device. If its mind does not reach 0.6, nothing is minted.',
  skins: 'A skin changes the picture, never the mind. It is signed into the card’s life, so any reader redraws it.',
  estate: 'One block for every card you hold. More cards open more tiles. It is never sold and never ranked.',
  overnight: 'While this page stays open, your cards search for levels. A level is kept only after it re-runs; until then nothing changes.',
  districts: 'Each district is a DIGI form. Only Scorer is built; the others are coming.',
  bar: 'A department got cards only if its mind ranked unseen cases at least this well (GATE 0.6). These did not, so they have none — kept on the record, not hidden.',
  training: 'Training is a search for a better mind. It must beat the old one by +0.002 on GATE, and re-run, before the level goes up.',
  drop: '1,000 genesis cards whose rules were fixed before the first search. Rerun it to check every seal here, from nothing.',
  life: 'Every event in the card’s life, signed by the right key and linked to the one before. There is no price column: nothing here is for sale.',
  verify: 'Re-checks the card here, in order: the PNG, its data band, its seals, its signatures, this device’s registry, and every pixel of its face.',
  organs: 'The build’s claims, each written down and locked before it was measured. 41 of 44 held; the 3 that failed are shown, not hidden.',
  rules: 'Its whole mind: at most six rules over one department’s columns. Each adds or takes away points; above the line means yes.',
  key: 'Your key is what makes cards yours. It lives in this tab and in the key file you save — never on a server, never in this browser’s storage. Lose the file and you lose the cards.',
  gate: 'How well its mind ranks cases it never grew on: 0.5 is a coin toss, 1.0 is perfect. Every genesis card reached 0.6.',
  boot: 'The page reads the card, checks every seal and every pixel, fetches its public dataset (checked by its hash) and grows its mind here, on your device.',
  give: 'A give hands the card to another key for good. To get it back, they must give it back. Send the same card twice and the second is refused.',
  mesh: 'Cards from one business’s departments answering together. Only scores pass between them, never records. Each card’s share is its measured part of a million.',
  credits: 'Accounting of what your cards measurably added in a mesh. Not money; it cannot be cashed.',
  estatestats: 'Blocks: cards you hold. Levels re-run: levels your cards earned and this device re-checked. Births: children that beat both parents, and pairings refused. Mesh links: your cards joined, by your consent, in a mesh.',
  legend: 'A cyan wire joins cards of yours working together in a mesh. A green top marks a card new since your last visit. Grey fenced tiles are districts for DIGI forms that are coming, not built yet.',
  test: 'The same measure on cases nothing in the build ever grew on or was chosen by: the honest check.',
  abstain: 'When its rules cannot read a case, it says “I don’t know” instead of guessing.',
  lv: 'Levels earned. A level counts only when a new search beats its mind by 0.002 and anyone can re-run it. Rarity follows the level.',
  gen: 'Generation: 0 for a genesis card; a child is one more than its parents.',
  owners: 'How many keys it has passed through. Replay checks its whole signed life.',
};
/** an "i" button and the sentence it opens, beside the term it explains */
function infoFor(key) {
  if (!INFO[key]) return [];
  const p = el('p', { class: 'g-info', hidden: true }, INFO[key]);
  const b = el('button', { type: 'button', class: 'g-i', 'aria-expanded': 'false', 'aria-label': 'What is this?', onclick: () => { p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); } }, 'i');
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
const SCREENS = ['first', 'boot', 'estate', 'base', 'cards', 'evals', 'mint', 'mesh', 'send', 'proof'];
const DOCK = ['estate', 'base', 'cards', 'evals', 'mint', 'mesh', 'send', 'proof'];
const TITLES = { first: 'DIGI', boot: 'Boot', estate: 'My estate', base: 'Base', cards: 'Cards', evals: 'Eval runs', mint: 'Mint station', mesh: 'Mesh', send: 'Send', proof: 'Proof explorer' };

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
  $$('#g-dock a').forEach((a) => { if (a.dataset.go === screen) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.title = TITLES[screen] + ' · DIGI Card';
  if (!opts.keepHash && location.hash !== '#' + screen) history.replaceState(null, '', '#' + screen);
  if (!opts.keepScroll) scrollTo(0, 0);
  const h = $('section[data-screen="' + screen + '"].on h2, section[data-screen="' + screen + '"].on .g-h');
  if (opts.focus !== false && h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  render(screen);
}
function render(screen) {
  ({ first: renderFirst, estate: renderEstate, base: renderBase, cards: renderCards, evals: renderEvals, mint: () => {}, mesh: renderMesh, send: renderSend, proof: renderProof }[screen] || (() => {}))();
  renderTop();
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
  const f = keyFace(pub, 2);
  if (f.ok) putRGB(canvas, f.px, 20, 20);
}
/** RGB rows onto a canvas of that size */
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
    await show($('#g-boot-card'), $('#g-boot-ring'), d);
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
    const thr = grown.mind.threshold, outcome = SETS[api.setOf(v)] ? SETS[api.setOf(v)].outcome : 'yes';
    fill($('#g-boot-say'), 'Score above ' + thr + ' → yes: it ' + outcome);
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
  fill($('#g-feat-note'), v.owner === S.me.pub ? '' : 'Not yours: boot it, eval it, verify it — only its owner can train, breed, skin or send it.');
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
  if (!S.keySaved) return 'save your key file';
  if (S.storedKey) return 'remove your key from this browser (Cards)';
  if (!G.grown.size) return 'boot your card';
  if (G.st.evals.day !== today() || G.st.evals.n < 3) return 'eval a test case';
  if (!G.st.done.drop) return 'rerun the drop';
  return 'train a card · or mint one from your table';
}
function renderEvalsMini() {
  const n = G.st.evals.day === today() ? G.st.evals.n : 0;
  fill($('#g-evals-mini'), el('a', { class: 'g-line m', href: '#evals' }, 'Eval 3 test cases', el('small', {}, Math.min(n, 3) + ' of 3')),
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
  fill($('#g-ticker'), line('k', 'Levels re-run · ' + levels), line('r', 'Refused here · ' + refused), line('', 'Births kept · ' + births), line('', 'Gives · ' + gives.toLocaleString()), line('y', 'Issued · ' + issued.toLocaleString()),
    line('x', 'Genesis ' + S.manifest.total.toLocaleString() + ' · rules sealed before the first search'), line('x', 'Log head ' + S.manifest.log.head.slice(0, 8) + '…' + S.manifest.log.head.slice(-4)));
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
  fill($('#g-skin-note'), mine ? 'A skin is a signed event of its life · the mind does not change' : 'Only its owner can change its skin');
  void d;
}

// ── estate ───────────────────────────────────────────────────────────────────────────────────────────────────────────
async function holdings() {
  const out = [];
  for (const id of api.mine()) { const v = await verify(api.lifeOf(id)); if (v.ok) out.push({ id, v, f: facts(v) }); }
  return out;
}
async function renderEstate() {
  const held = await holdings();
  const levels = held.reduce((n, h) => n + h.v.receipts.filter((r) => r.kind === 'level').length, 0);
  const born = held.filter((h) => h.v.generation > 0).length;
  const links = S.mesh ? S.mesh.m.fielded.filter((x) => x.owner === S.me.pub).length : 0;
  fill($('#g-estate-stats'), [['Blocks', held.length], ['Levels re-run', levels], ['Births kept', born], ['Births refused', G.st.births.refused], ['Mesh links', links]].flatMap(([k, n]) => [el('dt', {}, k), el('dd', {}, String(n))]));
  const sets = {};
  for (const h of held) sets[h.f.dataset] = (sets[h.f.dataset] || 0) + 1;
  fill($('#g-districts'), line('k', 'Scorer', el('small', {}, String(held.length))), line('x', 'Talker', el('small', {}, 'coming')), line('x', 'Swarm', el('small', {}, 'coming')), line('x', 'Router', el('small', {}, 'coming')), line('x', 'Tools', el('small', {}, 'coming')));
  const away = G.st.log.filter((x) => G.since && x.t > G.since);
  const bred = away.filter((x) => x.type === 'birth'), kept = bred.filter((x) => x.kept).length;
  fill($('#g-overnight'), line('', away.filter((x) => x.type === 'search').length + ' searches ran'), line('k', away.filter((x) => x.type === 'level').length + ' levels kept · re-run'), line('', bred.length + ' bred · ' + kept + ' kept'), line('r', away.filter((x) => x.type === 'search' && !x.kept).length + ' searches refused'));
  drawPlot(held);
}
/** what the painter is handed: the verified holdings, the consented wires between them, the levels — nothing else */
function holdingsOf(held, snapshot = false) {
  const since = G.since, fresh = (id) => !!(since && G.st.log.some((e) => e.id === id && e.t > since && (e.type === 'card' || e.type === 'birth' || e.type === 'minted')));
  const ids = new Set(held.map((h) => h.id)), mineIn = S.mesh ? S.mesh.m.members.filter((m) => m.joined && ids.has(m.card)).map((m) => m.card) : [];
  return { cards: held.map((h) => ({ id: h.id, dataset: h.f.dataset, department: String(h.f.department).slice(0, 16), stage: h.f.stage, rarity: h.f.rarity, generation: h.f.generation, fresh: fresh(h.id) })),
    wires: mineIn.slice(1).map((id, k) => [mineIn[k], id]), tools: 0, levels: held.reduce((n, h) => n + h.v.receipts.filter((r) => r.kind === 'level').length, 0), snapshot };
}
const plotTheme = () => (document.documentElement.dataset.ui === 'blockcraft' ? 'blockcraft-v1' : 'synthwave-v1');
function drawPlot(held) {
  const c = $('#g-plot'), open = tilesFor(held.length);
  setK('g-plot-open', 'Scorer district · ' + open + ' tiles open');
  fill($('#g-plot-rule'), 'The published rule: a district holding n blocks opens 8 + 2n tiles, up to 36 · drawn from your holdings only, by PixelWhisperer’s estate painter');
  if (!c) return;
  const art = paintEstate(holdingsOf(held), plotTheme(), c.width, c.height);
  if (!art.ok) return fill($('#g-plot-rule'), 'The estate could not be drawn: ' + art.why);
  putRGB(c, art.px, c.width, c.height);
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
  const text = 'My DIGI estate · ' + held.length + ' block' + (held.length === 1 ? '' : 's') + ' · ' + levels + ' level' + (levels === 1 ? '' : 's') + ' re-run · every card re-runs on your device: ' + location.origin + location.pathname;
  // the snapshot is painted afresh, with its title and stats bands, from the holdings alone
  const snap = el('canvas', { width: 720, height: 480 }), art = paintEstate(holdingsOf(held, true), plotTheme(), 720, 480);
  if (!art.ok) return fill($('#g-snap-out'), el('p', { class: 'g-badt g-small' }, 'The snapshot could not be drawn: ' + art.why));
  putRGB(snap, art.px, 720, 480);
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
  fill($('#g-set-h'), (openSet === 'custom' ? 'Your own' : SET_NAMES[openSet]) + (openSet === 'custom' ? ' · cards minted from your tables' : ' · ' + ((admitted[openSet] || []).filter((x) => x.admitted).length) + ' departments in the drop'));
  const grid = $('#g-slotgrid'), slots = [];
  if (openSet === 'custom') {
    for (const h of bySet.custom || []) slots.push(heldSlot(h));
    if (!slots.length) slots.push(el('div', { class: 'g-slot' }, el('div', { class: 'g-sil' }, 'Mint your first'), el('a', { class: 'g-btn', href: '#mint' }, 'Mint a DIGI from your table')));
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

/** the breed lab: the selected card and a partner of yours on the same business; the card panel's breed does the work */
function renderLab() {
  const lab = $('#g-breedlab'), opts = [...$('#breed-partner').options].filter((o) => o.value);
  lab.querySelectorAll('.g-lab').forEach((n) => n.remove());
  const pick = el('select', { 'aria-label': 'The partner card' }, opts.map((o) => el('option', { value: o.value }, o.textContent)));
  const go_ = el('button', { type: 'button', class: 'g-btn hot', disabled: !opts.length, onclick: async () => { $('#breed-partner').value = pick.value; go_.disabled = true; await api.actBreed(); go_.disabled = false; renderInspect(); } }, 'Breed');
  lab.append(el('div', { class: 'g-lab g-row' }, opts.length ? [el('span', {}, 'Partner'), pick, go_] : el('span', { class: 'g-dim' }, 'You hold no other card of this business: card me, or mint one.')),
    el('p', { class: 'g-lab g-small g-dim' }, 'Across departments, 40 of 40 children beat both parents on TEST · within one department only 12 of 26 did (organ 4: a failed prediction, kept)'));
}

// ── eval runs ────────────────────────────────────────────────────────────────────────────────────────────────────────
const MISSIONS = [{ key: 'drop', name: 'Rerun the drop', href: '#proof' }, { key: 'own', name: 'Mint a card from your table', href: '#mint' }, { key: 'breed', name: 'Breed a child that beats both', href: '#cards' }];
const TITLES_EARNED = { evals3: 'Band reader', drop: 'Decoder', own: 'Maker', breed: 'Breeder' };
function renderEvals() {
  const n = G.st.evals.day === today() ? G.st.evals.n : 0, id = featured(), v = id && S.reg.cards[id];
  fill($('#g-today'), el('div', { class: 'g-line m' }, 'Eval 3 test cases', el('small', {}, Math.min(n, 3) + ' of 3')), el('div', { class: 'g-bar' }, el('i', { style: 'width:' + Math.round((Math.min(n, 3) / 3) * 100) + '%;background:#7dff8a' })),
    el('p', { class: 'g-small g-dim' }, v ? 'On #' + pad4(v.serial) + ' · change the card in Cards' : 'Card me first'));
  fill($('#g-missions'), [...MISSIONS, { key: 'evals3', name: 'Eval 3 test cases in a day', href: '#evals' }].map((m) => line(G.st.done[m.key] ? 'k' : 'y', el('a', { href: m.href }, (G.st.done[m.key] ? '✓ ' : '') + m.name), G.st.done[m.key] ? el('small', {}, 'title · ' + TITLES_EARNED[m.key]) : null)));
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
  organs ||= await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(async (k) => {
    const [v, p] = await Promise.all(['verdict', 'prereg'].map((f) => fetch('data/organ-' + k + '/' + f + '.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)));
    return { k, name: p ? p.organ : 'organ ' + k, blind: !(p && p.disclosure), held: v ? v.verdicts.filter((x) => x.pass).length : 0, all: v ? v.verdicts.length : 0 };
  }));
  const held = organs.reduce((n, o) => n + o.held, 0), all = organs.reduce((n, o) => n + o.all, 0);
  fill($('#g-organs'), organs.map((o) => line(o.held === o.all ? 'k' : 'y', o.k + ' · ' + String(o.name).split(/[:—]/)[0].trim().slice(0, 28) + (o.blind ? '' : ' · not blind'), el('small', {}, o.held + '/' + o.all))), line('m', 'Held ' + held + ' of ' + all, el('small', {}, (all - held) + ' failed · kept on show')));
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
    case 'opened': if (!e.ok) { G.st.refused++; note('refused', { what: 'card' }); bleep('refused'); } break;
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
  on('#g-a-breed', 'click', () => { const lab = $('#g-breedlab'); lab.hidden = !lab.hidden; if (!lab.hidden) renderLab(); });
  on('#g-a-skin', 'click', async () => { await api.actSkin(); renderInspect(); });
  on('#g-a-verify', 'click', () => api.actVerify());
  on('#g-a-png', 'click', () => api.actDownload());
  on('#g-a-share', 'click', async () => {
    const d = api.lifeOf(S.sel), v = await verify(d), png = await cardOf(d, api.paint), file = new File([png.png], 'digi-' + pad4(v.serial) + '-' + v.id + '.png', { type: 'image/png' });
    const text = facts(v).title + ' #' + pad4(v.serial) + ' · a DIGI card · open it and every claim re-runs: ' + location.origin + location.pathname + '#send';
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } catch { return; }
    api.download(png.png, file.name);
  });
  const toTab = (t) => () => { tab = t; renderTabs(); };
  on('#g-tab-rules', 'click', toTab('rules')); on('#g-tab-reruns', 'click', toTab('reruns')); on('#g-tab-life', 'click', toTab('life'));
  on('#g-work', 'click', () => api.workOvernight());
  on('#g-snapshot', 'click', shareSnapshot);
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
function dockIcons() { for (const a of $$('#g-dock a')) if (UI_ICONS[a.dataset.go] && !a.querySelector('canvas')) a.prepend(iconCanvas(UI_ICONS[a.dataset.go], 2, '#2be8ff')); }
async function start() {
  dockIcons();
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
