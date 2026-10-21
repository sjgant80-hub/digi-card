#!/usr/bin/env node
// tools/page-check.mjs — the live page's own gate (the estate's ui-gate rules for this page): every element the scripts
// wire exists in the page and every slot the page shows is filled by a script; every internal link lands on a section or
// a game screen; the product carries no price of its own; the Konomi credit and the supplier are on it; the CSP allows
// only this site; the JSON-LD parses; nothing a script sets from a card is written as markup; and the game view's dock
// reaches a real screen from every slot, and nothing on the page or in its scripts is marked coming: a full build has no
// "not in yet" list, so a form, recipe or district is on a screen only once it works. The page, its JSON-LD, llms.txt,
// the README's prose and the posts use none of the words DIGI's copy never uses (src/copy.mjs); none of them quotes
// organ 10's results without its caveat; the game says fuse, never breed; the Kit offers no money-side or ledger app;
// and the first visit has its one NEXT path: BOOT → KIT → ARENA → ESTATE → GROW YOUR OWN. (Each screen's shown text,
// after every result, is read by tools/ui-play.mjs.)
//   → PAGE OK | PAGE BROKEN (exit 1)
import { readFileSync } from 'node:fs';
import { copyHits, organ10Bare, pageText } from '../src/copy.mjs';

const at = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = at('index.html'), app = at('app.js') + '\n' + at('ui/game.js'), problems = [];   // every script the page runs
// what each public text says: the page as it shows, its JSON-LD's strings, and markdown with code spans read as names
const jsonStrings = (text) => { const out = []; try { (function walk(x) { if (typeof x === 'string') out.push(x); else if (x && typeof x === 'object') Object.values(x).forEach(walk); })(JSON.parse(text)); } catch { /* reported below */ } return out.join('\n'); };
const ldStrings = jsonStrings((html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1]);
const prose = (md) => md.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
const metas = [...html.matchAll(/<meta (?:name|property)="[^"]+" content="([^"]*)"/g)].map((m) => m[1]).join('\n');
const manifest = (() => { try { const m = JSON.parse(at('manifest.webmanifest')); return [m.name, m.short_name, m.description].join('\n'); } catch { return ''; } })();
const said = [['the page', pageText(html)], ['its JSON-LD', ldStrings], ['its meta tags', metas], ['the web manifest', manifest], ['llms.txt', at('llms.txt')], ['README.md', prose(at('README.md'))], ['docs/posts.md', prose(at('docs/posts.md'))], ['docs/posts.json', jsonStrings(at('docs/posts.json'))]];
for (const [name, text] of said) {
  for (const h of copyHits(text)) problems.push(name + ' says “' + h.word + '”: ' + h.context.slice(0, 90));
  for (const c of organ10Bare(text)) problems.push(name + ' quotes organ 10 without “(not fully blind: …)”: ' + c.slice(0, 90));
  for (const m of text.matchAll(/.{0,40}\b(breed|breeds|breeding|bred|breeder|offspring)\b.{0,40}/gi)) if (!/src\/breed\.mjs|sealed as ‘breeding’/.test(m[0])) problems.push(name + ' says “' + m[1] + '” (the act is fuse): ' + m[0].trim());
}
if (!/\boffered\(b\.app\) && /.test(at('ui/game.js'))) problems.push('the Kit offers every estate app, the money side and the ledger’s own apps included');
for (const [id, href] of [['g-boot-next', '#kit'], ['g-estate-next', '#mint']]) if (!new RegExp('id="' + id + '" href="' + href + '"').test(html)) problems.push('the first visit’s NEXT from ' + id + ' does not go to ' + href);
for (const [id, href] of [['g-kit-next', '#arena'], ['g-ar-next', '#estate']]) if (!new RegExp("id: '" + id + "', href: '" + href + "'").test(at('ui/game.js'))) problems.push('the first visit’s NEXT from ' + id + ' does not go to ' + href);
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
// the estate painter letters fenced districts COMING in its pixels unless it is told which districts to draw: the game asks for DIGI's
if (!at('ui/game.js').includes("districts: ['scorer', 'tools', 'swarm'], names: { swarm: 'KITTED' }")) problems.push('the estate is not drawn from only the districts DIGI holds with its kitted district lettered KITTED, so its picture would letter COMING or SWARM');
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
