// talker.test.mjs — a card asked in words: it reads the values a question gives with its department's vocabulary, answers
// yes or no with the rules that fired, says its rules and its score, and abstains on anything else — never a guess.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, reply, intentOf, vocabOf, sayRule, sayValue, sayFeature, sayCase, sayNumber, norm, order, asks, RECEIPT, MAX_Q } from '../src/talker.mjs';
import { answer } from '../src/mind.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

const VOC = {
  thing: 'customer', outcome: 'leave',
  columns: {
    tenure: { say: 'tenure', kind: 'number', unit: 'months', words: ['tenure', 'months as a customer'] },
    charges: { say: 'monthly charges', kind: 'number', unit: 'dollars a month', words: ['monthly charges'] },
    total: { say: 'total charges', kind: 'number', words: ['total charges'] },
    paper: { say: 'paperless billing', kind: 'flag', words: ['paperless billing', 'paperless'] },
    loan: { say: 'personal loan', kind: 'tri', words: ['personal loan'] },
    contract: { say: 'contract', kind: 'levels', words: ['contract'], levels: { 'month-to-month': 0, 'one year': 1, 'two year': 2 } },
    month: { say: 'month', kind: 'levels', words: ['month'], bare: true, levels: { may: 5, june: 6 } },
    labs: { say: 'lab procedures', kind: 'number', words: ['lab procedures'] },
    procs: { say: 'procedures', kind: 'number', words: ['procedures'] },
  },
  groups: { job: { say: 'job', words: ['job'], none: ['unknown job'], members: { job_tech: ['technician'], job_admin: ['admin'] } } },
};
const FEATS = ['tenure', 'charges', 'total', 'paper', 'loan', 'contract', 'month', 'labs', 'procs', 'job_tech', 'job_admin'];
const RULES = [{ feat: 'tenure', op: '<=', v: 12, w: 2 }, { feat: 'contract', op: '>', v: 0.5, w: -2 }, { feat: 'paper', op: '>', v: 0.5, w: 0.5 }];
const MIND = { organs: [{ state: 'live', domain: 'toy-a', recipe: 'r1', fixed: 'f1', body: { rules: RULES, threshold: 1 } }], live: 1, gate: 700000, coupling: null, threshold: 1 };
const CTX = { mind: MIND, voc: VOC, features: FEATS, gate: 712345, rows: 1761 };
const hash = sha256Hex(canonical(['f1']));

test('words and numbers as the reader sees them', () => {
  assert.equal(norm('Tenure: 1,200 — Monthly Charges $80!'), ' tenure: 1200 monthly charges $80 ');
  assert.equal(norm('It’s   A  B?'), " it's a b ");
  assert.deepEqual([sayNumber(12), sayNumber(0.0000123), sayNumber(-0), sayNumber(70.3500004), sayNumber(1e-7), sayNumber(NaN)], ['12', '0.000012', '0', '70.35', '0', 'NaN']);
  const vocab = JSON.parse(readFileSync(new URL('../data/vocab.json', import.meta.url), 'utf8'));
  assert.equal(vocabOf(vocab, 'telco').thing, 'customer');
  for (const bad of [[null, 'telco'], [vocab, 'nope'], [{ sets: { x: { columns: 1, groups: {} } } }, 'x'], [{ sets: 'x' }, 'x'], [vocab, 'constructor']]) assert.equal(vocabOf(...bad), null);
  assert.equal(MAX_Q, 1000);
  assert.deepEqual([order('a', 'b'), order('b', 'a'), order('a', 'a')], [-1, 1, 0], 'a three-way compare, 0 only for the same text');
});

