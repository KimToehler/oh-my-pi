Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r511-a. Plan: openspec/changes/csv-total.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan (gate.md carries no `Feature-specific criteria` field; for this OpenSpec folder the review criteria are the `### Requirement:` blocks of `openspec/changes/csv-total/specs/csv-total/spec.md`, verbatim:)

### Requirement: Price lines are parsed strictly
The command SHALL read one `name,price` line per row, ignore blank lines, and refuse a file holding a line whose price is not a number, naming each such line.

#### Scenario: Valid lines are summed
- **WHEN** the file holds `widget,19.99` and `gadget,5.01`
- **THEN** the command prints `25.00` and exits 0

#### Scenario: Malformed price is rejected with its line number
- **WHEN** the file holds `widget,abc` on line 1
- **THEN** the command prints a message naming line 1 on stderr, prints no total and exits 2

#### Scenario: Negative control
- **WHEN** the file holds a line with a malformed price
- **THEN** a total printed for it MUST fail the requirement: the line is never counted as zero or skipped

### Requirement: Totals are exact in cents
The command SHALL sum whole cents and print the total with exactly two decimals, so decimal fractions never drift.

#### Scenario: Cents add exactly
- **WHEN** the file holds `a,0.10` and `b,0.20`
- **THEN** the command prints `0.30`

#### Scenario: Empty file
- **WHEN** the file is empty
- **THEN** the command prints `0.00` and exits 0

#### Scenario: Negative control
- **WHEN** the file holds ten lines of `x,0.10`
- **THEN** printing `0.9999999999999999` or `1` MUST fail; the command prints `1.00`

- **Accepted residual risks**:
  - Sub-cent rounding: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected, so the printed total can differ from the supplier's invoice by one cent. Accepted because supplier feeds carry two decimals.
- **Out of scope for blocking**: none (the change adds one standalone CLI and touches no shared surface)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.1 Fix F2 wave 1 blocker QA4: `groupThousands` in `src/format.ts` inserted only the separator before the last three integer digits, so a total of 1,000,000.00 or more printed as `1234,567.89`; insert a separator before every group of three integer digits (`1,234,567.89`), keep totals below 1,000.00 unchanged, and add a unit test for totals from 999,999.99 to 12,345,678.90. QA4 is re-run in the closing F2 wave. Verify: `bun test`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
- QA1 (requirement "Price lines are parsed strictly"): scenario 1 (F1 s1, valid lines summed) is not carried: it is re-run on ddc134e after the round-1 delta review rejected its carry, capture in `.omp/team-config/evidence/gate/csv-total/wave-2/qa3-happy-path.md`. The row's other captures are carried from `.omp/team-config/evidence/gate/csv-total/wave-1/qa1-parse-strict.md` and `f1/s2-malformed.md` - they print no total at all (exit 2) or `25.00`, and the range does not touch `src/price.ts`, `src/cents.ts`, `src/money.ts` or `src/cli.ts`.
- QA2 (requirement "Totals are exact in cents"; artifact `.omp/team-config/evidence/gate/csv-total/wave-1/qa2-exact-cents.md`): carried - its totals `0.30`, `0.00` and `1.00` are below 1,000.00, so they never reach the changed `groupThousands`; parsing and summing are untouched.
- QA3 (happy path): not carried - re-run on ddc134e after the round-1 delta review rejected the carry of its F1 s1 capture; new artifact `.omp/team-config/evidence/gate/csv-total/wave-2/qa3-happy-path.md` (s1 input prints `25.00`, exit 0; CRLF input prints `25.00`, exit 0).
- QA4 (riskiest edge, totals across the thousands boundary; failed in wave 1): not carried, re-run in the closing wave - the range changes exactly the code it observed.
- QA5 (regression on adjacent behaviour; artifact `.omp/team-config/evidence/gate/csv-total/wave-1/qa5-regression-adjacent.md`): not carried, re-run in the closing wave - the range changes `src/format.ts`, which its main-vs-head comparison imports, and adds a test, which changes its `bun test` capture.
Commit range ecd418fce4a870f089788aa2102397d42c8ea37c..ddc134eacefc3ada4e7cb21962f3846be52ae3c9, commits ddc134eacefc3ada4e7cb21962f3846be52ae3c9.
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r511-a/.omp/team-config/gate-deltas/F2-4.1-ddc134eacefc-20261103125052/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
