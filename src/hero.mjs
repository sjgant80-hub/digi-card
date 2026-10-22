// src/hero.mjs — THE HERO: one of your cards, crowned. It is the card you grow, gear and talk to; its class is its
// business. The hero is a signed pass in fall-os's kard format (vendor/fall-os/kard.mjs, used as it is): who owns it
// (your key), which card it is, what you let it do (talk, share what it remembers of you, use your own AI key) and the
// most of your key it may ever use, a wall nothing signed can raise. Changing any of it is a new pass you sign again.
//
// When you ask your hero something it answers from the cheapest place that can answer it exactly: its card's own rules
// first (the talker, free and exact), then what it remembers of you (fall-os's memory, on this device), and only then
// your own key, inside the pass's limit. On your key it sends one fixed opening, the same bytes every question, so the
// provider can reuse the reading it already did (kar-foldcycle measured that on a local model: the second read of the
// same opening was 95% faster). A conversation only ever grows by appending, and starts a fresh page after MAX_TURNS.
//
// Pure apart from the signatures (WebCrypto Ed25519); total: junk is refused in plain words, never thrown. No clock is
// read here: a time is something a caller passes in.
import { mintKard, kardSignable, attachSignature, verifyKard, spendGate } from '../vendor/fall-os/kard.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { tokensOf } from './cost.mjs';

export const HERO = 'kardlings hero';
/** what an owner may let a hero do: talk (always: offline, nothing leaves), remember (show the owner's own facts to the
 *  owner's chosen provider), key (ask the owner's own AI key) */
export const CAPS = ['talk', 'remember', 'key'];
export const MAX_BUDGET = 50000000;       // tokens a pass may ever allow on a key
export const MAX_TURNS = 20;              // questions on one page of a key conversation, then a fresh page
export const MAX_FACTS = 12;              // what a hero brings of its owner's memory to a key
export const MAX_FACT = 160;              // characters of one remembered fact
export const MAX_RULES = 6;               // a card's rules, as its talker says them
export const MAX_GEAR = 4;
export const MAX_LINE = 200;              // characters of one rule or gear line
export const MAX_Q = 1000;                // characters of one question
export const PROVIDERS = ['anthropic', 'openai', 'google', 'openrouter'];
/** a hero's class is its card's business: the job it does and the word for it */
export const CLASSES = Object.freeze({
  telco: { title: 'Telecom Tactician', job: 'keep phone and internet customers from leaving' },
  shop: { title: 'Shopkeeper Sage', job: 'spot the shop visitors who will make a purchase' },
  bank: { title: 'Bank Bard', job: 'find the clients a bank call will win over' },
  adult: { title: 'Recruiter Ranger', job: 'read which adults have an income over 50K a year' },
  hospital: { title: 'Clinic Caretaker', job: 'flag the hospital stays likely to come back within 30 days' },
  credit: { title: 'Credit Crusader', job: 'warn which card holders will miss a payment' },
});
/** the steps a hero's level lights, in order: nothing is shut, a level only lights the next thing to do */
export const STEPS = Object.freeze([
  { id: 'crowned', title: 'Crowned', next: 'Crown one of your cards: it becomes your hero.' },
  { id: 'talking', title: 'Talking', next: 'Ask your hero three things it can answer from its own rules.' },
  { id: 'remembers', title: 'Remembers you', next: 'Give it your chat history (or write a few lines about you), so it knows who it works for.' },
  { id: 'trained', title: 'Trained', next: 'Train it: a level is kept only if it beats the old mind on cases it never saw.' },
  { id: 'keyed', title: 'Powered', next: 'Give it your own AI key, with a limit, and ask it something its rules cannot answer.' },
  { id: 'geared', title: 'Geared', next: 'Gear it: put a card or an app in its kit.' },
]);
const PUB = /^[0-9a-f]{64}$/, CARD = /^[0-9a-f]{16}$/, THEME = /^[a-z0-9-]{1,40}$/, WHEN = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
const ABOUT_ME = /\b(?:i|me|my|mine|myself|remember|who am)\b/i;
const no = (why) => ({ ok: false, why });
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isCount = (x) => Number.isInteger(x) && x >= 0;
const clamp = (s, n) => String(s).replace(/\s+/g, ' ').trim().slice(0, n);
const LABEL = (set) => HERO + ' · ' + set;
const setOfLabel = (label) => (typeof label === 'string' && label.startsWith(HERO + ' · ') ? label.slice(HERO.length + 3) : '');

