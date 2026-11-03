# F1 verification — real scorer CLI on the frozen run (task 4.1)

Head after the last source edit (`scripts/plan-review-replay/*`, `scripts/score-plan-review-replay*`). Every block below is a real command and its real output; expected and observed are stated separately.

## 1. `check` on the frozen run

Expected: exit 0, one `ok:` line counting the frozen inputs including the five adjudicator sessions.

Observed:

```
$ bun scripts/score-plan-review-replay.ts check runs/plan-review-loop-measurement-20261102
ok: 140 sources, 5 items, 40 trials, 88 attempts, 210 findings
exit=0
```

Matches.

## 2. Mutated supplied input, digest untouched (throwaway copy)

Expected: `check` names the mutated source, prints both digests and exits nonzero.

Observed, re-run against the completed run:

```
$ cp -R runs/plan-review-loop-measurement-20261102 /tmp/tamper-run
$ printf '\n<!-- tampered -->\n' >> /tmp/tamper-run/fixtures/Rtr/gate.md
$ bun scripts/score-plan-review-replay.ts check /tmp/tamper-run
error: source Rtr/gate.md: sha256 mismatch for fixtures/Rtr/gate.md (expected 9a29aac03632d91015ad17f6d0e4af5f1ab94e80236b10a51b3b54808232c31e, got f454d6e4aa9d3016b243c4ef557d58ccc0e1882e7cfb636575317c14a0feb445)
exit=1
```

Matches. The copy was discarded; the frozen run is unchanged (block 1 reran after this test with the same `ok:` line).

## 2b. Determinism of the report

Expected: two consecutive `report --format json` runs on the same dataset are byte-identical.

Observed:

```
$ bun scripts/score-plan-review-replay.ts report R/dataset.json --format json > /tmp/d1.json
$ bun scripts/score-plan-review-replay.ts report R/dataset.json --format json > /tmp/d2.json
$ cmp /tmp/d1.json /tmp/d2.json && echo identical
identical
```

## 3. Hand-calculated duplicate / false-drop / pending case

Input built by hand at `/tmp/handcase/dataset.json`: item `i1` with three targets (`t1`, `t2` blocking, `t3` below threshold) and item `i2` with one blocking target and no dispatched trial. Trial `X-1` reports five findings: `f1` and `f2` both match `t1` (duplicate), `f3` matches blocking `t2` and is refuted by triage (false drop), `f4` is pending, `f5` matches below-threshold `t3` and is refuted (legitimate residual).

Hand calculation before running:

| quantity | expected |
|---|---|
| ledger | 4 targets, 3 blocking, 1 below threshold |
| trial pre recall | 3/3 = 100% (t1, t2, t3 discovered) |
| trial post recall | 1/3 = 33.3% (only t1 survives triage) |
| false drop | 1 of 2 discovered blocking targets = 50% |
| duplicates | 1 (two valid findings, one target unit) |
| pending findings | 1 |
| false positive | 0/4 (no invalid finding) |
| missing trial | `X-2` listed as missing, not scored |

Observed:

```
$ bun scripts/score-plan-review-replay.ts report /tmp/handcase/dataset.json --format md
Unit: first-pass-replay. Targets: 4 (blocking 3, below-threshold 1, unresolved 0).
…
| X | 1/2 | 1/1 = 100.0% | 0.3333333333333333/1 = 33.3% | 3/3 = 100.0% | 1/3 = 33.3% | 1/2 = 50.0% | 0/4 = 0.0% |
…
| X-1 | 3/3 = 100.0% | 1/3 = 33.3% | 1/2 = 50.0% | 0 | 0 | 0 | 0 | 1 |
…
| X-1 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |   (finding kinds: 4 known-target, 1 pending)
…
| trial | X-2 | missing | not dispatched |
exit=0
```

