# F1 verification — real scorer CLI on the frozen run (task 4.1)

Head after the last source edit (`scripts/plan-review-replay/*`, `scripts/score-plan-review-replay*`). Every block below is a real command and its real output; expected and observed are stated separately.

## 1. `check` on the frozen run

Expected: exit 0, one `ok:` line counting the frozen inputs including the five adjudicator sessions.

Observed:

```
$ bun scripts/score-plan-review-replay.ts check runs/plan-review-loop-measurement-20261102
ok: 112 sources, 5 items, 40 trials, 61 attempts, 165 findings
exit=0
```

Matches.

## 2. Mutated supplied input, digest untouched (throwaway copy)

Expected: `check` names the mutated source, prints both digests and exits nonzero.

Observed:

```
$ cp -R runs/plan-review-loop-measurement-20261102 /tmp/mutcheck
$ echo "" >> /tmp/mutcheck/fixtures/Rtr/tasks.md
$ bun scripts/score-plan-review-replay.ts check /tmp/mutcheck
error: source Rtr/tasks.md: sha256 mismatch for fixtures/Rtr/tasks.md (expected d933b928f56ff7c4845df09f63f500e74d810592d53684b6b4accbc82e671a07, got 366a0dfbd34abf3ff6ba7f7948f3985302bec6f0e230e8ba944558181ef0fb24)
exit=1
```

Matches. The copy was discarded; the frozen run is unchanged (block 1 reran after this test with the same `ok:` line).

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

All hand-calculated quantities match. One expectation of mine was wrong and the scorer is right: I expected the macro denominator to be 2 (both items); the scorer reports `1/1` because an item with no completed trial has no computable recall and is excluded from the macro denominator instead of being scored as zero. The same rule produces the real run's macro denominators (S: 5 items, T: 2 items). The duplicate shows up only as `duplicates = 1` and does not inflate recall: `t1` counts once.

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
S union targets 16 · targets total 85 · blocking 24
per item, discovered per completed trial:
  review-trailer-repair          2+2 → mean 2
  finish-modality-program-route  3+4 → mean 3.5
  acp-permission-parity          4   → mean 4
  strength-progression-targets   4+1 → mean 2.5
  session-move-tool              2   → mean 2
micro pre numerator 14
```

Published values are `S micro pre 14/85`, `S union pre 16/85`, ledger `85 (blocking 24, below-threshold 60, unresolved 1)`. The independent recount reproduces the numerator 14 and the union 16, so the published micro figure is the per-item mean over repeats, not a sum of per-trial hits (that sum is 22).

## 5. Suite

```
$ bun test scripts/score-plan-review-replay.test.ts
50 pass
0 fail
```

## 6. Re-read of the upstream F1 evidence

- `f1/inputs.md` — 85/85 original latent quotes matched the restored snapshots; one metadata-only repair (`Fmp/.openspec.yaml`) is declared; targets started as `unresolved`, not historical-label-as-truth.
- `f1/baseline.md` — Focus 23/85 and Replay union 13/85 reproduced from grouped original annotations; the one historical exclusion is retained with its cost.
- `f1/replays.md` — 10 of 20 intended cells usable, 4 excluded for mid-run model substitution, 6 never dispatched; the scope change that closed the gap is recorded with the setting that was changed and what was not changed.
- `f1/adjudication.md` — five adjudicator sessions on the intended pin, 55/55 judgments and 85/85 target assessments, one source-checked positive match, the near-miss class, and zero false drops with the two legitimate residual losses named.
- `f1/publication.md` — sanitization rules per item privacy, leak scan with the two false positives explained, `report`-based reproduction of `summary.json`.

The observations across these files are actual sessions, complete or explicitly incomplete cells and justified labels, not test pass counts. The one unmet planned condition is the cell count: 10 of 20 reviewer cells. `publication.md` and `RESULT.md` both state it, and task 3.1 stays unchecked for that reason.