test('parse: numbers after or before their names, flags, yes/no/unknown, levels near or bare, families, longest name first', () => {
  const p = (q) => parse(q, VOC, FEATS);
  assert.deepEqual(p('a customer with tenure of 30, monthly charges $80.5 and a two year contract').case, { tenure: 30, charges: 80.5, contract: 2 });
  assert.deepEqual(p('30 months as a customer').case, { tenure: 30 });
  assert.deepEqual(p('tenure is 4 and total charges = -1').case, { tenure: 4, total: -1 });
  assert.deepEqual(p('tenure 5 years total charges').case, { tenure: 5 }, 'a number already read is not read again');
  assert.deepEqual(p('paperless billing').case, { paper: 1 });
  assert.deepEqual([p('no paperless billing').case, p('without the paperless').case, p('paperless: no').case, p('paperless billing = 1').case, p('paperless false').case], [{ paper: 0 }, { paper: 0 }, { paper: 0 }, { paper: 1 }, { paper: 0 }]);
  assert.deepEqual([p('personal loan unknown').case, p('an unknown personal loan').case, p('personal loan yes').case, p('no personal loan').case], [{ loan: 0.5 }, { loan: 0.5 }, { loan: 1 }, { loan: 0 }]);
  assert.deepEqual(p('paperless unknown').case, {}, 'a flag is never unknown');
  assert.deepEqual([p('contract: one year').case, p('a month-to-month contract').case, p('contract').case], [{ contract: 1 }, { contract: 0 }, {}]);
  assert.deepEqual(p('contract, as it happens, for ever after, two year').case, {}, 'a level too far from its name is not read');
  assert.deepEqual([p('called in june').case, p('month may').case], [{ month: 6 }, { month: 5 }]);
  assert.deepEqual([p('works as a technician').case, p('job admin').case, p('an unknown job').case], [{ job_tech: 1, job_admin: 0 }, { job_tech: 0, job_admin: 1 }, { job_tech: 0, job_admin: 0 }]);
  assert.deepEqual(p('lab procedures 7 and procedures 2').case, { labs: 7, procs: 2 }, 'the longer name is read first');
  assert.deepEqual(p('7 lab procedures').case, { labs: 7 });
  const c = p('tenure 3 and tenure 4, a technician and an admin');
  assert.deepEqual([c.case.tenure, c.conflicts], [3, ['tenure', 'job_tech', 'job_admin']]);
  assert.deepEqual(p('tenure 3, then tenure 3').conflicts, [], 'the same value twice is one value');
  assert.deepEqual(p('tenure 3').said, { tenure: 'tenure' });
  assert.deepEqual(parse('tenure 3', VOC, ['charges']).case, {}, 'only the columns given');
  for (const [q, v, f] of [[5, VOC, FEATS], ['tenure 3', null, FEATS], ['tenure 3', VOC, 'x']]) assert.deepEqual(parse(q, v, f), { case: {}, said: {}, conflicts: [] });
  assert.deepEqual(parse('tenure 3', { ...VOC, columns: { ...VOC.columns, tenure: 'x' } }, FEATS).case, {});
  assert.deepEqual(parse('x'.repeat(1100) + ' tenure 3', VOC, FEATS).case, {}, 'only the first 1,000 characters are read');
  assert.deepEqual(p('without paperless, with personal loan').case, { paper: 0, loan: 1 }, 'a clause mark and a with end a negation');
  assert.deepEqual(p('without paperless and personal loan yes').case, { paper: 0, loan: 1 });
  assert.deepEqual(p('personal loan unknown, without paperless').case, { loan: 0.5, paper: 0 }, 'an unknown is its own clause');
  assert.deepEqual(p('unknown, personal loan').case, { loan: 1 }, 'an unknown across a clause mark is not this one');
  assert.deepEqual(p('two year, contract').case, {}, 'a level across a clause mark is not this one');
  assert.deepEqual(p('contract one year, month june').case, { contract: 1, month: 6 });
  assert.deepEqual(p('two year contract one year').case, { contract: 1 }, 'the level after its name comes first');
  assert.deepEqual(p('tenure 2.666666667').case, { tenure: 2.666666667 });
  const gap = (n) => 'x'.repeat(n);
  assert.deepEqual([p('contract ' + gap(22) + ' two year').case, p('contract ' + gap(23) + ' two year').case, p('two year ' + gap(22) + ' contract').case, p('two year ' + gap(23) + ' contract').case], [{ contract: 2 }, {}, { contract: 2 }, {}], 'a level is read up to 24 characters from its name');
  const V2 = { ...VOC, columns: { plan: { say: 'plan', kind: 'levels', words: ['plan'], levels: { gold: 1, 'gold plus': 2, 'rose gold': 3 } } }, groups: {} };
  assert.deepEqual([parse('plan gold plus', V2, ['plan']).case, parse('rose gold plan', V2, ['plan']).case, parse('plan gold', V2, ['plan']).case], [{ plan: 2 }, { plan: 3 }, { plan: 1 }], 'at the same place the longer level stands');
});

