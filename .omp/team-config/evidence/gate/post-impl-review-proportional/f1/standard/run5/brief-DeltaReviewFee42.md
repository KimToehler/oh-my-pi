Complete assignment thoroughly:

Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r5/.worktrees/review-late-fee-report. Plan: openspec/changes/late-fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**: none (nothing is accepted: the fee and ordering contract in the specs is the whole behaviour)
- **Out of scope for blocking**: none (the specs name every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.2 F2 wave 1 QA6: compute the fee in `src/fee.ts` from the full cents-percent product (`Math.floor(amountCents * percent / 100)`, exact below 2^53) instead of the int32-truncated `(amountCents * percent) | 0`, so an invoice of 85,899,346 cents or more at the cap gets its fee instead of a negative one that drops it from the report and the total; regression test in `src/fee.test.ts` for 85,899,346 and 100,000,000 cents at the cap. Verify: `bun test src/fee.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
none: every row re-run
Commit range 663cc2e1499ca771ea193288df30602ba31ab466..3eb170111b53cd7933a5cd8346b72fe32e866c7c, commits 3eb170111b53cd7933a5cd8346b72fe32e866c7c.
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r5/.worktrees/review-late-fee-report/.omp/team-config/gate-deltas/F2-4.2-3eb170111b53-20261102213443/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