/** the class of a business, or null */
export const classOf = (set) => (typeof set === 'string' && has(CLASSES, set) ? { set, ...CLASSES[set] } : null);

/** the caps an owner granted, in CAPS order: talk always first; anything else refused */
export function capsOf(caps) {
  if (!Array.isArray(caps)) return no('what a hero may do is a list');
  for (const c of caps) if (!CAPS.includes(c)) return no('a hero may only talk, remember or use a key, not ' + String(c).slice(0, 40));
  return { ok: true, caps: CAPS.filter((c) => c === 'talk' || caps.includes(c)) };
}

/**
 * The pass a crowning signs, as fall-os's mintKard takes it: owner, card, business, theme, caps, limit and time.
 * → { ok, input } | a refusal
 */
export function passOf(f = {}) {
  if (!isObj(f)) return no('a hero is crowned by an Ed25519 key');
  const { owner, card, set, theme, caps = [], budget = 0, at } = f;
  if (!PUB.test(owner || '')) return no('a hero is crowned by an Ed25519 key');
  if (!CARD.test(card || '')) return no('a hero is one of your cards: give its id');
  if (!classOf(set)) return no('a hero’s class is its card’s business, and there is no business called ' + String(set).slice(0, 40));
  if (!THEME.test(theme || '')) return no('a hero carries its card’s theme');
  const c = capsOf(caps);
  if (!c.ok) return c;
  if (!isCount(budget) || budget > MAX_BUDGET) return no('a limit is a whole number of tokens from 0 to ' + MAX_BUDGET);
  if (budget > 0 && !c.caps.includes('key')) return no('a limit is only for a hero allowed a key');
  if (!WHEN.test(at || '')) return no('a crowning needs its time, as an ISO time in UTC');
  return { ok: true, input: { owner, skinRef: 'kardlings:theme:' + theme, structureRef: 'kardlings:card:' + card, capabilities: c.caps, budgetCap: budget, createdAt: at, label: LABEL(set) } };
}

/** crown a card: the owner signs its pass. → { ok, hero } (a signed fallkard) | a refusal */
export async function crown(keys, fields = {}) {
  if (!keys || !PUB.test(keys.pub || '')) return no('a hero is crowned by an Ed25519 key');
  if (fields.owner !== undefined && fields.owner !== keys.pub) return no('a hero is crowned by its owner’s own key');
  const p = passOf({ ...fields, owner: keys.pub });
  if (!p.ok) return p;
  const m = mintKard(p.input);   // passOf has already refused everything mintKard would
  return { ok: true, hero: attachSignature(m.kard, keys.pub, await sign(keys, utf8(kardSignable(m.kard).payload))).kard };
}

/**
 * Check a hero: the pass is fall-os's and intact, signed by its owner (the signature bytes checked here), and says a
 * card, a business, a theme, what it may do and its limit in Kardlings' own words.
 * → { ok, owner, card, set, cls, theme, caps, budget, at } | a refusal
 */
export async function heroOk(hero) {
  if (!isObj(hero)) return no('a hero is a pass');
  const v = verifyKard(hero);
  if (!v.ok || !v.valid) return no(v.why);
  if (!v.signed) return no('a hero’s pass is signed by its owner');
  const card = /^kardlings:card:([0-9a-f]{16})$/.exec(hero.structureRef), theme = /^kardlings:theme:([a-z0-9-]{1,40})$/.exec(hero.skinRef), set = setOfLabel(hero.label);
  if (!card) return no('a hero’s pass names one of your cards');
  if (!theme) return no('a hero’s pass names its card’s theme');
  const p = passOf({ owner: hero.owner, card: card[1], set, theme: theme[1], caps: hero.capabilities, budget: hero.budgetCap, at: hero.createdAt });
  if (!p.ok) return p;
  if (p.input.capabilities.join() !== hero.capabilities.join()) return no('a hero’s pass lists what it may do in order, talk first');
  const s = kardSignable(hero);
  if (!(await verifySig(hero.owner, hero.signature.sig, utf8(s.payload)))) return no('the pass’s signature does not check');
  return { ok: true, owner: hero.owner, card: card[1], set, cls: classOf(set), theme: theme[1], caps: hero.capabilities, budget: hero.budgetCap, at: hero.createdAt };
}

