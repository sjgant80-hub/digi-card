# Kardlings

**Live: https://sjgant80-hub.github.io/digi-card/**

A trading card that is a working mind you own. A Kardling card is a 384 × 576 PNG. Its top sixteen pixel rows carry, byte for
byte and in plain view, a sealed recipe for a small mind grown on real records (a scorecard of at most six readable
rules), the signed history of everyone who has owned it, and every level it has earned. Open it on any device and it
grows that mind there, offline, and proves its score on cases it never saw. Own it, give it, fuse it (a fused card is kept
only if it beats both parents), put it to work with other cards in a mesh — and re-run every claim yourself.

Everything on the live page is this repository's mutation-gated code running in your browser on six real public
datasets. Nothing is mocked; nothing is sent anywhere.

The page opens as a game, built from the same blocks as the cards (PixelWhisperer Kards' palettes, rarity rings and
pixel lettering). Its dock holds eight screens: Estate, Base, Cards (with each card's Kit), Play (the Arena, the Raids and
Evals), Mint, Mesh, Send and Proof (with your record). Card me hands you
a telco card, and Boot reads it, checks it, grows its mind and counts up to the score your device computed beside the
one the drop declared. The classic document view (Menu → Classic view) holds the full explanation, the brochure and
the white paper. Your key is never kept in the browser's storage: it lives in the tab and in the key file you save.
The game's own files are `ui/mode.js`, `ui/game.js` and `ui/game.css`, and they change no kernel.

## FallWorld: kit it out, fight, raid — the agent economy as a game, real underneath

Every card is born with an inventory: two node slots (a third once it levels, a fourth at rare) and two tool slots. A
**node** is another card its owner holds from the same business, for a department the Kardling does not cover; equipped, it
couples with the Kardling exactly as a mesh couples its members, and joins only if it measurably adds (it must answer, cover
something new and beat a coin on GATE). Every slot shows what it adds, each left out in turn. A **tool** is one of the estate's 337
mintable apps, exactly as mint-an-app's records hold it — the commit its own CI passed at and the run that proved it —
minted as a signed item, handed on by signed gives; it moves no score, and the page says so.

- **Arena** (`src/arena.mjs`, `src/kit.mjs`): two cards fight on 64 GATE cases drawn from both owners' signatures, each
  fighting as it is kitted (its coupling learned on the GATE cases outside the batch); the better ranking wins; the
  receipt re-runs; ratings come from a published table; self-play is never rated; nothing is staked.
- **Raids** (`src/raid.mjs`): a department nobody solved is a boss struck by signed searches seeded by each player's own
  key; the first strike to clear 0.6 seals that department's first card. A whole business is a **world boss** at its
  best lone genesis search plus 0.010; a **party** of owners' cards, each by its owner's signed consent, strikes it
  together, and the receipt names every member's measured share (in millionths, a million between them).
- **The record** (`src/earn.mjs`): every card and tool a player makes, and every party share they measure, written into
  the credits ledger (its code vendored byte for byte under `vendor/`), begun from the estate's very
  genesis so a reconcile counts each entry once; internal units, not money; the switch is off.

## What was proven

Fifteen organs, each sealed before it was measured (organs 6, 10, 11, 12, 13, 14 and 15 are not fully blind, each disclosing why on Proof; git proves the order: `node tools/order.mjs --organ k`), judged by
their sealed rules alone — **80 of 86 sealed rules held; 5 failed predictions are kept; 1 property failed and is kept:** organ 12 found two real
tournament brackets that never named a champion, and organ 13, sealed first, measured the fix (`node tools/superseded.mjs --organ 12`).