All hand-calculated quantities match. One expectation of mine was wrong and the scorer is right: I expected the macro denominator to be 2 (both items); the scorer reports `1/1` because an item with no completed trial has no computable recall and is excluded from the macro denominator instead of being scored as zero. The same rule produces the real run's macro denominators: S and T both reach all five items, so both are `/5`, while `H-Focus` has no triage at all (`macroPost` denominator 0) and `H-Replay` has one triaged item (`macroPost` denominator 1). The duplicate shows up only as `duplicates = 1` and does not inflate recall: `t1` counts once.

## 4. Independent recomputation of the published report

Expected: the published `report.md` and `summary.json` are exactly what the current CLI produces from the published `dataset.json`, and the headline S figures survive a recount that does not use the scorer.

Observed:

```
$ bun scripts/score-plan-review-replay.ts report <experiment>/dataset.json --format md | cmp - <experiment>/report.md
report.md reproduced, exit=0
$ bun scripts/score-plan-review-replay.ts report <experiment>/dataset.json --format json | cmp - <experiment>/summary.json
summary.json reproduced, exit=0
```

Recount with a separate ad-hoc script reading only `dataset.json` (no scorer import):

```
S union targets 18 · targets total 85 · blocking 24 · below-threshold 60 · unresolved 1
per item, discovered per completed trial:
  review-trailer-repair          2+2+1 / 3 → mean 1.667
  finish-modality-program-route  3+4+4 / 3 → mean 3.667
  acp-permission-parity          4+2+3 / 3 → mean 3.000
  strength-progression-targets   4+1+2 / 3 → mean 2.333
  session-move-tool              2+2+2 / 3 → mean 2.000
micro pre numerator 12.667
```

Published values are `S micro pre 12.666…/85`, `S union pre 18/85`, ledger `85 (blocking 24, below-threshold 60, unresolved 1)`. The independent recount reproduces all three, so the published micro figure is the per-item mean over repeats, not a sum of per-trial hits (that sum is 38).

## 5. Suite

```
$ bun test scripts/score-plan-review-replay.test.ts
65 pass
0 fail
```

## 6. Fix-wave surfaces (F2 wave 1 blockers)

Each fix was proven by mutating the fixed line and watching its own test fail, then restoring it:

| fix | mutation | observed failure |
|---|---|---|
| `annotated` excluded from precision | `else if (false) annotated++` in `countFindings` | both annotated tests fail; precision counts the descriptive rows again |
| post-triage coverage | `post()` returns `pct(r)` unconditionally | coverage test fails; rendered row `\| H \| 2/2 \| … \|` carries no `(triaged 1/2 trials)` |
| repeat agreement denominator | `ratio(b.agreed, b.assessed, …)` | unknown-target test fails; `ghost` row inflates the denominator to 4 |

Observed on the real run after the fixes:

```
$ bun scripts/score-plan-review-replay.ts check runs/plan-review-loop-measurement-20261102
ok: 140 sources, 5 items, 40 trials, 88 attempts, 210 findings
$ bun scripts/score-plan-review-replay.ts report <experiment>/dataset.json --format md | sed -n '9,10p'
| H-Focus | 5/5 | … | n/a (no independently adjudicated findings) |
| H-Replay | 14/15 | … | 0/1 = 0.0% (triaged 1/14 trials) | … | n/a (no independently adjudicated findings) |
```

The five recorded round rows and the `round-2` agreement row (`83/85 = 97.6%`, both disagreements named) render from the dataset; S and T figures are byte-identical to the pre-fix report.

## 6b. Fix-wave surfaces (F2 wave 2)

| fix | mutation | observed failure |
|---|---|---|
| blocking discoveries outside the ledger counted per mechanism | replace the mechanism key with the finding id in `triageAdditional` | the dedupe test fails: two wordings of one mechanism count twice |
| only independently blocking rows count as a loss | drop `adj.blocking !== "blocking"` from the filter | the same test fails: a below-threshold mechanism enters the denominator |
| the off-ledger drop rate has its own denominator | pool `i.falseDrop` instead of `i.additionalBlockingDrop` per arm | the arm test fails: the loss is folded into the target-level rate |
| the unsuccessful cost row is labelled a subset | remove the label | the cost-label test fails |

