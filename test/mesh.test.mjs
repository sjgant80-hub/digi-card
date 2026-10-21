// mesh.test.mjs — owned cards join a mesh only by their owner's consent for the card as it stands; the mesh fields the
// best-proven card per department and couples them; each card's share is measured, sums to a million, and every credit
// in the ledger replays from the shares.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consent, consentOk, assemble, ask, work, tally, sharesOf, entryHash, CONSENT, MAX_MEMBERS, ZERO } from '../src/mesh.mjs';
import { organOf, mindOf, fixedOf, searchOf, caseAt } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { verify, give } from '../src/dossier.mjs';
import { stemGenome } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sign } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';
import { key, toy, SMALL, cardOn } from './helpers.mjs';

const ground = toy();
const found = (domain, seed, g = ground) => organOf(searchOf(domain, seed, SMALL), viewOf(g, domain), 0.6).fixed;

async function town() {
  const [maker, alice, bob, carol] = await Promise.all(['maker', 'alice', 'bob', 'carol'].map(key));
  const A = await cardOn([found('toy-a', 5)], { maker, owner: alice, name: 'toy-a' });
  const B = await cardOn([found('toy-b', 6)], { maker, owner: bob, name: 'toy-b', serial: 2 });
  const C = await cardOn([fixedOf('toy-a', 1, { ...stemGenome(), on: 1 })], { maker, owner: carol, name: 'toy-a-weak', serial: 3 });
  return { maker, alice, bob, carol, A, B, C };
}
const joinWith = async (keys, card, mesh = 'toy-mesh') => ({ v: card.v, consent: (await consent(keys, card.v, mesh)).consent });

test('consent: signed by the owner, for this mesh, for this card as it stands — anything else is refused by name', async () => {
  const { alice, bob, A, B } = await town();
  const c = (await consent(alice, A.v, 'toy-mesh')).consent;
  assert.deepEqual(Object.keys(c).sort(), ['by', 'card', 'head', 'kind', 'mesh', 'sig']);
  assert.deepEqual([c.kind, c.mesh, c.card, c.head, c.by], [CONSENT, 'toy-mesh', A.v.id, A.v.head, alice.pub]);
  assert.deepEqual(await consentOk(c, A.v, 'toy-mesh'), { ok: true });
  assert.equal((await consent(bob, A.v, 'toy-mesh')).why, 'only the card’s owner consents for it');
  assert.equal((await consent(alice, { ok: false }, 'toy-mesh')).why, 'only the card’s owner consents for it');
  for (const m of ['Toy', '', 'a'.repeat(33), 5]) assert.equal((await consent(alice, A.v, m)).why, 'a mesh is named in lower-case letters, digits and hyphens, at most 32', String(m));
  const sold = await verify((await give(A.d, alice, bob.pub)).dossier);
  const forged = { ...c, by: bob.pub }, resigned = { ...forged, sig: await sign(bob, utf8(canonical({ kind: c.kind, mesh: c.mesh, card: c.card, head: c.head, by: bob.pub }))) };
  const bad = {
    'not a consent': [{ ...c, extra: 1 }, A.v, 'not a consent'],
    'another kind': [{ ...c, kind: 'digi.consent.v2' }, A.v, 'not a consent'],
    'nothing': [null, A.v, 'not a consent'],
    'another mesh': [c, A.v, 'the consent is for another mesh', 'other-mesh'],
    'another card': [c, B.v, 'the consent is for another card'],
    'an earlier life': [c, sold, 'the consent was given for an earlier life of the card: its owner must consent again'],
    'not the owner’s': [resigned, A.v, 'the consent is not its owner’s'],
    'a changed signer': [{ ...c, sig: c.sig.replace(/^./, (x) => (x === '0' ? '1' : '0')) }, A.v, 'the consent’s signature does not check'],
    'a short signature': [{ ...c, sig: 'ab' }, A.v, 'the consent’s signature does not check'],
  };
  for (const [what, [x, v, why, mesh = 'toy-mesh']] of Object.entries(bad)) assert.equal((await consentOk(x, v, mesh)).why, why, what);
  const anew = (await consent(bob, sold, 'toy-mesh')).consent;
  assert.deepEqual(await consentOk(anew, sold, 'toy-mesh'), { ok: true }, 'the new owner consents anew');
});

