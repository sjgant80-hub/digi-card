#!/usr/bin/env node
// tools/page-check.mjs — the live page's own gate (the estate's ui-gate rules for this page): every element the scripts
// wire exists in the page and every slot the page shows is filled by a script; every internal link lands on a section or
// a game screen; the product carries no price of its own; the Konomi credit and the supplier are on it; the CSP allows
// only this site; the JSON-LD parses; nothing a script sets from a card is written as markup; and the game view's dock
// reaches a real screen from every slot, and nothing on the page or in its scripts is marked coming: a full build has no
// "not in yet" list, so a form, recipe or district is on a screen only once it works.
//   → PAGE OK | PAGE BROKEN (exit 1)
import { readFileSync } from 'node:fs';

const at = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = at('index.html'), app = at('app.js') + '\n' + at('ui/game.js'), problems = [];   // every script the page runs
for (const s of ['ui/game.css', 'ui/mode.js', 'ui/game.js']) if (!html.includes('"' + s + '"')) problems.push('the page does not load ' + s);
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]));
for (const [, id] of app.matchAll(/\$\('#([a-z0-9-]+)'\)/g)) if (!ids.has(id)) problems.push('app.js wires #' + id + ', which the page does not have');
for (const [, id] of app.matchAll(/on\('#([a-z0-9-]+)'/g)) if (!ids.has(id)) problems.push('app.js listens on #' + id + ', which the page does not have');
const set = new Set([...app.matchAll(/setK\('([a-z0-9-]+)'/g)].map((x) => x[1]));
for (const [, k] of html.matchAll(/data-k="([a-z0-9-]+)"/g)) if (!set.has(k)) problems.push('the page shows data-k="' + k + '", which app.js never fills');
const screens = new Set([...html.matchAll(/data-screen="([a-z]+)"/g)].map((x) => x[1]));
for (const [, h] of html.matchAll(/href="#([a-z0-9-]+)"/g)) if (!ids.has(h) && !screens.has(h)) problems.push('a link goes to #' + h + ', which is neither a section nor a game screen');
for (const [, s] of html.matchAll(/data-go="([a-z]+)"/g)) if (!screens.has(s)) problems.push('a dock slot goes to the screen ' + s + ', which the page does not have');
for (const [name, text] of [['the page', html], ['the scripts', app]]) for (const m of text.matchAll(/.{0,40}\b(coming soon|coming|not built yet|not in yet)\b.{0,40}/gi)) problems.push(name + ' marks something “' + m[1] + '”: ' + m[0].trim().slice(0, 90));
for (const s of ['ui/mode.js', 'ui/game.js']) if (/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(at(s))) problems.push(s + ' writes markup');
if (/[£$€]\s?\d|per seat|pricing/i.test(at('ui/game.js'))) problems.push('the game view carries a price');
if (/[£$€]\s?\d|\/mo\b|per seat|priceCurrency|"@type":\s*"Offer"|pricing/i.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ''))) problems.push('the page carries a price');
if (!html.includes('Powered by the Konomi architecture, created by Thomas Frumkin')) problems.push('the Konomi credit is missing');
if (!html.includes('https://www.ai-nativesolutions.com')) problems.push('the supplier is missing');
// Gary W. Floyd's credit, in full, wherever the build draws on his papers (the estate's hard rule): full name, company, paper
const GARY = 'Gary W. Floyd, Lumiea Systems Research Division — ThunderStruck Service LLC';
for (const [name, text] of [['the page', html], ['NOTICE', at('NOTICE')], ['README.md', at('README.md')], ['llms.txt', at('llms.txt')]]) {
  if (!text.includes(GARY)) problems.push(name + ' does not credit ' + GARY);
  if (/ThunderStruck Services/.test(text)) problems.push(name + ' misnames the company (it is ThunderStruck Service, singular)');
  if (/Gary Floyd/.test(text)) problems.push(name + ' names him without his middle initial (Gary W. Floyd)');
}
for (const paper of ['Dual-Map Ethical Reasoning', 'The Laws of Entropy-Time', 'Dream State Architecture', 'NEXUS']) if (!html.includes(paper)) problems.push('the page does not name Gary W. Floyd’s paper “' + paper + '”');
if (!/default-src 'self'; script-src 'self';/.test(html)) problems.push('the CSP is not this-site-only');
try { JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]); } catch { problems.push('the JSON-LD does not parse'); }
if (/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(app)) problems.push('app.js writes markup');
if (!/<meta name="viewport" content="width=device-width, initial-scale=1"/.test(html)) problems.push('no mobile viewport');
console.log(problems.length ? 'PAGE BROKEN · ' + problems.join('; ') : 'PAGE OK · ' + ids.size + ' elements, ' + set.size + ' live slots, ' + screens.size + ' screens, every link lands, no price, credited, this-site-only CSP');
process.exit(problems.length ? 1 : 0);
