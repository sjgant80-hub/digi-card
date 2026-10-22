// copy.test.mjs — the words DIGI's copy never uses: every money word, KCC, an airdrop, a currency sign, alive and living
// are refused; only the gate's own senses pass; quoted seals, sources and the gate's word list are read past; organ 10
// is never quoted without its caveat; and the Kit never offers the money side or the ledger's own apps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyHits, organ10Bare, pageText, offered, shownDesc, sayOutcome, LEFT_OUT, CAVEAT_10, SAID_OUTCOME, SHOWN_AS, ORGANS } from '../src/copy.mjs';
import { readdirSync, existsSync } from 'node:fs';
import { SETS } from '../src/data.mjs';

const words = (t) => copyHits(t).map((h) => h.word.toLowerCase());

test('every money word, KCC, an airdrop, a currency sign, alive and living is refused', () => {
  for (const w of ['earn', 'earns', 'earned', 'earning', 'earnings', 'earner', 'earners', 'sell', 'sells', 'selling', 'seller', 'sellers', 'sold', 'buy', 'buys', 'buying', 'buyer', 'buyers', 'bought', 'worth', 'price', 'prices', 'priced', 'pricing', 'alive', 'living', 'kcc', 'KCC', 'airdrop', 'airdrops'])
    assert.deepEqual(words('a card ' + w + ' here'), [w.toLowerCase()], w);
  assert.deepEqual(words('it costs $5'), ['$']);
  assert.deepEqual(words('unearned sellotape buyout worthy priceless livings alive-ish'), ['alive'], 'whole words only');
  assert.deepEqual(copyHits('sold twice')[0], { word: 'sold', context: 'sold twice' });
  const long = 'x '.repeat(40) + 'sold' + ' y'.repeat(40), h = copyHits(long)[0];
  assert.equal(h.context, ('x '.repeat(25) + 'sold' + ' y'.repeat(25)).trim(), 'fifty characters either side');
  for (const junk of [null, undefined, 5, {}, []]) assert.deepEqual(copyHits(junk), []);
});

test('only the gate’s own senses pass', () => {
  for (const ok of ['every level it earned', 'Levels earned on it name its hash', 'a level is earned, never printed', '3 levels earned so far', 'rarity is earned',
    'built on living-seed', 'the National Living Wage floor', 'it never says a DIGI is self-aware, conscious or alive', 'it never claims a DIGI is self-aware, conscious or alive', 'it never says a Kardling is self-aware, conscious or alive', 'it never claims a Kardling is self-aware, conscious or alive',
    'computed by the kernel from published prices, each sourced and dated', 'Every price is read from data/prices.lock.json (copied from the estate’s price registry, each',
    'Every price this case reads, with its source', 'the cost case, from sourced prices only'])
    assert.deepEqual(words(ok), [], ok);
  assert.deepEqual(words('a level: then it earned credit'), ['earned'], 'a level across a stop is not the level sense');
  assert.deepEqual(words('the level of the thing that is very far away from where it all earned'), ['earned'], 'nor forty characters away');
  assert.deepEqual(words('it earned rarity'), ['earned']);
  assert.deepEqual(words('a level is earned, and then it earned credit'), ['earned'], 'a word after an allowed sense is not inside it');
  assert.deepEqual(words('it earned credit, then a level is earned'), ['earned'], 'nor one before it');
  assert.deepEqual(words('a DIGI is alive'), ['alive'], 'only the denial passes');
  assert.deepEqual(words('when consumer price index is above 93.2'), [], 'the bank’s named statistic is said by its name');
  assert.deepEqual(words('the price index'), ['price'], 'only the whole name: a price index alone is still a price');
  assert.deepEqual(words('consumer price'), ['price'], 'and a consumer price is a price');
  assert.deepEqual(words('a Kardling is alive'), ['alive'], 'only the denial passes, under the game\'s new name too');
  assert.deepEqual(words('every price is read here'), ['price']);
});

