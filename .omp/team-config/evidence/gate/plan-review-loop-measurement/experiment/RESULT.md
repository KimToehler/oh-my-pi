# Plan-review loop measurement — result (interim)

Run `plan-review-loop-measurement-20261102`, scored by `scripts/score-plan-review-replay.ts`. Everything below is produced by that scorer from `dataset.json` in this directory; `summary.json` and `report.md` are its own output.

**Status: interim.** 10 of the 20 intended fresh reviewer cells are usable (S 8/15, T 2/5). Four S cells are excluded for a mid-run model substitution, six were never dispatched after the dispatch ceiling was reached. The user settled the gap by scope change rather than by re-running cells, so this artifact is an honest partial measurement, not the completed 20-cell design.

## What was measured

One fresh single reviewer per cell on a frozen round-1 plan, followed by the current blocker verifier, against a frozen ledger of 85 latent targets recovered from five historical plan reviews (`f1/inputs.md`). Independent blinded adjudication assigns every fresh finding a validity, a current severity and a classification, and re-assesses every target's current severity (`f1/adjudication.md`).

Arms:

| arm | shape | model / effort | trials done/intended |
|---|---|---|---|
| H-Focus | historical reference (3 lenses, 2026-10 corpus) | mixed historical | 5/5 |
| H-Replay | historical reference (replay bench) | mixed historical | 14/15 |
| S | one fresh reviewer, standard depth | `gpt-6.1-sol` / high | 8/15 |
| T | one fresh reviewer, same brief | `gpt-6.1-terra` / medium | 2/5 |

## Denominators

Current ledger: 85 targets — 24 independently blocking, 60 below threshold, 1 unresolved. The severity split is the adjudicators' current assessment, not the historical labels; the historical labels remain descriptive references (`blocking: unresolved`) and are never inherited by fresh findings.

Historical reference denominators are the same 85 targets, with per-arm reachable subsets: H-Focus 85, H-Replay 85, S 85, T 46 (two items only).

## Recall and precision

| arm | macro pre | macro post | micro pre | micro post | union pre | false drop | false positive |
|---|---|---|---|---|---|---|---|
| H-Focus | 32.4% | n/a (no triage) | 23/85 = 27.1% | n/a | 23/85 | n/a | 0/24 |
| H-Replay | 12.9% | 0/1 | 8.5/85 = 10.0% | 0/11 | 13/85 | n/a | 0/20 |
| S | 20.9% | 22.2% | 14/85 = 16.5% | 11.5/71 = 16.2% | 16/85 = 18.8% | 0/17 | 4/41 = 9.8% |
| T | 11.8% | 8.3% | 5/46 = 10.9% | 4/46 = 8.7% | 5/46 | 0/4 | 2/14 = 14.3% |

`pre` is the reviewer's discovery before triage; `post` is after the current verifier. Macro averages items, micro pools targets, union takes the best of an item's repeats.

## Finding classification (fresh arms, adjudicated)

| class | S (41 findings) | T (14 findings) |
|---|---|---|
| known target (matched the frozen ledger) | 20 | 5 |
| additional defect (valid, blocking, no target) | 17 | 6 |
| useful note | 0 | 1 |
| unsupported consequence | 2 | 2 |
| false claim | 2 | 0 |
| evidence error / severity error / pending | 0 | 0 |

20 of 55 fresh findings are independently valid and blocking without matching any frozen target. The 85-target ledger is therefore a lower bound on what these plans contained, and single-reviewer recall against it understates discovery.

## Triage

Across all triaged trials: 17 retained (S) and 4 (T); 0 protected; 0 undecided; 0 pending; 0 false drops. Two losses occurred (`S-Spt-3`, `T-Smt-1`), both because the independent adjudicator rated the matched target below the current blocking threshold — legitimate residual, not verifier error.

## Round records

No round record with pinned provenance was recovered: `rounds.observed` is empty. Measured rounds saved and full-cycle savings remain **not measured**, and the one-full-plus-delta and two-full budgets in the design stay counterfactual.

## Cost and time

| stage | attempts | USD |
|---|---|---|
| reviewer | 46 | 40.33 |
| verifier | 10 | 2.37 |
| adjudicator | 5 | 9.99 |
| unsuccessful (excluded attempts, cost retained) | 9 | 31.97 |
| **total** | 61 | **52.69** |

Per-arm: H-Focus 1.07, H-Replay 1.42, S 39.67, T 0.53 USD. All usage was recorded; the total is not a lower bound.

Experiment wall envelope 12,015,442 ms (≈3 h 20 min) across concurrent dispatch. Per-trial spans are published where both dispatch and terminal timestamps exist; historical trials have none and are marked unavailable rather than reconstructed from response durations.

The `unsuccessful` bucket is the dominant cost: 61% of spend bought nothing, caused by a local retry rule that switched models on a transient `stream_disconnected` (`f1/replays.md`). It is an operational finding about the harness, not about review depth.

## Limitations (design D6)

- **No causal claim.** Every arm pair differs in more than one axis; the scorer labels all of them `confounded`. S vs T differs in model, effort and repeat count; H vs S additionally in brief, contract, rules, era and triage.
- **No model ranking.** Two models at two efforts on 10 cells cannot rank models.
- **Asymmetric repeats.** S has 1–2 usable repeats per item, T has 1 on two items. Union figures are best-of-repeats on unequal samples.
- **Loop shape not measured.** Each cell is a first-pass single-reviewer replay. Nothing here measures what a multi-round loop converges to, how many rounds it would save, or what a different loop shape would cost.
- **Historical arms are reference only.** They come from a different era, brief and contract, and their triage is unavailable.
- **Target ledger is a lower bound**, as the additional-defect count shows.

## Reproduction

```
bun scripts/score-plan-review-replay.ts report dataset.json --format json | cmp - summary.json
bun scripts/score-plan-review-replay.ts report dataset.json --format md
```

This directory carries digests of all 112 inputs but not their bytes: plan fixtures, briefs and raw sessions stay in the local run directory, two of the five plans belong to a private repository. `check` (which re-hashes supplied bytes) therefore runs only against that local run directory; `report` runs here and reproduces `summary.json` exactly.
