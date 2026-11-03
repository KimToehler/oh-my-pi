Complete assignment thoroughly:

Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r7b/.worktrees/review-fee-report. Plan: openspec/changes/fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan (this OpenSpec folder's criteria are the ### Requirement: blocks of openspec/changes/fee-report/specs/fee-report/spec.md, verbatim:)
### Requirement: Late fee from amount and days overdue
The late fee of an invoice SHALL be 2% of its amount in cents for each complete 30-day period it is overdue, capped at 25% of the amount, in whole cents rounded down. The amount and the days overdue are non-negative whole numbers.

### Requirement: Fee report rendering
A report with lines SHALL render one text line per report line in the given order (id, TAB, due date, TAB, fee), then a last line of `TOTAL`, two TABs and the total of all fees. Every amount SHALL be shown in whole units with exactly two decimals and a comma after every group of three integer digits counted from the right (5 cents is `0.05`). A report with no lines SHALL render as exactly `No late fees`. The `render` command prints the rendered text and one newline.
- **Accepted residual risks**: none (nothing is accepted: the fee and rendering contract in the spec is the whole behaviour)
- **Out of scope for blocking**: none (the spec names every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 2.2 Fix `formatAmount` to put a comma after every group of three integer digits, not only the last group (F2 wave 1 QA3, QA5: 123456789 cents rendered `1234,567.89`), with a test for the spec scenario Large fee grouped and a million-unit boundary. Verify: `bun test src/render.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
none: every row re-run
Commit range 82e54ad9e132e45c633ce56f71e50d19841fb10a..b38f71699a854ea303f3edc420a3d5465f9e879d, commits b38f71699a854ea303f3edc420a3d5465f9e879d.
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r7b/.worktrees/review-fee-report/.omp/team-config/gate-deltas/F2-2.2-b38f71699a85-20261102223933/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