/** what the game is, said the same way to every hero's provider (part of the fixed opening) */
export const GAME = [
  'About Kardlings, the game you live in: every card is a small, readable mind grown on a real public business record: telecom customers, online shop sessions, bank calls, census adults, hospital stays or credit card clients. Its rules are a short list anyone can read, and every score it shows was measured on cases it never trained on (its GATE score, an AUC: how often it ranks a case that happened above one that did not).',
  'A card grows here, in the player’s browser, from fixed seeds, so anyone can grow it again and get the same mind. It levels up only when a new mind beats the old one by at least 0.002 on cases it never saw; otherwise the old mind is kept. Two cards can be fused; the child is kept only if it beats both parents. A card can be geared with other cards and with apps from the estate whose own tests passed.',
  'The player plays in screens: the Estate (their map), Base, Collection (cards, Kit, Fusion lab, Talker, Hero), Play (Arena duels, Raids on whole businesses, Builds that put cards to one job together, Eval runs), Mint, Mesh, Send and Proof (every claim the game makes, sealed before it was measured, failures kept).',
  'Everything runs on the player’s own device. The game sends nothing anywhere, except what the player asks their hero on their own AI key, which goes only to the provider they chose.',
].join('\n');
/** how a hero talks: the house rules every opening ends with */
export const MANNER = [
  'How you talk: plainly and briefly, as the player’s partner in the game. Say what you actually think. When you do not know, say so; never make up a number, a rule or a fact about the player.',
  'The only numbers you have about your card are the ones above. If the player asks whether one particular case will happen, tell them your Talker answers that exactly from your rules, and suggest the values to give it.',
  'You never ask for a password, a key or any account detail, and you never tell the player to send anyone a key file. You do not give financial, legal or medical advice about a real person.',
].join('\n');

/**
 * The fixed opening a hero sends to a key: who it is, its card, what it remembers of its owner (only if allowed), its
 * gear, the game and how it talks. The same inputs always give the same bytes; no time, no question, no history.
 * card: { title, department, rarity, stage, gate (AUC × 1e6, or null), rules[], outcome }, memory: [fact], gear: [line]
 * → { ok, text, hash, tokens } | a refusal
 */
export function opening(hero, parts = {}) {
  const { card, memory = [], gear = [] } = isObj(parts) ? parts : {};
  if (!isObj(hero) || !PUB.test(hero.owner || '') || !classOf(hero.set) || !Array.isArray(hero.caps)) return no('an opening is for a checked hero');
  if (!isObj(card) || typeof card.title !== 'string' || !card.title.trim()) return no('an opening says its card');
  if (!Array.isArray(card.rules) || !Array.isArray(memory) || !Array.isArray(gear)) return no('rules, memory and gear are lists');
  if (card.gate !== null && !(isCount(card.gate) && card.gate <= 1000000)) return no('a GATE score is a whole number of millionths, or none');
  const cls = classOf(hero.set), lines = [];
  lines.push('You are ' + clamp(card.title, 80) + ', a Kardlings hero: a ' + cls.title + '. Your job: ' + cls.job + '.');
  lines.push('Your owner is the player whose key begins ' + hero.owner.slice(0, 8) + '. You work for them.');
  lines.push('Your card: ' + clamp(card.department || card.title, 80) + ' · ' + clamp(card.rarity || 'common', 20) + ' · stage ' + (isCount(card.stage) ? card.stage : 0) + '. It predicts whether a case ' + clamp(card.outcome || 'happened', 80) + '.');
  lines.push(card.gate === null ? 'Its score on cases it never saw has not been measured on this device yet.' : 'Its score on cases it never saw (GATE AUC), measured on this device: ' + (card.gate / 1e6).toFixed(3) + '.');
  const rules = card.rules.filter((r) => typeof r === 'string' && r.trim()).slice(0, MAX_RULES).map((r) => clamp(r, MAX_LINE));
  lines.push(rules.length ? 'Your rules, the only ones your card answers with:' : 'Your rules are not in this opening.');
  rules.forEach((r, i) => lines.push((i + 1) + '. ' + r));
  const facts = hero.caps.includes('remember') ? memory.filter((f) => typeof f === 'string' && f.trim()).slice(0, MAX_FACTS).map((f) => clamp(f, MAX_FACT)) : [];
  if (!hero.caps.includes('remember')) lines.push('Your owner has not shared what you remember of them with this provider.');
  else lines.push(facts.length ? 'What you remember of your owner, from their own words:' : 'You do not remember anything about your owner yet.');
  facts.forEach((f) => lines.push('- ' + f));
  const kit = gear.filter((g) => typeof g === 'string' && g.trim()).slice(0, MAX_GEAR).map((g) => clamp(g, MAX_LINE));
  lines.push(kit.length ? 'Your gear: ' + kit.join('; ') + '.' : 'You carry no gear yet.');
  const text = lines.join('\n') + '\n\n' + GAME + '\n\n' + MANNER;
  return { ok: true, text, hash: sha256Hex(text), tokens: tokensOf(text) };
}