Observed on the published run after the fixes: S keeps 24 of 25 blocking mechanisms outside the ledger and drops one (`Replacement1SSpt3.9`), T keeps 5 of 5. The historical arms carried a `n/a` drop rate here but still published zero counts; since wave 4 (section 6e) `H-Focus` reports `n/a` in every cell and `H-Replay`'s zeros carry their `triaged 1/14` coverage. The target-level `false drop` cells (`0/36`, `0/10`) and every recall figure were byte-identical to the pre-fix report at this point; the post-triage figures moved later, in wave 3 (section 6c).

## 6c. Fix-wave surfaces (F2 wave 3)

| fix | mutation | observed failure |
|---|---|---|
| a retained automatic blocker needs a blocking target, not only a blocking finding | classify every matched target with the finding's severity again | the mixed-severity test fails: the below-threshold target is reported as retained and post recall reads 2/2 |
| the reproduction commands name one working directory | — | run from the published directory, both commands reproduce their artifact byte-exactly (`wave-4/qa3`) |

Observed on the published run after the fix: trial `S-App-1` post 3/11 → 2/11, S `macro post` 18.7 % → 18.1 %, `micro post` 12.33/85 → 12/85, `union post` 17/85 → 16/85, S `retained` 37 → 36 with one `survivingNonBlocker`. Exactly one finding/target pair in the run is affected (`RerunSApp1.5` matching `acp-permission-parity|R02.2` blocking and `|R07.1` below threshold); every pre-triage figure, both false-drop columns and both precision columns are unchanged.

## 6d. Fix-wave surfaces (F2 wave 4)

| fix | mutation | observed failure |
|---|---|---|
| a match the verifier confirmed as blocking survives triage, whatever severity the adjudicator gave that finding | return `retained` from verifier disposition alone again | the survival test fails: the target is reported as retained and post recall reads 1/1 |
| retention still needs an independently blocking finding as well as an independently blocking target | — | with the qualifying duplicate removed, the same target must not be retained |
| the stale `T: 2 items` macro denominator | — | published `summary.json` reports `/5` for both fresh arms |

Observed on the published run after the fix: S and T each move their one `downgraded` and `legitimateResidual` count to `survivingNonBlocker` (S 2, T 1); no recall, false-drop or precision figure moves, because no target in the run is independently blocking with only a below-threshold surviving match.

## 6e. Fix-wave surfaces (F2 wave 4, second round)

| fix | mutation | observed failure |
|---|---|---|
| a below-threshold loss is legitimate only with a stated consequence | drop the consequence condition again | the consequence-free residual test fails: a refuted loss nobody justified is published as `legitimateResidual` |
| an arm without triage reports no off-ledger figure | sum the trials regardless of availability again | the aggregate test fails: the historical arm publishes zeros instead of `n/a` |

Observed on the published run after the fix: `H-Focus`'s off-ledger row changes from six zeros to `n/a (triage unavailable)`, `H-Replay`'s zeros gain their `triaged 1/14 trials` coverage, and the new `unstated residual` column is 0 in both fresh arms. No recall, false-drop or precision figure moves.

## 6f. Fix-wave surfaces (F2 wave 4, third round)

| fix | mutation | observed failure |
|---|---|---|
| an arm without any triaged trial reports no triage counts | reduce the empty set into `EMPTY_COUNTS` again | the historical-arm test fails: `H` publishes ten zeros instead of `null` |

Observed on the published run after the fix: `H-Focus`'s arm `triage` object in `summary.json` changes from ten zeros to `null`; `H-Replay` keeps its zeros, because its one empty-triage trial is a measured outcome. `report.md` is byte-identical, and no recall, false-drop or precision figure moves.

