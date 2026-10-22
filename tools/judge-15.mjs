#!/usr/bin/env node
// tools/judge-15.mjs — organ 15's verdict, by its sealed rules alone (data/organ-15/prereg.json) over its record.
//   node tools/judge-15.mjs [--write | --check]
import { judgeMain, isMain } from './organ.mjs';

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
export const RULES = {
  P1: (r) => {
    const read = r.guilds.filter((g) => !g.over), over = r.guilds.filter((g) => g.over);
    const right = read.filter((g) => g.members === true && g.attacksRefused === g.attacks).length, attacks = read.reduce((s, g) => s + g.attacks, 0);
    const refusedOver = over.filter((g) => g.refusedOver === true).length;
    return { pass: r.guilds.length === 400 && right === read.length && over.length > 0 && refusedOver === over.length,
      saw: right + ' of ' + read.length + ' guilds stood exactly as the keys signed, every one of their ' + attacks + ' attacks refused with its reason; ' + refusedOver + ' of ' + over.length + ' guilds past twelve were refused' };
  },
  P2: (r) => { const read = r.guilds.filter((g) => !g.over), same = read.filter((g) => g.sameAnyOrder === true).length; return { pass: read.length > 0 && same === read.length, saw: same + ' of ' + read.length + ' guilds were the very same in three orders of their statements' }; },
  P3: (r) => {
    const read = r.guilds.filter((g) => !g.over), pics = read.filter((g) => g.pictures === true).length, honest = read.filter((g) => g.dropHonest === true).length;
    const liars = read.reduce((s, g) => s + g.liars, 0), caught = read.reduce((s, g) => s + g.dropLiarsCaught, 0);
    return { pass: read.length > 0 && pics === read.length && honest === read.length && liars > 0 && caught === liars,
      saw: pics + ' of ' + read.length + ' guilds drew every member’s estate exactly as it signed it; ' + honest + ' had every honest member’s drop cards match the drop; ' + caught + ' of ' + liars + ' members who signed a drop card wrongly were caught by the drop' };
  },
  Q1: (r) => { const md = median(r.times); return { pass: md !== null && md < 2000, saw: 'a guild of twelve was read in a median ' + md + ' ms (' + r.times.length + ' guilds of twelve timed)' }; },
  Q2: (r) => { const top = r.codes.length ? Math.max(...r.codes) : null; return { pass: top !== null && top < 6000, saw: 'a member with twenty drop cards signs a code of at most ' + top + ' characters (' + r.codes.length + ' codes)' }; },
};
if (isMain(import.meta.url, 'judge-15.mjs')) judgeMain(15, RULES);
