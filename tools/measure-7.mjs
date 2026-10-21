#!/usr/bin/env node
// tools/measure-7.mjs — organ 7, THE DROP AND THE CLAIM GATE, measured as tools/seal-7.mjs sealed it. Writes data/organ-7/record.json.
import { writeFileSync } from 'node:fs';
import { cardOf, readCard } from '../src/card.mjs';
import { give, verify } from '../src/dossier.mjs';
import { dossierOf, record, replay } from '../src/registry.mjs';
import { mindOf } from '../src/mind.mjs';
import { gate, PAGE } from '../src/claims.mjs';
import { checkDrop, demoMaker } from '../src/drop.mjs';
import { paintArt } from '../vendor/pixelwhisperer/kards/kardart.mjs';
import { probeOffline } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { drop, ground, setOfDomain, owner } from './lib.mjs';
import { checkers } from './checkers.mjs';
import { DRAFTS } from './posts.mjs';

const paint = (f, t, w, h) => paintArt(f, t, w, h);
const { m, reg, decoder, glog, log } = await drop(), maker = await demoMaker(), C = checkers();
const first = dossierOf(reg, m.first.card), receipt = first.events[1].receipt, dr = await checkDrop(receipt, { decoder, log: glog, maker: m.maker });
const dropRun = { ok: dr.ok, why: dr.why || null, cards: receipt.cards, decoderMatches: decoder === receipt.decoder && decoder === m.decoder.hash };
const posts = [];
for (const d of DRAFTS(m)) {
  let p = d;
  if (d.text.includes('{mesh}')) { const r = await C.mesh(d.claims[0]); p = { ...d, text: d.text.replace('{mesh}', r.says[0] + ' cards score ' + r.says[1] + ' on cases none grew on, against ' + r.says[2] + ' for the best of them alone') }; }
  const g = await gate(p, C);
  posts.push({ text: p.text, ok: g.ok, why: g.why || null });
}
const base = 'Decoder #0001 is out. Re-run it yourself: ' + PAGE, claim = [{ kind: 'drop' }];
const OVERREACH = {
  'self-aware': base + ' It is self-aware.', conscious: base + ' A conscious card.', alive: base + ' Your card is alive.', AGI: base + ' The first AGI card.',
  price: base + ' Price drops soon.', 'a currency sign': base + ' Worth $5 already.', investment: base + ' A smart investment.', guaranteed: base + ' Results guaranteed.',
  'the moon': base + ' To the moon.', 'an unvouched number': base + ' 37 owners joined today.', 'no link': 'Decoder #0001 is out. Re-run it yourself.', 'no re-run': 'Decoder #0001 is out: ' + PAGE,
};
const refusals = {};
for (const [name, text] of Object.entries(OVERREACH)) { const g = await gate({ text, claims: claim }, C); refusals[name] = g.ok ? 'PASSED' : g.why; }
let claimed = 0, read = 0, recorded = 0, owned = 0, grown = 0, trapped = 0;
const claimantReg = await replay(log, { rerun: (rc) => checkDrop(rc, { decoder, log: glog, maker: m.maker }) });
let creg = claimantReg.reg;
for (let serial = 2; serial <= 101; serial++) {
  const c = m.cards.find((x) => x.serial === serial), me = await owner('claimant-' + serial);
  const r = await give(dossierOf(creg, c.card), maker, me.pub);
  if (!r.ok) continue;
  claimed++;
  const png = (await cardOf(r.dossier, paint)).png, back = await readCard(png, paint);
  if (!back.ok) continue;
  read++;
  const x = await record(creg, back.dossier);
  if (x.ok) { recorded++; creg = x.reg; }
  if (back.owner === me.pub && creg.cards[c.card].owner === me.pub) owned++;
  const g = await ground(setOfDomain(c.domain)), p = probeOffline(() => mindOf(back.v, g));
  if (p.ok && !p.networkTouched) trapped++;
  if (p.ok && p.result.gate === c.gate) grown++;
}
const out = { kind: 'digi-card.organ-7.record', v: 1, drop: dropRun, posts, refusals, cardMe: { claimed, read, recorded, owned, grown, trapped } };
writeFileSync(new URL('../data/organ-7/record.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('drop ' + (dr.ok ? 're-runs' : 'FAILS: ' + dr.why) + ' · posts ' + posts.filter((p) => p.ok).length + '/' + posts.length + ' pass · overreach refused ' + Object.values(refusals).filter((w) => w !== 'PASSED').length + '/12 · card me ' + grown + '/' + claimed);
