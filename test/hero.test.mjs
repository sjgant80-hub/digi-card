// hero.test.mjs — a hero is one of your cards crowned with a pass you sign (fall-os's kard, used as it is): it says the
// card, its business, what it may do and the most of your key it may use, and anything else is refused by name. Its
// opening to a key is the same bytes every time; a question goes to its rules first, then your memory, then your key
// inside its limit; a page of questions only grows; and every provider's usage is read the same way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HERO, CAPS, MAX_BUDGET, MAX_TURNS, MAX_FACTS, MAX_FACT, MAX_RULES, MAX_GEAR, MAX_LINE, MAX_Q, PROVIDERS, CLASSES, STEPS, GAME, MANNER,
  ASKS_ABOUT, classOf, capsOf, passOf, crown, heroOk, opening, route, kindsAsked, fromMemory, costOf, turns, usedOf, levelOf } from '../src/hero.mjs';
import { mintKard, kardSignable, attachSignature, sha256 as kardSha, canon } from '../vendor/fall-os/kard.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { tokensOf } from '../src/cost.mjs';
import { DATASETS } from '../src/dossier.mjs';
import { key } from './helpers.mjs';

const [alice, eve] = await Promise.all(['alice', 'eve'].map(key));
const CARD = 'c'.repeat(16), AT = '2026-10-22T18:00:00.000Z';
const fields = (o = {}) => ({ card: CARD, set: 'telco', theme: 'synthwave-v1', caps: ['talk'], budget: 0, at: AT, ...o });
/** a pass minted and signed by hand, so a test can make one crown would refuse */
async function handMade(input, keys = alice, signer = keys) {
  const m = mintKard({ owner: keys.pub, skinRef: 'kardlings:theme:synthwave-v1', structureRef: 'kardlings:card:' + CARD, capabilities: ['talk'], budgetCap: 0, createdAt: AT, label: HERO + ' · telco', ...input });
  assert.ok(m.ok, m.why);
  return attachSignature(m.kard, keys.pub, await sign(signer, utf8(kardSignable(m.kard).payload))).kard;
}
const no = async (p, why) => { const r = await p; assert.equal(r.ok, false); assert.equal(r.why, why); };

test('the constants: three things a hero may do, one class per business of the drop, six steps', () => {
  assert.equal(HERO, 'kardlings hero');
  assert.deepEqual(CAPS, ['talk', 'remember', 'key']);
  assert.deepEqual(Object.keys(CLASSES).sort(), [...DATASETS].sort());
  assert.deepEqual(Object.values(CLASSES).map((c) => c.title), ['Telecom Tactician', 'Shopkeeper Sage', 'Bank Bard', 'Recruiter Ranger', 'Clinic Caretaker', 'Credit Crusader']);
  assert.deepEqual(STEPS.map((s) => s.id), ['crowned', 'talking', 'remembers', 'trained', 'keyed', 'geared']);
  assert.deepEqual([MAX_BUDGET, MAX_TURNS, MAX_FACTS, MAX_FACT, MAX_RULES, MAX_GEAR, MAX_LINE, MAX_Q], [50000000, 20, 12, 160, 6, 4, 200, 1000]);
  assert.deepEqual(PROVIDERS, ['anthropic', 'openai', 'google', 'openrouter']);
});

test('a class is its business: the six, and nothing else', () => {
  assert.deepEqual(classOf('shop'), { set: 'shop', title: 'Shopkeeper Sage', job: 'spot the shop visitors who will make a purchase' });
  for (const x of ['toy', 'constructor', 'toString', '', 5, null, undefined]) assert.equal(classOf(x), null);
});

test('what a hero may do: talk always, then remember and key, in that order, nothing else', () => {
  assert.deepEqual(capsOf([]), { ok: true, caps: ['talk'] });
  assert.deepEqual(capsOf(['key', 'remember']), { ok: true, caps: ['talk', 'remember', 'key'] });
  assert.deepEqual(capsOf(['key', 'talk']), { ok: true, caps: ['talk', 'key'] });
  assert.deepEqual(capsOf(['remember', 'remember']), { ok: true, caps: ['talk', 'remember'] });
  assert.deepEqual(capsOf('talk'), { ok: false, why: 'what a hero may do is a list' });
  assert.deepEqual(capsOf(['talk', 'fly']), { ok: false, why: 'a hero may only talk, remember or use a key, not fly' });
});