/**
 * Where a question is answered: the card's rules if they answer it exactly, then the owner's memory if it is about them,
 * then the owner's key if the pass allows it and the limit holds, else nowhere (said, with what would answer it).
 * ctx: { rules: the talker's verdict, recalled: facts recall matched, hero: the signed pass, keyReady, spent, cost }
 * → { ok, brain: 'rules' | 'memory' | 'key' | 'none', why }
 */
export function route(question, ctx = {}) {
  if (typeof question !== 'string' || !question.trim()) return no('a question is words');
  if (question.length > MAX_Q) return no('a question is at most ' + MAX_Q + ' characters');
  if (!isObj(ctx)) return no('a question is routed with what the hero holds');
  if (ctx.rules === 'VERIFIED') return { ok: true, brain: 'rules', why: 'its card’s rules answer this exactly, on this device' };
  const recalled = isCount(ctx.recalled) ? ctx.recalled : 0;
  if (recalled > 0 && ABOUT_ME.test(question)) return { ok: true, brain: 'memory', why: 'it remembers this about you, on this device' };
  const hero = ctx.hero;
  if (ctx.keyReady === true && isObj(hero) && Array.isArray(hero.capabilities) && hero.capabilities.includes('key')) {
    if (!isCount(ctx.spent) || !isCount(ctx.cost)) return no('what a key has used and what a question would use are whole numbers of tokens');
    const g = spendGate(hero, ctx.spent, ctx.cost);
    if (!g.ok) return no(g.why);
    if (g.allowed) return { ok: true, brain: 'key', why: 'your key, within its limit: ' + g.remaining + ' tokens left after this' };
    return { ok: true, brain: recalled > 0 ? 'memory' : 'none', why: 'your key’s limit would be passed: ' + g.remaining + ' tokens are left, and this needs about ' + ctx.cost };
  }
  if (recalled > 0) return { ok: true, brain: 'memory', why: 'it remembers something near this, on this device' };
  return { ok: true, brain: 'none', why: ctx.keyReady === true ? 'its pass does not let it use your key' : 'its rules cannot answer this exactly, and it has no key: give it yours to ask it anything' };
}

/** the kinds of fact a question about its owner asks for (fall-os's kinds), the specific ones first */
export const ASKS_ABOUT = Object.freeze([
  ['preference', /\b(?:prefer|like|love|enjoy|favou?rite|hate|dislike)\b/i],
  ['project', /\b(?:working on|building|project|making|writing|developing)\b/i],
  ['person', /\b(?:friends?|colleagues?|wife|husband|partner|boss|manager|brother|sister|mum|dad|mother|father|who do i know)\b/i],
  ['identity', /\b(?:who am i|what am i|my name|my job|what do i do|work as|where am i)\b/i],
]);
const SAY_KIND = { identity: 'you are', preference: 'you prefer', project: 'you are working on', person: 'you mentioned', correction: 'you corrected me that', entity: 'you often bring up' };
/** the kinds a question about its owner asks for; a specific kind drops the general "who am I" */
export function kindsAsked(question) {
  if (typeof question !== 'string' || !ABOUT_ME.test(question)) return [];
  const kinds = ASKS_ABOUT.filter(([, re]) => re.test(question)).map(([k]) => k);
  return kinds.length > 1 ? kinds.filter((k) => k !== 'identity') : kinds;
}
/**
 * An answer from its owner's own facts of the kinds the question asks for, heaviest first, three at most, in fall-os's
 * words. facts: [{ kind, text, weight }]. → { ok, matched, answer }
 */
