#!/usr/bin/env node
// tools/measure-5.mjs — organ 5, TRADE AND OWNERSHIP, measured as tools/seal-5.mjs sealed it. Writes data/organ-5/record.json.
import { writeFileSync } from 'node:fs';
import { give, verify } from '../src/dossier.mjs';
import { dossierOf, record, replay, ownerOf } from '../src/registry.mjs';
import { mindOf } from '../src/mind.mjs';
import { demoMaker } from '../src/drop.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { drop, ground, setOfDomain, owner, sampler } from './lib.mjs';

const { m, reg: dropReg, decoder, glog } = await drop(), maker = await demoMaker(), S = sampler(2026);
const owners = await Promise.all(Array.from({ length: 200 }, (_, k) => owner('trade-' + k))), keyOf = Object.fromEntries(owners.map((o) => [o.pub, o]));
let reg = dropReg, honest = 0, recorded = 0, doubles = 0, doubleRefused = 0, firstKept = 0, forged = 0, forgedRefused = 0;
const lastBuyer = {}, cards = m.cards.map((c) => c.card), forkWhy = [];
const rec = async (d) => record(reg, d);
for (const [k, id] of cards.entries()) {
  const to = owners[k % owners.length], r = await give(dossierOf(reg, id), maker, to.pub);
  honest++;
  const x = await rec(r.dossier);
  if (x.ok) { recorded++; reg = x.reg; lastBuyer[id] = to.pub; }
}
console.log('organ 5 · handed out ' + recorded + ' cards; trading…');
for (let t = 0; t < 2400; t++) {
  const id = S.pick(cards), d = dossierOf(reg, id), holder = keyOf[ownerOf(reg, id)];
  if (t % 8 === 3 && forged < 100) {   // a give signed by someone who does not own it
    const thief = owners.find((o) => o.pub !== holder.pub && o !== owners[t % owners.length]) || owners[0];
    const g = await give(d, holder, thief.pub), e = g.dossier.events[g.dossier.events.length - 1];
    const fake = { ...g.dossier, events: [...d.events, { ...e, by: thief.pub }] };
    forged++;
    if (!(await rec(fake)).ok) forgedRefused++;
    continue;
  }
  if (t % 8 === 5 && doubles < 300) {   // one life signed to two buyers: the first recorded wins
    const b1 = S.pick(owners), b2 = S.pick(owners.filter((o) => o.pub !== b1.pub));
    const g1 = await give(d, holder, b1.pub), g2 = await give(d, holder, b2.pub);
    const x1 = await rec(g1.dossier);
    if (x1.ok) { reg = x1.reg; lastBuyer[id] = b1.pub; honest++; recorded++; }
    const x2 = await rec(g2.dossier);
    doubles++;
    if (!x2.ok && /^this card’s life parts from the one on record at event \d+/.test(x2.why)) { doubleRefused++; if (forkWhy.length < 3) forkWhy.push(x2.why); }
    if (ownerOf(reg, id) === b1.pub) firstKept++;
    continue;
  }
  if (honest >= cards.length + 2000) continue;
  const to = S.pick(owners.filter((o) => o.pub !== holder.pub)), g = await give(d, holder, to.pub);
  honest++;
  const x = await rec(g.dossier);
  if (x.ok) { recorded++; reg = x.reg; lastBuyer[id] = to.pub; }
}
const owned = cards.filter((id) => ownerOf(reg, id) === lastBuyer[id]).length;
const t0 = performance.now(), again = await replay(reg.log, { rerun: (rc) => (rc.kind === 'drop' ? import('../src/drop.mjs').then(({ checkDrop }) => checkDrop(rc, { decoder, log: glog, maker: m.maker })) : { ok: false, why: 'no levels in this organ' }) }), replayMs = Math.round(performance.now() - t0);
const same = again.ok && canonical({ c: again.reg.cards, s: again.reg.serials, h: again.reg.head }) === canonical({ c: reg.cards, s: reg.serials, h: reg.head });
let mindSame = 0;
const traded = cards.filter((id) => reg.cards[id].events.length > 2).slice(0, 50);
for (const id of traded) {
  const v = await verify(dossierOf(reg, id)), c = m.cards.find((x) => x.card === id), g = await ground(setOfDomain(c.domain));
  if (mindOf(v, g).gate === c.gate) mindSame++;
}
const out = { kind: 'digi-card.organ-5.record', v: 1, owners: owners.length, cards: cards.length, honest, recorded, ownedByLastBuyer: owned, doubles, doubleRefused, firstKept, forkWhy, forged, forgedRefused,
  replay: { ok: again.ok, same, entries: reg.log.length, ms: replayMs }, mind: { traded: traded.length, same: mindSame } };
writeFileSync(new URL('../data/organ-5/record.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('honest ' + recorded + '/' + honest + ' · doubles refused ' + doubleRefused + '/' + doubles + ' · forged refused ' + forgedRefused + '/' + forged + ' · replay ' + reg.log.length + ' entries in ' + replayMs + ' ms, same ' + same + ' · minds ' + mindSame + '/' + traded.length);
