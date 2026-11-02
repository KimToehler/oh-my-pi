# F2 wave 1 QA matrix (F1), snapshot 23695863d943

Captured on a8cbb6c (head after the last code commit) in the review worktree, process TZ Europe/Berlin (CET), under a pty (`script -q`).
Carry to snapshot 2369586: that commit only ticks the `3.1` checkbox in tasks.md and changes no code path any row observes.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Happy path: sample report | `bun src/cli.ts samples/invoices.json --as-of 2026-02-20` | INV-3 20.00, INV-1 2.00, INV-2 2.00, TOTAL 24.00; INV-4 (10 days) absent | exactly that, exit 0 | PASS | wave-1/qa1-sample-report.txt |
| QA2 | Requirement "Late fee per invoice": one period, 29-day negative control, 30-day boundary, 12 periods 24%, cap 25%, round down, not yet due | `bun src/cli.ts wave-1/fee-cases.json --as-of 2026-02-15` | 25.00, 24.00, 2.46, 2.00, 2.00, TOTAL 55.46; P29 and NOT-YET-due absent | exactly that, exit 0 | PASS | wave-1/qa2-fee-rule.txt |
| QA3 | Riskiest edge: 30 UTC calendar days across the spring DST change (spec: "Days overdue are counted in UTC calendar days") | `bun src/cli.ts wave-1/dst-cases.json --as-of 2026-03-31` under default TZ, `TZ=America/New_York`, `TZ=UTC`; autumn file `--as-of 2026-10-31` | DST-spring-30d (due 2026-03-01) listed at 2.00 in every TZ; DST-spring-29d absent; autumn 30d listed | default TZ (CET) and New York: `TOTAL 0.00`, DST-spring-30d missing; only TZ=UTC lists it at 2.00; autumn correct | FAIL | wave-1/qa3-utc-days-dst.txt |
| QA4 | Requirement "Overdue report ordering": fee desc, due date asc, id code-unit asc, input-order independence, zero-fee negative control, total | `bun src/cli.ts wave-1/order-a.json` and reversed `order-b.json`, `--as-of 2026-02-20`, plus `diff` | BIG 10.00, z, B, a, b (2.00 each), TOTAL 18.00; zero-fee absent; identical for both orders | exactly that, `IDENTICAL for both input orders` | PASS | wave-1/qa4-report-ordering.txt |
| QA5 | Regression on adjacent behaviour: usage error path and existing suite | `bun src/cli.ts samples/invoices.json`, `bun src/cli.ts`, `bun test` | usage line, exit 2 twice; 6 pass 0 fail | exactly that | PASS | wave-1/qa5-regression-cli-and-suite.txt |

Root cause of QA3: `src/invoice.ts:11` builds `new Date(y, m - 1, d)` in local time, so a span containing the spring-forward hour is 23 h short and `Math.floor(... / DAY_MS)` in `src/invoice.ts:15` yields 29 days for 30 calendar days.

Result: REVIEW FAILED on QA3; no reviewer dispatched for this wave.
