Complete assignment thoroughly:

Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract:
GOAL: OpenSpec change `fee-report` (branch feat/fee-report, repository root /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-r53). Finance sends payment reminders with the late fee each overdue invoice has accrued and needs a printable summary. Deliver (1) `lateFee(amountCents, daysOverdue)`: 2% of the amount per complete 30-day period overdue, capped at 25%, whole cents rounded down; (2) `renderReport` text rendering of a precomputed fee report (one TAB-separated line per report line in the given order, a `TOTAL` line, amounts in whole units with two decimals and a comma after every group of three integer digits, `No late fees` for an empty report) and a `render` command (`bun src/cli.ts <report.json>`) that prints the rendered text and one newline.
CONSTRAINTS: Bun/TypeScript, new standalone project with no existing consumers. Every amount is a whole number of cents; every division rounds down with Math.floor. Fee calculation and rendering stay independent modules: the renderer formats precomputed data and never computes a fee. Non-goals: selecting/ordering invoices, date handling, currency conversion, persistence, input-file validation beyond what rendering needs. Inputs are trusted whole numbers from a machine-generated export. Gate: Mandatory class none, Depth standard, Risk tier product (openspec/changes/fee-report/gate.md).
BACKGROUND: The behavioural contract is openspec/changes/fee-report/specs/fee-report/spec.md (two requirements, each with a Negative control scenario). Implementation commits f481f55 (fee) and 1bbb337 (render + CLI). F2 wave 1 manual QA failed QA6/QA8 (amounts of one million units or more rendered `1234,567.89`); fix row 4.1 in tasks.md was implemented in 1e202e0 (formatAmount groups every three digits, two new tests, RED observed before the fix), and its delta review (plan-reviewer) returned OKAY. 4aedb11 ticks tasks 3.1 and 4.1. Reviewed head: 4aedb1199ae224282974a4b954f21f1bc3877848; diff base (merge-base with main): 85d72a39c903cdf2a590ced47d0bf8f77d41febb.
- Changed files and reviewed diff:
Changed files (git diff --name-only 85d72a3..4aedb11):
openspec/changes/fee-report/.openspec.yaml
openspec/changes/fee-report/design.md
openspec/changes/fee-report/gate.md
openspec/changes/fee-report/proposal.md
openspec/changes/fee-report/review.md
openspec/changes/fee-report/specs/fee-report/spec.md
openspec/changes/fee-report/tasks.md
samples/report.json
src/cli.ts
src/fee.test.ts
src/fee.ts
src/render.test.ts
src/render.ts

Reviewed diff (git diff 85d72a39c903cdf2a590ced47d0bf8f77d41febb 4aedb1199ae224282974a4b954f21f1bc3877848):
```diff
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
index 0000000..0f43823
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
+## TODOs
+
+- [x] 4.1 F2 wave 1 fix (QA6, QA8): `formatAmount` puts a comma after only the lowest group of three integer digits, so 123456789 cents renders `1234,567.89` instead of `1,234,567.89`; group every three digits from the right and cover the spec's "Large fee grouped" scenario with a test. Verify: `bun test src/render.test.ts`
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
index 0000000..cc66275
--- /dev/null
+++ b/src/render.test.ts
@@ -0,0 +1,33 @@
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
+  expect(formatAmount(100000000)).toBe("1,000,000.00");
+});
+
+test("large fee grouped on the line and the total", () => {
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
```
- Repository context and plan:
File paths to read for context: src/fee.ts, src/render.ts, src/cli.ts, src/fee.test.ts, src/render.test.ts, samples/report.json, package.json, tsconfig.json, openspec/config.yaml, openspec/changes/fee-report/ (all files).
CONTEXT_MINING (source -> finding -> why it matters):
- git log 85d72a3..HEAD -> the spec and design were reworded after the implementation commits (efccebc, f082981, 82e54ad): the requirement text dropped its inline `123456789 cents is 1,234,567.89` example and the sentence "Lines are rendered as given and never reordered or filtered", and added "The `render` command prints the rendered text and one newline"; the design goal changed from "Integer-cent arithmetic only; no floating point" to "every division is rounded down with Math.floor" -> the code must satisfy the final wording, and the Large fee grouped scenario still carries the grouping example.
- F2 wave 1 QA (.omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-render-big.txt, qa-render-edge-amounts.txt) -> pre-fix formatAmount grouped only the lowest three digits -> the committed tests at that time (`1,234.56`) could not catch it; fix 1e202e0 adds discriminating tests.
- openspec validate-openspec-change.mjs --reviewed -> review.md (planning review, digest 217e3cf…) is now stale because fix row 4.1 added a line to tasks.md; the plan-reviewer delta review covered that edit -> planning-record bookkeeping only, no behaviour.
- rg TODO|FIXME|HACK on changed files -> none.
- No git remote, no gh issues/PRs; no other module imports src/ (new project).
- `bunx tsc --noEmit` cannot run in this checkout: no node_modules, so `bun-types` is missing (TS2688); bun test runs.

