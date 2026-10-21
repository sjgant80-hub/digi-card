// app.js — THE DIGI CARD, as you use it: your key, your wallet, the drop, a card someone hands you, the mesh, your own
// table. Every button runs the mutation-gated kernels in src/ (and the vendored ones they stand on) in this browser; the
// slow searches run the same kernels in worker.js. Nothing is mocked and nothing is sent anywhere: the only network this
// page uses is fetching its own files (the drop, the data, the decoder) from the site it came from.
//
// What is kept on this device (IndexedDB, this browser only): the lives you have signed or received since the drop, which
// levels this device has already re-run, and your own tables only if you ask. NOT your key: it lives in this tab until you
// save it to your key file (Wallet → Save my key file), and you open that file to hold your cards again — every page on
// this site's address shares its storage, so a key kept there could be reached by any of them. A key kept the old way is
// used for the visit and the page offers to move it to a file.
//
// The game screens (ui/game.js) drive the same actions through `api` and keep score from the `digi` events emitted here.
import { cardOf, readCard, bandOf, W, H, BAND, CAPACITY } from './src/card.mjs';
import { issue, give, addReceipt, reskin, verify, facts, encode } from './src/dossier.mjs';
import { empty, record, replay, standing, dossierOf, hashOf } from './src/registry.mjs';
import { SETS, openSet, viewOf, departments, ownGround, digest } from './src/data.mjs';
import { mindOf, answer, caseAt, rerun as rerunLevel, seedsFor, organOf, MARGIN } from './src/mind.mjs';
import { sayOutcome, SHOWN_AS } from './src/copy.mjs';
import { breed, birthCheck } from './src/breed.mjs';
import { consent, assemble, ask, work, tally } from './src/mesh.mjs';
import { gate as claimGate, PAGE } from './src/claims.mjs';
import { checkDrop, decoderHash, demoMaker, themeOf } from './src/drop.mjs';
import { paintArt, THEMES } from './vendor/pixelwhisperer/kards/kardart.mjs';
import { generate, exportPriv, importPriv, fromSeed } from './vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { seal } from './vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { utf8 } from './vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { sha256Hex, sha256Bytes } from './vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { probeOffline } from './vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { costCase, tokensOf } from './src/cost.mjs';

