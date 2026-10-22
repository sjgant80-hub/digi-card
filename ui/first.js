// ui/first.js — THE FIRST GAME: a new player's first five minutes, taught the way Hearthstone teaches: three short missions,
// one idea each, every one played on the real kernels here (nothing in it is scripted to look real).
//   1 · Your first Kardling: Card me signs one to you; its mind grows on its business's records here and shows its POWER
//       (its GATE AUC in hundredths: shown one case that did and one that did not, how often in a hundred it ranks them right).
//   2 · First duel: against a rookie, the weakest card of the same business the drop still holds, on 64 real cases, signed
//       and fought exactly as the Arena fights; the prize is a second card, the one of another department that teams best
//       with yours (measured, not guessed).
//   3 · Team up: the two together against their business's world boss, assembled and judged exactly as a raid party is.
// Then the key file, and the map of where to go next. It opens only on a first visit to the game view (no card held, not
// skipped before); it can be skipped at every step; and a card taken any other way (the classic Card me, a key file) closes
// it. Every number on it is one the kernels just computed on this device. Text is always set as text, never as markup.
import { S, ready, api } from '../app.js';
import { verify, facts } from '../src/dossier.mjs';
import { mindOf } from '../src/mind.mjs';
import { challenge, accept, duel } from '../src/arena.mjs';
import { worldBossesOf, partyStrike, partyOf } from '../src/raid.mjs';
import { consent } from '../src/mesh.mjs';
import { SETS } from '../src/data.mjs';
import { sayOutcome } from '../src/copy.mjs';
import { paintDuel } from '../vendor/pixelwhisperer/kards/arena.mjs';

const FIRST_DOMAIN = 'telco-account';   // the first card's department: phone customers who leave, the easiest question to picture
const COMBO = 5000;                      // the game's combo margin (src/build.mjs COMBO): a team must beat its best card by 0.005
const FLAG = 'kardlings-first-game';
const power = (m) => (m == null ? '–' : (m / 10000).toFixed(1));   // GATE AUC in millionths, read as POWER out of 100
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stored = () => { try { return localStorage.getItem(FLAG); } catch { return null; } };
const store = (v) => { try { localStorage.setItem(FLAG, v); } catch { /* private window: the tutorial simply shows again */ } };
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}

const T = { box: null, stage: null, pips: [], live: null, busy: false, mine: new Set(), set: null, ground: null, a: null, b: null, boss: null };

