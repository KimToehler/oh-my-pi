Complete assignment thoroughly:

Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: Goal (openspec/changes/fee-report/proposal.md): Finance sends payment reminders with the late fee each overdue invoice has accrued and needs a printable summary of those fees. The change adds a late fee calculation from an invoice amount and its days overdue (2% per complete 30-day period, capped at 25%, in whole cents rounded down), a text rendering of a precomputed fee report, and a `render` command (`bun src/cli.ts <report.json>`) that prints it for a report JSON file.
Constraints (design.md): integer-cent arithmetic only, no floating point in the money path; fee calculation and rendering stay independent modules (the renderer formats precomputed data and never computes a fee); lines are printed in the order given; inputs are trusted whole numbers from a machine-generated export and malformed input is not diagnosed. Non-goals: selecting or ordering invoices, date handling, currency conversion, persistence, input validation beyond what rendering needs.
Background: new standalone Bun/TypeScript project with no existing consumers. Gate (gate.md): Mandatory class none, Depth standard, Risk tier product, Whole-diff review not needed (whole-diff surface reviewed in F2), Accepted residual risks none, Out of scope for blocking none. Wrong fees or misrendered amounts would mislead customers about what they owe; no money moves automatically.
Behavioural contract: the two `### Requirement:` blocks of specs/fee-report/spec.md (reproduced under author-supplied criteria and inside the plan below).
Review target: branch feat/fee-report, diff 85d72a39c903cdf2a590ced47d0bf8f77d41febb...f4ba7ce6f7a3cc31b87fb264a7cb028abfd61267 (merge-base with main 85d72a39c903cdf2a590ced47d0bf8f77d41febb, reviewed head f4ba7ce6f7a3cc31b87fb264a7cb028abfd61267). Workspace root (read-only): /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r7/.worktrees/review-fee-report
- Changed files and reviewed diff: Changed files (85d72a39c903cdf2a590ced47d0bf8f77d41febb...f4ba7ce6f7a3cc31b87fb264a7cb028abfd61267):
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

