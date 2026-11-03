# QA matrix (F2 wave 1, quota-remaining)

Reviewed head: 69ca02af5f15f24a676291a4bf152ee191d3b489 (review worktree, detached), diff base 6bdaef7 (main). Channel: library API exercised with `bun -e` / `bun test` (bun 1.4.4); each artifact is the verbatim command, stdout+stderr and exit code.
Depth: risky, so one row per spec scenario (negative controls included) plus happy path, riskiest edge and adjacent-behaviour regression.

Reuse note: the tracked F1 evidence (`f1/qa-matrix.md`, rows 1-3) was captured during plan execution, not in this session, records outputs without commands, and has no row for the spec's fractional-usage Negative control although task 2.1 asks for every scenario. Every row below was therefore run in this session on the snapshot head; no row is carried. F1 observations for rows 1-3 agree with rows 1-3 here.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| 1 | Spec: usage within the limit (happy path) | `bun -e 'import {remaining} from "./src/quota"; console.log(remaining(3,10))'` | `7` | `7`, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q1-within-limit.txt |
| 2 | Spec: Negative control, usage above the limit | `bun -e '... const r=remaining(12,10); ... if (r!==0) exit 1'` | `0`, never `-2` | `0`, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q2-above-limit-control.txt |
| 3 | Spec: integer values are accepted | `bun -e '... remaining(0,5)'` | `5` | `5`, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q3-integers-accepted.txt |
| 4 | Spec: Negative control, fractional usage | `bun -e '... try { remaining(2.5,10); exit 1 } catch ...'` | thrown `RangeError`, never `7.5` | `RangeError: quota values must be integers`, instanceof RangeError=true, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q4-fractional-used-control.txt |
| 5 | Requirement text: fractional `limit` also rejected | `bun -e '... try { remaining(2,10.5); exit 1 } catch ...'` | thrown `RangeError` | `RangeError`, instanceof RangeError=true, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q5-fractional-limit-control.txt |
| 6 | Riskiest edge: boundary at the limit | `bun -e '... remaining(10,10), remaining(11,10), remaining(9,10)'` | `0`, `0`, `1` | `0`, `0`, `1`, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q6-boundary-at-limit.txt |
| 7 | Regression: existing `checkQuota` suite | `bun test` | 2 pass, 0 fail | 2 pass, 0 fail, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q7-regression-checkquota-suite.txt |
| 8 | Regression: no existing export changes (proposal Impact) | `bun -e 'import * as q from "./src/quota"; ... Object.keys(q) ... checkQuota(3,10), checkQuota(10,10)'` | exports `checkQuota`,`remaining`; `true`,`false` | `["checkQuota","remaining"]`, `true`, `false`, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q8-regression-exports.txt |
| 9 | Malformed input: NaN, Infinity, numeric string | `bun -e '... remaining(NaN,10), remaining(3,Infinity), remaining(3,"10")'` | `RangeError` each (not integers) | `RangeError` for all three, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q9-malformed-nonfinite.txt |

Not exercised: negative `used` or `limit` values (the spec states no behaviour for them; `remaining(-5,10)` is not claimed). No automated test for `remaining` exists in `test/quota.test.ts`; the rows above are manual captures only.

QA verdict: PASS (9/9 rows).
