Complete assignment thoroughly:

Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r2/.worktrees/review-late-fee-report. Plan: openspec/changes/late-fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**: none (nothing is accepted: the fee and ordering contract in the specs is the whole behaviour)
- **Out of scope for blocking**: none (the specs name every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.1 F2 wave 1 QA3: count days overdue in UTC calendar days in `src/invoice.ts` (`Date.UTC` instead of local-time `new Date(y, m - 1, d)`), so an interval across a DST change in the runner's zone is not floored to one day less; regression test in `src/fee.test.ts` evaluates 2026-03-01 to 2026-03-31 with `process.env.TZ` set to a DST zone. Verify: `bun test src/fee.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
- QA1 happy path (f1/qa1-happy-path.txt), QA2 fee rules (f1/qa2-fee-rules.txt), QA3 UTC calendar days across DST (f1/qa3-utc-calendar-days.txt), QA4 report ordering (f1/qa4-report-ordering.txt), QA5 CLI usage and unit suite (f1/qa5-cli-regression.txt), all below .omp/team-config/evidence/gate/late-fee-report/: captured on 5cf07eb485968a2be4ccd1374f24a5e9e3a68b4f and carried across e5a6dbdc43c4a1286e062c9dccfea6ae11d6c69c, which only ticks the 3.1 checkbox in tasks.md and changes no code or input the report reads.
Commit range 6d8a0daf7759dba479bbbd2f14a5ddbee41f0288..e5a6dbdc43c4a1286e062c9dccfea6ae11d6c69c, commits eeb867d9d5787d20493670070290d8e384fce7f3, 5cf07eb485968a2be4ccd1374f24a5e9e3a68b4f, e5a6dbdc43c4a1286e062c9dccfea6ae11d6c69c.
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r2/.worktrees/review-late-fee-report/.omp/team-config/gate-deltas/F2-4.1-e5a6dbdc43c4-20261102203820/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
