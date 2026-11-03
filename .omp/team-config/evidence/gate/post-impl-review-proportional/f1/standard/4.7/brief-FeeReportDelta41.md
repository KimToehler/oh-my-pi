Complete assignment thoroughly:

Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-r47. Plan: openspec/changes/fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**: none (nothing is accepted: the fee and rendering contract in the spec is the whole behaviour)
- **Out of scope for blocking**: none (the spec names every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.1 Fix `formatAmount` in `src/render.ts` to put a comma after every group of three integer digits counted from the right, not only the last group (F2 wave 1 QA4: 123456789 cents rendered `1234,567.89`; QA6: 100000000 cents rendered `1000,000.00`), with a render test for the Large fee grouped scenario and a multi-group amount. Verify: `bun test src/render.test.ts && bun src/cli.ts samples/report.json`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
- Q1 (lateFee via public API, 16 amount/day cases): carried; the range touches only src/render.ts, src/render.test.ts and tasks.md, and src/fee.ts and every path Q1 observed are unchanged.
- Q5 (empty report renders exactly `No late fees` via the render command): carried; renderReport and src/cli.ts are unchanged and the empty branch returns before formatAmount, the only changed function.
Commit range 82e54ad9e132e45c633ce56f71e50d19841fb10a..2222ab914bd1e20117bd2ad7881c6cdcb37bc222, commits 2222ab914bd1e20117bd2ad7881c6cdcb37bc222.
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-r47/.omp/team-config/gate-deltas/F2-4.1-2222ab914bd1-20261102233133/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
