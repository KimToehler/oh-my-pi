Complete assignment thoroughly:

Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard/.worktrees/review-late-fee-report. Plan: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard/.worktrees/review-late-fee-report/openspec/changes/late-fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**: none (nothing is accepted: the fee and ordering contract in the specs is the whole behaviour)
- **Out of scope for blocking**: none (the specs name every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 2.2 F2 fix (wave 1, QA7 and QA10): order report lines of equal late fee by due date ascending, then by id, so the report order never depends on the input order; regression test for both input orders. Verify: `bun test src/report.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
none: every row re-run
Commit range 6bb9989f41a6fc6178d28ded9e481381a76d0b3d..951b31abca24010414cc0f6975f74b5e1700bbb0, commits 951b31abca24010414cc0f6975f74b5e1700bbb0.
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard/.worktrees/review-late-fee-report/.omp/team-config/gate-deltas/F2-2.2-951b31abca24-20261102202300/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
