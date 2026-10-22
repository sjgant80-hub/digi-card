#!/usr/bin/env node
// tools/measure-13.mjs — organ 13, the tie rule, measured as sealed in data/organ-13/prereg.json (run tools/seal-13.mjs
// first; git proves the order). Writes data/organ-13/record.json: one real bracket per business, each match fought as a
// duel between two demo owners until the bracket names its champion; and the bracket played out from 1,000 seeded
// receipt sets heavy with draws. TEST is never read: duels and brackets are GATE.
// With SMALL=1 it measures brackets of 4 and 50 receipt sets ON OTHER SEEDS, into dry-record.json (a quick check of the
// tooling that touches none of the sealed population, never the sealed measurement).
import { writeFileSync, mkdirSync } from 'node:fs';
import { bracketOf, playOut, DRAWS_TO_TIE } from '../src/tournament.mjs';
import { kitChallenge, kitAccept, kitDuel } from '../src/kit.mjs';
import { verify, give } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { demoMaker } from '../src/drop.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { drop, ground, owner, sampler, setOfDomain } from './lib.mjs';

const SMALL = process.env.SMALL === '1', ENTRANTS = SMALL ? 4 : 8, RECEIPT_SETS = SMALL ? 50 : 1000, SEED = SMALL ? 23000 : 13000;
const { m, reg } = await drop(), maker = await demoMaker();
const handTo = async (c, o) => { const d = (await give(dossierOf(reg, c.card), maker, o.pub)).dossier; return { c, d, v: await verify(d) }; };
const sets = [...new Set(m.cards.map((c) => setOfDomain(c.domain)))].filter((s) => new Set(m.cards.filter((c) => setOfDomain(c.domain) === s).map((c) => c.domain)).size >= 2);
const record = { kind: 'digi-card.organ-13.record', v: 1, drawsToTie: DRAWS_TO_TIE, sets, brackets: [], synthetic: { sets: 0, twice: 0, decidedOk: 0, openOk: 0, championOk: 0, ties: 0, decided: 0 } };
/** the receipts naming exactly two cards, in their own order, with their indices */
const pairOf = (receipts, a, b) => receipts.map((x, i) => [x, i]).filter(([x]) => x && x.kind === 'duel' && x.a && x.b && ((x.a.card === a && x.b.card === b) || (x.a.card === b && x.b.card === a)));
/** a decided match follows the rule: the first decisive receipt of its pair before their third draw, or the tie at the third draw to the higher seed */
function ruled(mt, receipts, seeds) {
  if (mt.open || mt.by === 'bye') return true;
  const mine = pairOf(receipts, mt.a, mt.b).filter(([x]) => ['a', 'b', 'draw'].includes(x.winner)), first = mine.findIndex(([x]) => x.winner !== 'draw');
  if (mt.tie === true) {
    const higher = seeds.indexOf(mt.a) < seeds.indexOf(mt.b) ? mt.a : mt.b;
    return mine.length >= DRAWS_TO_TIE && (first < 0 || first >= DRAWS_TO_TIE) && mt.by === mine[DRAWS_TO_TIE - 1][1] && mt.winner === higher;
  }
  if (first < 0 || first >= DRAWS_TO_TIE || mt.by !== mine[first][1]) return false;
  const x = mine[first][0];
  return mt.winner === (x.winner === 'a' ? x.a.card : x.b.card);
}

