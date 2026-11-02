# QA matrix (F2 wave 1, quota-remaining)

Head 69ca02af5f15f24a676291a4bf152ee191d3b489, bun 1.4.4, run from repo root by the orchestrator. Every row re-run in this wave; no F1 row carried (F1 captures were not made in this session and their text does not match the output of the commands the F1 matrix lists). Rows 1-8 command form: bun -e 'import {remaining, checkQuota} from "./src/quota"; ...JSON.stringify(<expr>)...'; the full command is in each artifact.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| 1 | Spec S1 Usage within the limit (happy path) | `remaining(3, 10)` | 7 | 7, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q1-within-limit.txt |
| 2 | Spec S2 Negative control: usage above the limit | `remaining(12, 10)` | 0; -2 fails the row | 0, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q2-above-limit-control.txt |
| 3 | Spec S3 Integer values are accepted | `remaining(0, 5)` | 5 | 5, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q3-integers-accepted.txt |
| 4 | Spec S4 Negative control: fractional usage (missing from F1 matrix) | `remaining(2.5, 10)` | thrown RangeError; 7.5 fails the row | RangeError: quota values must be integers (harness exit 3 = caught throw) | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q4-fractional-used-control.txt |
| 5 | Riskiest edge: boundary used == limit | `remaining(10, 10)` | 0 | 0, exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q5-boundary-used-equals-limit.txt |
| 6 | Edge: fractional limit (second operand of the integer check) | `remaining(3, 10.5)` | thrown RangeError | RangeError: quota values must be integers | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q6-fractional-limit.txt |
| 7 | Edge: malformed input NaN | `remaining(NaN, 10)` | thrown RangeError, never NaN | RangeError: quota values must be integers | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q7-nonfinite-nan.txt |
| 8 | Edge: non-finite limit Infinity | `remaining(3, Infinity)` | thrown RangeError, never Infinity | RangeError: quota values must be integers | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q8-nonfinite-infinity.txt |
| 9 | Regression: adjacent export checkQuota unchanged | `[checkQuota(3,10), checkQuota(10,10), checkQuota(12,10)]` | [true,false,false] | [true,false,false], exit 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q9-checkquota-adjacent.txt |
| 10 | Regression: existing test suite | `bun test` | 2 pass, 0 fail | 2 pass, 0 fail, exit 0 (suite has no test for remaining()) | PASS | .omp/team-config/evidence/gate/quota-remaining/wave-1/q10-existing-suite.txt |
