#!/usr/bin/env node
// tools/vocab-check.mjs — data/vocab.json against the published records: every column of every department is said
// exactly once (a column of its own, or a member of one family); a flag only ever holds 0 or 1, a yes/no/unknown only 0,
// 0.5 or 1; every value a levels column holds has a word; a family's members are 0 or 1 with at most one 1 a row, and a
// row with none has a word for that; every phrase the reader looks for names one thing; and every case of every
// department, said in words by src/talker.mjs, reads back as that very case (on a fixed sample of 400 rows a department,
// its first 40 plus a stride over the rest).
//   node tools/vocab-check.mjs   → VOCAB OK | VOCAB BROKEN (exit 1)
import { readFileSync } from 'node:fs';
import { ground } from './lib.mjs';
import { SETS, departments, viewOf } from '../src/data.mjs';
import { vocabOf, sayCase, parse } from '../src/talker.mjs';

const vocab = JSON.parse(readFileSync(new URL('../data/vocab.json', import.meta.url), 'utf8')), problems = [];
let cases = 0;
for (const set of Object.keys(SETS)) {
  const voc = vocabOf(vocab, set), g = await ground(set);
  if (!voc) { problems.push(set + ': no vocabulary'); continue; }
  const said = new Map();
  for (const [f] of Object.entries(voc.columns)) said.set(f, (said.get(f) || 0) + 1);
  for (const gr of Object.values(voc.groups)) for (const m of Object.keys(gr.members)) said.set(m, (said.get(m) || 0) + 1);
  for (const f of g.ds.features) if (said.get(f) !== 1) problems.push(set + '.' + f + ' is said ' + (said.get(f) || 0) + ' times');
  for (const f of said.keys()) if (!g.ds.features.includes(f)) problems.push(set + '.' + f + ' is not a column');
  // a phrase the reader looks for names one thing: two columns (or families) sharing it would be read by whichever comes first
  const phrases = new Map(), phrase = (w, who) => (phrases.has(w) ? problems.push(set + ': "' + w + '" names both ' + phrases.get(w) + ' and ' + who) : phrases.set(w, who));
  for (const [f, c] of Object.entries(voc.columns)) { for (const w of c.words) phrase(w, f); if (c.bare) for (const w of Object.keys(c.levels)) phrase(w, f + ' (a level)'); }
  for (const [name, gr] of Object.entries(voc.groups)) { for (const [m, ws] of Object.entries(gr.members)) for (const w of ws) phrase(w, m); for (const w of gr.none || []) phrase(w, name + ' (none of them)'); }
  for (const [f, c] of Object.entries(voc.columns)) {
    if (!g.ds.cols[f]) continue;
    const seen = new Set(g.ds.cols[f]);
    if (c.kind === 'flag' && ![...seen].every((v) => v === 0 || v === 1)) problems.push(set + '.' + f + ' is a flag but holds ' + [...seen].filter((v) => v !== 0 && v !== 1).slice(0, 3).join(', '));
    if (c.kind === 'tri' && ![...seen].every((v) => [0, 0.5, 1].includes(v))) problems.push(set + '.' + f + ' is yes/no/unknown but holds other values');
    if (c.kind === 'levels') { const coded = new Set(Object.values(c.levels)); for (const v of seen) if (!coded.has(v)) problems.push(set + '.' + f + ' holds ' + v + ', which has no word'); }
    if (!['number', 'flag', 'tri', 'levels'].includes(c.kind)) problems.push(set + '.' + f + ' has no kind');
  }
  for (const [name, gr] of Object.entries(voc.groups)) {
    const ms = Object.keys(gr.members).filter((m) => g.ds.cols[m]);
    let none = 0;
    for (let i = 0; i < g.ds.n; i++) {
      const on = ms.filter((m) => g.ds.cols[m][i] === 1).length, odd = ms.some((m) => g.ds.cols[m][i] !== 0 && g.ds.cols[m][i] !== 1);
      if (odd || on > 1) { problems.push(set + ' family ' + name + ' row ' + i + ' is not one member at most'); break; }
      if (!on) none++;
    }
    if (none && !(gr.none && gr.none.length)) problems.push(set + ' family ' + name + ' has ' + none + ' rows with no member and no word for that');
  }
  for (const dom of departments(g)) {
    const view = viewOf(g, dom), feats = view.features, n = g.ds.n, rows = [...Array(Math.min(40, n)).keys(), ...Array.from({ length: 360 }, (_, k) => 40 + Math.floor((k * (n - 40)) / 360))];
    for (const i of rows) {
      const x = Object.fromEntries(feats.map((f) => [f, g.ds.cols[f][i]])), q = 'a ' + voc.thing + ' with ' + sayCase(x, voc, feats).join(', ') + ': will they ' + voc.outcome + '?', back = parse(q, voc, feats);
      cases++;
      const wrong = feats.filter((f) => back.case[f] !== x[f]);
      if (wrong.length || back.conflicts.length) { problems.push(dom + ' row ' + i + ' does not read back: ' + wrong.map((f) => f + ' ' + x[f] + '→' + back.case[f]).slice(0, 4).join(', ') + (back.conflicts.length ? ' (conflicts ' + back.conflicts.join(', ') + ')' : '') + ' · ' + q.slice(0, 160)); break; }
    }
  }
}
console.log(problems.length ? 'VOCAB BROKEN · ' + problems.slice(0, 12).join(' | ') + (problems.length > 12 ? ' … and ' + (problems.length - 12) + ' more' : '') : 'VOCAB OK · ' + Object.keys(SETS).length + ' businesses, every column said once, every value with a word, ' + cases.toLocaleString('en-GB') + ' cases said in words and read back exactly');
process.exit(problems.length ? 1 : 0);
