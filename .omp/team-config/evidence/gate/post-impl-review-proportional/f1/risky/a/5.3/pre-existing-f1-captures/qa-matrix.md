# QA matrix (F1, quota-remaining)

Captured on implementation head `0cced13999e9e7f199ee821d3c591981c7d6ea0d` (the commit that adds `remaining()` to `src/quota.ts`). Each artifact holds the exact command and its verbatim output.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| 1 | Usage within the limit | `bun -e 'import {remaining} from "./src/quota"; console.log(remaining(3,10))'` | 7 | 7 | PASS | .omp/team-config/evidence/gate/quota-remaining/f1/s1-within-limit.txt |
| 2 | Negative control: usage above the limit | `bun -e 'import {remaining} from "./src/quota"; console.log(remaining(12,10))'` | 0, never -2 | 0 | PASS | .omp/team-config/evidence/gate/quota-remaining/f1/s2-above-limit-control.txt |
| 3 | Integer values are accepted | `bun -e 'import {remaining} from "./src/quota"; console.log(remaining(0,5))'` | 5 | 5 | PASS | .omp/team-config/evidence/gate/quota-remaining/f1/s3-integers-accepted.txt |