test('a pass: every field checked, the limit only with a key, fall-os’s shape out', () => {
  assert.deepEqual(passOf({ ...fields({ caps: ['key'], budget: 1000 }), owner: alice.pub }), { ok: true, input: { owner: alice.pub, skinRef: 'kardlings:theme:synthwave-v1', structureRef: 'kardlings:card:' + CARD, capabilities: ['talk', 'key'], budgetCap: 1000, createdAt: AT, label: 'kardlings hero · telco' } });
  const o = { owner: alice.pub };
  assert.equal(passOf().why, 'a hero is crowned by an Ed25519 key');
  assert.equal(passOf({ ...fields(), owner: 'A'.repeat(64) }).why, 'a hero is crowned by an Ed25519 key');
  assert.equal(passOf({ ...fields({ card: 'c'.repeat(15) }), ...o }).why, 'a hero is one of your cards: give its id');
  assert.equal(passOf({ ...fields({ set: 'toy' }), ...o }).why, 'a hero’s class is its card’s business, and there is no business called toy');
  assert.equal(passOf({ ...fields({ theme: 'Bad Theme' }), ...o }).why, 'a hero carries its card’s theme');
  assert.equal(passOf({ ...fields({ caps: ['fly'] }), ...o }).why, 'a hero may only talk, remember or use a key, not fly');
  for (const budget of [-1, 1.5, '5', MAX_BUDGET + 1]) assert.equal(passOf({ ...fields({ caps: ['key'], budget }), ...o }).why, 'a limit is a whole number of tokens from 0 to 50000000');
  assert.equal(passOf({ ...fields({ caps: ['key'], budget: MAX_BUDGET }), ...o }).ok, true);
  assert.equal(passOf({ ...fields({ caps: ['remember'], budget: 1 }), ...o }).why, 'a limit is only for a hero allowed a key');
  assert.equal(passOf({ ...fields({ caps: ['key'], budget: 0 }), ...o }).ok, true);
  for (const at of ['2026-10-22', '2026-10-22T18:00:00+01:00', '2026-10-22T18:00:00.1234Z', 5]) assert.equal(passOf({ ...fields({ at }), ...o }).why, 'a crowning needs its time, as an ISO time in UTC');
  assert.equal(passOf({ ...fields({ at: '2026-10-22T18:00:00Z' }), ...o }).ok, true);
});

test('crowning: the owner signs; the hero checks, says its card, class, theme, caps and limit', async () => {
  const c = await crown(alice, fields({ caps: ['key', 'remember'], budget: 5000, set: 'shop' }));
  assert.ok(c.ok, c.why);
  assert.equal(c.hero.signature.pub, alice.pub);
  assert.deepEqual(await heroOk(c.hero), { ok: true, owner: alice.pub, card: CARD, set: 'shop', cls: classOf('shop'), theme: 'synthwave-v1', caps: ['talk', 'remember', 'key'], budget: 5000, at: AT });
  assert.deepEqual(c.hero, await handMade({ capabilities: ['talk', 'remember', 'key'], budgetCap: 5000, label: HERO + ' · shop' }));   // Ed25519 is deterministic
  await no(crown(null, fields()), 'a hero is crowned by an Ed25519 key');
  await no(crown({ pub: 'x' }, fields()), 'a hero is crowned by an Ed25519 key');
  await no(crown(alice, { ...fields(), owner: eve.pub }), 'a hero is crowned by its owner’s own key');
  assert.equal((await crown(alice, { ...fields(), owner: alice.pub })).ok, true);
  await no(crown(alice, fields({ set: 'toy' })), 'a hero’s class is its card’s business, and there is no business called toy');
  await no(crown(alice), 'a hero is one of your cards: give its id');
});

