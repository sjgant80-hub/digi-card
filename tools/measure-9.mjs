#!/usr/bin/env node
// tools/measure-9.mjs — organ 9, the arena, measured as sealed in data/organ-9/prereg.json (run tools/seal-9.mjs first;
// git proves the order). Writes data/organ-9/record.json: every duel's receipt and re-run, every batch checked against the
// ground's rows, every forgery's refusal, the ratings twice, and each pair's TEST AUCs (the sealed measurement is the
// only reader of TEST).
import { writeFileSync } from 'node:fs';
import { challenge, accept, duel, rerun, ratings, BATCH } from '../src/arena.mjs';
import { verify, give } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { drop, ground, owner, sampler, testOf, setOfDomain } from './lib.mjs';
import { demoMaker } from '../src/drop.mjs';

const PAIRS = 40, DUELS = 5, FORGED_PAIRS = 20;
const { m, reg } = await drop(), maker = await demoMaker(), stranger = await owner('arena-stranger');
const signAs = async (keys, fields) => ({ ...fields, by: keys.pub, sig: await sign(keys, utf8(canonical({ ...fields, by: keys.pub }))) });
const sets = [...new Set(m.cards.map((c) => setOfDomain(c.domain)))].filter((s) => new Set(m.cards.filter((c) => setOfDomain(c.domain) === s).map((c) => c.domain)).size >= 2);
const record = { kind: 'digi-card.organ-9.record', v: 1, batch: BATCH, sets: [], duels: [], forgeries: [], ratings: null, ms: [] };
const held = new Map();
async function hand(c, set) {   // each card to its own demo owner, as organ 6 did: a give the drop's maker signs
  if (!held.has(c.card)) { const o = await owner('arena-' + set + '-' + c.serial), d = (await give(dossierOf(reg, c.card), maker, o.pub)).dossier; held.set(c.card, { o, d, v: await verify(d) }); }
  return held.get(c.card);
}
let forged = 0;
for (const set of sets) {
  const g = await ground(set), other = await ground(sets.find((s) => s !== set)), cards = m.cards.filter((c) => setOfDomain(c.domain) === set).sort((a, b) => a.serial - b.serial), pick = sampler(9000 + sets.indexOf(set)), seen = new Set(), gateSet = new Set(g.ds.gateRows), testSet = new Set(g.ds.testRows);
  const pairs = [];
  while (pairs.length < PAIRS) { const a = pick.pick(cards), b = pick.pick(cards), k = [a.serial, b.serial].sort().join(); if (a.serial === b.serial || seen.has(k)) continue; seen.add(k); pairs.push([a, b]); }
  for (const [ca, cb] of pairs) {
    const A = await hand(ca, set), B = await hand(cb, set), row = { set, a: ca.serial, b: cb.serial, gate: [ca.gate, cb.gate], test: [testOf(A.v, g), testOf(B.v, g)], wins: { a: 0, b: 0, draw: 0 } };
    for (let d = 0; d < DUELS; d++) {
      const t0 = performance.now();
      const ch = (await challenge(A.o, A.v, 'organ9-' + d)).challenge, ac = (await accept(B.o, B.v, ch)).accept, r = await duel(A.v, B.v, g, { challenge: ch, accept: ac });
      record.ms.push(Math.round((performance.now() - t0) * 10) / 10);
      if (!r.ok) { record.duels.push({ set, a: ca.serial, b: cb.serial, d, ok: false, why: r.why }); continue; }
      const again = await rerun(r.receipt, A.v, B.v, g, { challenge: ch, accept: ac });
      row.wins[r.receipt.winner]++;
      record.duels.push({ set, a: ca.serial, b: cb.serial, d, ok: true, receipt: r.receipt, rerun: again.ok === true, batchDistinct: new Set(r.batch).size === r.batch.length, batchGate: r.batch.every((i) => gateSet.has(i)), batchTest: r.batch.some((i) => testSet.has(i)), lowerGateWon: r.receipt.winner !== 'draw' && ca.gate !== cb.gate && (r.receipt.winner === 'a') === (ca.gate < cb.gate) });
      // twelve forgeries on the first pairs' first duel
      if (d === 0 && forged < FORGED_PAIRS) {
        const sold = await verify((await give(A.d, A.o, stranger.pub)).dossier), soldB = await verify((await give(B.d, B.o, stranger.pub)).dossier);   // each card handed on: a new head
        const otherCh = (await challenge(A.o, A.v, 'organ9-other')).challenge, otherAc = (await accept(B.o, B.v, otherCh)).accept;
        const strangerCh = await signAs(stranger, { type: 'digi.challenge.v1', card: A.v.id, head: A.v.head, nonce: 'organ9-0' });
        const strangerAc = await signAs(stranger, { type: 'digi.accept.v1', card: B.v.id, head: B.v.head, challenge: sha256Hex(canonical(ch)) });
        const selfAc = await signAs(A.o, { type: 'digi.accept.v1', card: A.v.id, head: A.v.head, challenge: sha256Hex(canonical(ch)) });
        const tries = [
          ['edited challenge', () => duel(A.v, B.v, g, { challenge: { ...ch, nonce: 'organ9-9' }, accept: ac })],
          ['challenge by a stranger', async () => duel(A.v, B.v, g, { challenge: strangerCh, accept: (await accept(B.o, B.v, strangerCh)).accept })],
          ['acceptance by a stranger', () => duel(A.v, B.v, g, { challenge: ch, accept: strangerAc })],
          ['acceptance for another challenge', () => duel(A.v, B.v, g, { challenge: ch, accept: otherAc })],
          ['stale challenge after a give', () => duel(sold, B.v, g, { challenge: ch, accept: ac })],
          ['stale acceptance after a give', () => duel(A.v, soldB, g, { challenge: ch, accept: ac })],
          ['edited score', () => rerun({ ...r.receipt, a: { ...r.receipt.a, auc: r.receipt.a.auc + 1 } }, A.v, B.v, g, { challenge: ch, accept: ac })],
          ['flipped winner', () => rerun({ ...r.receipt, winner: r.receipt.winner === 'a' ? 'b' : 'a' }, A.v, B.v, g, { challenge: ch, accept: ac })],
          ['flipped self-play flag', () => rerun({ ...r.receipt, self: !r.receipt.self }, A.v, B.v, g, { challenge: ch, accept: ac })],
          ['a ground of another business', () => duel(A.v, B.v, other, { challenge: ch, accept: ac })],
          ['a card fighting itself', () => duel(A.v, A.v, g, { challenge: ch, accept: selfAc })],
          ['an acceptance with an extra field', () => duel(A.v, B.v, g, { challenge: ch, accept: { ...ac, extra: 1 } })],
        ];
        for (const [kind, f] of tries) { const x = await f(); record.forgeries.push({ set, a: ca.serial, b: cb.serial, kind, refused: x.ok !== true, why: x.why || null }); }
        forged++;
      }
    }
    record.sets.push(row);
  }
}
const receipts = record.duels.filter((x) => x.ok).map((x) => x.receipt), r1 = ratings(receipts), r2 = ratings(receipts);
record.ratings = { same: canonical(r1) === canonical(r2), total: Object.values(r1.ratings).reduce((s, x) => s + x, 0), cards: Object.keys(r1.ratings).length, skipped: r1.skipped, top: Object.entries(r1.ratings).sort((a, b) => b[1] - a[1]).slice(0, 10) };
writeFileSync(new URL('../data/organ-9/record.json', import.meta.url), JSON.stringify(record) + '\n');
const ms = [...record.ms].sort((a, b) => a - b);
console.log('organ 9 measured · ' + receipts.length + ' duels · ' + record.forgeries.length + ' forgeries · median ' + ms[ms.length >> 1] + ' ms');
