# DIGI Card

**Live: https://sjgant80-hub.github.io/digi-card/**

A trading card that is a working mind you own. A DIGI card is a 384 × 576 PNG. Its top sixteen pixel rows carry, byte for
byte and in plain view, a sealed recipe for a small mind grown on real records (a scorecard of at most six readable
rules), the signed history of everyone who has owned it, and every level it has earned. Open it on any device and it
grows that mind there, offline, and proves its score on cases it never saw. Own it, trade it, breed it (a child is born
only if it beats both parents), put it to work with other cards in a mesh — and re-run every claim yourself.

Everything on the live page is this repository's mutation-gated code running in your browser on six real public
datasets. Nothing is mocked; nothing is sent anywhere.

The page opens as a game, built from the same blocks as the cards (PixelWhisperer Kards' palettes, rarity rings and
pixel lettering). Its dock holds eight screens: Estate, Base, Cards, Evals, Mint, Mesh, Send and Proof. Card me hands you
a telco card, and Boot reads it, checks it, grows its mind and counts up to the score your device computed beside the
one the drop declared. The classic document view (Menu → Classic view) holds the full explanation, the brochure and
the white paper. Your key is never kept in the browser's storage: it lives in the tab and in the key file you save.
The game's own files are `ui/mode.js`, `ui/game.js` and `ui/game.css`, and they change no kernel.

## What was proven

Eight organs, each sealed before it was measured (git proves the order: `node tools/order.mjs --organ k`), judged by
their sealed rules alone — **41 of 44 sealed rules held; 3 failed predictions are kept; no property failed.**

| Organ | Result |
|---|---|
| 1 · the card | 1,000/1,000 cards read back exactly; 1,200/1,200 forgeries in 12 classes refused; self-signed fake levels read but are never recorded; median full check 84 ms |
| 2 · germination | 1,000/1,000 minds re-grow offline to exactly their declared GATE; 50/50 searches re-run to the same mind; every card beats a coin on TEST, median GATE→TEST drop 0.002 — **failed:** shop-context's median TEST AUC 0.567 < 0.600 |
| 3 · levels | 69/100 cards levelled in three searches; every level re-runs exactly and deeply; 345/345 forgeries refused; 42/69 rose on TEST — **failed:** the mean TEST gain's lower bound is below zero |
| 4 · breeding | 66/66 children beat both parents on GATE; across departments 40/40 children beat both parents on TEST — **failed:** within a department, 12/26 |
| 5 · trade | 3,037/3,037 honest gives recorded; 300/300 double sales and 100/100 forged gives refused; 4,037 entries replay identically |
| 6 · the mesh | beats its best single card on TEST in 5/5 businesses; shares sum to a million; ledgers replay (not blind: dry-run before its seal, disclosed) |
| 7 · the drop | decoder #0001 re-runs the genesis; 5/5 posts pass the claim gate, 12/12 overreaching drafts refused; 100/100 card-me claims work |
| 8 · scale | the mesh climbs as each department joins, in 5/5 businesses; a 10,000-entry registry replays identically in 36.8 s |

Every kernel is witness CLEAN (359/359 mutants killed) and CI re-proves all of it on every push.

## Run it

```
node --test test/*.test.mjs        # every kernel, fuzzed
node witness-all.mjs               # the mutation gate over every kernel
node tools/vendor-check.mjs        # vendored code byte-identical to its sources
node tools/drop-check.mjs          # the drop re-runs from decoder #0001; every genesis mind re-grows to its declared score
node tools/page-check.mjs          # the page gate
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
| `src/breed.mjs` | a child born only if it beats both parents on GATE |
| `src/mesh.mjs` | consent, the join rule, measured shares, a replayable ledger of credits |
| `src/claims.mjs` | the claim gate for every public post |
| `src/drop.mjs` | the genesis and decoder #0001 |
| `src/cost.mjs` | the cost case, from sourced prices only |
| `data/organ-*/` | eight organs: sealed claims, records, verdicts |
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