test('intent: a case it can read, how it decides, how good it is, or anything else', () => {
  const i = (q) => intentOf(q, parse(q, VOC, FEATS));
  assert.deepEqual([i('tenure 4: will they leave?'), i('why do customers leave?'), i('what makes a customer leave'), i('How good are you?'), i('what is your AUC'), i('hello there'), i('how often are you right, and why')], ['ask', 'explain', 'explain', 'measure', 'measure', 'other', 'measure']);
  assert.equal(intentOf('explain', null), 'explain');
});

test('saying: features, values, rules and cases in words', () => {
  assert.deepEqual([sayFeature('tenure', VOC), sayFeature('job_tech', VOC), sayFeature('zzz', VOC)], ['tenure', 'job technician', 'zzz']);
  assert.deepEqual([sayValue('tenure', 30, VOC), sayValue('paper', 1, VOC), sayValue('paper', 0, VOC), sayValue('loan', 0.5, VOC), sayValue('contract', 2, VOC), sayValue('contract', 9, VOC), sayValue('job_tech', 1, VOC), sayValue('job_tech', 0, VOC), sayValue('zzz', 3, VOC)],
    ['tenure 30', 'with paperless billing', 'without paperless billing', 'personal loan unknown', 'contract two year', 'contract 9', 'technician', 'not technician', 'zzz 3']);
  assert.deepEqual([sayRule({ feat: 'tenure', op: '<=', v: 12.5, w: 2 }, VOC), sayRule({ feat: 'total', op: '>', v: 3, w: 1 }, VOC), sayRule({ feat: 'paper', op: '>', v: 0.5, w: 1 }, VOC), sayRule({ feat: 'paper', op: '<=', v: 0.5, w: 1 }, VOC),
    sayRule({ feat: 'loan', op: '>', v: 0.25, w: 1 }, VOC), sayRule({ feat: 'contract', op: '>', v: 0.5, w: 1 }, VOC), sayRule({ feat: 'contract', op: '<=', v: 0.5, w: 1 }, VOC), sayRule({ feat: 'contract', op: '>', v: 5, w: 1 }, VOC), sayRule({ feat: 'contract', op: '<=', v: -1, w: 1 }, VOC),
    sayRule({ feat: 'job_tech', op: '>', v: 0.5, w: 1 }, VOC), sayRule({ feat: 'job_tech', op: '<=', v: 0.5, w: 1 }, VOC), sayRule({ feat: 'zzz', op: '>', v: 1, w: 1 }, VOC), sayRule({ feat: 'zzz', op: '<=', v: 1, w: 1 }, VOC)],
  ['when tenure is at or below 12.5 months', 'when total charges is above 3', 'when it has paperless billing', 'when it has no paperless billing', 'when personal loan is above 0.25 (no 0, unknown 0.5, yes 1)', 'when contract is one year or two year', 'when contract is month-to-month', 'when contract is above 5', 'when contract is at or below -1',
    'when the job is technician', 'when the job is not technician', 'when zzz is above 1', 'when zzz is at or below 1']);
  assert.deepEqual(sayCase({ tenure: 30, job_tech: 0, job_admin: 1, paper: 0 }, VOC, FEATS), ['tenure 30', 'without paperless billing', 'job admin']);
  const r = (feat, op, v) => sayRule({ feat, op, v, w: 1 }, VOC);
  assert.deepEqual([r('contract', '<=', 1), r('contract', '>', 1), r('contract', '>', 0), r('contract', '<=', 0)], ['when contract is month-to-month or one year', 'when contract is two year', 'when contract is one year or two year', 'when contract is month-to-month'], 'a level on the cut is at or below it');
  assert.deepEqual([r('paper', '>', 0), r('paper', '<=', 0), r('paper', '>', 1), r('paper', '<=', -0.5), r('paper', '>', 0.999)], ['when it has paperless billing', 'when it has no paperless billing', 'when paperless billing is above 1 (no 0, yes 1)', 'when paperless billing is at or below -0.5 (no 0, yes 1)', 'when it has paperless billing'], 'a yes/no column is said as has or has not only for a cut between no and yes');
  assert.deepEqual([r('job_tech', '>', 0), r('job_tech', '<=', 0), r('job_tech', '>', 1), r('job_tech', '<=', -1)], ['when the job is technician', 'when the job is not technician', 'when job technician is above 1 (no 0, yes 1)', 'when job technician is at or below -1 (no 0, yes 1)']);
  assert.deepEqual(sayCase({ job_tech: 0, job_admin: 0 }, VOC, FEATS), ['unknown job']);
  assert.deepEqual(sayCase({ job_tech: 0, job_admin: 0 }, { ...VOC, groups: { job: { ...VOC.groups.job, none: undefined } } }, FEATS), ['job other']);
  assert.deepEqual(sayCase({ tenure: 3 }, VOC, ['tenure', 'tenure']), ['tenure 3']);
  for (const x of [{ tenure: 30, charges: 80.5, contract: 2, paper: 1, month: 6, job_tech: 1, job_admin: 0, labs: 7, procs: 2 }, { tenure: 1, contract: 0, paper: 0, loan: 0.5, job_tech: 0, job_admin: 0 }])
    assert.deepEqual(parse('a customer with ' + sayCase(x, VOC, FEATS).join(', '), VOC, FEATS).case, x, 'a case said in words reads back as that case');
});