PLAN (the pinned plan copy for this wave, .omp/team-config/gate-deltas/F2-60317599da07-wave-2.plan.md, sha256 0e150a1af82b4cfe27451443de87eadb708ba3e889759a3261c9b7153af13a62; it is the bundle of every file of openspec/changes/fee-report):
```
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
b8bc8d1fce6fd0a94578c19963b92645300f3306bdea0cb2e002cfe663030a56  design.md
46cead233f6d306d93ac61c90195786fbf58a0cb7533bde3773db39135255429  gate.md
2804c545f7c399712cbf2070bbd8b51781ab7cfe5842689544b69b28df4f4f66  proposal.md
839eaafbd5a82cc24a35e774162c9d2c876334deec7cdc39a3232d3041ab1124  review.md
09804bff1d09b4a8f18d920261bd4128edc6e36405aaee401b38e1329434e8cc  specs/fee-report/spec.md
7dcf70b4d0c5d73d8b505c2eefd86bbe0359baec7423d8441639854b204106a3  tasks.md
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

## TODOs

- [x] 4.1 F2 wave 1 fix (QA6, QA8): `formatAmount` puts a comma after only the lowest group of three integer digits, so 123456789 cents renders `1234,567.89` instead of `1,234,567.89`; group every three digits from the right and cover the spec's "Large fee grouped" scenario with a test. Verify: `bun test src/render.test.ts`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.

```
- Manual QA matrix and artifacts:
Manual QA matrix (orchestrator, real surface: the `bun src/cli.ts` command and a Bun script importing `lateFee`; fixtures in .omp/team-config/evidence/gate/fee-report/f1/wave-1/fixtures/). Rows marked carried were captured in wave 1 at 82e54ad and the range 82e54ad..4aedb11 cannot change what they observed (reason given); rows marked re-run were captured at 1e202e0, the last code commit, and 4aedb11 changes only two tasks.md checkboxes.

