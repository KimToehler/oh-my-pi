Review this fix delta. Workspace root: /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r6/.worktrees/review-late-fee-report. Plan: openspec/changes/late-fee-report.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria (the change folder's criteria are the `### Requirement:` blocks of specs/late-fees/spec.md):
### Requirement: Late fee per invoice
An invoice overdue at the as-of date SHALL accrue a late fee of 2% of its amount for each complete 30-day period overdue, capped at 25% of the amount, in whole cents rounded down. Days overdue are counted in UTC calendar days.

#### Scenario: One complete period
- **WHEN** an invoice of 10000 cents due 2026-01-10 is evaluated as of 2026-02-15
- **THEN** its late fee is 200 cents

#### Scenario: Fee cap
- **WHEN** an invoice of 10000 cents is more than a year overdue
- **THEN** its late fee is 2500 cents

#### Scenario: Negative control
- **WHEN** an invoice is only 29 days overdue
- **THEN** any late fee above 0 cents MUST fail this requirement

### Requirement: Overdue report ordering
The overdue report SHALL list only invoices with a late fee above zero, ordered by late fee descending, then by due date ascending (earlier first), then by invoice id ascending in plain code-unit string order, followed by a total of all listed fees. The order SHALL NOT depend on the order of the input file.

#### Scenario: Different fees
- **WHEN** one invoice has a fee of 1000 cents and another a fee of 200 cents
- **THEN** the 1000-cent invoice is listed first

#### Scenario: Equal fees
- **WHEN** two listed invoices have equal late fees and different due dates, in any input order
- **THEN** the invoice with the earlier due date is listed first, and invoices with equal due dates are listed by id

#### Scenario: Negative control
- **WHEN** an invoice has a late fee of 0 cents
- **THEN** a report line for it MUST fail this requirement
- **Accepted residual risks**: none (nothing is accepted: the fee and ordering contract in the specs is the whole behaviour)
- **Out of scope for blocking**: none (the specs name every behaviour the change owns)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
- [x] 1.2 F2 wave 1 fix for QA3: count days overdue in UTC calendar days (`Date.UTC` in `src/invoice.ts`) so an invoice 30 calendar days overdue across a local daylight-saving change accrues its fee in every process time zone, with a regression test that pins a DST time zone. Verify: `bun test src/fee.test.ts`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
none: every row re-run
Commit range 23695863d94352fcbd98b7e912b27884a73bd2ce..418158c10d6d8c905f6d376c026cf6eb1491da0f, commits 418158c10d6d8c905f6d376c026cf6eb1491da0f.
The diff is one patch file per commit, in commit order, each with its commit header. Read /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r6/.worktrees/review-late-fee-report/.omp/team-config/gate-deltas/F2-1.2-418158c10d6d-20261102220727/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