| Organ | Result |
|---|---|
| 1 · the card | 1,000/1,000 cards read back exactly; 1,200/1,200 forgeries in 12 classes refused; self-signed fake levels read but are never recorded; median full check 84 ms |
| 2 · germination | 1,000/1,000 minds re-grow offline to exactly their declared GATE; 50/50 searches re-run to the same mind; every card beats a coin on TEST, median GATE→TEST drop 0.002 — **failed:** shop-context's median TEST AUC 0.567 < 0.600 |
| 3 · levels | 69/100 cards levelled in three searches; every level re-runs exactly and deeply; 345/345 forgeries refused; 42/69 rose on TEST — **failed:** the mean TEST gain's lower bound is below zero |
| 4 · fusion (sealed as ‘breeding’) | 66/66 fused cards beat both parents on GATE; across departments 40/40 fused cards beat both parents on TEST — **failed:** within a department, 12/26 |
| 5 · trade | 3,037/3,037 honest gives recorded; 300/300 double sales and 100/100 forged gives refused; 4,037 entries replay identically |
| 6 · the mesh | beats its best single card on TEST in 5/5 businesses; shares sum to a million; ledgers replay (not blind: dry-run before its seal, disclosed) |
| 7 · the drop | decoder #0001 re-runs the genesis; 5/5 posts pass the claim gate, 12/12 overreaching drafts refused; 100/100 card-me claims work |
| 8 · scale | the mesh climbs as each department joins, in 5/5 businesses; a 10,000-entry registry replays identically in 36.8 s |
| 9 · the arena | 1,000/1,000 duels re-run to the same receipt; every batch 64 distinct GATE rows, no TEST row read; 240/240 forgeries refused; ratings replay and their total is conserved; the duel winner had the higher TEST AUC in 78.4% of decided pairs; 26.3% of duels were upsets — **failed:** the median duel took 278 ms, over the 250 predicted (measured while a local language model ran on the same laptop) |
| 10 · the kit and the party (not fully blind: dry-run before the seal; see Proof) | 100/100 kits measure the same twice, what every slot adds exact; 300/300 kit duels re-run; 240/240 forgeries refused; 55/55 party strikes re-run with shares a million; a tool never moved a score; 337/337 app items verify, 1,685/1,685 forged bodies refused · on TEST: 88 of 88 kits that lifted GATE also lifted TEST, the median TEST lift 89% of GATE's; kitted Kardlings won 81.9% of decided duels against their own department's cards alone (48.9% alone); 3 of 5 world bosses fell to a best-card party (telco, adult, credit); 25 of 26 clearing parties held within 0.03 on TEST |
| 11 · the campaign and Kit it for me (not fully blind: dry-run before the seal; see Proof) | 100/100 auto-kits the same twice in either order, every step lifting; 20/20 foreign pools never picked another key’s card; 6 chapters hold every boss once; 1,000/1,000 receipt sets read exactly as their bosses fell; 97/97 kits that lifted GATE by 0.005 or more also lifted TEST; 83.8% beat a seeded random kit of the same size on TEST |
| 12 · watch it back and the tournament (not fully blind: dry-run before the seal; see Proof) | 100/100 duels replay to the very same receipt, case by case; 19,584/19,584 read-backs give the very score the duel used — **failed:** 3 of 5 real brackets named a champion (two stalled on draws: the fix is organ 13), and the higher declared GATE AUC won 58.6% of matches, under the sealed 60% |
| 13 · the tie rule (not blind: written after organ 12) | 1,000/1,000 receipt sets decided only by the rule, the tie settling 201 of 976 matches; 5/5 real brackets named a champion within 3 duels a match; 35/35 real matches decided by a duel; the higher declared GATE AUC won 71.4% |
| 14 · the talker (not fully blind: hardened and dry-run before the seal; see Proof) | 1,500/1,500 GATE rows said in words read back exactly and answered with the mind’s own label, score and fired rules; 1,500/1,500 with a value left out, 1,500/1,500 with one said twice and 1,250/1,250 off-topic questions abstained; every receipt the same twice; 100% read back in other words and another order; 1,800/1,800 bare column names abstained |
| 15 · the guild (not fully blind: the kernel was gated before the seal; see Proof) | 379/379 guilds stood exactly as their keys signed, all 1,895 attacks refused with their reasons, 21/21 past twelve refused; the same in any order; every estate drawn exactly as signed; 274/274 members who signed a drop card wrongly caught by the drop; a guild of twelve read in a median 16 ms |

Every kernel is witness CLEAN (1,082/1,082 mutants killed on GitHub’s runner at 8062362, run 39722326600) and CI re-proves all of it on every push.

## Run it