for (const set of sets) {
  const g = await ground(set), cards = m.cards.filter((c) => setOfDomain(c.domain) === set).sort((a, b) => a.serial - b.serial), pick = sampler(SEED + sets.indexOf(set));
  const entrants = [];
  while (entrants.length < ENTRANTS) { const c = pick.pick(cards); if (!entrants.some((e) => e.c.serial === c.serial)) entrants.push({ c, o: await owner((SMALL ? 'dry-' : '') + 'tie-' + set + '-' + entrants.length) }); }
  for (const e of entrants) Object.assign(e, await handTo(e.c, e.o));
  const byId = new Map(entrants.map((e) => [e.v.id, e])), receipts = [];
  let b = bracketOf(entrants.map((e) => e.v.id), []), p = playOut(b, receipts), rounds = 0;
  // every open match with both sides known is fought once a round; the tie rule ends any match in DRAWS_TO_TIE rounds
  while (b.ok && p.ok && !p.champion && rounds++ < 4 * (DRAWS_TO_TIE + 1)) {
    for (const round of p.rounds) for (const mt of round) if (mt.open && mt.a && mt.b) {
      const A = byId.get(mt.a), B = byId.get(mt.b);
      const ch = (await kitChallenge(A.o, A.v, null, 'tie-' + receipts.length)).challenge, ac = (await kitAccept(B.o, B.v, null, ch)).accept;
      const r = await kitDuel({ v: A.v }, { v: B.v }, g, { challenge: ch, accept: ac });
      if (r.ok) receipts.push(r.receipt);
    }
    p = playOut(b, receipts);
  }
  const decided = p.ok ? p.rounds.flat().filter((mt) => !mt.open && mt.by !== 'bye') : [];
  record.brackets.push({ set, ok: b.ok && p.ok, champion: p.ok && p.champion ? byId.get(p.champion).c.serial : null, practice: p.ok ? p.practice : null, title: p.ok ? p.title : null,
    duels: receipts.length, draws: receipts.filter((x) => x.winner === 'draw').length, ruled: decided.every((mt) => ruled(mt, receipts, b.seeds)),
    matches: decided.map((mt) => { const A = byId.get(mt.a), B = byId.get(mt.b), w = byId.get(mt.winner); return { a: A.c.serial, b: B.c.serial, gateA: A.c.gate, gateB: B.c.gate, winner: w.c.serial, tie: mt.tie === true, fought: pairOf(receipts, mt.a, mt.b).length }; }) });
  console.log(set + ' · ' + (p.champion ? 'champion #' + byId.get(p.champion).c.serial : 'no champion') + ' · ' + receipts.length + ' duels');
}

// the bracket played out from 1,000 seeded receipt sets heavy with draws: byes, junk, one owner against itself, either order
const rnd = sampler(SEED / 10), C = (n) => n.toString(16).padStart(16, '0');
for (let n = 0; n < RECEIPT_SETS; n++) {
  // a third of the sets are STUBBORN: their duels go to the bracket's own first-round pairs, three in four of them draws,
  // so matches meet three draws again and again and the tie rule is put to the test, not left to luck
  const size = 2 + rnd.int(15), entrants = Array.from({ length: size }, (_, i) => C(100 + i)), receipts = [], stubborn = rnd.int(3) === 0;
  const pairs = bracketOf(entrants, []).first.filter(([a, b]) => a && b);
  for (let k = rnd.int(5 * size); k > 0; k--) {
    const [x, y] = stubborn && pairs.length ? pairs[rnd.int(pairs.length)] : [entrants[rnd.int(size)], entrants[rnd.int(size)]];
    if (rnd.int(10) === 0) { receipts.push({ junk: k }); continue; }
    const w = rnd.int(4), winner = stubborn ? (w < 3 ? 'draw' : rnd.int(2) ? 'a' : 'b') : (w < 2 ? 'draw' : w === 2 ? 'a' : 'b');
    receipts.push({ kind: 'duel', data: 'toy', a: { card: x, head: 'h', kit: 'k', auc: 1 }, b: { card: y, head: 'h', kit: 'k', auc: 1 }, challenge: 'c', accept: 'x', seed: 's', n: 64, winner, self: rnd.int(4) === 0 });
  }
  const b = bracketOf(entrants, receipts), p1 = playOut(b, receipts), p2 = playOut(bracketOf([...entrants].reverse(), receipts), receipts);
  record.synthetic.sets++;
  if (canonical(p1) === canonical(p2)) record.synthetic.twice++;
  const flat = p1.rounds.flat();
  if (flat.every((mt) => ruled(mt, receipts, b.seeds))) record.synthetic.decidedOk++;
  record.synthetic.ties += flat.filter((mt) => mt.tie === true).length;
  record.synthetic.decided += flat.filter((mt) => !mt.open && mt.by !== 'bye').length;
  let openOk = true;
  p1.rounds.forEach((round, r) => { if (r === 0) return; round.forEach((mt, i) => { const feed = [p1.rounds[r - 1][2 * i], p1.rounds[r - 1][2 * i + 1]]; if (!mt.open && feed.some((f) => f.open)) openOk = false; }); });
  if (openOk) record.synthetic.openOk++;
  const final = p1.rounds[p1.rounds.length - 1][0];
  if ((p1.champion !== null) === !final.open && (!p1.champion || p1.title === (p1.practice ? 'Practice champion' : 'Champion'))) record.synthetic.championOk++;
}
mkdirSync(new URL('../data/organ-13/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/organ-13/' + (SMALL ? 'dry-record.json' : 'record.json'), import.meta.url), JSON.stringify(record, null, 1) + '\n');
console.log('organ 13 measured · ' + record.brackets.length + ' real brackets, ' + record.synthetic.sets + ' receipt sets, ' + record.synthetic.ties + ' ties of ' + record.synthetic.decided + ' decided synthetic matches');
