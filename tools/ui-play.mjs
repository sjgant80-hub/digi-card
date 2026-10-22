#!/usr/bin/env node
// tools/ui-play.mjs — the game view, played: a headless browser opens the page from nothing and plays it the way a
// first-time player does, and the gate fails on anything that does not work. It presses Card me and waits for the boot
// to count up to the score the device computed, which must match the one the drop declared. It then visits every screen
// from the dock, evals a real TEST case, assembles a mesh whose shares must sum to a million, verifies a card on the
// device, switches to the classic view and back, and lays every screen out at phone width without a sideways scroll.
// Any console error, uncaught exception or screen left blank fails it, and so does any word DIGI's copy never uses
// (src/copy.mjs) in the text a screen shows, read on every screen and after every result. It follows the first visit's
// one NEXT path — BOOT → KIT → ARENA → ESTATE → GROW YOUR OWN — searches the Kit for the money side and the ledger's
// own apps, which it never offers, and fuses its two cards in the Fusion lab: kept only if the fused card beats both. Downloads are denied, so nothing is saved.
//   node tools/ui-play.mjs           → UI PLAY OK | UI PLAY BROKEN (exit 1)
//   CHROME=/path/to/chrome node tools/ui-play.mjs
//   SHOTS=dir node tools/ui-play.mjs → also saves the first screen, #boot, #kit, #arena, #estate, #proof, #what and #faq
//                                      at 1280×800 and 390 px wide, with the text each one shows, to dir
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyHits } from '../src/copy.mjs';

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
  // the words a screen shows, quoted seals and sources read past; any word the copy never uses fails the play
  const SHOWN = `(() => { const root = document.documentElement.classList.contains('game') ? (document.querySelector('section[data-screen].on') || document.body) : document.body; const q = [...root.querySelectorAll('[data-quote]')].filter((n) => !n.hidden); q.forEach((n) => { n.hidden = true; }); const text = root.innerText; q.forEach((n) => { n.hidden = false; }); return text; })()`;
  const said = new Set();
  let partyShares = null;   // how many fielded members of this run's world-boss strike measured a share of 1 or more
  const scan = async (where) => {
    for (const h of copyHits(await js(SHOWN))) { const k = where + h.word + h.context; if (!said.has(k)) { said.add(k); problems.push(where + ' says “' + h.word + '”: ' + h.context.slice(0, 110)); } }
    // exactly one filled NEXT on a screen: never two buttons asking to be pressed first
    const filled = await js(`document.documentElement.classList.contains('game') ? [...document.querySelectorAll('section[data-screen].on .g-next')].filter((n) => n.offsetParent !== null).map((n) => n.textContent.trim().slice(0, 30)) : []`);
    if (filled.length > 1 && !said.has(where + '|next')) { said.add(where + '|next'); problems.push(where + ' fills ' + filled.length + ' NEXT buttons: ' + filled.join(' / ')); }
  };
  const SHOTS = process.env.SHOTS || null;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name) => {
    if (!SHOTS) return;
    for (const [w, h, mob, tag] of [[1280, 800, false, '1280'], [390, 844, true, '390']]) {
      await size(w, h, mob); await sleep(700);
      const png = await send('Page.captureScreenshot', { format: 'png' });
      if (png.result && png.result.data) writeFileSync(join(SHOTS, name + '-' + tag + '.png'), Buffer.from(png.result.data, 'base64'));
    }
    writeFileSync(join(SHOTS, name + '.txt'), String(await js(SHOWN)));
    await size(1280, 800); await sleep(300);
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
  await size(1280, 800);
  await send('Page.navigate', { url });
  // the first visit: the game view, the first screen, its one button enabled once the drop has replayed here
  if (!(await until(`document.documentElement.classList.contains('game') && document.querySelector('#first-s.on') && !document.querySelector('#g-first-cardme').disabled`, 60000, 'the first screen and its Card me button'))) await done(1);
  seen.push('first visit');
  await scan('the first screen'); await shot('first');
  await js(`document.querySelector('#g-first-cardme').click()`);
  if (await until(`document.querySelector('#g-boot-say') && document.querySelector('#g-boot-say').textContent.length > 0`, 90000, 'the boot to finish')) {
    const b = await js(`({ steps: [...document.querySelectorAll('#g-boot-steps li')].map((l) => l.className), gate: document.querySelector('#g-boot-gate').textContent, match: document.querySelector('#g-boot-match').textContent, rules: document.querySelectorAll('#g-boot-rules li').length })`);
    if (!b.steps.length || b.steps.some((c) => c !== 'k')) problems.push('a boot step did not pass: ' + b.steps.join(','));
    if (!/matches/i.test(b.match) || !b.match.includes(b.gate)) problems.push('the boot score ' + b.gate + ' is not shown as matching the declared one (' + b.match + ')');
    if (!b.rules) problems.push('the boot printed no rules');
    if (await js(`document.querySelector('#g-boot-card').classList.contains('g-facedown')`)) problems.push('the booted card is still face down');
    const rail = await js(`({ n: document.querySelectorAll('#g-rail a').length, done: document.querySelectorAll('#g-rail a.done').length, now: (document.querySelector('#g-rail a.now') || {}).textContent || '', shown: !document.querySelector('#g-rail').hidden, logo: document.querySelector('.g-logo').classList.contains('painted') })`);
    (rail.shown && rail.n === 5 && rail.done === 2 && /kit/i.test(rail.now)) ? seen.push('the rail: card me ✓ boot ✓, now kit') : problems.push('the rail after boot: ' + JSON.stringify(rail));
    if (!rail.logo) problems.push('DIGI WORLD is not lettered in the bar');
    seen.push('boot ' + b.gate + ' matches');
    await scan('the boot screen'); await shot('boot');
    (await js(`(() => { const n = document.querySelector('#g-boot-next'); return !!n && n.getAttribute('href') === '#kit' && n.offsetParent !== null; })()`)) ? seen.push('BOOT → NEXT · kit it out') : problems.push('the boot screen shows no NEXT to the kit');
  }
  // every screen from the dock: it shows, it is the only one shown, and it is not empty
  for (const s of ['estate', 'base', 'cards', 'arena', 'mint', 'mesh', 'send', 'proof']) {
    await js(`document.querySelector('#g-dock a[data-go="${s}"]').click()`);
    await sleep(700);
    const r = await js(`({ on: [...document.querySelectorAll('section[data-screen].on')].map((x) => x.dataset.screen), current: (document.querySelector('#g-dock a[aria-current="page"]') || {}).dataset?.go, text: [...document.querySelectorAll('section[data-screen].on')].map((x) => x.innerText).join(' ').length })`);
    if (!r.on.length || r.on.some((x) => x !== s)) problems.push('the dock’s ' + s + ' shows ' + (r.on.join(',') || 'nothing'));
    if (r.current !== s) problems.push('the dock does not mark ' + s + ' as the current screen');
    if (r.text < 80) problems.push('the ' + s + ' screen is nearly empty');
    await scan('the ' + s + ' screen');
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
    await scan('an eval');
    seen.push('an eval of a real TEST case');
  }
  // the arena: a rated duel against a drop card, its result shown, then re-fought to the very same receipt
  await js(`location.hash = '#arena'`);
  if (await until(`document.querySelector('#g-ar-foe') && document.querySelector('#g-ar-foe').options.length > 0 && document.querySelector('#g-ar-mine').value`, 30000, 'the arena’s fighters')) {
    await js(`document.querySelector('#g-ar-fight').click()`);
    if (await until(`/You win|They win|A draw|Refused/.test(document.querySelector('#g-ar-result').textContent)`, 60000, 'a duel')) {
      const res = await js(`document.querySelector('#g-ar-result').innerText`), blocks = await js(`document.querySelectorAll('#g-ar-batch i').length`);
      (await js(`(() => { const n = document.querySelector('#g-ar-result #g-ar-next'); return !!n && n.getAttribute('href') === '#estate'; })()`)) ? seen.push('ARENA → NEXT · see your estate') : problems.push('the duel’s result shows no NEXT to the estate');
      if (/Refused/.test(res)) problems.push('the duel was refused: ' + res.slice(0, 120));
      else if (blocks !== 64) problems.push('the duel showed ' + blocks + ' cases, not 64');
      else {
        await js(`document.querySelector('#g-ar-rerun').click()`);
        if (await until(`/Re-fought here|✗/.test(document.querySelector('#g-ar-result').textContent)`, 30000, 'the duel re-fought'))
          (await js(`/Re-fought here: the very same receipt/.test(document.querySelector('#g-ar-result').textContent)`)) ? seen.push('a rated duel, re-fought to the same receipt') : problems.push('the duel did not re-fight to the same receipt');
        await scan('a duel');
        // watched back: fought again from its receipt, 64 cases laid out, and one read back by the rules that fired
        await js(`document.querySelector('#g-ar-watch').click()`);
        if (await until(`/The very same receipt|✗/.test(document.querySelector('#g-ar-watch-line').textContent)`, 60000, 'the duel watched back')) {
          const w = await js(`({ line: document.querySelector('#g-ar-watch-line').textContent, cases: document.querySelectorAll('#g-ar-watch-out .g-case').length })`);
          if (!/The very same receipt/.test(w.line) || w.cases !== 64) problems.push('watched back: ' + w.line.slice(0, 140) + ' (' + w.cases + ' cases)');
          else {
            await js(`document.querySelector('#g-ar-watch-out .g-case').click()`);
            (await until(`/Yours · /.test(document.querySelector('#g-ar-readback').textContent) && /Theirs · /.test(document.querySelector('#g-ar-readback').textContent)`, 10000, 'a case read back')) ? seen.push('a duel watched back to the very same receipt, 64 cases, one read back by the rules that fired') : null;
          }
          await scan('a duel watched back');
        }
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
      await scan('a raid strike');
    }
  }
  // the kit: a node minted by a real search (searching again while one falls under the bar), an app tool minted from the
  // records, the kitted mind measured, the loadout signed, then a kitted duel fought and re-fought to the same receipt
  await js(`location.hash = '#kit'`);
  if (await until(`document.querySelector('#g-kit-card') && document.querySelector('#g-kit-card').value && [...document.querySelectorAll('#g-kit-depts button')].length > 0 && document.querySelectorAll('#g-kit-apps button').length > 0`, 60000, 'the kit screen, its departments and its apps')) {
    for (const q of ['kcc', 'agora', 'fallherd']) {
      await js(`(() => { const i = document.querySelector('#g-kit-q'); i.value = '${q}'; i.dispatchEvent(new Event('input')); })()`); await sleep(300);
      const listed = await js(`[...document.querySelectorAll('#g-kit-apps b')].map((b) => b.textContent)`);
      if (listed.length) problems.push('the Kit offers ' + listed.slice(0, 5).join(', ') + ' for “' + q + '”');
    }
    await js(`(() => { const i = document.querySelector('#g-kit-q'); i.value = ''; i.dispatchEvent(new Event('input')); })()`); await sleep(300);
    if (await js(`document.querySelectorAll('#g-kit-apps button').length > 0`)) seen.push('the Kit offers no kcc, agora or fallherd app');
    else problems.push('the Kit lists no app once its search is cleared');
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
      // the tool opens in its box: here the estate's pages are on another address, so the box says so and offers its own tab
      await js(`[...document.querySelectorAll('#g-kit-tools .g-kslot.full button')].find((x) => x.textContent === 'Open').click()`);
      if (await until(`!document.querySelector('#g-box').hidden && document.querySelectorAll('#g-box-asked li').length > 0 && !/Reading/.test(document.querySelector('#g-box-asked').textContent)`, 20000, 'the tool’s box')) {
        const bx = await js(`({ asked: document.querySelector('#g-box-asked').textContent, src: document.querySelector('#g-box-frame').getAttribute('src'), sandbox: document.querySelector('#g-box-frame').getAttribute('sandbox') })`);
        (bx.sandbox === 'allow-scripts allow-forms' && bx.src === null && /another address/.test(bx.asked)) ? seen.push('a tool’s box: exactly scripts and forms, and a page on another address never framed') : problems.push('the tool’s box: ' + JSON.stringify(bx).slice(0, 200));
        await js(`document.querySelector('#g-box-close').click()`);
      }
      await js(`document.querySelector('#g-kit-measure-go').click()`);
      if (await until(`/Kitted \\d\\.\\d{6}/.test(document.querySelector('#g-kit-measure').textContent)`, 60000, 'the kit measured')) {
        const m = await js(`document.querySelector('#g-kit-measure').innerText`);
        /Node 1 · \w+-\w+[\s\S]*adds [+-]\d/.test(m) ? seen.push('the kit measured, every slot with what it adds') : problems.push('the kit measure shows no slot adding: ' + m.slice(0, 160));
        await scan('the kit, measured'); await shot('kit');
      }
      await js(`document.querySelector('#g-kit-equip').click()`);
      if (await until(`/Equipped|Refused/.test(document.querySelector('#g-kit-out').textContent)`, 30000, 'the kit equipped')) {
        if (!(await js(`/Equipped/.test(document.querySelector('#g-kit-out').textContent)`))) problems.push('equip: ' + (await js(`document.querySelector('#g-kit-out').textContent`)).slice(0, 120));
        else {
          (await js(`(() => { const n = document.querySelector('#g-kit-out #g-kit-next'); return !!n && n.getAttribute('href') === '#arena'; })()`)) ? seen.push('KIT → NEXT · fight in the arena') : problems.push('the kit, equipped, shows no NEXT to the arena');
          await js(`location.hash = '#arena'`);
          if (await until(`/kitted · 1 node, 1 tool/.test(document.querySelector('#g-ar-a-line').textContent)`, 30000, 'the fighter shown kitted')) {
            await js(`document.querySelector('#g-ar-result').textContent = ''; document.querySelector('#g-ar-fight').click()`);
            if (await until(`/You win|They win|A draw|Refused/.test(document.querySelector('#g-ar-result').textContent)`, 60000, 'a kitted duel')) {
              const res = await js(`document.querySelector('#g-ar-result').innerText`);
              await scan('a kitted duel'); await shot('arena');
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
  // Kit it for me: the DIGI's other cards of its business tried one slot at a time, each step a measured lift, or nothing
  await js(`location.hash = '#kit'`);
  if (await until(`document.querySelector('#g-kit-auto') && document.querySelector('#g-kit-card').value`, 30000, 'the kit, for Kit it for me')) {
    await js(`document.querySelector('#g-kit-auto').click()`);
    if (await until(`/Kitted for you|Nothing of yours lifts it|could not|must/.test(document.querySelector('#g-kit-measure').textContent)`, 120000, 'Kit it for me')) {
      const a = await js(`({ text: document.querySelector('#g-kit-measure').innerText, steps: [...document.querySelectorAll('#g-kit-measure li')].map((l) => l.textContent) })`);
      // innerText carries the CSS case (the heading is lettered in capitals), so the words are matched case-blind
      if (/Kitted for you/i.test(a.text)) (a.steps.length >= 1 && a.steps.every((s) => /adds \+0\.\d{6}/.test(s))) ? seen.push('Kit it for me: ' + a.steps.length + ' step' + (a.steps.length === 1 ? '' : 's') + ', each a measured lift') : problems.push('Kit it for me: ' + a.text.replace(/\s+/g, ' ').slice(0, 160));
      else if (/Nothing of yours lifts it/i.test(a.text)) a.steps.length === 0 ? seen.push('Kit it for me: nothing of yours lifts it, and nothing is put in a slot') : problems.push('Kit it for me listed steps it did not take');
      else problems.push('Kit it for me: ' + a.text.replace(/\s+/g, ' ').slice(0, 160));
      await scan('Kit it for me');
    }
  }
  // the estate, drawn from only what DIGI holds: with the tool and the kit above, its TOOLS and KITTED districts open
  await js(`location.hash = '#estate'`);
  if (await until(`/Scorer \\d+ tiles/.test(document.querySelector('[data-k="g-plot-open"]').textContent)`, 30000, 'the estate drawn')) {
    const plot = await js(`document.querySelector('[data-k="g-plot-open"]').textContent + ' | ' + document.querySelector('#g-plot-rule').textContent`);
    if (/could not be drawn/.test(plot) || !/tools 10 · kitted 10/.test(plot)) problems.push('the estate: ' + plot.slice(0, 160));
    else seen.push('the estate drawn from what DIGI holds, its tool and its kit in their districts');
    await scan('the estate'); await shot('estate');
    // the map's doors (PixelWhisperer's estateDoors): eight real links under it, and a tap on the picture goes through the
    // door under it — the FUSION landmark, the middle of the five along the bottom, opens the Fusion Lab
    const doors = await js(`[...document.querySelectorAll('#g-plot-doors a')].map((a) => a.textContent + '>' + a.getAttribute('href')).join(' ')`);
    if (doors !== 'SCORER>#cards TOOLS>#kit KITTED>#kit ARENA>#arena RAIDS>#raids FUSION>#fusion MINT>#mint PROOF>#proof') problems.push('the estate doors: ' + doors);
    else {
      await js(`(() => { const c = document.querySelector('#g-plot'), r = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.9 })); })()`);
      (await until(`location.hash === '#fusion'`, 5000, 'the FUSION door')) ? seen.push('the estate’s eight doors, and a tap on FUSION opens the Fusion Lab') : problems.push('a tap on the FUSION landmark did not open the Fusion Lab');
      await js(`location.hash = '#estate'`); await sleep(600);
    }
    (await js(`(() => { const n = document.querySelector('#g-estate-next'); return !!n && n.getAttribute('href') === '#mint' && n.offsetParent !== null; })()`)) ? seen.push('ESTATE → NEXT · grow your own') : problems.push('the estate shows no NEXT to grow your own');
  }
  // the fusion lab: the DIGI and its minted node, two cards of one business, fused — kept only if the fused card beats
  // both parents and re-runs, or refused with its numbers; either way one NEXT, the lineage and organ 4's sealed verdicts
  await js(`location.hash = '#fusion'`);
  if (await until(`document.querySelector('#g-fu-b') && document.querySelector('#g-fu-b').value && !document.querySelector('#g-fu-go').disabled && document.querySelectorAll('#g-fu-proof li').length > 0`, 30000, 'the fusion lab with two parents and organ 4’s verdicts')) {
    await scan('the fusion lab');
    await js(`document.querySelector('#g-fu-go').click()`);
    if (await until(`/Kept · a fused card|Refused: no fused card beat both/.test(document.querySelector('#g-fu-out').textContent) || !!document.querySelector('#g-fu-out .g-badt')`, 300000, 'a fusion')) {
      const f = await js(`({ out: document.querySelector('#g-fu-out').innerText, kept: /Kept · a fused card/.test(document.querySelector('#g-fu-out').textContent), next: (document.querySelector('#g-fu-out #g-fu-next') || {}).getAttribute?.('href') || null, tree: document.querySelectorAll('#g-fu-lineage li').length })`);
      // the fusion and its family tree, drawn by PixelWhisperer from the fusion's own record and the seals held here
      await until(`!document.querySelector('#g-fu-art').hidden && !document.querySelector('#g-fu-tree').hidden`, 20000, 'the fusion and its family tree drawn');
      if (await js(`!document.querySelector('#g-fu-art').hidden && !document.querySelector('#g-fu-tree').hidden`)) seen.push('the fusion and its family tree drawn');
      if (f.kept) (/Re-run here: it holds/.test(f.out) && f.next === '#kit' && f.tree >= 3) ? seen.push('a fusion kept, beating both parents, re-run here, its lineage ' + f.tree + ' deep, NEXT · kit the fused card') : problems.push('the kept fusion: ' + f.out.replace(/\s+/g, ' ').slice(0, 160) + ' (next ' + f.next + ', lineage ' + f.tree + ')');
      else if (/Refused: no fused card beat both/i.test(f.out)) (f.next === '#fusion' && /tries? ran here/.test(f.out)) ? seen.push('a fusion refused with its numbers, NEXT · pick another pair') : problems.push('the refused fusion: ' + f.out.replace(/\s+/g, ' ').slice(0, 160));
      else problems.push('the fusion: ' + f.out.replace(/\s+/g, ' ').slice(0, 160));
      await scan('a fusion'); await shot('fusion');
    }
  }
  // the campaign: every business a chapter, read from the receipts — exactly one marked now until all are cleared
  await js(`location.hash = '#raids'`);
  if (await until(`document.querySelectorAll('#g-cp-chapters li').length > 0`, 30000, 'the campaign')) {
    const cp = await js(`({ n: document.querySelectorAll('#g-cp-chapters li').length, now: [...document.querySelectorAll('#g-cp-chapters li')].filter((l) => / · now/.test(l.textContent)).length, first: (document.querySelector('#g-cp-chapters li') || {}).textContent || '' })`);
    (cp.n === 6 && cp.now === 1 && /^Chapter 1 · /.test(cp.first)) ? seen.push('the campaign: 6 chapters, one now') : problems.push('the campaign: ' + JSON.stringify(cp));
    await scan('the campaign');
  }
  // the tournament: the player's telco cards in a bracket, each open match one practice duel away, played to a champion
  await js(`location.hash = '#arena'`);
  if (await until(`[...document.querySelectorAll('#g-tn-rounds li')].length > 0`, 30000, 'the tournament')) {
    for (let n = 0; n < 6 && await js(`!!document.querySelector('#g-tn-rounds button')`); n++) {
      const before = await js(`document.querySelector('#g-tn-rounds').textContent`);
      await js(`document.querySelector('#g-tn-rounds button').click()`);
      if (!(await until(`document.querySelector('#g-tn-rounds').textContent !== ${JSON.stringify(before)} || /could not/.test(document.querySelector('#g-tn-title').textContent)`, 60000, 'a tournament match'))) break;
    }
    const tn = await js(`({ title: document.querySelector('#g-tn-title').textContent, open: [...document.querySelectorAll('#g-tn-rounds li')].filter((l) => / open$/.test(l.textContent)).length })`);
    /Practice champion: #\d{4} /.test(tn.title) && tn.open === 0 ? seen.push('a tournament of your cards played to a practice champion: a title, and nothing else') : problems.push('the tournament: ' + JSON.stringify(tn));
    await scan('the tournament');
  }
  // a world boss: the player's own telco cards strike it as a party, and strike again to the very same receipt
  await js(`location.hash = '#raids'`);
  if (await until(`[...document.querySelectorAll('#g-pt-bosses .g-boss h3')].some((h) => /Telecom/.test(h.textContent))`, 30000, 'the world bosses')) {
    await js(`[...document.querySelectorAll('#g-pt-bosses .g-boss')].find((b) => /Telecom/.test(b.querySelector('h3').textContent)).querySelector('button').click()`);
    if (await until(`/party scored|could not strike/.test(document.querySelector('#g-pt-out').textContent)`, 120000, 'a party strike')) {
      const out = await js(`document.querySelector('#g-pt-out').innerText`);
      await scan('a party strike');
      partyShares = [...out.matchAll(/share ([\d,]+)/g)].filter((m) => Number(m[1].replace(/,/g, '')) >= 1).length;
      if (!/party scored \d\.\d{6} on GATE against the bar \d\.\d{6}/.test(out) || !/share [\d,]+/.test(out)) problems.push('the party strike: ' + out.slice(0, 160));
      else {
        await js(`[...document.querySelectorAll('#g-pt-bosses .g-boss')].find((b) => /Telecom/.test(b.querySelector('h3').textContent)).querySelector('button.cy').click()`);
        if (await until(`/Struck again here|✗/.test(document.querySelector('#g-pt-out').textContent)`, 60000, 'the party struck again'))
          (await js(`/Struck again here: the very same receipt/.test(document.querySelector('#g-pt-out').textContent)`)) ? seen.push('a world boss struck by a party, struck again to the same receipt') : problems.push('the party did not strike again to the same receipt');
      }
    }
  }
  // the record: brought up to date through every gate, then replayed from nothing
  await js(`location.hash = '#proof'`);
  if (await until(`document.querySelector('#g-rec-go')`, 20000, 'the record panel')) {
    await js(`document.querySelector('#g-rec-go').click()`);
    if (await until(`/new entr|✗|Error/.test(document.querySelector('#g-rec-out').textContent)`, 120000, 'the record brought up to date')) {
      const st = await js(`document.querySelector('#g-rec-stats').innerText`), out = await js(`document.querySelector('#g-rec-out').innerText`);
      const rel = Number((/Releases\s+(\d+)/.exec(st) || [])[1] || 0), val = Number((/Values measured\s+(\d+)/.exec(st) || [])[1] || 0);
      await scan('the record');
      if (!/✓/.test(out) || rel < 3 || (partyShares === null || val !== partyShares) || !/switch\s+off/i.test(st)) problems.push('the record: ' + (out + ' | ' + st).replace(/\s+/g, ' ').slice(0, 200));
      else {
        await js(`document.querySelector('#g-rec-replay').click()`);
        if (await until(`/Replayed here|✗/.test(document.querySelector('#g-rec-out').textContent)`, 120000, 'the record replayed'))
          (await js(`/Replayed here from nothing/.test(document.querySelector('#g-rec-out').textContent)`)) ? seen.push('the record: ' + rel + ' releases and ' + val + ' value' + (val === 1 ? '' : 's') + ' (one a fielded member with a measured share)' + ', each through its gate, replayed from nothing, the switch off') : problems.push('the record did not replay: ' + (await js(`document.querySelector('#g-rec-out').textContent`)).slice(0, 120));
      }
    }
  }
  // the mesh: assembled, the fielded cards shown, their shares a million between them
  await js(`location.hash = '#mesh'`); await sleep(400);
  await js(`document.querySelector('#mesh-set').value = 'telco'; document.querySelector('#mesh-build').click()`);
  if (await until(`document.querySelectorAll('#g-meshslots .g-slot').length > 0`, 120000, 'the mesh')) {
    const shares = await js(`[...document.querySelectorAll('#g-meshslots .g-slot b')].map((b) => Number(b.textContent.replace(/[^0-9]/g, '')))`);
    const sum = shares.reduce((a, b) => a + b, 0);
    if (sum !== 1000000) problems.push('the mesh shares sum to ' + sum + ', not 1,000,000');
    await scan('a mesh');
    seen.push('mesh of ' + shares.length + ', shares sum to 1,000,000');
  }
  // the proof explorer: the card verified on this device
  await js(`location.hash = '#proof'`); await sleep(1200);
  await js(`document.querySelector('#g-verify').click()`);
  if (await until(`/Every check passed|Refused|registry/.test(document.querySelector('#g-verify-ms').textContent)`, 30000, 'verify on this device')) {
    const v = await js(`document.querySelector('#g-verify-ms').textContent`);
    if (!/Every check passed/.test(v)) problems.push('verify on this device: ' + v);
    else seen.push('verified on the device');
    await scan('the proof explorer, verified'); await shot('proof');
  }
  // the inbox: a drop card dropped in, checked on this device, shown face down with its maker's mark, then turned face up
  await js(`location.hash = '#send'`); await sleep(600);
  const doc = await send('DOM.getDocument', { depth: -1 }), input = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#open-file' });
  if (!input.result || !input.result.nodeId) problems.push('the Inbox has no file input');
  else {
    await send('DOM.setFileInputFiles', { nodeId: input.result.nodeId, files: [join(root, 'cards', '0002.png')] });
    if (await until(`!document.querySelector('#g-inbox-box').hidden && /It checks|It is yours/.test(document.querySelector('#open-report').textContent) && !document.querySelector('#g-inbox-card').classList.contains('g-facedown') && !document.querySelector('#g-inbox-card').classList.contains('g-flipping')`, 60000, 'a card opened in the Inbox, turned face up'))
      (await js(`/^The card you opened: /.test(document.querySelector('#g-inbox-card').getAttribute('aria-label'))`)) ? seen.push('a card opened in the Inbox, checked here, face down then face up') : problems.push('the Inbox card did not turn face up');
    await scan('the inbox');
  }
  // the classic view and back
  await js(`document.querySelector('#g-classic').click()`); await sleep(400);
  if (await js(`document.documentElement.classList.contains('game')`)) problems.push('Classic view did not leave the game view');
  await scan('the classic view');
  for (const s of ['what', 'faq']) { await js(`document.getElementById('${s}').scrollIntoView()`); await sleep(300); await shot(s); }
  await js(`document.querySelector('#g-back').click()`); await sleep(600);
  if (!(await js(`document.documentElement.classList.contains('game') && !!document.querySelector('section[data-screen].on')`))) problems.push('Back to the game view did not return to a screen');
  else seen.push('classic view and back');
  // phone width: every screen holds without a sideways scroll
  await size(390, 844, true); await sleep(400);
  const wide = [], untitled = [];
  for (const s of ['estate', 'base', 'cards', 'kit', 'fusion', 'arena', 'raids', 'evals', 'mint', 'mesh', 'send', 'proof', 'boot', 'about']) {
    await js(`location.hash = '#${s}'`); await sleep(500);
    const w = await js(`document.documentElement.scrollWidth`);
    // a screen too wide names what pushes it: the widest-reaching element, so the next fix starts from the culprit
    if (w > 392) wide.push(s + ' ' + w + 'px (' + (await js(`(() => { const W = document.documentElement.clientWidth; let best = null, r = 0; for (const n of document.querySelectorAll('section[data-screen].on *')) { const b = n.getBoundingClientRect(); if (b.width && b.right > r && b.right > W) { r = b.right; best = n; } } return best ? best.tagName.toLowerCase() + (best.id ? '#' + best.id : '') + (typeof best.className === 'string' && best.className ? '.' + best.className.trim().split(' ').filter(Boolean).join('.') : '') + ' → ' + Math.round(r) + 'px' : 'none in the screen'; })()`)) + ')');
    // every screen names itself in the tab (the Fusion Lab and About read "undefined" until 2026-10-22)
    if (await js(`/^undefined|^ ·|^·/.test(document.title)`)) untitled.push(s);
  }
  if (wide.length) problems.push('wider than a 390 px phone: ' + wide.join(', '));
  else seen.push('every screen fits 390 px');
  if (untitled.length) problems.push('a screen with no title in the tab: ' + untitled.join(', '));
  else seen.push('every screen names itself in the tab');
  await done(problems.length ? 1 : 0);
} catch (e) { problems.push(String((e && e.message) || e)); await done(1); }
