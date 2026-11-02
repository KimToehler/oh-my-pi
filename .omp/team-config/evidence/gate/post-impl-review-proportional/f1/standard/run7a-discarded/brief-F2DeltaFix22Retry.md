Complete assignment thoroughly:

Review this fix delta. Workspace root: /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r7/.worktrees/review-fee-report. Plan: /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r7/.worktrees/review-fee-report/openspec/changes/fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**: none (nothing is accepted: the fee and rendering contract in the spec is the whole behaviour)
- **Out of scope for blocking**: none (the spec names every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 2.2 F2 fix (wave 1, QA3 and QA6): group every three integer digits of an amount with a comma, not only the last three, so 123456789 cents renders as `1,234,567.89` in the line and the total; add the render test for the "Large fee grouped" scenario. Verify: `bun test src/render.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
none: every row re-run
Commit range efccebc15cbd61b8660585fc320ce33eda80b4cd..7e122430af7fd360e66c47d1aad818bf34579531, commits 7e122430af7fd360e66c47d1aad818bf34579531.
The diff is one patch file per commit, in commit order, each with its commit header. Read /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r7/.worktrees/review-fee-report/.omp/team-config/gate-deltas/F2-2.2-7e122430af7f-20261102222541/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
