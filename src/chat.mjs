// src/chat.mjs — DIGI CHAT: a card's verified mind, asked in words — and abstaining whenever its rules cannot answer.
//
// A chat card carries a scorer's mind (its genome is a sealed scorecard, as any card's) and its form says it is put to
// work in conversation (src/dossier.mjs: form 'chat'). Any card can be asked: the chat reads the question with the
// department's vocabulary (data/vocab.json — each column's plain name, unit and how its values are said, read off the
// loaders' own encodings) and does one of four things:
//   ask      "would a customer with tenure 30, monthly charges 80 and a two year contract leave?" — it reads the values the
//            question gives for the columns its rules read, and answers yes or no with the rules that fired, or abstains,
//            naming what it still needs
//   explain  "what makes a customer leave?" — its rules, in words, strongest first
//   measure  "how good are you?" — its GATE AUC as this device measured it, and what that number means
//   other    anything else — it says what it can answer. It never guesses.
// Nothing is generated: every sentence is built from the mind's own rules and numbers, so the same question to the same
// mind always gets the same answer, and every answer carries a receipt (the question, what was read, the rules that
// fired, the hash of the mind that answered). Phrases are read longest first, so "lab procedures" is never read as
// "procedures"; a value said twice differently is a question it will not answer until it is said once.
//
// Pure and total: junk is answered with an abstention, never thrown.
import { answer } from './mind.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { canonical } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

export const RECEIPT = 'digi.chat.v1';
export const MAX_Q = 500;
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round = (x) => Math.round(x * 1e6) / 1e6;
/** a cut a yes/no column can be said by: between no (0) and yes (1) */
const yesNoCut = (v) => v >= 0 && v < 1;
/** a rule's weight, signed */
const signed = (w) => (w > 0 ? '+' : '') + sayNumber(w);
/** which way a rule leans */
const leaning = (w) => (w > 0 ? 'more likely' : w < 0 ? 'less likely' : 'no more or less likely');

/** the order phrases and equal-weight rules are read in: a three-way compare, 0 only for the same text */
export const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** a number as words say it: no exponent, no trailing zeros */
export function sayNumber(x) {
  if (!Number.isFinite(x)) return String(x);
  const r = round(x);
  return Object.is(r, -0) ? '0' : String(r).includes('e') ? r.toFixed(6).replace(/\.?0+$/, '') : String(r);
}

/** a value exactly as the records hold it, in words: no exponent */
export function sayExact(x) {
  if (!Number.isFinite(x)) return String(x);
  const s = String(x);
  return s.includes('e') ? x.toFixed(12).replace(/\.?0+$/, '') : s;
}

/** a question as the reader sees it: lower case, thousands separators gone, a comma or semicolon a clause mark (|), and
 *  everything but words, numbers and - . = : $ | a space */
