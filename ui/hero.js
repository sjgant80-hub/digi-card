// ui/hero.js — THE HERO SCREEN: one of your cards, crowned, that you talk to, teach about you, train and power.
//
// The rules are src/hero.mjs (mutation-gated): the pass you sign is fall-os's kard; a question goes to the card's own
// rules first (the talker), then what your hero remembers of you (fall-os's memory, kept on this device), and only then
// your own AI key, inside the limit your pass sets. Your key is held in this tab only: it is never written to this
// browser's storage or to your key file, and it goes only to the provider you chose. What your hero sends a provider is
// one fixed opening, the same bytes every question, so the provider can reuse the reading it already did; every answer
// on a key shows how much was reused. Your chat history is read here and never sent anywhere: only the facts found in it
// are kept, on this device.
import { S, ready, api } from '../app.js';
import { game, screen } from './game.js';
import { verify, facts } from '../src/dossier.mjs';
import { reply, sayRule, asks } from '../src/talker.mjs';
import { MAX_TURNS, classOf, crown, heroOk, opening, route, kindsAsked, fromMemory, costOf, turns, usedOf, levelOf, STEPS } from '../src/hero.mjs';
import { parseExport, extractFacts, dedupe, bucket, recall, BUCKETS } from '../vendor/fall-os/seed.mjs';
import { sayOutcome } from '../src/copy.mjs';
import { paintHero } from '../vendor/pixelwhisperer/kards/hero.mjs';
import { SETS } from '../src/data.mjs';

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
const num = (n) => Number(n).toLocaleString('en-GB');
const pad4 = (n) => String(n).padStart(4, '0');

