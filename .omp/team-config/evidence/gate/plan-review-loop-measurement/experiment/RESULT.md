# Plan-review loop measurement — result

Run `plan-review-loop-measurement-20261102`, scored by `scripts/score-plan-review-replay.ts`. Everything below is produced by that scorer from `dataset.json` in this directory; `summary.json` and `report.md` are its own output.

**All 20 intended fresh reviewer cells completed on their intended pin** (S 15/15, T 5/5), each followed by the current blocker verifier. Nine earlier dispatches were lost to a local retry rule, were excluded with their cost retained, and were re-run after that rule was corrected.

## What was measured

One fresh single reviewer per cell on a frozen round-1 plan, followed by the current blocker verifier, against a frozen ledger of 85 latent targets recovered from five historical plan reviews (`f1/inputs.md`). Independent blinded adjudication in two rounds assigns every fresh finding a validity, a current severity and a classification, and re-assesses every target's current severity (`f1/adjudication.md`).

Arms:

| arm | shape | model / effort | trials done/intended |
|---|---|---|---|
| H-Focus | historical reference (3 lenses, 2026-10 corpus) | mixed historical | 5/5 |
| H-Replay | historical reference (replay bench) | mixed historical | 14/15 |
| S | one fresh reviewer, standard depth | `gpt-6.1-sol` / high | 15/15 |
| T | one fresh reviewer, same brief | `gpt-6.1-terra` / medium | 5/5 |

## Denominators

Current ledger: 85 targets — 24 independently blocking, 60 below threshold, 1 unresolved. The severity split is the adjudicators' current assessment, not the historical labels; the historical labels remain descriptive references (`blocking: unresolved`) and are never inherited by fresh findings.

A second, independent adjudication round re-assessed all 85 targets on the same frozen ledger and agreed with the first round on **83 of 85 (97.6 %)**; both disagreements move a target from `blocking` to `below-threshold`. Round 1 stays authoritative because it was fixed before the second-round findings existed. The repeated assessments are published as normalized rows (`targetRepeats`), and the scorer derives this agreement and names both disagreeing targets in the report's `Target severity repeats` table.

## Recall and precision

| arm | macro pre | macro post | micro pre | micro post | union pre | union post | false drop | false positive |
|---|---|---|---|---|---|---|---|---|
| H-Focus | 32.4% | n/a (no triage) | 23/85 = 27.1% | n/a | 23/85 | n/a | n/a | n/a |
| H-Replay | 12.9% | 0/1 (triaged 1/14) | 8.5/85 = 10.0% | 0/11 (triaged 1/14) | 13/85 | 0/11 (triaged 1/14) | n/a | n/a |
| S | 19.0% | 18.1% | 12.67/85 = 14.9% | 12/85 = 14.1% | 18/85 = 21.2% | 16/85 = 18.8% | 0/36 | 7/75 = 9.3% |
| T | 14.8% | 13.3% | 11/85 = 12.9% | 10/85 = 11.8% | 11/85 = 12.9% | 10/85 = 11.8% | 0/10 | 5/25 = 20.0% |

`pre` is the reviewer's discovery before triage; `post` is after the current verifier. Macro averages items, micro pools targets (per-item mean over repeats), union takes the best of an item's three repeats.

Two honesty constraints shape the historical rows. Their findings were never independently adjudicated — they carry the original annotations, recorded as `annotated` rather than `valid` — so **no precision figure exists for them**; `false positive` is `n/a`, not `0`. And only one of H-Replay's fourteen completed trials has a triage outcome at all, so every post-triage cell of that arm carries its `triaged 1/14` coverage instead of reading as an arm-wide result.

A single S reviewer finds about 15 % of the frozen ledger; three independent S reviewers on the same plan reach 21 %. The historical three-lens arm reached 27 % — on a different brief, contract and era, so the comparison is not causal.

One further rule shapes the `post` column: a target is a retained automatic blocker only when the target itself is independently blocking, not merely because a surviving finding was. Exactly one pair in the run is affected (`RerunSApp1.5` matches a blocking and a below-threshold target), and it is counted as a surviving non-blocker rather than as retention or as a loss.

## Finding classification (fresh arms, adjudicated)

