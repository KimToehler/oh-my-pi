Complete assignment thoroughly:

Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: Goal (proposal.md): Finance sends payment reminders with the late fee each overdue invoice has accrued and needs a printable summary of those fees. Add a late fee calculation from an invoice amount and its days overdue (2% per complete 30-day period, capped at 25%, in whole cents rounded down), a text rendering of a precomputed fee report, and a `render` command that prints it for a report JSON file.
Constraints (design.md, gate.md): every amount is a whole number of cents and every division is rounded down with Math.floor; fee calculation and rendering stay independent modules (the renderer formats precomputed data and never computes a fee); renderReport prints lines in the given order; non-goals: selecting or ordering invoices, date handling, currency conversion, persistence, input validation beyond what rendering needs. Gate: Mandatory class none, Depth standard, Risk tier product, Whole-diff review not needed (whole-diff surface reviewed in F2), Accepted residual risks none, Out of scope for blocking none.
Background: new standalone Bun/TypeScript project with no existing consumers; inputs are trusted whole numbers from a machine-generated export; a wrong fee or misrendered amount would mislead customers about what they owe (no money moves automatically).
- Changed files and reviewed diff: Changed files (85d72a39c903...b46287d4d6bc):
A	openspec/changes/fee-report/.openspec.yaml
A	openspec/changes/fee-report/design.md
A	openspec/changes/fee-report/gate.md
A	openspec/changes/fee-report/proposal.md
A	openspec/changes/fee-report/review.md
A	openspec/changes/fee-report/specs/fee-report/spec.md
A	openspec/changes/fee-report/tasks.md
A	samples/report.json
A	src/cli.ts
A	src/fee.test.ts
A	src/fee.ts
A	src/render.test.ts
A	src/render.ts