test('a hero that is not its owner’s exact pass is refused, by name', async () => {
  const h = (await crown(alice, fields({ caps: ['key'], budget: 10 }))).hero;
  await no(heroOk(null), 'a hero is a pass');
  await no(heroOk([h]), 'a hero is a pass');
  await no(heroOk({ ...h, kind: 'other' }), 'not a fallkard');
  await no(heroOk({ ...h, budgetCap: 11 }), 'the kard does not match its own fingerprint — it was changed after it was minted');
  const bare = { ...h }; delete bare.signature;
  await no(heroOk(bare), 'a hero’s pass is signed by its owner');
  await no(heroOk(await handMade({ structureRef: 'kardlings:card:' + 'C'.repeat(16) })), 'a hero’s pass names one of your cards');
  await no(heroOk(await handMade({ structureRef: 'card:' + CARD })), 'a hero’s pass names one of your cards');
  await no(heroOk(await handMade({ skinRef: 'kardlings:theme:Bad' })), 'a hero’s pass names its card’s theme');
  await no(heroOk(await handMade({ skinRef: 'theme:synthwave-v1' })), 'a hero’s pass names its card’s theme');
  await no(heroOk(await handMade({ label: 'kardlings hero · toy' })), 'a hero’s class is its card’s business, and there is no business called toy');
  await no(heroOk(await handMade({ label: 'a hero · telco' })), 'a hero’s class is its card’s business, and there is no business called ');
  await no(heroOk(await handMade({ capabilities: ['remember', 'talk'] })), 'a hero’s pass lists what it may do in order, talk first');
  await no(heroOk(await handMade({ capabilities: ['remember'] })), 'a hero’s pass lists what it may do in order, talk first');
  await no(heroOk(await handMade({ capabilities: ['talk', 'fly'] })), 'a hero may only talk, remember or use a key, not fly');
  await no(heroOk(await handMade({ budgetCap: 5 })), 'a limit is only for a hero allowed a key');
  await no(heroOk(await handMade({ createdAt: 'yesterday' })), 'a crowning needs its time, as an ISO time in UTC');
  await no(heroOk(await handMade({}, alice, eve)), 'the pass’s signature does not check');
  // a pass whose label is not words at all, rehashed and signed by its owner: refused, not thrown
  const odd = { ...(await handMade({})), label: 5 }; delete odd.signature; delete odd.hash;
  const rehashed = { ...odd, hash: kardSha(canon(odd)).hash };
  const signedOdd = { ...rehashed, signature: { alg: 'Ed25519', pub: alice.pub, sig: await sign(alice, utf8(kardSignable(rehashed).payload)) } };
  await no(heroOk(signedOdd), 'a hero’s class is its card’s business, and there is no business called ');
  assert.equal((await heroOk(await handMade({}))).ok, true);
});

const HERO_A = { owner: alice.pub, set: 'telco', caps: ['talk', 'remember', 'key'] };
const CARD_A = { title: 'Tariff Tamer', department: 'Telecom contracts', rarity: 'rare', stage: 3, gate: 812345, outcome: 'left the company', rules: ['if the contract is month to month, it says yes', 'if tenure is over 40 months, it says no'] };
test('the opening: one exact text, the same bytes for the same hero, nothing about the question or the time', () => {
  const o = opening(HERO_A, { card: CARD_A, memory: ['you are a plumber in Leeds', 'you prefer short answers'], gear: ['Kit: Bill Watcher #0042'] });
  const head = ['You are Tariff Tamer, a Kardlings hero: a Telecom Tactician. Your job: keep phone and internet customers from leaving.',
    'Your owner is the player whose key begins ' + alice.pub.slice(0, 8) + '. You work for them.',
    'Your card: Telecom contracts · rare · stage 3. It predicts whether a case left the company.',
    'Its score on cases it never saw (GATE AUC), measured on this device: 0.812.',
    'Your rules, the only ones your card answers with:', '1. if the contract is month to month, it says yes', '2. if tenure is over 40 months, it says no',
    'What you remember of your owner, from their own words:', '- you are a plumber in Leeds', '- you prefer short answers', 'Your gear: Kit: Bill Watcher #0042.'].join('\n');
  assert.equal(o.text, head + '\n\n' + GAME + '\n\n' + MANNER);
  assert.deepEqual([o.ok, o.hash, o.tokens], [true, sha256Hex(o.text), tokensOf(o.text)]);
  assert.deepEqual(opening(HERO_A, { card: CARD_A, memory: ['you are a plumber in Leeds', 'you prefer short answers'], gear: ['Kit: Bill Watcher #0042'] }), o);
  assert.ok(o.tokens > 512, 'long enough for a provider to cache it: ' + o.tokens);
});

