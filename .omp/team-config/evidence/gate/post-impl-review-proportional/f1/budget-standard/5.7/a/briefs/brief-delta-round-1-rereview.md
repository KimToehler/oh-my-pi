Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r57-a. Plan: openspec/changes/csv-total.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan (gate.md has no such field; this OpenSpec change's review criteria are the `### Requirement:` blocks of specs/csv-total/spec.md, verbatim:)

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
- [x] 4.1 Group every run of three digits in `groupThousands` (`src/format.ts`), so a total of `1234567.00` prints `1,234,567.00` instead of `1234,567.00` (F2 wave 1 blocker B1, class misgrouped-large-total). Verify: `bun test`
- [x] 4.2 Add `formatCents` tests in `test/csvtotal.test.ts` for 1,000.00, 999,999.99, 1,000,000.00 and 1,234,567.00, each seen failing when the grouping logic is broken (F2 wave 1 blocker B2, class large-total-branch-untested). Verify: `bun test`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
- Q1 (requirement "Price lines are parsed strictly", .omp/team-config/evidence/gate/csv-total/wave-1/q1-req-parse-strict.md): carried; every observed total (25.00, 3.00) is below 1,000 and every other probe exits 2 before formatting, so `formatCents` never reaches `groupThousands`, the only changed production code.
- Q2 (requirement "Totals are exact in cents", .omp/team-config/evidence/gate/csv-total/wave-1/q2-req-exact-cents.md): carried; observed totals 0.30, 1.00 and 0.00 are below 1,000 and parsing/summing code is unchanged.
- Q5 (adjacent regression: usage errors, missing file, 12.35, .omp/team-config/evidence/gate/csv-total/wave-1/q5-regression-cli.md): carried; src/cli.ts is unchanged, the error paths exit before formatting, and 12.35 is below 1,000.
- Not carried: Q3 (happy path, F1 s1) was re-run on b64d9652e387f2768741b29deb16c5e84e924c10 after the first delta review of this range rejected its carry: .omp/team-config/evidence/gate/csv-total/wave-2/q3-happy.md, stdout `25.00`, empty stderr, exit 0. Q4 (riskiest edge; observes 1,000.00, 1,234.50 and 1234,567.89 through the changed `groupThousands`) and Q6 (`bun test`; test/csvtotal.test.ts changed and tasks.md gained rows 4.1 and 4.2 with Verify `bun test`) are re-run in wave 2.
Commit range ecd418fce4a870f089788aa2102397d42c8ea37c..b64d9652e387f2768741b29deb16c5e84e924c10, commits bdadbc94124f7d914412ef9423fe2a2c4280a77a (plan rows 4.1, 4.2 under ## TODOs), b64d9652e387f2768741b29deb16c5e84e924c10 (fix and tests, rows checked).
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r57-a/.omp/team-config/gate-deltas/F2-4.1-b64d9652e387-20261103093258/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.