## 6g. Fix-wave surfaces (F2 wave 4, fourth round)

| fix | mutation | observed failure |
|---|---|---|
| a trial span covers every bound attempt | restore the selected-attempts envelope | the span test fails: the failed verifier's 180 s envelope collapses to the reviewer's 60 s |
| completeness follows the verifier stage, not the presence of a failed attempt | require a failed verifier attempt again | the span test fails: a never-dispatched verifier publishes the reviewer-only interval as complete |

Observed on the published run after the fix: every trial span in `summary.json` is byte-identical, because this run's two replaced verifier attempts (`VerifySRtr1`, `VerifySRtr3`, both `excluded`) ran inside their trial's envelope and every fresh trial has a completed verifier. The 20 historical spans stay unavailable for want of timestamps.

## 6h. Fix-wave surfaces (F2 wave 5)

| fix | mutation | observed failure |
|---|---|---|
| a private source coordinate keeps its identity through a stable pseudonym | return the old numbered `private-repository-coordinate` again | the publication test fails: two distinct private files become the same string |
| a public coordinate, description and reason are published unchanged | pseudonymize every coordinate | the publication test fails: `plan.md:3` of a public item is rewritten |
| private claim text and adjudication prose stay withheld | publish the private reason | the publication test fails: the private identifier reaches the published row |

Observed after the fix: regenerating `experiment/dataset.json` with `publish` changes exactly the intended rows — 42 private targets and 69 private adjudications regain real or pseudonymized coordinates, 51 public fresh findings regain their description, and sources, attempts and triage rows are byte-identical to the previously published ones. `summary.json` and `report.md` reproduce byte-exactly, so no figure moves.

## 7. Re-read of the upstream F1 evidence

- `f1/inputs.md` — 85/85 original latent quotes matched the restored snapshots; one metadata-only repair (`Fmp/.openspec.yaml`) is declared; targets started as `unresolved`, not historical-label-as-truth.
- `f1/baseline.md` — Focus 23/85 and Replay union 13/85 reproduced from grouped original annotations; the one historical exclusion is retained with its cost; the post-hoc reclassification of those rows to `annotated` is declared with its effect.
- `f1/replays.md` — all 20 intended cells usable: 10 in the first wave, 10 in the authorised resume wave, each on its intended pin; the nine earlier losses stay excluded with their cost, the config setting that caused them is named, and the one cancelled duplicate dispatch (`RerunTFmp1`, no billed request) is recorded rather than hidden.
- `f1/adjudication.md` — ten adjudicator sessions on the intended pin across two blinded rounds, 100/100 fresh judgments and 85/85 target assessments per round, 83/85 round-2 agreement on target severity, one source-checked positive match, the near-miss class, and zero false drops. Since F2 wave 4 there is no target-level loss at all: the two rows formerly published as legitimate residual losses are matches the verifier confirmed as blocking, now counted as surviving non-blockers.
- `f1/publication.md` — sanitization rules per item privacy, leak scan with the two false positives explained, `report`-based reproduction of `summary.json`.

The observations across these files are actual sessions and justified labels, not test pass counts. The measured conditions of the experiment are met: 20 of 20 reviewer cells on their intended pins, each triaged, all fresh findings adjudicated, published artifacts reproducing byte-exactly from the published dataset. Two planned conditions were not met as designed and are recorded as execution deviations on their task rows, as limitations in `RESULT.md` and as accepted residual risks in `gate.md`: the pre-dispatch ledger left current target severity `unresolved`, so the blocking denominator was resolved by the same blinded adjudicators that saw that item's fresh findings, and design D3's historical reference checks were never adjudicated. Five archived round records are now recorded as last rounds with pinned revisions; measured rounds saved and full-cycle savings stay `not-measured`, because no full review-and-fix cycle was replayed.