test('the opening: memory only when its owner allows it; lists cut to their limits; defaults said', () => {
  const quiet = { ...HERO_A, caps: ['talk', 'key'] };
  const a = opening(quiet, { card: CARD_A, memory: ['secret fact'] }), b = opening(quiet, { card: CARD_A });
  assert.equal(a.text, b.text);
  assert.ok(a.text.includes('Your owner has not shared what you remember of them with this provider.') && !a.text.includes('secret fact'));
  assert.ok(opening(HERO_A, { card: CARD_A }).text.includes('You do not remember anything about your owner yet.'));
  const many = Array.from({ length: 20 }, (_, i) => 'fact  number   ' + i + ' ' + 'x'.repeat(300));
  const m = opening(HERO_A, { card: { ...CARD_A, rules: [5, null, ...many, ''], stage: undefined, rarity: '', department: '', outcome: '', gate: null }, memory: ['', 5, ...many], gear: [' ', ...many] });
  const lines = m.text.split('\n');
  assert.equal(lines.filter((l) => /^\d+\. fact number \d+ x+$/.test(l)).length, MAX_RULES);
  assert.ok(lines.filter((l) => /^\d+\. /.test(l)).every((l) => l.length === (l.indexOf(' ') + 1) + MAX_LINE));
  assert.equal(lines.filter((l) => l.startsWith('- fact number ')).length, MAX_FACTS);
  assert.ok(lines.filter((l) => l.startsWith('- fact number ')).every((l) => l.length === 2 + MAX_FACT));
  assert.equal((lines.find((l) => l.startsWith('Your gear: ')).match(/fact number/g) || []).length, MAX_GEAR);
  assert.ok(m.text.includes('Your card: Tariff Tamer · common · stage 0. It predicts whether a case happened.'));
  assert.ok(m.text.includes('Its score on cases it never saw has not been measured on this device yet.'));
  assert.ok(opening(HERO_A, { card: { ...CARD_A, rules: [] } }).text.includes('Your rules are not in this opening.'));
  assert.ok(opening(HERO_A, { card: CARD_A }).text.includes('You carry no gear yet.'));
  assert.ok(opening(HERO_A, { card: { ...CARD_A, gate: 1000000 } }).text.includes('measured on this device: 1.000.'));
  assert.ok(opening(HERO_A, { card: { ...CARD_A, gate: 0 } }).text.includes('measured on this device: 0.000.'));
  assert.notEqual(opening(HERO_A, { card: CARD_A, memory: ['a'] }).hash, opening(HERO_A, { card: CARD_A, memory: ['b'] }).hash);
});

test('the opening refuses what is not a checked hero and its card', () => {
  const why = (h, x) => opening(h, x).why;
  for (const h of [null, { ...HERO_A, owner: 'x' }, { ...HERO_A, set: 'toy' }, { ...HERO_A, caps: 'talk' }]) assert.equal(why(h, { card: CARD_A }), 'an opening is for a checked hero');
  for (const card of [undefined, { ...CARD_A, title: '  ' }, { ...CARD_A, title: 5 }]) assert.equal(why(HERO_A, { card }), 'an opening says its card');
  assert.equal(why(HERO_A), 'an opening says its card');
  for (const x of [{ card: { ...CARD_A, rules: 'r' } }, { card: CARD_A, memory: 'm' }, { card: CARD_A, gear: 'g' }]) assert.equal(why(HERO_A, x), 'rules, memory and gear are lists');
  for (const gate of [1000001, -1, 0.5, undefined, '812345']) assert.equal(why(HERO_A, { card: { ...CARD_A, gate } }), 'a GATE score is a whole number of millionths, or none');
});