/** the providers a hero can use your key with: where it goes, the models offered, and the one each starts on */
const PROVIDERS = {
  anthropic: { name: 'Anthropic (Claude)', models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'], get: 'console.anthropic.com' },
  openai: { name: 'OpenAI', models: ['gpt-4.1-mini', 'gpt-4.1'], get: 'platform.openai.com' },
  google: { name: 'Google (Gemini)', models: ['gemini-2.5-flash', 'gemini-2.5-pro'], get: 'aistudio.google.com' },
  openrouter: { name: 'OpenRouter (many models)', models: ['openrouter/auto'], get: 'openrouter.ai' },
};
const MAX_OUT = 4000;   // the longest answer a key is asked for (thinking included): part of every question's reckoning
const H = { hero: null, ok: null, memory: null, stats: null, key: '', provider: 'anthropic', model: 'claude-opus-5-5', page: [], pageOf: '', busy: false, spent: 0 };

// ── what this device keeps for the hero: the signed pass, its memory, what its key has used; never the key ────────────
async function loadHero() {
  H.hero = (await api.load('hero')) || null;
  H.ok = H.hero ? await heroOk(H.hero) : null;
  const m = await api.load('hero-memory');
  H.memory = m && m.memory ? m.memory : null; H.stats = m && m.stats ? m.stats : null;
  H.spent = H.hero ? Number((await api.load('hero-spent:' + H.hero.hash)) || 0) : 0;
  try { const p = JSON.parse(localStorage.getItem('kardlings-hero-provider') || 'null'); if (p && PROVIDERS[p.provider]) { H.provider = p.provider; H.model = typeof p.model === 'string' && p.model ? p.model : PROVIDERS[p.provider].models[0]; } } catch {}
}
const st = () => game.state();
/** what this hero has done: its own questions answered and key answers, kept per crowned card (a new hero starts at none) */
const acts = () => { const all = (st().heroActs ||= {}), id = heroCard() || '-'; return (all[id] ||= { asked: 0, keyed: 0 }); };
/** the hero's card, if this key still holds it */
const heroCard = () => (H.ok && H.ok.ok && H.ok.owner === S.me.pub && api.mine().includes(H.ok.card) ? H.ok.card : null);

// ── crowning ─────────────────────────────────────────────────────────────────────────────────────────────────────────
async function crownIt() {
  const id = $('#g-hr-pick').value, out = $('#g-hr-crown-out');
  if (!id) return fill(out, el('p', { class: 'g-badt' }, 'Card me first: then you have a card to crown.'));
  const v = await verify(api.lifeOf(id));
  if (!v.ok) return fill(out, el('p', { class: 'g-badt' }, 'This card does not check: ' + v.why));
  const set = api.setOf(v);
  if (!classOf(set)) return fill(out, el('p', { class: 'g-badt' }, 'A hero is a card of one of the six businesses of the drop; a card grown on your own table cannot be crowned yet.'));
  const prior = H.ok && H.ok.ok ? H.ok : null;
  // a new hero keeps what you allowed the last one, and its limit; its key use starts again with the new pass
  const r = await crown(S.me, { card: id, set, theme: v.theme, caps: prior ? prior.caps : ['talk'], budget: prior ? prior.budget : 0, at: new Date().toISOString() });
  if (!r.ok) return fill(out, el('p', { class: 'g-badt' }, r.why));
  await keepHero(r.hero);
  fill(out, el('p', { class: 'g-okt' }, 'Crowned: ' + facts(v).title + ' is your ' + classOf(set).title + '. Its pass is signed with your key, and it goes in your key file when you save it.'));
  api.emit('hero', { crowned: true, id });
  game.bleep('level');
  render();
}
async function keepHero(hero) {
  H.hero = hero; H.ok = await heroOk(hero); H.page = []; H.pageOf = '';
  H.spent = Number((await api.load('hero-spent:' + hero.hash)) || 0);
  await api.save('hero', hero);
}

// ── the screen ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function render() {
  const id = heroCard(), mine = await game.myCards(null);
  $('#g-hr-crown-box').hidden = !!id && !H.recrown;
  $('#g-hr-main').hidden = !id; $('#g-hr-talk-box').hidden = !id; $('#g-hr-key-box').hidden = !id;
  fill($('#g-hr-pick'), mine.length ? mine.map((m) => el('option', { value: m.id }, m.f.title + ' #' + pad4(m.v.serial) + ' · ' + (classOf(api.setOf(m.v)) || { title: 'no class' }).title)) : el('option', { value: '' }, 'card me first'));
  if (id && mine.some((m) => m.id === id)) $('#g-hr-pick').value = id;
  pickLine();
  if (H.hero && !id) fill($('#g-hr-crown-out'), el('p', { class: 'g-badt' }, H.ok && !H.ok.ok ? 'Your saved hero does not check (' + H.ok.why + '): crown it again.' : 'Your hero’s card is not held by this key any more: crown one you hold.'));
  renderMemory();
  renderKey();
  if (!id) { renderLevel(); return; }
  await refreshStage(id);
  const v = await verify(api.lifeOf(id)), f = facts(v), cls = classOf(H.ok.set);
  await game.show($('#g-hr-face'), $('#g-hr-ring'), api.lifeOf(id));
  setK('g-hr-name', f.title); setK('g-hr-class', cls.title); setK('g-hr-job', 'Its job: ' + cls.job + '.');
  fill($('#g-hr-line'), f.department + ' · ' + f.rarity + ' · stage ' + f.stage + ' · #' + pad4(v.serial));
  fill($('#g-hr-can'), el('span', { class: 'g-tag ok' }, 'talks offline'), ' ', el('span', { class: 'g-tag ' + (H.ok.caps.includes('remember') ? 'ok' : 'cy') }, H.ok.caps.includes('remember') ? 'may share what it remembers' : 'keeps what it remembers here'), ' ', el('span', { class: 'g-tag ' + (H.ok.caps.includes('key') ? 'ok' : 'cy') }, H.ok.caps.includes('key') ? 'may use your key: limit ' + num(H.ok.budget) + ' tokens' : 'no key allowed'));
  renderLevel();
  renderAsks(id);
}
async function renderAsks(id) {
  const c = await rulesOf(id);
  if (heroCard() !== id) return;
  const qs = [...(c.ctx ? asks(c.ctx) : []), ...(allFacts().length ? ['What do I prefer?'] : []), ...(H.key && H.ok.caps.includes('key') ? ['What should I do next in the game?'] : [])];
  fill($('#g-hr-asks'), qs.map((q) => el('button', { type: 'button', class: 'g-btn g-ask', onclick: () => { $('#g-hr-q').value = q; ask(); } }, q)));
}
function pickLine() {
  const id = $('#g-hr-pick').value, m = id ? api.lifeOf(id) : null;
  $('#g-hr-cardme').hidden = !!m; $('#g-hr-crown').hidden = !m;
  if (!m) return fill($('#g-hr-class-line'), 'You hold no card yet: card me, and your first card can be crowned.');
  verify(m).then((v) => { const c = v.ok ? classOf(api.setOf(v)) : null; fill($('#g-hr-class-line'), c ? 'This card would be a ' + c.title + ': its job, to ' + c.job + '.' : 'This card cannot be crowned: a hero is a card of one of the six businesses of the drop.'); });
}
function renderLevel() {
  const a = acts(), id = heroCard();
  const lv = levelOf({ crowned: !!id, asked: a.asked, remembered: H.memory ? memoryLines().length : 0, trained: id ? stageOf(id) : 0, keyed: a.keyed, geared: id && (st().loadouts || {})[id] ? 1 : 0 });
  setK('g-hr-level', 'LEVEL ' + lv.level + ' of ' + lv.of); setK('g-hr-title', lv.title); setK('g-hr-next', lv.next);
  fill($('#g-hr-steps'), STEPS.map((s, i) => el('li', { class: lv.lit[i] ? 'k' : '' }, (lv.lit[i] ? '✓ ' : '') + s.title)));
  if (id) plate(id, lv.lit);
}
/** the hero's plate, drawn by PixelWhisperer from the hero's own record: its crest, its name, its class, its gems */
async function plate(id, lit) {
  const v = await verify(api.lifeOf(id)), name = facts(v).title.replace(/[^A-Za-z0-9 &.'-]/g, '').slice(0, 22).trim() || 'Hero', c = $('#g-hr-plate');
  const r = paintHero({ name, title: H.ok.cls.title, set: H.ok.set, lit }, game.theme(), c.width, c.height);
  if (!r.ok) return;
  const ctx = c.getContext('2d'), img = ctx.createImageData(c.width, c.height);
  for (let i = 0, j = 0; i < r.px.length; i += 3, j += 4) { img.data[j] = r.px[i]; img.data[j + 1] = r.px[i + 1]; img.data[j + 2] = r.px[i + 2]; img.data[j + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  c.setAttribute('aria-label', 'Your hero’s plate: ' + name + ', a ' + H.ok.cls.title + ', level ' + r.level + ' of 6');
}
let stages = new Map();
const stageOf = (id) => stages.get(id) || 0;
async function refreshStage(id) { const v = await verify(api.lifeOf(id)); stages.set(id, v.ok ? facts(v).stage : 0); }

// ── talking: the card's rules, then your memory, then your key ──────────────────────────────────────────────────────
/** what the hero's card says, through the talker (grown here first, as the Talker screen does) */
async function rulesOf(id) { return game.talkerCtx(id); }
function memoryLines() {
  if (!H.memory) return [];
  const say = { identity: 'you are', preference: 'you prefer', dislike: 'you dislike', project: 'you are working on', correction: 'you corrected it that', person: 'you mentioned', entity: 'you often bring up' };
  const out = [];
  for (const b of BUCKETS) if (b !== 'skin' && Array.isArray(H.memory[b])) for (const fct of H.memory[b]) if (fct && typeof fct.text === 'string') out.push({ w: fct.weight || 0, ts: fct.ts || 0, line: (say[fct.kind] || 'you noted') + ' ' + fct.text });
  return out.sort((x, y) => y.w - x.w || y.ts - x.ts || (x.line < y.line ? -1 : 1)).map((x) => x.line);
}
/** every fact kept, as fall-os keeps them (the derived skin left out) */
const allFacts = () => (H.memory ? BUCKETS.filter((b) => b !== 'skin').flatMap((b) => (Array.isArray(H.memory[b]) ? H.memory[b] : [])) : []);
/** the opening a key gets: the same bytes for the same hero, card, memory and gear */
async function openingFor(id, ctx) {
  const v = await verify(api.lifeOf(id)), f = facts(v), set = api.setOf(v);
  const live = ctx && ctx.mind ? ctx.mind.organs.filter((o) => o && o.state === 'live') : [];
  const rules = live.flatMap((o) => o.body.rules).slice().sort((x, y) => Math.abs(y.w) - Math.abs(x.w) || (x.feat < y.feat ? -1 : 1)).map((r) => sayRule(r, ctx.voc) + ', it leans ' + (r.w > 0 ? 'yes' : 'no'));
  const lo = (st().loadouts || {})[id], gear = lo ? [(Array.isArray(lo.nodes) ? lo.nodes.length : 0) + ' card(s) and ' + (Array.isArray(lo.tools) ? lo.tools.length : 0) + ' app(s) in its kit'] : [];
  return opening(H.ok, { card: { title: f.title, department: f.department, rarity: f.rarity, stage: f.stage, gate: ctx && Number.isInteger(ctx.gate) ? ctx.gate : null, outcome: SETS[set] ? sayOutcome(set, SETS[set].outcome) : 'happened', rules }, memory: memoryLines(), gear });
}
async function ask() {
  const out = $('#g-hr-out'), q = $('#g-hr-q').value.trim(), id = heroCard();
  if (H.busy || !id) return;
  if (!q) return fill(out, el('p', { class: 'g-small g-dim' }, 'Type a question first.'));
  H.busy = true; $('#g-hr-ask').disabled = true;
  try {
    fill(out, el('p', { class: 'g-small' }, 'Your hero reads your question with its card’s own rules first…'));
    const c = await rulesOf(id), r = c.ctx ? reply(q, c.ctx) : { verdict: 'ABSTAIN', text: c.why, receipt: null };
    // what it remembers: fall-os's recall by the words in a fact, or, for a question about you, by the kind of fact asked
    const byWords = H.memory ? recall(H.memory, q, 3) : { ok: true, matched: 0, answer: '' }, byKind = fromMemory(q, allFacts());
    const rec = byWords.ok && byWords.matched ? byWords : byKind;
    let o = null, cost = 0;
    if (H.key && H.ok.caps.includes('key')) {
      o = await openingFor(id, c.ctx);
      if (o.hash !== H.pageOf) { H.page = []; H.pageOf = o.hash; }   // a changed opening starts a fresh page
      cost = costOf(o.text, H.page, q, MAX_OUT).cost;
    }
    const where = route(q, { rules: r.verdict, recalled: rec.ok ? rec.matched : 0, hero: H.hero, keyReady: !!H.key, spent: H.spent, cost });
    if (!where.ok) return fill(out, el('p', { class: 'g-badt' }, where.why));
    if (where.brain === 'rules') { acts().asked++; return said(out, 'from its card’s rules', 'ok', r.text, where.why, r.receipt); }
    if (where.brain === 'memory') { acts().asked++; return said(out, 'from what it remembers of you', 'ok', rec.answer, where.why, null); }
    if (where.brain === 'none') return said(out, 'it cannot answer that here', 'cy', kindsAsked(q).length && !allFacts().length ? 'I don’t remember anything about you yet. Tell me below: give me your chat history, or a few lines like “I am a plumber in Leeds”.' : r.verdict === 'ABSTAIN' && c.ctx ? r.text : 'I can’t answer that from my rules or what I remember of you.', where.why, null);
    fill(out, el('p', { class: 'g-small' }, 'Asking your key at ' + PROVIDERS[H.provider].name + ': your hero’s opening, then this page’s ' + H.page.length / 2 + ' earlier question(s), then yours…'));
    const t = turns(H.page, q);
    if (!t.ok) return fill(out, el('p', { class: 'g-badt' }, t.why));
    if (t.fresh) H.page = [];
    const a = await askKey(H.provider, H.model, H.key, o.text, t.messages);
    const u = usedOf(H.provider, a.usage || {});
    H.spent += u.total; await api.save('hero-spent:' + H.hero.hash, H.spent);
    acts().keyed++; game.saveState();
    if (!a.refused) H.page = [...t.messages, a.assistant];   // the page only grows; a declined answer adds nothing
    const left = Math.max(0, H.ok.budget - H.spent), share = u.read ? Math.round((100 * u.recycled) / u.read) : 0;
    said(out, a.refused ? 'your key’s provider declined this' : 'from your key: ' + H.model, a.refused ? 'cy' : 'ok', a.refused ? 'The provider declined to answer this one. Nothing was added to the page.' : a.text,
      'Read ' + num(u.read) + ' tokens, ' + num(u.recycled) + ' of them reused from the provider’s cache (' + share + '%)' + (u.cached ? ', ' + num(u.cached) + ' newly cached' : '') + '; wrote ' + num(u.out) + '. This pass has used ' + num(H.spent) + ' of its ' + num(H.ok.budget) + ' tokens (' + num(left) + ' left). Page: ' + H.page.length / 2 + ' of ' + MAX_TURNS + ' questions; opening ' + o.hash.slice(0, 8) + '…, the same bytes every question.',
      { provider: H.provider, model: H.model, opening: o.hash, openingTokens: o.tokens, used: u, page: H.page.length / 2 });
    renderKey();
  } catch (e) {
    fill(out, el('p', { class: 'g-badt' }, 'Your key’s provider did not answer: ' + String((e && e.message) || e).slice(0, 300)));
  } finally { H.busy = false; $('#g-hr-ask').disabled = false; game.saveState(); renderLevel(); }
}
function said(out, tag, kind, text, how, receipt) {
  fill(out, el('p', { class: 'g-row' }, el('span', { class: 'g-tag ' + kind }, tag)), el('p', { class: 'g-hr-said' }, text), el('p', { class: 'g-small g-dim' }, how));
  $('#g-hr-rc-box').hidden = !receipt;
  fill($('#g-hr-rc'), receipt ? JSON.stringify(receipt, null, 1) : '');
  game.bleep(kind === 'ok' ? 'kept' : 'abstain');
  game.saveState(); renderLevel();
}

/** one question to the owner's own key: the provider's own interface, nothing between */
async function askKey(provider, model, key, open, messages) {
  const post = async (url, headers, body) => {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error(res.status + ' ' + String((j && ((j.error && (j.error.message || j.error)) || j.message)) || res.statusText).slice(0, 240));
    return j;
  };
  const text = (m) => (typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n') : ''));
  if (provider === 'anthropic') {
    // the opening is marked for the provider's cache; Claude Haiku has no server-side fallback, the others fall back by default
    const fallback = model !== 'claude-haiku-5-5';
    const j = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', ...(fallback ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}) },
      { model, max_tokens: MAX_OUT, output_config: { effort: 'low' }, ...(fallback ? { fallbacks: 'default' } : {}), system: [{ type: 'text', text: open, cache_control: { type: 'ephemeral' } }], messages });
    const refused = j.stop_reason === 'refusal' || !Array.isArray(j.content);
    return { text: refused ? '' : text({ content: j.content }).trim(), refused, usage: j.usage, assistant: { role: 'assistant', content: j.content } };
  }
  if (provider === 'google') {
    const j = await post('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', { 'x-goog-api-key': key },
      { systemInstruction: { parts: [{ text: open }] }, contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: text(m) }] })), generationConfig: { maxOutputTokens: MAX_OUT } });
    const c = j.candidates && j.candidates[0], words = c && c.content && Array.isArray(c.content.parts) ? c.content.parts.map((p) => p.text || '').join('').trim() : '';
    return { text: words, refused: !words, usage: j.usageMetadata, assistant: { role: 'assistant', content: words } };
  }
  const url = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
  const j = await post(url, { Authorization: 'Bearer ' + key }, { model, ...(provider === 'openai' ? { max_completion_tokens: MAX_OUT } : { max_tokens: MAX_OUT }), messages: [{ role: 'system', content: open }, ...messages.map((m) => ({ role: m.role, content: text(m) }))] });
  const words = j.choices && j.choices[0] && j.choices[0].message && typeof j.choices[0].message.content === 'string' ? j.choices[0].message.content.trim() : '';
  return { text: words, refused: !words, usage: j.usage, assistant: { role: 'assistant', content: words } };
}

