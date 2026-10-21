#!/usr/bin/env node
// tools/ui-play.mjs — the game view, played: a headless browser opens the page from nothing and plays it the way a
// first-time player does, and the gate fails on anything that does not work. It presses Card me and waits for the boot
// to count up to the score the device computed, which must match the one the drop declared. It then visits every screen
// from the dock, evals a real TEST case, assembles a mesh whose shares must sum to a million, verifies a card on the
// device, switches to the classic view and back, and lays every screen out at phone width without a sideways scroll.
// Any console error, uncaught exception or screen left blank fails it. Downloads are denied, so nothing is saved.
//   node tools/ui-play.mjs           → UI PLAY OK | UI PLAY BROKEN (exit 1)
//   CHROME=/path/to/chrome node tools/ui-play.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROMES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const chrome = CHROMES.find((p) => existsSync(p));
if (!chrome) { console.log('UI PLAY BROKEN · no Chrome found (set CHROME)'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 8900 + Math.floor(Math.random() * 90), dbg = 9400 + Math.floor(Math.random() * 90), url = 'http://127.0.0.1:' + port + '/';
const root = fileURLToPath(new URL('../', import.meta.url)), profile = mkdtempSync(join(tmpdir(), 'digi-ui-'));
const server = spawn(process.execPath, [join(root, 'tools/serve.mjs'), String(port)], { stdio: 'ignore' });
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--remote-debugging-port=' + dbg, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
const problems = [], seen = [];
let ws = null;
async function done(code) {
  try { ws && ws.close(); } catch { /* closing */ }
  browser.kill(); server.kill(); await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold it */ }
  console.log(problems.length ? 'UI PLAY BROKEN · ' + problems.join('; ') + (seen.length ? ' (played: ' + seen.join(' · ') + ')' : '') : 'UI PLAY OK · ' + seen.join(' · '));
  process.exit(code);
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
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url || '')) problems.push('browser error: ' + d.params.entry.text.slice(0, 160) + (d.params.entry.url ? ' (' + d.params.entry.url.replace(url, '') + ')' : ''));
  });
  const send = (method, params = {}) => new Promise((r) => { const k = ++id; waiting.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const js = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
  const until = async (expression, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expression)) return true; await sleep(250); } problems.push('timed out: ' + what); return false; };
  const size = (w, h, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
  await size(1280, 800);
  await send('Page.navigate', { url });
  // the first visit: the game view, the first screen, its one button enabled once the drop has replayed here
  if (!(await until(`document.documentElement.classList.contains('game') && document.querySelector('#first-s.on') && !document.querySelector('#g-first-cardme').disabled`, 60000, 'the first screen and its Card me button'))) await done(1);
  seen.push('first visit');
  await js(`document.querySelector('#g-first-cardme').click()`);
  if (await until(`document.querySelector('#g-boot-say') && document.querySelector('#g-boot-say').textContent.length > 0`, 90000, 'the boot to finish')) {
    const b = await js(`({ steps: [...document.querySelectorAll('#g-boot-steps li')].map((l) => l.className), gate: document.querySelector('#g-boot-gate').textContent, match: document.querySelector('#g-boot-match').textContent, rules: document.querySelectorAll('#g-boot-rules li').length })`);
    if (!b.steps.length || b.steps.some((c) => c !== 'k')) problems.push('a boot step did not pass: ' + b.steps.join(','));
    if (!/matches/i.test(b.match) || !b.match.includes(b.gate)) problems.push('the boot score ' + b.gate + ' is not shown as matching the declared one (' + b.match + ')');
    if (!b.rules) problems.push('the boot printed no rules');
    seen.push('boot ' + b.gate + ' matches');
  }
  // every screen from the dock: it shows, it is the only one shown, and it is not empty
  for (const s of ['estate', 'base', 'cards', 'arena', 'mint', 'mesh', 'send', 'proof']) {
    await js(`document.querySelector('#g-dock a[data-go="${s}"]').click()`);
    await sleep(700);
    const r = await js(`({ on: [...document.querySelectorAll('section[data-screen].on')].map((x) => x.dataset.screen), current: (document.querySelector('#g-dock a[aria-current="page"]') || {}).dataset?.go, text: [...document.querySelectorAll('section[data-screen].on')].map((x) => x.innerText).join(' ').length })`);
    if (!r.on.length || r.on.some((x) => x !== s)) problems.push('the dock’s ' + s + ' shows ' + (r.on.join(',') || 'nothing'));
    if (r.current !== s) problems.push('the dock does not mark ' + s + ' as the current screen');
    if (r.text < 80) problems.push('the ' + s + ' screen is nearly empty');
  }
  seen.push('8 screens from the dock');
  // the "i" taps: every one opens a plain sentence, and closes it again
  await js(`location.hash = '#base'`); await sleep(500);
  const taps = await js(`(() => { const all = [...document.querySelectorAll('section[data-screen].on .g-i')]; let ok = 0; for (const b of all) { b.click(); const p = b.closest('[data-info]') ? (b.closest('[data-info]').nextElementSibling || {}) : b.parentElement.nextElementSibling; const shown = p && p.classList && p.classList.contains('g-info') && !p.hidden && p.textContent.length > 20; b.click(); if (shown && p.hidden) ok++; } return [ok, all.length]; })()`);
  if (!taps || !taps[1] || taps[0] !== taps[1]) problems.push('the base screen’s "i" taps: ' + (taps ? taps[0] + ' of ' + taps[1] : 'none') + ' open and close their sentence');
  else seen.push(taps[1] + ' “i” taps open and close');
  // an eval: a real TEST case, and what really happened
  await js(`location.hash = '#evals'`); await sleep(500);
  await js(`document.querySelector('#g-eval-run').click()`);
  if (await until(`document.querySelector('#g-eval-out h3')`, 30000, 'an eval')) {
    const e = await js(`document.querySelector('#g-eval-out').innerText`);
    if (!/What really happened|Abstained/.test(e)) problems.push('the eval does not say what really happened');
    seen.push('an eval of a real TEST case');
  }
  // the arena: a rated duel against a drop card, its result shown, then re-fought to the very same receipt
  await js(`location.hash = '#arena'`);
  if (await until(`document.querySelector('#g-ar-foe') && document.querySelector('#g-ar-foe').options.length > 0 && document.querySelector('#g-ar-mine').value`, 30000, 'the arena’s fighters')) {
    await js(`document.querySelector('#g-ar-fight').click()`);
    if (await until(`/You win|They win|A draw|Refused/.test(document.querySelector('#g-ar-result').textContent)`, 60000, 'a duel')) {
      const res = await js(`document.querySelector('#g-ar-result').innerText`), blocks = await js(`document.querySelectorAll('#g-ar-batch i').length`);
      if (/Refused/.test(res)) problems.push('the duel was refused: ' + res.slice(0, 120));
      else if (blocks !== 64) problems.push('the duel showed ' + blocks + ' cases, not 64');
      else {
        await js(`document.querySelector('#g-ar-rerun').click()`);
        if (await until(`/Re-fought here|✗/.test(document.querySelector('#g-ar-result').textContent)`, 30000, 'the duel re-fought'))
          (await js(`/Re-fought here: the very same receipt/.test(document.querySelector('#g-ar-result').textContent)`)) ? seen.push('a rated duel, re-fought to the same receipt') : problems.push('the duel did not re-fight to the same receipt');
      }
    }
  }
  // a raid: one strike on the smallest boss's records, signed and re-checked here
  await js(`location.hash = '#raids'`);
  if (await until(`[...document.querySelectorAll('#g-rd-bosses .g-boss h3')].some((h) => /credit billing/.test(h.textContent))`, 30000, 'the raid bosses')) {
    await js(`[...document.querySelectorAll('#g-rd-bosses .g-boss')].find((b) => /credit billing/.test(b.querySelector('h3').textContent)).querySelector('button').click()`);
    if (await until(`/on GATE|could not|did not check/.test(document.querySelector('#g-rd-out').textContent)`, 240000, 'a raid strike')) {
      const out = await js(`document.querySelector('#g-rd-out').textContent`);
      /re-checked here/.test(out) ? seen.push('a raid strike, signed and re-checked') : problems.push('the raid strike: ' + out.slice(0, 120));
    }
  }
  // the kit: a node minted by a real search (searching again while one falls under the bar), an app tool minted from the
  // records, the kitted mind measured, the loadout signed, then a kitted duel fought and re-fought to the same receipt
  await js(`location.hash = '#kit'`);
  if (await until(`document.querySelector('#g-kit-card') && document.querySelector('#g-kit-card').value && [...document.querySelectorAll('#g-kit-depts button')].length > 0 && document.querySelectorAll('#g-kit-apps button').length > 0`, 60000, 'the kit screen, its departments and its apps')) {
    let minted = false;
    for (let t = 0; t < 5 && !minted; t++) {
      await js(`document.querySelector('#g-kit-depts button:not([disabled])').click()`);
      if (!(await until(`/Minted|nothing is minted|could not|did not check/.test(document.querySelector('#g-kit-mint-out').textContent) && !document.querySelector('#g-kit-depts button[disabled]')`, 240000, 'a node search'))) break;
      const out = await js(`document.querySelector('#g-kit-mint-out').textContent`);
      if (/could not|did not check/.test(out)) { problems.push('the node search: ' + out.slice(0, 120)); break; }
      minted = /Minted/.test(out);
    }
    if (minted) {
      seen.push('a node minted by a search from the key');
      await js(`document.querySelector('#g-kit-apps button').click()`);
      if (await until(`/is yours/.test(document.querySelector('#g-kit-out').textContent) && document.querySelectorAll('#g-kit-tools .g-kslot.full').length === 1`, 30000, 'an app tool in a slot')) seen.push('an app tool minted into a slot');
      await js(`document.querySelector('#g-kit-measure-go').click()`);
      if (await until(`/Kitted \\d\\.\\d{6}/.test(document.querySelector('#g-kit-measure').textContent)`, 60000, 'the kit measured')) {
        const m = await js(`document.querySelector('#g-kit-measure').innerText`);
        /Node 1 · \w+-\w+[\s\S]*worth [+-]\d/.test(m) ? seen.push('the kit measured, every slot with its worth') : problems.push('the kit measure shows no slot worth: ' + m.slice(0, 160));
      }
      await js(`document.querySelector('#g-kit-equip').click()`);
      if (await until(`/Equipped|Refused/.test(document.querySelector('#g-kit-out').textContent)`, 30000, 'the kit equipped')) {
        if (!(await js(`/Equipped/.test(document.querySelector('#g-kit-out').textContent)`))) problems.push('equip: ' + (await js(`document.querySelector('#g-kit-out').textContent`)).slice(0, 120));
        else {
          await js(`location.hash = '#arena'`);
          if (await until(`/kitted · 1 node, 1 tool/.test(document.querySelector('#g-ar-a-line').textContent)`, 30000, 'the fighter shown kitted')) {
            await js(`document.querySelector('#g-ar-result').textContent = ''; document.querySelector('#g-ar-fight').click()`);
            if (await until(`/You win|They win|A draw|Refused/.test(document.querySelector('#g-ar-result').textContent)`, 60000, 'a kitted duel')) {
              const res = await js(`document.querySelector('#g-ar-result').innerText`);
              if (!/Yours fought kitted · 1 node, 1 tool/.test(res)) problems.push('the kitted duel: ' + res.slice(0, 160));
              else {
                await js(`document.querySelector('#g-ar-rerun').click()`);
                if (await until(`/Re-fought here|✗/.test(document.querySelector('#g-ar-result').textContent)`, 30000, 'the kitted duel re-fought'))
                  (await js(`/Re-fought here: the very same receipt/.test(document.querySelector('#g-ar-result').textContent)`)) ? seen.push('a kitted duel, re-fought to the same receipt') : problems.push('the kitted duel did not re-fight to the same receipt');
              }
            }
          }
        }
      }
    } else if (!problems.length) problems.push('five node searches and none cleared the bar');
  }
  // the mesh: assembled, the fielded cards shown, their shares a million between them
  await js(`location.hash = '#mesh'`); await sleep(400);
  await js(`document.querySelector('#mesh-set').value = 'telco'; document.querySelector('#mesh-build').click()`);
  if (await until(`document.querySelectorAll('#g-meshslots .g-slot').length > 0`, 120000, 'the mesh')) {
    const shares = await js(`[...document.querySelectorAll('#g-meshslots .g-slot b')].map((b) => Number(b.textContent.replace(/[^0-9]/g, '')))`);
    const sum = shares.reduce((a, b) => a + b, 0);
    if (sum !== 1000000) problems.push('the mesh shares sum to ' + sum + ', not 1,000,000');
    seen.push('mesh of ' + shares.length + ', shares sum to 1,000,000');
  }
  // the proof explorer: the card verified on this device
  await js(`location.hash = '#proof'`); await sleep(1200);
  await js(`document.querySelector('#g-verify').click()`);
  if (await until(`/Every check passed|Refused|registry/.test(document.querySelector('#g-verify-ms').textContent)`, 30000, 'verify on this device')) {
    const v = await js(`document.querySelector('#g-verify-ms').textContent`);
    if (!/Every check passed/.test(v)) problems.push('verify on this device: ' + v);
    else seen.push('verified on the device');
  }
  // the classic view and back
  await js(`document.querySelector('#g-classic').click()`); await sleep(400);
  if (await js(`document.documentElement.classList.contains('game')`)) problems.push('Classic view did not leave the game view');
  await js(`document.querySelector('#g-back').click()`); await sleep(600);
  if (!(await js(`document.documentElement.classList.contains('game') && !!document.querySelector('section[data-screen].on')`))) problems.push('Back to the game view did not return to a screen');
  else seen.push('classic view and back');
  // phone width: every screen holds without a sideways scroll
  await size(390, 844, true); await sleep(400);
  const wide = [];
  for (const s of ['estate', 'base', 'cards', 'kit', 'arena', 'raids', 'evals', 'mint', 'mesh', 'send', 'proof', 'boot']) {
    await js(`location.hash = '#${s}'`); await sleep(500);
    const w = await js(`document.documentElement.scrollWidth`);
    if (w > 392) wide.push(s + ' ' + w + 'px');
  }
  if (wide.length) problems.push('wider than a 390 px phone: ' + wide.join(', '));
  else seen.push('every screen fits 390 px');
  await done(problems.length ? 1 : 0);
} catch (e) { problems.push(String((e && e.message) || e)); await done(1); }