test('routing: rules first, then memory about you, then your key inside its limit, else said plainly', async () => {
  const keyed = (await crown(alice, fields({ caps: ['key'], budget: 1000 }))).hero, talkOnly = (await crown(alice, fields())).hero;
  const r = (q, ctx) => route(q, ctx);
  assert.deepEqual(r('is it yes?', { rules: 'VERIFIED', recalled: 3, hero: keyed, keyReady: true, spent: 0, cost: 10 }), { ok: true, brain: 'rules', why: 'its card’s rules answer this exactly, on this device' });
  assert.deepEqual(r('what do I like?', { rules: 'ABSTAINED', recalled: 2, hero: keyed, keyReady: true, spent: 0, cost: 10 }), { ok: true, brain: 'memory', why: 'it remembers this about you, on this device' });
  for (const q of ['Who am I', 'remember me?', 'MY name', 'tell me', 'what is mine']) assert.equal(r(q, { recalled: 1 }).brain, 'memory');
  assert.equal(r('who am I?', { recalled: 0 }).brain, 'none');
  assert.equal(r('what is my name?', { recalled: 0, hero: keyed, keyReady: true, spent: 0, cost: 1 }).brain, 'key');
  assert.equal(r('a mystery', { recalled: 1, hero: keyed, keyReady: true, spent: 0, cost: 10 }).brain, 'key');
  assert.deepEqual(r('what is churn?', { recalled: 0, hero: keyed, keyReady: true, spent: 0, cost: 10 }), { ok: true, brain: 'key', why: 'your key, within its limit: 990 tokens left after this' });
  assert.deepEqual(r('what is churn?', { hero: keyed, keyReady: true, spent: 990, cost: 10 }), { ok: true, brain: 'key', why: 'your key, within its limit: 0 tokens left after this' });
  assert.deepEqual(r('what is churn?', { hero: keyed, keyReady: true, spent: 991, cost: 10 }), { ok: true, brain: 'none', why: 'your key’s limit would be passed: 9 tokens are left, and this needs about 10' });
  assert.equal(r('what is churn?', { recalled: 4, hero: keyed, keyReady: true, spent: 1000, cost: 1 }).brain, 'memory');
  assert.deepEqual(r('what is churn?', { recalled: 2 }), { ok: true, brain: 'memory', why: 'it remembers something near this, on this device' });
  assert.deepEqual(r('what is churn?', {}), { ok: true, brain: 'none', why: 'its rules cannot answer this exactly, and it has no key: give it yours to ask it anything' });
  assert.deepEqual(r('what is churn?', { hero: talkOnly, keyReady: true, spent: 0, cost: 1 }), { ok: true, brain: 'none', why: 'its pass does not let it use your key' });
  assert.equal(r('what is churn?', { hero: keyed, keyReady: 1, spent: 0, cost: 1 }).brain, 'none');
  assert.equal(r('what is churn?', { hero: keyed, keyReady: false, spent: 0, cost: 1 }).why, 'its rules cannot answer this exactly, and it has no key: give it yours to ask it anything');
  assert.equal(r('what is churn?', { hero: { capabilities: ['key'] }, keyReady: true, spent: 0, cost: 1 }).why, 'not a fallkard');
  for (const [spent, cost] of [[-1, 1], [0, -1], [0.5, 1], [0, 1.5], [undefined, 1]]) assert.equal(r('q', { hero: keyed, keyReady: true, spent, cost }).why, 'what a key has used and what a question would use are whole numbers of tokens');
  assert.equal(r('q', { recalled: -1 }).brain, 'none');
  for (const q of ['', '   ', 5, null]) assert.equal(r(q, {}).why, 'a question is words');
  assert.equal(r('x'.repeat(MAX_Q + 1), {}).why, 'a question is at most 1000 characters');
  assert.equal(r('x'.repeat(MAX_Q), {}).ok, true);
  assert.equal(r('q', 'ctx').why, 'a question is routed with what the hero holds');
  assert.equal(r('q').brain, 'none');
});