// ── memory: your chat history, or a few lines, read here; only the facts found are kept, on this device ──────────────
async function addMemory(source, data, what) {
  const out = $('#g-hr-mem-out');
  const p = parseExport(source, data);
  if (!p.ok) return fill(out, el('p', { class: 'g-badt' }, 'That could not be read: ' + p.why));
  const found = extractFacts(p.turns);
  const kept = H.memory ? BUCKETS.filter((b) => b !== 'skin').flatMap((b) => (Array.isArray(H.memory[b]) ? H.memory[b] : [])) : [];
  const d = dedupe([...kept, ...found.facts]), b = bucket(d.facts);
  const convos = new Set(p.turns.map((t) => t.conversationId)).size;
  H.memory = b.memory;
  H.stats = { conversations: ((H.stats && H.stats.conversations) || 0) + convos, turns: ((H.stats && H.stats.turns) || 0) + p.turns.length, facts: d.facts.length };
  await api.save('hero-memory', { memory: H.memory, stats: H.stats });
  fill(out, el('p', { class: 'g-okt' }, what + ': ' + num(convos) + ' conversation(s), ' + num(p.turns.length) + ' turns read here; ' + num(found.facts.length) + ' facts found, ' + num(d.facts.length) + ' kept on this device in all. The file itself is not kept, and nothing was sent anywhere.'));
  renderMemory(); renderLevel();
}
async function memFile(file) {
  if (!file) return;
  const out = $('#g-hr-mem-out');
  fill(out, el('p', { class: 'g-small' }, 'Reading ' + file.name + ' here…'));
  let data;
  try { data = JSON.parse(await file.text()); } catch { return fill(out, el('p', { class: 'g-badt' }, 'That file is not JSON. For ChatGPT, unzip your export and choose conversations.json; for Claude, choose the conversations file in your export.')); }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.conversations) ? data.conversations : [];
  const source = list.some((c) => c && typeof c === 'object' && c.mapping) ? 'chatgpt' : list.some((c) => c && typeof c === 'object' && (Array.isArray(c.chat_messages) || Array.isArray(c.messages))) ? 'claude' : null;
  if (!source) return fill(out, el('p', { class: 'g-badt' }, 'That is not a ChatGPT or Claude chat export: it holds no conversations either one writes.'));
  // only the facts are kept: the export itself is dropped once it is read
  await addMemory(source, list, 'Read your ' + (source === 'chatgpt' ? 'ChatGPT' : 'Claude') + ' history');
}
/** the first conversation: an interview for the chat app the player already uses, its answer in the lines fall-os's memory reads */
export const INTERVIEW = ['You are helping me introduce myself to my Kardlings hero, a small AI that runs on my own device. Ask me these questions one at a time, and wait for my answer after each:',
  '1) My first name and the work I do.', '2) Where I am based.', '3) What I am working on or building right now.', '4) How I like answers (short or detailed, plain or technical), and anything I cannot stand.', '5) The people I work with most: their first names and roles.',
  'Then write ONLY plain lines, one fact per line, each starting with exactly one of: "My name is", "I am a", "I work as", "I am based in", "I am working on", "I prefer", "I dislike", "My colleague is", "My boss is", "My partner is". No other text.'].join('\n');
