Review this fix delta. Workspace root: /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r53-a. Plan: openspec/changes/csv-total.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan
- **Accepted residual risks**:
  - Sub-cent rounding: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected, so the printed total can differ from the supplier's invoice by one cent. Accepted because supplier feeds carry two decimals.
- **Out of scope for blocking**: none (the change adds one standalone CLI and touches no shared surface)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 4.1 F2 wave 1 QA7: `big,1234567.00` printed `1234,567.00`, a thousands separator after four digits, because `groupThousands` in `src/format.ts` inserts one comma before the last three digits only. Restore `src/format.ts` to the default branch's version (`groupThousands` returns `String(whole)`), so a total prints its digits without separators (thousands grouping is locale formatting, a design non-goal, and the proposal adds new files only), and add a formatter test for a four-digit and a seven-digit total. Verify: `bun test`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
QA1 (s1-happy: `widget,19.99` + `gadget,5.01` print `25.00`, exit 0; f1/s1-happy.md) - total 2500 cents has whole part 25 < 1000, so formatCents never calls groupThousands, the only changed function; parser and CLI untouched.
QA2 (s2-malformed: `widget,abc` exits 2, stderr `error: line 1: malformed price`, no total; f1/s2-malformed.md) - parsePrices throws before formatCents is reached; src/price.ts, src/cents.ts and src/cli.ts untouched.
QA3 (s3-cents: ten lines of `x,0.10` print `1.00`; f1/s3-cents.md) - whole part 1 < 1000, groupThousands not reached; summation untouched.
QA4 (s4-empty: empty file prints `0.00`; f1/s4-empty.md) - whole part 0 < 1000, groupThousands not reached.
QA8 (`a,0.10` + `b,0.20` print `0.30`; wave-1/qa8-cents-pair.md) - whole part 0 < 1000, groupThousands not reached.
QA9 (`widget,abc` / `gadget,5.01` / `thing,` exit 2, stderr `error: lines 1, 3: malformed price`, no total; wave-1/qa9-two-malformed.md) - parse error path ends before formatCents; parser untouched.
Re-run, not carried: QA5 (s5-large `big,1234.50`), QA6 (`a,999.99` + `b,0.01`) and QA7 (`big,1234567.00`), because each total's whole part is >= 1000 and reaches the changed groupThousands.
Commit range ecd418fce4a870f089788aa2102397d42c8ea37c..4b7eb4999e12b11667a887bde9f89b5e7ec1ad40, commits 870b644f3e998c81f14dcef89122c6209b1a868f, 4b7eb4999e12b11667a887bde9f89b5e7ec1ad40.
The diff is one patch file per commit, in commit order, each with its commit header. Read /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r53-a/.omp/team-config/gate-deltas/F2-4.1-4b7eb4999e12-20261103075308/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
