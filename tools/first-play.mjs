#!/usr/bin/env node
// tools/first-play.mjs — the first game (ui/first.js), played: a headless browser opens the page from nothing as a brand-new
// player and plays the tutorial through, and the gate fails on anything that does not work. It presses Play and checks the
// first Kardling's POWER is its GATE grown on this device and the very GATE the drop declared for that card; fights the first
// duel to a verdict; takes the prize and holds two cards; teams them against the world boss and reads the three numbers;
// reaches the key file and the map, starts playing and lands on the estate with the tutorial gone. A second visit must not
// show it again; #first-game opens it again, and Skip closes it. Every step is read for any word the game's copy never uses
// (src/copy.mjs) and laid out at phone width without a sideways scroll; any console error or uncaught exception fails it.
//   node tools/first-play.mjs   → FIRST PLAY OK | FIRST PLAY BROKEN (exit 1)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyHits } from '../src/copy.mjs';

const CHROMES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const chrome = CHROMES.find((p) => existsSync(p));
if (!chrome) { console.log('FIRST PLAY BROKEN · no Chrome found (set CHROME)'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 8800 + Math.floor(Math.random() * 90), dbg = 9300 + Math.floor(Math.random() * 90), url = 'http://127.0.0.1:' + port + '/';
const root = fileURLToPath(new URL('../', import.meta.url)), profile = mkdtempSync(join(tmpdir(), 'kardlings-first-'));
const manifest = JSON.parse(readFileSync(join(root, 'drop/manifest.json'), 'utf8'));
const server = spawn(process.execPath, [join(root, 'tools/serve.mjs'), String(port)], { stdio: 'ignore' });
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--remote-debugging-port=' + dbg, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
const problems = [], seen = [];
let ws = null;
async function done(code) {
  try { ws && ws.close(); } catch { /* closing */ }
  browser.kill(); server.kill(); await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold it */ }
  console.log(problems.length ? 'FIRST PLAY BROKEN · ' + problems.join('; ') + (seen.length ? ' (played: ' + seen.join(' · ') + ')' : '') : 'FIRST PLAY OK · ' + seen.join(' · '));
  process.exit(problems.length ? 1 : code);
}
try {
  let page = null;
  for (let i = 0; i < 80 && !page; i++) { await sleep(250); page = await fetch('http://127.0.0.1:' + dbg + '/json').then((r) => r.json()).then((t) => t.find((x) => x.type === 'page')).catch(() => null); }
  if (!page) { problems.push('the browser did not start'); await done(1); }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0; const waiting = new Map();
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') problems.push('uncaught: ' + String((d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description) || d.params.exceptionDetails.text).split('\n')[0]);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') problems.push('console error: ' + d.params.args.map((a) => a.value || a.description).join(' ').slice(0, 160));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url || '')) problems.push('browser error: ' + d.params.entry.text.slice(0, 160));
  });
  const send = (method, params = {}) => new Promise((r) => { const k = ++id; waiting.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const js = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
  const until = async (expression, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expression)) return true; await sleep(250); } problems.push('timed out: ' + what); return false; };
  const size = (w, h, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  const press = (label) => js(`(() => { const b = [...document.querySelectorAll('.ft button')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)}) && !x.disabled); if (b) b.click(); return !!b; })()`);
  // each step: the words it shows, through the copy gate; and at phone width, nothing scrolls sideways
  const read = async (where) => {
    for (const h of copyHits(String(await js(`(document.querySelector('.ft') || {}).innerText || ''`)))) problems.push(where + ' says “' + h.word + '”: ' + h.context.slice(0, 110));
    await size(390, 844, true); await sleep(400);
    const wide = await js(`(() => { const f = document.querySelector('.ft'); return f ? f.scrollWidth - f.clientWidth : 0; })()`);
    if (wide > 1) problems.push(where + ' scrolls sideways at phone width by ' + wide + ' px');
    await size(1280, 800); await sleep(200);
    seen.push(where);
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
  await size(1280, 800);
  await send('Page.navigate', { url });

  // the title: a brand-new player sees the first game, not the classic first screen
  if (!(await until(`!!document.querySelector('.ft .ft-title')`, 90000, 'the first game to open on a first visit'))) await done(1);
  await read('the title');
  // the guide: what it is, what you do, where it runs, how to start, how to build a team, in plain words; then into the tutorial
  await press('What is Kardlings?');
  const GUIDE = ['What it is', 'What you do', 'Where it runs', 'How to start', 'How to build a team for a job'];
  if (!(await until(`[...document.querySelectorAll('.ft h3')].map((h) => h.textContent).join('|') === ${JSON.stringify(GUIDE.concat('Why it matters').join('|'))}`, 10000, 'the guide and its six headings'))) await done(1);
  if ((await js(`document.querySelectorAll('.ft .ft-loop li').length`)) !== 4) problems.push('the guide does not draw the four-step loop');
  await read('the guide');
  await press('Play the tutorial');

  // 1 · your first Kardling: its POWER is its GATE grown here, and the very GATE the drop declared for that card
  if (!(await until(`!!document.querySelector('.ft .ft-power') && document.querySelector('.ft').dataset.gate`, 120000, 'the first Kardling and its POWER'))) await done(1);
  const card = await js(`document.querySelector('.ft').dataset.card`), gate = Number(await js(`document.querySelector('.ft').dataset.gate`));
  const declared = (manifest.cards.find((c) => c.card === card) || {}).gate;
  if (gate !== declared) problems.push('the first Kardling grew GATE ' + gate + ' here, but the drop declared ' + declared);
  const shown = await js(`document.querySelector('.ft .ft-power b').textContent`);
  if (shown !== (gate / 10000).toFixed(1)) problems.push('its POWER reads ' + shown + ', not its GATE ' + gate + ' in hundredths');
  await read('mission 1');
  await press('Fight your first duel');

  // 2 · the first duel, fought to a verdict, and the prize: a second card of the same business
  if (!(await until(`!!document.querySelector('.ft .ft-prize')`, 180000, 'the first duel and its prize'))) await done(1);
  const verdict = await js(`(document.querySelector('.ft .ft-win, .ft .ft-lose') || {}).textContent || ''`);
  if (!/YOU WIN|THE ROOKIE WINS|A DRAW/.test(verdict + (await js(`document.querySelector('.ft').innerText`)))) problems.push('the duel ended without a verdict');
  await read('mission 2 (' + (verdict || 'a draw') + ')');
  await js(`document.querySelector('.ft .ft-prize button').click()`);

  // 3 · the two as a team against the world boss: three numbers, a team bonus read straight, the boss standing or fallen
  if (!(await until(`document.querySelectorAll('.ft .ft-score b').length === 3`, 180000, 'the team against the world boss'))) await done(1);
  const nums = await js(`[...document.querySelectorAll('.ft .ft-score b')].map((b) => b.textContent)`);
  if (!nums.every((n) => /^\d{1,3}\.\d$/.test(n))) problems.push('the team’s numbers are not all read: ' + nums.join(', '));
  await read('mission 3 (boss ' + nums[0] + ', team ' + nums[1] + ', best alone ' + nums[2] + ')');
  await press('Keep your Kardlings');

  // the key file and the map; then start playing: the estate, two cards held, the first game gone and not shown again
  if (!(await until(`!!document.querySelector('.ft .ft-doors')`, 30000, 'the key file and where next'))) await done(1);
  const held = Number(await js(`document.querySelector('.ft').dataset.held`));
  if (held !== 2) problems.push('the first game ends with ' + held + ' cards held, not 2');
  await read('the end');
  await press('Start playing');
  if (!(await until(`location.hash === '#estate' && !document.querySelector('.ft') && document.querySelector('section[data-screen="estate"].on')`, 30000, 'the estate after the first game'))) await done(1);
  seen.push('the estate');
  // a player who holds cards opens the guide by name and goes back to the game from it
  await js(`location.hash = '#what-is-it'`);
  if (!(await until(`!!document.querySelector('.ft .ft-loop') && [...document.querySelectorAll('.ft button')].some((b) => b.textContent.trim() === 'Back to the game')`, 30000, '#what-is-it opening the guide for a player who holds cards'))) await done(1);
  await press('Back to the game');
  if (!(await until(`!document.querySelector('.ft')`, 10000, 'the guide closing'))) await done(1);
  seen.push('#what-is-it, then back');
  await send('Page.reload');
  await sleep(4000);
  if (!(await until(`document.documentElement.classList.contains('game') && !!document.querySelector('section[data-screen].on')`, 90000, 'the second visit'))) await done(1);
  await sleep(3000);
  if (await js(`!!document.querySelector('.ft')`)) problems.push('the first game shows again on a second visit');
  seen.push('a second visit, no tutorial');

  // #first-game opens it again; Skip closes it
  await js(`location.hash = '#first-game'`);
  if (!(await until(`!!document.querySelector('.ft .ft-title')`, 30000, '#first-game opening the first game again'))) await done(1);
  await press('Skip the tutorial');
  if (!(await until(`!document.querySelector('.ft')`, 10000, 'Skip closing the first game'))) await done(1);
  seen.push('#first-game, then skip');
  await done(0);
} catch (e) { problems.push('the play broke: ' + String(e.message || e).slice(0, 160)); await done(1); }
