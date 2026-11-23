# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/liuxingdylan/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/liuxingdylan/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: 178 pre-token protocols ranked by implied value, each with an honest range and a costed farm plan. Built for make.fun's "Build the best token launch radar" bounty ($1,325 in USDC).

## What it does

Reads the sealed DefiLlama snapshot (758 protocols, 2026-11-14), finds the protocols that record no token, and ranks them by what a launch would be worth if their record stayed as it is. The board covers all 40 watchlist protocols plus 138 pre-token protocols below the $50M floor, found by the same rule. The 24 live-token protocols are set aside with their market caps shown — the market's own values, never mixed into the ranking.

## The model (radar-2)

Every row is scored by one function of the snapshot's own figures. No protocol name is special-cased.

```
implied = round( peerValue(TVL) x growthMult x maturity x launchOdds(age) )
peerValue(TVL) = exp(6.96 + 0.52 x ln(TVL))   — the live peers' own least-squares line
launchOdds     = sigmoid(1.03 x ln(age_days) - 8.12), clamped [0.02, 0.60]
growthMult     = 1 + 0.5 x clamp(change_7d - median, -40, +80) / 100
```

- **Peer value, not a fixed multiple.** The 128 live-token peers' market caps fit `log(mcap) = 6.96 + 0.52·log(TVL)`: value grows with TVL but sublinearly, so a protocol 10x larger is worth ~3.3x more, not 10x. A fixed multiple would overpay giants and underpay small protocols.
- **Launch odds are a base rate, not a prediction.** They are the share of peers this old that record a token (0–180d: 3%, 180–365d: 14%, 365–730d: 13%, 730–1500d: 22%, 1500d+: 43%), fitted as a logistic in log age.
- **Validated held-out, twice.** Leave-one-out over the 128 live peers: median |log error| 1.24, 30% predicted within 2x of the recorded market cap. Split-half (fit on one half, test on the other, both ways): 1.32 / 1.12. Growth and age terms were tested the same way and kept only as small bounded weights, because they add no out-of-sample accuracy to the level.
- **Every row carries a range.** The implied value is scaled by the peer set's p25/p75 FDV/TVL band, so the dashboard shows `$low – $high` beside every point estimate.

## The dashboard

A static page, no framework and no network: `dashboard/index.html` + `app.css` + `app.js`, reading `data.js` written by `main.ts`.

- Sortable, filterable board (search, category, chain, watchlist-only) with implied value, range bar, and launch odds per row.
- A detail view for every protocol: the model broken into its terms, live-token peers in the same category with their FDV/TVL, and a 7-step farm plan with cost and time per step.
- A live-token tab showing the peer set the model learns from.
- A methodology section quoting the fitted constants and both validations, plus an honesty note: "records no token" means DefiLlama carries no token for the protocol, not that it has none.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22.18 or later, standard library only. The program reads the snapshot, writes `board.json` (178 rows), `data.js`, copies `dashboard/` and `screenshots/`, and writes `dossier.json` with the vendored `vendor/makefun-board.ts`. Two runs write byte-identical outputs. Local gate replica: `node gatecheck.mjs out` (in the entry's working directory, not the repo).

## Farm plans

Each protocol's 7-step plan is derived from its own record — category, chains, TVL, age — never from a hand-written list of names: capital tiers ($50/$100/$150/$250 by TVL), hold windows (30–60 days by age), a second-chain mirror when the protocol runs on two chains, weekly qualifying actions, and a never-pay-to-claim warning.

---

<sub>Entered on [make.fun](https://make.fun/?ref=zzj73w81&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