```
node --test test/*.test.mjs        # every kernel, fuzzed
node witness-all.mjs               # the mutation gate over every kernel
node tools/vendor-check.mjs        # vendored code byte-identical to its sources
node tools/drop-check.mjs          # the drop re-runs from decoder #0001; every genesis mind re-grows to its declared score
node tools/page-check.mjs          # the page gate
node tools/ui-play.mjs             # the game view, played from nothing in a headless browser
node tools/order.mjs --organ 1     # an organ was sealed before it was measured (1 to 8)
node tools/judge-1.mjs --check     # and its verdict is what the sealed rules give
node tools/genesis.mjs --searches  # every search behind the drop (cached in drop/searches.jsonl)
node tools/genesis.mjs --mint      # the drop itself (--key <file> to seal it with your own maker key)
```

## Wire up the drop (Grok, "card me")

The drop's key-holder hands a genesis card to a claimant's key (their page shows it under Wallet → Your key):

```
node tools/card-me.mjs --key <maker key file> --to <their 64-hex key>
node tools/posts.mjs               # the drop's posts, claim-gated, ready to paste: docs/posts.md
node tools/overnight.mjs wallet.json   # level an owner's cards nightly on their own machine
```

`card-me` signs the give, appends it to `registry/log.json` (commit it: CI replays it, and every visitor's page
replays it after the drop), writes the claimant's card to `out/`, and prints a claim-gated reply. Nothing is posted
or sent by the tools: a person does that.

## What is where

| | |
|---|---|
| `src/dossier.mjs` | a card's record: issue, give, receipt, skin — signed, chained, one canonical byte form |
| `src/card.mjs` | the PNG: the band carries the dossier; the face is redrawn on read and compared pixel for pixel |
| `src/registry.mjs` | the ordered log that settles a double sale; replays from nothing |
| `src/data.mjs` | six real datasets opened only on their published hashes; your own CSV |
| `src/mind.mjs` | express, answer or abstain, search for a level, re-run a level exactly |
| `src/breed.mjs` | fusion: a fused card kept only if it beats both parents on GATE |
| `src/mesh.mjs` | consent, the join rule, measured shares, a replayable ledger of credits |
| `src/claims.mjs` | the claim gate for every public post |
| `src/drop.mjs` | the genesis and decoder #0001 |
| `src/cost.mjs` | the cost case, from sourced prices only |
| `src/arena.mjs` | duels: both owners sign, the batch comes from both signatures, the better ranking wins, ratings from a published table |
| `src/raid.mjs` | raids: the unsolved departments as bosses, signed strikes anyone re-checks, the first card of a fallen boss as loot; world bosses, party strikes assembled as a mesh, receipts that re-run |
| `src/kit.mjs` | the kit: slots from its issue, the owner's signed loadout, the kitted mind with what each slot adds, kit duels |
| `src/item.mjs` | app items: an estate app exactly as mint-an-app's records hold it, minted and handed on by signature |
| `src/earn.mjs` | the record: a player's releases and measured party shares as entries of the credits ledger |
| `vendor/mint-an-app/` | mint-an-app's records of the estate's apps (which are mintable, their tier, commit and CI run), byte for byte |
| `vendor/kcc-mesh/` | the credits ledger and its DIGI gate, byte for byte |
| `data/organ-*/` | fifteen organs: sealed claims, records, verdicts (and organ 12’s superseded record) |
| `drop/` | the manifest, the genesis log, every search |
| `decoder/v1/` | the exact files that read a card, frozen at the drop |

Draws on the Guided Entropy Principle of **Gary W. Floyd, Lumiea Systems Research Division — ThunderStruck Service LLC**:
"From GEP Stabilization to Dual-Map Ethical Reasoning," Derivation v0.2 (a stable system can stabilize a wrong reference — so
every mind is proved on cases it never grew on, every claim is a receipt that can say no); "The Laws of Entropy-Time,"
February 2026 (claims marked derived or predictive, each with its test); "Dream State Architecture," 2025 (overnight work
stays inert until validated); "NEXUS — Distributed Synthetic Intelligence," 2026 (intelligence distributed across
specialist organs). Open Defensive Prior Art (Creative Commons); details in [NOTICE](NOTICE).

Powered by the Konomi architecture, created by Thomas Frumkin. Supplier: [AI Native Solutions](https://www.ai-nativesolutions.com)
— support is agreed per deployment. MIT — no licence fee. Credits and data provenance: [NOTICE](NOTICE), `data/SOURCES.json`.
