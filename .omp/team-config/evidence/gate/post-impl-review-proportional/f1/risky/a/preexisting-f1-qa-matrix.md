# QA matrix (F1, quota-remaining)

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| 1 | Usage within the limit | `bun -e 'import {remaining} from "./src/quota"; console.log(remaining(3,10))'` | 7 | 7 | PASS | .omp/team-config/evidence/gate/quota-remaining/f1/s1-within-limit.txt |
| 2 | Negative control: usage above the limit | `bun -e '... remaining(12,10)'` | 0, never -2 | 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/f1/s2-above-limit-control.txt |
| 3 | Integer values are accepted | `bun -e '... remaining(0,5)'` | 5 | 5 | PASS | .omp/team-config/evidence/gate/quota-remaining/f1/s3-integers-accepted.txt |