Diff (git diff 85d72a39c903cdf2a590ced47d0bf8f77d41febb...f4ba7ce6f7a3cc31b87fb264a7cb028abfd61267):
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
index 0000000..75163c1
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
+- Integer-cent arithmetic only; no floating point enters the money path.
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
index 0000000..2083b88
--- /dev/null
+++ b/openspec/changes/fee-report/review.md
@@ -0,0 +1,19 @@
+# Review
+
+- **Verdict**: OKAY
+- **Reviewed digest**: 7159be40b82e09e69b856de97db9d29a345a61ec1abc15aaa80b998d4a22f86a
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
index 0000000..f7e8bef
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
+A fee report with at least one line SHALL render one text line per report line in the given order, as id, TAB, due date, TAB, fee, then a last line of `TOTAL`, two TABs and the total of all listed fees. Every amount SHALL be shown in whole units with exactly two decimals and a comma after every group of three integer digits counted from the right (5 cents is `0.05`). A report with no lines SHALL render as exactly `No late fees`. Lines are never reordered or filtered.
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
+- **THEN** any output other than exactly `No late fees`, including a `TOTAL` line, MUST fail this requirement
diff --git a/openspec/changes/fee-report/tasks.md b/openspec/changes/fee-report/tasks.md
new file mode 100644
index 0000000..a8e32bc
--- /dev/null
+++ b/openspec/changes/fee-report/tasks.md
@@ -0,0 +1,19 @@
+# Tasks
+
+## 1. Fee calculation
+
+- [x] 1.1 Add `src/fee.ts` with `lateFee` and its tests. Verify: `bun test src/fee.test.ts`
+
+## 2. Report rendering
+
+- [x] 2.1 Add `src/render.ts`, `src/cli.ts`, `samples/report.json` and the render tests. Verify: `bun test src/render.test.ts && bun src/cli.ts samples/report.json`
+- [x] 2.2 F2 fix (wave 1, QA3 and QA6): group every three integer digits of an amount with a comma, not only the last three, so 123456789 cents renders as `1,234,567.89` in the line and the total; add the render test for the "Large fee grouped" scenario. Verify: `bun test src/render.test.ts`
+
+## 3. Final verification
+
+- [x] 3.1 F1. Manual QA on the real surface: run the `render` command against `samples/report.json` and against reports the QA lane builds, and call `lateFee` with amounts and days the QA lane chooses, exercising both requirements; evidence in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/fee-report/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -d .omp/team-config/evidence/gate/fee-report`
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
index 0000000..98c0a18
--- /dev/null
+++ b/src/render.test.ts
@@ -0,0 +1,29 @@
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
+test("large fee grouped in every group of three", () => {
+  const out = renderReport({ lines: [{ id: "big", dueDate: "2026-01-10", feeCents: 123456789 }] });
+  expect(out).toBe("big\t2026-01-10\t1,234,567.89\nTOTAL\t\t1,234,567.89");
+});
+
+test("empty report", () => {
+  expect(renderReport({ lines: [] })).toBe("No late fees");
+});
diff --git a/src/render.ts b/src/render.ts
new file mode 100644
index 0000000..3bae386
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
+  const grouped = String(units).replace(/\B(?=(\d{3})+$)/g, ",");
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
- Repository context and plan: File paths (relative to the workspace root): src/fee.ts, src/render.ts, src/cli.ts, src/fee.test.ts, src/render.test.ts, samples/report.json, package.json, tsconfig.json, openspec/changes/fee-report/ (proposal.md, design.md, gate.md, tasks.md, review.md, specs/fee-report/spec.md).
Context mining:
- `git log --oneline -20 -- src samples openspec` -> 4 commits on top of base 85d72a3 "chore: feereport base project" (00326d1 change docs, f481f55 late fee, 1bbb337 rendering and render command, efccebc spec wording) plus the F2 fix 7e12243 and the checkbox commit f4ba7ce; no earlier history on these paths -> new code, no existing consumer to regress.
- `rg -n "TODO|FIXME|HACK" src samples` -> none.
- `git remote -v` -> no remote; no issue or PR tracker reachable -> no external context.
- Importers: src/cli.ts imports src/render.ts; tests import src/fee.ts and src/render.ts; nothing imports fee.ts in production code -> matches the design's independent-modules decision; the render command prints precomputed `feeCents`.
- F2 wave 1 (snapshot efccebc) manual QA failed rows QA3 and QA6: formatAmount put a comma only before the last three integer digits (123456789 cents -> `1234,567.89`). Fixed in 7e12243 (tasks.md row 2.2, regex grouping + render test for the "Large fee grouped" scenario); its fix delta was reviewed OKAY by plan-reviewer. f4ba7ce only ticks F1 checkbox 3.1 (exempted as a final-verification checkbox).
- `validate-openspec-change.mjs --reviewed openspec/changes/fee-report` now reports review.md stale (exit 1): adding fix row 2.2 to tasks.md changed the planning-review digest; `validate-openspec-change.mjs openspec/changes/fee-report` passes.
- `bunx tsc --noEmit -p .` cannot run here: `bun-types` is not installed (no node_modules); tests run with bun 1.4.4 (8 pass, 0 fail).
Plan (the OpenSpec change folder bundle exactly as pinned for this wave, .omp/team-config/gate-deltas/F2-60317599da07-wave-2.plan.md):
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
2967ea2b02bdc3f8bb7a81c8ce8a58661cb0801b8b2663af29a483381bbea073  design.md
46cead233f6d306d93ac61c90195786fbf58a0cb7533bde3773db39135255429  gate.md
2804c545f7c399712cbf2070bbd8b51781ab7cfe5842689544b69b28df4f4f66  proposal.md
c523dfb7359d68001d50b8733f27c85ce09827990fdbfac273d2d8d37baa56eb  review.md
07fd02fca5e7a46b72ddf962785f29e635853cc5c67943355d54a79e26dae3ff  specs/fee-report/spec.md
bd7f12f7f22734cfeb08d334d8ce4ef992b65e69beef5a37d4e228dcfed53ca1  tasks.md
===== .openspec.yaml =====
schema: omp-gated
created: 2026-11-02

===== design.md =====
# Design

## Context

New standalone Bun/TypeScript project; no existing consumers.

## Goals / Non-Goals

**Goals:**
- Integer-cent arithmetic only; no floating point enters the money path.
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
- **Reviewed digest**: 7159be40b82e09e69b856de97db9d29a345a61ec1abc15aaa80b998d4a22f86a
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
A fee report with at least one line SHALL render one text line per report line in the given order, as id, TAB, due date, TAB, fee, then a last line of `TOTAL`, two TABs and the total of all listed fees. Every amount SHALL be shown in whole units with exactly two decimals and a comma after every group of three integer digits counted from the right (5 cents is `0.05`). A report with no lines SHALL render as exactly `No late fees`. Lines are never reordered or filtered.

#### Scenario: Lines and total
- **WHEN** a report with the lines `a`/`2026-01-10`/200 cents and `b`/`2026-01-12`/1250 cents is rendered
- **THEN** the output is `a`, TAB, `2026-01-10`, TAB, `2.00`, a newline, `b`, TAB, `2026-01-12`, TAB, `12.50`, a newline and `TOTAL`, two TABs and `14.50`

#### Scenario: Large fee grouped
- **WHEN** a report with one line `big`/`2026-01-10`/123456789 cents is rendered
- **THEN** both the fee of that line and the total are shown as `1,234,567.89`

#### Scenario: Negative control
- **WHEN** a report with no lines is rendered
- **THEN** any output other than exactly `No late fees`, including a `TOTAL` line, MUST fail this requirement

===== tasks.md =====
# Tasks

## 1. Fee calculation

- [x] 1.1 Add `src/fee.ts` with `lateFee` and its tests. Verify: `bun test src/fee.test.ts`

## 2. Report rendering

- [x] 2.1 Add `src/render.ts`, `src/cli.ts`, `samples/report.json` and the render tests. Verify: `bun test src/render.test.ts && bun src/cli.ts samples/report.json`
- [x] 2.2 F2 fix (wave 1, QA3 and QA6): group every three integer digits of an amount with a comma, not only the last three, so 123456789 cents renders as `1,234,567.89` in the line and the total; add the render test for the "Large fee grouped" scenario. Verify: `bun test src/render.test.ts`

## 3. Final verification

- [x] 3.1 F1. Manual QA on the real surface: run the `render` command against `samples/report.json` and against reports the QA lane builds, and call `lateFee` with amounts and days the QA lane chooses, exercising both requirements; evidence in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/fee-report/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -d .omp/team-config/evidence/gate/fee-report`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
- Manual QA matrix and artifacts: Manual QA by the orchestrator (Phase 1), all rows PASS. Captured on 7e122430af7fd360e66c47d1aad818bf34579531 (F1, task 3.1); carried to the reviewed head f4ba7ce6f7a3cc31b87fb264a7cb028abfd61267 because f4ba7ce only ticks checkbox 3.1 in tasks.md and cannot change any observed behaviour. CLI rows ran `bun src/cli.ts` in a real pseudo-terminal (python pty.fork), CR stripped; transcripts show bytes with `cat -vet` (^I = TAB, $ = end of line) and a byte comparison. Fixtures are disposable QA-lane files whose contents each transcript prints. Wave 1 on efccebc failed QA3 and QA6 (single comma: `1234,567.89`, `1000,000.00`), fixed by 7e12243.
|#|Scenario|Exact command / action|Expected|Observed|Verdict|Artifact|
|---|---|---|---|---|---|---|
|QA1|Requirement 1, late fee: spec scenarios (30d->200, 400d->2500, negative control 29d->0) plus boundaries 0/59/60/360/389/390 days, rounding down (999c,30d->19; 12345c,90d->740), zero amount, cap on a large amount|`bun fee-probe.ts` importing src/fee.ts `lateFee` with 13 (amount, days) pairs|each result an integer equal to the stated value|all 13 equal and integer|PASS|.omp/team-config/evidence/gate/fee-report/f1/qa1-latefee.txt|
|QA2|Requirement 2, scenario Lines and total|`bun src/cli.ts lines.json` in a pty, lines a/2026-01-10/200 and b/2026-01-12/1250|`a\t2026-01-10\t2.00\nb\t2026-01-12\t12.50\nTOTAL\t\t14.50`|byte-equal|PASS|.omp/team-config/evidence/gate/fee-report/f1/qa2-render-lines-total.txt|
|QA3|Requirement 2, scenario Large fee grouped (failed in wave 1)|`bun src/cli.ts big.json` in a pty, one line big/2026-01-10/123456789|line fee and total both `1,234,567.89`|byte-equal|PASS|.omp/team-config/evidence/gate/fee-report/f1/qa3-render-large-grouped.txt|
|QA4|Requirement 2, Negative control: empty report|`bun src/cli.ts empty.json` in a pty, `{"lines":[]}`|exactly `No late fees`, no TOTAL line|byte-equal|PASS|.omp/team-config/evidence/gate/fee-report/f1/qa4-render-empty-negative-control.txt|
|QA5|Happy path the goal names: render command on samples/report.json|`bun src/cli.ts samples/report.json` in a pty|three lines in file order (inv-7 25.00, inv-3 12.50, inv-9 2.00), `TOTAL\t\t39.50`|byte-equal|PASS|.omp/team-config/evidence/gate/fee-report/f1/qa5-render-sample-happy-path.txt|
|QA6|Riskiest edge: amount boundaries 0.05, 0.00, 999.99, 1,000.00, 1,000,000.00, total 1,002,000.04; unsorted ids and duplicate id kept in given order (failed in wave 1)|`bun src/cli.ts edges.json` in a pty|every amount grouped per spec, lines neither reordered nor filtered|byte-equal|PASS|.omp/team-config/evidence/gate/fee-report/f1/qa6-render-edges-order.txt|
|QA7|Regression on adjacent behaviour: usage error path and committed suite|`bun src/cli.ts` with no argument; `bun test`|usage line on stderr, exit 2; suite green|usage printed, exit 2; 8 pass 0 fail|PASS|.omp/team-config/evidence/gate/fee-report/f1/qa7-regression-usage-suite.txt|

