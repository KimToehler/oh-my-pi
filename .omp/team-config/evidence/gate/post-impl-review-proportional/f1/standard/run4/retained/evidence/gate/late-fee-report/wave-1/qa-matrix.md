# F2 wave 1 QA matrix (head fcb3ef6d772fecd300435f8d3967f244799380b9, depth standard)

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Happy path: sample file | `bun src/cli.ts samples/invoices.json --as-of 2026-02-20` | INV-3 20.00, INV-1 2.00, INV-2 2.00, no INV-4, TOTAL 24.00 | as expected | PASS | wave-1/qa1.txt |
| QA2 | Requirement "Late fee per invoice": one period, cap, 29/30/59/60-day boundaries, floor | `bun src/cli.ts wave-1/fixtures/qa2-fee.json --as-of 2026-02-15` | ONE-PERIOD 2.00, OVER-A-YEAR 25.00, DAY-29 absent, DAY-30 2.00, DAY-59 2.00, DAY-60 4.00, FLOOR-CENTS 2.46 (floor of 12345 * 2% = 246.9) | as expected | PASS | wave-1/qa2.txt |
| QA3 | Riskiest edge: capped fee in whole cents rounded down, amounts not divisible by 4 | `bun src/cli.ts wave-1/fixtures/qa3-cap-rounding.json --as-of 2026-02-15` | CAP-10000 25.00, CAP-10001 25.00, CAP-10002 25.00, CAP-10003 25.00, CAP-1 and CAP-3 absent (fee 0), TOTAL 100.00 | CAP-10002 25.01, CAP-10003 25.01, CAP-3 listed at 0.01, TOTAL 100.03: `src/fee.ts:11` rounds the capped fee with `Math.round` | FAIL | wave-1/qa3.txt |
| QA4 | UTC calendar days across DST in runner zone | `TZ=Europe/Berlin` / `TZ=America/New_York` `bun src/cli.ts wave-1/fixtures/qa4-dst.json --as-of 2026-03-31`, and Berlin `--as-of 2026-03-30` | 30 days -> 2.00 in both zones; 29 days -> not listed | as expected | PASS | wave-1/qa4.txt |
| QA5 | Requirement "Overdue report" ordering, input-order independence | `bun src/cli.ts wave-1/fixtures/qa5-order-{a,b}.json --as-of 2026-02-20` | big, z, B, a, b in both input orders (code-unit id order) | as expected, identical output | PASS | wave-1/qa5.txt |
| QA6 | Negative control: 0-cent fee not listed; total of listed lines; empty input | `bun src/cli.ts wave-1/fixtures/qa6-zero-fee.json --as-of 2026-02-20`, `.../qa6-empty.json` | only LISTED 2.00, TOTAL 2.00; empty -> TOTAL 0.00 | as expected | PASS | wave-1/qa6.txt |
| QA7 | Default as-of is today's UTC date | no `--as-of`, `TZ=Pacific/Kiritimati` (local date 2026-11-03) and `TZ=Pacific/Pago_Pago`, fixture due UTC-today minus 30 / minus 29 days | only the minus-30 invoice listed in both zones | as expected (UTC 2026-11-02T21:21:03Z) | PASS | wave-1/qa7.txt |
| QA8 | Regression: usage errors and project test suite | `bun src/cli.ts`, `--asof`, `--as-of` without date; `bun test` | exit 2 with usage line; 8 pass | as expected | PASS | wave-1/qa8.txt |

Result: FAIL (QA3). REVIEW FAILED: gate reviewers not dispatched for wave 1.