// ── small helpers: every text a card carries is set as text, never as markup ─────────────────────────────────────────
const $ = (s) => document.querySelector(s);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
const clear = (node, ...kids) => { node.replaceChildren(...kids.flat().filter((k) => k != null && k !== false).map((k) => (k instanceof Node ? k : document.createTextNode(String(k))))); return node; };
const auc = (m) => (m == null ? '—' : (m / 1e6).toFixed(3));
const short = (h) => (h ? h.slice(0, 8) + '…' + h.slice(-4) : '—');
const say = (node, text, kind = '') => clear(node, el('div', { class: 'status ' + kind }, text));
const paint = (f, t, w, h) => paintArt(f, t, w, h);
const kb = (n) => (n >= 1 << 20 ? (n / (1 << 20)).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
const setK = (k, v) => document.querySelectorAll('[data-k="' + k + '"]').forEach((n) => { n.textContent = v; });
const wait = () => new Promise((r) => setTimeout(r, 0));

// ── this device's memory ─────────────────────────────────────────────────────────────────────────────────────────────
let dbp = null;
const db = () => (dbp ||= new Promise((res, rej) => { const r = indexedDB.open('digi-card', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const kv = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('kv', mode), s = t.objectStore('kv'), q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
const load = (k) => kv('readonly', (s) => s.get(k)).catch(() => undefined);
const save = (k, v) => kv('readwrite', (s) => s.put(v, k)).catch(() => undefined);
const forget = (k) => kv('readwrite', (s) => s.delete(k)).catch(() => undefined);

// ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const S = { me: null, maker: null, manifest: null, glog: [], decoder: null, reg: empty(), tail: [], grounds: new Map(), own: new Map(), checked: new Set(), sel: null, ledger: [], mesh: null, keySaved: false, storedKey: false, storedOwns: false };
/** what happened, for the game screens to keep score by: { type, ...facts } on window */
const emit = (type, detail = {}) => dispatchEvent(new CustomEvent('digi', { detail: { type, ...detail } }));

// ── the ground a mind works on: the bundled set, fetched from this site and checked to the byte ─────────────────────
async function groundOf(set, note = () => {}) {
  if (S.own.has(set)) return S.own.get(set);
  if (!S.grounds.has(set)) {
    S.grounds.set(set, (async () => {
      const bytes = {};
      for (const f of Object.keys(SETS[set].files)) {
        note('fetching data/' + f + '…');
        bytes[f] = new Uint8Array(await (await fetch('data/' + f)).arrayBuffer());
        note('data/' + f + ': ' + kb(bytes[f].length) + ', checking it is the published bytes…');
      }
      const g = await openSet(set, bytes);
      if (!g.ok) throw new Error(g.why);
      return g;
    })());
  }
  try { return await S.grounds.get(set); } catch (e) { S.grounds.delete(set); throw e; }
}
const setOf = (v) => { const d = v.genome.organs.map((o) => o.split(' ')[2])[0] || ''; const s = d.split('-')[0]; return Object.prototype.hasOwnProperty.call(SETS, s) ? s : null; };
const ownSetOf = (v) => [...S.own.keys()].find((k) => S.own.get(k).ds.name === v.genome.organs[0].split(' ')[2]) || null;
const groundFor = (v, note) => { const s = setOf(v) || ownSetOf(v); if (!s) throw new Error('this device holds no ground this card grows on'); return groundOf(s, note); };

// ── re-running receipts: a level is re-expressed on its ground; the drop is replayed with the decoder it names ───────
async function rerunAny(receipt, v, k, dossier) {
  if (receipt.kind === 'drop') return checkDrop(receipt, { decoder: S.decoder, log: S.glog, maker: S.manifest && S.manifest.maker });
  const key = sha256Hex(v.id + ':' + k + ':' + JSON.stringify(receipt));
  if (S.checked.has(key)) return { ok: true };
  const g = receipt.data && receipt.data.startsWith('own:') ? [...S.own.values()].find((x) => x.id === receipt.data) : await groundFor(v);
  const r = rerunLevel(receipt, v, k, dossier, { ground: g });
  if (r.ok) { S.checked.add(key); save('checked', [...S.checked]); }
  return r;
}

// ── a card's pixels, as cardOf writes them: the band, then the face the art engine draws ─────────────────────────────
async function pixels(d) {
  const v = await verify(d);
  if (!v.ok) return null;
  const band = bandOf(utf8(encode(d))), face = paint(facts(v), v.theme, W, H - BAND);
  if (!band || !face.ok) return null;
  const px = new Uint8Array(W * H * 3); px.set(band, 0); px.set(face.px, band.length);
  return { px, v };
}
async function drawCard(canvas, d) {
  const p = await pixels(d);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!p) { ctx.fillStyle = '#300'; ctx.fillRect(0, 0, W, H); return null; }
  const img = ctx.createImageData(W, H);
  for (let i = 0, j = 0; i < p.px.length; i += 3, j += 4) { img.data[j] = p.px[i]; img.data[j + 1] = p.px[i + 1]; img.data[j + 2] = p.px[i + 2]; img.data[j + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return p.v;
}

// ── the key ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function loadMe() {
  const stored = await load('me');   // a key kept the old way: used for this visit; the page offers to move it to a file
  if (stored && stored.pub && stored.priv) { S.storedKey = true; return stored; }
  return generate();                 // a new key, in this tab only, until its owner saves it to a file
}
function renderMe() {
  setK('me', S.me.pub);
  setK('me-short', short(S.me.pub));
  setK('key-state', S.keySaved ? 'saved to your key file' : 'in this tab only — save it to keep your cards');
  const old = $('#key-stored');
  if (old) old.hidden = !S.storedKey;
}
/** the key file: your key and every card you hold, the one thing that makes them yours on another visit or device */
async function saveKeyFile() {
  const hex = await exportPriv(S.me), cards = mine().map(lifeOf);
  download(utf8(JSON.stringify({ kind: 'digi-card.wallet', key: { pub: S.me.pub, pkcs8: hex }, cards })), 'digi-wallet-' + S.me.pub.slice(0, 8) + '.json');
  S.keySaved = true; renderMe(); emit('key', { saved: true, cards: cards.length });
  return cards.length;
}
/** move a key kept the old way out of this browser's storage (its owner has saved the key file first) */
async function forgetStoredKey() {
  await forget('me'); S.storedKey = false; renderMe(); emit('key', { forgotten: true });
}

// ── the drop: fetched, then replayed from nothing with the decoder #0001 names ──────────────────────────────────────
async function loadDrop(note) {
  const [m, log, pub] = await Promise.all([fetch('drop/manifest.json').then((r) => r.json()), fetch('drop/log.json').then((r) => r.json()), fetch('registry/log.json').then((r) => (r.ok ? r.json() : [])).catch(() => [])]);
  S.manifest = m;
  note('checking decoder v1: ' + Object.keys(m.decoder.files).length + ' files…');
  const files = {};
  for (const p of Object.keys(m.decoder.files)) files[p] = await digest(new Uint8Array(await (await fetch('decoder/v1/' + p)).arrayBuffer()));
  S.decoder = decoderHash(files);
  S.glog = log.slice(0, m.first.receipt.cards);
  note('replaying the drop: ' + log.length + ' cards' + (pub.length ? ' and ' + pub.length + ' public give(s)' : '') + ', every seal and signature…');
  const t0 = performance.now(), r = await replay([...log, ...pub], { rerun: rerunAny });
  if (!r.ok) throw new Error('the drop does not replay: ' + r.why);
  S.reg = r.reg;
  return { ms: Math.round(performance.now() - t0), n: log.length, decoderOk: S.decoder === m.decoder.hash };
}

/** the lives this device has signed or received since the drop, recorded again from nothing at each visit */
async function loadTail() {
  const tail = (await load('tail')) || [];
  for (const d of tail) { const r = await record(S.reg, d, { rerun: rerunAny }); if (r.ok) S.reg = r.reg; }
  S.tail = tail;
}
async function keep(d) {
  const r = await record(S.reg, d, { rerun: rerunAny });
  if (!r.ok) return r;
  S.reg = r.reg;
  if (r.entry) { S.tail.push(d); await save('tail', S.tail); }
  return r;
}

// ── the wallet ───────────────────────────────────────────────────────────────────────────────────────────────────────
const mine = () => Object.entries(S.reg.cards).filter(([, c]) => c.owner === S.me.pub).map(([id]) => id);
const lifeOf = (id) => dossierOf(S.reg, id);
async function renderWallet() {
  const ids = mine(), grid = $('#wallet-grid');
  setK('held', String(ids.length));
  clear(grid);
  if (!ids.length) { grid.append(el('p', { class: 'dim' }, 'No cards yet. Press “Card me” for a genesis card, open one someone sent you in the Inbox, or grow one from your own table.')); return; }
  for (const id of ids) {
    const c = el('canvas', { class: 'thumb', width: W, height: H, 'aria-hidden': 'true' });
    const b = el('button', { class: 'cardbtn' + (S.sel === id ? ' on' : ''), onclick: () => select(id) }, c, el('span', {}, '#' + String(S.reg.cards[id].serial).padStart(4, '0') + ' · ' + id.slice(0, 6)));
    grid.append(b);
    drawCard(c, lifeOf(id)).then((v) => { if (v) b.setAttribute('aria-label', 'Card ' + facts(v).title + ', serial ' + v.serial + ', stage ' + facts(v).stage); });
  }
}

async function select(id) {
  S.sel = id;
  const d = lifeOf(id), v = await verify(d), f = facts(v);
  $('#detail').hidden = false;
  await drawCard($('#detail-card'), d);
  const rows = [['Card', id], ['Serial', '#' + String(v.serial).padStart(4, '0')], ['Mind', f.title + ' · ' + f.dataset + ' / ' + f.department], ['Stage', f.stage + ' (' + f.rarity + ') — levels earned and re-run'],
    ['Generation', f.generation + (f.parents.length ? ' · parents ' + f.parents.join(', ') : '')], ['Maker', short(v.maker)], ['Owner', v.owner === S.me.pub ? 'you' : short(v.owner)], ['Face', v.theme], ['Life', d.events.length + ' signed events · ' + utf8(encode(d)).length + ' of ' + CAPACITY + ' band bytes']];
  clear($('#detail-facts'), el('table', {}, el('tbody', {}, rows.map(([k, x]) => el('tr', {}, el('th', { scope: 'row' }, k), el('td', { class: 'mono' }, x))))));
  clear($('#detail-life'), el('ol', { class: 'life' }, d.events.map((e, k) => el('li', {}, el('b', {}, e.type), ' ', e.type === 'issue' ? 'by the maker to ' + short(e.to) + ', serial ' + e.serial + ', face ' + e.theme
    : e.type === 'give' ? 'to ' + (e.to === S.me.pub ? 'you' : short(e.to)) : e.type === 'skin' ? 'face → ' + e.theme
    : e.receipt.kind === 'level' ? 'level: ' + e.receipt.domain + ' ' + auc(e.receipt.before) + ' → ' + auc(e.receipt.after) + ' on GATE' : e.receipt.kind + ' receipt', el('span', { class: 'dim mono' }, ' · ' + short(hashOf(e)))))));
  for (const o of ['grow', 'ask', 'level', 'breed', 'send', 'verify', 'skin']) clear($('#out-' + o));
  clear($('#ask-fields')); $('#ask-own').hidden = true; $('#send-to').value = '';
  const partners = [];
  for (const x of mine()) if (x !== id && setOf(await verify(lifeOf(x))) === setOf(v)) partners.push(x);
  clear($('#breed-partner'), partners.length ? partners.map((p) => el('option', { value: p }, '#' + String(S.reg.cards[p].serial).padStart(4, '0') + ' · ' + p.slice(0, 8))) : el('option', { value: '' }, 'no other card of yours on this ground'));
  renderWallet();
  emit('select', { id, partners: partners.length });
}
const current = async () => { const d = lifeOf(S.sel); return { d, v: await verify(d) }; };

// ── protected characteristics: the columns of the bundled sets that stand for one under the Equality Act 2010 (age,
// marriage and civil partnership, race, sex). A card whose rules read one is flagged wherever its rules are shown. ─────
const PROTECTED = { gender: 'sex', female: 'sex', male: 'sex', SeniorCitizen: 'age', age: 'age', married: 'marriage and civil partnership', single: 'marriage and civil partnership', Partner: 'marriage and civil partnership', usBorn: 'race (national origin)' };
const protectedOf = (feat) => PROTECTED[feat] || (/^race_/.test(feat) ? 'race' : /^(marital_|rel_)/.test(feat) ? 'marriage and civil partnership' : null);
function protectedNote(rules) {
  const hit = [...new Set(rules.map((r) => protectedOf(r.feat)).filter(Boolean))];
  return hit.length ? el('div', { class: 'note' }, '⚠ Its rules read columns that stand for protected characteristics under the Equality Act 2010 (' + hit.join(', ') + '). It is a research mind grown on a public dataset: before it informs a decision about a person, check you may lawfully use those columns for that decision — or grow your own card from the columns you may.') : null;
}

// ── actions on the selected card ─────────────────────────────────────────────────────────────────────────────────────
async function actGrow() {
  const out = $('#out-grow'), { v } = await current();
  try {
    const t0 = performance.now(), g = await groundFor(v, (t) => say(out, t)), m = mindOf(v, g), ms = Math.round(performance.now() - t0);
    const declared = S.manifest && (S.manifest.cards.find((c) => c.card === v.id) || (S.manifest.first.card === v.id ? S.manifest.first : null));
    clear(out, el('div', { class: 'status ' + (m.gate !== null ? 'ok' : 'bad') }, m.gate !== null
      ? 'Grown here, offline, in ' + ms + ' ms: GATE AUC ' + (m.gate / 1e6).toFixed(6) + ' on ' + g.ds.gateRows.length.toLocaleString() + ' cases it never grew on' + (declared && v.receipts.filter((r) => r.kind === 'level').length === 0 ? (declared.gate === m.gate ? ' — exactly the ' + (declared.gate / 1e6).toFixed(6) + ' the drop declared, to the millionth.' : ' — the drop declared ' + (declared.gate / 1e6).toFixed(6) + ': this does not match.') : '.')
      : 'Its mind did not clear its bar on this ground: it abstains, always.'),
      m.organs.map((o) => el('div', { class: 'answer' }, el('b', {}, o.domain), ' ', el('span', { class: 'chip ' + o.state }, o.state), o.gate != null ? ' GATE ' + auc(o.gate) : ' ' + (o.why || ''),
        o.body ? el('ul', { class: 'rules' }, o.body.rules.map((r) => el('li', {}, r.feat + ' ' + r.op + ' ' + r.v + '  →  ' + (r.w > 0 ? '+' : '') + r.w))) : null,
        o.body ? el('div', { class: 'dim' }, 'says yes above ' + o.body.threshold + ' (the operating point read off the FIT rows)') : null, o.body ? protectedNote(o.body.rules) : null)),
      m.coupling ? el('p', { class: 'dim' }, 'Two or more departments: their scores are coupled by a logistic regression learned on GATE; its GATE AUC is judged out of fold.') : null);
    const grown = { id: v.id, gate: m.gate, declared: declared && v.receipts.filter((r) => r.kind === 'level').length === 0 ? declared.gate : null, ms, rows: g.ds.gateRows.length, mind: m, set: setOf(v) || ownSetOf(v) };
    emit('grown', grown);
    return grown;
  } catch (e) { say(out, String(e.message || e), 'bad'); emit('grown', { id: v.id, error: String(e.message || e) }); return null; }
}

async function actAsk(own) {
  const out = $('#out-ask'), { v } = await current();
  try {
    const g = await groundFor(v, (t) => say(out, t)), m = mindOf(v, g);
    let x, truth = null, row = null;
    if (own) { x = Object.fromEntries([...$('#ask-fields').querySelectorAll('input')].map((i) => [i.name, i.value === '' ? undefined : Number(i.value)])); }
    else { const rows = g.ds.testRows; row = rows[Math.floor(Math.random() * rows.length)]; x = caseAt(g, row); truth = g.ds.y[row]; }
    const a = answer(m, x), feats = [...new Set(m.organs.filter((o) => o.body).flatMap((o) => o.body.rules.map((r) => r.feat)))];
    clear($('#ask-fields'), feats.map((f) => el('label', {}, f, el('input', { name: f, type: 'number', step: 'any', value: x[f] ?? '' }))));
    $('#ask-own').hidden = !feats.length;
    clear(out, a.verdict === 'VERIFIED'
      ? el('div', { class: 'answer' }, el('div', { class: 'v' }, a.label ? 'YES — ' + (SETS[setOf(v)] ? sayOutcome(setOf(v), SETS[setOf(v)].outcome) : 'the case') : 'NO'), el('div', {}, 'score ' + a.score + ' against its operating point ' + a.threshold),
        el('ul', { class: 'rules' }, a.fired.length ? a.fired.map((r) => el('li', {}, r.feat + ' ' + r.op + ' ' + r.v + ' fired: ' + (r.w > 0 ? '+' : '') + r.w)) : el('li', {}, 'no rule fired')),
        truth !== null ? el('div', { class: truth === a.label ? 'ok-t' : 'bad-t' }, 'TEST case #' + row + ' (one it never grew or was judged on): what really happened was ' + (truth ? 'yes' : 'no') + (truth === a.label ? ' — it was right.' : ' — it was wrong on this one. Its GATE AUC says how often it ranks such cases well.')) : null)
      : el('div', { class: 'answer' }, el('div', { class: 'v' }, 'ABSTAIN'), el('div', {}, a.why)));
    emit('eval', { id: v.id, verdict: a.verdict, label: a.label, truth, row, own: !!own, right: truth !== null && a.verdict === 'VERIFIED' ? truth === a.label : null });
    return { a, truth, row, mind: m };
  } catch (e) { say(out, String(e.message || e), 'bad'); return null; }
}

let worker = null, jobs = 0;
const pending = new Map();
function work_(msg) {
  worker ||= Object.assign(new Worker('worker.js', { type: 'module' }), { onmessage: ({ data }) => { const p = pending.get(data.id); pending.delete(data.id); if (p) p(data.r); } });
  const id = ++jobs;
  return new Promise((res) => { pending.set(id, res); worker.postMessage({ ...msg, id }); });
}

async function actLevel() {
  const out = $('#out-level'), { d, v } = await current();
  if (v.owner !== S.me.pub) return say(out, 'Only the card’s owner can sign a level into it.', 'bad');
  const domain = mindDomains(v)[0], tried = v.receipts.filter((r) => r.kind === 'level').length, seeds = seedsFor(v.head, 3);
  const own = ownSetOf(v), set = setOf(v);
  for (const [k, seed] of seeds.entries()) {
    const t0 = Date.now(), tick = setInterval(() => say(out, 'Working: search ' + (k + 1) + ' of 3 (seed ' + seed + ') on ' + domain + '’s FIT rows — ' + Math.round((Date.now() - t0) / 1000) + ' s. A search is the slow part; re-running what it finds takes milliseconds.'), 500);
    const r = await work_({ op: 'level', set, own: own ? { text: S.own.get(own).text, opts: S.own.get(own).opts } : null, dossier: d, domain, seed });
    clearInterval(tick);
    emit('search', { id: v.id, k, ...searchNumbers(r) });
    if (r.ok) {
      const next = await addReceipt(d, S.me, r.receipt);
      if (!next.ok) return say(out, next.why, 'bad');
      const kept = await keep(next.dossier);
      if (!kept.ok) return say(out, 'The level did not record: ' + kept.why, 'bad');
      emit('level', { id: v.id, before: r.before, after: r.after });
      await select(S.sel);
      return clear(out, el('div', { class: 'status ok' }, 'LEVEL UP: GATE ' + auc(r.before) + ' → ' + auc(r.after) + ' (+' + auc(r.after - r.before) + '). Stage ' + (tried + 1) + '. The receipt was signed into the card and re-run here before it was recorded: the face you see now was redrawn from it.'),
        el('pre', {}, JSON.stringify(r.receipt, null, 1)));
    }
    say(out, 'Search ' + (k + 1) + ': ' + r.why);
    await wait();
  }
  clear(out, el('div', { class: 'status' }, 'No level this time: three searches found nothing that lifts this mind by ' + auc(MARGIN) + ' on GATE. That is the gate working — a level is earned, never printed. Its next searches start from new seeds once its life moves on.'));
}
const mindDomains = (v) => v.genome.organs.map((o) => o.split(' ')[2]);
/** a search's two numbers, millionths: what the mind scored, what the search found (a refusal names both) */
function searchNumbers(r) {
  if (r.ok) return { before: r.before, after: r.after, kept: true };
  const m = /found ([0-9.]+) on GATE against the mind’s ([0-9.]+)/.exec(r.why || '');
  return m ? { before: Math.round(Number(m[2]) * 1e6), after: Math.round(Number(m[1]) * 1e6), kept: false } : { kept: false, why: r.why };
}

// ── work overnight: while the page is open, every card you own keeps searching for a level, one search at a time ─────
let working = false, runs = 0;
async function workOvernight() {
  const out = $('#work-out'), btn = $('#work-toggle');
  if (working) { working = false; btn.disabled = true; btn.textContent = 'Stopping after this search…'; return; }
  working = true; btn.textContent = 'Stop working'; emit('working', { on: true });
  const run = ++runs;   // one loop at a time: a loop that is no longer the current run stops at its next step
  let searches = 0, levels = 0;
  const tried = new Map();
  while (working && run === runs) {
    const ids = mine();
    if (!ids.length) { say(out, 'You hold no cards to work.'); break; }
    for (const id of ids) {
      if (!working || run !== runs) break;
      const d = lifeOf(id), v = await verify(d), own = ownSetOf(v), set = setOf(v);
      if (!set && !own) continue;
      const k = tried.get(v.head) || 0, seed = seedsFor(v.head, k + 1)[k];
      tried.set(v.head, k + 1);
      say(out, 'Working: search ' + (searches + 1) + ' (card #' + String(v.serial).padStart(4, '0') + ', seed ' + seed + ') · ' + levels + ' level' + (levels === 1 ? '' : 's') + ' earned so far. Leave this page open; stop any time.');
      const r = await work_({ op: 'level', set, own: own ? { text: S.own.get(own).text, opts: S.own.get(own).opts } : null, dossier: d, domain: mindDomains(v)[0], seed });
      searches++;
      emit('search', { id, overnight: true, ...searchNumbers(r) });
      if (r.ok) {
        const next = await addReceipt(d, S.me, r.receipt);
        if (next.ok && (await keep(next.dossier)).ok) { levels++; emit('level', { id, before: r.before, after: r.after, overnight: true }); await renderWallet(); if (S.sel === id) await select(id); }
      }
    }
  }
  say(out, 'Stopped after ' + searches + ' search' + (searches === 1 ? '' : 'es') + ': ' + levels + ' level' + (levels === 1 ? '' : 's') + ' earned, each re-run here before it was recorded.', levels ? 'ok' : '');
  working = false; btn.disabled = false; btn.textContent = 'Work overnight';
  emit('working', { on: false, searches, levels });
}

/** fuse two of your cards on one ground: up to 12 tries for a mind that beats both on GATE, kept (issued to you, recorded,
 *  re-checked here) only then. → { ok: true, kept: true, child, r, check } | { ok: true, kept: false, why, r } | { ok: false, why } */
async function fuse(aId, bId, tell = () => {}) {
  if (!aId || !bId || aId === bId) return { ok: false, why: 'Fusing needs two of your cards that live on the same ground.' };
  const v = await verify(lifeOf(aId)), vp = await verify(lifeOf(bId));
  if (!v.ok || !vp.ok) return { ok: false, why: 'Only cards that check can be fused.' };
  if (v.owner !== S.me.pub || vp.owner !== S.me.pub) return { ok: false, why: 'Fusing needs two cards that are yours.' };
  const g = await groundFor(v, tell);
  tell('Fusing their minds, up to 12 times, looking for a fused card that beats both on GATE…'); await wait();
  const r = await breed(v, vp, g, S.me, { seed: 1 + v.receipts.length + vp.receipts.length });
  if (!r.born) { emit('birth', { kept: false, a: v.id, b: vp.id, tries: r.tries, why: r.why }); return { ok: true, kept: false, r, why: r.why.replace(/\b\d{6,7}\b/g, (x) => (x / 1e6).toFixed(3)) }; }
  const serial = nextSerial(), child = await issue(r.genome, S.me, { serial, to: S.me.pub, theme: themeOf(serial), generation: Math.max(v.generation, vp.generation) + 1 });
  const kept = await keep(child.dossier);
  if (!kept.ok) return { ok: false, why: kept.why };
  const vc = await verify(child.dossier), bc = birthCheck(vc, v, vp, g);
  emit('birth', { kept: true, id: vc.id, a: v.id, b: vp.id, gate: r.gate, parents: r.parents, tries: r.tries });
  await renderWallet();
  return { ok: true, kept: true, child: vc, r, check: bc };
}

async function actBreed() {
  const out = $('#out-breed'), { v } = await current(), pid = $('#breed-partner').value;
  try {
    const x = await fuse(v && v.id, pid, (t) => say(out, t));
    if (!x.ok) return say(out, x.why, 'bad');
    if (!x.kept) return clear(out, el('div', { class: 'status' }, 'No fused card: ' + x.why + '. A fused card is never a promise — it is what grew: it must beat both parents on GATE.'));
    clear(out, el('div', { class: 'status ok' }, 'FUSED: GATE ' + auc(x.r.gate) + ', beating both parents (' + auc(x.r.parents[0]) + ', ' + auc(x.r.parents[1]) + ') after ' + x.r.tries + (x.r.tries > 1 ? ' tries' : ' try') + '. Re-run here: ' + (x.check.ok ? 'it holds.' : x.check.why)),
      el('button', { onclick: () => select(x.child.id) }, 'Open the fused card'));
  } catch (e) { say(out, String(e.message || e), 'bad'); }
}
const nextSerial = () => 1 + Object.values(S.reg.cards).filter((c) => c.maker === S.me.pub).reduce((m, c) => Math.max(m, c.serial), 0);

async function actSend() {
  const out = $('#out-send'), { d, v } = await current(), to = $('#send-to').value.trim().toLowerCase();
  if (v.owner !== S.me.pub) return say(out, 'Only the card’s owner can hand it on.', 'bad');
  if (!/^[0-9a-f]{64}$/.test(to)) return say(out, 'A key is 64 hex characters: ask the person you are giving it to for theirs (Wallet → Copy my key).', 'bad');
  const r = await give(d, S.me, to);
  if (!r.ok) return say(out, r.why, 'bad');
  const kept = await keep(r.dossier);
  if (!kept.ok) { emit('refused', { what: 'give', why: kept.why }); return say(out, kept.why, 'bad'); }
  const png = await cardOf(r.dossier, paint);
  download(png.png, 'digi-' + String(v.serial).padStart(4, '0') + '-' + v.id + '.png');
  await select(S.sel);   // the panel stays: it now shows the new owner, and the confirmation below
  await renderWallet();
  emit('given', { id: v.id, to });
  say(out, 'Given to ' + short(to) + '. The card you downloaded is now theirs: send it to them. This device recorded the give first, so any other give of this card from the same life is a double sale and is refused here.', 'ok');
}

// theme: a published theme to wear (the game's skin packs); without one, the next in the engine's list
async function actSkin(theme) {
  const out = $('#out-skin'), { d, v } = await current();
  if (v.owner !== S.me.pub) return say(out, 'Only the card’s owner can re-skin it.', 'bad');
  const ids = Object.keys(THEMES), next = typeof theme === 'string' && ids.includes(theme) ? theme : ids[(ids.indexOf(v.theme) + 1) % ids.length];
  if (next === v.theme) return say(out, 'It already wears ' + next + '.');
  const r = await reskin(d, S.me, next);
  if (!r.ok) return say(out, r.why, 'bad');
  const kept = await keep(r.dossier);
  if (!kept.ok) return say(out, kept.why, 'bad');
  await select(S.sel);
  emit('skin', { id: v.id, theme: next });
  say(out, 'Re-skinned to ' + next + '. The face changed; the mind did not. The skin is a signed event of its life, so any reader redraws this face too.', 'ok');
}

async function actDownload() {
  const { d, v } = await current(), png = await cardOf(d, paint);
  if (!png.ok) return say($('#out-verify'), png.why, 'bad');
  download(png.png, 'digi-' + String(v.serial).padStart(4, '0') + '-' + v.id + '.png');
}
function download(bytes, name) {
  const a = el('a', { href: URL.createObjectURL(new Blob([bytes], { type: 'image/png' })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function actVerify() {
  const out = $('#out-verify'), { d } = await current();
  const png = await cardOf(d, paint), r = await readCard(png.png, paint);
  const lines = [['The PNG reads back, its CRCs whole, its face redrawn from what it carries and matched to the pixel', r.ok, r.why]];
  if (r.ok) {
    const s = standing(S.reg, d, r.id);
    lines.push(['Every seal and signature of its life checks (' + d.events.length + ' events)', true]);
    lines.push(['The registry here holds this very life (' + s.standing + ')', s.standing === 'current', 'standing: ' + s.standing]);
    for (const [k, e] of d.events.entries()) if (e.type === 'receipt' && e.receipt.kind === 'level') {
      S.checked.clear();
      const rr = await rerunAny(e.receipt, r.v, k, d);
      lines.push(['Level at event ' + k + ' re-run here: ' + e.receipt.domain + ' ' + auc(e.receipt.before) + ' → ' + auc(e.receipt.after), rr.ok, rr.why]);
    }
  }
  clear(out, el('ul', { class: 'checks' }, lines.map(([t, ok, why]) => el('li', { class: ok ? 'ok-t' : 'bad-t' }, (ok ? '✓ ' : '✗ ') + t + (ok || !why ? '' : ' — ' + why)))));
}

// ── open a card someone sent you ─────────────────────────────────────────────────────────────────────────────────────
async function openFile(file) {
  const out = $('#open-report');
  if (!file) return;
  say(out, 'Reading ' + file.name + ' (' + kb(file.size) + ')…');
  const bytes = new Uint8Array(await file.arrayBuffer()), r = await readCard(bytes, paint);
  if (!r.ok) { emit('opened', { ok: false, why: r.why }); return clear(out, el('div', { class: 'status bad' }, '✗ Refused: ' + r.why + '. Nothing in a refused card is used.')); }
  const s = standing(S.reg, r.dossier, r.id), f = r.facts;
  const lines = [['A PNG whose every chunk is whole', true], ['Its dossier opens under its seals: issued by its genome’s maker, every later event signed by the owner of that moment', true], ['Its face is exactly the one its life draws (redrawn here and compared, pixel for pixel)', true]];
  let rec = null;
  if (s.standing === 'forked') lines.push(['Its life parts from the one recorded here at event ' + s.at + ': the first recorded wins, so this is not the card’s life (a double give)', false]);
  else if (s.standing === 'behind') lines.push(['This device holds a later life of this card: the copy you opened is out of date', false]);
  else { rec = await keep(r.dossier); lines.push([rec.ok ? (rec.outcome === 'already recorded' ? 'This device already holds exactly this life' : 'Recorded here: ' + (rec.outcome === 'recorded' ? 'a card this device had not seen' : 'the events it has grown since')) : 'It could not be recorded: ' + rec.why, rec.ok]); }
  clear(out, el('div', { class: 'status ' + (r.owner === S.me.pub ? 'ok' : '') }, r.owner === S.me.pub ? 'It is yours: ' + f.title + ', serial #' + String(r.v.serial).padStart(4, '0') + ', stage ' + f.stage + '. It is in your collection.' : 'It checks. Its owner is ' + short(r.owner) + (r.owner === S.manifest?.maker ? ' (the drop’s maker)' : '') + ', not you.'),
    el('ul', { class: 'checks' }, lines.map(([t, ok]) => el('li', { class: ok ? 'ok-t' : 'bad-t' }, (ok ? '✓ ' : '✗ ') + t))));
  emit('opened', { ok: true, id: r.id, mine: r.owner === S.me.pub, standing: s.standing });
  await renderWallet();
  if (r.owner === S.me.pub) select(r.id);
  return r;
}

// ── card me: a genesis card handed to your key ───────────────────────────────────────────────────────────────────────
// opts.domain: the next free card of that department, by serial (the game's first card is a telco one — the smallest set,
// so it boots fastest — of the account department, whose rules read no protected characteristic); opts.quiet: the
// caller moves the page, not this
async function cardMe(opts = {}) {
  const out = $('#cardme-out');
  const domainOf = (id) => (S.manifest.cards.find((c) => c.card === id) || {}).domain || '';
  const free = Object.entries(S.reg.cards).filter(([id, c]) => c.owner === S.maker.pub && c.serial > 1 && (!opts.domain || domainOf(id) === opts.domain)).sort((a, b) => a[1].serial - b[1].serial);
  if (!free.length && opts.domain) return cardMe({ ...opts, domain: null });
  if (!free.length) { say(out, 'Every genesis card on this device has been handed out.', 'bad'); return null; }
  const pick = opts.domain ? free[0][0] : free[Math.floor(Math.random() * Math.min(free.length, 50))][0];
  const r = await give(lifeOf(pick), S.maker, S.me.pub);
  if (!r.ok) { say(out, r.why, 'bad'); return null; }
  const kept = await keep(r.dossier);
  if (!kept.ok) { say(out, kept.why, 'bad'); return null; }
  await renderWallet(); await select(pick);
  say(out, 'Card #' + String(S.reg.cards[pick].serial).padStart(4, '0') + ' is yours: the drop’s maker signed it to your key. (On this page the maker’s key is the public demo key, so the page can sign that give for you; in the real drop, the maker signs it.) Now press Grow it.', 'ok');
  emit('card', { id: pick, serial: S.reg.cards[pick].serial });
  if (!opts.quiet) location.hash = '#wallet';
  return pick;
}

// ── the mesh ─────────────────────────────────────────────────────────────────────────────────────────────────────────
async function buildMesh() {
  const out = $('#mesh-out'), set = $('#mesh-set').value;
  try {
    const g = await groundOf(set, (t) => say(out, t));
    say(out, 'Gathering cards and their owners’ consents…'); await wait();
    // each genesis card is handed, for this mesh only (nothing is recorded), to its own demo owner from a public phrase —
    // the same owners organ 6 measures and the drop's post re-runs, so all three give the same numbers
    const name = 'post-' + set, cands = [];
    S.demoOwners = new Map();
    let k = 0;
    for (const dom of departments(g)) {
      const top = (S.manifest.cards || []).filter((c) => c.domain === dom && S.reg.cards[c.card] && S.reg.cards[c.card].owner === S.maker.pub).sort((a, b) => b.gate - a.gate || a.serial - b.serial).slice(0, 3);
      for (const c of top) {
        const n = k++, o = await fromSeed(sha256Bytes(utf8('digi-card/organs/owner/mesh-' + set + '-' + n))), v = await verify((await give(lifeOf(c.card), S.maker, o.pub)).dossier);
        S.demoOwners.set(o.pub, 'owner ' + (n + 1) + ' (demo)');
        cands.push({ v, consent: (await consent(o, v, name)).consent });
      }
    }
    for (const id of mine()) { const v = await verify(lifeOf(id)); if (setOf(v) === set) cands.push({ v, consent: (await consent(S.me, v, name)).consent }); }
    say(out, 'Assembling ' + cands.length + ' candidates: each must answer here and lead a coin on GATE…'); await wait();
    const m = await assemble(name, cands, g);
    if (!m.ok) return say(out, m.why, 'bad');
    S.mesh = { m, g, set }; S.ledger = [];
    renderMesh();
    emit('mesh', { set, gate: m.gate, best: m.best, fielded: m.fielded.length });
  } catch (e) { say(out, String(e.message || e), 'bad'); }
}
function renderMesh() {
  const { m } = S.mesh, out = $('#mesh-out');
  const kpi = (v, l) => el('div', { class: 'kpi' }, el('div', { class: 'v' }, v), el('div', { class: 'l' }, l));
  const who = (o) => (o === S.me.pub ? 'you' : o === S.maker.pub ? 'drop maker' : (S.demoOwners && S.demoOwners.get(o)) || short(o));
  const rows = m.members.map((x) => el('tr', {},
    el('td', { class: 'num' }, x.card ? x.card.slice(0, 8) : '—'), el('td', { class: 'num' }, who(x.owner)), el('td', {}, x.domains || ''), el('td', { class: 'num' }, auc(x.gate)),
    el('td', {}, x.joined ? el('span', { class: 'chip live' }, 'fielded') : el('span', { class: 'dim' }, x.why)),
    el('td', { class: 'num' }, x.contribution != null ? (x.contribution > 0 ? '+' : '') + auc(x.contribution) : ''),
    el('td', { class: 'num' }, x.share != null ? (x.share / 1e4).toFixed(2) + '%' : '')));
  clear(out,
    el('div', { class: 'kpis' }, kpi(auc(m.gate), 'the mesh, GATE AUC (out of fold)'), kpi(auc(m.best), 'its best single card'), kpi(String(m.fielded.length), 'cards fielded'), kpi(String(m.members.length - m.fielded.length), 'on the bench')),
    el('div', { class: 'tw' }, el('table', {}, el('thead', {}, el('tr', {}, ['Card', 'Owner', 'Mind', 'GATE', 'In the mesh', 'Contribution', 'Share'].map((h) => el('th', {}, h)))), el('tbody', {}, rows))));
  renderLedger();
}
function meshAsk() {
  if (!S.mesh) return;
  const { m, g } = S.mesh, row = g.ds.testRows[Math.floor(Math.random() * g.ds.testRows.length)], a = ask(m, caseAt(g, row));
  clear($('#mesh-ask-out'), el('div', { class: 'answer' }, el('div', { class: 'v' }, a.verdict === 'VERIFIED' ? 'score ' + a.score : 'ABSTAIN'), el('div', {}, a.verdict === 'VERIFIED' ? a.heard + ' of ' + m.fielded.length + ' members answered; only their scores crossed, never a record.' : a.why),
    el('div', { class: 'dim' }, 'TEST case #' + row + ': what really happened was ' + (g.ds.y[row] ? 'yes' : 'no') + '.')));
}
async function meshJob() {
  if (!S.mesh) return;
  const n = Math.max(1, Math.min(1e6, Math.round(Number($('#mesh-cases').value) || 0))), r = work(S.mesh.m, S.ledger, { job: 'job-' + (S.ledger.length + 1), cases: n });
  if (!r.ok) return say($('#mesh-ledger'), r.why, 'bad');
  S.ledger = r.log; renderLedger();
}
function renderLedger() {
  const t = tally(S.ledger, S.mesh.m);
  clear($('#mesh-ledger'), el('p', { class: 'dim' }, S.ledger.length + ' job' + (S.ledger.length === 1 ? '' : 's') + ' in the ledger; replayed from the shares just now: ' + (t.ok ? 'every credit holds.' : t.why)),
    t.ok && Object.keys(t.totals).length ? el('div', { class: 'tw' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Owner'), el('th', {}, 'Credits (cases × share, millionths)'))),
      el('tbody', {}, Object.entries(t.totals).map(([o, c]) => el('tr', {}, el('td', { class: 'num' }, o === S.me.pub ? 'you' : o === S.maker.pub ? 'drop maker' : (S.demoOwners && S.demoOwners.get(o)) || short(o)), el('td', { class: 'num' }, c.toLocaleString())))))) : null);
}

// ── your own table ───────────────────────────────────────────────────────────────────────────────────────────────────
let ownText = null;
async function ownFile(file) {
  if (!file) return;
  ownText = await file.text();
  const head = (ownText.split(/\r?\n/)[0] || '').split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  clear($('#own-target'), head.map((h) => el('option', { value: h }, h)));
  $('#own-target').value = head[head.length - 1];
  ownValues();
  $('#own-step2').hidden = false;
  say($('#own-out'), file.name + ': ' + kb(file.size) + ', ' + (ownText.split(/\r?\n/).filter(Boolean).length - 1).toLocaleString() + ' rows. It stays on this device.');
}
function ownValues() {
  const t = $('#own-target').value, lines = ownText.split(/\r?\n/).filter(Boolean), head = lines[0].split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1')), j = head.indexOf(t);
  const seen = lines.slice(1, 2001).map((l) => (l.split(',')[j] || '').trim().replace(/^"(.*)"$/, '$1')), vals = [...new Set(seen)].slice(0, 20);
  clear($('#own-positive'), vals.map((x) => el('option', { value: x }, x)));
  // the likely “yes”: a yes-like word if there is one, else the rarer answer (cases are usually the minority)
  const yes = vals.find((x) => /^(yes|y|true|1|positive)$/i.test(x)) || vals.slice().sort((a, b) => seen.filter((s) => s === a).length - seen.filter((s) => s === b).length)[0];
  if (yes !== undefined) $('#own-positive').value = yes;
}
async function ownGrow() {
  const out = $('#own-out'), opts = { target: $('#own-target').value, positive: $('#own-positive').value, name: $('#own-name').value.trim() };
  const g = ownGround(ownText, opts);
  if (!g.ok) return say(out, g.why, 'bad');
  const set = 'own-' + g.id.slice(4, 12);
  S.own.set(set, { ...g, text: ownText, opts });
  if ($('#own-keep') && $('#own-keep').checked) {   // kept in this browser only if its owner asks: then its card still grows tomorrow
    const owns = (await load('owns')) || [];
    if (!owns.some((o) => o.set === set)) { owns.push({ set, text: ownText, opts }); await save('owns', owns); S.storedOwns = true; }
  }
  for (const [k, seed] of seedsFor(g.id, 3).entries()) {
    const t0 = Date.now(), tick = setInterval(() => say(out, 'Searching for a mind on your ' + g.ds.fitRows.length.toLocaleString() + ' FIT rows (try ' + (k + 1) + ' of 3) — ' + Math.round((Date.now() - t0) / 1000) + ' s…'), 500);
    const r = await work_({ op: 'search', own: { text: ownText, opts }, domain: g.ds.name, seed, bar: 0.6 });
    clearInterval(tick);
    if (r.ok && r.state === 'live') {
      const sealed = await seal({ name: g.ds.name, parents: [], gate: { auc: 0.6 }, organs: [r.fixed] }, S.me);
      if (!sealed.ok) return say(out, sealed.why, 'bad');
      const serial = nextSerial(), c = await issue(sealed.text, S.me, { serial, to: S.me.pub, theme: themeOf(serial), generation: 0 });
      const kept = await keep(c.dossier);
      if (!kept.ok) return say(out, kept.why, 'bad');
      await renderWallet(); await select(kept.entry ? kept.entry.card : sealed.id);
      emit('minted', { ok: true, id: kept.entry ? kept.entry.card : sealed.id, gate: r.gate });
      return say(out, 'Your DIGI is grown: GATE AUC ' + auc(r.gate) + ' on ' + g.ds.gateRows.length.toLocaleString() + ' of your rows it never grew on. You are its maker and its owner. Measurements it read: ' + g.used.join(', ') + (g.left.length ? '. Left out (not numbers): ' + g.left.join(', ') : '') + '.', 'ok');
    }
    say(out, 'Try ' + (k + 1) + ': ' + (r.ok ? 'the mind it found scores ' + auc(r.gate) + ' on GATE, under the 0.6 bar' : r.why));
  }
  emit('minted', { ok: false });
  say(out, 'No mind cleared the 0.6 bar on your table in three searches. That can be the honest answer: these columns may not predict that outcome well. Nothing was minted.', 'bad');
}

// ── the drop ─────────────────────────────────────────────────────────────────────────────────────────────────────────
async function renderDrop(stats) {
  const m = S.manifest, first = lifeOf(m.first.card);
  await drawCard($('#hero-card'), first); await drawCard($('#drop-card'), first);
  const per = {};
  for (const c of m.cards) (per[c.domain] ||= []).push(c.gate);
  const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[(s.length - 1) >> 1]; };
  setK('drop-total', m.total.toLocaleString()); setK('drop-depts', String(Object.keys(per).length)); setK('drop-ms', String(stats.ms)); setK('drop-head', short(m.log.head));
  setK('decoder-hash', short(m.decoder.hash)); setK('decoder-files', String(Object.keys(m.decoder.files).length)); setK('first-domain', m.first.domain); setK('first-gate', auc(m.first.gate)); setK('maker', short(m.maker));
  setK('first-bytes', utf8(encode(first)).length.toLocaleString()); setK('capacity', CAPACITY.toLocaleString()); setK('first-events', String(first.events.length));
  setK('drop-status', stats.decoderOk ? 'replayed here from nothing in ' + stats.ms + ' ms: every card checks, and the decoder this page runs hashes to the one #0001 names' : 'the decoder files here do not hash to the one #0001 names');
  setK('demo', m.demo ? 'This drop is sealed with the public DEMO maker key (its phrase is in src/drop.mjs), so anyone can reproduce every seal. The real drop is sealed by its owner’s own key; nothing else changes.' : 'Sealed by the drop owner’s own key.');
  // distinct scores: every card's rule shape is its own, but a department of few columns leaves a search little room, so
  // many shapes can rank the cases identically (adult-tax reads only capital gain and loss) — the table says how many
  // TEST, from organ 2's committed record: the cases nothing in the build fitted or selected on, read once, by the seal
  const r2 = await fetch('data/organ-2/record.json').then((r) => (r.ok ? r.json() : null)).catch(() => null), test = (d) => (r2 && r2.departments[d] ? auc(r2.departments[d].medianTest) : '—');
  clear($('#drop-depts'), el('table', {}, el('thead', {}, el('tr', {}, ['Department', 'Cards', 'Distinct GATE scores', 'Median GATE', 'Best GATE', 'Median TEST (organ 2)'].map((h) => el('th', {}, h)))),
    el('tbody', {}, Object.entries(per).map(([d, gs]) => el('tr', {}, el('td', {}, d), el('td', { class: 'num' }, String(gs.length)), el('td', { class: 'num' }, String(new Set(gs).size)), el('td', { class: 'num' }, auc(med(gs))), el('td', { class: 'num' }, auc(Math.max(...gs))), el('td', { class: 'num' }, test(d)))))));
  // what a minute of searching costs, from the price lock: the chip's rated power for sixty seconds at the sourced price
  const lock = await fetch('data/prices.lock.json').then((r) => r.json()).catch(() => null);
  if (lock) { const p = Object.fromEntries(lock.entries.map((e) => [e.id, e])), w = p['intel-i7-1255u-power'].wattsLow, pence = p['desnz-electricity-nondomestic'].pencePerKwh, kwh = (w * 60) / 3600 / 1000; setK('search-cost', w + ' W for a minute is ' + kwh.toFixed(5) + ' kWh — at ' + pence + 'p a kWh (DESNZ, ' + p['desnz-electricity-nondomestic'].checked + '), about ' + (kwh * pence).toFixed(4) + 'p a search'); }
}
async function rerunDrop() {
  const out = $('#drop-out');
  say(out, 'Fetching decoder v1 and the drop log, then replaying every card from nothing…'); await wait();
  const receipt = lifeOf(S.manifest.first.card).events[1].receipt, t0 = performance.now(), r = await checkDrop(receipt, { decoder: S.decoder, log: S.glog, maker: S.manifest.maker });
  emit('drop', { ok: r.ok, ms: Math.round(performance.now() - t0) });
  say(out, r.ok ? '✓ The drop re-runs: ' + S.glog.length.toLocaleString() + ' cards replayed to head ' + short(receipt.log) + ' (the one #0001 names), every seal and signature checked, all of one maker; and the decoder here hashes to ' + short(S.decoder) + ', the one #0001 names. (' + Math.round(performance.now() - t0) + ' ms)' : '✗ ' + r.why, r.ok ? 'ok' : 'bad');
}
async function regrow() {
  const out = $('#regrow-out'), serial = Math.round(Number($('#regrow-serial').value));
  const c = serial === 1 ? S.manifest.first : S.manifest.cards.find((x) => x.serial === serial);
  if (!c) return say(out, 'There is no genesis card #' + serial + '.', 'bad');
  try {
    const g = await groundOf(c.domain.split('-')[0], (t) => say(out, t)), t0 = performance.now(), o = organOf(c.recipe, viewOf(g, c.domain), S.manifest.bar);
    const canvas = el('canvas', { class: 'card', width: W, height: H, role: 'img', 'aria-label': 'Genesis card #' + serial });
    clear(out, el('div', { class: 'status ' + (o.gate === c.gate ? 'ok' : 'bad') }, (o.gate === c.gate ? '✓ ' : '✗ ') + '#' + String(serial).padStart(4, '0') + ' (' + c.domain + '): its mind, re-grown here from the recipe it carries, scores ' + (o.gate / 1e6).toFixed(6) + ' on GATE in ' + Math.round(performance.now() - t0) + ' ms; the manifest declared ' + (c.gate / 1e6).toFixed(6) + '. The search that found it is ' + c.found.split(' ').slice(2, 5).join(' ') + ' — run it yourself (node tools/genesis.mjs) and it finds the very same mind.'),
      el('div', { class: 'row' }, canvas, el('div', {}, el('p', { class: 'dim' }, 'A picture of a card posted on social media is only a picture (sites re-compress images, and the band’s exact bytes are lost). The card itself is this PNG:'),
        el('button', { onclick: async () => download((await cardOf(lifeOf(c.card), paint)).png, 'digi-' + String(serial).padStart(4, '0') + '-' + c.card + '.png') }, 'Download card #' + String(serial).padStart(4, '0')))));
    drawCard(canvas, lifeOf(c.card));
  } catch (e) { say(out, String(e.message || e), 'bad'); }
}

// ── the cost case: priced from the lock, the milliseconds measured here on the real records ─────────────────────────
async function costRun() {
  const out = $('#cost-out'), set = $('#cost-set').value;
  try {
    const lock = await fetch('data/prices.lock.json').then((r) => r.json()), g = await groundOf(set, (t) => say(out, t));
    const best = S.manifest.cards.filter((c) => c.domain.startsWith(set + '-')).sort((a, b) => b.gate - a.gate)[0];
    const v = await verify(lifeOf(best.card)), mind = mindOf(v, g), rows = g.ds.testRows, cases = rows.map((i) => caseAt(g, i));
    say(out, 'Timing the card on ' + cases.length.toLocaleString() + ' real cases…'); await wait();
    const t0 = performance.now(); for (const x of cases) answer(mind, x); const ms = (performance.now() - t0) / cases.length;
    const ask = 'You are scoring ' + SETS[set].title.toLowerCase() + '. Given this record, answer yes if it ' + SETS[set].outcome + ', otherwise no.\n', text = ask + g.ds.features.map((f) => f + ': ' + cases[0][f]).join('\n');
    const monthly = Math.max(1, Number($('#cost-cases').value) || 1), chosen = $('#cost-model').value || undefined;
    const r = costCase({ cases: monthly, minutes: Math.max(0.1, Number($('#cost-minutes').value) || 1), tokensIn: tokensOf(text), tokensOut: 2, ms: Math.max(1e-6, ms), model: chosen }, lock);
    if (!r.ok) return say(out, r.why, 'bad');
    const gbp = (x) => '£' + (x >= 100 ? Math.round(x).toLocaleString('en-GB') : x >= 1 ? x.toFixed(2) : new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 2 }).format(x));
    const sent = monthly * 12 * r.years.length, kpi = (v, l) => el('div', { class: 'kpi' }, el('div', { class: 'v' }, v), el('div', { class: 'l' }, l));
    clear(out, el('div', { class: 'kpis' }, kpi(gbp(r.saving.vsHand), 'staff time taken off, 3 years (either AI way)'), kpi(sent.toLocaleString('en-GB'), 'records sent out of the building by renting'), kpi('0', 'records sent out by the card'), kpi(gbp(r.total.card), 'the card’s electricity, 3 years')),
      el('p', {}, el('b', {}, 'Either AI way takes ' + gbp(r.saving.vsHand) + ' of staff time off these cases over three years. Renting sends ' + sent.toLocaleString('en-GB') + ' records out of the building and bills ' + gbp(r.total.rented) + ' (' + r.model.model + '); the card sends none and costs ' + gbp(r.total.card) + ' of electricity.'),
        ' Cheap cloud models are cheap per case — the difference that matters is that every rented answer is a record handed to a processor, and every card answer is not.'),
      el('div', { class: 'tw' }, el('table', {}, el('thead', {}, el('tr', {}, ['', 'Per case', 'Year 1', 'Year 2', 'Year 3'].map((h) => el('th', {}, h)))), el('tbody', {}, ['hand', 'rented', 'card'].map((k) => el('tr', {}, el('td', {}, { hand: 'By hand', rented: 'Rented model', card: 'DIGI card' }[k]), el('td', { class: 'num' }, gbp(r.perCase[k])), r.years.map((y) => el('td', { class: 'num' }, gbp(y[k])))))))),
      el('p', { class: 'dim', style: 'font-size:13px' }, 'Measured here: ' + ms.toFixed(4) + ' ms per case (card #' + String(best.serial).padStart(4, '0') + ', ' + best.domain + '). A case sent to a model: about ' + tokensOf(text) + ' tokens in (the record and the question, at about four characters a token), 2 out. Staff and electricity rise with CPI (' + (r.used.cpi * 100).toFixed(1) + '%); token prices are the provider’s today. Sources: ',
        r.used.sources.map((s, k) => [k ? ', ' : '', el('a', { href: s.source }, s.id), ' (' + s.checked + ')']), '.'));
  } catch (e) { say(out, String(e.message || e), 'bad'); }
}

/** every price the cost case reads, shown before anything is computed: the lock's entries with their sources and dates */
async function renderPrices() {
  const lock = await fetch('data/prices.lock.json').then((r) => r.json()).catch(() => null);
  if (!lock) return;
  const what = (e) => (e.kind === 'api' ? e.provider + ' ' + e.model + ': $' + e.inPerM + ' in / $' + e.outPerM + ' out per million tokens' : e.id === 'uk-national-living-wage' ? 'UK National Living Wage: £' + e.value + ' an hour' : e.id === 'desnz-electricity-nondomestic' ? 'UK non-domestic electricity: ' + e.pencePerKwh + 'p a kWh' : e.id === 'intel-i7-1255u-power' ? e.chip + ': ' + e.wattsLow + ' W base power' : e.id === 'fx-gbp-usd' ? 'Pounds per dollar: ' + e.gbpPerUsd : e.id === 'ons-cpi' ? 'UK CPI, 12 months: ' + (e.value * 100).toFixed(1) + '%' : e.id);
  clear($('#cost-prices'), el('details', { 'data-quote': 'sourced' }, el('summary', {}, 'Every price this case reads, with its source (' + lock.entries.length + ', from ' + lock.registry + ', pulled ' + lock.pulled + ')'),
    el('ul', {}, lock.entries.map((e) => el('li', {}, what(e) + ' — ', el('a', { href: e.source }, 'source'), ' (checked ' + e.checked + ')')))));
}

// ── the drop's public posts, each re-run here through the claim gate ─────────────────────────────────────────────────
const pad4 = (s) => String(s).padStart(4, '0'), three = (g) => (g / 1e6).toFixed(3);
const cardBySerial = (serial) => (serial === 1 ? { ...S.manifest.first, serial: 1 } : S.manifest.cards.find((c) => c.serial === serial));
const pageCheckers = {
  async drop() { const r = await checkDrop(lifeOf(S.manifest.first.card).events[1].receipt, { decoder: S.decoder, log: S.glog, maker: S.manifest.maker }); return r.ok ? { ok: true, says: [String(S.manifest.total), '0001'] } : r; },
  async grown({ serial }) { const c = cardBySerial(serial), o = organOf(c.recipe, viewOf(await groundOf(c.domain.split('-')[0]), c.domain), S.manifest.bar); return o.ok && o.gate === c.gate ? { ok: true, says: [pad4(serial), three(o.gate), String(o.gate / 1e6)] } : { ok: false, why: 'it scores ' + o.gate + ' here' }; },
  async offline({ serial }) { const c = cardBySerial(serial), view = viewOf(await groundOf(c.domain.split('-')[0]), c.domain), p = probeOffline(() => organOf(c.recipe, view, S.manifest.bar)); return p.ok && !p.networkTouched ? { ok: true, says: [pad4(serial)] } : { ok: false, why: 'it reached for the network' }; },
  async verified({ serial }) { const c = cardBySerial(serial), r = await readCard((await cardOf(lifeOf(c.card), paint)).png, paint); return r.ok ? { ok: true, says: [pad4(serial)] } : r; },
  async mesh({ set }) {
    const g = await groundOf(set), name = 'post-' + set, cands = [];
    let k = 0;
    for (const d of [...new Set(S.manifest.cards.filter((c) => c.domain.startsWith(set + '-')).map((c) => c.domain))]) for (const c of S.manifest.cards.filter((x) => x.domain === d).sort((a, b) => b.gate - a.gate || a.serial - b.serial).slice(0, 3)) {
      const o = await fromSeed(sha256Bytes(utf8('digi-card/organs/owner/mesh-' + set + '-' + k++))), v = await verify((await give(dossierOf(S.reg, c.card), S.maker, o.pub)).dossier);
      cands.push({ v, consent: (await consent(o, v, name)).consent });
    }
    const r = await assemble(name, cands, g);
    return r.ok ? { ok: true, says: [String(r.fielded.length), three(r.gate), three(r.best)] } : r;
  },
};
async function renderPosts() {
  const posts = await fetch('docs/posts.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!posts) return;
  clear($('#posts'), posts.posts.map((p) => {
    const out = el('div', { 'aria-live': 'polite' });
    return el('div', { class: 'answer' }, el('p', { style: 'margin:0' }, p.text), el('div', { class: 'row' }, el('span', { class: 'dim' }, 'rests on: ' + p.claims.map((c) => c.kind).join(', ')),
      el('button', { onclick: async () => { say(out, 'Re-running its claims here…'); const g = await claimGate(p, pageCheckers); say(out, g.ok ? '✓ Every claim re-ran here, and every number in it is one they just gave: ' + g.says.join(', ') : '✗ ' + g.why, g.ok ? 'ok' : 'bad'); } }, 'Re-run its claims here')), out);
  }));
}

// ── traces: a real level, a real birth and a real refused double sale, read from the organs' committed records ───────
async function renderTraces() {
  const get = (k) => fetch('data/organ-' + k + '/record.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [r3, r4, r5] = await Promise.all([get(3), get(4), get(5)]), items = [];
  const l = r3 && r3.levels.find((x) => x.testAfter > x.testBefore);
  if (l) items.push(el('li', {}, el('b', {}, 'A level. '), 'Genesis card #' + pad4(l.serial) + ' (' + l.domain + ') ran the search its life named (seed ' + l.seed + '): GATE ' + (l.before / 1e6).toFixed(6) + ' → ' + (l.after / 1e6).toFixed(6) + '. Signed in, re-run exactly and deeply, five forged copies of the receipt refused; on TEST, which it never saw, ' + (l.testBefore / 1e6).toFixed(3) + ' → ' + (l.testAfter / 1e6).toFixed(3) + '.'));
  const b = r4 && r4.rows.find((x) => x.born && x.kind === 'cross');
  if (b) items.push(el('li', {}, el('b', {}, 'A fusion. '), 'Cards #' + pad4(b.a) + ' (' + b.domains[0] + ', GATE ' + three(b.parentsGate[0]) + ') and #' + pad4(b.b) + ' (' + b.domains[1] + ', GATE ' + three(b.parentsGate[1]) + ') fused into a card carrying both minds: GATE ' + three(b.gate) + ', beating both; on TEST ' + three(b.test) + ' against ' + three(b.parentsTest[0]) + ' and ' + three(b.parentsTest[1]) + '.'));
  if (r5 && r5.forkWhy && r5.forkWhy[0]) items.push(el('li', {}, el('b', {}, 'A double give. '), 'An owner signed one life of a card to two receivers; both chains checked on their own. The registry recorded the first and refused the second: “', el('span', { 'data-quote': 'sealed' }, r5.forkWhy[0]), '” — ' + r5.doubleRefused + ' of ' + r5.doubles + ' such attempts refused in organ 5.'));
  if (items.length) clear($('#traces'), el('ul', {}, items));
}

// ── the organs' sealed verdicts ──────────────────────────────────────────────────────────────────────────────────────
async function renderProof() {
  const rows = [];
  for (let k = 1; k <= 10; k++) {
    const v = await fetch('data/organ-' + k + '/verdict.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const pre = v && (await fetch('data/organ-' + k + '/prereg.json').then((r) => (r.ok ? r.json() : null)).catch(() => null));
    if (pre) rows.push(el('tr', {}, el('td', { class: 'num' }, 'organ ' + k), el('td', { colspan: '3' }, SHOWN_AS[k] ? el('b', {}, SHOWN_AS[k] + ' · sealed as: ') : null, el('b', { 'data-quote': 'sealed' }, pre.organ), pre.disclosure ? el('div', { class: 'note' }, pre.disclosure) : null)));
    if (v) for (const x of v.verdicts) rows.push(el('tr', {}, el('td', { class: 'num' }, k + ' · ' + x.id), el('td', { 'data-quote': 'sealed' }, x.claim), el('td', {}, el('span', { class: 'chip ' + (x.pass ? 'pass' : x.kind === 'prediction' ? 'pred' : 'fail') }, x.pass ? 'held' : x.kind === 'prediction' ? 'failed — kept' : 'FAILED')), el('td', { class: 'dim', 'data-quote': 'sealed' }, x.saw)));
  }
  if (rows.length) clear($('#proof-rows'), rows);
  const all = rows.length ? [...document.querySelectorAll('#proof-rows .chip')].map((c) => c.textContent) : [];
  const held = all.filter((t) => t === 'held').length, kept = all.filter((t) => t === 'failed — kept').length, red = all.filter((t) => t === 'FAILED').length;
  if (all.length) setK('proof-tally', held + ' of ' + all.length + ' sealed rules held · ' + kept + ' failed prediction' + (kept === 1 ? '' : 's') + ' kept' + (red ? ' · ' + red + ' property failed' : ''));
}

// ── wiring ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function wire() {
  const on = (s, ev, fn) => { const n = $(s); if (n) n.addEventListener(ev, fn); };
  on('#card-me', 'click', cardMe); on('#card-me-2', 'click', cardMe);
  on('#act-grow', 'click', actGrow); on('#act-ask', 'click', () => actAsk(false)); on('#ask-own', 'click', () => actAsk(true));
  on('#act-level', 'click', actLevel); on('#act-breed', 'click', actBreed); on('#act-send', 'click', actSend);
  on('#act-download', 'click', actDownload); on('#act-verify', 'click', actVerify); on('#work-toggle', 'click', workOvernight); on('#act-skin', 'click', () => actSkin());
  on('#open-file', 'change', (e) => openFile(e.target.files[0]));
  const zone = $('#open-zone');
  if (zone) { zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('on'); }); zone.addEventListener('dragleave', () => zone.classList.remove('on')); zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('on'); openFile(e.dataTransfer.files[0]); }); }
  on('#mesh-build', 'click', buildMesh); on('#mesh-ask', 'click', meshAsk); on('#mesh-job', 'click', meshJob);
  on('#own-file', 'change', (e) => ownFile(e.target.files[0])); on('#own-target', 'change', ownValues); on('#own-grow', 'click', ownGrow);
  on('#drop-rerun', 'click', rerunDrop); on('#regrow-btn', 'click', regrow); on('#cost-run', 'click', costRun);
  on('#key-copy', 'click', async () => { try { await navigator.clipboard.writeText(S.me.pub); say($('#key-out'), 'Your public key is copied. Give it to anyone who wants to send you a card.', 'ok'); } catch { say($('#key-out'), S.me.pub); } });
  on('#key-backup', 'click', async () => {
    const n = await saveKeyFile();
    say($('#key-out'), 'Saved your key and your ' + n + ' card(s). This file IS your ownership: whoever holds it can sign your cards away. Keep it safe; never post it. Open it here next time to hold your cards. (tools/overnight.mjs reads this file to level your cards on your own machine.)', 'ok');
  });
  on('#key-forget', 'click', async () => { await forgetStoredKey(); say($('#key-out'), 'Your key is no longer kept in this browser. It is in your key file, and in this tab until you close it.', 'ok'); });
  on('#key-restore', 'change', async (e) => {
    try {
      const j = JSON.parse(await e.target.files[0].text()), kk = j.key || j, k = await importPriv(kk.pkcs8);
      if (k.pub !== kk.pub) throw new Error('the file’s key does not match its public half');
      S.me = k; S.keySaved = true; renderMe();   // held in this tab only: the file is where it lives
      let back = 0;
      for (const d of Array.isArray(j.cards) ? j.cards : []) if ((await keep(d)).ok) back++;
      await renderWallet();
      emit('key', { restored: true, cards: back });
      say($('#key-out'), 'Restored: you are ' + short(k.pub) + ' again' + (back ? ', with ' + back + ' card(s) recorded here' : '') + '.', 'ok');
    } catch (err) { say($('#key-out'), 'That is not a DIGI key file: ' + (/does not match/.test(String(err && err.message)) ? err.message : 'the key in it could not be read') + '. Use the file “Save my key file” saved.', 'bad'); }
  });
  on('#theme-toggle', 'click', () => { const r = document.documentElement, t = r.dataset.theme === 'light' ? 'dark' : 'light'; r.dataset.theme = t; try { localStorage.setItem('digi-theme', t); } catch {} });
}

let booted;
/** resolved once the drop has replayed and the wallet is drawn: the game screens start from here */
const ready = new Promise((r) => { booted = r; });
async function boot() {
  try { const t = localStorage.getItem('digi-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
  wire();
  renderPrices();   // the sourced prices need nothing from the drop
  const status = $('#boot');
  try { await generate(); } catch { $('#nocrypto').hidden = false; say(status, 'This browser cannot sign or check Ed25519, which every card needs. Use a current Chrome, Edge, Firefox or Safari.', 'bad'); emit('failed', { why: 'no Ed25519' }); return; }
  S.me = await loadMe(); renderMe();
  S.maker = await demoMaker();
  S.checked = new Set((await load('checked')) || []);
  for (const o of (await load('owns')) || []) { const g = ownGround(o.text, o.opts); if (g.ok) { S.own.set(o.set, { ...g, text: o.text, opts: o.opts }); S.storedOwns = true; } }
  try {
    const stats = await loadDrop((t) => say(status, t));
    await loadTail();
    await renderDrop(stats);
    say(status, '✓ ' + stats.n.toLocaleString() + ' genesis cards replayed and checked here in ' + stats.ms + ' ms. You are ' + short(S.me.pub) + '.', 'ok');
    const linked = /^#card=(\d{1,4})$/.exec(location.hash);   // a post links straight to its card: re-grow it, show it, offer it
    if (linked) { $('#regrow-serial').value = String(Number(linked[1])); $('#drop').scrollIntoView(); regrow(); }
  } catch (e) { say(status, 'The drop could not be checked: ' + (e.message || e), 'bad'); }
  await renderWallet();
  renderProof(); renderPosts(); renderTraces();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  booted(S);
}
boot();

/** what the game screens drive: the same actions the page's buttons run, nothing more */
const api = { cardMe, select, actGrow, actAsk, actLevel, actBreed, fuse, actSend, actSkin, actDownload, actVerify, openFile, rerunDrop, regrow, buildMesh, meshAsk, meshJob, workOvernight,
  renderWallet, lifeOf, mine, drawCard, pixels, groundFor, groundOf, setOf, ownSetOf, protectedOf, download, saveKeyFile, forgetStoredKey, short, auc, emit, keep, load, save, paint, work: work_ };
export { S, ready, api };