Diff:
diff --git a/openspec/changes/fee-report/.openspec.yaml b/openspec/changes/fee-report/.openspec.yaml
new file mode 100644
index 0000000..f05d850
--- /dev/null
+++ b/openspec/changes/fee-report/.openspec.yaml
@@ -0,0 +1,2 @@
+schema: omp-gated
+created: 2026-11-02
diff --git a/openspec/changes/fee-report/design.md b/openspec/changes/fee-report/design.md
new file mode 100644
index 0000000..cd45354
--- /dev/null
+++ b/openspec/changes/fee-report/design.md
@@ -0,0 +1,23 @@
+# Design
+
+## Context
+
+New standalone Bun/TypeScript project; no existing consumers.
+
+## Goals / Non-Goals
+
+**Goals:**
+- Every amount is a whole number of cents; every division is rounded down with `Math.floor`, so no fractional cent ever enters a result.
+- Fee calculation and rendering stay independent modules: the renderer formats precomputed data and never computes a fee.
+
+**Non-Goals:**
+- Selecting or ordering invoices, date handling, currency conversion, persistence, input file validation beyond what rendering needs.
+
+## Decisions
+
+- `lateFee(amountCents, daysOverdue)` takes whole numbers: periods are `floor(days / 30)`, the percent is capped at 25, and the fee is integer division rounded down.
+- `renderReport` prints the lines in the order given; ordering is the caller's concern.
+
+## Risks / Trade-offs
+
+- Inputs are trusted whole numbers from a machine-generated export; malformed input is not diagnosed.
diff --git a/openspec/changes/fee-report/gate.md b/openspec/changes/fee-report/gate.md
new file mode 100644
index 0000000..9ac4cdf
--- /dev/null
+++ b/openspec/changes/fee-report/gate.md
@@ -0,0 +1,9 @@
+# Gate
+
+- **Mandatory class**: none
+- **Depth**: standard (the class is none and no review, gate or release mechanism changes)
+- **Risk tier**: product
+- **Author's risk assessment**: Finance sends reminders with the listed fee amounts, so a wrong fee or a misrendered amount misleads customers about what they owe; no money moves automatically and no protected asset is touched.
+- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
+- **Accepted residual risks**: none (nothing is accepted: the fee and rendering contract in the spec is the whole behaviour)
+- **Out of scope for blocking**: none (the spec names every behaviour the change owns)
diff --git a/openspec/changes/fee-report/proposal.md b/openspec/changes/fee-report/proposal.md
new file mode 100644
index 0000000..66b63e1
--- /dev/null
+++ b/openspec/changes/fee-report/proposal.md
@@ -0,0 +1,21 @@
+# Proposal
+
+## Why
+
+Finance sends payment reminders with the late fee each overdue invoice has accrued and needs a printable summary of those fees.
+
+## What Changes
+
+- Add a late fee calculation from an invoice amount and its days overdue: 2% per complete 30-day period, capped at 25%, in whole cents rounded down.
+- Add a text rendering of a precomputed fee report and a `render` command that prints it for a report JSON file.
+
+## Capabilities
+
+### New Capabilities
+- `fee-report`: fee calculation and the text rendering of the fee report.
+
+### Modified Capabilities
+
+## Impact
+
+New files under `src/` (`fee.ts`, `render.ts`, `cli.ts`) and `samples/report.json`. No existing behaviour changes.
diff --git a/openspec/changes/fee-report/review.md b/openspec/changes/fee-report/review.md
new file mode 100644
index 0000000..5f657d9
--- /dev/null
+++ b/openspec/changes/fee-report/review.md
@@ -0,0 +1,19 @@
+# Review
+
+- **Verdict**: OKAY
+- **Reviewed digest**: 217e3cf3d0628cfaa8b5d9a07f549df36737de2717c179f3d3700df92e5c7207
+- **Depth**: standard
+- **Reviewer**: plan-reviewer, fixture-author
+- **Verifier**: blocker-verifier, none
+- **Models**: fixture-author onara/cc/claude-opus-5-5
+- **Round**: 1
+- **Awaiting**: none
+- **Override**: none
+
+## Blockers
+
+none
+
+## Residuals
+
+none
diff --git a/openspec/changes/fee-report/specs/fee-report/spec.md b/openspec/changes/fee-report/specs/fee-report/spec.md
new file mode 100644
index 0000000..3f53661
--- /dev/null
+++ b/openspec/changes/fee-report/specs/fee-report/spec.md
@@ -0,0 +1,36 @@
+# Spec Delta
+
+## Purpose
+Late fee accrual for overdue invoices and the text rendering of the fee report for finance follow-up.
+
+## ADDED Requirements
+
+### Requirement: Late fee from amount and days overdue
+The late fee of an invoice SHALL be 2% of its amount in cents for each complete 30-day period it is overdue, capped at 25% of the amount, in whole cents rounded down. The amount and the days overdue are non-negative whole numbers.
+
+#### Scenario: One complete period
+- **WHEN** the fee is computed for an amount of 10000 cents that is 30 days overdue
+- **THEN** the late fee is 200 cents
+
+#### Scenario: Fee cap
+- **WHEN** the fee is computed for an amount of 10000 cents that is 400 days overdue
+- **THEN** the late fee is 2500 cents
+
+#### Scenario: Negative control
+- **WHEN** the fee is computed for an amount of 10000 cents that is 29 days overdue
+- **THEN** any late fee above 0 cents MUST fail this requirement
+
+### Requirement: Fee report rendering
+A report with lines SHALL render one text line per report line in the given order (id, TAB, due date, TAB, fee), then a last line of `TOTAL`, two TABs and the total of all fees. Every amount SHALL be shown in whole units with exactly two decimals and a comma after every group of three integer digits counted from the right (5 cents is `0.05`). A report with no lines SHALL render as exactly `No late fees`. The `render` command prints the rendered text and one newline.
+
+#### Scenario: Lines and total
+- **WHEN** a report with the lines `a`/`2026-01-10`/200 cents and `b`/`2026-01-12`/1250 cents is rendered
+- **THEN** the output is `a`, TAB, `2026-01-10`, TAB, `2.00`, a newline, `b`, TAB, `2026-01-12`, TAB, `12.50`, a newline and `TOTAL`, two TABs and `14.50`
+
+#### Scenario: Large fee grouped
+- **WHEN** a report with one line `big`/`2026-01-10`/123456789 cents is rendered
+- **THEN** both the fee of that line and the total are shown as `1,234,567.89`
+
+#### Scenario: Negative control
+- **WHEN** a report with no lines is rendered
+- **THEN** any rendered text other than exactly `No late fees`, including a `TOTAL` line, MUST fail this requirement
diff --git a/openspec/changes/fee-report/tasks.md b/openspec/changes/fee-report/tasks.md
new file mode 100644
index 0000000..b209ea5
--- /dev/null
+++ b/openspec/changes/fee-report/tasks.md
@@ -0,0 +1,22 @@
+# Tasks
+
+## 1. Fee calculation
+
+- [x] 1.1 Add `src/fee.ts` with `lateFee` and its tests. Verify: `bun test src/fee.test.ts`
+
+## 2. Report rendering
+
+- [x] 2.1 Add `src/render.ts`, `src/cli.ts`, `samples/report.json` and the render tests. Verify: `bun test src/render.test.ts && bun src/cli.ts samples/report.json`
+
+## 3. Final verification
+
+- [x] 3.1 F1. Manual QA on the real surface: run the `render` command against `samples/report.json` and against reports the QA lane builds, and call `lateFee` with amounts and days the QA lane chooses, exercising both requirements; evidence in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/fee-report/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -d .omp/team-config/evidence/gate/fee-report`
+
+## 4. F2 fixes
+
+- [x] 4.1 F2 wave 1 QA2/QA4 (scenario Large fee grouped): `formatAmount` separates every group of three integer digits from the right, so 123456789 cents is `1,234,567.89` and 100000000 cents is `1,000,000.00`, in each line and the total; regression tests for amounts of 1,000,000.00 and above. Verify: `bun test src/render.test.ts`
+
+## Workflow follow-up
+
+- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
+- Merge only after the F2 record validates.
diff --git a/samples/report.json b/samples/report.json
new file mode 100644
index 0000000..d6a7470
--- /dev/null
+++ b/samples/report.json
@@ -0,0 +1,7 @@
+{
+  "lines": [
+    { "id": "inv-7", "dueDate": "2026-01-10", "feeCents": 2500 },
+    { "id": "inv-3", "dueDate": "2026-01-12", "feeCents": 1250 },
+    { "id": "inv-9", "dueDate": "2026-02-01", "feeCents": 200 }
+  ]
+}
diff --git a/src/cli.ts b/src/cli.ts
new file mode 100644
index 0000000..612d1eb
--- /dev/null
+++ b/src/cli.ts
@@ -0,0 +1,9 @@
+import { readFileSync } from "node:fs";
+import { renderReport, type Report } from "./render";
+
+const [file] = process.argv.slice(2);
+if (!file) {
+  console.error("usage: bun src/cli.ts <report.json>");
+  process.exit(2);
+}
+console.log(renderReport(JSON.parse(readFileSync(file, "utf8")) as Report));
diff --git a/src/fee.test.ts b/src/fee.test.ts
new file mode 100644
index 0000000..4b21787
--- /dev/null
+++ b/src/fee.test.ts
@@ -0,0 +1,14 @@
+import { expect, test } from "bun:test";
+import { lateFee } from "./fee";
+
+test("one complete period charges 2%", () => {
+  expect(lateFee(10000, 30)).toBe(200);
+});
+
+test("fee is capped at 25% of the amount", () => {
+  expect(lateFee(10000, 400)).toBe(2500);
+});
+
+test("29 days overdue charges nothing", () => {
+  expect(lateFee(10000, 29)).toBe(0);
+});
diff --git a/src/fee.ts b/src/fee.ts
new file mode 100644
index 0000000..e6d727a
--- /dev/null
+++ b/src/fee.ts
@@ -0,0 +1,10 @@
+const PERIOD_DAYS = 30;
+const RATE_PERCENT_PER_PERIOD = 2;
+const CAP_PERCENT = 25;
+
+/** Late fee in whole cents: 2% per complete 30-day period overdue, capped at 25%, rounded down. */
+export function lateFee(amountCents: number, daysOverdue: number): number {
+  const periods = Math.floor(daysOverdue / PERIOD_DAYS);
+  const percent = Math.min(periods * RATE_PERCENT_PER_PERIOD, CAP_PERCENT);
+  return Math.floor((amountCents * percent) / 100);
+}
diff --git a/src/render.test.ts b/src/render.test.ts
new file mode 100644
index 0000000..89ce69b
--- /dev/null
+++ b/src/render.test.ts
@@ -0,0 +1,35 @@
+import { expect, test } from "bun:test";
+import { formatAmount, renderReport } from "./render";
+
+test("lines and total", () => {
+  const out = renderReport({
+    lines: [
+      { id: "a", dueDate: "2026-01-10", feeCents: 200 },
+      { id: "b", dueDate: "2026-01-12", feeCents: 1250 },
+    ],
+  });
+  expect(out).toBe("a\t2026-01-10\t2.00\nb\t2026-01-12\t12.50\nTOTAL\t\t14.50");
+});
+
+test("cents are zero padded", () => {
+  expect(formatAmount(5)).toBe("0.05");
+});
+
+test("thousands are grouped", () => {
+  expect(formatAmount(123456)).toBe("1,234.56");
+});
+
+test("every group of three integer digits is separated", () => {
+  expect(formatAmount(99999999)).toBe("999,999.99");
+  expect(formatAmount(100000000)).toBe("1,000,000.00");
+  expect(formatAmount(100000000000)).toBe("1,000,000,000.00");
+});
+
+test("large fee grouped in line and total", () => {
+  const out = renderReport({ lines: [{ id: "big", dueDate: "2026-01-10", feeCents: 123456789 }] });
+  expect(out).toBe("big\t2026-01-10\t1,234,567.89\nTOTAL\t\t1,234,567.89");
+});
+
+test("empty report", () => {
+  expect(renderReport({ lines: [] })).toBe("No late fees");
+});
diff --git a/src/render.ts b/src/render.ts
new file mode 100644
index 0000000..109dcf7
--- /dev/null
+++ b/src/render.ts
@@ -0,0 +1,24 @@
+export interface ReportLine {
+  id: string;
+  dueDate: string;
+  feeCents: number;
+}
+
+export interface Report {
+  lines: ReportLine[];
+}
+
+/** Whole units with two decimals and a comma after every group of three integer digits. */
+export function formatAmount(cents: number): string {
+  const units = Math.floor(cents / 100);
+  const decimals = String(cents % 100).padStart(2, "0");
+  const grouped = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
+  return `${grouped}.${decimals}`;
+}
+
+export function renderReport(report: Report): string {
+  if (report.lines.length === 0) return "No late fees";
+  const rows = report.lines.map(l => `${l.id}\t${l.dueDate}\t${formatAmount(l.feeCents)}`);
+  const total = report.lines.reduce((sum, l) => sum + l.feeCents, 0);
+  return [...rows, `TOTAL\t\t${formatAmount(total)}`].join("\n");
+}
- Repository context and plan: Repository root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-r55/.worktrees/review-fee-report
Changed source: src/fee.ts, src/fee.test.ts, src/render.ts, src/render.test.ts, src/cli.ts, samples/report.json; plan folder openspec/changes/fee-report/ (immutable plan copy for this wave: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-r55/.worktrees/review-fee-report/.omp/team-config/gate-deltas/F2-60317599da07-wave-2.plan.md).
Context mining (source -> finding -> why it matters):
- git log efccebc, f082981, 82e54ad -> spec.md and design.md were reworded after the implementation commits (integer-cent goal became 'every division rounded down with Math.floor'; rendering requirement gained 'The render command prints the rendered text and one newline') -> the code must satisfy the final wording, not the wording it was written against.
- F2 wave 1 QA (82e54ad) -> formatAmount inserted only one comma (1234,567.89) -> fixed in b652d66 as tasks.md row 4.1 with regression tests; fix delta reviewed OKAY by plan-reviewer, whose verdict turn ran on fallback model onara/cc/claude-opus-5 after the pinned model stalled.
- b652d66 adds tasks.md row 4.1 -> validate-openspec-change.mjs --reviewed now reports review.md stale (planning digest 217e3cf...); the planning review predates the fix row.
- git grep TODO|FIXME|HACK in src samples -> none.
- No git remote, gh has no token -> no issues or PRs to mine.
- No node_modules (bun-types absent) -> LSP reports TS2307 for 'bun:test' in test files; the project has no typecheck script; tests run under bun.
- Importers: src/cli.ts imports render.ts; nothing imports fee.ts outside its test; no code composes lateFee into a report (design: renderer formats precomputed data).
Plan (immutable copy, bundle of the change folder):
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
b8bc8d1fce6fd0a94578c19963b92645300f3306bdea0cb2e002cfe663030a56  design.md
46cead233f6d306d93ac61c90195786fbf58a0cb7533bde3773db39135255429  gate.md
2804c545f7c399712cbf2070bbd8b51781ab7cfe5842689544b69b28df4f4f66  proposal.md
839eaafbd5a82cc24a35e774162c9d2c876334deec7cdc39a3232d3041ab1124  review.md
09804bff1d09b4a8f18d920261bd4128edc6e36405aaee401b38e1329434e8cc  specs/fee-report/spec.md
af16c15291d4f666702f0ad8621972195eb1427a45994b6f14414c37ae1ebf84  tasks.md
===== .openspec.yaml =====
schema: omp-gated
created: 2026-11-02

===== design.md =====
# Design

## Context

New standalone Bun/TypeScript project; no existing consumers.

## Goals / Non-Goals

**Goals:**
- Every amount is a whole number of cents; every division is rounded down with `Math.floor`, so no fractional cent ever enters a result.
- Fee calculation and rendering stay independent modules: the renderer formats precomputed data and never computes a fee.

**Non-Goals:**
- Selecting or ordering invoices, date handling, currency conversion, persistence, input file validation beyond what rendering needs.

## Decisions

- `lateFee(amountCents, daysOverdue)` takes whole numbers: periods are `floor(days / 30)`, the percent is capped at 25, and the fee is integer division rounded down.
- `renderReport` prints the lines in the order given; ordering is the caller's concern.

## Risks / Trade-offs

- Inputs are trusted whole numbers from a machine-generated export; malformed input is not diagnosed.

===== gate.md =====
# Gate

- **Mandatory class**: none
- **Depth**: standard (the class is none and no review, gate or release mechanism changes)
- **Risk tier**: product
- **Author's risk assessment**: Finance sends reminders with the listed fee amounts, so a wrong fee or a misrendered amount misleads customers about what they owe; no money moves automatically and no protected asset is touched.
- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
- **Accepted residual risks**: none (nothing is accepted: the fee and rendering contract in the spec is the whole behaviour)
- **Out of scope for blocking**: none (the spec names every behaviour the change owns)

===== proposal.md =====
# Proposal

## Why

Finance sends payment reminders with the late fee each overdue invoice has accrued and needs a printable summary of those fees.

## What Changes

- Add a late fee calculation from an invoice amount and its days overdue: 2% per complete 30-day period, capped at 25%, in whole cents rounded down.
- Add a text rendering of a precomputed fee report and a `render` command that prints it for a report JSON file.

## Capabilities

### New Capabilities
- `fee-report`: fee calculation and the text rendering of the fee report.

### Modified Capabilities

## Impact

New files under `src/` (`fee.ts`, `render.ts`, `cli.ts`) and `samples/report.json`. No existing behaviour changes.

===== review.md =====
# Review

- **Verdict**: OKAY
- **Reviewed digest**: 217e3cf3d0628cfaa8b5d9a07f549df36737de2717c179f3d3700df92e5c7207
- **Depth**: standard
- **Reviewer**: plan-reviewer, fixture-author
- **Verifier**: blocker-verifier, none
- **Models**: fixture-author onara/cc/claude-opus-5-5
- **Round**: 1
- **Awaiting**: none
- **Override**: none

## Blockers

none

## Residuals

none

===== specs/fee-report/spec.md =====
# Spec Delta

## Purpose
Late fee accrual for overdue invoices and the text rendering of the fee report for finance follow-up.

## ADDED Requirements

### Requirement: Late fee from amount and days overdue
The late fee of an invoice SHALL be 2% of its amount in cents for each complete 30-day period it is overdue, capped at 25% of the amount, in whole cents rounded down. The amount and the days overdue are non-negative whole numbers.

#### Scenario: One complete period
- **WHEN** the fee is computed for an amount of 10000 cents that is 30 days overdue
- **THEN** the late fee is 200 cents

#### Scenario: Fee cap
- **WHEN** the fee is computed for an amount of 10000 cents that is 400 days overdue
- **THEN** the late fee is 2500 cents

#### Scenario: Negative control
- **WHEN** the fee is computed for an amount of 10000 cents that is 29 days overdue
- **THEN** any late fee above 0 cents MUST fail this requirement

### Requirement: Fee report rendering
A report with lines SHALL render one text line per report line in the given order (id, TAB, due date, TAB, fee), then a last line of `TOTAL`, two TABs and the total of all fees. Every amount SHALL be shown in whole units with exactly two decimals and a comma after every group of three integer digits counted from the right (5 cents is `0.05`). A report with no lines SHALL render as exactly `No late fees`. The `render` command prints the rendered text and one newline.

#### Scenario: Lines and total
- **WHEN** a report with the lines `a`/`2026-01-10`/200 cents and `b`/`2026-01-12`/1250 cents is rendered
- **THEN** the output is `a`, TAB, `2026-01-10`, TAB, `2.00`, a newline, `b`, TAB, `2026-01-12`, TAB, `12.50`, a newline and `TOTAL`, two TABs and `14.50`

#### Scenario: Large fee grouped
- **WHEN** a report with one line `big`/`2026-01-10`/123456789 cents is rendered
- **THEN** both the fee of that line and the total are shown as `1,234,567.89`

#### Scenario: Negative control
- **WHEN** a report with no lines is rendered
- **THEN** any rendered text other than exactly `No late fees`, including a `TOTAL` line, MUST fail this requirement

===== tasks.md =====
# Tasks

## 1. Fee calculation

- [x] 1.1 Add `src/fee.ts` with `lateFee` and its tests. Verify: `bun test src/fee.test.ts`

## 2. Report rendering

- [x] 2.1 Add `src/render.ts`, `src/cli.ts`, `samples/report.json` and the render tests. Verify: `bun test src/render.test.ts && bun src/cli.ts samples/report.json`

## 3. Final verification

- [x] 3.1 F1. Manual QA on the real surface: run the `render` command against `samples/report.json` and against reports the QA lane builds, and call `lateFee` with amounts and days the QA lane chooses, exercising both requirements; evidence in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/fee-report/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -d .omp/team-config/evidence/gate/fee-report`

