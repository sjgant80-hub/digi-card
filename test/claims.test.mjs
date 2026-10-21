// claims.test.mjs — a post passes the claim gate only on claims that re-run now, with every number it says vouched for
// by one of them, none of what a card cannot prove, and the way to re-run it yourself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gate, numbersIn, KINDS, NEVER, PAGE, MAX_POST } from '../src/claims.mjs';

const holds = (says) => async () => ({ ok: true, says });
const checkers = { grown: holds(['0.739214', '0001']), level: holds(['3']), verified: holds([]), owned: holds([]) };
const post = (text, claims = [{ kind: 'grown', card: 'x' }]) => ({ text, claims });
const ok = 'Decoder #0001 grew a credit-collections mind that scores 0.739214 on cases it never saw. Re-run it yourself: ' + PAGE;

test('a post that rests on claims that re-run, says only their numbers, and shows how to re-run it, passes', async () => {
  assert.deepEqual(await gate(post(ok), checkers), { ok: true, says: ['0.739214', '0001'] });
  assert.deepEqual(KINDS, ['verified', 'owned', 'grown', 'offline', 'level', 'born', 'mesh', 'drop']);
  assert.equal(PAGE, 'https://sjgant80-hub.github.io/digi-card/');
  const two = await gate(post('Card 0001 reached level 3, every level re-run. ' + PAGE + '#card=4f2a99c0', [{ kind: 'grown' }, { kind: 'level' }]), checkers);
  assert.deepEqual(two, { ok: true, says: ['0.739214', '0001', '3'] }, 'a link into the page carries no claim');
  assert.ok((await gate(post('1,000 genesis cards. re-run ' + PAGE, [{ kind: 'grown' }]), { grown: holds(['1000']) })).ok, 'a vouched number may be written with commas');
  assert.deepEqual(numbersIn('#0001 scored 0.739214, 1,000 cards, level 3'), ['0001', '0.739214', '1,000', '3']);
  assert.deepEqual(numbersIn('no numbers'), []);
});

test('every way a post overreaches is refused, naming it', async () => {
  const cases = {
    'no text': [{ claims: [{ kind: 'grown' }] }, 'a post has text'],
    'blank text': [post('   '), 'a post has text'],
    'nothing': [null, 'a post has text'],
    'too long': [post('re-run ' + PAGE + ' ' + 'x'.repeat(MAX_POST)), 'a post is at most 280 characters'],
    'no claims': [post(ok, []), 'a post rests on at least one claim a card can prove'],
    'claims not a list': [post(ok, 'grown'), 'a post rests on at least one claim a card can prove'],
    'no page': [post('Card 0001 scores 0.739214. re-run it at home.'), 'a post carries the live page, so anyone can re-run it: ' + PAGE],
    'no re-run': [post('Card 0001 scores 0.739214. ' + PAGE), 'a post says how to check it: re-run it yourself'],
    'a claim of no kind': [post(ok, [{ kind: 'vibes' }]), 'claim 0 is not of a kind a card can prove'],
    'a claim that is not a record': [post(ok, ['grown']), 'claim 0 is not of a kind a card can prove'],
    'a kind with no checker': [post(ok, [{ kind: 'born' }]), 'claim 0 (born) has no checker here to re-run it'],
    'an unvouched number': [post('Decoder #0001 scores 0.739215. Re-run it yourself: ' + PAGE), 'the post says 0.739215, which no claim it rests on just re-ran'],
    'a number no claim names': [post(ok.replace('Decoder', '1000 cards. Decoder')), 'the post says 1000, which no claim it rests on just re-ran'],
  };
  for (const [what, [p, why]] of Object.entries(cases)) assert.equal((await gate(p, checkers)).why, why, what);
  assert.equal((await gate(post(ok), null)).why, 'claim 0 (grown) has no checker here to re-run it');
  const failing = {
    'it does not hold': [async () => ({ ok: false, why: 'the mind scores 0.701 here' }), 'claim 0 (grown) did not hold: the mind scores 0.701 here'],
    'it holds loosely': [async () => ({ ok: 1, says: [] }), 'claim 0 (grown) did not hold: no reason given'],
    'it says nothing': [async () => null, 'claim 0 (grown) did not hold: no reason given'],
    'it throws': [async () => { throw new Error('x'); }, 'claim 0 (grown) did not hold: no reason given'],
    'it vouches for no list': [async () => ({ ok: true, says: '0.739214' }), 'claim 0 (grown) vouched for no numbers'],
  };
  for (const [what, [c, why]] of Object.entries(failing)) assert.equal((await gate(post(ok), { grown: c })).why, why, what);
  assert.equal((await gate(post(ok, [{ kind: 'grown' }, { kind: 'mesh' }]), checkers)).why, 'claim 1 (mesh) has no checker here to re-run it', 'every claim is checked, in order');
});

test('a post never says what a card cannot prove, however it is written', async () => {
  const words = {
    'self-aware': ['This DIGI is self-aware.', 'self aware', 'SELF-AWARE', 'selfaware'],
    'conscious': ['a conscious mind', 'Consciousness'],
    'sentient': ['sentient', 'sentience'],
    'alive': ['it is alive'],
    'feels': ['it feels', 'feelings'],
    'AGI': ['an AGI card'],
    'superintelligent': ['superintelligent', 'super intelligence'],
    'guaranteed': ['guaranteed', 'a guarantee'],
    'risk-free': ['risk-free', 'risk free'],
    'price': ['the price', 'priced at', 'pricing'],
    'money': ['money'],
    'profit': ['profit', 'profitable'],
    'returns': ['returns', 'great return'],
    'investment': ['invest now', 'an investment'],
    'a currency sign': ['$', '£', '€', '¥', '₿'],
    'the moon': ['to the moon', 'mooning'],
    'floor': ['the floor is up'],
    'pump': ['pump it', 'pumping'],
    'passive income': ['passive income', 'passive  income'],
  };
  assert.deepEqual(NEVER.map(([w]) => w), Object.keys(words));
  for (const [word, texts] of Object.entries(words)) for (const t of texts) assert.equal((await gate(post(ok + ' ' + t), checkers)).why, 'a post never says ' + word + ': a card cannot prove it', t);
  for (const fine of ['it feeds the mesh', 'aware of its gate', 'priceless? no', 'the pumpkin dataset', 'a floored mind']) assert.ok((await gate(post(ok + ' ' + fine), checkers)).ok, fine);
});