test('a question about its owner: the kinds of fact it asks for, and an answer from those facts only', () => {
  assert.deepEqual(kindsAsked('what do I prefer?'), ['preference']);
  assert.deepEqual(kindsAsked('what am I working on?'), ['project']);
  assert.deepEqual(kindsAsked('who am I?'), ['identity']);
  assert.deepEqual(kindsAsked('who is my friend, and what do I like?'), ['preference', 'person']);
  assert.deepEqual(kindsAsked('who am I and what do I love?'), ['preference']);
  assert.deepEqual(kindsAsked('what is churn?'), []);
  assert.deepEqual(kindsAsked('do they like it?'), []);   // not about its owner
  assert.deepEqual(kindsAsked('tell me something'), []);
  assert.deepEqual(kindsAsked(5), []);
  assert.deepEqual(ASKS_ABOUT.map(([k]) => k), ['preference', 'project', 'person', 'identity']);
  const facts = [{ kind: 'preference', text: 'short answers', weight: 3 }, { kind: 'preference', text: 'tea', weight: 5 }, { kind: 'preference', text: 'boats', weight: 5 },
    { kind: 'preference', text: 'jazz', weight: 1 }, { kind: 'preference', text: 'rain', weight: 'x' }, { kind: 'person', text: 'Dave Smith', weight: 3 }, { kind: 'identity', text: 'a plumber in Leeds', weight: 4 },
    { kind: 'preference', text: '  ', weight: 9 }, { kind: 'preference', text: 5 }, null];
  assert.deepEqual(fromMemory('what do I like?', facts), { ok: true, matched: 3, answer: 'From what you told me: you prefer boats; you prefer tea; you prefer short answers.' });
  assert.deepEqual(fromMemory('who is my friend?', facts), { ok: true, matched: 1, answer: 'From what you told me: you mentioned Dave Smith.' });
  assert.deepEqual(fromMemory('who is my friend and what do I like?', facts.slice(4)), { ok: true, matched: 2, answer: 'From what you told me: you prefer rain; you mentioned Dave Smith.' });
  assert.deepEqual(fromMemory('who am I?', facts), { ok: true, matched: 1, answer: 'From what you told me: you are a plumber in Leeds.' });
  assert.deepEqual(fromMemory('what is churn?', facts), { ok: true, matched: 0, answer: '' });
  assert.equal(fromMemory('who am I?', [{ kind: 'identity', text: 'x'.repeat(400) }]).answer.length, 'From what you told me: you are '.length + MAX_FACT + 1);
  assert.equal(fromMemory('who am I?', 'facts').why, 'a memory is a list of facts');
});

test('what a question would use: the opening, the page, the question and the longest answer', () => {
  const page = [{ role: 'user', content: 'abcd' }, { role: 'assistant', content: [{ type: 'text', text: 'hi' }] }];
  assert.deepEqual(costOf('x'.repeat(40), page, 'abcdefgh', 100), { ok: true, cost: 10 + 1 + tokensOf(JSON.stringify(page[1].content)) + 2 + 100 });
  assert.deepEqual(costOf('', [], '', 0), { ok: true, cost: 0 });
  assert.equal(costOf('', [null], '', 0).cost, 0);
  assert.equal(costOf('', [{ role: 'user' }], '', 0).cost, 1);
  assert.equal(costOf('', [{ role: 'user', content: 'x'.repeat(9) }], '', 0).cost, 3);
  for (const a of [[5, [], 'q', 1], ['o', 'p', 'q', 1], ['o', [], 5, 1], ['o', [], 'q', -1], ['o', [], 'q', 1.5]]) assert.equal(costOf(...a).why, 'a cost is reckoned from an opening, a page, a question and a limit');
});

test('a page only grows: the question appended to the very same turns; a full page starts fresh', () => {
  const pair = (i) => [{ role: 'user', content: 'q' + i }, { role: 'assistant', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'a' + i }] }];
  const page = [...pair(0), ...pair(1)];
  const t = turns(page, 'next?');
  assert.deepEqual(t, { ok: true, messages: [...page, { role: 'user', content: 'next?' }], fresh: false });
  assert.ok(t.messages[1] === page[1] && t.messages.length === 5 && page.length === 4);
  const almost = Array.from({ length: MAX_TURNS - 1 }, (_, i) => pair(i)).flat();
  assert.equal(turns(almost, 'q').fresh, false);
  const full = Array.from({ length: MAX_TURNS }, (_, i) => pair(i)).flat();
  assert.deepEqual(turns(full, 'q'), { ok: true, messages: [{ role: 'user', content: 'q' }], fresh: true });
  assert.deepEqual(turns([], 'q'), { ok: true, messages: [{ role: 'user', content: 'q' }], fresh: false });
  assert.equal(turns('page', 'q').why, 'a page is whole question-and-answer pairs');
  assert.equal(turns([pair(0)[0]], 'q').why, 'a page is whole question-and-answer pairs');
  for (const bad of [[pair(0)[1], pair(0)[0]], [pair(0)[0], pair(0)[0]], [null, pair(0)[1]], [pair(0)[0], { role: 'user' }]]) assert.equal(turns(bad, 'q').why, 'a page alternates your questions and its answers, yours first');
  for (const q of ['', ' ', 5, 'x'.repeat(MAX_Q + 1)]) assert.equal(turns([], q).why, 'a question is words, at most 1000 characters');
  assert.equal(turns([], 'x'.repeat(MAX_Q)).ok, true);
});