Artifacts (verbatim contents):
===== .omp/team-config/evidence/gate/fee-report/f1/qa1-latefee.txt =====
row: QA1
head: 7e122430af7fd360e66c47d1aad818bf34579531
command: bun /tmp/feereport-qa/fixtures/fee-probe.ts (imports /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r7/.worktrees/review-fee-report/src/fee.ts)
lateFee(10000, 30) = 200; expected 200; PASS
lateFee(10000, 400) = 2500; expected 2500; PASS
lateFee(10000, 29) = 0; expected 0; PASS
lateFee(10000, 0) = 0; expected 0; PASS
lateFee(10000, 59) = 200; expected 200; PASS
lateFee(10000, 60) = 400; expected 400; PASS
lateFee(10000, 360) = 2400; expected 2400; PASS
lateFee(10000, 389) = 2400; expected 2400; PASS
lateFee(10000, 390) = 2500; expected 2500; PASS
lateFee(999, 30) = 19; expected 19; PASS
lateFee(12345, 90) = 740; expected 740; PASS
lateFee(0, 1000) = 0; expected 0; PASS
lateFee(123456789, 10000) = 30864197; expected 30864197; PASS
verdict: PASS

===== .omp/team-config/evidence/gate/fee-report/f1/qa2-render-lines-total.txt =====
row: QA2
command: bun src/cli.ts /tmp/feereport-qa/fixtures/lines.json (in a pty)
--- input /tmp/feereport-qa/fixtures/lines.json
{"lines":[{"id":"a","dueDate":"2026-01-10","feeCents":200},{"id":"b","dueDate":"2026-01-12","feeCents":1250}]}
head: 7e122430af7fd360e66c47d1aad818bf34579531
--- observed (cat -vet: ^I = TAB, $ = end of line)
a^I2026-01-10^I2.00$
b^I2026-01-12^I12.50$
TOTAL^I^I14.50$

