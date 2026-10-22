#!/usr/bin/env node
// tools/measure-17.mjs — organ 17, THE HERO, measured as sealed in data/organ-17/prereg.json (run tools/seal-17.mjs
// first; git proves the order). Writes data/organ-17/record.json.
//
// For each of the five businesses of the drop: HEROES seeded cards of the drop, each crowned by its own demo owner (a key
// from a public phrase) with a seeded pass (what it may do, and a limit when it may use a key). Every hero is checked;
// fifteen tampered copies of its pass are checked (each of six fields changed and left stale, each of the six changed,
// rehashed and signed by another key in the owner's name, the signature dropped, one signature character changed, the
// kind changed). Its opening is built three times from its card as this machine grows it (its live rules said by the
// talker), a sample memory and no gear, and once with another memory; a page of MAX_TURNS + 1 questions is grown with
// turns(). A limit wall is walked: a pass that may use a key with a seeded limit, and 50 seeded question costs, every one
// routed and the running total kept here apart from the kernel. Every question the talker offers for its card is routed
// with a key ready, and five questions off every business are routed the same way.
//
// Then RECYCLING, on this machine's own models (Ollama, nothing leaves it): for TIMED heroes (the first two of each
// business) a cold read of its opening and a question, two warm reads of the same opening with other questions, and a
// control (the opening of another hero of the same business, never read before, with the first question) — kar-foldcycle's protocol, judged with its
// verdict kernel. The record carries those timings: they differ run to run, and no runner without the models can re-run them.
//
// Nothing here reads TEST. SMALL=1 measures 4 heroes a business and 2 timed heroes ON OTHER SEEDS, into dry-record.json
// (a check of the tooling, never the sealed measurement).
import { writeFileSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import { CAPS, MAX_TURNS, crown, heroOk, opening, route, turns } from '../src/hero.mjs';
import { kardSignable, sha256 as kardSha, canon } from '../vendor/fall-os/kard.mjs';
import { analyze } from '../vendor/kar-foldcycle/foldcycle.mjs';
import { reply, asks, vocabOf, sayRule } from '../src/talker.mjs';
import { verify, facts } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { sayOutcome } from '../src/copy.mjs';
import { SETS } from '../src/data.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { drop, ground, owner, sampler, setOfDomain, json, mindOf } from './lib.mjs';

const SMALL = process.env.SMALL === '1', HEROES = SMALL ? 4 : 24, TIMED = 2, SEED = SMALL ? 27000 : 17000;
const MODELS = ['qwen2.5:7b', 'llama3.2:1b'], OUT = SMALL ? 'dry-record.json' : 'record.json';
const AT = (f) => new URL('../data/organ-17/' + f, import.meta.url);
/** the memory every hero's opening carries in this measurement: a player's own words, as fall-os's memory says them */
export const MEMORY = ['you are a plumber in Leeds', 'you prefer short answers', 'you are working on a booking app for your jobs', 'you mentioned Dave Smith', 'you often bring up invoices', 'you prefer evenings'];
export const OTHER = ['you are a nurse in Bristol'];
/** questions off every business: no card's rules can answer them */
export const OFF = ['What is the weather like today?', 'Write me a short poem about the sea.', 'What should I cook tonight?', 'How do I fix a leaking tap?', 'Who won the last world cup?'];
/** the passes a hero may be crowned with, in turn */
const KINDS = [['talk'], ['remember'], ['key'], ['remember', 'key']];
const AT_TIME = '2026-10-22T20:00:00.000Z';
const { m, reg } = await drop(), vocab = json('data/vocab.json'), eve = await owner('hero-eve');
const sets = [...new Set(m.cards.map((c) => setOfDomain(c.domain)))].sort();
const record = { kind: 'digi-card.organ-17.record', v: 1, small: SMALL, sets, heroes: [], recycling: [] };

/** a pass with one field changed: left stale, or rehashed and signed by another key in the owner's name */
async function changed(hero, field, value, mode) {
  const body = { ...hero, [field]: value };
  delete body.signature; delete body.hash;
  if (mode === 'stale') return { ...hero, [field]: value };
  const rehashed = { ...body, hash: kardSha(canon(body)).hash };
  return { ...rehashed, signature: { alg: 'Ed25519', pub: hero.owner, sig: await sign(eve, utf8(kardSignable(rehashed).payload)) } };
}
const flip = (h) => h.slice(0, 10) + (h[10] === '0' ? '1' : '0') + h.slice(11);

/** the opening a hero sends, built as ui/hero.js builds it, from its card as this machine grows it */
function openingOf(ok, v, mind, ctx, memory) {
  const f = facts(v), set = ok.set, live = mind.organs.filter((o) => o && o.state === 'live');
  const rules = live.flatMap((o) => o.body.rules).slice().sort((x, y) => Math.abs(y.w) - Math.abs(x.w) || (x.feat < y.feat ? -1 : 1)).map((r) => sayRule(r, ctx.voc) + ', it leans ' + (r.w > 0 ? 'yes' : 'no'));
  return opening(ok, { card: { title: f.title, department: f.department, rarity: f.rarity, stage: f.stage, gate: Number.isInteger(mind.gate) ? mind.gate : null, outcome: sayOutcome(set, SETS[set].outcome), rules }, memory, gear: [] });
}

const openings = new Map();   // set → [opening text by hero index], for the recycling part
for (const [si, set] of sets.entries()) {
  const g = await ground(set), pick = sampler(SEED + si), voc = vocabOf(vocab, set);
  const pool = m.cards.filter((c) => setOfDomain(c.domain) === set).sort((a, b) => a.serial - b.serial), chosen = [];
  while (chosen.length < HEROES) { const c = pick.pick(pool); if (!chosen.includes(c)) chosen.push(c); }
  openings.set(set, []);
  for (const [k, c] of chosen.entries()) {
    const keys = await owner('hero-' + set + '-' + k), v = await verify(dossierOf(reg, c.card)), mind = mindOf(v, g);
    const caps = KINDS[k % KINDS.length], budget = caps.includes('key') ? 1000 + pick.int(99000) : 0;
    const t0 = Date.now(), cr = await crown(keys, { card: v.id, set, theme: v.theme, caps, budget, at: AT_TIME }), crownMs = Date.now() - t0;
    const row = { set, card: v.id, serial: v.serial, caps, budget, crownMs, crowned: cr.ok, why: cr.why || '' };
    record.heroes.push(row);
    if (!cr.ok) continue;
    const hero = cr.hero, ok = await heroOk(hero);
    row.checks = ok.ok && ok.owner === keys.pub && ok.card === v.id && ok.set === set && ok.theme === v.theme && ok.caps.join() === ['talk', ...caps.filter((x) => x !== 'talk')].sort((a, b) => CAPS.indexOf(a) - CAPS.indexOf(b)).join() && ok.budget === budget;
    // P1: fifteen tampered copies, each refused
    const FIELDS = [['budgetCap', budget + 1], ['capabilities', [...hero.capabilities, 'fly']], ['label', 'kardlings hero · ' + (set === 'shop' ? 'bank' : 'shop')], ['structureRef', 'kardlings:card:' + flip(v.id)], ['skinRef', 'kardlings:theme:other-v1'], ['createdAt', '2026-10-23T20:00:00.000Z']];
    const tampers = [];
    for (const [field, value] of FIELDS) for (const mode of ['stale', 'resigned']) tampers.push(await changed(hero, field, value, mode));
    const bare = { ...hero }; delete bare.signature;
    tampers.push(bare, { ...hero, signature: { ...hero.signature, sig: flip(hero.signature.sig) } }, { ...hero, kind: 'fallkard-v2' });
    const refused = [];
    for (const t of tampers) refused.push(!(await heroOk(t)).ok);
    row.tampers = tampers.length; row.refused = refused.filter(Boolean).length;
    // P2: the opening, three times and with another memory; a page grown past MAX_TURNS
    const ctx = { mind, voc, features: g.ds.features, gate: mind.gate };
    const o = [0, 1, 2].map(() => openingOf(ok, v, mind, ctx, MEMORY)), other = openingOf(ok, v, mind, ctx, OTHER);
    row.openingTokens = o[0].tokens; row.openingHash = o[0].hash;
    row.stable = o.every((x) => x.ok && x.text === o[0].text && x.hash === o[0].hash);
    row.memoryMoves = other.text !== o[0].text;
    row.memoryShared = caps.includes('remember');
    let page = [], appendOnly = true, freshAt = null;
    for (let t = 0; t <= MAX_TURNS; t++) {
      const r = turns(page, 'question ' + t);
      if (!r.ok) { appendOnly = false; break; }
      if (r.fresh) { freshAt = t; break; }
      if (r.messages.length !== page.length + 1 || page.some((msg, i) => r.messages[i] !== msg)) appendOnly = false;
      page = [...r.messages, { role: 'assistant', content: [{ type: 'text', text: 'answer ' + t }] }];
    }
    row.appendOnly = appendOnly; row.freshAt = freshAt;
    if (k < 2 * TIMED) openings.get(set).push(o[0].text);   // the timed heroes, then one never-read control for each
    // P3: the limit wall, walked with 50 seeded costs, the running total kept here
    const B = 1000 + pick.int(99000), keyed = (await crown(keys, { card: v.id, set, theme: v.theme, caps: ['key'], budget: B, at: AT_TIME })).hero;
    let spent = 0, mism = 0, over = false;
    for (let i = 0; i < 50; i++) {
      const cost = 1 + pick.int(Math.max(1, Math.floor(B / 5))), r = route('what is the weather like?', { rules: 'ABSTAIN', recalled: 0, hero: keyed, keyReady: true, spent, cost });
      const allowed = spent + cost <= B;
      if (!r.ok || r.brain !== (allowed ? 'key' : 'none')) mism++;
      if (r.ok && r.brain === 'key') spent += cost;
      if (spent > B) over = true;
    }
    row.wall = { budget: B, spent, mismatches: mism, over };
    // P4: the talker's own questions go to the rules; questions off every business go to the key
    const offered = asks(ctx), verified = offered.filter((q) => reply(q, ctx).verdict === 'VERIFIED');
    row.offered = offered.length; row.verified = verified.length;
    row.ruled = verified.filter((q) => { const r = route(q, { rules: 'VERIFIED', recalled: 3, hero: keyed, keyReady: true, spent: 0, cost: 1 }); return r.ok && r.brain === 'rules'; }).length;
    row.off = OFF.length; row.offAbstained = OFF.filter((q) => reply(q, ctx).verdict !== 'VERIFIED').length;
    row.offKeyed = OFF.filter((q) => { const r = route(q, { rules: reply(q, ctx).verdict, recalled: 0, hero: keyed, keyReady: true, spent: 0, cost: 1 }); return r.ok && r.brain === 'key'; }).length;
  }
  console.log(set + ': ' + HEROES + ' heroes crowned and checked');
}

// ── RECYCLING on this machine's own models ─────────────────────────────────────────────────────────────────────────
function chat(model, system, question) {
  const body = JSON.stringify({ model, stream: false, keep_alive: '30m', options: { num_predict: 1, temperature: 0, num_ctx: 4096 }, messages: [{ role: 'system', content: system }, { role: 'user', content: question }] });
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 11434, path: '/api/chat', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, (res) => {
      let buf = ''; res.setEncoding('utf8'); res.on('data', (c) => { buf += c; });
      res.on('end', () => { try { const j = JSON.parse(buf); if (j.error) return reject(new Error(j.error)); resolve({ ms: Math.round((j.prompt_eval_duration || 0) / 1e6), tokens: j.prompt_eval_count || 0 }); } catch (e) { reject(e); } });
      res.on('error', reject);
    });
    req.on('error', reject); req.end(body);
  });
}
const Q = ['In one sentence: what should I do next in the game?', 'In one sentence: what is a raid?', 'In one sentence: how do I train you?'];
for (const model of MODELS) {
  await chat(model, 'You are a helpful assistant.', 'Say OK.');   // load once; excluded from every arm
  const rows = [], cold = [], warm = [], control = [];
  for (const set of sets) {
    const texts = openings.get(set);
    for (let h = 0; h < TIMED; h++) {
      const c = await chat(model, texts[h], Q[0]), w1 = await chat(model, texts[h], Q[1]), w2 = await chat(model, texts[h], Q[2]);
      const ctl = await chat(model, texts[TIMED + h], Q[0]);
      cold.push(c.ms); warm.push(w1.ms, w2.ms); control.push(ctl.ms);
      rows.push({ set, hero: h, coldMs: c.ms, coldTokens: c.tokens, warmMs: [w1.ms, w2.ms], warmTokens: [w1.tokens, w2.tokens], controlMs: ctl.ms, controlTokens: ctl.tokens });
      console.log(model + ' · ' + set + ' hero ' + h + ': cold ' + c.ms + ' ms (' + c.tokens + ' tokens), warm ' + w1.ms + '/' + w2.ms + ' ms, control ' + ctl.ms + ' ms');
    }
  }
  record.recycling.push({ model, rows, cold, warm, control, verdict: analyze({ cold, warm, control }) });
}

mkdirSync(AT(''), { recursive: true });
writeFileSync(AT(OUT), JSON.stringify(record, null, 1) + '\n');
console.log('organ 17 measured into data/organ-17/' + OUT + ' · ' + record.heroes.length + ' heroes · recycling on ' + MODELS.join(', '));
