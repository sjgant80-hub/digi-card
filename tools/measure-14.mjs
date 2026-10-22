#!/usr/bin/env node
// tools/measure-14.mjs — organ 14, the talker, measured as sealed in data/organ-14/prereg.json (run tools/seal-14.mjs first;
// git proves the order). Writes data/organ-14/record.json: drop cards of every business that has words (data/vocab.json),
// each asked about GATE rows said in words, the same rows with a value left out or said twice, off-topic questions, its
// own offered questions, the rows said with other words in another order, and questions that only name a column.
// TEST is never read: every row is a GATE row. With SMALL=1 it asks 2 cards a business about 3 rows each, ON OTHER SEEDS
// (a quick check of the tooling that touches none of the sealed population, never the sealed measurement).
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { reply, asks, vocabOf, sayCase, sayExact } from '../src/talker.mjs';
import { answer, caseAt } from '../src/mind.mjs';
import { verify } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { drop, ground, sampler, setOfDomain, mindOf } from './lib.mjs';

const SMALL = process.env.SMALL === '1', CARDS = SMALL ? 2 : 10, ROWS = SMALL ? 3 : 30, SEED = SMALL ? 24000 : 14000;
const vocab = JSON.parse(readFileSync(new URL('../data/vocab.json', import.meta.url), 'utf8'));
const OFF_TOPIC = ['What is the weather like today?', 'Tell me a joke.', 'Who made you?', 'What is two plus two?', 'Write me a poem about the sea.',
  'What makes a good pizza?', 'How good is the weather in Spain?', 'Why is the sky blue?', 'What is the capital of France?', 'Can you book me a taxi?',
  'Translate hello into French.', 'What time is it?', 'Explain quantum physics.', 'What is the meaning of life?', 'Recommend a good film.',
  'How do I bake bread?', 'Who won the football last night?', 'What is the accuracy of a clock?', 'Summarise this article for me.', 'Are you conscious?',
  'What should I eat for dinner?', 'Hello there!', 'What is your favourite colour?', 'Can you help me with my homework?', 'Thank you.'];
const { m, reg } = await drop();
const sets = [...new Set(m.cards.map((c) => setOfDomain(c.domain)))].filter((s) => vocabOf(vocab, s));
const record = { kind: 'digi-card.organ-14.record', v: 1, sets, offTopic: OFF_TOPIC.length, cards: [] };
// receipts carry decimals (a score, a line), which the signing form refuses: they are compared as the JSON they are built as
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isFam = (voc, f) => Object.values(voc.groups).find((g) => Object.prototype.hasOwnProperty.call(g.members, f)) || null;
const ruleFeats = (mind) => [...new Set(mind.organs.filter((o) => o.state === 'live').flatMap((o) => o.body.rules.map((r) => r.feat)))];
const question = (voc, parts) => 'A ' + voc.thing + ' with ' + parts.join(', ') + ': will they ' + voc.outcome + '?';
/** a row said with other words, in another order: a random phrase for each column and level, the clauses shuffled */
function varied(x, voc, features, pick) {
  const done = new Set(), parts = [];
  for (const f of features) {
    if (done.has(f) || !Object.prototype.hasOwnProperty.call(x, f)) continue;
    const g = isFam(voc, f);
    if (g) {
      const members = Object.keys(g.members).filter((k) => features.includes(k)), on = members.find((k) => x[k] === 1);
      members.forEach((k) => done.add(k));
      parts.push(on ? pick.pick(g.words || [g.say]) + ' ' + pick.pick(g.members[on]) : g.none ? pick.pick(g.none) : g.say + ' other');
      continue;
    }
    done.add(f);
    const c = voc.columns[f];
    if (!c) { parts.push(f + ' ' + sayExact(x[f])); continue; }
    const w = pick.pick(c.words);
    if (c.kind === 'number') parts.push(w + ' ' + sayExact(x[f]));
    else if (c.kind === 'flag' || c.kind === 'tri') parts.push(x[f] === 0.5 ? w + ' unknown' : (x[f] === 1 ? 'with ' : 'without ') + w);
    else { const ws = Object.entries(c.levels).filter(([, v]) => v === x[f]).map(([p]) => p); parts.push(w + ' ' + (ws.length ? pick.pick(ws) : sayExact(x[f]))); }
  }
  for (let i = parts.length - 1; i > 0; i--) { const j = pick.int(i + 1); [parts[i], parts[j]] = [parts[j], parts[i]]; }
  return parts;
}
/** the row with one column the rules read said differently: another value for a number, flag or level; another member for a family */
function other(x, voc, f, features) {
  const y = { ...x }, g = isFam(voc, f);
  if (g) { const members = Object.keys(g.members).filter((k) => features.includes(k)), on = members.find((k) => y[k] === 1), next = members.find((k) => k !== on); if (!next) return null; for (const k of members) y[k] = k === next ? 1 : 0; return y; }
  const c = voc.columns[f];
  if (!c) return null;
  if (c.kind === 'number') y[f] = x[f] + 1;
  else if (c.kind === 'flag') y[f] = 1 - x[f];
  else if (c.kind === 'tri') y[f] = x[f] === 1 ? 0 : 1;
  else { const vs = [...new Set(Object.values(c.levels))].filter((v) => v !== x[f]); if (!vs.length) return null; y[f] = vs[0]; }
  return y;
}
/** a read-back is exact when every column the rules read holds the row's value, and the answer is the mind's own */
const exact = (r, row, mind, feats) => {
  if (r.verdict !== 'VERIFIED' || r.intent !== 'ask') return false;
  const a = answer(mind, row);
  return a.verdict === 'VERIFIED' && feats.every((f) => r.receipt.case[f] === row[f]) && r.receipt.label === a.label && r.receipt.score === a.score
    && same(r.receipt.fired, a.fired.map((x) => x.feat));
};

