# DIGI Card

**Live: https://sjgant80-hub.github.io/digi-card/**

A trading card that is a working mind you own. A DIGI card is a 384 × 576 PNG. Its top sixteen pixel rows carry, byte for
byte and in plain view, a sealed recipe for a small mind grown on real records (a scorecard of at most six readable
rules), the signed history of everyone who has owned it, and every level it has earned. Open it on any device and it
grows that mind there, offline, and proves its score on cases it never saw. Own it, trade it, breed it (a child is born
only if it beats both parents), put it to work with other cards in a mesh — and re-run every claim yourself.

Everything on the live page is this repository's mutation-gated code running in your browser on six real public
datasets. Nothing is mocked; nothing is sent anywhere.

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

Powered by the Konomi architecture, created by Thomas Frumkin. Supplier: [AI Native Solutions](https://www.ai-nativesolutions.com)
— support is agreed per deployment. MIT — no licence fee. Credits and data provenance: [NOTICE](NOTICE), `data/SOURCES.json`.