test('usage, read the same way from every provider: what was read, reused, cached, written', () => {
  assert.deepEqual(usedOf('anthropic', { input_tokens: 40, cache_read_input_tokens: 900, cache_creation_input_tokens: 60, output_tokens: 120 }), { ok: true, read: 1000, recycled: 900, cached: 60, out: 120, total: 1120 });
  assert.deepEqual(usedOf('anthropic', {}), { ok: true, read: 0, recycled: 0, cached: 0, out: 0, total: 0 });
  assert.deepEqual(usedOf('openai', { prompt_tokens: 1000, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 768 } }), { ok: true, read: 1000, recycled: 768, cached: 0, out: 50, total: 1050 });
  assert.deepEqual(usedOf('openrouter', { prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 50 } }), { ok: true, read: 10, recycled: 10, cached: 0, out: 5, total: 15 });
  assert.deepEqual(usedOf('openrouter', { prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: 'x' }), { ok: true, read: 10, recycled: 0, cached: 0, out: 5, total: 15 });
  assert.deepEqual(usedOf('google', { promptTokenCount: 800, cachedContentTokenCount: 700, candidatesTokenCount: 30, thoughtsTokenCount: 20 }), { ok: true, read: 800, recycled: 700, cached: 0, out: 50, total: 850 });
  assert.deepEqual(usedOf('google', { promptTokenCount: 8, cachedContentTokenCount: 70 }), { ok: true, read: 8, recycled: 8, cached: 0, out: 0, total: 8 });
  assert.deepEqual(usedOf('openai', { prompt_tokens: -5, completion_tokens: 1.5 }), { ok: true, read: 0, recycled: 0, cached: 0, out: 0, total: 0 });
  assert.equal(usedOf('ollama', {}).why, 'the providers are anthropic, openai, google, openrouter');
  assert.equal(usedOf('openai', null).why, 'a provider’s usage is an object');
});

test('a level: the steps lit by what the hero did, the last one lit, and the one next thing', () => {
  assert.deepEqual(levelOf({}), { ok: true, level: 0, of: 6, lit: [false, false, false, false, false, false], title: 'Not crowned', next: STEPS[0].next });
  assert.deepEqual(levelOf({ crowned: true, asked: 2 }), { ok: true, level: 1, of: 6, lit: [true, false, false, false, false, false], title: 'Crowned', next: STEPS[1].next });
  assert.deepEqual(levelOf({ crowned: true, asked: 3, remembered: 1 }).lit, [true, true, true, false, false, false]);
  assert.deepEqual(levelOf({ crowned: 'yes', asked: 3, trained: 1, keyed: 1, geared: 1 }), { ok: true, level: 4, of: 6, lit: [false, true, false, true, true, true], title: 'Geared', next: STEPS[0].next });
  const all = levelOf({ crowned: true, asked: 9, remembered: 4, trained: 2, keyed: 3, geared: 1 });
  assert.deepEqual([all.level, all.title, all.next], [6, 'Geared', 'Every step is lit: take your hero on raids, and keep training it.']);
  assert.deepEqual(levelOf({ crowned: true, asked: -3, remembered: 0.5, trained: '1', keyed: null }).level, 1);
  assert.equal(levelOf('acts').why, 'a level is read from what the hero has done');
  assert.equal(levelOf().level, 0);
});

test('fuzz: junk into every function is refused or answered, never thrown', async () => {
  const junk = [undefined, null, 0, -1, 1.5, NaN, '', 'x', [], [1], {}, { a: 1 }, () => 1, Symbol.iterator, true];
  for (const a of junk) for (const b of junk) {
    classOf(a); capsOf(a); passOf(a); levelOf(a); route(a, b); costOf(a, b, a, b); turns(a, b); usedOf(a, b); kindsAsked(a); fromMemory(a, b);
    if (typeof a !== 'symbol' && typeof b !== 'symbol') opening(a, { card: b });
    await heroOk(a); await crown(a, b);
  }
});