/** open the first game: on a first visit only, unless asked for by name (#first-game) */
async function open(force = false) {
  if (T.box) return;
  await ready;
  if (!force && (stored() || api.mine().length > 0 || !document.documentElement.classList.contains('game'))) return;
  T.live = el('p', { class: 'ft-live g-dim g-small', 'aria-live': 'polite' });
  T.pips = ['Your Kardling', 'First duel', 'Team up'].map((t, k) => el('li', {}, el('b', {}, String(k + 1)), ' ', t));
  T.stage = el('div', { class: 'ft-stage' });
  T.box = el('div', { class: 'ft', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ft-h' },
    el('div', { class: 'ft-top' }, el('ol', { class: 'ft-pips', 'aria-label': 'The three missions' }, T.pips),
      el('button', { class: 'g-btn ft-skip', type: 'button', onclick: () => close('skipped') }, 'Skip the tutorial')),
    T.stage, T.live);
  document.body.append(T.box);
  document.documentElement.classList.add('ft-on');
  title();
}
function close(how) {
  if (!T.box) return;
  store(how);
  T.box.remove(); T.box = null;
  document.documentElement.classList.remove('ft-on');
}
function step(k) { T.pips.forEach((p, j) => { p.className = j < k ? 'done' : j === k ? 'now' : ''; p.setAttribute('aria-current', j === k ? 'step' : 'false'); }); }
const say = (t) => { if (T.live) T.live.textContent = t; };
function show(...kids) {
  T.stage.replaceChildren(...kids.flat().filter(Boolean));
  const b = T.stage.querySelector('button.hot');
  if (b) b.focus();
}
const go = (label, fn) => el('button', { class: 'g-btn hot big g-next', type: 'button', onclick: async (e) => { if (T.busy) return; T.busy = true; e.currentTarget.disabled = true; try { await fn(); } catch (err) { oops(err); } finally { T.busy = false; } } }, label);
function oops(err) {
  show(el('h2', { id: 'ft-h', class: 'g-h' }, 'Something did not run here'), el('p', {}, String((err && err.message) || err)),
    el('p', { class: 'g-dim' }, 'Nothing is lost: skip the tutorial and play from the first screen.'),
    el('button', { class: 'g-btn hot big g-next', type: 'button', onclick: () => close('skipped') }, 'Play from the first screen'));
}

// ── the title: what the game is, in three lines, and one button ─────────────────────────────────────────────────────────
function title() {
  step(-1);
  show(el('h1', { id: 'ft-h', class: 'ft-title' }, 'KARDLINGS'),
    el('p', { class: 'ft-tag' }, 'Collect AI creatures. Duel them on real cases. Team them up against the bosses.'),
    el('ul', { class: 'ft-three' },
      el('li', {}, el('b', {}, 'A Kardling'), ' is a pixel creature with a small, real AI inside: it reads real records and calls one thing.'),
      el('li', {}, el('b', {}, 'A duel'), ' puts two Kardlings on the same real cases: the better caller wins.'),
      el('li', {}, el('b', {}, 'A team'), ' that beats its best player is a combo. Those are rare, and they are the game.')),
    go('Play', mission1),
    el('p', { class: 'g-dim g-small' }, 'Free · no account · everything runs on this device · about five minutes'));
}

// ── mission 1: your first Kardling, and what its POWER means ──────────────────────────────────────────────────────────────
async function mission1() {
  step(0); say('Signing your first Kardling to you…');
  const id = await api.cardMe({ quiet: true, domain: FIRST_DOMAIN });
  if (!id) throw new Error('No genesis card was left to sign to you on this device.');
  T.mine.add(id);
  const v = await verify(api.lifeOf(id)), f = facts(v), set = api.setOf(v);
  const cv = el('canvas', { class: 'ft-card', width: 384, height: 576, role: 'img', 'aria-label': 'Your first Kardling card: ' + f.title });
  show(el('h2', { id: 'ft-h', class: 'g-h' }, 'Your first Kardling'), cv, el('p', { class: 'g-dim' }, 'Its mind is growing on the real records, here…'));
  await api.drawCard(cv, api.lifeOf(id));
  say('Fetching the ' + SETS[set].title.toLowerCase() + ' records and growing its mind on this device…');
  const g = await api.groundFor(v, (t) => say(t)), m = mindOf(v, g);
  T.set = set; T.ground = g; T.a = { id, v, f, gate: m.gate };
  T.box.dataset.card = id; T.box.dataset.gate = String(m.gate);   // what tools/first-play.mjs checks against the drop's declared GATE
  const who = SETS[set].title.toLowerCase(), outcome = sayOutcome(set, SETS[set].outcome);
  say('');
  show(el('h2', { id: 'ft-h', class: 'g-h' }, 'Meet ' + f.title + ', your first Kardling'),
    el('div', { class: 'ft-two' }, cv,
      el('div', {},
        el('p', {}, 'Every Kardling is named for the job it does. This one reads the real records of ' + g.ds.y.length.toLocaleString() + ' ' + who + ' (a public dataset, no names in it) and calls one thing: who ' + outcome + '.'),
        el('div', { class: 'ft-power' }, el('span', {}, 'POWER'), el('b', {}, power(m.gate))),
        el('p', {}, 'Show it two real cases, one that ' + outcome + ' and one that did not: it picks the right one ' + power(m.gate) + ' times in 100.'),
        el('p', { class: 'g-dim g-small' }, 'Measured just now on ' + g.ds.gateRows.length.toLocaleString() + ' cases it never learned from. 50 would be a coin toss; 100 never misses.'),
        el('p', { class: 'ft-real' }, '✓ Checked on this device: its seals, its picture and its score all match what was published, so nobody can fake it.'))),
    go('Fight your first duel →', mission2));
}

// ── mission 2: a first duel, against a rookie of the same business; the prize is the card that teams best with yours ────────
async function mission2() {
  step(1); say('Finding a rookie of the same business…');
  const { a, ground: g, set } = T;
  const held = (c) => S.reg.cards[c.card] && S.reg.cards[c.card].owner === S.maker.pub;
  const pool = S.manifest.cards.filter((c) => c.domain.split('-')[0] === set && held(c) && c.card !== a.id).sort((x, y) => x.gate - y.gate || x.serial - y.serial);
  let fought = null;
  for (const c of pool.slice(0, 6)) {   // the weakest first: a fair first fight, fought for real, and the first one won is shown
    const vB = await verify(api.lifeOf(c.card)), nonce = 'first-' + c.card.slice(0, 8);
    const ch = await challenge(S.me, a.v, nonce); if (!ch.ok) continue;
    const ac = await accept(S.maker, vB, ch.challenge); if (!ac.ok) continue;
    const r = await duel(a.v, vB, g, { challenge: ch.challenge, accept: ac.accept });
    if (!r.ok) continue;
    fought = { r, vB };
    if (r.receipt.winner === 'a') break;
  }
  if (!fought) throw new Error('No rookie could be fought on this ground.');
  const { r, vB } = fought, x = r.receipt, pos = r.y.filter((t) => t === 1).length;
  const line = (sc) => [...sc].sort((p, q) => q - p)[Math.max(0, pos - 1)], lA = line(r.scores.a), lB = line(r.scores.b);
  const cases = r.batch.map((row, k) => [(r.scores.a[k] >= lA) === (r.y[k] === 1) ? 1 : 0, (r.scores.b[k] >= lB) === (r.y[k] === 1) ? 1 : 0]);
  const side = (v) => ({ id: v.id, rarity: facts(v).rarity, rating: 1000, title: facts(v).title.replace(/[^ &'.\-0-9A-Za-z]/g, '').slice(0, 16) });
  const result = x.winner === 'a' ? 'left' : x.winner === 'b' ? 'right' : 'draw', cv = el('canvas', { class: 'ft-duel', width: 480, height: 320, role: 'img', 'aria-label': 'The duel, case by case' });
  const paint = (decided) => { const p = paintDuel({ left: side(a.v), right: side(vB), cases, decided, result: decided === cases.length ? result : null }, 'synthwave-v1', 480, 320); if (!p.ok) return; const ctx = cv.getContext('2d'), img = ctx.createImageData(480, 320); for (let i = 0, j = 0; i < p.px.length; i += 3, j += 4) { img.data[j] = p.px[i]; img.data[j + 1] = p.px[i + 1]; img.data[j + 2] = p.px[i + 2]; img.data[j + 3] = 255; } ctx.putImageData(img, 0, 0); };
  const tally = el('p', { 'aria-live': 'polite' });
  show(el('h2', { id: 'ft-h', class: 'g-h' }, 'First duel: ' + a.f.title + ' against a rookie, ' + facts(vB).title),
    el('p', {}, 'The same ' + cases.length + ' real cases, one at a time: each side calls who ' + sayOutcome(set, SETS[set].outcome) + ', then the truth is shown. Cyan: only yours was right. Pink: only theirs.'), cv, tally);
  say('');
  for (let k = 0; k <= cases.length; k += calm() ? cases.length : 1) {
    paint(k);
    const mine = cases.slice(0, k).filter((c) => c[0]).length, theirs = cases.slice(0, k).filter((c) => c[1]).length;
    tally.textContent = 'Case ' + k + ' of ' + cases.length + ' · yours right ' + mine + ' · theirs right ' + theirs;
    if (k < cases.length) await sleep(45);
  }
  const won = x.winner === 'a';
  tally.replaceChildren(el('b', { class: won ? 'ft-win' : 'ft-lose' }, won ? 'YOU WIN' : x.winner === 'b' ? 'THE ROOKIE WINS' : 'A DRAW'),
    ' · on these ' + cases.length + ' cases yours scored ' + power(x.a.auc) + ', theirs ' + power(x.b.auc) + '. The duel goes to the better ranking of all ' + cases.length + '; a batch this small swings more than POWER, which was measured on ' + g.ds.gateRows.length.toLocaleString() + ' cases.');
  // the prize: of the business's other departments, the card that teams best with yours, measured as a raid party here
  say('Picking your prize: the card of another department that teams best with yours…');
  const boss = await bossOf(set), names = facts(a.v).department, tried = [];
  for (const dom of [...new Set(pool.map((c) => c.domain))].sort()) {
    if (dom === set + '-' + names) continue;
    const c = S.manifest.cards.filter((y) => y.domain === dom && held(y) && y.serial > 1).sort((p, q) => p.serial - q.serial)[0];
    if (!c) continue;
    const vC = await verify(api.lifeOf(c.card)), t = await team(boss, [[S.me, a.v], [S.maker, vC]]);
    if (t.ok) tried.push({ dom, lift: t.clear.gate - t.best });
  }
  tried.sort((p, q) => q.lift - p.lift || (p.dom < q.dom ? -1 : 1));
  const prize = await api.cardMe({ quiet: true, domain: tried.length ? tried[0].dom : FIRST_DOMAIN });
  if (!prize) throw new Error('No second card was left to sign to you on this device.');
  T.mine.add(prize);
  const vP = await verify(api.lifeOf(prize)), cp = el('canvas', { class: 'ft-card ft-small', width: 384, height: 576, role: 'img', 'aria-label': 'Your prize: ' + facts(vP).title });
  await api.drawCard(cp, api.lifeOf(prize));
  T.b = { id: prize, v: vP, f: facts(vP) }; T.boss = boss;
  say('');
  T.stage.append(el('div', { class: 'ft-prize' }, cp, el('div', {}, el('h3', {}, 'Your prize: ' + facts(vP).title),
    el('p', {}, 'A second Kardling of the same business, from another department: of the ' + tried.length + ' departments tried, the one that teams best with yours.'),
    go('Team them up →', mission3))));
  T.stage.querySelector('.ft-prize button').focus();
}
async function bossOf(set) {
  const admission = await fetch('drop/admission.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const boss = worldBossesOf(admission).find((b) => b.set === set);
  if (!boss) throw new Error('The world boss of this business could not be read here.');
  return boss;
}
async function team(boss, members) {   // members: [[keys, v]]; each owner consents for this business's raid, then the party strikes
  const cands = [];
  for (const [keys, v] of members) { const c = await consent(keys, v, partyOf(boss.set)); if (c.ok) cands.push({ v, consent: c.consent }); }
  return partyStrike(boss, cands, T.ground);
}

// ── mission 3: the two as a team against the business's world boss ───────────────────────────────────────────────────────
async function mission3() {
  step(2); say('Your team takes on the world boss…');
  const { a, b, boss, set } = T, r = await team(boss, [[S.me, a.v], [S.me, b.v]]);
  if (!r.ok) throw new Error(r.why);
  const lift = r.clear.gate - r.best, played = r.clear.members.length;
  const verdict = lift >= COMBO ? el('p', { class: 'ft-combo' }, 'COMBO! Together they beat the best of them by ' + power(lift) + '.')
    : lift > 0 ? el('p', {}, 'A small team bonus, +' + power(lift) + '. A combo needs +' + power(COMBO) + ' or more: keep hunting.')
      : el('p', {}, 'No team bonus this time: together they do no better than the best of them. Teams that add up are rare: that is the hunt.');
  say('');
  show(el('h2', { id: 'ft-h', class: 'g-h' }, 'Team up: against the ' + SETS[set].title.toLowerCase() + ' world boss'),
    el('p', {}, 'A world boss is a whole business at a bar no single search ever reached. Your two Kardlings play as one team, measured on the same real cases.'),
    el('div', { class: 'ft-score' },
      el('div', {}, el('span', {}, 'THE BOSS'), el('b', {}, power(boss.bar))),
      el('div', {}, el('span', {}, 'YOUR TEAM'), el('b', {}, power(r.clear.gate))),
      el('div', {}, el('span', {}, 'BEST ALONE'), el('b', {}, power(r.best)))),
    el('p', {}, played === 2 ? 'Both of your cards played.' : 'Only one card played: the other added nothing here, so it sat on the bench.'),
    verdict,
    el('p', { class: r.cleared ? 'ft-win' : '' }, r.cleared ? 'THE BOSS FALLS! Your team cleared its bar.' : 'The boss still stands: it needs ' + power(boss.bar) + '. Bigger teams (up to six cards) and stronger cards can take it.'),
    lift >= COMBO ? el('p', { class: 'g-dim g-small' }, 'A combo counts once a second player re-runs it on their own device and gets the very same score. Then it goes in the build book.') : null,
    go('Keep your Kardlings →', finish));
}

// ── the end of the first game: the key file, and where to go next ────────────────────────────────────────────────────────
function finish() {
  step(3);
  T.box.dataset.held = String(api.mine().length);
  const doors = [['arena', 'Arena', 'Duel any Kardling of your business. Win to climb the ladder.'], ['raids', 'Raids', 'The world bosses: build a team that clears the bar.'],
    ['fusion', 'Fusion lab', 'Fuse your two cards: kept only if the new card beats both.'], ['kit', 'Kit', 'Give your Kardling parts and tools; each one must add.'], ['estate', 'Estate', 'Your world: every card you hold is a block on your plot.']];
  show(el('h2', { id: 'ft-h', class: 'g-h' }, 'Keep your Kardlings'),
    el('p', {}, 'Your cards are signed to a key made on this device. Save your key file: it is what makes them yours next time. No account, no email: it stays with you.'),
    el('button', { class: 'g-btn big', type: 'button', onclick: () => api.saveKeyFile() }, 'Save my key file'),
    el('h3', {}, 'Where next'),
    el('ul', { class: 'ft-doors' }, doors.map(([s, t, d]) => el('li', {}, el('a', { href: '#' + s, onclick: () => close('done') }, t), ' · ', d))),
    el('button', { class: 'g-btn hot big g-next', type: 'button', onclick: () => { close('done'); location.hash = '#estate'; } }, 'Start playing →'));
}

// a card taken any other way closes the first game; #first-game opens it again
addEventListener('digi', (e) => { const d = e.detail || {}; if (T.box && !T.busy && ((d.type === 'card' && !T.mine.has(d.id)) || (d.type === 'key' && d.restored))) close('skipped'); });
addEventListener('hashchange', () => { if (location.hash === '#first-game') open(true); });
open(location.hash === '#first-game');
