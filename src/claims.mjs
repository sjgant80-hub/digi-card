// src/claims.mjs — THE CLAIM GATE: what Grok (or anyone speaking for the drop) may say about a card, and nothing more.
//
// A post is its text plus the claims it rests on. It passes only if:
//   · every claim is of a kind a card can PROVE — verified (its seals check), owned (the registry's owner), grown (its
//     mind's GATE score, re-expressed on the published bytes), offline (it grows with the network trapped), level (each
//     level re-run), born (it beats both parents, re-run), mesh (its measured share), drop (the drop's manifest re-runs) —
//     and the checker for that kind, handed in and run now, says it holds;
//   · every number in the text is a number one of those checks returned — so no score, count or level is said that was
//     not just re-run;
//   · it says none of what a card cannot prove: that a DIGI is self-aware, conscious, sentient, alive, feeling, an AGI or
//     superintelligent; that anything is guaranteed or risk-free; anything of price, money, profit, returns, investment
//     or "the moon" (a card is never priced here, and credits are not money);
//   · it carries the way to re-run it yourself: the live page's address and the words "re-run".
// The self-awareness and open-ended self-improvement the spec holds at κ stay off every public card: they surface later
// only as receipts of these kinds, or not at all. Pure apart from the checkers; total: junk is refused, never thrown.
export const KINDS = ['verified', 'owned', 'grown', 'offline', 'level', 'born', 'mesh', 'drop'];
export const MAX_POST = 280;
export const PAGE = 'https://sjgant80-hub.github.io/digi-card/';
export const NEVER = [
  ['self-aware', /self[\s-]*aware/i], ['conscious', /conscious/i], ['sentient', /sentien/i], ['alive', /\balive\b/i], ['feels', /\bfeel(s|ing|ings)?\b/i],
  ['AGI', /\bAGI\b/i], ['superintelligent', /super[\s-]*intelligen/i], ['guaranteed', /guarantee/i], ['risk-free', /risk[\s-]*free/i],
  ['price', /\bpric(e|es|ed|ing)\b/i], ['money', /\bmoney\b/i], ['profit', /\bprofit/i], ['returns', /\breturns?\b/i], ['investment', /\binvest/i],
  ['a currency sign', /[$£€¥₿]/], ['the moon', /\bmoon/i], ['floor', /\bfloor\b/i], ['pump', /\bpump(s|ed|ing)?\b/i], ['passive income', /passive\s+income/i],
];
const no = (why) => ({ ok: false, why });
const NUMBER = /\d+(?:[.,]\d+)*/g;

/** the numbers a text says, as written (1,000 and 0.739214 and #0001 → '1,000', '0.739214', '0001') */
export const numbersIn = (text) => String(text).match(NUMBER) || [];

/** a number as a check may vouch for it: digits only, commas dropped, leading zeros of a whole number kept as said */
const same = (said, vouched) => said.replace(/,/g, '') === String(vouched).replace(/,/g, '');

/**
 * Gate a post: { text, claims: [{ kind, … }] } against checkers { kind: async (claim) → { ok, why?, says: [numbers] } }.
 * → { ok, says: [every number vouched for] } | a refusal naming the first thing that does not hold
 */
export async function gate(post, checkers) {
  if (!post || typeof post.text !== 'string' || !post.text.trim()) return no('a post has text');
  if ([...post.text].length > MAX_POST) return no('a post is at most ' + MAX_POST + ' characters');
  if (!Array.isArray(post.claims) || !post.claims.length) return no('a post rests on at least one claim a card can prove');
  const bad = NEVER.find(([, re]) => re.test(post.text));
  if (bad) return no('a post never says ' + bad[0] + ': a card cannot prove it');
  if (!post.text.includes(PAGE)) return no('a post carries the live page, so anyone can re-run it: ' + PAGE);
  if (!/\bre-run\b/i.test(post.text)) return no('a post says how to check it: re-run it yourself');
  const says = [];
  for (const [k, claim] of post.claims.entries()) {
    const kind = claim && typeof claim === 'object' ? claim.kind : undefined;
    if (!KINDS.includes(kind)) return no('claim ' + k + ' is not of a kind a card can prove');
    if (!checkers || typeof checkers[kind] !== 'function') return no('claim ' + k + ' (' + kind + ') has no checker here to re-run it');
    let r;
    try { r = await checkers[kind](claim); } catch { r = null; }
    if (!r || r.ok !== true) return no('claim ' + k + ' (' + kind + ') did not hold: ' + ((r && r.why) || 'no reason given'));
    if (!Array.isArray(r.says)) return no('claim ' + k + ' (' + kind + ') vouched for no numbers');
    says.push(...r.says.map(String));
  }
  const words = post.text.split(/\s+/).filter((w) => !w.startsWith(PAGE)).join(' ');   // a link to the page is not a claim
  const loose = numbersIn(words).filter((n) => !says.some((s) => same(n, s)));
  if (loose.length) return no('the post says ' + loose[0] + ', which no claim it rests on just re-ran');
  return { ok: true, says };
}