## 4. F2 fixes

- [x] 4.1 F2 wave 1 QA2/QA4 (scenario Large fee grouped): `formatAmount` separates every group of three integer digits from the right, so 123456789 cents is `1,234,567.89` and 100000000 cents is `1,000,000.00`, in each line and the total; regression tests for amounts of 1,000,000.00 and above. Verify: `bun test src/render.test.ts`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
- Manual QA matrix and artifacts: | # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|---|---|---|---|---|---|
|QA1|Requirement: Late fee from amount and days overdue (scenarios One complete period, Fee cap, Negative control 29 days, plus 0/59/60/360/390 days, rounding 99c and 49c, zero amount, cap on 123456789c)|bun <fixture qa1-fee.ts> calling lateFee from src/fee through the library API|every result an integer equal to the expected value|12/12 OK, fails=0|PASS (carried: captured at 82e54ad in wave-1/, copied byte-identical to f1/; later commits b652d66 and b46287d change only src/render.ts, src/render.test.ts and tasks.md, never src/fee.ts; delta review confirmed the carry)|.omp/team-config/evidence/gate/fee-report/f1/qa1-late-fee.txt (sha256 68b8e8e850daa70afa1a2ea34f7bc9c8190305557f25fd85d4161365012b8b8c)|
|QA2|Requirement: Fee report rendering (scenarios Lines and total, Large fee grouped, Negative control no lines; given order kept; 5 cents is 0.05)|script -q /dev/null bun src/cli.ts <fixture> (pty) and bun src/cli.ts <fixture>|od -c, cmp against expected bytes incl. one trailing newline|a\t2026-01-10\t2.00\nb\t2026-01-12\t12.50\nTOTAL\t\t14.50\n; big ... 1,234,567.89 in line and TOTAL; exactly 'No late fees\n'; z,y order kept, 0.05/0.07/0.12|all four byte checks MATCH, exit 0, empty stderr|PASS (captured at b652d66; carried across b46287d, which only ticks checkbox 3.1 in tasks.md)|.omp/team-config/evidence/gate/fee-report/f1/qa2-render.txt (sha256 5195b2671794ed029bb86c09aebb87f85aa90eb8d6513f2a577517d40c9068ba)|
|QA3|Happy path: render the shipped samples/report.json|script -q /dev/null bun run render samples/report.json; bun src/cli.ts samples/report.json|od -c; cmp|inv-7 25.00, inv-3 12.50, inv-9 2.00, TOTAL 39.50, one trailing newline|MATCH, exit 0|PASS (captured at b652d66; carried across b46287d, tasks.md checkbox only)|.omp/team-config/evidence/gate/fee-report/f1/qa3-sample-happy-path.txt (sha256 152baf828963601b193024eb45fb1b5fbfb05902914750d7516f021497e613d7)|
|QA4|Riskiest edge: digit-grouping boundaries 0, 99999, 100000, 100005, 99999999, 100000000, 100000000000 cents and their total|bun src/cli.ts <qa4-boundaries.json> (pty + od -c), cmp|0.00, 999.99, 1,000.00, 1,000.05, 999,999.99, 1,000,000.00, 1,000,000,000.00, TOTAL 1,002,003,000.03|MATCH, exit 0 (wave 1 at 82e54ad had FAILED: 1000,000.00 and 1000000,000.00; fixed by b652d66)|PASS (captured at b652d66; carried across b46287d, tasks.md checkbox only)|.omp/team-config/evidence/gate/fee-report/f1/qa4-grouping-boundaries.txt (sha256 4c7a17cbf277ae042af9c0ce93ab0b46c11bf88cb0fcb0dad22f766c5ceec4df)|
|QA5|Regression: committed test suite and CLI usage error|bun test; bun src/cli.ts with no argument|all tests pass; usage line on stderr, exit 2|9 pass 0 fail, exit 0; 'usage: bun src/cli.ts <report.json>', exit=2|PASS (captured at b652d66; carried across b46287d, tasks.md checkbox only)|.omp/team-config/evidence/gate/fee-report/f1/qa5-regression.txt (sha256 daf9f9f235fac7eb907981495e8dca5cdb4097b69f7b6367a413c177ee14a5c8)|
Wave 1 (snapshot 82e54ad) QA failed rows QA2 and QA4 (grouping); recorded as F2 wave 1 FAIL, fixed as tasks.md row 4.1 in b652d66, delta-reviewed OKAY. Reviewed snapshot for this wave: b46287d4d6bc9be18b44430e985b6dacf594060f.
- Author-supplied behavioural criteria: The plan is an OpenSpec folder; its criteria are the `### Requirement:` blocks of specs/fee-report/spec.md with their Negative control scenarios, verbatim:
### Requirement: Late fee from amount and days overdue
The late fee of an invoice SHALL be 2% of its amount in cents for each complete 30-day period it is overdue, capped at 25% of the amount, in whole cents rounded down. The amount and the days overdue are non-negative whole numbers.

