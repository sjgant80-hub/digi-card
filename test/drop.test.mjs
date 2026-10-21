// drop.test.mjs — the genesis is planned, searched and sealed the same way every time; decoder #0001's drop receipt
// re-runs the whole drop from its log and the decoder's hash, and is refused the moment either differs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planOf, mintGenesis, decoderHash, dropReceipt, checkDrop, demoMaker, genesisSeeds, themeOf, THEMES, BAR, DEMO_PHRASE, DROP_KEYS } from '../src/drop.mjs';
import { organOf, searchOf, mindOf } from '../src/mind.mjs';
import { viewOf } from '../src/data.mjs';
import { verify, give, facts } from '../src/dossier.mjs';
import { empty, record, hashOf } from '../src/registry.mjs';
import { open } from '../vendor/dex-frontier/vendor/living-seed/src/genome.mjs';
import { fromSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { key, toy, SMALL } from './helpers.mjs';

const ground = toy();
const searched = (domain, seed, bar = BAR) => organOf(searchOf(domain, seed, SMALL), viewOf(ground, domain), bar);
/** the k-th live search on a department (seeds 1, 2, … in order): the drop keeps only minds that clear the bar */
const live = (domain, k = 0) => { for (let s = 1, n = 0; ; s++) { const o = searched(domain, s); if (o.state === 'live' && n++ === k) return o; } };

test('the plan: serial 1 is the decoder; serials 2 to the total go to the departments in turn', () => {
  assert.deepEqual(planOf(['a', 'b', 'c'], 6), [{ serial: 2, domain: 'a' }, { serial: 3, domain: 'b' }, { serial: 4, domain: 'c' }, { serial: 5, domain: 'a' }, { serial: 6, domain: 'b' }]);
  assert.deepEqual(planOf(['a'], 1), []); assert.deepEqual(planOf(['a'], 0), []); assert.deepEqual(planOf([], 9), []); assert.deepEqual(planOf('a', 9), []);
  assert.equal(planOf(['a', 'b'], 1000).length, 999);
  assert.deepEqual([themeOf(1), themeOf(2), themeOf(3), THEMES], ['blockcraft-v1', 'synthwave-v1', 'blockcraft-v1', ['synthwave-v1', 'blockcraft-v1']]);
  assert.deepEqual(genesisSeeds('credit-collections', 4), genesisSeeds('credit-collections', 4));
  assert.notDeepEqual(genesisSeeds('credit-collections', 2), genesisSeeds('credit-payments', 2));
  assert.equal(BAR, 0.6); assert.equal(DEMO_PHRASE, 'digi-card/genesis/demo-maker');
});

test('a genesis card: the mind a search found, sealed by the maker and issued to the maker, with the manifest’s line', async () => {
  const maker = await demoMaker(), again = await fromSeed(sha256Bytes(utf8(DEMO_PHRASE)));
  assert.equal(maker.pub, again.pub, 'the demo maker is the public phrase’s key');
  const organ = live('toy-a'), m = await mintGenesis(organ, { found: 'the search', serial: 7, keys: maker });
  assert.ok(m.ok, m.why);
  const v = await verify(m.dossier), g = await open(m.dossier.genome);
  assert.deepEqual([v.ok, v.owner, v.maker, v.serial, v.theme, v.generation], [true, maker.pub, maker.pub, 7, 'blockcraft-v1', 0]);
  assert.deepEqual([g.fields.name, g.fields.parents, g.fields.gate.auc, g.fields.organs], ['toy-a', [], 0.6, [organ.fixed]]);
  assert.deepEqual(m.entry, { serial: 7, card: v.id, domain: 'toy-a', found: 'the search', recipe: organ.fixed, gate: organ.gate });
  assert.equal(mindOf(v, ground).gate, organ.gate, 'the card’s mind is the one the manifest declares');
  assert.deepEqual(facts(v).stage, 0);
  const twice = await mintGenesis(live('toy-a'), { found: 'the search', serial: 7, keys: maker });
  assert.deepEqual(twice.dossier, m.dossier, 'minted the same way every time');
  assert.equal((await mintGenesis({ ...organ, state: 'cut' }, { found: 'x', serial: 8, keys: maker })).why, 'the mind it found does not clear the 0.6 bar on GATE (' + organ.gate + ')');
  assert.equal((await mintGenesis({ ok: false, why: 'x' }, { serial: 8, keys: maker })).why, 'the search did not grow a mind here');
  assert.equal((await mintGenesis(null, { serial: 8, keys: maker })).why, 'the search did not grow a mind here');
  assert.equal((await mintGenesis({ ...organ, domain: 'Bad Name' }, { serial: 8, keys: maker })).why, 'the genome could not be sealed: the name is lower-case letters, digits and hyphens, at most 32');
  assert.equal((await mintGenesis(organ, { serial: 0, keys: maker })).why, 'the card could not be issued: the serial is a whole number from 1');
});

async function drop() {
  const maker = await demoMaker();
  let reg = empty();
  for (let k = 0; k < 4; k++) reg = (await record(reg, (await mintGenesis(live(k % 2 ? 'toy-b' : 'toy-a', k >> 1), { found: 'x', serial: k + 2, keys: maker })).dossier)).reg;
  const files = { 'src/card.mjs': 'aa', 'src/dossier.mjs': 'bb' };
  return { maker, reg, files, receipt: dropReceipt({ decoder: decoderHash(files), log: reg.head, cards: reg.log.length }) };
}

test('decoder #0001’s receipt names the decoder and the drop log’s head; re-running it replays the drop from nothing', async () => {
  const { maker, reg, files, receipt } = await drop();
  assert.deepEqual(Object.keys(receipt).sort(), DROP_KEYS);
  assert.deepEqual(receipt, { kind: 'drop', decoder: decoderHash(files), log: hashOf(reg.log[3]), cards: 4 });
  assert.equal(decoderHash({ 'src/dossier.mjs': 'bb', 'src/card.mjs': 'aa' }), receipt.decoder, 'the order files are listed in does not matter');
  assert.notEqual(decoderHash({ ...files, 'src/card.mjs': 'ab' }), receipt.decoder);
  const r = await checkDrop(receipt, { decoder: receipt.decoder, log: reg.log, maker: maker.pub });
  assert.ok(r.ok, r.why); assert.deepEqual(r.reg, reg);
  const later = [...reg.log, { n: 4, junk: true }];
  assert.ok((await checkDrop(receipt, { decoder: receipt.decoder, log: later })).ok, 'entries after the drop’s are not the drop’s');
  assert.ok((await checkDrop({ ...receipt, cards: 1, log: hashOf(reg.log[0]) }, { decoder: receipt.decoder, log: reg.log })).ok, 'a drop of one card');
  const stranger = await key('stranger'), alien = (await mintGenesis(live('toy-a', 2), { found: 'x', serial: 99, keys: stranger })).dossier;
  const mixed = (await record(reg, alien)).reg;
  const bad = {
    'not a drop receipt': [{ ...receipt, extra: 1 }, {}, 'it is not a drop receipt'],
    'a level receipt': [{ ...receipt, kind: 'level' }, {}, 'it is not a drop receipt'],
    'another decoder': [receipt, { decoder: decoderHash({ x: 'y' }), log: reg.log }, 'the decoder this device runs is not the one the drop names'],
    'no decoder': [receipt, { log: reg.log }, 'the decoder this device runs is not the one the drop names'],
    'no log': [receipt, { decoder: receipt.decoder }, 'the drop log does not hold the cards the receipt names'],
    'a short log': [receipt, { decoder: receipt.decoder, log: reg.log.slice(0, 3) }, 'the drop log does not hold the cards the receipt names'],
    'no cards': [{ ...receipt, cards: 0 }, { decoder: receipt.decoder, log: reg.log }, 'the drop log does not hold the cards the receipt names'],
    'half a card': [{ ...receipt, cards: 1.5 }, { decoder: receipt.decoder, log: reg.log }, 'the drop log does not hold the cards the receipt names'],
    'a tampered log': [receipt, { decoder: receipt.decoder, log: [reg.log[0], { ...reg.log[1], prev: reg.log[0].prev }, ...reg.log.slice(2)] }, 'the drop log does not replay: entry 1 is not linked to the one before it'],
    'a shorter drop': [{ ...receipt, cards: 3 }, { decoder: receipt.decoder, log: reg.log }, 'the drop log replays to another head'],
    'another maker in it': [{ ...receipt, cards: 5, log: mixed.head }, { decoder: receipt.decoder, log: mixed.log }, 'the drop’s cards are not all of one maker'],
    'another maker named': [receipt, { decoder: receipt.decoder, log: reg.log, maker: stranger.pub }, 'the drop’s cards are not all of one maker'],
  };
  for (const [what, [rc, opts, why]] of Object.entries(bad)) assert.equal((await checkDrop(rc, opts)).why, why, what);
  assert.equal((await checkDrop(receipt)).why, 'the decoder this device runs is not the one the drop names');
  const gift = (await give((await mintGenesis(live('toy-b', 3), { found: 'x', serial: 50, keys: maker })).dossier, maker, stranger.pub)).dossier;
  const given = (await record(reg, gift)).reg;
  assert.ok((await checkDrop({ ...receipt, cards: 5, log: given.head }, { decoder: receipt.decoder, log: given.log, maker: maker.pub })).ok, 'one maker, even once a card has been handed on');
});
