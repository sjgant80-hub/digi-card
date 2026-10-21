// cost.test.mjs — the cost case reads only the price lock and its inputs: by hand at the wage floor, rented at the
// cheapest model's published rates, the card at the chip's rated power and the published electricity price.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { costCase, pricesOf, cheapest, tokensOf, YEARS } from '../src/cost.mjs';

const lock = JSON.parse(readFileSync(new URL('../data/prices.lock.json', import.meta.url), 'utf8'));
const inputs = { cases: 30000, minutes: 1, tokensIn: 400, tokensOut: 5, ms: 0.02 };
const close = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), what + ': ' + a + ' vs ' + b);

test('every price comes from the lock, each with its source and the date it was checked', () => {
  const L = pricesOf(lock);
  assert.ok(L.ok);
  for (const e of lock.entries) { assert.match(e.source, /^https:\/\//, e.id); assert.match(e.checked, /^\d{4}-\d{2}-\d{2}$/, e.id); }
  assert.deepEqual(L.apis.map((a) => a.id), ['gpt-5-nano', 'gpt-5-mini', 'gemini-3.1-flash-lite', 'claude-haiku-4.5', 'claude-sonnet-5']);
  assert.equal(cheapest(L.apis, 400, 5).id, 'gpt-5-nano');
  assert.equal(cheapest(L.apis.slice(1), 400, 5).id, 'gemini-3.1-flash-lite', 'the same price in, less out: 107.5 against gpt-5-mini’s 110');
  assert.equal(cheapest(L.apis.slice(3), 400, 5).id, 'claude-haiku-4.5');
  const twin = [{ id: 'a', inPerM: 1, outPerM: 1 }, { id: 'b', inPerM: 1, outPerM: 1 }];
  assert.equal(cheapest(twin, 10, 10).id, 'a', 'a tie goes to the earlier');
  assert.equal(cheapest([...twin].reverse(), 10, 10).id, 'b');
  assert.deepEqual([tokensOf(''), tokensOf('abcd'), tokensOf('abcde'), tokensOf('€€€€€')], [0, 1, 2, 2]);
});

test('the case: by hand, rented and the card, each line the arithmetic of the lock’s numbers', () => {
  const r = costCase(inputs, lock), p = Object.fromEntries(lock.entries.map((e) => [e.id, e]));
  assert.ok(r.ok, r.why);
  assert.equal(r.model.id, 'gpt-5-nano');
  const fx = p['fx-gbp-usd'].gbpPerUsd, cpi = p['ons-cpi'].value;
  close(r.perCase.hand, (1 / 60) * 12.71, 'a minute at the National Living Wage');
  close(r.perCase.rented, ((400 * 0.05 + 5 * 0.4) / 1e6) * fx, 'gpt-5-nano at its published rates, in pounds');
  close(r.perCase.card, ((15 * 0.00002) / 3600 / 1000) * (24.51 / 100), '15 W for 0.02 ms at 24.51p a kWh');
  assert.equal(r.years.length, YEARS); assert.equal(YEARS, 3); assert.deepEqual(r.years.map((y) => y.year), [1, 2, 3]);
  close(r.years[0].hand, 360000 * r.perCase.hand, 'year one'); close(r.years[2].hand, 360000 * r.perCase.hand * (1 + cpi) ** 2, 'year three rises with CPI');
  close(r.years[2].rented, r.years[0].rented, 'token prices are the provider’s today: not inflated');
  close(r.years[1].card, 360000 * r.perCase.card * (1 + cpi), 'electricity rises with CPI');
  close(r.total.hand, r.years.reduce((s, y) => s + y.hand, 0), 'totals');
  close(r.saving.vsRented, r.total.rented - r.total.card, 'saving'); close(r.saving.vsHand, r.total.hand - r.total.card, 'saving by hand');
  close(r.pct.vsRented, 1 - r.total.card / r.total.rented, 'percent');
  assert.deepEqual(r.used.sources.map((s) => s.id), ['uk-national-living-wage', 'desnz-electricity-nondomestic', 'intel-i7-1255u-power', 'fx-gbp-usd', 'ons-cpi', 'gpt-5-nano']);
  assert.ok(r.used.sources.every((s) => s.source.startsWith('https://') && s.checked === '2026-09-29'));
  assert.deepEqual([r.used.wage, r.used.watts, r.used.pence, r.used.cpi], [12.71, 15, 24.51, 0.031]);
  const sonnet = costCase({ ...inputs, model: 'claude-sonnet-5' }, lock);
  close(sonnet.perCase.rented, ((400 * 2 + 5 * 10) / 1e6) * fx, 'a chosen model');
  assert.equal(costCase({ ...inputs, model: 'gpt-9' }, lock).why, 'the lock does not price gpt-9');
  const gbp = { ...lock, entries: lock.entries.map((e) => (e.id === 'gpt-5-nano' ? { ...e, currency: 'GBP' } : e)) };
  close(costCase(inputs, gbp).perCase.rented, (400 * 0.05 + 5 * 0.4) / 1e6, 'a price already in pounds is not converted');
});

test('every input is refused, with its reason, when it is not a sensible number', () => {
  const bad = {
    cases: [[0, -1, NaN, 'x', 1e9 + 1, Infinity], 'cases a month is a number above 0'],
    minutes: [[0, 601, null], 'minutes by hand is a number above 0, at most 600'],
    tokensIn: [[0, 1e7 + 1], 'tokens in and out are numbers above 0'],
    tokensOut: [[0, -5], 'tokens in and out are numbers above 0'],
    ms: [[0, 6e4 + 1], 'milliseconds per case is a number above 0'],
  };
  for (const [k, [vals, why]] of Object.entries(bad)) for (const x of vals) assert.equal(costCase({ ...inputs, [k]: x }, lock).why, why, k + ' ' + x);
  for (const [k, x] of [['cases', 1e9], ['minutes', 600], ['tokensIn', 1e7], ['tokensOut', 1e7], ['ms', 6e4]]) assert.ok(costCase({ ...inputs, [k]: x }, lock).ok, k + ' at its most');
  assert.equal(costCase(null, lock).why, 'cases a month is a number above 0');
  assert.equal(costCase(inputs, null).why, 'not a price lock');
  assert.equal(costCase(inputs, { entries: 'x' }).why, 'not a price lock');
  for (const id of ['uk-national-living-wage', 'desnz-electricity-nondomestic', 'intel-i7-1255u-power', 'fx-gbp-usd', 'ons-cpi']) assert.equal(costCase(inputs, { entries: lock.entries.filter((e) => e.id !== id) }).why, 'the lock has no ' + id);
  assert.equal(costCase(inputs, { entries: lock.entries.filter((e) => e.kind !== 'api') }).why, 'the lock prices no cloud model');
  const silly = { entries: lock.entries.map((e) => (e.kind === 'api' ? { ...e, inPerM: e.id === 'gpt-5-nano' ? 0 : 1e3 + 1 } : e)) };
  assert.equal(costCase(inputs, silly).why, 'the lock prices no cloud model', 'a price of nothing, or of more than 1,000 a million, is not a price');
  const top = { entries: lock.entries.map((e) => (e.kind === 'api' ? { ...e, inPerM: 1e3, outPerM: 1e3 } : e)) };
  assert.ok(costCase(inputs, top).ok, '1,000 a million is still a price');
});
