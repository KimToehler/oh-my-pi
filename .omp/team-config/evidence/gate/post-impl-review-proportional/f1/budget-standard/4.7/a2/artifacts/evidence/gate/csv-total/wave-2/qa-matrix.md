# F2 wave 2 QA matrix: csv-total

Reviewed head: ae2afb0be177dd975d32b77c575f296806c33cc9 (snapshot F2 wave 2). Depth: standard. QA lane: orchestrator.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Happy path (requirement 1, valid lines summed) | `bun src/cli.ts total FILE` with `widget,19.99` / `gadget,5.01` | stdout `25.00`, exit 0 | stdout `25.00`, stderr empty, exit 0 | PASS (re-run on ae2afb0; delta review rejected its carry) | `.omp/team-config/evidence/gate/csv-total/wave-2/q1-happy.md` |
| QA2 | Malformed price rejected with its line (requirement 1) | same, `widget,abc` | stderr names line 1, no total, exit 2 | stdout empty, stderr `error: line 1: malformed price`, exit 2 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` |
| QA3 | Cents exact, negative control (requirement 2) | same, ten lines `x,0.10` | stdout `1.00` | stdout `1.00`, exit 0 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md` |
| QA4 | Empty file (edge) | same, empty file | stdout `0.00`, exit 0 | stdout `0.00`, exit 0 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md` |
| QA5 | Grouped total above 1000 (adjacent `src/format.ts` change) | same, `big,1234.50` | digits `1234.50`, ungrouped or correctly grouped | stdout `1,234.50`, exit 0 | PASS (re-run on ae2afb0) | `.omp/team-config/evidence/gate/csv-total/wave-2/q5-large.md` |
| QA6 | Mixed valid and malformed lines (requirement 1 negative control) | same, `widget,19.99` / `gadget,abc` / `bolt,5.01` / `nut,` | stderr names lines 2 and 4, no total, exit 2 | stdout empty, stderr `error: lines 2, 4: malformed price`, exit 2 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/wave-1/q6-mixed-malformed.md` |
| QA7 | CRLF line endings | same, `widget,19.99\r\n` / `gadget,5.01\r\n` | stdout `25.00`, exit 0 | stdout `25.00`, exit 0 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/wave-1/q7-crlf.md` |
| QA8 | Spec scenario: cents add exactly (requirement 2) | same, `a,0.10` / `b,0.20` | stdout `0.30`, exit 0 | stdout `0.30`, exit 0 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/wave-1/q8-spec-cents.md` |
| QA9 | Total of one million or more (boundary of `groupThousands`; failed in wave 1) | same, `big,1234567.00` | exit 0, `1234567.00` or `1,234,567.00` | stdout `1,234,567.00`, exit 0 | PASS (re-run on ae2afb0) | `.omp/team-config/evidence/gate/csv-total/wave-2/q9-million.md` |
| QA10 | Summed total crossing one million | same, `a,999999.99` / `b,0.01` | exit 0, `1,000,000.00` or `1000000.00` | stdout `1,000,000.00`, exit 0 | PASS | `.omp/team-config/evidence/gate/csv-total/wave-2/q9b-million-sum.md` |

Carries across ecd418f..ae2afb0 (fix 1.3, delta-reviewed OKAY in round 2): QA2 and QA6 end in the parser error path before any formatting; QA3, QA4, QA7 and QA8 print totals whose whole part is below 1000, so `formatCents` never calls the changed `groupThousands`. Parser, cents, CLI and summing code are unchanged in the range. QA1 was re-run because the round-1 delta review rejected its carry.

`bun test` on ae2afb0: 5 pass, 0 fail (includes the new million-grouping test, which failed on ecd418f with `1000,000.00`).
