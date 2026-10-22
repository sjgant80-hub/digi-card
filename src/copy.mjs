// src/copy.mjs — the words DIGI's copy never uses, and the one result it never quotes bare.
//
// DIGI is not money and nothing in it is for sale, so its copy never says earn, sell, buy, worth or price, never shows a
// currency sign, never names KCC or an airdrop, and never calls a DIGI alive or living (a DIGI grows). The only senses
// let through are the gate's own: a level or a rarity is earned by proof; living-seed is a repository's name and the
// National Living Wage a sourced wage; the page may deny that a DIGI is alive; and the cost case names the sourced,
// dated prices it computes from. Text shown word for word from somewhere else is marked on the page and read past:
// data-quote="sealed" (a sealed claim or a committed verdict, which cannot be reworded after its seal), "sourced" (a
// dated price, or an app's name as its own repository spells it) and "gate" (the claim gate's own list of the words it
// refuses). Organ 10 was dry-run before its seal, so wherever its results are quoted outside Proof's own strip, the same
// line says CAVEAT_10. Pure and total: junk reads as no words.
//   copyHits(text)    → [{ word, context }] for every word the copy may not use
//   organ10Bare(text) → [context] for every line that quotes organ 10's results without CAVEAT_10
//   pageText(html)    → a page's words as it shows them, one block a line, quotes left out
//   offered(app)      → whether the Kit offers an estate app as a tool: never the money side (agora, fallherd) nor the
//                       contribution ledger's own apps (kcc-*), whose words DIGI does not use
//   shownDesc(desc)   → an app's description as the Kit shows it: as written when it uses none of those words, else ''
//   sayOutcome(set, o) → a business's yes/no question in DIGI's words (the records' own wording, src/data.mjs, is kept)
//   SHOWN_AS          → the plain name each organ whose sealed title uses other words is shown by, next to that title
//   ORGANS            → how many organs there are to read
export const SAID_OUTCOME = Object.freeze({ shop: 'made a purchase', adult: 'has an income over 50K a year' });
export const sayOutcome = (set, outcome) => (Object.prototype.hasOwnProperty.call(SAID_OUTCOME, set) ? SAID_OUTCOME[set] : outcome);
export const SHOWN_AS = Object.freeze({ 4: 'fusion', 5: 'giving and ownership' });
/** how many organs the Proof screen and the explainer read: every one sealed before it was measured (data/organ-1 … 14) */
export const ORGANS = 14;
export const LEFT_OUT = Object.freeze(['agora', 'fallherd']);
export const offered = (app) => typeof app === 'string' && !LEFT_OUT.includes(app) && !/^kcc-/i.test(app);
export const shownDesc = (desc) => (typeof desc === 'string' && !copyHits(desc).length ? desc : '');
export const WORDS = /\b(?:earn|earns|earned|earning|earnings|earner|earners|sell|sells|selling|seller|sellers|sold|buy|buys|buying|buyer|buyers|bought|worth|price|prices|priced|pricing|alive|living|kcc|airdrops?)\b|\$/gi;
export const ALLOW = [
  /\blevels?\b[^.;:|\n]{0,40}?\bearned\b/gi,
  /\brarity is earned\b/gi,
  /\bliving-seed\b/gi,
  /\bNational Living Wage\b/gi,
  /\bnever (?:says|claims) a (?:DIGI|Kardling) is self-aware, conscious or alive\b/gi,
  /\bpublished prices, each sourced and dated\b/gi,
  /\bEvery price is read from\s+data\/prices\.lock\.json\s+\(copied from the estate’s price registry\b/gi,
  /\bEvery price this case reads, with its source\b/gi,
  /\bfrom sourced prices\b/gi,
  // a named economic statistic the bank's records hold (a column the talker says by name), not a price of anything
  /\bconsumer price index\b/gi,
];
export const CAVEAT_10 = 'not fully blind: dry-run before the seal; see Proof';
const ORGAN_10 = [
  /\b(?:organ 10|10 · the kit and the party)\b.{0,400}?(?:\b\d+\s*\/\s*\d+|\b\d+ of \d+|\b\d+(?:\.\d+)?%|\bsealed before)/i,
  /\bten organs,? each sealed before it was measured\b/i,
];

const around = (text, a, b) => text.slice(Math.max(0, a - 50), Math.min(text.length, b + 50)).replace(/\s+/g, ' ').trim();

/** every word the copy may not use, outside the senses let through */
export function copyHits(text) {
  if (typeof text !== 'string') return [];
  const allowed = ALLOW.flatMap((re) => [...text.matchAll(re)].map((m) => [m.index, m.index + m[0].length])), out = [];
  for (const m of text.matchAll(WORDS)) {
    const a = m.index, b = a + m[0].length;
    if (!allowed.some(([x, y]) => x <= a && b <= y)) out.push({ word: m[0], context: around(text, a, b) });
  }
  return out;
}

/** every line that quotes organ 10's results and does not carry its caveat */
export function organ10Bare(text) {
  if (typeof text !== 'string') return [];
  return text.split('\n').filter((line) => !line.includes(CAVEAT_10) && ORGAN_10.some((re) => re.test(line))).map((line) => line.replace(/\s+/g, ' ').trim().slice(0, 160));
}

/** a page's words as it shows them: no scripts, styles, comments or tags, nothing quoted, each block on a line of its own */
export function pageText(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ')
    .replace(/<(\w+)\b[^>]*\bdata-quote="(?:sealed|sourced|gate)"[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/<\/(?:p|div|li|h[1-6]|dt|dd|tr|section|details|summary|ol|ul|table|text)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, '’').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n');
}
