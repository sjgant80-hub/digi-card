// learn.test.mjs — every mission passed by exactly the questions that show it, and by nothing else; marked by re-asking,
// never by a stored answer; junk never throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, mark, MAX_TRIES } from '../src/learn.mjs';
import def from '../src/learn.mjs';

const VOC = {
  thing: 'customer', outcome: 'leave',
  columns: {
    tenure: { say: 'tenure', kind: 'number', unit: 'months', words: ['tenure', 'months as a customer'] },
    paper: { say: 'paperless billing', kind: 'flag', words: ['paperless billing', 'paperless'] },
  },
  groups: {},
};
// leaves when tenure is 12 or under, unless billed on paper less... a toy: score = 2 (tenure <= 12) + 0.5 (paperless), line 1
const MIND = { organs: [{ state: 'live', domain: 'toy', fixed: 'f1', body: { rules: [{ feat: 'tenure', op: '<=', v: 12, w: 2 }, { feat: 'paper', op: '>', v: 0.5, w: 0.5 }], threshold: 1 } }], coupling: null, threshold: 1 };
const CTX = { mind: MIND, voc: VOC, features: ['tenure', 'paper'], gate: 700000, rows: 100 };
const passed = (qs) => mark(qs, CTX).filter((m) => m.passed).map((m) => m.id);

test('ten missions, each with its id, title and how; nothing passed before a question is asked', () => {
  assert.deepEqual(MISSIONS.map((m) => m.id), ['a-case', 'a-no', 'a-yes', 'decides', 'how-good', 'left-out', 'said-twice', 'off-topic', 'flip', 'same-again']);
  assert.ok(MISSIONS.every((m) => m.title && m.how));
  assert.deepEqual(passed([]), []);
  assert.equal(def, mark);
  assert.deepEqual(Object.keys(mark([], CTX)[0]), ['id', 'title', 'how', 'passed']);
});

test('each mission is passed by the question that shows it, and only that one', () => {
  const yes = 'tenure 6, paperless: will they leave?', no = 'tenure 30, without paperless: will they leave?';
  assert.deepEqual(passed([yes]), ['a-case', 'a-yes']);
  assert.deepEqual(passed([no]), ['a-case', 'a-no']);
  assert.deepEqual(passed(['what makes a customer leave?']), ['decides']);
  assert.deepEqual(passed(['how good are you?']), ['how-good']);
  assert.deepEqual(passed(['tenure 6: will they leave?']), ['left-out'], 'paperless left out: it asks for it');
  assert.deepEqual(passed(['tenure 6, tenure 7, paperless: will they leave?']), ['said-twice']);
  assert.deepEqual(passed(['what is the weather like?']), ['off-topic']);
  assert.deepEqual(passed([yes, 'tenure 30, paperless: will they leave?']), ['a-case', 'a-no', 'a-yes', 'flip'], 'one value changed, the answer turned round');
  assert.deepEqual(passed([yes, no]), ['a-case', 'a-no', 'a-yes'], 'two values changed is not one');
  assert.deepEqual(passed([yes, 'tenure 7, paperless: will they leave?']), ['a-case', 'a-yes'], 'one value changed but the same answer is no flip');
  assert.deepEqual(passed([yes, yes]), ['a-case', 'a-yes', 'same-again']);
  assert.deepEqual(passed(['how good are you?', 'How good are you?']), ['how-good'], 'the very same question, not a near one');
});

test('the marking is over the last questions only, re-asked; junk is an unpassed mission, never a throw', () => {
  const many = ['what makes a customer leave?', ...Array.from({ length: MAX_TRIES }, () => 'how good are you?')];
  assert.equal(MAX_TRIES, 50);
  assert.deepEqual(passed(many), ['how-good', 'same-again'], 'the 51st question back is no longer marked');
  assert.deepEqual(passed(many.slice(1).concat(['what makes a customer leave?'])), ['decides', 'how-good', 'same-again']);
  assert.deepEqual(passed([null, 5, '', '   ', {}, 'how good are you?']), ['how-good'], 'only questions are asked');
  for (const bad of [null, 'x', 5, {}]) assert.deepEqual(mark(bad, CTX).filter((m) => m.passed), []);
  // with no card to ask (no mind, no words, a mind with no live department) nothing is learnt: refusals are not lessons
  for (const ctx of [null, undefined, 'x', 5, [], {}, { ...CTX, voc: null }, { ...CTX, mind: { ...MIND, organs: [{ ...MIND.organs[0], state: 'cut' }] } }]) {
    assert.deepEqual(mark(['what is the weather like?', 'what is the weather like?'], ctx).filter((m) => m.passed), [], String(ctx));
  }
  assert.deepEqual(passed(['what is the weather like?', 'what is the weather like?']), ['off-topic', 'same-again'], 'with a card to ask, the same questions are lessons');
});

test('the rubrics hold at their edges: a flip is one column of three, an explanation is never a case, a repeat needs two asks', () => {
  const V = { ...VOC, columns: { ...VOC.columns, charges: { say: 'monthly charges', kind: 'number', words: ['monthly charges'] } } };
  const C3 = { ...CTX, voc: V, features: ['tenure', 'paper', 'charges'] };
  const p3 = (qs) => mark(qs, C3).filter((m) => m.passed).map((m) => m.id);
  const yes = 'tenure 6, paperless, monthly charges 50: will they leave?';
  assert.ok(p3([yes, 'tenure 30, paperless, monthly charges 50: will they leave?']).includes('flip'), 'one of three columns changed, the answer turned: a flip');
  assert.ok(!p3([yes, 'tenure 30, paperless, monthly charges 60: will they leave?']).includes('flip'), 'two of three changed is not one');
  // an explanation and a refusal carry no case to compare: they are never half of a flip, and marking them never throws
  assert.deepEqual(p3([yes, 'what makes a customer leave?']), ['a-case', 'a-yes', 'decides']);
  assert.deepEqual(p3([yes, 'tenure 30: will they leave?']), ['a-case', 'a-yes', 'left-out'], 'a refused case is no half of a flip');
  // asked once is not asked twice
  assert.ok(!p3([yes]).includes('same-again'));
  assert.ok(p3([yes, 'what makes a customer leave?', yes]).includes('same-again'), 'the two asks need not be next to each other');
});