| class | S (75 findings) | T (25 findings) |
|---|---|---|
| known target (matched the frozen ledger) | 35 | 11 |
| additional defect (valid, blocking, no target) | 32 | 7 |
| useful note | 0 | 2 |
| unsupported consequence | 5 | 5 |
| evidence error | 1 | 0 |
| false claim | 2 | 0 |
| severity error / pending | 0 | 0 |

39 of 100 fresh findings are independently valid and blocking without matching any frozen target. The 85-target ledger is therefore a lower bound on what these plans contained, and single-reviewer recall against it understates discovery.

## Triage

| arm | retained | protected | surviving non-blocker | undecided | pending | downgraded | false drop | legitimate residual | unstated residual |
|---|---|---|---|---|---|---|---|---|---|
| S | 36 | 0 | 2 | 0 | 0 | 0 | **0** | 0 | 0 |
| T | 10 | 0 | 1 | 0 | 0 | 0 | **0** | 0 | 0 |

Across 20 trials and 100 findings the verifier dropped no independently blocking target, and it produced no target-level loss at all. Three discovered targets are not retained automatic blockers although a match of theirs survived triage: the adjudicator rated the target below the current blocking threshold (`S-App-1`), or rated the surviving finding below it while the verifier confirmed the finding as blocking (`S-Spt-3`, `T-Smt-1`). None of the three is a verifier loss — the verifier kept the finding in every case.

The frozen ledger is not the whole verifier story. Counting the independently blocking discoveries that match no frozen target — deduplicated by mechanism within each trial, then summed over trials — the verifier kept 24 of 25 in S and 5 of 5 in T, and refuted one (`Replacement1SSpt3.9`, S/Spt):

| arm | blocking mechanisms outside the ledger | retained | dropped | drop rate |
|---|---|---|---|---|
| S | 25 | 24 | 1 | 1/25 = 4.0% |
| T | 5 | 5 | 0 | 0/5 = 0.0% |

That single drop is a real verifier loss and is deliberately kept out of the `false drop` column, whose frozen definition is target-level. Both figures are scorer output (`report.md`, `Blocking discoveries outside the frozen ledger`), which states the same unit; a mechanism found in two repeats of one plan therefore counts twice, as trial-level recall does. The historical arms are absent from this table on purpose: `H-Focus` has no triage in any trial and reports `n/a` rather than a zero, and `H-Replay`'s zeros carry their `triaged 1/14` coverage.

## Round records

Each measured plan's archived `review.md` pins the last plan-review round it reached, under the `omp-gated` workflow:

| item | last round | pinned revision |
|---|---|---|
| acp-permission-parity | 12 | `53dfd84aaf35…` |
| finish-modality-program-route | 16 | `763479f9bc15…` |
| review-trailer-repair | 17 | `3d91cdd514c6…` |
| session-move-tool | 22 | `2df8ac2d9b7b…` |
| strength-progression-targets | 40 | `bffb00754158…` |

These are **recorded last rounds, not observed round counts**: the intervening rounds were never reconstructed, so a last round of 22 is not evidence of 22 successful rounds. No paired full review-and-fix cycle was replayed, so measured rounds saved and full-cycle savings remain **not measured**, and the one-full-plus-delta and two-full budgets in the design stay counterfactual.

## Cost and time

| stage | attempts | USD |
|---|---|---|
| reviewer | 56 | 47.26 |
| verifier | 22 | 4.08 |
| adjudicator | 10 | 19.90 |
| unsuccessful (subset of the stage rows, excluded attempts whose cost is retained) | 9 | 31.97 |
| **total** | 88 | **71.25** |

Per-arm: H-Focus 1.07, H-Replay 1.42, S 47.48, T 1.37 USD. All usage was recorded; the total is not a lower bound.

Per usable cell: an S reviewer costs ≈0.9 USD and a T reviewer ≈0.14 USD; a verifier pass ≈0.14 USD. The 31.97 USD `unsuccessful` bucket (45 % of total spend) bought nothing — a local retry rule switched models mid-stream on a transient `stream_disconnected` (`f1/replays.md`). It is an operational finding about the harness, not about review depth.

Experiment wall envelope 19,466,782 ms (≈5 h 24 min) across concurrent dispatch. Per-trial spans are published where both dispatch and terminal timestamps exist; historical trials have none and are marked unavailable rather than reconstructed from response durations.

## Limitations (design D6)

