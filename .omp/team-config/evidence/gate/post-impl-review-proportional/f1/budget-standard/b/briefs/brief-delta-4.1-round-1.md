Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-b-adjacent. Plan: openspec/changes/csv-total.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**:
  - Sub-cent rounding: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected, so the printed total can differ from the supplier's invoice by one cent. Accepted because supplier feeds carry two decimals.
- **Out of scope for blocking**: none (the change adds one standalone CLI and touches no shared surface)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.1 F2 wave 1 QA6: totals of 1,000,000 or more printed one separator before the last three digits only (`1234,567.89`); `groupThousands` in `src/format.ts` now separates every group of three digits (`1,234,567.89`), with a regression test. Verify: `bun test test/csvtotal.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
- QA1 s1 happy path (`widget,19.99` + `gadget,5.01` print `25.00`, exit 0; `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md`): carried, the total's whole part is 25 < 1000, so `formatCents` never calls the changed `groupThousands` and the delta touches no parsing or summing code.
- QA2 s2 malformed price (`widget,abc` exits 2, stderr `error: line 1: malformed price`, no total; `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md`): carried, the run throws in `parsePrices` before any formatting and the delta touches only `src/format.ts`, the test file and tasks.md.
- QA3 s3 exact cents (ten lines of `x,0.10` print `1.00`; `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md`): carried, whole part 1 < 1000 never reaches `groupThousands`.
- QA4 s4 empty file (prints `0.00`, exit 0; `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md`): carried, whole part 0 < 1000 never reaches `groupThousands`.
- Re-run in wave 2, not carried: QA5 s5 large total (`big,1234.50`) and QA6 adjacent regression (totals 999.99, 1000.00, 1234567.89, 12345678.90), because both reach the changed `groupThousands`.
Commit range d32f7b7fc0c6003daa6168f2b65124b1708323d4..20fb5fb8e973d2208fbb572644e2ee1947c347f2, commits 20fb5fb8e973d2208fbb572644e2ee1947c347f2.
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-b-adjacent/.omp/team-config/gate-deltas/F2-4.1-20fb5fb8e973-20261102205824/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
