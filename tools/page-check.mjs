#!/usr/bin/env node
// tools/page-check.mjs — the live page's own gate (the estate's ui-gate rules for this page): every element the app wires
// exists in the page and every slot the page shows is filled by the app; every internal link lands on a section; the
// product carries no price of its own; the Konomi credit and the supplier are on it; the CSP allows only this site; the
// JSON-LD parses; nothing the app sets from a card is written as markup.   → PAGE OK | PAGE BROKEN (exit 1)
import { readFileSync } from 'node:fs';

const at = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = at('index.html'), app = at('app.js'), problems = [];
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]));
for (const [, id] of app.matchAll(/\$\('#([a-z0-9-]+)'\)/g)) if (!ids.has(id)) problems.push('app.js wires #' + id + ', which the page does not have');
for (const [, id] of app.matchAll(/on\('#([a-z0-9-]+)'/g)) if (!ids.has(id)) problems.push('app.js listens on #' + id + ', which the page does not have');
const set = new Set([...app.matchAll(/setK\('([a-z0-9-]+)'/g)].map((x) => x[1]));
for (const [, k] of html.matchAll(/data-k="([a-z0-9-]+)"/g)) if (!set.has(k)) problems.push('the page shows data-k="' + k + '", which app.js never fills');
for (const [, h] of html.matchAll(/href="#([a-z0-9-]+)"/g)) if (!ids.has(h)) problems.push('a link goes to #' + h + ', which is not on the page');
if (/[£$€]\s?\d|\/mo\b|per seat|priceCurrency|"@type":\s*"Offer"|pricing/i.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ''))) problems.push('the page carries a price');
if (!html.includes('Powered by the Konomi architecture, created by Thomas Frumkin')) problems.push('the Konomi credit is missing');
if (!html.includes('https://www.ai-nativesolutions.com')) problems.push('the supplier is missing');
if (!/default-src 'self'; script-src 'self';/.test(html)) problems.push('the CSP is not this-site-only');
try { JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]); } catch { problems.push('the JSON-LD does not parse'); }
if (/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(app)) problems.push('app.js writes markup');
if (!/<meta name="viewport" content="width=device-width, initial-scale=1"/.test(html)) problems.push('no mobile viewport');
console.log(problems.length ? 'PAGE BROKEN · ' + problems.join('; ') : 'PAGE OK · ' + ids.size + ' elements, ' + set.size + ' live slots, every link lands, no price, credited, this-site-only CSP');
process.exit(problems.length ? 1 : 0);