test('reply: yes or no with the rules that fired, or an abstention that says what it needs', () => {
  const yes = reply('Will a customer with tenure 6, a month-to-month contract and paperless billing leave?', CTX);
  assert.equal(yes.verdict, 'VERIFIED');
  assert.equal(yes.intent, 'ask');
  assert.equal(yes.text, 'Yes — I expect this customer to leave: its score is 2.5, above my line of 1. The rules that fired: when tenure is at or below 12 months (+2); when it has paperless billing (+0.5).');
  assert.deepEqual(yes.receipt, { kind: RECEIPT, q: 'Will a customer with tenure 6, a month-to-month contract and paperless billing leave?', intent: 'ask', verdict: 'VERIFIED', mind: hash, case: { tenure: 6, contract: 0, paper: 1 }, label: 1, score: 2.5, threshold: 1, fired: ['tenure', 'paper'] });
  const x = { tenure: 6, contract: 0, paper: 1 };
  assert.equal(answer(MIND, x).score, yes.receipt.score, 'the same answer the mind gives');
  const nope = reply('tenure 40, a two year contract, no paperless billing', CTX);
  assert.equal(nope.text, 'No — I don’t expect this customer to leave: its score is -2, at or below my line of 1. The rules that fired: when contract is one year or two year (-2).');
  assert.equal(reply('tenure 40, a month-to-month contract, no paperless billing', CTX).text, 'No — I don’t expect this customer to leave: its score is 0, at or below my line of 1. None of my rules fired.');
  const miss = reply('tenure 40: will they leave?', CTX);
  assert.deepEqual([miss.verdict, miss.text, miss.receipt.missing], ['ABSTAIN', 'I can’t answer that yet: my rules also read contract, paperless billing. Tell me those and I will.', ['contract', 'paper']]);
  const both = reply('tenure 4 or tenure 5, contract two year, paperless', CTX);
  assert.deepEqual([both.verdict, both.text], ['ABSTAIN', 'You gave tenure two different values. Say each once and I will answer.']);
  const odd = reply('tenure 4, contract two year, paperless', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], body: { ...MIND.organs[0].body, rules: [...RULES, { feat: 'ghost', op: '>', v: 1, w: 1 }] } }] }, features: [...FEATS, 'ghost'] });
  assert.equal(odd.text, 'I can’t answer that yet: my rules also read ghost. Tell me those and I will.');
  const flat = reply('tenure 6, a month-to-month contract, paperless, monthly charges 80', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], body: { rules: [...RULES, { feat: 'charges', op: '>', v: 50, w: 0 }], threshold: 1 } }] } });
  assert.equal(flat.text, 'Yes — I expect this customer to leave: its score is 2.5, above my line of 1. The rules that fired: when tenure is at or below 12 months (+2); when it has paperless billing (+0.5); when monthly charges is above 50 dollars a month (0).', 'a weight of 0 is unsigned');
});

