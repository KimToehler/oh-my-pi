# F2 wave 1 QA matrix: csv-total

Reviewed head: ecd418fce4a870f089788aa2102397d42c8ea37c (snapshot F2 wave 1). Depth: standard. QA lane: orchestrator.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Happy path (requirement 1, valid lines summed) | `bun src/cli.ts total FILE` with `widget,19.99` / `gadget,5.01` | stdout `25.00`, exit 0 | stdout `25.00`, stderr empty, exit 0 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` |
| QA2 | Malformed price rejected with its line (requirement 1) | same, `widget,abc` | stderr names line 1, no total, exit 2 | stdout empty, stderr `error: line 1: malformed price`, exit 2 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` |
| QA3 | Cents exact, negative control (requirement 2) | same, ten lines `x,0.10` | stdout `1.00` | stdout `1.00`, exit 0 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md` |
| QA4 | Empty file (edge) | same, empty file | stdout `0.00`, exit 0 | stdout `0.00`, exit 0 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md` |
| QA5 | Grouped total above 1000 (adjacent `src/format.ts` change) | same, `big,1234.50` | digits `1234.50`, grouping separators allowed | stdout `1,234.50`, exit 0 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/f1/s5-large.md` |
| QA6 | Mixed valid and malformed lines (requirement 1 negative control: never counted as zero or skipped) | same, `widget,19.99` / `gadget,abc` / `bolt,5.01` / `nut,` | stderr names lines 2 and 4, no total, exit 2 | stdout empty, stderr `error: lines 2, 4: malformed price`, exit 2 | PASS | `.omp/team-config/evidence/gate/csv-total/wave-1/q6-mixed-malformed.md` |
| QA7 | CRLF line endings (riskiest realistic input edge) | same, `widget,19.99\r\n` / `gadget,5.01\r\n` | stdout `25.00`, exit 0 | stdout `25.00`, exit 0 | PASS | `.omp/team-config/evidence/gate/csv-total/wave-1/q7-crlf.md` |
| QA8 | Spec scenario: cents add exactly (requirement 2) | same, `a,0.10` / `b,0.20` | stdout `0.30`, exit 0 | stdout `0.30`, exit 0 | PASS | `.omp/team-config/evidence/gate/csv-total/wave-1/q8-spec-cents.md` |
| QA9 | Total of one million or more (boundary of the changed `groupThousands`) | same, `big,1234567.00` | exit 0, digits `1234567.00` with two decimals, ungrouped `1234567.00` or correctly grouped `1,234,567.00` | stdout `1234,567.00`, exit 0: one separator at the wrong place | FAIL | `.omp/team-config/evidence/gate/csv-total/wave-1/q9-million.md` |

Carries: QA1-QA5 were captured by F1 (tasks.md 3.1) at 4e5e75b, the last code commit. The only later commit, ecd418f, adds the five F1 evidence files and flips the tasks.md 3.1 checkbox; neither reaches `src/` or the CLI runtime, so no carried observation can change. Each carried observation was judged against its expected outcome and the code at ecd418f.

QA9 failure detail: `groupThousands` (`src/format.ts:12`) replaces only the separator before the last three digits (`/(\d)(?=(\d{3})$)/`, no `g` flag, anchored to the end), so every total of 1,000,000.00 or more prints a malformed figure. Summed totals reach it too: `a,999999.99` + `b,0.01` prints `1000,000.00`; `a,10000000.00` prints `10000,000.00` (observed by the same command, not separately captured).
