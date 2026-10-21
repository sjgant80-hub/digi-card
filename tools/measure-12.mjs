#!/usr/bin/env node
// tools/measure-12.mjs — organ 12, the arena watched and the tournament, measured as sealed in data/organ-12/prereg.json
// (run tools/seal-12.mjs first; git proves the order). Writes data/organ-12/record.json: every kit duel replayed from
// its receipt with every case read back; one real bracket per business, each match fought as a duel between two demo
// owners; and the bracket played out from 1,000 seeded receipt sets. TEST is never read: duels and brackets are GATE.
// With SMALL=1 it measures 2 duels a business, brackets of 4 and 50 receipt sets (a quick check of the tooling, never the
// sealed measurement).
import { writeFileSync, mkdirSync } from 'node:fs';
import { replay, readBack } from '../src/replay.mjs';
import { bracketOf, playOut } from '../src/tournament.mjs';
import { equip, kitChallenge, kitAccept, kitDuel } from '../src/kit.mjs';
import { scoreRow } from '../src/mind.mjs';
import { verify, give } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { demoMaker } from '../src/drop.mjs';
import { auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { drop, ground, owner, sampler, setOfDomain } from './lib.mjs';

const SMALL = process.env.SMALL === '1', DUELS = SMALL ? 2 : 20, ENTRANTS = SMALL ? 4 : 8, RECEIPT_SETS = SMALL ? 50 : 1000;
const { m, reg } = await drop(), maker = await demoMaker();
const handTo = async (c, o) => { const d = (await give(dossierOf(reg, c.card), maker, o.pub)).dossier; return { c, d, v: await verify(d) }; };
const sets = [...new Set(m.cards.map((c) => setOfDomain(c.domain)))].filter((s) => new Set(m.cards.filter((c) => setOfDomain(c.domain) === s).map((c) => c.domain)).size >= 2);
const record = { kind: 'digi-card.organ-12.record', v: 1, sets, duels: [], brackets: [], synthetic: { sets: 0, twice: 0, decidedOk: 0, openOk: 0, championOk: 0 } };
/** a duel between two sides, each its owner's: the challenger kitted or alone, the defender alone */
async function fight(oA, A, oB, B, g, nonce) {
  const ch = (await kitChallenge(oA, A.v, A.loadout || null, nonce)).challenge, ac = (await kitAccept(oB, B.v, null, ch)).accept, signed = { challenge: ch, accept: ac };
  return { r: await kitDuel(A, B, g, signed), signed };
}

for (const set of sets) {
  const g = await ground(set), cards = m.cards.filter((c) => setOfDomain(c.domain) === set).sort((a, b) => a.serial - b.serial), pick = sampler(12000 + sets.indexOf(set));
  const doms = [...new Set(cards.map((c) => c.domain))].sort();
  for (let k = 0; k < DUELS; k++) {
    const o = await owner('watch-' + set + '-' + k), foeO = await owner('watch-foe-' + set + '-' + k), main = pick.pick(cards), pool = doms.filter((d) => d !== main.domain), n = pick.int(Math.min(2, pool.length) + 1), nodes = [];
    while (nodes.length < n) { const d = pool.splice(pick.int(pool.length), 1)[0]; nodes.push((await handTo(pick.pick(cards.filter((c) => c.domain === d)), o)).v); }
    const D = await handTo(main, o), foe = await handTo(pick.pick(cards.filter((c) => c.domain === main.domain && c.serial !== main.serial)), foeO);
    const lo = (await equip(o, D.v, nodes)).loadout, A = { v: D.v, loadout: lo, nodes }, B = { v: foe.v, loadout: null };
    const { r, signed } = await fight(o, A, foeO, B, g, 'organ12-' + k);
    const rp = r.ok ? await replay(r.receipt, A, B, g, signed) : { ok: false, why: r.why };
    const row = { set, k, ok: r.ok && rp.ok, nodes: nodes.length, winner: r.ok ? r.receipt.winner : null, aucA: r.ok ? r.receipt.a.auc : null, aucB: r.ok ? r.receipt.b.auc : null };
    if (row.ok) {
      const y = rp.frames.map((f) => f.y), yeses = y.filter((t) => t === 1).length;
      row.same = canonical(rp.receipt) === canonical(r.receipt);
      row.aucOk = Math.round(auc(rp.frames.map((f) => f.a.score), y) * 1e6) === r.receipt.a.auc && Math.round(auc(rp.frames.map((f) => f.b.score), y) * 1e6) === r.receipt.b.auc;
      row.callsOk = rp.frames.filter((f) => f.a.call).length === yeses && rp.frames.filter((f) => f.b.call).length === yeses;
      row.rightA = rp.right.a; row.rightB = rp.right.b;
      // every case read back: each fielded mind's score is the one the duel used, and one department's fired rules sum to it
      let cases = 0, scoreOk = 0, sumOk = 0, single = 0;
      for (const f of rp.frames) for (const kit of [rp.kits.a, rp.kits.b]) {
        const back = readBack(kit, g, f.row);
        if (!back.ok) continue;
        back.minds.forEach((mm, j) => {
          cases++;
          if (mm.score === scoreRow(kit.fielded[j].mind, g, f.row)) scoreOk++;
          if (kit.fielded[j].mind.organs.filter((o2) => o2.state === 'live').length === 1) { single++; if (Math.abs(mm.fired.reduce((s, x) => s + x.w, 0) - mm.score) < 1e-6) sumOk++; }
        });
      }
      Object.assign(row, { cases, scoreOk, single, sumOk });
    } else row.why = r.ok ? rp.why : r.why;
    record.duels.push(row);
  }
  // one real bracket: eight drop cards of this business, each with its own demo owner, every match fought as a duel
  const entrants = [];
  while (entrants.length < ENTRANTS) { const c = pick.pick(cards); if (!entrants.some((e) => e.c.serial === c.serial)) entrants.push({ c, o: await owner('bracket-' + set + '-' + entrants.length) }); }
  for (const e of entrants) Object.assign(e, await handTo(e.c, e.o));
  const byId = new Map(entrants.map((e) => [e.v.id, e])), receipts = [];
  let b = bracketOf(entrants.map((e) => e.v.id), []), p = playOut(b, receipts), guard = 0;
  while (b.ok && p.ok && !p.champion && guard++ < ENTRANTS) {
    for (const round of p.rounds) for (const mt of round) if (mt.open && mt.a && mt.b) {
      const A = byId.get(mt.a), B = byId.get(mt.b), { r } = await fight(A.o, { v: A.v }, B.o, { v: B.v }, g, 'bracket-' + receipts.length);
      if (r.ok) receipts.push(r.receipt);
    }
    p = playOut(b, receipts);
  }
  const decided = p.ok ? p.rounds.flat().filter((mt) => !mt.open && mt.by !== 'bye') : [];
  record.brackets.push({ set, ok: b.ok && p.ok, champion: p.ok && p.champion ? byId.get(p.champion).c.serial : null, practice: p.ok ? p.practice : null, title: p.ok ? p.title : null, duels: receipts.length,
    matches: decided.map((mt) => { const A = byId.get(mt.a), B = byId.get(mt.b), w = byId.get(mt.winner); return { a: A.c.serial, b: B.c.serial, gateA: A.c.gate, gateB: B.c.gate, winner: w.c.serial }; }) });
}

// the bracket played out from 1,000 seeded receipt sets: byes, draws, junk, one owner against itself, either order
const rnd = sampler(1200), C = (n) => n.toString(16).padStart(16, '0');
for (let n = 0; n < RECEIPT_SETS; n++) {
  const size = 2 + rnd.int(15), entrants = Array.from({ length: size }, (_, i) => C(100 + i)), receipts = [];
  for (let k = rnd.int(3 * size); k > 0; k--) {
    const x = entrants[rnd.int(size)], y = entrants[rnd.int(size)];
    if (rnd.int(10) === 0) { receipts.push({ junk: k }); continue; }
    receipts.push({ kind: 'duel', data: 'toy', a: { card: x, head: 'h', kit: 'k', auc: 1 }, b: { card: y, head: 'h', kit: 'k', auc: 1 }, challenge: 'c', accept: 'x', seed: 's', n: 64, winner: ['a', 'b', 'draw'][rnd.int(3)], self: rnd.int(4) === 0 });
  }
  const b = bracketOf(entrants, receipts), p1 = playOut(b, receipts), p2 = playOut(bracketOf([...entrants].reverse(), receipts), receipts);
  record.synthetic.sets++;
  if (canonical(p1) === canonical(p2)) record.synthetic.twice++;
  const flat = p1.rounds.flat();
  if (flat.every((mt) => mt.open || mt.by === 'bye' || (receipts[mt.by] && receipts[mt.by].winner !== 'draw' && new Set([receipts[mt.by].a.card, receipts[mt.by].b.card]).size === 2 && [receipts[mt.by].a.card, receipts[mt.by].b.card].sort().join() === [mt.a, mt.b].sort().join() && receipts.findIndex((x) => x && x.kind === 'duel' && x.winner !== 'draw' && [x.a.card, x.b.card].sort().join() === [mt.a, mt.b].sort().join()) === mt.by))) record.synthetic.decidedOk++;
  let openOk = true;
  p1.rounds.forEach((round, r) => { if (r === 0) return; round.forEach((mt, i) => { const feed = [p1.rounds[r - 1][2 * i], p1.rounds[r - 1][2 * i + 1]]; if (!mt.open && feed.some((f) => f.open)) openOk = false; if (mt.a && !feed.some((f) => !f.open && f.winner === mt.a)) openOk = false; }); });
  if (openOk) record.synthetic.openOk++;
  const final = p1.rounds[p1.rounds.length - 1][0];
  if ((p1.champion !== null) === !final.open && (!p1.champion || p1.title === (p1.practice ? 'Practice champion' : 'Champion'))) record.synthetic.championOk++;
}
mkdirSync(new URL('../data/organ-12/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/organ-12/record.json', import.meta.url), JSON.stringify(record, null, 1) + '\n');
console.log('organ 12 measured · ' + record.duels.length + ' duels replayed, ' + record.brackets.length + ' real brackets, ' + record.synthetic.sets + ' receipt sets');