test('reply: its rules in words, its measured score, and nothing else', () => {
  const ex = reply('Why do customers leave?', CTX);
  assert.deepEqual([ex.verdict, ex.intent], ['VERIFIED', 'explain']);
  assert.equal(ex.text, 'I decide whether a customer will leave from 3 rules, strongest first: when contract is one year or two year, it is less likely (-2); when tenure is at or below 12 months, it is more likely (+2); when it has paperless billing, it is more likely (+0.5). Above my line of 1 I say yes.');
  const one = reply('explain your rules', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], body: { rules: [RULES[0]], threshold: 1 } }] } });
  assert.match(one.text, /^I decide whether a customer will leave from 1 rule, strongest first: /);
  const m = reply('how good are you?', CTX);
  assert.deepEqual([m.verdict, m.text, m.receipt.gate], ['VERIFIED', 'On 1,761 cases I never grew on, I rank a real yes above a real no 0.712345 of the time (GATE AUC: 0.5 is a coin toss, 1 is perfect). Ask me about a customer and check me against what really happened.', 712345]);
  assert.match(reply('how good are you?', { ...CTX, rows: null }).text, /^On cases I never grew on/);
  assert.equal(reply('how accurate are you', { ...CTX, gate: null }).text, 'My score has not been measured on this device yet: grow me here first.');
  const other = reply('what is the weather like?', CTX);
  assert.deepEqual([other.verdict, other.intent], ['ABSTAIN', 'other']);
  assert.equal(other.text, 'I only answer questions about whether a customer will leave, from my rules. Ask me about one — “a customer with tenure 12, with paperless billing, contract month-to-month: will they leave?” — or ask what makes a customer leave, or how good I am.');
  assert.deepEqual(other.receipt, { kind: RECEIPT, q: 'what is the weather like?', intent: 'other', verdict: 'ABSTAIN', mind: hash });
  const sorted = reply('explain your rules', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], body: { rules: [{ feat: 'total', op: '>', v: 1, w: 1 }, { feat: 'charges', op: '>', v: 1, w: -1 }], threshold: 0 } }] } });
  assert.match(sorted.text, /strongest first: when monthly charges is above 1 dollars a month, it is less likely \(-1\); when total charges is above 1, it is more likely \(\+1\)\./, 'equal weights by name');
  const level = reply('explain your rules', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], body: { rules: [{ feat: 'total', op: '>', v: 1, w: 0 }, { feat: 'charges', op: '>', v: 1, w: -1 }], threshold: 0 } }] } });
  assert.match(level.text, /it is less likely \(-1\); when total charges is above 1, it is no more or less likely \(0\)\./, 'a weight of 0 leans neither way');
  const fam = reply('hello', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], body: { rules: [{ feat: 'job_admin', op: '>', v: 0.5, w: 1 }], threshold: 0 } }] } });
  assert.equal(fam.text, 'I only answer questions about whether a customer will leave, from my rules. Ask me about one — “a customer with job admin: will they leave?” — or ask what makes a customer leave, or how good I am.', 'a family rule is shown with its own member');
});

test('reply: no mind, a dormant mind, junk — an abstention, never a throw', () => {
  for (const ctx of [null, {}, { ...CTX, voc: null }, { ...CTX, mind: null }, { ...CTX, mind: { organs: 'x' } }, { ...CTX, features: 'x' }]) {
    const r = reply('tenure 3', ctx);
    assert.deepEqual([r.verdict, r.text], ['ABSTAIN', 'I have no mind or vocabulary here to answer with.']);
  }
  assert.equal(reply('tenure 3', { ...CTX, mind: { organs: 'x' } }).receipt.mind, null);
  const dormant = reply('tenure 3', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], state: 'cut' }] } });
  assert.deepEqual([dormant.verdict, dormant.text], ['ABSTAIN', 'My mind does not answer on these records: no department of it cleared its bar here.']);
  for (const q of [null, 5, {}, '']) assert.equal(reply(q, CTX).verdict, 'ABSTAIN');
  assert.equal(MAX_Q, 1000);
  const long = reply('x'.repeat(1001), CTX);
  assert.deepEqual([long.verdict, long.intent, long.text, long.receipt.q.length], ['ABSTAIN', 'other', 'Your question is longer than the 1,000 characters I read. Ask again with only the values my rules read.', 1000], 'past the limit is refused out loud, never cut short');
  assert.notEqual(reply('x'.repeat(1000), CTX).text, long.text, 'a question of exactly the limit is read');
  const abstained = reply('tenure 3, contract two year, paperless', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], body: { rules: [], threshold: 1 } }, { state: 'live', domain: 'toy-b', fixed: 'f2', body: { rules: [{ feat: 'tenure', op: '>', v: 1, w: 1 }], threshold: 0 } }], coupling: { weights: [0, 1, 1], mean: [0, 0], sd: [1, 1] } } });
  assert.equal(abstained.verdict, 'VERIFIED', 'a coupled mind answers through its coupling');
});