--- expected (cat -vet)
a^I2026-01-10^I2.00$
b^I2026-01-12^I12.50$
TOTAL^I^I14.50$
verdict: PASS (byte-equal)

===== .omp/team-config/evidence/gate/fee-report/f1/qa3-render-large-grouped.txt =====
row: QA3
command: bun src/cli.ts /tmp/feereport-qa/fixtures/big.json (in a pty)
--- input /tmp/feereport-qa/fixtures/big.json
{"lines":[{"id":"big","dueDate":"2026-01-10","feeCents":123456789}]}
head: 7e122430af7fd360e66c47d1aad818bf34579531
--- observed (cat -vet: ^I = TAB, $ = end of line)
big^I2026-01-10^I1,234,567.89$
TOTAL^I^I1,234,567.89$

--- expected (cat -vet)
big^I2026-01-10^I1,234,567.89$
TOTAL^I^I1,234,567.89$
verdict: PASS (byte-equal)

===== .omp/team-config/evidence/gate/fee-report/f1/qa4-render-empty-negative-control.txt =====
row: QA4
command: bun src/cli.ts /tmp/feereport-qa/fixtures/empty.json (in a pty)
--- input /tmp/feereport-qa/fixtures/empty.json
{"lines":[]}
head: 7e122430af7fd360e66c47d1aad818bf34579531
--- observed (cat -vet: ^I = TAB, $ = end of line)
No late fees$

--- expected (cat -vet)
No late fees$
verdict: PASS (byte-equal)