|#|Scenario|Exact command / action|Expected|Observed|Verdict|Artifact|
|---|---|---|---|---|---|---|
|QA1|Fee: one complete period|`bun .omp/team-config/evidence/gate/fee-report/f1/wave-1/fixtures/latefee-probe.ts` case lateFee(10000, 30)|200|200|PASS (carried: src/fee.ts untouched by the range, render never calls lateFee)|.omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-latefee.txt|
|QA2|Fee cap|same script, lateFee(10000, 400)|2500|2500|PASS (carried, as QA1)|.omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-latefee.txt|
|QA3|Fee negative control|same script, lateFee(10000, 29)|0|0|PASS (carried, as QA1)|.omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-latefee.txt|
|QA4|Fee edges: period boundaries, zero inputs, round-down|same script: (10000,59)=200, (10000,60)=400, (10000,360)=2400, (10000,390)=2500, (10000,0)=0, (0,400)=0, (12345,30)=246, (99,30)=1, (49,30)=0|values shown|all equal|PASS (carried, as QA1)|.omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-latefee.txt|
|QA5|Render: lines and total (spec scenario)|`bun src/cli.ts .omp/team-config/evidence/gate/fee-report/f1/wave-1/fixtures/two-lines.json`|exact bytes `a\t2026-01-10\t2.00\nb\t2026-01-12\t12.50\nTOTAL\t\t14.50\n`|identical|PASS (re-run)|.omp/team-config/evidence/gate/fee-report/f1/wave-2/qa-render-two-lines.txt|
|QA6|Render: large fee grouped (spec scenario)|`bun src/cli.ts .omp/team-config/evidence/gate/fee-report/f1/wave-1/fixtures/big.json`|`1,234,567.89` on the line and TOTAL|`big\t2026-01-10\t1,234,567.89\nTOTAL\t\t1,234,567.89\n`|PASS (re-run; FAIL in wave 1 with `1234,567.89`, .omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-render-big.txt)|.omp/team-config/evidence/gate/fee-report/f1/wave-2/qa-render-big.txt|
|QA7|Render negative control: empty report|`bun src/cli.ts .omp/team-config/evidence/gate/fee-report/f1/wave-1/fixtures/empty.json`|exactly `No late fees\n`|`No late fees\n`|PASS (carried: unchanged early return before formatAmount; cli.ts unchanged)|.omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-render-empty.txt|
|QA8|Render edge amounts: 5 cents, zero middle groups, one million units|`bun src/cli.ts .omp/team-config/evidence/gate/fee-report/f1/wave-1/fixtures/edge-amounts.json`|`0.05`, `1,000,000.00`, `1,000.05`, TOTAL `1,001,000.10`|identical|PASS (re-run; FAIL in wave 1, .omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-render-edge-amounts.txt)|.omp/team-config/evidence/gate/fee-report/f1/wave-2/qa-render-edge-amounts.txt|
|QA9|Render keeps the given order|`bun src/cli.ts .omp/team-config/evidence/gate/fee-report/f1/wave-1/fixtures/order.json`|`z` line before `a` line, TOTAL 0.03|identical|PASS (re-run)|.omp/team-config/evidence/gate/fee-report/f1/wave-2/qa-render-order.txt|
|QA10|Happy path: committed sample|`bun src/cli.ts samples/report.json`|inv-7 25.00, inv-3 12.50, inv-9 2.00 in file order, TOTAL 39.50, one trailing newline|identical|PASS (re-run)|.omp/team-config/evidence/gate/fee-report/f1/wave-2/qa-render-sample.txt|
|QA11|Regression: CLI without argument|`bun src/cli.ts`|usage line on stderr, exit 2, empty stdout|identical|PASS (carried: cli.ts unchanged, exits before rendering)|.omp/team-config/evidence/gate/fee-report/f1/wave-1/qa-usage.txt|
|QA12|Regression: committed suite|`bun test`|all pass|9 pass, 0 fail|PASS (re-run)|.omp/team-config/evidence/gate/fee-report/f1/wave-2/qa-tests.txt|

Unexercised: `bunx tsc --noEmit` (bun-types not installed in this checkout); reports with malformed or non-integer input (non-goal per design).
- Author-supplied behavioural criteria:
Author-supplied criteria (from the spec's requirements and Negative control scenarios):
1. Invariant: the late fee is 2% of the amount per complete 30-day period, capped at 25%, rounded down to whole cents.
   Positive witness: lateFee(10000, 30) = 200; lateFee(10000, 400) = 2500.
   Negative control: lateFee(10000, 29) returns anything above 0.
   Observable: the integer lateFee returns for chosen amounts and days.
   Boundary: the exported lateFee function in src/fee.ts.
2. Invariant: every rendered amount shows whole units, exactly two decimals and a comma after every group of three integer digits counted from the right, on each line and on TOTAL.
   Positive witness: 123456789 cents renders `1,234,567.89` on the line and the TOTAL; 5 cents renders `0.05`.
   Negative control: `1234,567.89` or `1000,000.00` (only the lowest group separated).
   Observable: the exact stdout bytes of `bun src/cli.ts <report.json>`.
   Boundary: the render command's stdout.
3. Invariant: a report with no lines renders exactly `No late fees`, and the command adds exactly one newline.
   Positive witness: stdout `No late fees\n`.
   Negative control: any TOTAL line, any other text, or a missing/extra newline.
   Observable: exact stdout bytes of the render command for `{"lines": []}`.
   Boundary: the render command's stdout.

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