// ── a vocabulary or a mind the talker cannot read is no vocabulary and no mind: it abstains, never throws, never loops ──
// (2026-10-22: a fuzz of 206,663 calls threw in every function that took a damaged vocabulary or mind, and a level said
// by an empty phrase looped for ever; tools/ fuzz now 0 throws)
const damaged = (fn) => { const v = JSON.parse(JSON.stringify(VOC)); fn(v); return v; };
const BROKEN = {
  'a level said by an empty phrase': damaged((v) => { v.columns.contract.levels[''] = 3; }),
  'a phrase no question can contain': damaged((v) => { v.columns.tenure.words.push('time, as a customer'); }),
  'a phrase in capitals': damaged((v) => { v.columns.tenure.words.push('Tenure'); }),
  'a word list that is not a list': damaged((v) => { v.columns.tenure.words = 'tenure'; }),
  'no words': damaged((v) => { v.columns.tenure.words = []; }),
  'an unknown kind': damaged((v) => { v.columns.tenure.kind = 'date'; }),
  'no name to say': damaged((v) => { v.columns.tenure.say = ''; }),
  'a unit that is not words': damaged((v) => { v.columns.tenure.unit = 5; }),
  'levels on a number': damaged((v) => { v.columns.tenure.levels = { a: 1 }; }),
  'no levels on levels': damaged((v) => { delete v.columns.contract.levels; }),
  'empty levels': damaged((v) => { v.columns.contract.levels = {}; }),
  'a level worth no number': damaged((v) => { v.columns.contract.levels['one year'] = 'one'; }),
  'bare on a number': damaged((v) => { v.columns.tenure.bare = true; }),
  'bare that is not yes or no': damaged((v) => { v.columns.month.bare = 'yes'; }),
  'a column that is not a record': damaged((v) => { v.columns.tenure = 'tenure'; }),
  'a family with no members': damaged((v) => { v.groups.job.members = {}; }),
  'a member with no words': damaged((v) => { v.groups.job.members.job_tech = []; }),
  'a none that is not a list': damaged((v) => { v.groups.job.none = 'unknown'; }),
  'family words not a list': damaged((v) => { v.groups.job.words = 'job'; }),
  'a family with no name': damaged((v) => { v.groups.job.say = 7; }),
  'no thing': damaged((v) => { v.thing = ''; }),
  'no outcome': damaged((v) => { v.outcome = null; }),
  'no groups': damaged((v) => { v.groups = null; }),
};
test('a damaged vocabulary is no vocabulary: refused whole, every reader abstains, nothing throws or loops', () => {
  assert.equal(vocabOf({ sets: { t: VOC } }, 't'), VOC, 'the well-formed one is taken');
  assert.deepEqual(parse('tenure 6', VOC, FEATS).case, { tenure: 6 });
  for (const [why, v] of Object.entries(BROKEN)) {
    assert.equal(vocabOf({ sets: { t: v } }, 't'), null, why);
    assert.deepEqual(parse('tenure 6, a two year contract, job admin', v, FEATS), { case: {}, said: {}, conflicts: [] }, why);
    assert.deepEqual([reply('tenure 6', { ...CTX, voc: v }).verdict, reply('tenure 6', { ...CTX, voc: v }).text], ['ABSTAIN', 'I have no mind or vocabulary here to answer with.'], why);
    assert.deepEqual(sayCase({ tenure: 6 }, v, FEATS), [], why);
    assert.equal(sayFeature('tenure', v), 'tenure', why);
    assert.equal(sayValue('tenure', 6, v), 'tenure 6', why);
    assert.equal(sayRule(RULES[0], v), 'when tenure is at or below 12', why);
  }
  assert.equal(vocabOf({ sets: { t: VOC } }, 5), null, 'a business is named by its name');
  assert.equal(vocabOf({ sets: Object.create({ t: VOC }) }, 't'), null, 'only the business the file itself holds');
  assert.equal(vocabOf({ sets: { t: damaged((v) => { v.columns.tenure.bare = false; }) } }, 't') !== null, true, 'bare: false is plain words');
});
test('a mind the talker cannot read is no mind; junk of every shape to every reader is an answer, never a throw', () => {
  for (const mind of [{ ...MIND, threshold: 'x' }, { ...MIND, organs: [{ state: 'live', body: null }] }, { ...MIND, organs: [{ state: 'live', body: { rules: 'x' } }] }, { ...MIND, organs: [{ state: 'live', body: { rules: [{ feat: 'tenure', op: '>', v: 'x', w: 1 }] } }] }, { ...MIND, organs: [{ state: 'live', body: { rules: [{ feat: '', op: '>', v: 1, w: 1 }] } }] }, { ...MIND, organs: [{ state: 'live', body: { rules: [{ feat: 'tenure', op: '>', v: 1, w: NaN }] } }] }]) {
    assert.deepEqual([reply('tenure 6', { ...CTX, mind }).verdict, reply('tenure 6', { ...CTX, mind }).text], ['ABSTAIN', 'I have no mind or vocabulary here to answer with.']);
  }
  // a null organ among live ones is no organ, not a crash: the live one still answers
  const withNull = reply('tenure 6, a two year contract, paperless', { ...CTX, mind: { ...MIND, organs: [null, ...MIND.organs] } });
  assert.equal(withNull.verdict, 'VERIFIED');
  // a coupling the mind cannot compute is an abstention
  const coupled = reply('tenure 6, a two year contract, paperless', { ...CTX, mind: { ...MIND, coupling: { bad: true }, organs: [...MIND.organs, { ...MIND.organs[0], domain: 'toy-b', fixed: 'f2' }] } });
  assert.equal(coupled.verdict, 'ABSTAIN');
  assert.match(coupled.text, /I can’t answer that/);
  const sym = Symbol('q'), boom = { toString() { throw new Error('no'); } };
  for (const x of [undefined, null, 0, NaN, '', [], {}, sym, boom, () => 1]) {
    assert.equal(typeof norm(x), 'string');
    assert.equal(typeof intentOf(x, x), 'string');
    assert.equal(sayFeature(x, VOC), '');
    assert.equal(sayValue(x, 1, VOC), '');
    assert.equal(sayRule(x, VOC), '');
    assert.deepEqual(sayCase(x, VOC, FEATS), []);
    assert.deepEqual(sayCase({ tenure: 6 }, VOC, x), []);
    assert.equal(reply(x, x).verdict, 'ABSTAIN');
    assert.deepEqual(parse(x, VOC, FEATS).case, {});
    assert.deepEqual(parse('tenure 6', VOC, x).case, {});
  }
  assert.equal(norm(12.5), ' 12.5 ', 'a number is read as its digits');
  assert.equal(intentOf('how good are you?', { case: 'x' }), 'measure', 'a parse whose case is not a record asks nothing');
  assert.deepEqual(parse('tenure 6', VOC, [null, 7, 'constructor', 'tenure']).case, { tenure: 6 }, 'names that are not columns are passed over');
  assert.deepEqual(sayCase({ tenure: 6, constructor: 1 }, VOC, ['constructor', 'tenure']), ['constructor 1', 'tenure 6'], 'a column the vocabulary does not name is said by its own name, never read off the prototype');
});