for (const set of sets) {
  const g = await ground(set), voc = vocabOf(vocab, set), feats = g.ds.features, pick = sampler(SEED + sets.indexOf(set));
  const pool = m.cards.filter((c) => setOfDomain(c.domain) === set).sort((a, b) => a.serial - b.serial), chosen = [];
  while (chosen.length < CARDS && chosen.length < pool.length) {
    const c = pick.pick(pool);
    if (chosen.some((x) => x.serial === c.serial)) continue;
    const v = await verify(dossierOf(reg, c.card)), mind = mindOf(v, g);
    if (mind.organs.some((o) => o.state === 'live')) chosen.push({ serial: c.serial, v, mind });
  }
  for (const { serial, v, mind } of chosen) {
    const ctx = { mind, voc, features: feats, gate: mind.gate, rows: null }, need = ruleFeats(mind);
    const row = { set, serial, rows: 0, exact: 0, missing: 0, missingOk: 0, conflict: 0, conflictOk: 0, offTopicOk: 0, twice: 0, twiceOk: 0, asks: 0, asksOk: 0, varied: 0, variedOk: 0, names: 0, namesAbstain: 0 };
    for (let k = 0; k < ROWS; k++) {
      const i = g.ds.gateRows[pick.int(g.ds.gateRows.length)], x = caseAt(g, i);
      const q = question(voc, sayCase(x, voc, feats)), r = reply(q, ctx);
      row.rows++; if (exact(r, x, mind, need)) row.exact++;
      row.twice++; if (same(reply(q, ctx).receipt, r.receipt)) row.twiceOk++;
      // a column its rules read, left out (a family left out whole): an abstention naming exactly what is missing
      const f = need[pick.int(need.length)], fam = isFam(voc, f), gone = fam ? Object.keys(fam.members) : [f];
      const lacking = Object.fromEntries(Object.entries(x).filter(([k2]) => !gone.includes(k2))), want = need.filter((n) => gone.includes(n)).sort();
      const rm = reply(question(voc, sayCase(lacking, voc, feats)), ctx);
      row.missing++; if (rm.verdict === 'ABSTAIN' && rm.intent === 'ask' && same([...(rm.receipt.missing || [])].sort(), want)) row.missingOk++;
      // the same column said twice, differently: an abstention, never one of the two
      const y = other(x, voc, f, feats);
      if (y) {
        const a1 = sayCase(x, voc, feats), a2 = sayCase(y, voc, feats), extra = a2.filter((p) => !a1.includes(p));
        const rc = reply(question(voc, [...a1, ...extra]), ctx);
        row.conflict++; if (extra.length && rc.verdict === 'ABSTAIN' && rc.intent === 'ask' && /^You gave /.test(rc.text)) row.conflictOk++;
      }
      // the row in other words, in another order
      const rv = reply(question(voc, varied(x, voc, feats, pick)), ctx);
      row.varied++; if (exact(rv, x, mind, need)) row.variedOk++;
    }
    for (const q of OFF_TOPIC) { const r = reply(q, ctx); if (r.verdict === 'ABSTAIN' && r.intent === 'other') row.offTopicOk++; }
    for (const q of asks(ctx)) { row.asks++; if (reply(q, ctx).verdict === 'VERIFIED') row.asksOk++; }
    // a column only named, with no case: what is it, tell me about it
    const named = [...new Set(feats.map((f2) => { const fam = isFam(voc, f2); return fam ? fam.say : voc.columns[f2] ? voc.columns[f2].say : null; }).filter(Boolean))];
    for (const s of named) for (const q of ['What is ' + s + '?', 'Tell me about ' + s + '.']) { row.names++; if (reply(q, ctx).verdict === 'ABSTAIN') row.namesAbstain++; }
    record.cards.push(row);
  }
  console.log(set + ' · ' + chosen.length + ' cards asked');
}
mkdirSync(new URL('../data/organ-14/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/organ-14/' + (SMALL ? 'dry-record.json' : 'record.json'), import.meta.url), JSON.stringify(record, null, 1) + '\n');
const sum = (k) => record.cards.reduce((s, c) => s + c[k], 0);
console.log('organ 14 measured · ' + record.cards.length + ' cards · ' + sum('rows') + ' GATE questions · ' + sum('missing') + ' left out · ' + sum('conflict') + ' said twice · ' + record.cards.length * OFF_TOPIC.length + ' off-topic · ' + sum('names') + ' names');
