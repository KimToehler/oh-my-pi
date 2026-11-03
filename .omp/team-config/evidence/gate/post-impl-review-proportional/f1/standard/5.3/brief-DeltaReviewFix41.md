Complete assignment thoroughly:

Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-r53. Plan: openspec/changes/fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**: none (nothing is accepted: the fee and rendering contract in the spec is the whole behaviour)
- **Out of scope for blocking**: none (the spec names every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.1 F2 wave 1 fix (QA6, QA8): `formatAmount` puts a comma after only the lowest group of three integer digits, so 123456789 cents renders `1234,567.89` instead of `1,234,567.89`; group every three digits from the right and cover the spec's "Large fee grouped" scenario with a test. Verify: `bun test src/render.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
- QA1 lateFee(10000, 30) = 200 (artifact .omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-latefee.txt): the range does not touch src/fee.ts and render.ts never calls lateFee.
- QA2 lateFee(10000, 400) = 2500 (same artifact): same reason as QA1.
- QA3 negative control lateFee(10000, 29) = 0 (same artifact): same reason as QA1.
- QA4 lateFee period boundaries, zero inputs and round-down (59/60/360/390 days, 0 days, 0 amount, 12345/99/49 cents; same artifact): same reason as QA1.
- QA7 empty report renders exactly "No late fees" plus one newline via the CLI (artifact .omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-render-empty.txt): renderReport returns at its unchanged `report.lines.length === 0` branch before formatAmount, and cli.ts is unchanged.
- QA11 `bun src/cli.ts` without an argument prints the usage line on stderr and exits 2 (artifact .omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-usage.txt): cli.ts is unchanged and exits before any render call.
- QA5, QA6, QA8, QA9, QA10, QA12 (two-line report, large fee grouped, edge amounts 5 cents / 1,000,000.00 / 1,000.05, given order kept, samples/report.json, full bun test suite) were re-run on 1e202e028453b80e20c18c83fddc46259106a562 (artifacts under .omp/team-config/evidence/gate/fee-report/f1/wave-2/) and are carried across 4aedb1199ae224282974a4b954f21f1bc3877848: that commit changes only checkboxes in openspec/changes/fee-report/tasks.md.
Commit range 82e54ad9e132e45c633ce56f71e50d19841fb10a..4aedb1199ae224282974a4b954f21f1bc3877848, commits 9734ef65c8f2608fd535123f6ec281dd4bcd4e36 1e202e028453b80e20c18c83fddc46259106a562 4aedb1199ae224282974a4b954f21f1bc3877848.
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-r53/.omp/team-config/gate-deltas/F2-4.1-4aedb1199ae2-20261103075357/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