test('the receipt names the mind by its live organs alone, each by its fixed form or else its recipe', () => {
  const mixed = reply('tenure 6', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], state: 'cut', fixed: 'f9' }, ...MIND.organs] } });
  assert.equal(mixed.receipt.mind, hash, 'a dormant organ is not part of the mind that answered');
  const byRecipe = reply('tenure 6', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], fixed: undefined }] } });
  assert.equal(byRecipe.receipt.mind, sha256Hex(canonical(['r1'])), 'an organ with no fixed form is named by its recipe');
  const neither = reply('tenure 6', { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], fixed: undefined, recipe: undefined }] } });
  assert.equal(neither.receipt.mind, sha256Hex(canonical([null])), 'and with neither, by nothing — never a throw');
});

test('asks: three questions the mind can answer, the first a case its own rules read whole, and so answered', () => {
  const q = asks(CTX);
  assert.equal(q.length, 3);
  assert.deepEqual(q.slice(1), ['What makes a customer leave?', 'How good are you?']);
  assert.match(q[0], /^A customer with .+: will they leave\?$/);
  const r = q.map((x) => reply(x, CTX));
  assert.deepEqual(r.map((x) => [x.intent, x.verdict]), [['ask', 'VERIFIED'], ['explain', 'VERIFIED'], ['measure', 'VERIFIED']], 'each is answered, none refused');
  // a mind whose rules read no column of the business has no case to offer, only the other two
  const off = { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], body: { rules: [{ feat: 'tenure', op: '>', v: 3, w: 1 }], threshold: 1 } }] }, features: ['charges'] };
  assert.deepEqual(asks(off), ['What makes a customer leave?', 'How good are you?']);
  for (const bad of [null, {}, { ...CTX, voc: null }, { ...CTX, mind: null }, { ...CTX, features: 'x' }, { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], state: 'cut' }] } }]) assert.deepEqual(asks(bad), []);
  assert.deepEqual(asks({ ...CTX, mind: { ...MIND, organs: [null, MIND.organs[0]] } }).length, 3, 'a null organ is passed over');
});

