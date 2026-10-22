#!/usr/bin/env node
// tools/measure-15.mjs — organ 15, the guild, measured as sealed in data/organ-15/prereg.json (run tools/seal-15.mjs first;
// git proves the order). Writes data/organ-15/record.json: 400 seeded guilds of demo owners, each owner's estate made of
// real drop cards, each owner signing joins, leaves and returns in its own numbering, some signing two things under one
// number, some lying about a drop card's department; and attacks on every guild: an estate changed after signing, a key
// borrowed, a statement for another guild, a statement with no signature. The members expected are worked out here, apart
// from src/guild.mjs, and compared. No TEST row is read: no row is read at all.
// With SMALL=1 it measures 30 guilds ON OTHER SEEDS into dry-record.json (a check of the tooling, never the sealed measurement).
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, leave, guildOf, MAX_MEMBERS } from '../src/guild.mjs';
import { paintEstate } from '../vendor/pixelwhisperer/kards/estate.mjs';
import { owner, sampler } from './lib.mjs';

const SMALL = process.env.SMALL === '1', GUILDS = SMALL ? 30 : 400, SEED = SMALL ? 25000 : 15000;
const m = JSON.parse(readFileSync(new URL('../drop/manifest.json', import.meta.url), 'utf8'));
const RARITY = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const pick = sampler(SEED), hash = (px) => createHash('sha256').update(px).digest('hex');
const draw = (h) => { const a = paintEstate(h, 'synthwave-v1', 360, 240); return a.ok ? hash(Buffer.from(a.px)) : 'refused: ' + a.why; };
const dropOf = new Map(m.cards.map((c) => [c.card, c.domain]));
/** an owner's estate: real drop cards, said as the drop records them (or, for a liar, one department said wrong) */
function estateOf(lie) {
  const n = 1 + pick.int(6), cards = [], used = new Set();
  while (cards.length < n) {
    const c = m.cards[pick.int(m.cards.length)];
    if (used.has(c.card)) continue;
    used.add(c.card);
    const [dataset, ...dept] = c.domain.split('-');
    cards.push({ id: c.card, dataset, department: dept.join('-'), stage: pick.int(6), rarity: RARITY[pick.int(5)], generation: 0 });
  }
  if (lie) cards[0] = { ...cards[0], department: cards[0].department === 'customer' ? 'account' : 'customer' };
  return { cards, levels: pick.int(20), items: [], swarms: [], districts: ['scorer', 'tools', 'swarm'], names: { swarm: 'KITTED' } };
}
const shuffled = (xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = pick.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const record = { kind: 'digi-card.organ-15.record', v: 1, guilds: [], codes: [], times: [] };

for (let gi = 0; gi < GUILDS; gi++) {
  // one guild in twenty is exactly twelve, all joining (to time), and one is thirteen or fourteen (past the limit)
  const mode = gi % 20 === 7 ? 'twelve' : gi % 20 === 13 ? 'over' : 'any';
  const name = 'guild-' + gi, size = mode === 'twelve' ? 12 : mode === 'over' ? 13 + pick.int(2) : 1 + pick.int(14), keys = await Promise.all(Array.from({ length: size }, (_, k) => owner('guild15-' + SEED + '-' + gi + '-' + k)));
  const honest = [], expected = [], liars = new Set(), estates = new Map();
  for (const k of keys) {
    const lie = pick.int(8) === 0, h = estateOf(lie), steps = mode === 'any' ? 1 + pick.int(4) : 1, mine = [];
    if (lie) liars.add(k.pub);
    let act = 'join', last = null;
    for (let n = 1; n <= steps; n++) {
      const s = act === 'join' ? (await join(k, name, h, n)).statement : (await leave(k, name, n)).statement;
      mine.push(s); last = { n, act };
      act = mode === 'any' && pick.int(3) === 0 ? (act === 'join' ? 'leave' : 'join') : act;
    }
    // one owner in ten signs a second, different statement under its last number: that number stands for neither
    let top = last;
    if (mode === 'any' && pick.int(10) === 0) {
      const other = last.act === 'join' ? (await leave(k, name, last.n)).statement : (await join(k, name, h, last.n)).statement;
      mine.push(other);
      top = steps > 1 ? { n: steps - 1, act: mine.find((s) => s.n === steps - 1).act } : null;
    }
    honest.push(...mine);
    if (top && top.act === 'join') { expected.push(k.pub); estates.set(k.pub, h); }
  }
  // the attacks: each must be refused, and none may change who stands
  const victim = honest.find((s) => s.act === 'join') || honest[0], thief = await owner('guild15-thief-' + SEED + '-' + gi);
  const attacks = [
    [{ ...victim, n: victim.n + 100 }, 'the statement’s signature does not check'],
    [{ ...victim, by: thief.pub }, 'the statement’s signature does not check'],
    [(await join(thief, name + '-x', estateOf(false), 1)).statement, 'the statement is for another guild'],
    [Object.fromEntries(Object.entries(victim).filter(([k2]) => k2 !== 'sig')), 'not a guild statement'],
  ];
  if (victim.act === 'join') attacks.push([{ ...victim, holdings: { ...victim.holdings, levels: victim.holdings.levels + 1 } }, 'the statement’s signature does not check']);
  const all = [...honest, ...attacks.map(([s]) => s)];
  const t0 = performance.now(), g = await guildOf(all, name), ms = performance.now() - t0;
  const g2 = await guildOf(shuffled(all), name), g3 = await guildOf(shuffled(all), name);
  // the same guild in any order: the same members, and the same reasons refused (a refusal's place moves with its statement)
  const sameAs = (x, y) => x.ok === y.ok && (x.ok ? JSON.stringify(x.members) === JSON.stringify(y.members) && JSON.stringify(x.refused.map((q) => q.why).sort()) === JSON.stringify(y.refused.map((q) => q.why).sort()) : x.why === y.why);
  const want = [...expected].sort((a, b) => a.localeCompare(b)), over = want.length > MAX_MEMBERS;
  const row = { size, expected: want.length, over, attacks: attacks.length, liars: [...liars].filter((p) => want.includes(p)).length };
  if (over) row.refusedOver = !g.ok && g.why === 'a guild holds at most ' + MAX_MEMBERS + ' members: ' + want.length + ' stand here' && sameAs(g2, g);
  else {
    row.members = g.ok && JSON.stringify(g.members.map((x) => x.by)) === JSON.stringify(want);
    row.sameAnyOrder = sameAs(g2, g) && sameAs(g3, g);
    const attackWhy = g.ok ? attacks.map(([s, why]) => g.refused.some((r) => r.at === all.indexOf(s) && r.why === why)) : [];
    row.attacksRefused = attackWhy.filter(Boolean).length;
    row.pictures = g.ok && g.members.every((x) => draw(x.holdings) === draw(estates.get(x.by)));
    // the drop check: an honest member's drop cards all match the drop; a liar's never all do
    row.dropHonest = g.ok && g.members.filter((x) => !liars.has(x.by)).every((x) => x.holdings.cards.every((c) => dropOf.get(c.id) === c.dataset + '-' + c.department));
    row.dropLiarsCaught = g.ok ? g.members.filter((x) => liars.has(x.by)).filter((x) => x.holdings.cards.some((c) => dropOf.get(c.id) !== c.dataset + '-' + c.department)).length : 0;
    if (want.length === MAX_MEMBERS) record.times.push(Math.round(ms));
  }
  record.guilds.push(row);
  if (gi % 50 === 0) console.log('guild ' + gi + ' · ' + size + ' keys · ' + want.length + ' standing');
}
// how big a code is: a member with twenty drop cards, signed, as the base64 a player copies
for (let i = 0; i < (SMALL ? 3 : 20); i++) {
  const k = await owner('guild15-code-' + SEED + '-' + i), cards = [];
  while (cards.length < 20) { const c = m.cards[pick.int(m.cards.length)]; if (cards.some((x) => x.id === c.card)) continue; const [dataset, ...dept] = c.domain.split('-'); cards.push({ id: c.card, dataset, department: dept.join('-'), stage: pick.int(6), rarity: RARITY[pick.int(5)], generation: 0 }); }
  const s = (await join(k, 'codes', { cards, levels: 10, items: [], swarms: [], districts: ['scorer', 'tools', 'swarm'], names: { swarm: 'KITTED' } }, 1)).statement;
  record.codes.push(Buffer.from(JSON.stringify(s)).toString('base64').length);
}
mkdirSync(new URL('../data/organ-15/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/organ-15/' + (SMALL ? 'dry-record.json' : 'record.json'), import.meta.url), JSON.stringify(record, null, 1) + '\n');
console.log('organ 15 measured · ' + record.guilds.length + ' guilds · ' + record.guilds.filter((x) => x.over).length + ' past twelve · ' + record.times.length + ' of twelve timed · ' + record.codes.length + ' codes');