async function interview() {
  const out = $('#g-hr-interview-out');
  try { await navigator.clipboard.writeText(INTERVIEW); fill(out, el('p', { class: 'g-okt' }, 'Copied. Paste it into your chat app, answer its five questions, then paste the lines it writes into the box below and press Keep these lines.')); }
  catch { fill(out, el('p', { class: 'g-small' }, 'Copy this into your chat app:'), el('pre', { class: 'g-rc' }, INTERVIEW)); }
}
function memNote() {
  const lines = $('#g-hr-mem-note').value.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 40);
  if (!lines.length) return fill($('#g-hr-mem-out'), el('p', { class: 'g-small g-dim' }, 'Write a line or two first, like “I am a plumber in Leeds” or “I prefer short answers”.'));
  $('#g-hr-mem-note').value = '';
  addMemory('claude', [{ uuid: 'notes-' + Date.now(), name: 'what I told my hero', chat_messages: lines.map((t) => ({ sender: 'human', text: t })) }], 'Kept your lines');
}
async function memForget() {
  H.memory = null; H.stats = null; await api.save('hero-memory', null);
  fill($('#g-hr-mem-out'), el('p', { class: 'g-okt' }, 'Forgotten: your hero remembers nothing of you on this device now.'));
  renderMemory(); renderLevel();
}
function renderMemory() {
  const lines = memoryLines();
  setK('g-hr-mem-n', lines.length ? num(lines.length) + ' fact' + (lines.length === 1 ? '' : 's') : 'nothing yet');
  fill($('#g-hr-mem-list'), lines.slice(0, 12).map((l) => el('li', {}, l)));
  $('#g-hr-mem-forget').disabled = !lines.length;
}