#### Scenario: One complete period
- **WHEN** the fee is computed for an amount of 10000 cents that is 30 days overdue
- **THEN** the late fee is 200 cents

#### Scenario: Fee cap
- **WHEN** the fee is computed for an amount of 10000 cents that is 400 days overdue
- **THEN** the late fee is 2500 cents

#### Scenario: Negative control
- **WHEN** the fee is computed for an amount of 10000 cents that is 29 days overdue
- **THEN** any late fee above 0 cents MUST fail this requirement

### Requirement: Fee report rendering
A report with lines SHALL render one text line per report line in the given order (id, TAB, due date, TAB, fee), then a last line of `TOTAL`, two TABs and the total of all fees. Every amount SHALL be shown in whole units with exactly two decimals and a comma after every group of three integer digits counted from the right (5 cents is `0.05`). A report with no lines SHALL render as exactly `No late fees`. The `render` command prints the rendered text and one newline.

#### Scenario: Lines and total
- **WHEN** a report with the lines `a`/`2026-01-10`/200 cents and `b`/`2026-01-12`/1250 cents is rendered
- **THEN** the output is `a`, TAB, `2026-01-10`, TAB, `2.00`, a newline, `b`, TAB, `2026-01-12`, TAB, `12.50`, a newline and `TOTAL`, two TABs and `14.50`

