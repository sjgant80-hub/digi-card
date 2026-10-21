// src/replay.mjs — THE REPLAY: a duel's receipt, watched case by case and read back.
//
// A duel's receipt says who won; the replay shows how. It fights the duel again from the same two sides and the same
// signed challenge and acceptance (src/kit.mjs kitDuel), demands the very same receipt, and only then lays the match
// out case by case in its batch order: each side's score on the case, its call (each side calls yes for as many of its
// top-scored cases as the batch holds real yeses, ties to the earlier case, exactly as the arena draws it), and whether
// that call was right. READ-BACK is one case opened: for each mind a side fielded, the rules of it that fired on that
// case and its score (src/mind.mjs answer; for a mind of one department, exactly their sum) — so a win is explained by the very rules that won it.
// TEST is never read; the batch is GATE cases both minds were proven on. Pure apart from the signatures; total.
import { kitDuel } from './kit.mjs';
import { answer, caseAt } from './mind.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

const no = (why) => ({ ok: false, why });

/** a side's calls on a batch: yes for its `yeses` top-scored cases, ties to the earlier case. → [true | false] */
export function callsOf(scores, yeses) {
  if (!Array.isArray(scores) || !Number.isInteger(yeses) || yeses < 0) return [];
  const order = scores.map((s, k) => k).sort((a, b) => scores[b] - scores[a] || a - b), yes = new Set(order.slice(0, yeses));
  return scores.map((_, k) => yes.has(k));
}

/**
 * Replay a kit duel's receipt: A and B its sides ({ v, loadout?, nodes? }), ground its data, signed { challenge, accept }.
 * → { ok, frames: [{ k, row, y, a: { score, call, right }, b: { … } }], right: { a, b }, receipt } | a refusal
 */
export async function replay(receipt, A, B, ground, signed) {
  try {
    if (!receipt || receipt.kind !== 'duel') return no('not a duel receipt');
    const r = await kitDuel(A, B, ground, signed);
    if (!r.ok) return no('the duel does not re-fight: ' + r.why);
    if (canonical(r.receipt) !== canonical(receipt)) return no('re-fought here, it gives ' + r.receipt.a.auc + ' against ' + r.receipt.b.auc + ', not the receipt’s ' + receipt.a.auc + ' against ' + receipt.b.auc);
    const yeses = r.y.filter((t) => t === 1).length, ca = callsOf(r.scores.a, yeses), cb = callsOf(r.scores.b, yeses);
    const frames = r.batch.map((row, k) => ({ k, row, y: r.y[k], a: { score: r.scores.a[k], call: ca[k], right: ca[k] === (r.y[k] === 1) }, b: { score: r.scores.b[k], call: cb[k], right: cb[k] === (r.y[k] === 1) } }));
    return { ok: true, frames, right: { a: frames.filter((f) => f.a.right).length, b: frames.filter((f) => f.b.right).length }, receipt: r.receipt, kits: r.kits };
  } catch { return no('the duel could not be replayed here'); }
}

/** read one case back: for each mind a kitted side fielded, its rules that fired on that case and their score */
export function readBack(kit, ground, row) {
  try {
    if (!kit || !Array.isArray(kit.fielded) || !Number.isInteger(row) || row < 0 || row >= ground.ds.n) return no('read back a fielded kit on one of its ground’s cases');
    const x = caseAt(ground, row);
    return { ok: true, minds: kit.fielded.map((f) => {
      const a = answer(f.mind, x);
      return a.verdict === 'VERIFIED' ? { card: f.card, score: a.score, fired: a.fired.map((r) => ({ domain: r.domain, feat: r.feat, op: r.op, v: r.v, w: r.w })) } : { card: f.card, score: null, fired: [], why: a.why };
    }) };
  } catch { return no('the case could not be read back here'); }
}