test('organ 10’s results are never quoted without its caveat on the same line', () => {
  assert.equal(CAVEAT_10, 'not fully blind: dry-run before the seal; see Proof');
  for (const bare of ['| 10 · the kit and the party | 100/100 kits measure the same twice |', 'organ 10 held 10 of 10', 'in organ 10, 81.9% of duels', 'organ 10 measures — sealed before it ran — whether', 'Ten organs, each sealed before it was measured, are in Proof', 'ten organs each sealed before it was measured'])
    assert.equal(organ10Bare(bare).length, 1, bare);
  for (const ok of ['| 10 · the kit and the party (' + CAVEAT_10 + ') | 100/100 kits |', 'Ten organs, each sealed before it was measured (organ 10 is ' + CAVEAT_10 + ')', 'organ 10 is in Proof', 'organ 1 held 6 of 6', 'organ 100 held 3 of 3'])
    assert.deepEqual(organ10Bare(ok), [], ok);
  assert.equal(organ10Bare('organ 10 held 10 of 10\n(' + CAVEAT_10 + ')').length, 1, 'the caveat must be on the same line');
  assert.equal(organ10Bare('(' + CAVEAT_10 + ')\norgan 10 held 10 of 10').length, 1, 'not the line before');
  assert.deepEqual(organ10Bare('a\norgan 10 held 10 of 10 (' + CAVEAT_10 + ')\nb'), []);
  assert.equal(organ10Bare('organ 10 held 10 of 10. organ 10 won 81.9%').length, 1, 'one line, one quote, read lazily');
  for (const junk of [null, 7, {}]) assert.deepEqual(organ10Bare(junk), []);
});

test('a page’s words as it shows them: one block a line, nothing quoted', () => {
  assert.equal(pageText('<p>one <b>two</b></p><p>three</p>'), ' one two\nthree\n');
  assert.equal(pageText('<script>sold()</script><style>.x{}</style><!-- sold --><p>kept</p>'), ' kept\n');
  for (const q of ['sealed', 'sourced', 'gate']) assert.equal(pageText('<p>a <span data-quote="' + q + '">the last buyer</span> b</p>'), ' a b\n', q);
  assert.equal(pageText('<p>a <span data-quote="other">sold</span></p>'), ' a sold\n', 'only those three are quotes');
  assert.equal(pageText('<td data-quote="sealed">x <b>y</b> z</td><td>w</td>'), ' w ');
  assert.equal(pageText('<h3>T</h3><li>l</li><dt>d</dt><dd>e</dd><tr>r</tr><summary>s</summary><text>t</text>'), ' T\nl\nd\ne\nr\ns\nt\n');
  assert.equal(pageText('<p>a&nbsp;b &lt;c&gt; d&#39;e f&rsquo;g &amp;lt;</p>'), ' a b <c> d’e f’g &lt;\n', 'entities, &amp; last');
  assert.equal(pageText('<p>a\n  b</p>\n\n<p>c</p>'), ' a b\nc\n');
  for (const junk of [null, 3, {}]) assert.equal(pageText(junk), '');
});

test('the Kit never offers the money side or the ledger’s own apps, and shows a description only in DIGI’s words', () => {
  assert.deepEqual(LEFT_OUT, ['agora', 'fallherd']);
  assert.ok(Object.isFrozen(LEFT_OUT));
  for (const no of ['agora', 'fallherd', 'kcc-mesh', 'kcc-mint', 'KCC-jobs', 'kcc-', 5, null]) assert.equal(offered(no), false, String(no));
  for (const yes of ['earned', 'couple-gate', 'mykcc-x', 'agora2', 'fall-herd']) assert.equal(offered(yes), true, yes);
  assert.equal(shownDesc('A linter for couplings.'), 'A linter for couplings.');
  assert.equal(shownDesc('classify a coupling as sovereign (alive) or dead'), '');
  for (const junk of [null, 5, {}]) assert.equal(shownDesc(junk), '');
});

test('every business is asked in DIGI’s words, and organs 4 and 5 are shown by plain names beside their sealed titles', () => {
  assert.deepEqual(SAID_OUTCOME, { shop: 'made a purchase', adult: 'has an income over 50K a year' });
  for (const set of Object.keys(SETS)) assert.deepEqual(copyHits(sayOutcome(set, SETS[set].outcome)), [], set + ': ' + sayOutcome(set, SETS[set].outcome));
  assert.deepEqual([sayOutcome('shop', 'bought'), sayOutcome('telco', 'left the company'), sayOutcome('constructor', 'x'), sayOutcome('toString', 'y')], ['made a purchase', 'left the company', 'x', 'y']);
  assert.ok(Object.isFrozen(SAID_OUTCOME) && Object.isFrozen(SHOWN_AS));
  assert.deepEqual(SHOWN_AS, { 4: 'fusion', 5: 'giving and ownership' });
});

test('ORGANS is every organ sealed on disk, so the Proof screen never reads fewer than there are', () => {
  const data = new URL('../data/', import.meta.url);
  const sealed = readdirSync(data).filter((d) => /^organ-\d+$/.test(d) && existsSync(new URL(d + '/prereg.json', data)));
  assert.equal(ORGANS, sealed.length);
  assert.ok(sealed.every((d) => Number(d.slice(6)) <= ORGANS), 'numbered 1 to ORGANS, none past it');
});