// ── your key: held in this tab only; the pass you sign says whether it may be used and how much ─────────────────────
function renderKey() {
  const p = PROVIDERS[H.provider];
  if ($('#g-hr-prov').value !== H.provider) $('#g-hr-prov').value = H.provider;
  fill($('#g-hr-models'), p.models.map((m) => el('option', { value: m })));
  if (!$('#g-hr-model').value) $('#g-hr-model').value = H.model;
  setK('g-hr-key-where', 'Get a key at ' + p.get + '. A chat subscription is not a key: a key is paid per use, and some come with a free allowance.');
  const allowed = H.ok && H.ok.ok && H.ok.caps.includes('key');
  setK('g-hr-key-state', H.key ? 'a key is held in this tab' + (allowed ? '' : ' — grant it to your hero to use it') : 'no key in this tab');
  setK('g-hr-used', allowed ? num(H.spent) + ' of ' + num(H.ok.budget) + ' tokens used on this pass' : 'your hero may not use a key yet');
  $('#g-hr-forget-key').disabled = !H.key;
}
async function grant() {
  const out = $('#g-hr-key-out'), id = heroCard();
  if (!id) return fill(out, el('p', { class: 'g-badt' }, 'Crown a hero first.'));
  const key = $('#g-hr-key').value.trim(), model = $('#g-hr-model').value.trim(), limit = Number($('#g-hr-limit').value), share = $('#g-hr-share').checked;
  if (!key) return fill(out, el('p', { class: 'g-badt' }, 'Paste your key first. It stays in this tab only.'));
  if (!/^[A-Za-z0-9._:/-]{1,120}$/.test(model)) return fill(out, el('p', { class: 'g-badt' }, 'Name the model your key may use, as the provider writes it.'));
  if (!Number.isInteger(limit) || limit < 1 || limit > 50000000) return fill(out, el('p', { class: 'g-badt' }, 'Set a limit: a whole number of tokens from 1 to 50,000,000. Your hero refuses to go past it.'));
  const caps = ['key', ...(share ? ['remember'] : [])];
  const r = await crown(S.me, { card: id, set: H.ok.set, theme: H.ok.theme, caps, budget: limit, at: new Date().toISOString() });
  if (!r.ok) return fill(out, el('p', { class: 'g-badt' }, r.why));
  await keepHero(r.hero);
  H.key = key; H.provider = $('#g-hr-prov').value; H.model = model; $('#g-hr-key').value = '';
  try { localStorage.setItem('kardlings-hero-provider', JSON.stringify({ provider: H.provider, model })); } catch {}
  fill(out, el('p', { class: 'g-okt' }, 'Granted: a new pass signed with your key lets your hero use ' + PROVIDERS[H.provider].name + ' (' + model + ') up to ' + num(limit) + ' tokens' + (share ? ', bringing what it remembers of you' : ', without what it remembers of you') + '. The key itself is held in this tab only: close the tab and it is gone.'));
  api.emit('hero', { granted: true });
  render();
}
function forgetKey() { H.key = ''; H.page = []; H.pageOf = ''; fill($('#g-hr-key-out'), el('p', { class: 'g-okt' }, 'Your key is gone from this tab.')); renderKey(); }