test('a family missing from a question is asked for once, by its own name', () => {
  const famMind = { ...MIND, organs: [{ ...MIND.organs[0], body: { rules: [{ feat: 'tenure', op: '<=', v: 12, w: 1 }, { feat: 'job_tech', op: '>', v: 0.5, w: 1 }, { feat: 'job_admin', op: '>', v: 0.5, w: -1 }], threshold: 0.5 } }] };
  const r = reply('a customer with tenure 6: will they leave?', { ...CTX, mind: famMind });
  assert.equal(r.text, 'I can’t answer that yet: my rules also read job. Tell me those and I will.');
  assert.deepEqual(r.receipt.missing, ['job_tech', 'job_admin'], 'the receipt still names every column');
  assert.equal(reply('a customer with tenure 6 and job admin: will they leave?', { ...CTX, mind: famMind }).verdict, 'VERIFIED', 'said once, the family is read whole');
});

test('how it decides and how good it is are asked only about the card or its business', () => {
  const i = (q) => intentOf(q, parse(q, VOC, FEATS), VOC);
  // 2026-10-22: the phrasing alone decided, so a pizza got the card's rules and the weather its score
  assert.deepEqual(['what makes a good pizza?', 'how good is the weather?', 'why is the sky blue?', 'what is the accuracy of a clock?', 'explain quantum physics', 'why?'].map(i), ['other', 'other', 'other', 'other', 'other', 'other']);
  assert.deepEqual(['why do customers leave?', 'what makes a customer leave', 'How good are you?', 'what is your AUC', 'explain your rules', 'how do you decide', 'can I trust this card?', 'how accurate are you about leaving?'].map(i), ['explain', 'explain', 'measure', 'measure', 'explain', 'explain', 'measure', 'measure']);
  // a word of the outcome counts when it is five letters or more; shorter words are too common to tell the topic
  const V3 = { ...VOC, outcome: 'pay a big bill' };
  assert.equal(intentOf('what makes a big day?', null, V3), 'other', 'big and day are under five letters');
  assert.equal(intentOf('why do people pay?', null, V3), 'other');
  assert.equal(intentOf('what makes a bill go up?', null, { ...VOC, outcome: 'raise the bills' }), 'other', 'the outcome word is bills: a bill alone does not name it');
  assert.equal(intentOf('what makes them raise it?', null, { ...VOC, outcome: 'raise the bills' }), 'explain', 'raise names the outcome');
  // without a vocabulary the phrasing alone still reads, as before
  assert.equal(intentOf('what makes a good pizza?', null), 'explain');
  assert.equal(intentOf('what makes a good pizza?', null, { ...VOC, thing: '' }), 'explain', 'a vocabulary that is not well formed is no vocabulary');
  // and reply holds to it: off-topic is an abstention, never the card's rules or score
  for (const q of ['what makes a good pizza?', 'how good is the weather?']) assert.deepEqual([reply(q, CTX).intent, reply(q, CTX).verdict], ['other', 'ABSTAIN'], q);
});
