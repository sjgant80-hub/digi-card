// src/guild.mjs — THE GUILD: the estates of keys that each consented, drawn together. Reputation only.
//
// A key joins a guild only by signing a statement that names the guild and carries its estate as it holds it (the very
// holdings PixelWhisperer's painter draws: src/../vendor/pixelwhisperer/kards/estate.mjs checkHoldings); it leaves by
// signing a leave. Each member numbers its own statements, and its highest number stands: a later leave takes it out, a
// later join brings it back, and two different statements under one number are refused, since a key that says two things
// at once has said neither. Nobody joins anybody else: a statement signed by another key, or for another guild, is refused
// with its reason, and so is a guild past twelve members. The members come out in the order of their keys, so a guild is
// the same however its statements arrived.
//
// What a member signs is what it says it holds: a signature proves who said it, not that it is so, and the guild says
// exactly that. A guild moves no card, no rating and no credit; it is a picture of who stands together. Pure and total.
import { checkHoldings } from '../vendor/pixelwhisperer/kards/estate.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

export const GUILD = 'digi.guild.v1';
export const MAX_MEMBERS = 12;
export const MAX_STATEMENTS = 240;
export const MAX_BYTES = 65536;   // one member's statement, as signed
const NAME = /^[a-z][a-z0-9-]{0,31}$/;
const KEY = /^[0-9a-f]{64}$/;
const no = (why) => ({ ok: false, why });
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
const exactly = (x, keys) => isObj(x) && Object.keys(x).sort().join() === keys.join();
const canon = (x) => { try { return canonical(x); } catch { return null; } };
const unsigned = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'sig'));
const whole = (n) => Number.isInteger(n) && n >= 1 && n <= 1e9;

/** a member's estate as a guild takes it: holdings the painter can draw, a member's own plot (no doors, no snapshot band) */
function estateOk(h) {
  if (!isObj(h)) return no('an estate is a record of holdings');
  if (h.landmarks !== undefined) return no('a member’s estate carries no doors: those are the screens of its own game');
  if (h.snapshot === true) return no('a member’s estate is its plot, not a snapshot');
  const c = checkHoldings(h);
  return c.ok ? { ok: true } : no('the estate is not one the painter can draw: ' + c.why);
}

async function statement(keys, guild, act, n, holdings) {
  if (!isObj(keys) || typeof keys.pub !== 'string' || !KEY.test(keys.pub)) return no('a statement is signed by a key');
  if (typeof guild !== 'string' || !NAME.test(guild)) return no('a guild is named in lower-case letters, digits and hyphens, at most 32');
  if (!whole(n)) return no('a member numbers its statements 1, 2, 3 …');
  const s = act === 'join' ? { kind: GUILD, guild, act, n, by: keys.pub, holdings } : { kind: GUILD, guild, act, n, by: keys.pub };
  const text = canon(s);
  if (text === null) return no('the statement cannot be written in one exact form');
  if (utf8(text).length > MAX_BYTES) return no('the statement is longer than ' + MAX_BYTES.toLocaleString('en-GB') + ' bytes');
  try { return { ok: true, statement: { ...s, sig: await sign(keys, utf8(text)) } }; } catch { return no('the key could not sign'); }
}

/** a key's signed join, carrying its estate as it holds it. → { ok, statement } | a refusal */
export async function join(keys, guild, holdings, n) {
  const e = estateOk(holdings);
  return e.ok ? statement(keys, guild, 'join', n, holdings) : e;
}

/** a key's signed leave. → { ok, statement } | a refusal */
export const leave = (keys, guild, n) => statement(keys, guild, 'leave', n);

/** is this a guild statement, signed by the key it names, for this guild? → { ok } | a refusal naming why */
export async function statementOk(s, guild) {
  const join = isObj(s) && s.act === 'join';
  if (!exactly(s, join ? ['act', 'by', 'guild', 'holdings', 'kind', 'n', 'sig'] : ['act', 'by', 'guild', 'kind', 'n', 'sig']) || s.kind !== GUILD || (s.act !== 'join' && s.act !== 'leave')) return no('not a guild statement');
  if (s.guild !== guild) return no('the statement is for another guild');
  if (typeof s.by !== 'string' || !KEY.test(s.by)) return no('the statement names no key');
  if (!whole(s.n)) return no('the statement is not numbered');
  if (join) { const e = estateOk(s.holdings); if (!e.ok) return e; }
  const text = canon(unsigned(s));
  if (text === null || utf8(text).length > MAX_BYTES) return no('the statement cannot be read in one exact form');
  let good = false;
  try { good = typeof s.sig === 'string' && (await verifySig(s.by, s.sig, utf8(text))); } catch { good = false; }
  return good ? { ok: true } : no('the statement’s signature does not check');
}

/**
 * The guild from the statements gathered: every one checked, each member's highest-numbered statement standing.
 * → { ok, guild, members: [{ by, n, holdings, cards, levels }], refused: [{ at, why }] } | a refusal
 */
export async function guildOf(statements, guild) {
  if (typeof guild !== 'string' || !NAME.test(guild)) return no('a guild is named in lower-case letters, digits and hyphens, at most 32');
  if (!Array.isArray(statements)) return no('a guild is read from a list of statements');
  if (statements.length > MAX_STATEMENTS) return no('a guild is read from at most ' + MAX_STATEMENTS + ' statements');
  // every member's statements by number: the same statement twice is one statement; two different ones under one number
  // are neither (set aside, and said), and the member's highest clean number stands
  const refused = [], said = new Map();
  for (let at = 0; at < statements.length; at++) {
    const s = statements[at], ok = await statementOk(s, guild);
    if (!ok.ok) { refused.push({ at, why: ok.why }); continue; }
    if (!said.has(s.by)) said.set(s.by, new Map());
    const mine = said.get(s.by), text = canonical(s), had = mine.get(s.n);
    if (had === undefined) mine.set(s.n, { text, s });
    else if (had !== null && had.text !== text) mine.set(s.n, null);
  }
  const standing = [];
  for (const [by, mine] of said) {
    for (const [n, x] of mine) if (x === null) refused.push({ at: null, why: 'a key signed two different statements as number ' + n + ': ' + by.slice(0, 16) });
    const clean = [...mine.values()].filter((x) => x !== null).map((x) => x.s);
    if (clean.length) { const top = Math.max(...clean.map((s) => s.n)); standing.push(clean.find((s) => s.n === top)); }
  }
  const members = standing.filter((s) => s.act === 'join').sort((a, b) => a.by.localeCompare(b.by))   // keys are hex and each stands once
    .map((s) => ({ by: s.by, n: s.n, holdings: s.holdings, cards: s.holdings.cards.length, levels: Number.isInteger(s.holdings.levels) ? s.holdings.levels : 0 }));
  if (members.length > MAX_MEMBERS) return no('a guild holds at most ' + MAX_MEMBERS + ' members: ' + members.length + ' stand here');
  return { ok: true, guild, members, refused };
}

export default guildOf;