- **No causal claim.** Every arm pair differs in more than one axis; the scorer labels all of them `confounded`. S vs T differs in model and effort; H vs S additionally in brief, contract, rules, era and triage.
- **No model ranking.** Two models at two efforts on five plans cannot rank models.
- **Loop shape not measured.** Each cell is a first-pass single-reviewer replay. Nothing here measures what a multi-round loop converges to, how many rounds it would save, or what a different loop shape would cost.
- **Historical arms are reference only.** They come from a different era, brief and contract; their findings were never independently adjudicated (`annotated`), so they carry no precision figure, and their triage is unavailable for all but one trial.
- **Target ledger is a lower bound**, as the additional-defect count shows.
- **Adjudication is a model judgment**, repeated once on targets (83/85 agreement) and not repeated on findings. Design D3 also asked for blinded historical findings as reference checks; the normalized corpus holds placeholders instead of the original claim text, so they were never adjudicated and the adjudicator has no calibration signal against known labels.
- **The blocking denominator is not result-independent.** The pre-dispatch freeze fixed every target's ID, evidence and match criteria but left current severity `unresolved`; the determinate assessment came from the same blinded adjudicators that judged that item's fresh findings. A severity baseline fixed before any fresh result exists would be stronger. The round-2 repeat (83/85, both disagreements `blocking` → `below-threshold`) bounds, but does not remove, that exposure.

## Amendments after the input freeze

`scoring-contract.md` was frozen before any trial and its bytes are unchanged. Eight scorer rules were added after the fresh results existed; four remove an unmeasured claim or add a measured one the contract's target-level definitions left unreported, and four correct a figure against the contract's or the specification's own wording:

1. `annotated` validity for rows that were never independently judged. The 44 historical annotation rows previously carried `valid`, which placed them in the precision denominator; the historical arms' `false positive` is now `n/a` instead of `0`.
2. Post-triage coverage. Figures pooled from fewer trials than the arm completed now render their contributing trial count.
3. `targetRepeats` rows plus a derived agreement table, so the repeat reliability quoted above is scorer output rather than prose.
4. Triage outcomes for independently blocking discoveries outside the frozen ledger, reported separately from the target-level `false drop` the contract defines. Without it the one verifier drop this experiment produced was in no published figure.
5. Target severity decides retention. The scorer previously classified each matched target with the severity of the surviving finding, which made a `below-threshold` target a retained automatic blocker although the contract requires the target itself to be independently blocking. This is the one amendment that moved a fresh-arm figure: S `macro post` 18.7 % → 18.1 %, `micro post` 12.33/85 → 12/85, `union post` 17/85 → 16/85, trial `S-App-1` post 3/11 → 2/11. Every pre-triage figure, both false-drop columns and the precision columns are unchanged.
6. Verifier disposition decides survival, not eligibility. The scorer previously demoted a match the verifier had confirmed as blocking whenever the adjudicator rated that finding below threshold, which published it as a `downgraded` verifier loss plus a `legitimate residual`. The contract's `confirmed-but-nonblocking downgrade` is the verifier's own call, so such a match survives triage — and it still is no retained automatic blocker, because the contract requires an independently blocking finding as well as an independently blocking target. S and T each move their one `downgraded` and `legitimate residual` count to `surviving non-blocker`; no recall, false-drop or precision figure moves.
7. A below-threshold loss counts as a legitimate residual only when its triage row states a concrete consequence, which the contract's definition requires alongside below-threshold severity; a loss nobody justified is counted separately as `unstated residual`. Both columns are 0 in this run, so no published figure moves.
8. An arm whose trials carry no triage reports no off-ledger figure. `H-Focus` previously published zeros for discovered, retained and dropped mechanisms although its triage never ran, which reads as a measured result; it now reports `n/a`, and `H-Replay`'s partial zeros carry their `triaged 1/14` coverage. The specification requires exactly that.

## Reproduction

Run from this directory (`.omp/team-config/evidence/gate/plan-review-loop-measurement/experiment/`), with `<repo>` the repository root:

```
bun <repo>/scripts/score-plan-review-replay.ts report dataset.json --format json | cmp - summary.json
bun <repo>/scripts/score-plan-review-replay.ts report dataset.json --format md | cmp - report.md
```

This directory carries digests of all 140 inputs but not their bytes: plan fixtures, briefs and raw sessions stay in the local run directory, two of the five plans belong to a private repository. `check` (which re-hashes supplied bytes) therefore runs only against that local run directory; `report` runs here and reproduces `summary.json` exactly.
