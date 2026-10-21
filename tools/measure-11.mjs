#!/usr/bin/env node
// tools/measure-11.mjs — organ 11, the campaign and kit it for me, measured as sealed in data/organ-11/prereg.json (run
// tools/seal-11.mjs first; git proves the order). Writes data/organ-11/record.json: every auto-kit run twice (its
// collection in two orders), every step's choice re-checked against every candidate that joins, the kit it hands over
// measured again, its TEST AUC with the full kit, its first node only, alone, and a seeded random kit of the same size
// from the same collection; every foreign pool; the campaign's chapters; and the campaign read from seeded receipt sets.
// The sealed measurement is the only reader of TEST: nothing in it chooses a card or a node by TEST. With DRY=1 every
// TEST read is replaced by 0 (a check of the tooling that reads no TEST at all); with SMALL=1 it measures 2 DIGIs a business,
// 1 foreign pool and 50 receipt sets (a quick check of the tooling, never the sealed measurement).
import { writeFileSync, mkdirSync } from 'node:fs';
import { autoKit, chaptersOf, campaign } from '../src/campaign.mjs';
import { kitted } from '../src/kit.mjs';
import { bossesOf, worldBossesOf, KEYS, CLEAR, BAR } from '../src/raid.mjs';
import { scoreRow } from '../src/mind.mjs';
import { verify, give } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { demoMaker } from '../src/drop.mjs';
import { coupleNonNegative, coupled } from '../vendor/dex-frontier/src/compose.mjs';
import { auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { drop, ground, owner, sampler, json, setOfDomain, milli } from './lib.mjs';

const SMALL = process.env.SMALL === '1', DIGIS = SMALL ? 2 : 20, COLLECTION = 8, FOREIGN = SMALL ? 1 : 4, RECEIPT_SETS = SMALL ? 50 : 1000, DRY = process.env.DRY === '1';
const { m, reg } = await drop(), maker = await demoMaker(), stranger = await owner('auto-stranger'), admission = json('drop/admission.json');
/** a genesis card handed by the drop's maker to a demo owner, for this measurement only (nothing is recorded) */
const handTo = async (c, o) => { const d = (await give(dossierOf(reg, c.card), maker, o.pub)).dossier; return { c, d, v: await verify(d) }; };
/** a kit's TEST AUC: its nodes coupled on all of GATE (as the kit is weighed), judged on TEST */
function testOfKit(k, g) {
  if (DRY) return 0;
  const rows = g.ds.testRows, y = rows.map((i) => g.ds.y[i]);
  if (k.fielded.length === 1) return milli(auc(rows.map((i) => scoreRow(k.fielded[0].mind, g, i)), y));
  const c = coupleNonNegative(k.fielded.map((f) => f.col), g.ds.gateRows.map((i) => g.ds.y[i]));
  return milli(auc(rows.map((i) => coupled(c, k.fielded.map((f) => scoreRow(f.mind, g, i)))), y));
}
/** at every step, the node chosen scores the highest kitted GATE of every candidate that joins; ties to the lower card id */
function greedyHolds(D, pool, a, g) {
  const byId = new Map(pool.map((v) => [v.id, v]));
  return a.steps.every((s, i) => {
    const prefix = a.nodes.slice(0, i).map((id) => byId.get(id));
    return pool.filter((v) => !a.nodes.slice(0, i).includes(v.id) && v.id !== s.card).every((v) => {
      const k = kitted(D, [...prefix, v], g);
      return !k.ok || !k.slots[i].joined || k.gate < s.gate || (k.gate === s.gate && s.card < v.id);
    });
  });
}
const sets = [...new Set(m.cards.map((c) => setOfDomain(c.domain)))].filter((s) => new Set(m.cards.filter((c) => setOfDomain(c.domain) === s).map((c) => c.domain)).size >= 2);
const record = { kind: 'digi-card.organ-11.record', v: 1, dry: DRY, sets, kits: [], foreign: [], chapters: null, receipts: { sets: 0, consistent: 0, twice: 0 }, ms: [] };

for (const set of sets) {
  const g = await ground(set), cards = m.cards.filter((c) => setOfDomain(c.domain) === set).sort((a, b) => a.serial - b.serial), pick = sampler(11000 + sets.indexOf(set));
  const other = m.cards.filter((c) => setOfDomain(c.domain) !== set).sort((a, b) => a.serial - b.serial);
  for (let k = 0; k < DIGIS; k++) {
    const t0 = performance.now(), o = await owner('auto-' + set + '-' + k), main = pick.pick(cards), chosen = [];
    while (chosen.length < COLLECTION) { const c = pick.pick(cards); if (c.serial !== main.serial && !chosen.includes(c)) chosen.push(c); }
    const D = await handTo(main, o), C = [];
    for (const c of chosen) C.push(await handTo(c, o));
    const pool = C.map((x) => x.v), a1 = autoKit(D.v, pool, g), a2 = autoKit(D.v, [...pool].reverse(), g);
    const vOf = new Map(pool.map((v) => [v.id, v])), nodes = a1.ok ? a1.nodes.map((id) => vOf.get(id)) : [];
    const full = kitted(D.v, nodes, g), first = kitted(D.v, nodes.slice(0, 1), g), alone = kitted(D.v, [], g);
    // a seeded random kit of the same size, from the same collection
    const rand = [], left = [...pool];
    while (rand.length < nodes.length && left.length) rand.push(left.splice(pick.int(left.length), 1)[0]);
    const random = kitted(D.v, rand, g);
    const test = testOfKit(full, g), testFirst = testOfKit(first, g), testAlone = testOfKit(alone, g), testRandom = testOfKit(random, g);
    record.kits.push({ set, k, digi: main.serial, domain: main.domain, collection: chosen.map((c) => c.serial), ok: a1.ok, nodes: nodes.map((v) => chosen[pool.indexOf(v)].serial), steps: a1.ok ? a1.steps.length : 0,
      alone: a1.ok ? a1.alone : null, gate: a1.ok ? a1.gate : null, lift: a1.ok ? a1.gate - a1.alone : null, same: canonical(a1) === canonical(a2), greedyOk: a1.ok && greedyHolds(D.v, pool, a1, g),
      liftsOk: a1.ok && a1.steps.every((s) => s.adds > 0), measuredOk: a1.ok && full.ok && full.gate === a1.gate && alone.gate === a1.alone,
      test, testFirst, testAlone, testRandom, testLift: test - testAlone, testFirstLift: testFirst - testAlone, randomNodes: rand.length });
    record.ms.push(Math.round(performance.now() - t0));
    process.stdout.write(set + ' ' + (k + 1) + '/' + DIGIS + ' · ' + Math.round(performance.now() - t0) + ' ms\n');
  }
  // foreign pools: a card of this business another key holds, a card of another business, and the DIGI itself, among its own
  for (let k = 0; k < FOREIGN; k++) {
    const o = await owner('auto-foreign-' + set + '-' + k), main = pick.pick(cards), mine = [];
    while (mine.length < 3) { const c = pick.pick(cards); if (c.serial !== main.serial && !mine.includes(c)) mine.push(c); }
    const theirs = pick.pick(cards.filter((c) => c.serial !== main.serial && !mine.includes(c))), elsewhere = pick.pick(other);
    const D = await handTo(main, o), own = [];
    for (const c of mine) own.push((await handTo(c, o)).v);
    const T = (await handTo(theirs, stranger)).v, E = (await handTo(elsewhere, o)).v;
    const a = autoKit(D.v, [T, E, D.v, ...own], g), bad = new Set([T.id, E.id, D.v.id]);
    record.foreign.push({ set, k, ok: a.ok, picked: a.ok ? a.nodes.length : 0, clean: a.ok && a.nodes.every((id) => !bad.has(id)) });
  }
}

// the campaign: every boss in exactly one chapter, chapters by what they have left, and its reading from seeded receipts
const chapters = chaptersOf(admission), raids = bossesOf(admission), worlds = worldBossesOf(admission);
const inRaids = chapters.flatMap((c) => c.raids.map((r) => r.domain)), inWorlds = chapters.map((c) => c.world.set);
record.chapters = { n: chapters.length, raids: raids.length, worlds: worlds.length, once: raids.every((r) => inRaids.filter((d) => d === r.domain).length === 1) && worlds.every((w) => inWorlds.filter((s) => s === w.set).length === 1) && inRaids.length === raids.length && inWorlds.length === worlds.length,
  ordered: chapters.every((c, i) => i === 0 || chapters[i - 1].left <= c.left), list: chapters.map((c) => ({ n: c.n, set: c.set, raids: c.raids.map((r) => r.domain), left: c.left })) };
const flip = sampler(1100), strikeOn = (domain, gate) => Object.fromEntries(KEYS.map((k) => [k, k === 'domain' ? domain : k === 'gate' ? gate : k === 'k' ? gate : 'x'])), clearOn = (set, gate) => Object.fromEntries(CLEAR.map((k) => [k, k === 'set' ? set : k === 'gate' ? gate : k === 'kind' ? 'clear' : k === 'members' ? [{ owner: 'o' }] : 'x']));
for (let n = 0; n < RECEIPT_SETS; n++) {
  const fell = new Map(), strikes = [], clears = [];
  for (const r of raids) { const f = flip.int(2) === 1; fell.set(r.domain, f); strikes.push(strikeOn(r.domain, f ? BAR + flip.int(50000) : BAR - 1 - flip.int(50000))); }
  for (const w of worlds) { const f = flip.int(2) === 1; fell.set(w.set, f); clears.push(clearOn(w.set, f ? w.bar + flip.int(50000) : w.bar - 1 - flip.int(50000))); }
  const c1 = campaign(admission, strikes, clears), c2 = campaign(admission, [...strikes].reverse(), [...clears].reverse());
  const cleared = chapters.map((c) => c.raids.every((r) => fell.get(r.domain)) && fell.get(c.set)), first = cleared.indexOf(false);
  record.receipts.sets++;
  if (c1.ok && c1.chapters.every((c, i) => c.cleared === cleared[i]) && c1.now === (first < 0 ? null : chapters[first].n)) record.receipts.consistent++;
  if (canonical(c1) === canonical(c2)) record.receipts.twice++;
}
mkdirSync(new URL('../data/organ-11/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/organ-11/record.json', import.meta.url), JSON.stringify(record, null, 1) + '\n');
console.log('organ 11 measured' + (DRY ? ' (DRY: no TEST read)' : '') + ' · ' + record.kits.length + ' auto-kits, ' + record.foreign.length + ' foreign pools, ' + record.chapters.n + ' chapters, ' + record.receipts.sets + ' receipt sets');