test('assemble: the best-proven card per department joins; the rest stand by, each with its reason; the mesh beats its best member', async () => {
  const { maker, alice, bob, carol, A, B, C } = await town();
  const cut = await cardOn([found('toy-a', 5)], { maker, owner: alice, name: 'toy-a-cut', bar: 0.99, serial: 4 });
  const coin = await cardOn([fixedOf('toy-b', 1, { ...stemGenome(), on: 0 })], { maker, owner: bob, name: 'toy-coin', bar: 0.5, serial: 5 });
  const away = await cardOn([fixedOf('credit-customer', 1, stemGenome())], { maker, owner: carol, name: 'credit-customer', serial: 6 });
  const m = await assemble('toy-mesh', [await joinWith(alice, A), await joinWith(bob, B), await joinWith(carol, C), await joinWith(alice, cut), await joinWith(bob, coin), await joinWith(carol, away), await joinWith(alice, A), { v: B.v, consent: (await consent(bob, B.v, 'other')).consent }, { v: { ok: false } }], ground);
  assert.ok(m.ok, m.why);
  const by = Object.fromEntries(m.members.filter((x) => x.card).map((x) => [x.card + (x.why === 'the card is already a candidate' ? '*' : ''), x]));
  assert.deepEqual([by[A.v.id].joined, by[B.v.id].joined, by[C.v.id].joined], [true, true, false]);
  assert.equal(by[C.v.id].why, 'a better-proven card fields toy-a');
  assert.equal(by[cut.v.id].why, 'it has no live mind on this ground');
  assert.match(by[coin.v.id].why, /^it does not lead a coin on GATE \(bound -?\d/);
  assert.equal(by[away.v.id].why, 'it has no live mind on this ground');
  assert.equal(by[A.v.id + '*'].why, 'the card is already a candidate');
  assert.equal(m.members.find((x) => x.card === null).why, 'the card does not check');
  assert.equal(m.members.length, 9);
  const ga = mindOf(A.v, ground).gate, gb = mindOf(B.v, ground).gate;
  assert.deepEqual(m.fielded.map((f) => f.card), ga > gb || (ga === gb && A.v.id < B.v.id) ? [A.v.id, B.v.id] : [B.v.id, A.v.id], 'best-proven first, ties to the lower id');
  assert.equal(by[B.v.id + '*'].why, 'the card is already a candidate');
  assert.equal(m.best, Math.max(mindOf(A.v, ground).gate, mindOf(B.v, ground).gate));
  assert.ok(m.gate > m.best, 'two departments, each half the signal: the mesh beats its best member out of fold (' + m.gate + ' vs ' + m.best + ')');
  const joined = m.members.filter((x) => x.joined);
  assert.equal(joined.reduce((s, x) => s + x.share, 0), 1e6);
  assert.ok(joined.every((x) => x.contribution > 0 && x.share > 0));
  assert.ok(m.members.filter((x) => !x.joined).every((x) => x.share === undefined));
  assert.equal(by[A.v.id].domains, 'toy-a'); assert.equal(by[A.v.id].owner, alice.pub);
  const solo = await assemble('toy-mesh', [await joinWith(alice, A)], ground);
  assert.deepEqual([solo.fielded.length, solo.gate, solo.members[0].share, solo.members[0].contribution], [1, solo.members[0].contribution + 500000, 1e6, solo.gate - 500000], 'alone, a card is worth what it adds over a coin');
});

test('assemble refuses a mesh that cannot be, and fields at most MAX_MEMBERS', async () => {
  const { alice, bob, A, C } = await town();
  assert.equal((await assemble('Bad Name', [await joinWith(alice, A)], ground)).why, 'a mesh is named in lower-case letters, digits and hyphens, at most 32');
  assert.equal((await assemble('toy-mesh', [], ground)).why, 'a mesh needs at least one card');
  assert.equal((await assemble('toy-mesh', 'x', ground)).why, 'a mesh needs at least one card');
  assert.equal((await assemble('toy-mesh', [{ v: C.v, consent: null }, { v: A.v, consent: (await consent(alice, A.v, 'elsewhere')).consent }], ground)).why, 'no card can join: not a consent; the consent is for another mesh');
  // thirteen cards, each a different set of four departments' minds: all able, so the thirteenth is turned away
  const wide = toy({ departments: ['a', 'b', 'c', 'd'], n: 800, seed: 5 }), maker = await key('maker');
  const mind = Object.fromEntries('abcd'.split('').map((d) => [d, organOf(searchOf('toy-' + d, 2, SMALL), viewOf(wide, 'toy-' + d), 0.5).fixed]));
  const sets = Array.from({ length: 15 }, (_, k) => 'abcd'.split('').filter((_, j) => ((k + 1) >> j) & 1)).slice(0, 13);
  const cards = [];
  for (const [k, set] of sets.entries()) cards.push(await cardOn(set.map((d) => mind[d]), { maker, owner: bob, name: 'toy-s' + k, bar: 0.5, serial: k + 1 }));
  const m = await assemble('wide', await Promise.all(cards.map((c) => joinWith(bob, c, 'wide'))), wide);
  assert.equal(m.fielded.length, MAX_MEMBERS);
  assert.deepEqual(m.members.filter((x) => !x.joined).map((x) => x.why), ['the mesh fields at most 12 cards']);
  const turned = m.members.find((x) => !x.joined);
  assert.ok(m.members.filter((x) => x.joined).every((x) => x.gate > turned.gate || (x.gate === turned.gate && x.card < turned.card)), 'the least-proven is the one turned away');
  assert.equal(MAX_MEMBERS, 12);
});

test('ask: the members answer and the mesh couples what it hears; a member that cannot read the case says nothing', async () => {
  const { alice, bob, A, B } = await town();
  const m = await assemble('toy-mesh', [await joinWith(alice, A), await joinWith(bob, B)], ground);
  const x = caseAt(ground, ground.ds.testRows[0]), a = ask(m, x);
  assert.deepEqual([a.verdict, a.heard, a.members.length], ['VERIFIED', 2, 2]);
  const c = m.coupling, z = a.members.reduce((s, r, k) => s + c.weights[k + 1] * ((r.score - c.mean[k]) / c.sd[k]), c.weights[0]);
  assert.equal(a.score, Math.round(z * 1e6) / 1e6);
  const half = ask(m, { a1: x.a1, a2: x.a2 });
  assert.equal(half.heard, 1);
  const k = m.fielded.findIndex((f) => f.card === A.v.id), heard = half.members[k];
  assert.equal(heard.verdict, 'VERIFIED');
  assert.equal(half.score, Math.round((c.weights[0] + c.weights[k + 1] * ((heard.score - c.mean[k]) / c.sd[k])) * 1e6) / 1e6, 'the silent member’s term is left out');
  const none = ask(m, {});
  assert.deepEqual([none.verdict, none.why], ['ABSTAIN', 'no member of the mesh can answer this case']);
});

test('the ledger: each job credits owners cases × share; it is a chain; a replay recomputes every credit from the shares', async () => {
  const { alice, bob, A, B } = await town();
  const m = await assemble('toy-mesh', [await joinWith(alice, A), await joinWith(bob, B)], ground);
  const share = (owner) => m.members.find((x) => x.owner === owner && x.joined).share;
  let log = [];
  const w1 = work(m, log, { job: 'march', cases: 100 });
  assert.deepEqual(w1.entry, { n: 0, prev: ZERO, mesh: 'toy-mesh', job: 'march', cases: 100, credits: { [alice.pub]: 100 * share(alice.pub), [bob.pub]: 100 * share(bob.pub) } });
  log = w1.log;
  const w2 = work(m, log, { job: 'april', cases: 7 });
  assert.equal(w2.entry.prev, entryHash(w1.entry)); log = w2.log;
  const t = tally(log, m);
  assert.deepEqual(t, { ok: true, totals: { [alice.pub]: 107 * share(alice.pub), [bob.pub]: 107 * share(bob.pub) } });
  assert.equal(Object.values(t.totals).reduce((a, b) => a + b, 0), 107 * 1e6, 'every case’s million is shared out, exactly');
  assert.deepEqual(tally(log), t, 'without the mesh, the chain alone');
  const bad = {
    'a raised credit': [[log[0], { ...log[1], credits: { ...log[1].credits, [alice.pub]: log[1].credits[alice.pub] + 1 } }], 'entry 1’s credits are not what the mesh’s shares give'],
    'a dropped entry': [[log[1]], 'entry 0 is not linked to the one before it'],
    'a broken link': [[log[0], { ...log[1], prev: ZERO }], 'entry 1 is not linked to the one before it'],
    'an extra field': [[{ ...log[0], note: 1 }], 'entry 0 is not a ledger entry'],
    'credits not a record': [[{ ...log[0], credits: [1] }], 'entry 0 is not a ledger entry'],
    'a fraction of a credit': [[{ ...log[0], credits: { x: 0.5 } }], 'entry 0 is not a ledger entry'],
    'nothing': [[null], 'entry 0 is not a ledger entry'],
  };
  for (const [what, [l, why]] of Object.entries(bad)) assert.equal(tally(l, m).why, why, what);
  assert.equal(tally('x').why, 'not a ledger'); assert.deepEqual(tally([]), { ok: true, totals: {} });
  for (const [opts, why] of [[{ job: 'Bad', cases: 1 }, 'a job is named in lower-case letters, digits and hyphens, at most 32'], [{ job: 'j', cases: 0 }, 'a job is 1 to 1,000,000 answered cases'], [{ job: 'j', cases: 1e6 + 1 }, 'a job is 1 to 1,000,000 answered cases'], [{ job: 'j', cases: 1.5 }, 'a job is 1 to 1,000,000 answered cases']]) assert.equal(work(m, [], opts).why, why);
  assert.ok(work(m, [], { job: 'j', cases: 1e6 }).ok); assert.equal(work(m, 'x', { job: 'j', cases: 1 }).why, 'not a ledger');
});

test('shares: the positive contributions’ parts in millionths, summing to exactly a million, ties to the earlier card', () => {
  assert.deepEqual(sharesOf([1, 1, 1]), [333334, 333333, 333333]);
  assert.deepEqual(sharesOf([2, 1]), [666667, 333333]);
  assert.deepEqual(sharesOf([5, -3, 0]), [1e6, 0, 0]);
  assert.deepEqual(sharesOf([0, -1]), [0, 0]);
  assert.deepEqual(sharesOf([]), []);
  assert.deepEqual(sharesOf([1, 2, 4]), [142857, 285714, 571429]);
  for (const c of [[3, 7, 11, 13], [1, 1, 1, 1, 1, 1, 1], [999, 1]]) assert.equal(sharesOf(c).reduce((a, b) => a + b, 0), 1e6);
});