#### Scenario: Large fee grouped
- **WHEN** a report with one line `big`/`2026-01-10`/123456789 cents is rendered
- **THEN** both the fee of that line and the total are shown as `1,234,567.89`

#### Scenario: Negative control
- **WHEN** a report with no lines is rendered
- **THEN** any rendered text other than exactly `No late fees`, including a `TOTAL` line, MUST fail this requirement

Asymmetry constraint: you have only the diff and the plan. You do not have my reasoning for any specific decision. If something looks wrong, flag it - I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

Review exactly these five sections:
1. Goal and behavioural contract
2. Correctness, regressions, architecture, wire contracts
3. Security and privacy delta
4. Verification adequacy
5. Final `PASS | FAIL | INCONCLUSIVE`

In section 2, read the whole diff and not only line by line: look for cross-module seams, consistency, duplication and simplification across files.

Generate at least one adversarial behavioural criterion of your own using Phase 2.5 fields, and make every criterion you emit your own - the validator rejects a trailer carrying any criterion whose invariant is restated from the plan, so quoting one back beside an original does not satisfy the rule. Author-supplied criteria are inputs, never complete review scope.

Security scope: a finding blocks only when it cites changed lines in DIFF_RANGE, or shows change altered exploitability or exposure of pre-existing code. Otherwise label it `PRE-EXISTING / OUT-OF-SCOPE` as a note.

Brief guard: if this message did not carry all five numbered sections, or withheld the QA matrix, return INCONCLUSIVE and name what was missing. Do not answer a narrower brief as if it were the whole assignment.

Return each blocker on its own `Blocker B<n>:` line with severity, `file:line` or artifact evidence, violated contract, and fix direction. For every blocker name `class:` and list `sites:` across the whole tree with the search you ran, or `single instance: <reason>`. Confirm each listed class is closed at every site. Close with exactly one verdict token: PASS, FAIL, or INCONCLUSIVE.

End your reply with this block verbatim, filled in. It is the only record of what you were actually asked:

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: <numbers you received, comma-separated>
model_id: <your exact resolved model ID, or unresolved>
security_delta: <yes|no - yes only when the change touches a real credential, an authentication or authorisation path, or third-party personal data, or weakens access to a protected asset; a synthetic credential limited to disposable local/test services is no>
verdict: <PASS|FAIL|INCONCLUSIVE>
blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>
adversarial_criteria:
- invariant: <your own, not restated from the plan>
  positive_witness: <representative valid outcome>
  negative_control: <plausible broken outcome that MUST fail>
  observable: <runtime evidence distinguishing them>
  boundary: <layer where the result is checked>
END-REVIEW-TRAILER
