// src/cost.mjs — THE COST CASE: scoring a business's cases by hand, with a rented cloud model, or with a DIGI card on the
// machine it already has. Every price is read from data/prices.lock.json (each entry sourced and dated); every other
// number is the buyer's own input or measured on the page. Nothing here is typed in as a result.
//
// The three ways, per year, for `cases` cases a month:
//   by hand   — a person triages each case: minutes × the UK National Living Wage (the legal floor, so the line is the
//               least it can cost), rising with CPI each year;
//   rented    — every case sent to a cloud language model: (tokens in × its input price + tokens out × its output price)
//               per million, at the cheapest model in the lock unless another is chosen (the floor of the rent, so the
//               comparison never flatters the card); token prices are not inflated (they are the provider's today);
//   the card  — scored on the laptop the business already runs: the measured milliseconds per case × the chip's rated
//               power × UK non-domestic electricity, rising with CPI. No new hardware: the same machine is on either way.
// Both AI ways take the person's time off the case; only the card keeps the records in the building (a rented model is
// a processor under UK GDPR Article 28, and its servers are often a Chapter V transfer) and only the card has no rent.
// Pure and total: a bad input is refused with its reason, never thrown.
export const YEARS = 3;
const no = (why) => ({ ok: false, why });
const pos = (x, max) => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= max;

/** the lock's entries by id, checked to be the kinds this case reads. → { ok, p } | a refusal */
export function pricesOf(lock) {
  const es = lock && Array.isArray(lock.entries) ? lock.entries : null;
  if (!es) return no('not a price lock');
  const by = Object.fromEntries(es.map((e) => [e.id, e]));
  for (const id of ['uk-national-living-wage', 'desnz-electricity-nondomestic', 'intel-i7-1255u-power', 'fx-gbp-usd', 'ons-cpi']) if (!by[id]) return no('the lock has no ' + id);
  const apis = es.filter((e) => e.kind === 'api' && pos(e.inPerM, 1e3) && pos(e.outPerM, 1e3));
  if (!apis.length) return no('the lock prices no cloud model');
  return { ok: true, p: by, apis };
}

/** the cheapest cloud model for this many tokens in and out, by the lock's prices */
export const cheapest = (apis, tin, tout) => apis.reduce((a, b) => (b.inPerM * tin + b.outPerM * tout < a.inPerM * tin + a.outPerM * tout ? b : a));

/** tokens for a text, by the rule of thumb the providers publish: about four characters a token in English */
export const tokensOf = (text) => Math.ceil([...String(text)].length / 4);

/**
 * The case. inputs: { cases (a month), minutes (by hand, per case), tokensIn, tokensOut (per case), ms (per case,
 * measured), model? (an api id; default the cheapest) }. → { ok, model, perCase: { hand, rented, card }, years: [{ year,
 * hand, rented, card }], total: { hand, rented, card }, saving: { vsHand, vsRented }, pct: { vsRented } } — pounds
 */
export function costCase(inputs, lock) {
  const L = pricesOf(lock);
  if (!L.ok) return L;
  const { cases, minutes, tokensIn, tokensOut, ms, model } = inputs || {};
  if (!pos(cases, 1e9)) return no('cases a month is a number above 0');
  if (!pos(minutes, 600)) return no('minutes by hand is a number above 0, at most 600');
  if (!pos(tokensIn, 1e7) || !pos(tokensOut, 1e7)) return no('tokens in and out are numbers above 0');
  if (!pos(ms, 6e4)) return no('milliseconds per case is a number above 0');
  const api = model === undefined ? cheapest(L.apis, tokensIn, tokensOut) : L.apis.find((a) => a.id === model);
  if (!api) return no('the lock does not price ' + String(model).slice(0, 40));
  const { p } = L, fx = p['fx-gbp-usd'].gbpPerUsd, cpi = p['ons-cpi'].value, wage = p['uk-national-living-wage'].value;
  const watts = p['intel-i7-1255u-power'].wattsLow, pence = p['desnz-electricity-nondomestic'].pencePerKwh;
  const perCase = {
    hand: (minutes / 60) * wage,
    rented: ((tokensIn * api.inPerM + tokensOut * api.outPerM) / 1e6) * (api.currency === 'USD' ? fx : 1),
    card: ((watts * (ms / 1000)) / 3600 / 1000) * (pence / 100),
  };
  const year = cases * 12, rise = (y) => (1 + cpi) ** y;
  const years = Array.from({ length: YEARS }, (_, y) => ({ year: y + 1, hand: year * perCase.hand * rise(y), rented: year * perCase.rented, card: year * perCase.card * rise(y) }));
  const total = { hand: years.reduce((s, x) => s + x.hand, 0), rented: years.reduce((s, x) => s + x.rented, 0), card: years.reduce((s, x) => s + x.card, 0) };
  return { ok: true, model: api, perCase, years, total, saving: { vsHand: total.hand - total.card, vsRented: total.rented - total.card }, pct: { vsRented: 1 - total.card / total.rented },
    used: { wage, watts, pence, fx, cpi, sources: ['uk-national-living-wage', 'desnz-electricity-nondomestic', 'intel-i7-1255u-power', 'fx-gbp-usd', 'ons-cpi', api.id].map((id) => ({ id, source: p[id].source, checked: p[id].checked })) } };
}
