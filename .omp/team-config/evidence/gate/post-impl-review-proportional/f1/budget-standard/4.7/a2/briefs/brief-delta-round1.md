Review this fix delta. Workspace root: /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r47-a2. Plan: openspec/changes/csv-total (OpenSpec change folder; gate.md is its ## Merge gate).
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**:
  - Sub-cent rounding: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected, so the printed total can differ from the supplier's invoice by one cent. Accepted because supplier feeds carry two decimals.
- **Out of scope for blocking**: none (the change adds one standalone CLI and touches no shared surface)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 1.3 F2 wave 1 fix (QA9): `groupThousands` in `src/format.ts` places a separator before every group of three digits, so a total of 1,000,000.00 or more prints `1,234,567.00` instead of `1234,567.00`. Verify: `bun test`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
- QA1 (happy path, `widget,19.99` + `gadget,5.01` prints `25.00`, artifact .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md): total 25.00 has whole part < 1000, so formatCents never calls the changed groupThousands; the range changes nothing else in src/.
- QA2 (`widget,abc` exits 2 naming line 1, no total, artifact .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md): parsePrices throws before formatCents runs; the range touches no parser, cents or CLI code.
- QA3 (ten lines of `x,0.10` print `1.00`, artifact .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md): whole part 1 < 1000, groupThousands not reached; parsing and summing unchanged.
- QA4 (empty file prints `0.00`, artifact .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md): whole part 0 < 1000, groupThousands not reached.
- QA6 (mixed valid/malformed lines, stderr `error: lines 2, 4: malformed price`, no total, exit 2, artifact .omp/team-config/evidence/gate/csv-total/wave-1/q6-mixed-malformed.md): error path in parsePrices, before any formatting; unchanged.
- QA7 (CRLF input prints `25.00`, artifact .omp/team-config/evidence/gate/csv-total/wave-1/q7-crlf.md): whole part < 1000, groupThousands not reached; line splitting and trimming unchanged.
- QA8 (`a,0.10` + `b,0.20` prints `0.30`, artifact .omp/team-config/evidence/gate/csv-total/wave-1/q8-spec-cents.md): whole part 0 < 1000, groupThousands not reached.
Re-run before the next wave because the range changes the behaviour they observed: QA5 (`big,1234.50`, grouped output) and QA9 (`big,1234567.00`, the failing row this delta fixes); both reach groupThousands.
Commit range ecd418fce4a870f089788aa2102397d42c8ea37c..ae2afb0be177dd975d32b77c575f296806c33cc9, commits ae2afb0be177dd975d32b77c575f296806c33cc9.
The diff is one patch file per commit, in commit order, each with its commit header. Read /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r47-a2/.omp/team-config/gate-deltas/F2-1.3-ae2afb0be177-20261102234125/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
