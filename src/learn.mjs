// src/learn.mjs — LEARN TO ASK: missions that teach asking a card properly, each marked by a fixed rubric over what the
// talker itself answers (src/talker.mjs), never by a model.
//
// A mission is passed by the questions you asked: the rubric re-asks them of the card (reply is pure: the same question to
// the same mind gives the same receipt), so a stored answer is never trusted, only re-run. Ten missions, each one thing a
// person must know to use a card that can tell you no:
//   a-case       ask about one case, giving every value its rules read — and get an answer
//   a-no / a-yes hear it say no, and hear it say yes
//   decides      ask what makes the outcome happen
//   how-good     ask how good it is
//   left-out     leave out a value its rules read — and hear it ask for it
//   said-twice   give one value twice, differently — and hear it refuse to choose
//   off-topic    ask it something it does not know — and hear it say so
//   flip         change one value and turn its answer round
//   same-again   ask the very same question twice — and get the very same receipt
// Pure and total: junk is an unpassed mission, never a throw.
import { reply, asks } from './talker.mjs';

export const MAX_TRIES = 50;   // the questions a mission is marked over: the last 50 asked of one card
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** the columns two cases differ on */
const differ = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);

export const MISSIONS = Object.freeze([
  { id: 'a-case', title: 'Ask about one case', how: 'Give every value its rules read, in your own words, and ask whether it will happen.', pass: (rs) => rs.some((r) => r.intent === 'ask' && r.verdict === 'VERIFIED') },
  { id: 'a-no', title: 'Hear it say no', how: 'Ask about a case it expects not to happen.', pass: (rs) => rs.some((r) => r.intent === 'ask' && r.verdict === 'VERIFIED' && r.receipt.label === 0) },
  { id: 'a-yes', title: 'Hear it say yes', how: 'Ask about a case it expects to happen: change the values its strongest rules read.', pass: (rs) => rs.some((r) => r.intent === 'ask' && r.verdict === 'VERIFIED' && r.receipt.label === 1) },
  { id: 'decides', title: 'Ask how it decides', how: 'Ask what makes the outcome happen.', pass: (rs) => rs.some((r) => r.intent === 'explain' && r.verdict === 'VERIFIED') },
  { id: 'how-good', title: 'Ask how good it is', how: 'Ask how good or how accurate it is.', pass: (rs) => rs.some((r) => r.intent === 'measure' && r.verdict === 'VERIFIED') },
  { id: 'left-out', title: 'Leave a value out', how: 'Ask about a case but leave out a value its rules read. It should ask you for it, not guess.', pass: (rs) => rs.some((r) => r.intent === 'ask' && r.verdict === 'ABSTAIN' && Array.isArray(r.receipt.missing) && r.receipt.missing.length > 0) },
  { id: 'said-twice', title: 'Say one value twice', how: 'Give one value twice, differently. It should refuse to choose between them.', pass: (rs) => rs.some((r) => r.intent === 'ask' && r.verdict === 'ABSTAIN' && /^You gave /.test(r.text)) },
  { id: 'off-topic', title: 'Ask it what it cannot know', how: 'Ask it something that is not about its business. It should say it cannot answer.', pass: (rs) => rs.some((r) => r.intent === 'other' && r.verdict === 'ABSTAIN') },
  { id: 'flip', title: 'Turn its answer round', how: 'Ask about a case, then ask again with one value changed so it answers the other way.',
    pass: (rs) => { const asked = rs.filter((r) => r.intent === 'ask' && r.verdict === 'VERIFIED'); return asked.some((a, i) => asked.slice(i + 1).some((b) => a.receipt.label !== b.receipt.label && differ(a.receipt.case, b.receipt.case).length === 1)); } },
  { id: 'same-again', title: 'Ask the same thing twice', how: 'Ask the very same question twice. The receipt is the same, word for word: nothing is left to chance.',
    pass: (rs) => rs.some((a, i) => rs.slice(i + 1).some((b) => a.receipt.q === b.receipt.q && same(a.receipt, b.receipt))) },
]);

/**
 * Mark the missions over the questions asked of one card: each question is asked again of the card (ctx, as the talker
 * takes it), so the marking stands on what the card answers now, not on anything stored. → [{ id, title, how, passed }]
 */
export function mark(questions, ctx) {
  const qs = Array.isArray(questions) ? questions.filter((q) => typeof q === 'string' && q.trim()).slice(-MAX_TRIES) : [];
  // only a card that can be asked can be learnt on: with no mind or no words every question is refused, which would pass
  // the off-topic mission for a card that was never there
  const askable = asks(ctx).length > 0, rs = askable ? qs.map((q) => reply(q, ctx)) : [];
  return MISSIONS.map((m) => ({ id: m.id, title: m.title, how: m.how, passed: rs.length > 0 && m.pass(rs) === true }));
}

export default mark;