===== .omp/team-config/evidence/gate/fee-report/f1/qa5-render-sample-happy-path.txt =====
row: QA5
command: bun src/cli.ts samples/report.json (in a pty)
--- input samples/report.json
{
  "lines": [
    { "id": "inv-7", "dueDate": "2026-01-10", "feeCents": 2500 },
    { "id": "inv-3", "dueDate": "2026-01-12", "feeCents": 1250 },
    { "id": "inv-9", "dueDate": "2026-02-01", "feeCents": 200 }
  ]
}
head: 7e122430af7fd360e66c47d1aad818bf34579531
--- observed (cat -vet: ^I = TAB, $ = end of line)
inv-7^I2026-01-10^I25.00$
inv-3^I2026-01-12^I12.50$
inv-9^I2026-02-01^I2.00$
TOTAL^I^I39.50$

--- expected (cat -vet)
inv-7^I2026-01-10^I25.00$
inv-3^I2026-01-12^I12.50$
inv-9^I2026-02-01^I2.00$
TOTAL^I^I39.50$
verdict: PASS (byte-equal)

===== .omp/team-config/evidence/gate/fee-report/f1/qa6-render-edges-order.txt =====
row: QA6
command: bun src/cli.ts /tmp/feereport-qa/fixtures/edges.json (in a pty)
--- input /tmp/feereport-qa/fixtures/edges.json
{"lines":[
 {"id":"z9","dueDate":"2026-03-01","feeCents":5},
 {"id":"a1","dueDate":"2026-01-01","feeCents":0},
 {"id":"m5","dueDate":"2026-02-01","feeCents":99999},
 {"id":"m5","dueDate":"2026-02-02","feeCents":100000},
 {"id":"q","dueDate":"2026-02-03","feeCents":100000000}
]}
head: 7e122430af7fd360e66c47d1aad818bf34579531
--- observed (cat -vet: ^I = TAB, $ = end of line)
z9^I2026-03-01^I0.05$
a1^I2026-01-01^I0.00$
m5^I2026-02-01^I999.99$
m5^I2026-02-02^I1,000.00$
q^I2026-02-03^I1,000,000.00$
TOTAL^I^I1,002,000.04$

--- expected (cat -vet)
z9^I2026-03-01^I0.05$
a1^I2026-01-01^I0.00$
m5^I2026-02-01^I999.99$
m5^I2026-02-02^I1,000.00$
q^I2026-02-03^I1,000,000.00$
TOTAL^I^I1,002,000.04$
verdict: PASS (byte-equal)

===== .omp/team-config/evidence/gate/fee-report/f1/qa7-regression-usage-suite.txt =====
row: QA7
head: 7e122430af7fd360e66c47d1aad818bf34579531
command: bun src/cli.ts (no argument)
usage: bun src/cli.ts <report.json>
exit: 2
command: bun test
 8 pass
 0 fail
Ran 8 tests across 2 files. [4.00ms]
verdict: PASS

- Author-supplied behavioural criteria: The review criteria of this OpenSpec change are the `### Requirement:` blocks of specs/fee-report/spec.md with their Negative control scenarios, verbatim:

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
A fee report with at least one line SHALL render one text line per report line in the given order, as id, TAB, due date, TAB, fee, then a last line of `TOTAL`, two TABs and the total of all listed fees. Every amount SHALL be shown in whole units with exactly two decimals and a comma after every group of three integer digits counted from the right (5 cents is `0.05`). A report with no lines SHALL render as exactly `No late fees`. Lines are never reordered or filtered.

#### Scenario: Lines and total
- **WHEN** a report with the lines `a`/`2026-01-10`/200 cents and `b`/`2026-01-12`/1250 cents is rendered
- **THEN** the output is `a`, TAB, `2026-01-10`, TAB, `2.00`, a newline, `b`, TAB, `2026-01-12`, TAB, `12.50`, a newline and `TOTAL`, two TABs and `14.50`

#### Scenario: Large fee grouped
- **WHEN** a report with one line `big`/`2026-01-10`/123456789 cents is rendered
- **THEN** both the fee of that line and the total are shown as `1,234,567.89`

#### Scenario: Negative control
- **WHEN** a report with no lines is rendered
- **THEN** any output other than exactly `No late fees`, including a `TOTAL` line, MUST fail this requirement

Five-field reading of each: Invariant = the requirement text; Positive witness = its non-negative-control scenarios; Negative control = its `Negative control` scenario; Observable = the integer `lateFee` returns, or the exact bytes the render command prints; Boundary = the `lateFee` return value, or the render command's stdout.

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
