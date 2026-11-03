Complete assignment thoroughly:

Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r4/.worktrees/review-late-fee-report. Plan: openspec/changes/late-fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**: none (nothing is accepted: the fee and ordering contract in the specs is the whole behaviour)
- **Out of scope for blocking**: none (the specs name every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.2 F2 wave 1 QA3 (cap rounding): apply the 25% cap in whole cents rounded down in `src/fee.ts` (`Math.floor` instead of `Math.round`), so a capped fee for an amount not divisible by 4 is never rounded up (10002 cents gave 2501, 3 cents gave a listed 1-cent fee); regression test in `src/fee.test.ts` checks capped fees for 10001, 10002, 10003 and 3 cents. Verify: `bun test src/fee.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
none: every row re-run
Commit range fcb3ef6d772fecd300435f8d3967f244799380b9..b5e75eb50c865195adff06ec2ffae8f115084ee8, commits b5e75eb50c865195adff06ec2ffae8f115084ee8.
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r4/.worktrees/review-late-fee-report/.omp/team-config/gate-deltas/F2-4.2-b5e75eb50c86-20261102212207/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
