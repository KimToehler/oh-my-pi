# Historical baseline — real scorer

## Source audit

Original annotation file read only. `recall_table` is not used. Join individual `blocker_matches` rows to each result's finding IDs, intersect each item's original `latent_sets`, and group by the actual retained child identities:

- Focus: Spt F61SptCor/Ver/Chk; Smt F61SmtCor/Ver/Chkb; App F61AppCorb/Ver/Chk; Fmp FocusFmpCor/Ver/Chk; Rtr FocusRtrCor/Ver/Chk.
- Replay: Spt B61Spt1/2/3; Smt B61Smt1/2/3; App B61App1/2bb/3; Fmp ReplayFmp1/2/3bbb; Rtr ReplayRtr1b/2/3.
- ReplayFmp3bbb is excluded from quality, as originally recorded. Its child model events show both intended terra and substituted claude-sonnet. Its reported usage cost, $0.3877402, remains in the attempt ledger.

Thirty child sessions were individually parsed for session IDs, actual model/effort changes, loaded prompt/tool-grant metadata and assistant usage.cost.total. Historical dispatch-to-terminal bindings were not recovered: both timing fields remain explicitly null, never inferred from response durations. Full extraction rows/source digests are local historical-extraction.json. Historical target annotations are descriptive reference judgments, not inherited matches for future findings or claims of current blocking severity.

## Commands and observed results

`bun test scripts/score-plan-review-replay.test.ts scripts/score-plan-review-replay-report.test.ts`: exit 0, 48 pass / 0 fail, 171 assertions.

`bun scripts/score-plan-review-replay.ts check runs/plan-review-loop-measurement-20261102`: exit 0, 78 sources / 5 items / 40 declared trials / 30 attempts / 110 findings.

`bun scripts/score-plan-review-replay.ts report runs/plan-review-loop-measurement-20261102/dataset.json --format json`: exit 0. Exact output retained locally as baseline-summary.json, recovered from the command's untruncated output artifact.

| Item | Targets | Focus group union | Replay repeat union |
|---|---:|---:|---:|
| Spt | 32 | 6 | 1 |
| Smt | 14 | 5 | 4 |
| App | 11 | 4 | 3 |
| Fmp | 10 | 6 | 3 |
| Rtr | 18 | 2 | 2 |
| Total | 85 | 23 | 13 |

Actual report: H-Focus `microUnionPre = 23/85 = 0.27058823529411763`; H-Replay `microUnionPre = 13/85 = 0.15294117647058825`. H-Replay has 15 intended / 14 completed / 1 excluded trials. At the time of this baseline S and T still showed 15 and 5 missing cells; they were completed later (`f1/replays.md`). No present-verifier retention or loss result is inferred from historical discovery annotations.

## Reclassification of the historical rows (F2 wave 1)

The 44 historical adjudication rows were first stored with `validity: "valid"`, which is wrong on its face: no historical claim was ever adjudicated (`f1/adjudication.md`). That label placed them in the precision denominator, so the report published `false positive 0/24` and `0/20` for the historical arms as if measured. They now carry `validity: "annotated"`, a validity that contributes target coverage but no precision claim, and the scorer rejects it outside a historical-reference trial. The union figures above are unchanged — 23/85 and 13/85 still reproduce — while both historical `false positive` cells are now `n/a (no independently adjudicated findings)`.
