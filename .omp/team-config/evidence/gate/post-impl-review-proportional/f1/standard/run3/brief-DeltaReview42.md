Complete assignment thoroughly:

Review this fix delta. Workspace root: /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r3-review. Plan: openspec/changes/late-fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**: none (nothing is accepted: the fee and ordering contract in the specs is the whole behaviour)
- **Out of scope for blocking**: none (the specs name every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.2 F2 wave 1 QA4: the `report` command's default as-of date is the UTC calendar date in `src/today.ts` (`toISOString().slice(0, 10)` instead of the runner's local date from `toLocaleDateString`), so a run without `--as-of` in a zone whose date differs from UTC (Europe/Berlin at 2026-03-01T23:30:00Z) evaluates as of 2026-03-01; the zone-dependent local-noon test in `src/today.test.ts` is replaced by a regression test that evaluates 2026-03-01T23:30:00Z with `process.env.TZ` set to Europe/Berlin and Pacific/Kiritimati. Verify: `bun test src/today.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
none: every row re-run
Commit range a0ccec20abe7bee717bd656a008665926b8149d0..145e0c2d914492ca69891951f776e2e472fcf8e9, commits 145e0c2d914492ca69891951f776e2e472fcf8e9.
The diff is one patch file per commit, in commit order, each with its commit header. Read /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r3-review/.omp/team-config/gate-deltas/F2-4.2-145e0c2d9144-20261102210929/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
