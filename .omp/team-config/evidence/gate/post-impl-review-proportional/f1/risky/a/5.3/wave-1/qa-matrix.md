# QA matrix (F2 wave 1, quota-remaining)

Snapshot head 58c6cf0fa183a2aa29aeb52b66207ceefab97f21 (F2 wave 1), runtime bun 1.4.4. Rows 1-3 are CARRIED from F1 (captured on 0cced13999e9e7f199ee821d3c591981c7d6ea0d); rows 4-6 were run in this wave on the snapshot head.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| 1 | Spec: Usage within the limit (happy path) | `bun -e 'import {remaining} from "./src/quota"; console.log(remaining(3,10))'` | 7 | 7, exit 0 | PASS (carried) | .omp/team-config/evidence/gate/quota-remaining/f1/s1-within-limit.txt |
| 2 | Spec: Negative control, usage above the limit | `bun -e 'import {remaining} from "./src/quota"; console.log(remaining(12,10))'` | 0, never -2 | 0, exit 0 | PASS (carried) | .omp/team-config/evidence/gate/quota-remaining/f1/s2-above-limit-control.txt |
| 3 | Spec: Integer values are accepted | `bun -e 'import {remaining} from "./src/quota"; console.log(remaining(0,5))'` | 5 | 5, exit 0 | PASS (carried) | .omp/team-config/evidence/gate/quota-remaining/f1/s3-integers-accepted.txt |
| 4 | Spec: Negative control, fractional usage | `bun -e '... console.log(remaining(2.5,10))'` uncaught, then caught with `e.constructor.name` | thrown RangeError, never 7.5 | uncaught: `RangeError: quota values must be integers`, exit 1; caught: `RangeError: quota values must be integers` | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/r4-fractional-usage-control.txt |
| 5 | Riskiest edge: boundary used == limit; fractional limit; NaN; Infinity; string input | `remaining(10,10)`; loop over `[3,10.5]`, `[NaN,10]`, `[3,Infinity]`, `["3",10]` via `bun -e` | 0 at the boundary; RangeError for each non-integer | `0`; RangeError `quota values must be integers` for all four | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/r5-edges.txt |
| 6 | Regression on adjacent behaviour: existing `checkQuota` | `bun test`; `bun -e '... console.log(checkQuota(3,10), checkQuota(10,10), checkQuota(12,10))'` | 2 pass 0 fail; `true false false` | 2 pass, 0 fail; `true false false` | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/r6-regression-checkquota.txt |

Carry reasons (rows 1-3): the only commits after the F1 capture head 0cced13 are c1848ea (adds F1 evidence files under .omp/team-config/evidence/gate/quota-remaining/f1/) and 58c6cf0 (adds openspec/changes/quota-remaining/review.md); `git diff --stat 0cced13 HEAD -- src test package.json` is empty, so neither commit can change what `remaining()` returns.
QA verdict: PASS (6 rows, 0 failing).