// ── training: a level kept only if it beats the old mind on cases it never saw ────────────────────────────────────────
async function train() {
  const id = heroCard(), out = $('#g-hr-train-out');
  if (!id || H.busy) return;
  H.busy = true; $('#g-hr-train').disabled = true;
  fill(out, el('p', { class: 'g-small' }, 'Training: three searches on its own business’s records. A level is kept only if it beats the old mind by 0.002 on cases it never saw.'));
  const onLevel = (e) => { if (e.detail.type === 'level' && e.detail.id === id) game.forgetGrown(id); };
  addEventListener('digi', onLevel);
  // the searches report into the card's own level box: show what they say here as they go
  const tick = setInterval(() => { const t = ($('#out-level') && $('#out-level').textContent) || ''; if (t) fill(out, el('p', { class: 'g-small' }, t.split('{')[0].trim())); }, 700);
  try {
    await api.select(id);
    await api.actLevel();
    clearInterval(tick);
    const said = ($('#out-level') && $('#out-level').textContent) || '';
    await refreshStage(id);
    fill(out, el('p', { class: /LEVEL UP/.test(said) ? 'g-okt' : 'g-small' }, (said.split('{')[0] || 'Trained.').trim()));
  } finally { clearInterval(tick); removeEventListener('digi', onLevel); H.busy = false; $('#g-hr-train').disabled = false; render(); }
}