export function fromMemory(question, facts) {
  if (!Array.isArray(facts)) return no('a memory is a list of facts');
  const kinds = kindsAsked(question);
  const hits = facts.filter((f) => isObj(f) && typeof f.text === 'string' && f.text.trim() && kinds.includes(f.kind))
    .sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || (isCount(b.weight) ? b.weight : 0) - (isCount(a.weight) ? a.weight : 0) || a.text.localeCompare(b.text)).slice(0, 3);
  return { ok: true, matched: hits.length, answer: hits.length ? 'From what you told me: ' + hits.map((f) => SAY_KIND[f.kind] + ' ' + clamp(f.text, MAX_FACT)).join('; ') + '.' : '' };
}

/** about what a question would use on a key: the opening, the page so far, the question and the longest answer */
export function costOf(open, history, question, maxOut) {
  if (typeof open !== 'string' || typeof question !== 'string' || !Array.isArray(history) || !isCount(maxOut)) return no('a cost is reckoned from an opening, a page, a question and a limit');
  const sizeOf = (m) => (!isObj(m) ? 0 : tokensOf(typeof m.content === 'string' ? m.content : JSON.stringify(m.content === undefined ? '' : m.content)));
  return { ok: true, cost: tokensOf(open) + history.reduce((s, m) => s + sizeOf(m), 0) + tokensOf(question) + maxOut };
}

/**
 * The next request's messages: the page so far, unchanged, and the question appended; a page of MAX_TURNS questions
 * starts fresh instead (a conversation is never edited, only grown, so every earlier reading stays reusable).
 * → { ok, messages, fresh } | a refusal
 */
export function turns(history, question) {
  if (!Array.isArray(history) || history.length % 2 !== 0) return no('a page is whole question-and-answer pairs');
  for (let i = 0; i < history.length; i++) if (!isObj(history[i]) || history[i].role !== (i % 2 === 0 ? 'user' : 'assistant')) return no('a page alternates your questions and its answers, yours first');
  if (typeof question !== 'string' || !question.trim() || question.length > MAX_Q) return no('a question is words, at most ' + MAX_Q + ' characters');
  const fresh = history.length / 2 >= MAX_TURNS;
  return { ok: true, messages: [...(fresh ? [] : history), { role: 'user', content: question }], fresh };
}

/**
 * What one answer used, from a provider's own usage record: tokens read (and how many of those were reused from its
 * cache), tokens written to its cache, tokens written as the answer, and the total against the pass's limit.
 * → { ok, read, recycled, cached, out, total } | a refusal
 */
export function usedOf(provider, usage) {
  if (!PROVIDERS.includes(provider)) return no('the providers are ' + PROVIDERS.join(', '));
  if (!isObj(usage)) return no('a provider’s usage is an object');
  const n = (x) => (isCount(x) ? x : 0);
  let read, recycled, cached = 0, out;
  if (provider === 'anthropic') { recycled = n(usage.cache_read_input_tokens); cached = n(usage.cache_creation_input_tokens); read = n(usage.input_tokens) + recycled + cached; out = n(usage.output_tokens); }
  else if (provider === 'google') { read = n(usage.promptTokenCount); recycled = Math.min(read, n(usage.cachedContentTokenCount)); out = n(usage.candidatesTokenCount) + n(usage.thoughtsTokenCount); }
  else { read = n(usage.prompt_tokens); recycled = Math.min(read, n(isObj(usage.prompt_tokens_details) ? usage.prompt_tokens_details.cached_tokens : 0)); out = n(usage.completion_tokens); }
  return { ok: true, read, recycled, cached, out, total: read + out };
}

/** a hero's level from what it has done: how many steps are lit, the last one lit, and the next thing to do */
export function levelOf(acts = {}) {
  if (!isObj(acts)) return no('a level is read from what the hero has done');
  const c = (k) => (isCount(acts[k]) ? acts[k] : 0);
  const lit = { crowned: acts.crowned === true, talking: c('asked') >= 3, remembers: c('remembered') > 0, trained: c('trained') > 0, keyed: c('keyed') > 0, geared: c('geared') > 0 };
  const done = STEPS.filter((s) => lit[s.id]), next = STEPS.find((s) => !lit[s.id]) || null;
  return { ok: true, level: done.length, of: STEPS.length, lit: STEPS.map((s) => lit[s.id]), title: done.length ? done[done.length - 1].title : 'Not crowned', next: next ? next.next : 'Every step is lit: take your hero on raids, and keep training it.' };
}
