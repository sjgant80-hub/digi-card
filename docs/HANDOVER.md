# Kardlings — the hand-over

The game repository (sjgant80-hub/kardlings, renamed from digi-card on 2026-10-22; live at
https://sjgant80-hub.github.io/kardlings/). Everything here is checkable from the repository itself; nothing needs a
server, a key of anyone's, or a network beyond fetching this repository's own files. (A player may give their hero their
own AI key: then, and only then, their browser talks to the one provider they picked — see The hero below.)

## The gate — run before every push, all of it

| step | command | what it proves |
|---|---|---|
| tests | `node --test test/*.test.mjs` | every kernel, fuzzed; the copy gate and the vocabulary checks run inside it |
| vendoring | `node tools/vendor-check.mjs` | every vendored file is byte-identical to its source at its pinned commit |
| the drop | `node tools/drop-check.mjs` | the 1,000-card drop replays from nothing to its head through decoder #0001 |
| the page | `node tools/page-check.mjs` | every element live, every link lands, no price, credits present, this-site-only CSP |
| words | `node tools/copy-gate.mjs` | no word the game never says (no money words, no "alive", no COMING) on any surface |
| the game played | `node tools/ui-play.mjs` | a headless browser plays every screen end to end, at 1280 px and at 390 px, every title named |
| organs | `for k in 1..16: node tools/order.mjs --organ $k && (node tools/judge-$k.mjs --check \|\| node tools/superseded.mjs --organ $k)` | each organ sealed before measured, judged by its sealed rules only |
| mutation | `node witness-all.mjs` (or `node witness-all.mjs src/x.mjs`) | every kernel's tests kill every mutant (PAIRS in witness-all.mjs) |

CI (`.github/workflows/gate.yml`) runs exactly these: job `proof` (tests, vendor, drop, page, ui-play, the organ loop)
and job `witness` (witness-all, 150 min budget). A green run on GitHub's runner is the proof; Pages deploys `main`.

Traps:
- **The witness rewrites the file it gates, in place** (it leaves `src/x.mjs.witnessbak` while it runs). Never run tests,
  seal, measure or `git add` that file while a witness of it runs. Node processes that already loaded a module are safe.
- **No carriage returns.** `.gitattributes` pins LF. `tools/order.mjs` `pin()` refuses a pinned file holding a CR. Text
  written by Windows Python in text mode gains CRLF — check `git ls-files --eol | grep w/crlf` before sealing.
- **A sealed judge carries what it was sealed with.** After the rename, `tools/judge-7.mjs` read the live `PAGE` from
  `src/claims.mjs` and drifted (CI red on 1624a9a); it now carries the page organ 7 was sealed with. After touching ANY
  file an organ pins (BASE in `tools/organ.mjs`: dossier, card, registry, data, mind, breed, mesh, claims, drop, cost,
  organ, order, data/SOURCES.json, vendor/SOURCES.json, drop/manifest.json, drop/log.json), run every organ's judge.

## The organs — sealed before measured, failures kept

Pattern (tools/organ.mjs): `node tools/seal-k.mjs` writes `data/organ-k/prereg.json` (the claims + every pinned file's
hash) → commit it → `node tools/measure-k.mjs` writes `record.json` (the only reader of TEST) → `node tools/judge-k.mjs
--write` → commit record + verdict → `node tools/order.mjs --organ k` proves the seal came first, the pins unchanged.
Dry runs before a seal use `SMALL=1` (and `DRY=1`: every TEST read replaced by 0) ON OTHER SEEDS, into
`dry-record.json`, reading properties only — and the seal's disclosure says so. A failed prediction is kept; a failed
property turns the organ RED, and a red organ passes CI only as SUPERSEDED (`tools/superseded.mjs`: its verdict exactly as
sealed, its failures exactly named, and a later organ, sealed first, holding every property — see organ 12 → 13).
Seal and record are pushed together (CI must never see a prereg without its verdict: the Proof screen fetches it).

| k | organ (as sealed) | sealed in | record in | held | failed, kept | blind? |
|---|---|---|---|---|---|---|
| 1 | the card | 68c9987 | f27ab1d | 6/6 | none | blind · record carries timings |
| 2 | germination | 68c9987 | 0f232a3 | 6/7 | Q3 | blind |
| 3 | stage by receipt | 68c9987 | 6522475 | 5/6 | Q2 | blind |
| 4 | breeding | 68c9987 | c9ba7cd | 5/6 | Q1 | blind |
| 5 | trade and ownership | 68c9987 | 02bc6ef | 6/6 | none | blind · record carries timings |
| 6 | the mesh | 68c9987 | 1199d38 | 5/5 | none | not fully blind (its disclosure says how) |
| 7 | the drop | 68c9987 | 5fd42db | 3/3 | none | blind |
| 8 | scale | 68c9987 | 3ebcff7 | 5/5 | none | blind · record carries timings |
| 9 | the arena | 29c3633 | 4b7cfbf | 6/7 | Q3 | blind · record carries timings |
| 10 | the kit and the party | e5c690b | 9b8ed46 | 10/10 | none | not fully blind (its disclosure says how) · record carries timings |
| 11 | the campaign and kit it for me | 9eb9bb5 | 166c958 | 6/6 | none | not fully blind (its disclosure says how) · record carries timings |
| 12 | the arena watched and the tournament | 9eb9bb5 | bdb74be | 3/5 | P3 (property: RED, superseded by 13), Q2 | not fully blind (its disclosure says how) |
| 13 | the tie rule | ecb8d63 | d24c7c0 | 4/4 | none | not fully blind (its disclosure says how) |
| 14 | the talker | b185ff6 | 7710b6c | 5/5 | none | not fully blind (its disclosure says how) |
| 15 | the guild | a65f318 | f27eeea | 5/5 | none | not fully blind (its disclosure says how) · record carries timings |
| 16 | builds and combos, and the first training build (the shrink) | 6d3788a | 17940f3 | 8/9 | Q4 (the taught student matched the plain search on TEST in only 2 of 20) | not fully blind (GATE seen before the seal: its disclosure says how) · record carries timings |
| 17 | the hero: the signed pass, the router (rules, memory, key within its limit), the fixed opening and recycling | a77e1cb | 401494a | 7/7 | none | not fully blind (its disclosure says how) · record carries timings |

To re-verify any organ (fast, no measurement): `node tools/order.mjs --organ k` (the seal came first, every pinned file
unchanged between seal and record) then `node tools/judge-k.mjs --check` (the committed verdict is exactly what the sealed
rules give over the committed record); organ 12 passes as `node tools/superseded.mjs --organ 12`.

To regenerate a record: `node tools/measure-k.mjs` writes over `data/organ-k/record.json` — then `git diff` it against the
committed one and `git checkout` it back. Every measurement is seeded (samplers from fixed seeds, demo keys from public
phrases), so a record without timing fields should come back byte for byte; the records of organs 1, 5, 8, 9, 10, 11, 15
and 16 carry timings (ms) that differ run to run. I have not regenerated every committed record since it was committed: do
one and diff it before relying on this. Organs 2 and 3 run their searches in worker threads (`tools/lib.mjs searchAll`);
organ 16 can run side by side: `ONLY=<business> node tools/measure-16.mjs` for each of adult, bank, credit, shop, telco,
then `MERGE=1 node tools/measure-16.mjs` (the parts are exactly what one run measures — checked on its dry run). Never
regenerate into the committed record and commit it: a record is measured once, after its seal.


## Vendoring

`vendor/SOURCES.json` lists every vendored source: repository, pinned commit, local checkout, and each file with its
`from` path and sha256. `node tools/revendor.mjs <owner/repo> <full 40-hex commit>` re-vendors one source byte for byte
from its local checkout; then `node tools/vendor-check.mjs`. **Never re-vendor while an organ's record is still to be
committed** — SOURCES.json is in every organ's BASE pins, so it would break that organ's order proof.
Sources: dex-frontier (the kernels' statistics, couplings and seed-library), pixelwhisperer (every picture: card faces
and backs, the estate map, the duel, raids and chapters, fusion), mint-an-app (the app tools' records), kcc-mesh (the
contribution ledger's code).

## The drop, keys and the record

- `drop/manifest.json` + `drop/log.json`: the 1,000 genesis cards, sealed by the public demo maker key (phrase
  `digi-card/genesis/demo-maker`), replayed by `tools/drop-check.mjs`. `drop/admission.json`: every department's genesis
  searches — which were admitted (the drop's cards), which were not (the raid bosses; a whole business = a world boss).
- `registry/log.json`: the public registry continuing the genesis chain (the first recorded give wins).
- Demo keys in the organs come from public phrases (`tools/lib.mjs owner()`), so every signature re-runs.
- A player's key is made by the browser's WebCrypto and held in the tab only (never in browser storage); the game's
  progress lives in IndexedDB `digi-card` — the store keeps that name on purpose: both page addresses are one origin, so
  the rename kept every player's progress.
- The old Pages address /digi-card/ answers 404 (GitHub redirects repository URLs after a rename, not Pages). Do not make
  a repository named digi-card: it would end the rename redirect other repositories' CI checkouts ride on.
- Words: `src/copy.mjs` is the words gate. KCC words, money words and "alive/living" never appear on a public surface.

## The hero (organ 17)

`src/hero.mjs` (the pass a crowning signs, as fall-os's kard; the fixed opening; the router: rules, then memory, then key
inside the limit; the page that only grows; every provider's usage read one way; the level lit by what the hero did) and
`ui/hero.js` (the Hero screen, first in the dock). Vendored for it: `vendor/fall-os/` (kard.mjs, seed.mjs and the hash they
share, organs/estate.mjs, byte for byte at fall-os fa75756) and `vendor/kar-foldcycle/foldcycle.mjs` (the recycling verdict,
f8faf8e). Traps:
- **The AI key is never stored**: not in IndexedDB, not in localStorage, not in the key file. Only the hero's signed pass
  is kept (IndexedDB 'hero', and in the key file). The provider and model names are kept in localStorage (not secret).
- **The CSP allows exactly four provider addresses** besides this site; `tools/page-check.mjs` refuses any other, and
  refuses any other host named in `ui/hero.js`. Every “nothing is sent” on the page names the one exception.
- **A key page only grows**: Anthropic's assistant turns are kept as returned (thinking blocks included) and appended,
  never edited, so earlier thinking stays valid and the cache stays warm; a page starts fresh after 20 questions or when
  the opening changes. A declined answer adds nothing to the page.
- **ui-play stands the provider in**: it replaces fetch for api.anthropic.com in the page, so no key and no question
  leaves the machine, and reads every request back (fixed opening, cache marker, fallback header, key not in the body).
- The memory keeps only facts (fall-os's buckets), never the export it read; the twelve heaviest go to a provider only
  when the pass allows 'remember'.

## Builds and combos (organ 16)

`src/build.mjs` (jobs, recipes, measure, combo/anti/plain at ±0.005, signed re-runs, proof by two distinct keys, the
build book) and `src/shrink.mjs` (the training build: a build teaches one small card on FIT; kept by +0.002 over its
best source on GATE). The Builds screen (Play → Builds) does the heavy work in `worker.js` (`op: 'build'`): measure, sign
and prove, prove, shrink, deep-check — the key goes to the worker for a signing job only, never stored. The build card,
sheet and book pictures are PixelWhisperer's (paintBuild / paintSheet / paintBook on the receipt, proof and shrink as the
kernel emits them; six cards at most; ANTI only on verdict 'anti').

## Pending

- **PixelWhisperer’s Builds pictures** into the Builds screen: paintSheet (green at pixelwhisperer 0ced791), paintBook, and
  paintBuild once it reads the receipt / proof / shrink as the kernel emits them. Add each new file to vendor/SOURCES.json, then
  `node tools/revendor.mjs sjgant80-hub/pixelwhisperer <full sha>` and `node tools/vendor-check.mjs`, wire a canvas per
  picture with an aria-label, and give tools/ui-play.mjs a check that it drew. Organ 16’s record is committed, so vendoring
  is safe now.
- **The shared contract** (PixelWhisperer’s plan): real records from the kernel published as data/contract/builds.json and
  regenerated byte for byte in CI; the painters’ CI paints and pins them.
- **ui/first.js** takes COMBO from src/build.mjs instead of its own copy (pinned in organ 16’s prereg).
- **The shrink, measured as not helping** (organ 16 Q4): hard yes/no from the teacher misleads the search (median −0.010 on
  GATE against the same search on the true answers). A next organ could try soft teaching (the teacher’s scores as weights,
  or its answers only where it is sure) — sealed before it runs, against the plain search as the control.
- **No anti-combo arose** in 80 builds of the drop’s single-department cards. Anti-combos need overlapping knowledge (a
  fused card beside one of its own departments — the tests have one); a population of fused cards would measure them.
- **The second training kind** (a tiny text model) was not built: it cannot yet be re-run in a tab or on CI, so it cannot
  be proven the same way.
- **Simon’s doors:** the FallWorld banner (and its money side’s removal) on his go; the Facebook page token needs
  pages_manage_posts + pages_read_engagement before the rail can post; Stripe is his account and his keys.