export function norm(q) {
  return ' ' + String(q).toLowerCase().replace(/[‘’]/g, '\x27').replace(/(\d),(\d{3})/g, '$1$2').replace(/[,;]/g, ' | ').replace(/[^a-z0-9.\-=:$\x27| ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}

/** the vocabulary of one business, or null */
export function vocabOf(vocab, set) {
  const v = isObj(vocab) && isObj(vocab.sets) && Object.prototype.hasOwnProperty.call(vocab.sets, set) ? vocab.sets[set] : null;
  return v && isObj(v.columns) && isObj(v.groups) ? v : null;
}

const NUM = '(-?\\d+(?:\\.\\d+)?)';
const AFTER_NUMBER = new RegExp('^(?:\\s*(?:is|of|=|:|at|was|equals|about|around|\\$))*\\s*\\$?\\s*' + NUM + '(?![a-z0-9])');
const BEFORE_NUMBER = new RegExp(NUM + '\\s*(?:[a-z$]+\\s+){0,2}$');
const NEGATE = /(?:^|\s)(?:no|not|without|never|lacks|lacking|doesn\x27t have|does not have|don\x27t have|isn\x27t|is not)\s+(?:(?!(?:with|and)\s)[a-z\x27-]+\s+){0,2}$/;
const AFTER_FLAG = /^\s*(?:is|=|:)?\s*(yes|no|true|false|on|off|unknown|1|0)(?![a-z0-9])/;

/** the value said for one column, at the phrase found at [a, b) in q. → { value, spans } | null */
function valueAt(c, q, a, b, free, back) {
  const after = q.slice(b), before = q.slice(0, a);
  if (c.kind === 'number') {
    const m = AFTER_NUMBER.exec(after);
    if (m && free(b, b + m[0].length)) return { value: Number(m[1]), spans: [[b, b + m[0].length]] };
    if (!back) return null;
    const p = BEFORE_NUMBER.exec(before);
    if (p && free(p.index, a)) return { value: Number(p[1]), spans: [[p.index, a]] };
    return null;
  }
  if (c.kind === 'flag' || c.kind === 'tri') {
    const m = AFTER_FLAG.exec(after);
    if (m) {
      const w = m[1];
      if (w === 'unknown') return c.kind === 'tri' ? { value: 0.5, spans: [[b, b + m[0].length]] } : null;
      return { value: ['yes', 'true', 'on', '1'].includes(w) ? 1 : 0, spans: [[b, b + m[0].length]] };
    }
    if (c.kind === 'tri' && /(?:^|\s)unknown\s+$/.test(before)) return { value: 0.5, spans: [] };
    return { value: NEGATE.test(before) ? 0 : 1, spans: [] };
  }
  // levels: the nearest level phrase just after the column's name (searched from its end), else just before it (searched
  // in the words before it), never across a clause mark; at the same place the longest phrase, read first, stands
  for (const after of [true, false]) {
    let best = null;
    for (const [w, v] of Object.entries(c.levels).sort((x, y) => y[0].length - x[0].length)) {
      const re = new RegExp('(?<![a-z0-9])' + esc(w) + '(?![a-z0-9])', 'g'), text = after ? q : before;
      re.lastIndex = after ? b : 0;
      let m;
      while ((m = re.exec(text))) {
        const s = m.index, e = s + w.length, gap = after ? s - b : a - e;
        if (gap > 24 || q.slice(after ? b : e, after ? s : a).includes('|') || !free(s, e)) continue;
        if (!best || gap < best.gap) best = { value: v, gap, s, e };
      }
    }
    if (best) return { value: best.value, spans: [[best.s, best.e]] };
  }
  return null;
}

/**
 * Read a question for the columns given (a department's, or several departments' for a coupled mind).
 * → { case: { column: value }, said: { column: phrase }, conflicts: [column] }
 */
export function parse(question, voc, features) {
  const out = { case: {}, said: {}, conflicts: [] };
  if (typeof question !== 'string' || !voc || !Array.isArray(features)) return out;
  const q = norm(question.slice(0, MAX_Q)), read = new Uint8Array(q.length), cands = [];
  // every character a phrase or a value has been read from is marked: nothing is read twice
  const free = (a, b) => read.subarray(a, b).every((r) => !r);
  const take = (spans) => { for (const [x, y] of spans) read.fill(1, x, y); };
  const put = (feat, value, said) => {
    if (Object.prototype.hasOwnProperty.call(out.case, feat) && out.case[feat] !== value) { if (!out.conflicts.includes(feat)) out.conflicts.push(feat); return; }
    out.case[feat] = value; out.said[feat] = said;
  };
  for (const f of features) {
    const c = isObj(voc.columns[f]) ? voc.columns[f] : null;
    if (!c) continue;
    for (const w of c.words) cands.push({ w, f, c });
    if (c.bare) for (const [w, v] of Object.entries(c.levels)) cands.push({ w, f, c, bare: v });
  }
  for (const g of Object.values(voc.groups)) {
    const members = Object.keys(g.members).filter((m) => features.includes(m));
    if (!members.length) continue;
    for (const m of members) for (const w of g.members[m]) cands.push({ w, g, m, members });
    for (const w of g.none || []) cands.push({ w, g, m: null, members });
  }
  cands.sort((x, y) => y.w.length - x.w.length || order(x.w, y.w));
  // first every name reads the value said after it; only then may a number name still without one read a number before it
  const numbers = cands.filter((k) => k.c && k.c.kind === 'number');
  for (const [back, list] of [[false, cands], [true, numbers]]) for (const k of list) {
    const re = new RegExp('(?<![a-z0-9])' + esc(k.w) + '(?![a-z0-9])', 'g');
    let m;
    while ((m = re.exec(q))) {
      const a = m.index, b = a + k.w.length;
      if (!free(a, b)) continue;
      if (k.g) { take([[a, b]]); for (const mem of k.members) put(mem, mem === k.m ? 1 : 0, k.w); continue; }
      if (k.bare !== undefined) { take([[a, b]]); put(k.f, k.bare, k.w); continue; }
      const v = valueAt(k.c, q, a, b, free, back);
      if (!v) continue;
      take([[a, b], ...v.spans]);
      put(k.f, v.value, k.w);
    }
  }
  return out;
}

const EXPLAIN = /(?<![a-z])(why|explain|how do you (?:decide|work|choose)|what (?:makes|drives|matters|decides)|which (?:rules?|columns?|factors?)|your rules|the rules)(?![a-z])/;
const MEASURE = /(?<![a-z])(how (?:good|accurate|well|reliable|often)|accuracy|auc|can i trust|trustworthy)(?![a-z])/;
/** what a question asks: a case it gives values for, how it decides, how good it is, or something else */
export function intentOf(question, parsed) {
  if (parsed && Object.keys(parsed.case).length) return 'ask';
  const q = norm(question);
  if (MEASURE.test(q)) return 'measure';
  if (EXPLAIN.test(q)) return 'explain';
  return 'other';
}

/** how a column is named in words: its own say, or its family's */
export function sayFeature(feat, voc) {
  if (isObj(voc.columns[feat])) return voc.columns[feat].say;
  for (const g of Object.values(voc.groups)) if (Object.prototype.hasOwnProperty.call(g.members, feat)) return g.say + ' ' + g.members[feat][0];
  return feat;
}

/** one value, as words say it */
export function sayValue(feat, value, voc) {
  const c = isObj(voc.columns[feat]) ? voc.columns[feat] : null;
  if (!c) {
    for (const g of Object.values(voc.groups)) if (Object.prototype.hasOwnProperty.call(g.members, feat)) return (value === 1 ? '' : 'not ') + g.members[feat][0];
    return feat + ' ' + sayNumber(value);
  }
  if (c.kind === 'number') return c.words[0] + ' ' + sayExact(value);
  if (c.kind === 'flag' || c.kind === 'tri') return value === 0.5 ? c.words[0] + ' unknown' : (value === 1 ? 'with ' : 'without ') + c.words[0];
  const w = Object.entries(c.levels).find(([, v]) => v === value);
  return c.words[0] + ' ' + (w ? w[0] : sayNumber(value));
}

/** one rule, in words: "when tenure is at or below 12 months" */
export function sayRule(rule, voc) {
  const c = isObj(voc.columns[rule.feat]) ? voc.columns[rule.feat] : null, above = rule.op === '>';
  const cut = (above ? ' is above ' : ' is at or below ') + sayNumber(rule.v);
  if (!c) {
    for (const g of Object.values(voc.groups)) if (Object.prototype.hasOwnProperty.call(g.members, rule.feat)) {
      const member = g.members[rule.feat][0];
      return yesNoCut(rule.v) ? 'when the ' + g.say + (above ? ' is ' : ' is not ') + member : 'when ' + g.say + ' ' + member + cut + ' (no 0, yes 1)';
    }
    return 'when ' + rule.feat + cut;
  }
  if (c.kind === 'number') return 'when ' + c.say + cut + (c.unit ? ' ' + c.unit : '');
  if (c.kind === 'flag' && yesNoCut(rule.v)) return 'when ' + (above ? 'it has ' : 'it has no ') + c.say;
  if (c.kind === 'flag') return 'when ' + c.say + cut + ' (no 0, yes 1)';
  if (c.kind === 'tri') return 'when ' + c.say + cut + ' (no 0, unknown 0.5, yes 1)';
  const names = [...new Set(Object.entries(c.levels).filter(([, v]) => (above ? v > rule.v : v <= rule.v)).map(([, v]) => v))].map((v) => Object.entries(c.levels).find(([, x]) => x === v)[0]);
  return 'when ' + c.say + (names.length ? ' is ' + names.join(' or ') : cut);
}

/** a case as a question in words (the gate's held-out questions are written this way) */
export function sayCase(x, voc, features) {
  const done = new Set(), parts = [];
  for (const f of features) {
    if (done.has(f) || !Object.prototype.hasOwnProperty.call(x, f)) continue;
    const g = Object.values(voc.groups).find((gr) => Object.prototype.hasOwnProperty.call(gr.members, f));
    if (g) {
      const members = Object.keys(g.members).filter((m) => features.includes(m));
      members.forEach((m) => done.add(m));
      const on = members.find((m) => x[m] === 1);
      parts.push(on ? g.say + ' ' + g.members[on][0] : (g.none && g.none[0]) || g.say + ' other');
      continue;
    }
    done.add(f);
    parts.push(sayValue(f, x[f], voc));
  }
  return parts;
}

/** a case to show how to ask: a rule's own cut for a number, yes for a flag, the first level, a family's first member */
function exampleOf(live, voc) {
  const x = {};
  for (const r of live.flatMap((o) => o.body.rules)) {
    if (Object.prototype.hasOwnProperty.call(x, r.feat)) continue;
    const c = isObj(voc.columns[r.feat]) ? voc.columns[r.feat] : null;
    if (c) { x[r.feat] = c.kind === 'number' ? round(r.v) : c.kind === 'levels' ? Object.values(c.levels)[0] : 1; continue; }
    const g = Object.values(voc.groups).find((gr) => Object.prototype.hasOwnProperty.call(gr.members, r.feat));
    if (g) for (const m of Object.keys(g.members)) x[m] = m === r.feat ? 1 : 0;
    else x[r.feat] = round(r.v);
  }
  return x;
}
const mindHash = (mind) => sha256Hex(canonical(mind.organs.filter((o) => o.state === 'live').map((o) => o.fixed || o.recipe)));

/**
 * Answer a question with a mind: ctx { mind (src/mind.mjs mindOf), voc (vocabOf), features (the columns the mind's
 * departments hold), gate (its GATE AUC in millionths, or null), rows (how many GATE cases it was measured on) }.
 * → { verdict: 'VERIFIED' | 'ABSTAIN', intent, text, receipt }
 */
export function reply(question, ctx) {
  const q = typeof question === 'string' ? question.slice(0, MAX_Q) : '';
  const base = (intent, verdict, text, more = {}) => ({ verdict, intent, text, receipt: { kind: RECEIPT, q, intent, verdict, mind: ctx && ctx.mind && Array.isArray(ctx.mind.organs) ? mindHash(ctx.mind) : null, ...more } });
  if (!ctx || !ctx.voc || !ctx.mind || !Array.isArray(ctx.mind.organs) || !Array.isArray(ctx.features)) return base('other', 'ABSTAIN', 'I have no mind or vocabulary here to answer with.');
  const { mind, voc } = ctx, thing = voc.thing, outcome = voc.outcome, live = mind.organs.filter((o) => o.state === 'live');
  if (!live.length) return base('other', 'ABSTAIN', 'My mind does not answer on these records: no department of it cleared its bar here.');
  const parsed = parse(q, voc, ctx.features), intent = intentOf(q, parsed);
  if (intent === 'ask') {
    if (parsed.conflicts.length) return base('ask', 'ABSTAIN', 'You gave ' + parsed.conflicts.map((f) => sayFeature(f, voc)).join(' and ') + ' two different values. Say each once and I will answer.', { case: parsed.case });
    const need = [...new Set(live.flatMap((o) => o.body.rules.map((r) => r.feat)))], missing = need.filter((f) => !Object.prototype.hasOwnProperty.call(parsed.case, f));
    if (missing.length) return base('ask', 'ABSTAIN', 'I can’t answer that yet: my rules also read ' + [...new Set(missing.map((f) => sayFeature(f, voc)))].join(', ') + '. Tell me those and I will.', { case: parsed.case, missing });
    const a = answer(mind, parsed.case);
    if (a.verdict !== 'VERIFIED') return base('ask', 'ABSTAIN', 'I can’t answer that: ' + a.why + '.', { case: parsed.case });
    const yes = a.label === 1, fired = a.fired.map((r) => sayRule(r, voc) + ' (' + signed(r.w) + ')');
    const text = (yes ? 'Yes — I expect this ' + thing + ' to ' + outcome : 'No — I don’t expect this ' + thing + ' to ' + outcome) + ': its score is ' + sayNumber(a.score) + ', ' + (yes ? 'above' : 'at or below') + ' my line of ' + sayNumber(a.threshold) + '. ' + (fired.length ? 'The rules that fired: ' + fired.join('; ') + '.' : 'None of my rules fired.');
    return base('ask', 'VERIFIED', text, { case: parsed.case, label: a.label, score: a.score, threshold: a.threshold, fired: a.fired.map((r) => r.feat) });
  }
  if (intent === 'explain') {
    const rules = live.flatMap((o) => o.body.rules).slice().sort((x, y) => Math.abs(y.w) - Math.abs(x.w) || order(x.feat, y.feat));
    const text = 'I decide whether a ' + thing + ' will ' + outcome + ' from ' + rules.length + ' rule' + (rules.length === 1 ? '' : 's') + ', strongest first: ' + rules.map((r) => sayRule(r, voc) + ', it is ' + leaning(r.w) + ' (' + signed(r.w) + ')').join('; ') + '. Above my line of ' + sayNumber(mind.threshold) + ' I say yes.';
    return base('explain', 'VERIFIED', text);
  }
  if (intent === 'measure') {
    if (!Number.isInteger(ctx.gate)) return base('measure', 'ABSTAIN', 'My score has not been measured on this device yet: grow me here first.');
    const text = 'On ' + (Number.isInteger(ctx.rows) ? ctx.rows.toLocaleString('en-GB') + ' ' : '') + 'cases I never grew on, I rank a real yes above a real no ' + sayNumber(ctx.gate / 1e6) + ' of the time (GATE AUC: 0.5 is a coin toss, 1 is perfect). Ask me about a ' + thing + ' and check me against what really happened.';
    return base('measure', 'VERIFIED', text, { gate: ctx.gate });
  }
  const example = sayCase(exampleOf(live, voc), voc, ctx.features).slice(0, 3);
  return base('other', 'ABSTAIN', 'I only answer questions about whether a ' + thing + ' will ' + outcome + ', from my rules. Ask me about one — “a ' + thing + ' with ' + example.join(', ') + ': will they ' + outcome + '?” — or ask what makes a ' + thing + ' ' + outcome + ', or how good I am.');
}
