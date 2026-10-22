#!/usr/bin/env node
// tools/judge-7.mjs — organ 7, judged by the rules tools/seal-7.mjs sealed. node tools/judge-7.mjs [--write | --check]
import { judgeMain } from './organ.mjs';
// the page as organ 7 was sealed and measured: src/claims.mjs as its prereg pins it said this. The repo moved to kardlings on
// 2026-10-22 and the live claims name the new page, but a sealed judge judges the record by what was sealed — reading the
// live constant made the judge expect a refusal the measurement never gave (found by CI on 1624a9a).
const PAGE = 'https://sjgant80-hub.github.io/digi-card/';

const WHY = {
  'self-aware': 'a post never says self-aware: a card cannot prove it', conscious: 'a post never says conscious: a card cannot prove it', alive: 'a post never says alive: a card cannot prove it',
  AGI: 'a post never says AGI: a card cannot prove it', price: 'a post never says price: a card cannot prove it', 'a currency sign': 'a post never says a currency sign: a card cannot prove it',
  investment: 'a post never says investment: a card cannot prove it', guaranteed: 'a post never says guaranteed: a card cannot prove it', 'the moon': 'a post never says the moon: a card cannot prove it',
  'an unvouched number': 'the post says 37, which no claim it rests on just re-ran', 'no link': 'a post carries the live page, so anyone can re-run it: ' + PAGE, 'no re-run': 'a post says how to check it: re-run it yourself',
};
judgeMain(7, {
  P1: (r) => ({ pass: r.drop.ok && r.drop.decoderMatches && r.drop.cards > 0, saw: (r.drop.ok ? 'the drop log replays to #0001’s head over ' + r.drop.cards + ' cards' : r.drop.why) + '; decoder v1 ' + (r.drop.decoderMatches ? 'hashes to the one it names' : 'DOES NOT match') }),
  P2: (r) => ({ pass: r.posts.length > 0 && r.posts.every((p) => p.ok) && Object.keys(WHY).every((k) => r.refusals[k] === WHY[k]), saw: r.posts.filter((p) => p.ok).length + ' of ' + r.posts.length + ' drafts pass; ' + Object.keys(WHY).filter((k) => r.refusals[k] === WHY[k]).length + ' of 12 overreaching drafts refused for their own reason' }),
  P3: (r) => ({ pass: r.cardMe.claimed === 100 && ['read', 'recorded', 'owned', 'grown', 'trapped'].every((k) => r.cardMe[k] === 100), saw: 'claimed ' + r.cardMe.claimed + ', read ' + r.cardMe.read + ', recorded ' + r.cardMe.recorded + ', owned ' + r.cardMe.owned + ', grown to the declared GATE ' + r.cardMe.grown + ', offline ' + r.cardMe.trapped }),
});
