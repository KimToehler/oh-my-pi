Review this fix delta. Workspace root: /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r518-e/.worktrees/review-csv-total. Plan: openspec/changes/csv-total.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**:
  - Sub-cent rounding: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected, so the printed total can differ from the supplier's invoice by one cent. Accepted because supplier feeds carry two decimals.
- **Out of scope for blocking**: none (the change adds one standalone CLI and touches no shared surface)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.1 F2 wave 1 blocker B1 (wrong-read-error-message, `src/cli.ts:15`): when the input file exists but cannot be read for lack of permission (`EACCES`), print `error: cannot read FILE: permission denied` instead of `no such file`, and exit 2. Verify: `bun test`
- [x] 4.2 F2 wave 1 blocker B2 (wrong-read-exit-status, `src/cli.ts:16`): when the input path is a directory (`EISDIR`), print `error: cannot read FILE: is a directory` and exit 2, the status of every other refusal, instead of 1. Verify: `bun test`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
- Row 1 (Requirement "Price lines are parsed strictly", .omp/team-config/evidence/gate/csv-total/wave-1/qa-r1-parsed-strictly.md): carried; the range changes src/cli.ts only inside the `catch` of `readFileSync` (reached only when the input cannot be read), plus tasks.md and the test file, and this row reads readable regular files, so it never reaches the changed code.
- Row 2 (Requirement "Totals are exact in cents", .omp/team-config/evidence/gate/csv-total/wave-1/qa-r2-exact-cents.md): carried; same reason, readable files only, the parse/sum/format path is untouched.
- Row 3 (happy path, .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md): carried; same reason, readable file only.
- Row 4 (riskiest edge, CRLF at the 1000.00 boundary, .omp/team-config/evidence/gate/csv-total/wave-1/qa-edge-crlf-1000.md): carried; same reason, readable files only.
- Row 6 (tasks.md 3.1 s5 large total, .omp/team-config/evidence/gate/csv-total/f1/s5-large.md): carried; same reason, readable file only.
Not carried: row 5 (regression: main-vs-branch formatter plus `bun test`) is re-run in wave 2, because the range edits test/csvtotal.test.ts and so changes what `bun test` observed. Wave 2 also adds a new row for fix rows 4.1 and 4.2 (unreadable file and directory through the CLI).
Commit range 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479..3556de877f6f9290a54a0d11dc8b906652981043, commits ae1e4a5bc7b30699cd997b3929ebf81529886ca8, 4d5007473605d441a5d87db360dd906c595b54ff, 3556de877f6f9290a54a0d11dc8b906652981043.
The diff is one patch file per commit, in commit order, each with its commit header. Read /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r518-e/.worktrees/review-csv-total/.omp/team-config/gate-deltas/F2-4.1-3556de877f6f-20261103163333/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