// ── wiring ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function wire() {
  const on = (s, ev, fn) => { const n = $(s); if (n) n.addEventListener(ev, fn); };
  on('#g-hr-crown', 'click', crownIt);
  on('#g-hr-cardme', 'click', async () => { $('#g-hr-cardme').disabled = true; try { await api.cardMe({ quiet: true }); } finally { $('#g-hr-cardme').disabled = false; render(); } }); on('#g-hr-pick', 'change', pickLine);
  on('#g-hr-recrown', 'click', () => { H.recrown = !H.recrown; $('#g-hr-crown-box').hidden = !H.recrown; });
  on('#g-hr-ask', 'click', ask); on('#g-hr-q', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });
  on('#g-hr-mem-file', 'change', (e) => memFile(e.target.files[0])); on('#g-hr-mem-add', 'click', memNote); on('#g-hr-interview', 'click', interview); on('#g-hr-mem-forget', 'click', memForget);
  on('#g-hr-prov', 'change', () => { H.provider = $('#g-hr-prov').value; $('#g-hr-model').value = PROVIDERS[H.provider].models[0]; renderKey(); });
  on('#g-hr-grant', 'click', grant); on('#g-hr-forget-key', 'click', forgetKey);
  on('#g-hr-train', 'click', train);
  addEventListener('digi', (e) => { if (e.detail.type === 'key' && e.detail.restored) loadHero().then(render); });
}
wire();
screen('hero', render);
ready.then(async () => { await loadHero(); const id = heroCard(); if (id) await refreshStage(id); });
