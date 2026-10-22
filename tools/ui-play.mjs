#!/usr/bin/env node
// tools/ui-play.mjs — the game view, played: a headless browser opens the page from nothing and plays it the way a
// first-time player does, and the gate fails on anything that does not work. It presses Card me and waits for the boot
// to count up to the score the device computed, which must match the one the drop declared. It then visits every screen
// from the dock, evals a real TEST case, assembles a mesh whose shares must sum to a million, verifies a card on the
// device, switches to the classic view and back, and lays every screen out at phone width without a sideways scroll.
// Any console error, uncaught exception or screen left blank fails it, and so does any word DIGI's copy never uses
// (src/copy.mjs) in the text a screen shows, read on every screen and after every result. It follows the first visit's
// one NEXT path — BOOT → KIT → ARENA → ESTATE → GROW YOUR OWN — crowns a hero and talks to it (its rules, then what it
// remembers, then a key whose provider is stood in for in the page, so nothing leaves the machine), searches the Kit for the money side and the ledger's
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
  for (const s of ['hero', 'estate', 'base', 'cards', 'arena', 'mint', 'mesh', 'send', 'proof']) {
    await js(`document.querySelector('#g-dock a[data-go="${s}"]').click()`);
    await sleep(700);
    const r = await js(`({ on: [...document.querySelectorAll('section[data-screen].on')].map((x) => x.dataset.screen), current: (document.querySelector('#g-dock a[aria-current="page"]') || {}).dataset?.go, text: [...document.querySelectorAll('section[data-screen].on')].map((x) => x.innerText).join(' ').length })`);
    if (!r.on.length || r.on.some((x) => x !== s)) problems.push('the dock’s ' + s + ' shows ' + (r.on.join(',') || 'nothing'));
    if (r.current !== s) problems.push('the dock does not mark ' + s + ' as the current screen');
    if (r.text < 80) problems.push('the ' + s + ' screen is nearly empty');
    await scan('the ' + s + ' screen');
  }
  seen.push('9 screens from the dock');
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
            // the case read back is ringed on the duel's picture (PixelWhisperer's focus), and another case moves the ring
            const pic = `(() => { const c = document.querySelector('#g-ar-duelart'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) >>> 0; return h; })()`;
            const one = await js(pic), label = await js(`document.querySelector('#g-ar-duelart').getAttribute('aria-label')`);
            await js(`document.querySelectorAll('#g-ar-watch-out .g-case')[9].click()`); await sleep(400);
            (/with case 1 ringed/.test(label) && (await js(pic)) !== one) ? seen.push('the case read back ringed on the duel, the ring moved by another') : problems.push('the duel focus: ' + label);
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
    // the guild: join with this estate, add a friend's join (a key made and signed in the page), refuse a forged copy of
    // it, then leave — each step by signature alone
    await js(`(() => { document.querySelector('#g-gd-name').value = 'night-owls'; document.querySelector('#g-gd-join').click(); })()`);
    if (await until(`/night-owls · 1 member/.test(document.querySelector('[data-k="g-gd-n"]').textContent)`, 20000, 'the guild joined')) {
      const friend = await js(`(async () => {
        const G = await import('./src/guild.mjs'), K = await import('./vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs'), k = await K.generate();
        const c = { id: '00000000000000aa', dataset: 'telco', department: 'customer', stage: 1, rarity: 'common', generation: 0 };
        const s = (await G.join(k, 'night-owls', { cards: [c], levels: 0, items: [], swarms: [], districts: ['scorer', 'tools', 'swarm'], names: { swarm: 'KITTED' } }, 1)).statement;
        return { good: btoa(JSON.stringify(s)), forged: btoa(JSON.stringify({ ...s, holdings: { ...s.holdings, levels: 9 } })) };
      })()`);
      const add = async (code) => { await js(`(() => { document.querySelector('#g-gd-paste').value = ${JSON.stringify(code)}; document.querySelector('#g-gd-add').click(); })()`); await sleep(1200); return js(`({ n: document.querySelector('[data-k="g-gd-n"]').textContent, out: document.querySelector('#g-gd-out').textContent, tiles: document.querySelectorAll('#g-gd-map canvas').length })`); };
      const two = await add(friend.good), forged = await add(friend.forged);
      (/· 2 members$/.test(two.n) && two.tiles === 2) ? seen.push('a guild of two, both estates drawn') : problems.push('the guild with a friend: ' + JSON.stringify(two));
      (/· 2 members$/.test(forged.n) && /refused: the statement’s signature does not check/.test(forged.out)) ? seen.push('a forged join refused by its signature') : problems.push('the forged join: ' + JSON.stringify(forged));
      await js(`document.querySelector('#g-gd-leave').click()`);
      (await until(`/· 1 member$/.test(document.querySelector('[data-k="g-gd-n"]').textContent)`, 20000, 'the guild left')) ? seen.push('a signed leave took this key out') : problems.push('the leave did not take this key out');
      await scan('the guild');
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
    // the chapter drawn (PixelWhisperer's paintChapter): the one to play now, then another picked from the list
    const drawnCh = `(() => { const c = document.querySelector('#g-cp-art'); if (c.hidden) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, s = new Set(); for (let i = 0; i < d.length; i += 4) s.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); return s.size; })()`;
    const nowArt = await js(drawnCh), nowLabel = await js(`document.querySelector('#g-cp-art').getAttribute('aria-label')`);
    await js(`(() => { const p = document.querySelector('#g-cp-pick'); p.value = '6'; p.dispatchEvent(new Event('change')); })()`); await sleep(800);
    const six = await js(drawnCh), sixLabel = await js(`document.querySelector('#g-cp-art').getAttribute('aria-label')`);
    (nowArt > 20 && /^Chapter 1, drawn: .* · now$/.test(nowLabel) && six > 20 && /^Chapter 6, drawn: \d of \d raid bosses fallen, then its world boss/.test(sixLabel)) ? seen.push('the campaign drawn: the chapter to play now, and another picked') : problems.push('the chapter drawn: ' + JSON.stringify({ nowArt, nowLabel, six, sixLabel }));
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
  // the talker: a card asked in plain words — the case it offers answered from its rules, a question off its business
  // refused, and the missions marked by asking the card again
  await js(`location.hash = '#talker'`);
  if (await until(`document.querySelectorAll('#g-tk-asks button').length === 3`, 90000, 'the talker’s questions')) {
    const said = async (q) => {
      const before = await js(`document.querySelector('#g-tk-out').textContent`);
      await js(`(() => { document.querySelector('#g-tk-q').value = ${JSON.stringify(q)}; document.querySelector('#g-tk-ask').click(); })()`);
      await until(`document.querySelector('#g-tk-out').textContent !== ${JSON.stringify(before)} && !/Reading your question/.test(document.querySelector('#g-tk-out').textContent)`, 60000, 'the talker answering');
      return js(`({ tag: (document.querySelector('#g-tk-out .g-tag') || {}).textContent || '', said: (document.querySelector('.g-tk-said') || {}).textContent || '', rc: document.querySelector('#g-tk-rc').textContent })`);
    };
    const offered = await js(`document.querySelector('#g-tk-asks button').textContent`), a = await said(offered), b = await said('what is the weather like?');
    (a.tag === 'answered from its rules' && /^(Yes|No) — /.test(a.said) && /"verdict": "VERIFIED"/.test(a.rc)) ? seen.push('the talker answered the case it offers from its rules, with a receipt') : problems.push('the talker on its own case: ' + JSON.stringify(a).slice(0, 200));
    (b.tag === 'it cannot answer that' && /^I only answer questions about/.test(b.said)) ? seen.push('the talker refused a question off its business') : problems.push('the talker off topic: ' + JSON.stringify(b).slice(0, 200));
    const learn = await js(`({ n: document.querySelector('[data-k="g-tk-learn-n"]').textContent, done: [...document.querySelectorAll('#g-tk-learn li.k')].map((l) => l.textContent) })`);
    (/^\d+ of 10$/.test(learn.n) && learn.done.some((t) => /Ask about one case/.test(t)) && learn.done.some((t) => /Ask it what it cannot know/.test(t))) ? seen.push('learn to ask: ' + learn.n + ' missions, marked by asking the card again') : problems.push('learn to ask: ' + JSON.stringify(learn).slice(0, 200));
    await scan('the talker');
  }
  // the hero: a card crowned with a pass the player signs. It answers from its rules first, from what it remembers of
  // its player next, and from the player's own AI key last — the provider is stood in for in the page here, so no key
  // and no question leaves the machine — inside the limit its pass sets, sending the same opening every question
  await js(`location.hash = '#hero'`);
  if (await until(`!!document.querySelector('#g-hr-pick') && document.querySelector('#g-hr-pick').value !== ''`, 30000, 'the hero’s cards')) {
    await js(`document.querySelector('#g-hr-crown').click()`);
    if (await until(`!document.querySelector('#g-hr-main').hidden`, 30000, 'crowning a hero')) {
      // its level is lit by what it has done: this card may already be kitted or levelled earlier in the play
      const crowned = await js(`({ cls: document.querySelector('[data-k="g-hr-class"]').textContent, level: document.querySelector('[data-k="g-hr-level"]').textContent, first: (document.querySelector('#g-hr-steps li') || {}).textContent || '' })`);
      (/^(Telecom Tactician|Shopkeeper Sage|Bank Bard|Recruiter Ranger|Clinic Caretaker|Credit Crusader)$/.test(crowned.cls) && /^LEVEL [1-6] of 6$/.test(crowned.level) && crowned.first === '✓ Crowned') ? seen.push('a hero crowned: a ' + crowned.cls + ', ' + crowned.level.toLowerCase()) : problems.push('the hero crowned: ' + JSON.stringify(crowned));
      const heroSaid = async (q) => {
        const before = await js(`document.querySelector('#g-hr-out').textContent`);
        await js(`(() => { document.querySelector('#g-hr-q').value = ${JSON.stringify(q)}; document.querySelector('#g-hr-ask').click(); })()`);
        await until(`document.querySelector('#g-hr-out').textContent !== ${JSON.stringify(before)} && !/reads your question|Asking your key/.test(document.querySelector('#g-hr-out').textContent)`, 90000, 'the hero answering');
        return js(`({ tag: (document.querySelector('#g-hr-out .g-tag') || {}).textContent || '', said: (document.querySelector('.g-hr-said') || {}).textContent || '', how: ([...document.querySelectorAll('#g-hr-out p')].pop() || {}).textContent || '' })`);
      };
      if (await until(`document.querySelectorAll('#g-hr-asks button').length >= 3`, 90000, 'the hero’s questions')) {
        const r1 = await heroSaid(await js(`document.querySelector('#g-hr-asks button').textContent`)), r2 = await heroSaid('who am I?');
        (r1.tag === 'from its card’s rules' && /^(Yes|No) — /.test(r1.said)) ? seen.push('the hero answered the case it offers from its card’s rules, offline') : problems.push('the hero on its own case: ' + JSON.stringify(r1).slice(0, 200));
        (r2.tag === 'it cannot answer that here' && /remember anything about you yet/.test(r2.said)) ? seen.push('the hero said it remembers nothing of you yet') : problems.push('the hero asked about you with no memory: ' + JSON.stringify(r2).slice(0, 200));
        await js(`(() => { document.querySelector('#g-hr-mem-note').value = 'I am a plumber in Leeds\\nI prefer short answers'; document.querySelector('#g-hr-mem-add').click(); })()`);
        await until(`/kept on this device/.test(document.querySelector('#g-hr-mem-out').textContent)`, 10000, 'the hero keeping your lines');
        const r3 = await heroSaid('what do I prefer?');
        (r3.tag === 'from what it remembers of you' && /you prefer short answers/.test(r3.said)) ? seen.push('the hero answered from what you told it, kept on this device') : problems.push('the hero’s memory: ' + JSON.stringify(r3).slice(0, 200));
        // the provider, stood in for in the page: each request is read back, and nothing leaves the machine
        await js(`(() => { window.__heroSent = []; const real = window.fetch; window.fetch = async (u, init) => { if (!String(u).startsWith('https://api.anthropic.com/')) return real(u, init); const body = JSON.parse(init.body); window.__heroSent.push({ headers: init.headers, body }); const n = window.__heroSent.length; return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'Stood-in answer ' + n }], usage: n === 1 ? { input_tokens: 10, cache_creation_input_tokens: 1500, cache_read_input_tokens: 0, output_tokens: 20 } : { input_tokens: 25, cache_creation_input_tokens: 0, cache_read_input_tokens: 1500, output_tokens: 20 } }), { status: 200, headers: { 'content-type': 'application/json' } }); }; })()`);
        await js(`(() => { document.querySelector('#g-hr-prov').value = 'anthropic'; document.querySelector('#g-hr-prov').dispatchEvent(new Event('change')); document.querySelector('#g-hr-key').value = 'ui-play-stand-in'; document.querySelector('#g-hr-limit').value = '7000'; document.querySelector('#g-hr-grant').click(); })()`);
        if (await until(`/^Granted/.test(document.querySelector('#g-hr-key-out').textContent)`, 15000, 'granting the hero a key')) {
          const k1 = await heroSaid('What should I do next?'), k2 = await heroSaid('And then?'), k3 = await heroSaid('And after that?');
          const sent = await js(`window.__heroSent.map((x) => ({ cache: x.body.system[0].cache_control && x.body.system[0].cache_control.type, sys: x.body.system[0].text, n: x.body.messages.length, fb: x.body.fallbacks, beta: x.headers['anthropic-beta'], inBody: JSON.stringify(x.body).includes('ui-play-stand-in') }))`);
          const ok = sent.length === 2 && sent.every((x) => x.cache === 'ephemeral' && x.fb === 'default' && x.beta === 'server-side-fallback-2026-07-01' && !x.inBody) && sent[0].sys === sent[1].sys && sent[0].n === 1 && sent[1].n === 3;
          (ok && /^from your key/.test(k1.tag) && /, 0 of them reused/.test(k1.how) && /1,500 of them reused from the provider’s cache \(98%\)/.test(k2.how)) ? seen.push('the hero asked a key with one fixed opening marked for the provider’s cache: 98% of its second question reused') : problems.push('the hero on a key: ' + JSON.stringify({ k1, k2, sent: sent.map((x) => ({ ...x, sys: x.sys.length })) }).slice(0, 500));
          (k3.tag === 'it cannot answer that here' && /limit would be passed/.test(k3.how)) ? seen.push('the hero stopped at the limit its pass sets') : problems.push('the hero past its limit: ' + JSON.stringify(k3).slice(0, 200));
        }
      }
      await scan('the hero');
    }
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
  // builds and combos: a telecom build of the drop's cards (one per department) measured in the worker, every card with
  // what it adds; this key's re-run signed; a friend's key's re-run (made and signed in the page) added from a build code
  // proves it, shown done on the job board and in the build book; then the build shrunk into one small card, by its numbers
  await js(`location.hash = '#builds'`);
  if (await until(`document.querySelector('#g-bd-set') && [...document.querySelector('#g-bd-set').options].some((o) => o.value === 'telco') && document.querySelectorAll('#g-bd-jobs li').length > 0`, 30000, 'the build sheet and the job board')) {
    await js(`(() => { const s = document.querySelector('#g-bd-set'); s.value = 'telco'; s.dispatchEvent(new Event('change')); })()`);
    await until(`!document.querySelector('#g-bd-go').disabled && [...document.querySelectorAll('#g-bd-picks select')].filter((s) => s.value).length >= 2`, 30000, 'the telecom build sheet');
    await js(`document.querySelector('#g-bd-go').click()`);
    if (await until(`/COMBO FOUND|ANTI-COMBO|PLAIN|could not be measured/.test(document.querySelector('#g-bd-out').textContent)`, 120000, 'a build measured')) {
      const b = await js(`({ out: document.querySelector('#g-bd-out').innerText, parts: document.querySelectorAll('#g-bd-out li').length })`), kind = /COMBO FOUND/.test(b.out) ? 'a combo' : /ANTI-COMBO/.test(b.out) ? 'an anti-combo' : 'plain';
      (/The build scores \d\.\d{6} on GATE, out of fold · its best card alone \d\.\d{6}/.test(b.out) && b.parts >= 2 && /adds [+−-]?\d/.test(b.out)) ? seen.push('a build measured in the worker: ' + kind + ', ' + b.parts + ' cards, each with what it adds') : problems.push('the build: ' + b.out.replace(/\s+/g, ' ').slice(0, 180));
      await scan('a build');
      await js(`document.querySelector('#g-bd-sign').click()`);
      if (await until(`document.querySelector('#g-bd-sign').textContent.includes('✓')`, 120000, 'this key’s re-run signed')) {
        const code = await js(`(async () => {
          navigator.clipboard.writeText = () => Promise.reject(new Error('no clipboard here'));
          document.querySelector('#g-bd-copy').click(); await new Promise((r) => setTimeout(r, 600));
          const o = JSON.parse(decodeURIComponent(escape(atob(document.querySelector('#g-bd-code').value))));
          const B = await import('./src/build.mjs'), K = await import('./vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs'), C = await import('./vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs'), k = await K.generate();
          const f = { type: B.RERUN, receipt: B.receiptId(o.receipt), by: k.pub };
          return btoa(unescape(encodeURIComponent(JSON.stringify({ ...o, reruns: [...o.reruns, { ...f, sig: await K.sign(k, C.utf8(C.canonical(f))) }] }))));
        })()`);
        await js(`(() => { const t = document.querySelector('#g-bd-code'); t.hidden = false; t.value = ${JSON.stringify(code)}; document.querySelector('#g-bd-import').click(); })()`);
        if (await until(`/★ Proven: 2 different keys/.test(document.querySelector('#g-bd-out').textContent) || /does not measure again|not a Kardlings build code/.test(document.querySelector('#g-bd-out').textContent)`, 120000, 'the build proven')) {
          const p = await js(`({ out: document.querySelector('#g-bd-out').innerText, book: document.querySelector('#g-bd-book').innerText, jobs: document.querySelector('#g-bd-jobs').innerText })`);
          (/★ Proven: 2 different keys measured it again to the very same numbers · found by you/.test(p.out) && /Telecom customers/.test(p.book) && /2 keys|3 keys/.test(p.book + p.out) && /Measured again here: the very same receipt/.test(p.out))
            ? seen.push('a build proven by two keys’ re-runs, found by this key, in the build book' + (kind === 'a combo' ? ' as a combo' : ''))
            : problems.push('the proof: ' + p.out.replace(/\s+/g, ' ').slice(0, 180) + ' · book: ' + p.book.replace(/\s+/g, ' ').slice(0, 80));
        }
      }
      await js(`document.querySelector('#g-bd-shrink').click()`);
      if (await until(`/Kept: one small card|Not kept: the student|Not shrunk: /.test(document.querySelector('#g-bd-shrink-out').textContent)`, 300000, 'a shrink')) {
        const s = await js(`document.querySelector('#g-bd-shrink-out').innerText`);
        (/its best source \d\.\d{6} · the teacher \d\.\d{6}/.test(s) && /Kept: one small card|Not kept: the student scored \d\.\d{6}/.test(s)) ? seen.push('a build shrunk into one small card: ' + (/Kept: one small card/.test(s) ? 'kept' : 'not kept') + ', said with its numbers') : problems.push('the shrink: ' + s.replace(/\s+/g, ' ').slice(0, 180));
        await scan('a shrink');
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
  for (const s of ['hero', 'estate', 'base', 'cards', 'kit', 'fusion', 'talker', 'arena', 'raids', 'builds', 'evals', 'mint', 'mesh', 'send', 'proof', 'boot', 'about']) {
    await js(`location.hash = '#${s}'`); await sleep(500);
    const w = await js(`document.documentElement.scrollWidth`);
    // a screen too wide names what pushes it: the widest-reaching element, so the next fix starts from the culprit
    if (w > 392) wide.push(s + ' ' + w + 'px (' + (await js(`(() => { const W = document.documentElement.clientWidth; let best = null, r = 0; for (const n of document.querySelectorAll('section[data-screen].on *')) { const b = n.getBoundingClientRect(); if (b.width && b.right > r && b.right > W) { r = b.right; best = n; } } return best ? best.tagName.toLowerCase() + (best.id ? '#' + best.id : '') + (typeof best.className === 'string' && best.className ? '.' + best.className.trim().split(' ').filter(Boolean).join('.') : '') + ' “' + (best.textContent || '').trim().slice(0, 48) + '” → ' + Math.round(r) + 'px' : 'none in the screen'; })()`)) + ')');
    // every screen names itself in the tab (the Fusion Lab and About read "undefined" until 2026-10-22)
    if (await js(`/^undefined|^ ·|^·/.test(document.title)`)) untitled.push(s);
  }
  if (wide.length) problems.push('wider than a 390 px phone: ' + wide.join(', '));
  else seen.push('every screen fits 390 px');
  if (untitled.length) problems.push('a screen with no title in the tab: ' + untitled.join(', '));
  else seen.push('every screen names itself in the tab');
  await done(problems.length ? 1 : 0);
} catch (e) { problems.push(String((e && e.message) || e)); await done(1); }
