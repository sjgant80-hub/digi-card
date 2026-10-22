#!/usr/bin/env node
// tools/measure-16.mjs — organ 16, BUILDS AND COMBOS and the first training build, measured as sealed in
// data/organ-16/prereg.json (run tools/seal-16.mjs first; git proves the order). Writes data/organ-16/record.json.
//
// For each of the five businesses of the drop: BUILDS seeded builds of the drop's own cards (two or three departments,
// one card each, and in every third build a second card of a department already in it). Every build is measured
// (src/build.mjs); measured again by a demo key's signed re-run with its cards in reverse order and a card of another
// business added; re-run and signed by a second demo key; proven by the two; and attacked (the first key twice, a forged
// signature, two re-runs of another receipt). Its numbers are worked out again here from its fielded parts (the out-of-fold
// judge over their GATE columns), and its fielding checked against the rule. Its TEST AUC — the fielded parts coupled on all
// of GATE, as the build is weighed, judged on TEST — is set against the TEST AUC of its best part (the one best alone on GATE).
//
// Then the SHRINKS: in each business the SHRINKS builds with the largest GATE lift (chosen by GATE alone, ties to the lower
// build id), each shrunk once by a demo trainer into its best part's department (src/shrink.mjs), checked deeply, with the
// student's TEST AUC, its best source's TEST AUC, the teacher's, and the CONTROL: the very same search, from the very same
// seed, run on the true answers instead of the teacher's.
//
// The sealed measurement is the only reader of TEST: nothing in it chooses a card, a build or a shrink by TEST. DRY=1
// replaces every TEST read by 0 (a check of the tooling that reads no TEST at all). SMALL=1 measures 2 builds a business and
// 1 shrink a business ON OTHER SEEDS, into dry-record.json (a check of the tooling, never the sealed measurement).
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { recipeOf, measure, signRerun, proofOf, receiptId, buildId, verdictOf, nameOf, RERUN } from '../src/build.mjs';
import { shrink, checkShrink, studentOf, shrinkSeed, keptOf } from '../src/shrink.mjs';
import { organOf, searchOf, scoreRow, GROW } from '../src/mind.mjs';
import { oof } from '../src/mesh.mjs';
import { verify } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { coupleNonNegative, coupled } from '../vendor/dex-frontier/src/compose.mjs';
import { auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { drop, ground, owner, sampler, setOfDomain, milli, viewOf, mindOf, json } from './lib.mjs';

const SMALL = process.env.SMALL === '1', DRY = process.env.DRY === '1', BUILDS = SMALL ? 2 : 16, SHRINKS = SMALL ? 1 : 4, SEED = SMALL ? 26000 : 16000;
// ONLY=<business> measures that one business into its part file (every business is seeded on its own, so the five parts
// are exactly what one run would measure, only faster side by side); MERGE=1 joins the five parts, in the businesses'
// order, into the record. Nothing else differs.
const ONLY = process.env.ONLY || null, MERGE = process.env.MERGE === '1';
const OUT = SMALL ? 'dry-record.json' : 'record.json', PART = (set) => (SMALL ? 'dry-' : '') + 'part-' + set + '.json', AT = (f) => new URL('../data/organ-16/' + f, import.meta.url);
if (MERGE) {
  const all = [...new Set(json('drop/manifest.json').cards.map((c) => setOfDomain(c.domain)))].sort(), parts = all.map((s) => JSON.parse(readFileSync(AT(PART(s)), 'utf8')));
  if (parts.some((p, k) => p.dry !== DRY || p.small !== SMALL || p.only !== all[k])) throw new Error('the parts were not all measured, or not the same way');
  const merged = { kind: 'digi-card.organ-16.record', v: 1, dry: DRY, small: SMALL, sets: all, builds: parts.flatMap((p) => p.builds), shrinks: parts.flatMap((p) => p.shrinks), ms: parts.flatMap((p) => p.ms) };
  writeFileSync(AT(OUT), JSON.stringify(merged, null, 1) + '\n');
  console.log('organ 16 merged into ' + OUT + ' · ' + merged.builds.length + ' builds, ' + merged.shrinks.length + ' shrinks');
  process.exit(0);
}
const { m, reg } = await drop(), [bob, eve, alice] = await Promise.all(['build-bob', 'build-eve', 'build-alice'].map(owner)), trainer = await owner(SMALL ? 'shrink-trainer-dry' : 'shrink-trainer');
const vOf = new Map(), cardV = async (c) => { if (!vOf.has(c.card)) vOf.set(c.card, await verify(dossierOf(reg, c.card))); return vOf.get(c.card); };
const sets = [...new Set(m.cards.map((c) => setOfDomain(c.domain)))].sort();
const unsigned = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig'));
const resign = async (keys, x, over) => { const f = { ...unsigned(x), ...over }; return { ...f, sig: await sign(keys, utf8(canonical(f))) }; };
const testOfCol = (scores, g) => (DRY ? 0 : milli(auc(scores, g.ds.testRows.map((i) => g.ds.y[i]))));
/** a mind of one organ, live, as scoreRow reads one */
const lone = (o) => ({ organs: [{ ...o, state: 'live' }], coupling: null });
const record = { kind: 'digi-card.organ-16.record', v: 1, dry: DRY, small: SMALL, only: ONLY, sets, builds: [], shrinks: [], ms: [] };

for (const [si, set] of sets.entries()) {
  if (ONLY && set !== ONLY) continue;
  const g = await ground(set), pick = sampler(SEED + si), cards = m.cards.filter((c) => setOfDomain(c.domain) === set).sort((a, b) => a.serial - b.serial);
  const depts = [...new Set(cards.map((c) => c.domain))].sort(), other = m.cards.filter((c) => setOfDomain(c.domain) !== set).sort((a, b) => a.serial - b.serial);
  const gy = g.ds.gateRows.map((i) => g.ds.y[i]), mine = [];
  for (let n = 0; n < BUILDS; n++) {
    const t0 = performance.now(), size = 2 + (n % 2), left = [...depts], chosen = [];
    while (chosen.length < size) chosen.push(left.splice(pick.int(left.length), 1)[0]);
    const picked = [];
    for (const d of chosen) { const pool = cards.filter((c) => c.domain === d && !picked.includes(c)); picked.push(pool[pick.int(pool.length)]); }
    if (n % 3 === 2) { const d = chosen[pick.int(chosen.length)], pool = cards.filter((c) => c.domain === d && !picked.includes(c)); picked.push(pool[pick.int(pool.length)]); }
    const vs = [];
    for (const c of picked) vs.push(await cardV(c));
    const stranger = await cardV(other[pick.int(other.length)]);
    const b = recipeOf(vs, g).build, r = measure(b, vs, g);
    if (!r.ok) { record.builds.push({ set, n, ok: false, why: r.why }); continue; }
    const R = r.receipt;
    // measured again by two keys: one with the cards reversed and a card of another business among them
    const rb = await signRerun(bob, R, b, [...vs].reverse().concat([stranger]), g), re = await signRerun(eve, R, b, vs, g);
    const proof = rb.ok && re.ok ? await proofOf(R, b, vs, g, [rb.rerun, re.rerun]) : { ok: false };
    const forged = rb.ok ? { ...re.rerun, by: alice.pub } : null, elsewhere = rb.ok ? await resign(bob, rb.rerun, { receipt: '0'.repeat(64) }) : null, elsewhere2 = rb.ok ? await resign(eve, re.rerun, { receipt: 'f'.repeat(64) }) : null;
    const attack = rb.ok ? await proofOf(R, b, vs, g, [rb.rerun, rb.rerun, forged, elsewhere, elsewhere2]) : { ok: false };
    // the numbers, worked out here from the fielded parts
    const fieldedParts = R.parts.filter((p) => p.joined), byCard = new Map(vs.map((v) => [v.id, v]));
    // each fielded card's mind expressed here once, apart from the kernel's, then read row by row
    const minds = r.fielded.map((f) => mindOf(byCard.get(f.card), g));
    const cols = minds.map((mi) => g.ds.gateRows.map((i) => scoreRow(mi, g, i))), gate = milli(oof(cols, gy));
    const alone = cols.map((c) => milli(oof([c], gy))), best = Math.max(...alone), lift = gate - best;
    const order = r.fielded.map((f) => f.card), fieldOk = new Set(fieldedParts.map((p) => p.domains)).size === fieldedParts.length
      && order.every((id, k) => k === 0 || (() => { const a = R.parts.find((p) => p.card === order[k - 1]), c = R.parts.find((p) => p.card === id); return a.gate > c.gate || (a.gate === c.gate && a.card < c.card); })())
      && R.parts.filter((p) => !p.joined).every((p) => {
        if (p.why === 'it is dormant here: no department of its mind answers on this ground') return p.gate === null;
        if (/^it does not lead a coin on GATE \(bound -?\d+(\.\d+)?\)$/.test(p.why)) return p.gate !== null;
        const mm = /^a better-proven part fields (.+)$/.exec(p.why || ''), f = mm && fieldedParts.find((q) => q.domains === mm[1]);
        return !!f && (f.gate > p.gate || (f.gate === p.gate && f.card < p.card));
      });
    // TEST: the fielded coupled on all of GATE, judged on TEST; its best part, the one best alone on GATE, alone on TEST
    const top = alone.indexOf(best), tr = g.ds.testRows;
    const c = coupleNonNegative(cols, gy), buildTest = DRY ? 0 : testOfCol(tr.map((i) => coupled(c, minds.map((mi) => scoreRow(mi, g, i)))), g);
    const bestTest = DRY ? 0 : testOfCol(tr.map((i) => scoreRow(minds[top], g, i)), g);
    const row = { set, n, ok: true, id: buildId(b), cards: picked.map((x) => x.serial), size: picked.length, fielded: R.fielded, benched: R.parts.length - R.fielded, verdict: R.verdict, name: R.name,
      gate: R.gate, best: R.best, lift: R.lift, gateOk: gate === R.gate, bestOk: best === R.best, liftOk: lift === R.lift && R.lift === R.gate - R.best, verdictOk: verdictOf(R.fielded, lift) === R.verdict && (R.fielded < 2 ? R.verdict === 'plain' : true),
      nameOk: nameOf(order.map((id) => R.parts.find((p) => p.card === id).title)) === R.name, fieldOk, contribOk: r.fielded.every((f, k) => R.parts.find((p) => p.card === f.card).contribution === gate - milli(oof(cols.filter((_, j) => j !== k), gy))),
      sameReversed: rb.ok, sameAgain: re.ok, proven: proof.ok === true && proof.proven === true && canonical(proof.keys) === canonical([bob.pub, eve.pub]) && proof.finder === bob.pub && proof.refused.length === 0,
      attackRefused: attack.ok === true && attack.proven === false && canonical(attack.keys) === canonical([bob.pub]) && canonical(attack.refused) === canonical(['the same key twice', 'a re-run whose signature does not check', 'a re-run of another receipt', 'a re-run of another receipt']),
      rerunType: rb.ok && rb.rerun.type === RERUN && rb.rerun.receipt === receiptId(R), test: buildTest, bestTest, testLift: buildTest - bestTest };
    record.builds.push(row);
    mine.push({ row, b, vs, R });
    record.ms.push(Math.round(performance.now() - t0));
    process.stdout.write(set + ' build ' + (n + 1) + '/' + BUILDS + ' · ' + R.verdict + ' ' + R.lift + ' · ' + Math.round(performance.now() - t0) + ' ms\n');
  }
  // the shrinks: the builds of the largest GATE lift, chosen by GATE alone
  const order = mine.filter((x) => x.R.fielded >= 2).sort((a, b) => b.R.lift - a.R.lift || (a.row.id < b.row.id ? -1 : 1)).slice(0, SHRINKS);
  for (const x of order) {
    const t0 = performance.now(), s = await shrink(trainer, x.b, x.vs, g, { k: 0 });
    if (!s.ok) { record.shrinks.push({ set, build: x.row.id, ok: false, why: s.why }); continue; }
    const S = s.shrink, deep = await checkShrink(S, x.b, x.vs, g, { deep: true }), view = viewOf(g, S.domain);
    const student = organOf(S.recipe, view, 0.6), control = organOf(searchOf(S.domain, shrinkSeed(trainer.pub, S.build, S.domain, 0), GROW), view, 0.6);
    const tr = g.ds.testRows, sourceCard = x.R.parts.filter((p) => p.joined).sort((a, b) => b.gate - a.gate || (a.card < b.card ? -1 : 1))[0].card;
    const sm = lone(student), cm = lone(control), studentTest = DRY ? 0 : testOfCol(tr.map((i) => scoreRow(sm, g, i)), g), controlTest = DRY ? 0 : testOfCol(tr.map((i) => scoreRow(cm, g, i)), g);
    const sourceMind = mindOf(x.vs.find((v) => v.id === sourceCard), g), sourceTest = DRY ? 0 : testOfCol(tr.map((i) => scoreRow(sourceMind, g, i)), g);
    const card = studentOf(S);
    record.shrinks.push({ set, build: x.row.id, ok: true, domain: S.domain, gate: S.gate, best: S.best, teacher: S.teacher, kept: S.kept, keptOk: S.kept === keptOf(S.gate, S.best) && S.kept === (S.gate >= S.best + 2000),
      deepOk: deep.ok === true, studentOk: student.ok && student.gate === S.gate, sameSeed: control.ok && searchOf(S.domain, shrinkSeed(trainer.pub, S.build, S.domain, 0), GROW) === S.found,
      cardOk: S.kept ? (S.gate >= 600000 ? card.ok === true && card.genome.organs[0] === S.recipe : card.ok === false) : card.ok === false,
      controlGate: control.ok ? control.gate : null, studentTest, controlTest, sourceTest, teacherTest: x.row.test, ms: Math.round(performance.now() - t0) });
    process.stdout.write(set + ' shrink · ' + S.domain + ' ' + S.gate + ' vs ' + S.best + (S.kept ? ' kept' : '') + ' · ' + Math.round(performance.now() - t0) + ' ms\n');
  }
}
mkdirSync(new URL('../data/organ-16/', import.meta.url), { recursive: true });
const file = ONLY ? PART(ONLY) : OUT;
if (!ONLY) delete record.only;
writeFileSync(AT(file), JSON.stringify(record, null, 1) + '\n');
console.log('organ 16 measured' + (DRY ? ' (DRY: no TEST read)' : '') + (SMALL ? ' (SMALL, other seeds)' : '') + ' into ' + file + ' · ' + record.builds.length + ' builds, ' + record.shrinks.length + ' shrinks');
