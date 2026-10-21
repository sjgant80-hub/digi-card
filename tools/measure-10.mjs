#!/usr/bin/env node
// tools/measure-10.mjs — organ 10, the kit and the party, measured as sealed in data/organ-10/prereg.json (run
// tools/seal-10.mjs first; git proves the order). Writes data/organ-10/record.json: every kit measured twice with its
// TEST AUC alone and kitted, every kit duel and its re-run, every forgery's refusal, every party strike, its re-run and
// its TEST AUC, and every app item with its forged bodies. The sealed measurement is the only reader of TEST: nothing in
// it chooses a card, a node or a party by TEST.
import { writeFileSync } from 'node:fs';
import { equip, loadoutOk, kitted, scoresOn, kitChallenge, kitAccept, kitDuel, kitRerun } from '../src/kit.mjs';
import { appsOf, mintApp, giveItem, verifyItem } from '../src/item.mjs';
import { worldBossesOf, partyStrike, checkClear, partyOf, PARTY_MARGIN } from '../src/raid.mjs';
import { consent, oof } from '../src/mesh.mjs';
import { scoreRow } from '../src/mind.mjs';
import { verify, give } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { demoMaker } from '../src/drop.mjs';
import { coupleNonNegative, coupled } from '../vendor/dex-frontier/src/compose.mjs';
import { auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { drop, ground, owner, sampler, json, setOfDomain, milli } from './lib.mjs';

const KITS = 20, DUELS = 3, FORGED_PER_SET = 4, PARTIES = 10;
const { m, reg } = await drop(), maker = await demoMaker(), stranger = await owner('kit-stranger'), admission = json('drop/admission.json');
const bosses = worldBossesOf(admission), apps = appsOf(json('vendor/mint-an-app/catalogue-data.json'), json('vendor/mint-an-app/mint-data.json'));
const resign = async (keys, e, over = {}) => { const f = { ...Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig' && k !== 'by')), ...over, by: keys.pub }; return { ...f, sig: await sign(keys, utf8(canonical(f))) }; };
/** a genesis card handed by the drop's maker to a demo owner, for this measurement only (nothing is recorded) */
const handTo = async (c, o) => { const d = (await give(dossierOf(reg, c.card), maker, o.pub)).dossier; return { c, d, v: await verify(d) }; };
/** a kit's TEST AUC: its nodes coupled on all of GATE (as the kit is weighed), judged on TEST */
function testOfKit(k, g) {
  const rows = g.ds.testRows, y = rows.map((i) => g.ds.y[i]);
  if (k.fielded.length === 1) return milli(auc(rows.map((i) => scoreRow(k.fielded[0].mind, g, i)), y));
  const c = coupleNonNegative(k.fielded.map((f) => f.col), g.ds.gateRows.map((i) => g.ds.y[i]));
  return milli(auc(rows.map((i) => coupled(c, k.fielded.map((f) => scoreRow(f.mind, g, i)))), y));
}
const numbers = (k) => canonical({ gate: k.gate, alone: k.alone, lift: k.lift, own: k.own, slots: k.slots });
const sets = [...new Set(m.cards.map((c) => setOfDomain(c.domain)))].filter((s) => new Set(m.cards.filter((c) => setOfDomain(c.domain) === s).map((c) => c.domain)).size >= 2);
const record = { kind: 'digi-card.organ-10.record', v: 1, sets, kits: [], duels: [], forgeries: [], parties: [], items: { apps: apps.size, minted: 0, verified: 0, handed: 0, forged: 0, refused: 0 }, ms: [] };

for (const set of sets) {
  const g = await ground(set), cards = m.cards.filter((c) => setOfDomain(c.domain) === set).sort((a, b) => a.serial - b.serial);
  const doms = [...new Set(cards.map((c) => c.domain))].sort(), pick = sampler(10000 + sets.indexOf(set)), y = (rows) => rows.map((i) => g.ds.y[i]);
  for (let k = 0; k < KITS; k++) {
    const o = await owner('kit-' + set + '-' + k), main = pick.pick(cards), pool = doms.filter((d) => d !== main.domain), n = 1 + pick.int(Math.min(2, pool.length)), chosen = [];
    while (chosen.length < n) { const d = pool.splice(pick.int(pool.length), 1)[0]; chosen.push(pick.pick(cards.filter((c) => c.domain === d))); }
    const D = await handTo(main, o), N = [];
    for (const c of chosen) N.push(await handTo(c, o));
    const nodes = N.map((x) => x.v), k1 = kitted(D.v, nodes, g), k2 = kitted(D.v, nodes, g);
    const cols = k1.fielded.map((f) => f.col), gy = y(g.ds.gateRows);
    const worthOk = k1.fielded.slice(1).every((f, j) => k1.slots.find((s) => s.card === f.card && s.joined).contribution === k1.gate - milli(oof(cols.filter((_, i) => i !== j + 1), gy)));
    const test = testOfKit(k1, g), testAlone = testOfKit(kitted(D.v, [], g), g);
    const lo = (await equip(o, D.v, nodes)).loadout, loOk = (await loadoutOk(lo, D.v, nodes)).ok;
    record.kits.push({ set, k, digi: main.serial, domain: main.domain, nodes: chosen.map((c) => ({ serial: c.serial, domain: c.domain })), joined: k1.slots.filter((s) => s.joined).length, gate: k1.gate, alone: k1.alone, lift: k1.lift, test, testAlone, testLift: test - testAlone, same: numbers(k1) === numbers(k2), worthOk, loOk });
    // the kit duels: the kitted DIGI, then the DIGI alone, against another card of its own department fielded alone
    const foeCard = pick.pick(cards.filter((c) => c.domain === main.domain && c.serial !== main.serial)), foeO = await owner('kit-foe-' + set + '-' + k), F = await handTo(foeCard, foeO);
    const sideA = { v: D.v, loadout: lo, nodes }, sideF = { v: F.v, loadout: null }, aloneA = { v: D.v, loadout: null };
    let firstKit = null;
    for (let d = 0; d < DUELS; d++) {
      const t0 = performance.now(), ch = (await kitChallenge(o, D.v, lo, 'organ10-' + d)).challenge, ac = (await kitAccept(foeO, F.v, null, ch)).accept, r = await kitDuel(sideA, sideF, g, { challenge: ch, accept: ac });
      record.ms.push(Math.round((performance.now() - t0) * 10) / 10);
      const ch2 = (await kitChallenge(o, D.v, null, 'organ10-alone-' + d)).challenge, ac2 = (await kitAccept(foeO, F.v, null, ch2)).accept, r2 = await kitDuel(aloneA, sideF, g, { challenge: ch2, accept: ac2 });
      const again = r.ok ? await kitRerun(r.receipt, sideA, sideF, g, { challenge: ch, accept: ac }) : { ok: false };
      record.duels.push({ set, k, d, ok: r.ok === true, why: r.why || null, rerun: again.ok === true, kitted: r.ok ? r.receipt.winner : null, alone: r2.ok ? r2.receipt.winner : null, aucs: r.ok ? [r.receipt.a.auc, r.receipt.b.auc] : null });
      if (d === 0 && r.ok) firstKit = { r, ch, ac };
    }
    // a tool never moves a score: the same nodes with an app tool, fought, against the same nodes' scores on that batch
    const name = [...apps.keys()][(sets.indexOf(set) * KITS + k) % apps.size], item = (await mintApp(o, apps, name)).item, iv = await verifyItem(item, apps);
    const loT = (await equip(o, D.v, nodes, [iv])).loadout, chT = (await kitChallenge(o, D.v, loT, 'organ10-tool')).challenge, acT = (await kitAccept(foeO, F.v, null, chT)).accept;
    const rT = await kitDuel({ v: D.v, loadout: loT, nodes, tools: [iv] }, sideF, g, { challenge: chT, accept: acT });
    const bare = rT.ok ? milli(auc(scoresOn(kitted(D.v, nodes, g), g, rT.batch), rT.y)) : null;
    record.kits[record.kits.length - 1].tool = { ok: rT.ok === true, auc: rT.ok ? rT.receipt.a.auc : null, bare, same: rT.ok && rT.receipt.a.auc === bare };
    // twelve forgeries on the first kits of each business
    if (k < FORGED_PER_SET && firstKit) {
      const { r, ch, ac } = firstKit, foreign = await handTo(pick.pick(cards.filter((c) => c.domain !== main.domain)), stranger);
      const otherSet = m.cards.find((c) => setOfDomain(c.domain) !== set), away = await handTo(otherSet, o), extra = await handTo(pick.pick(cards.filter((c) => c.domain === main.domain && c.serial !== main.serial)), o);
      const sold = await verify((await give(D.d, o, stranger.pub)).dossier), soldNode = await verify((await give(N[0].d, o, stranger.pub)).dossier);
      const strangerItem = await verifyItem((await mintApp(stranger, apps, name)).item, apps), chZero = (await kitChallenge(o, D.v, null, 'organ10-0')).challenge, acZero = (await kitAccept(foeO, F.v, null, chZero)).accept;
      const tries = [
        ['a loadout signed by a stranger', async () => loadoutOk(await resign(stranger, lo), D.v, nodes)],
        ['a loadout for the card before a give', () => loadoutOk(lo, sold, nodes)],
        ['a node handed on since it was equipped', () => loadoutOk(lo, D.v, [soldNode, ...nodes.slice(1)])],
        ['a node another key holds', () => equip(o, D.v, [foreign.v])],
        ['a node of another business', () => equip(o, D.v, [away.v])],
        ['more nodes than the slots', () => equip(o, D.v, [...nodes, extra.v, foreign.v, away.v].slice(0, 3))],
        ['the same node twice', () => equip(o, D.v, [nodes[0], nodes[0]])],
        ['a challenge naming another kit', () => kitDuel(sideA, sideF, g, { challenge: chZero, accept: acZero })],
        ['an edited duel score', () => kitRerun({ ...r.receipt, a: { ...r.receipt.a, auc: r.receipt.a.auc + 1 } }, sideA, sideF, g, { challenge: ch, accept: ac })],
        ['a flipped winner', () => kitRerun({ ...r.receipt, winner: r.receipt.winner === 'a' ? 'b' : 'a' }, sideA, sideF, g, { challenge: ch, accept: ac })],
        ['a side fielding nodes with no loadout', () => kitDuel({ v: D.v, loadout: null, nodes }, sideF, g, { challenge: chZero, accept: acZero })],
        ['a tool another key holds', () => equip(o, D.v, nodes, [strangerItem])],
      ];
      for (const [kind, fn] of tries) { const x = await fn(); record.forgeries.push({ set, k, kind, refused: x.ok !== true, why: x.why || null }); }
    }
  }
  // the parties: the business's best genesis card per department, each held by its own owner, then seeded random ones
  const boss = bosses.find((b) => b.set === set), best = Math.max(...admission.departments.filter((d) => d.set === set).flatMap((d) => d.gates));
  const partyOfCards = async (chosen, tag) => {
    const cands = [];
    for (const c of chosen) { const o = await owner('party-' + set + '-' + tag + '-' + c.domain), h = await handTo(c, o); cands.push({ v: h.v, consent: (await consent(o, h.v, partyOf(set))).consent }); }
    const r = await partyStrike(boss, cands, g);
    if (!r.ok) return { set, tag, ok: false, why: r.why };
    const rows = g.ds.testRows, test = milli(auc(rows.map((i) => coupled(r.mesh.coupling, r.mesh.fielded.map((f) => scoreRow(f.mind, g, i)))), rows.map((i) => g.ds.y[i])));
    const again = await checkClear(r.clear, boss, cands, g);
    return { set, tag, ok: true, gate: r.clear.gate, bar: r.clear.bar, barOk: r.clear.bar === Math.max(600000, best) + PARTY_MARGIN, cleared: r.cleared, test, fielded: r.clear.members.length, owners: new Set(r.clear.members.map((x) => x.owner)).size, shares: r.clear.members.reduce((s, x) => s + x.share, 0), rerun: again.ok === true };
  };
  const top = doms.map((d) => cards.filter((c) => c.domain === d).sort((a, b) => b.gate - a.gate || a.serial - b.serial)[0]);
  record.parties.push({ full: true, ...(await partyOfCards(top, 'best')) });
  for (let j = 0; j < PARTIES; j++) record.parties.push({ full: false, ...(await partyOfCards(doms.map((d) => pick.pick(cards.filter((c) => c.domain === d))), 'r' + j)) });
  console.log(set + ': ' + KITS + ' kits, ' + KITS * DUELS + ' kit duels, ' + (PARTIES + 1) + ' parties');
}

// every app as an item: minted, verified, handed on; five forged bodies of each, re-signed, refused
const im = await owner('item-maker'), ih = await owner('item-holder');
for (const [name, body] of apps) {
  const it = (await mintApp(im, apps, name)).item;
  record.items.minted++;
  if ((await verifyItem(it, apps)).ok) record.items.verified++;
  const handed = (await giveItem(it, im, ih.pub, apps)).item;
  if (handed && (await verifyItem(handed, apps)).owner === ih.pub) record.items.handed++;
  const flip = (h) => h.slice(0, -1) + (h.endsWith('0') ? '1' : '0');
  for (const over of [{ sha: flip(body.sha) }, { run: body.run + '0' }, { tier: body.tier === 'proven' ? 'works' : 'proven' }, { spdx: body.spdx === 'MIT' ? 'GPL-3.0' : 'MIT' }, { page: body.page ? null : 'https://sjgant80-hub.github.io/' + name + '/' }]) {
    const forged = { ...it, events: [await resign(im, it.events[0], { body: { ...body, ...over } })] };
    record.items.forged++;
    if (!(await verifyItem(forged, apps)).ok) record.items.refused++;
  }
}
writeFileSync(new URL('../data/organ-10/record.json', import.meta.url), JSON.stringify(record, null, 1) + '\n');
console.log('organ 10 measured · ' + record.kits.length + ' kits · ' + record.duels.length + ' kit duels · ' + record.forgeries.length + ' forgeries · ' + record.parties.length + ' parties · ' + record.items.minted + ' items');
