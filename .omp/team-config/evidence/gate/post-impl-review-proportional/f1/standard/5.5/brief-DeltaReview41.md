Complete assignment thoroughly:

Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-r55/.worktrees/review-fee-report. Plan: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-r55/.worktrees/review-fee-report/openspec/changes/fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**: none (nothing is accepted: the fee and rendering contract in the spec is the whole behaviour)
- **Out of scope for blocking**: none (the spec names every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.1 F2 wave 1 QA2/QA4 (scenario Large fee grouped): `formatAmount` separates every group of three integer digits from the right, so 123456789 cents is `1,234,567.89` and 100000000 cents is `1,000,000.00`, in each line and the total; regression tests for amounts of 1,000,000.00 and above. Verify: `bun test src/render.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
QA1 (Requirement: Late fee from amount and days overdue; `lateFee` called through the library API with 12 amount/day cases, captured at 82e54ad9e132): carried - the range changes only src/render.ts, src/render.test.ts and tasks.md, and QA1 observes only `lateFee` in src/fee.ts, which imports nothing from render.
QA2, QA3, QA4, QA5: re-run, not carried.
Commit range 82e54ad9e132e45c633ce56f71e50d19841fb10a..b652d6691cf22fa42936e9b47a44893988af94ee, commits b652d6691cf22fa42936e9b47a44893988af94ee.
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-r55/.worktrees/review-fee-report/.omp/team-config/gate-deltas/F2-4.1-b652d6691cf2-20261103085219/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
