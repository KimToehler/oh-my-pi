# F2 wave 1 QA1: Requirement "Price lines are parsed strictly"

One row for the requirement; its three scenarios, all captured in F1 and tracked in the reviewed tree:

| Scenario | Capture | Head | Result |
|---|---|---|---|
| Valid lines are summed (`widget,19.99`, `gadget,5.01` print `25.00`, exit 0) | `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` | `d0c56d3` | MATCH; decimal-dropping mutant prints `24.00`, NO MATCH |
| Malformed price is rejected with its line number (`widget,abc`: stderr names line 1, no total, exit 2) | `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` | `d0c56d3` | MATCH (`error: line 1: malformed price`, exit 2, empty stdout) |
| Negative control (a malformed line is never counted as zero or skipped) | `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md`, section "Negative control" | `d0c56d3` | mutant counting it as zero prints `0.00`, exit 0: NO MATCH |

Carry reason: the only change since d0c56d3 is the merge of `main` (d5da87c), which edits `groupThousands` in `src/format.ts`; parsing (`src/price.ts`, `src/cents.ts`, `src/money.ts`) is untouched, the s1 total 25 never reaches `groupThousands` (whole part < 1000), and s2 throws before any formatting, so neither observed output can change. Not re-executed.
