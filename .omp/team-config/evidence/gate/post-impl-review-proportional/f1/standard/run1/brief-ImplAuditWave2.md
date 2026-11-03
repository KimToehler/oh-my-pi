Complete assignment thoroughly:

Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: GOAL: The OpenSpec change `late-fee-report` (folder openspec/changes/late-fee-report): finance needs a command that lists overdue invoices with the late fee each has accrued, so reminders can be sent with the amount owed. It adds a late fee calculation (2% of the invoice amount per complete 30-day period overdue, capped at 25%, in whole cents rounded down; days overdue counted in UTC calendar days) and an overdue report listing only invoices with a fee above zero, ordered by fee descending, equal fees by due date ascending, followed by a total of all listed fees, with an order that does not depend on the input file order; plus a `report` command (`bun src/cli.ts <invoices.json> --as-of YYYY-MM-DD`) that prints it. This review is the F2 merge gate (review-work, depth standard) of that change.
CONSTRAINTS (design.md): integer-cent arithmetic only, no floating point in the money path (fee percent from whole periods floor(days/30), then capped, then applied with integer division); dates are UTC calendar dates given as YYYY-MM-DD strings, parsed by hand; the report is deterministic for any input order; it sorts a derived list of lines and never mutates the input array. Non-goals: currency conversion, persistence, input file schema validation beyond what the report needs; malformed dates are not diagnosed (finance exports are machine generated). Bun/TypeScript, `bun test` suite.
BACKGROUND: new standalone Bun/TypeScript project with no existing consumers (design.md Context). gate.md: Mandatory class none; Depth standard; Risk tier product; author's risk assessment: finance sends reminders with the listed fee amounts, so a wrong fee or wrong ordering misleads customers about what they owe; no money moves automatically and no protected asset is touched; Whole-diff review: not needed (whole-diff surface reviewed in F2); Accepted residual risks: none; Out of scope for blocking: none. Diff base is main at 7c09518d3c7862ed6cc7ce68289b1493299bf9ad (merge-base); reviewed head is c2c2f92579a05501e4c24c3e27443a848428c2f7 on branch review/late-fee-report (tip of feat/late-fee-report dc48c96 plus the F2 fix commits).
- Changed files and reviewed diff: Changed files (git diff --name-only main...HEAD):
openspec/changes/late-fee-report/.openspec.yaml
openspec/changes/late-fee-report/design.md
openspec/changes/late-fee-report/gate.md
openspec/changes/late-fee-report/proposal.md
openspec/changes/late-fee-report/review.md
openspec/changes/late-fee-report/specs/late-fees/spec.md
openspec/changes/late-fee-report/tasks.md
samples/invoices.json
src/cli.ts
src/fee.test.ts
src/fee.ts
src/invoice.ts
src/report.test.ts
src/report.ts

Reviewed diff (git diff main...HEAD, 7c09518d3c7862ed6cc7ce68289b1493299bf9ad..c2c2f92579a05501e4c24c3e27443a848428c2f7):
diff --git a/openspec/changes/late-fee-report/.openspec.yaml b/openspec/changes/late-fee-report/.openspec.yaml
new file mode 100644
index 0000000..f05d850
--- /dev/null
+++ b/openspec/changes/late-fee-report/.openspec.yaml
@@ -0,0 +1,2 @@
+schema: omp-gated
+created: 2026-11-02
diff --git a/openspec/changes/late-fee-report/design.md b/openspec/changes/late-fee-report/design.md
new file mode 100644
index 0000000..5862448
--- /dev/null
+++ b/openspec/changes/late-fee-report/design.md
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
+- Integer-cent arithmetic only; dates are UTC calendar dates.
+- A report that is deterministic for any input order.
+
+**Non-Goals:**
+- Currency conversion, persistence, input file schema validation beyond what the report needs.
+
+## Decisions
+
+- Fee percent is computed from whole periods (`floor(days / 30)`), then capped, then applied with integer division, so no floating point enters the money path.
+- The report sorts a derived list of lines; the input array is never mutated.
+
+## Risks / Trade-offs
+
+- Dates are `YYYY-MM-DD` strings parsed by hand; malformed dates are not diagnosed (out of scope, finance exports are machine generated).
diff --git a/openspec/changes/late-fee-report/gate.md b/openspec/changes/late-fee-report/gate.md
new file mode 100644
index 0000000..09ff4e1
--- /dev/null
+++ b/openspec/changes/late-fee-report/gate.md
@@ -0,0 +1,9 @@
+# Gate
+
+- **Mandatory class**: none
+- **Depth**: standard (the class is none and no review, gate or release mechanism changes)
+- **Risk tier**: product
+- **Author's risk assessment**: Finance sends reminders with the listed fee amounts, so a wrong fee or wrong ordering misleads customers about what they owe; no money moves automatically and no protected asset is touched.
+- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
+- **Accepted residual risks**: none (nothing is accepted: the fee and ordering contract in the specs is the whole behaviour)
+- **Out of scope for blocking**: none (the specs name every behaviour the change owns)
diff --git a/openspec/changes/late-fee-report/proposal.md b/openspec/changes/late-fee-report/proposal.md
new file mode 100644
index 0000000..aefd433
--- /dev/null
+++ b/openspec/changes/late-fee-report/proposal.md
@@ -0,0 +1,21 @@
+# Proposal
+
+## Why
+
+Finance needs a command that lists overdue invoices with the late fee each has accrued, so reminders can be sent with the amount owed.
+
+## What Changes
+
+- Add a late fee calculation: 2% of the invoice amount per complete 30-day period overdue, capped at 25%, in whole cents rounded down.
+- Add an overdue report that lists invoices with a fee, ordered by fee, with a total, and a `report` command that prints it for an invoices JSON file.
+
+## Capabilities
+
+### New Capabilities
+- `late-fees`: fee calculation per invoice and the ordered overdue report.
+
+### Modified Capabilities
+
+## Impact
+
+New files under `src/` (`invoice.ts`, `fee.ts`, `report.ts`, `cli.ts`) and `samples/invoices.json`. No existing behaviour changes.
diff --git a/openspec/changes/late-fee-report/review.md b/openspec/changes/late-fee-report/review.md
new file mode 100644
index 0000000..4384cb4
--- /dev/null
+++ b/openspec/changes/late-fee-report/review.md
@@ -0,0 +1,19 @@
+# Review
+
+- **Verdict**: OKAY
+- **Reviewed digest**: 2ff2e56e7d28e8f61262bdd0f6aa5019ef564cbfaeb2185f8d2a657e68a03d2f
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
diff --git a/openspec/changes/late-fee-report/specs/late-fees/spec.md b/openspec/changes/late-fee-report/specs/late-fees/spec.md
new file mode 100644
index 0000000..cf3129a
--- /dev/null
+++ b/openspec/changes/late-fee-report/specs/late-fees/spec.md
@@ -0,0 +1,36 @@
+# Spec Delta
+
+## Purpose
+Late fee accrual for overdue invoices and the report that lists them for finance follow-up.
+
+## ADDED Requirements
+
+### Requirement: Late fee per invoice
+An invoice overdue at the as-of date SHALL accrue a late fee of 2% of its amount for each complete 30-day period overdue, capped at 25% of the amount, in whole cents rounded down. Days overdue are counted in UTC calendar days.
+
+#### Scenario: One complete period
+- **WHEN** an invoice of 10000 cents due 2026-01-10 is evaluated as of 2026-02-15
+- **THEN** its late fee is 200 cents
+
+#### Scenario: Fee cap
+- **WHEN** an invoice of 10000 cents is more than a year overdue
+- **THEN** its late fee is 2500 cents
+
+#### Scenario: Negative control
+- **WHEN** an invoice is only 29 days overdue
+- **THEN** any late fee above 0 cents MUST fail this requirement
+
+### Requirement: Overdue report ordering
+The overdue report SHALL list only invoices with a late fee above zero, ordered by late fee descending, with invoices of equal late fee ordered by due date ascending (earlier due date first), followed by a total of all listed fees. The order SHALL NOT depend on the order of the input file.
+
+#### Scenario: Different fees
+- **WHEN** one invoice has a fee of 1000 cents and another a fee of 200 cents
+- **THEN** the 1000-cent invoice is listed first
+
+#### Scenario: Equal fees
+- **WHEN** two listed invoices have equal late fees and different due dates, in any input order
+- **THEN** the invoice with the earlier due date is listed first
+
+#### Scenario: Negative control
+- **WHEN** an invoice has a late fee of 0 cents
+- **THEN** a report line for it MUST fail this requirement
diff --git a/openspec/changes/late-fee-report/tasks.md b/openspec/changes/late-fee-report/tasks.md
new file mode 100644
index 0000000..5288171
--- /dev/null
+++ b/openspec/changes/late-fee-report/tasks.md
@@ -0,0 +1,19 @@
+# Tasks
+
+## 1. Fee calculation
+
+- [x] 1.1 Add `src/invoice.ts` and `src/fee.ts` with `lateFee` and its tests. Verify: `bun test src/fee.test.ts`
+
+## 2. Report
+
+- [x] 2.1 Add `src/report.ts`, `src/cli.ts`, `samples/invoices.json` and the report tests. Verify: `bun test src/report.test.ts && bun src/cli.ts samples/invoices.json --as-of 2026-02-20`
+- [x] 2.2 F2 fix (wave 1, QA7 and QA10): order report lines of equal late fee by due date ascending, then by id, so the report order never depends on the input order; regression test for both input orders. Verify: `bun test src/report.test.ts`
+
+## 3. Final verification
+
+- [x] 3.1 F1. Manual QA on the real surface: run the `report` command against `samples/invoices.json` and against inputs the QA lane builds, exercising the fee and ordering requirements; evidence in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/late-fee-report/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -d .omp/team-config/evidence/gate/late-fee-report`
+
+## Workflow follow-up
+
+- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
+- Merge only after the F2 record validates.
diff --git a/samples/invoices.json b/samples/invoices.json
new file mode 100644
index 0000000..223ddee
--- /dev/null
+++ b/samples/invoices.json
@@ -0,0 +1,6 @@
+[
+  { "id": "INV-1", "amountCents": 10000, "dueDate": "2026-01-10" },
+  { "id": "INV-2", "amountCents": 10000, "dueDate": "2026-01-12" },
+  { "id": "INV-3", "amountCents": 50000, "dueDate": "2025-12-01" },
+  { "id": "INV-4", "amountCents": 20000, "dueDate": "2026-02-10" }
+]
diff --git a/src/cli.ts b/src/cli.ts
new file mode 100644
index 0000000..51e1eb4
--- /dev/null
+++ b/src/cli.ts
@@ -0,0 +1,11 @@
+import { readFileSync } from "node:fs";
+import type { Invoice } from "./invoice";
+import { buildReport, renderReport } from "./report";
+
+const [file, flag, asOf] = process.argv.slice(2);
+if (!file || flag !== "--as-of" || !asOf) {
+  console.error("usage: bun src/cli.ts <invoices.json> --as-of YYYY-MM-DD");
+  process.exit(2);
+}
+const invoices = JSON.parse(readFileSync(file, "utf8")) as Invoice[];
+console.log(renderReport(buildReport(invoices, asOf)));
diff --git a/src/fee.test.ts b/src/fee.test.ts
new file mode 100644
index 0000000..e2a0bf5
--- /dev/null
+++ b/src/fee.test.ts
@@ -0,0 +1,16 @@
+import { expect, test } from "bun:test";
+import { lateFee } from "./fee";
+
+const inv = (dueDate: string, amountCents = 10000) => ({ id: "x", amountCents, dueDate });
+
+test("one complete period charges 2%", () => {
+  expect(lateFee(inv("2026-01-10"), "2026-02-15")).toBe(200);
+});
+
+test("fee is capped at 25% of the amount", () => {
+  expect(lateFee(inv("2025-01-01"), "2026-02-15")).toBe(2500);
+});
+
+test("29 days overdue charges nothing", () => {
+  expect(lateFee(inv("2026-01-10"), "2026-02-08")).toBe(0);
+});
diff --git a/src/fee.ts b/src/fee.ts
new file mode 100644
index 0000000..89fded9
--- /dev/null
+++ b/src/fee.ts
@@ -0,0 +1,12 @@
+import { daysOverdue, type Invoice } from "./invoice";
+
+const PERIOD_DAYS = 30;
+const RATE_PERCENT_PER_PERIOD = 2;
+const CAP_PERCENT = 25;
+
+/** Late fee in whole cents: 2% per complete 30-day period overdue, capped at 25%, rounded down. */
+export function lateFee(invoice: Invoice, asOf: string): number {
+  const periods = Math.floor(daysOverdue(invoice, asOf) / PERIOD_DAYS);
+  const percent = Math.min(periods * RATE_PERCENT_PER_PERIOD, CAP_PERCENT);
+  return Math.floor((invoice.amountCents * percent) / 100);
+}
diff --git a/src/invoice.ts b/src/invoice.ts
new file mode 100644
index 0000000..1f9c0ab
--- /dev/null
+++ b/src/invoice.ts
@@ -0,0 +1,16 @@
+export interface Invoice {
+  id: string;
+  amountCents: number;
+  dueDate: string; // YYYY-MM-DD, UTC calendar date
+}
+
+const DAY_MS = 86_400_000;
+
+function utcDay(date: string): number {
+  const [y, m, d] = date.split("-").map(Number);
+  return Date.UTC(y, m - 1, d) / DAY_MS;
+}
+
+export function daysOverdue(invoice: Invoice, asOf: string): number {
+  return Math.max(0, utcDay(asOf) - utcDay(invoice.dueDate));
+}
diff --git a/src/report.test.ts b/src/report.test.ts
new file mode 100644
index 0000000..de08dff
--- /dev/null
+++ b/src/report.test.ts
@@ -0,0 +1,40 @@
+import { expect, test } from "bun:test";
+import { buildReport } from "./report";
+
+const AS_OF = "2026-02-20";
+
+test("higher fee is listed first", () => {
+  const report = buildReport(
+    [
+      { id: "small", amountCents: 10000, dueDate: "2026-01-10" },
+      { id: "big", amountCents: 50000, dueDate: "2026-01-10" },
+    ],
+    AS_OF,
+  );
+  expect(report.lines.map(l => l.id)).toEqual(["big", "small"]);
+  expect(report.totalCents).toBe(200 + 1000);
+});
+
+test("invoice without a fee is not listed", () => {
+  const report = buildReport([{ id: "fresh", amountCents: 10000, dueDate: "2026-02-10" }], AS_OF);
+  expect(report.lines).toEqual([]);
+  expect(report.totalCents).toBe(0);
+});
+
+const sameFee = (id: string, dueDate: string) => ({ id, amountCents: 10000, dueDate });
+
+test("equal fees list the earlier due date first, ahead of id order, in either input order", () => {
+  const earlier = sameFee("Z-earlier", "2026-01-10");
+  const later = sameFee("A-later", "2026-01-12");
+  for (const input of [[earlier, later], [later, earlier]]) {
+    expect(buildReport(input, AS_OF).lines.map(l => l.id)).toEqual(["Z-earlier", "A-later"]);
+  }
+});
+
+test("equal fees and due dates are ordered by id, in either input order", () => {
+  const a = sameFee("A", "2026-01-10");
+  const b = sameFee("B", "2026-01-10");
+  for (const input of [[a, b], [b, a]]) {
+    expect(buildReport(input, AS_OF).lines.map(l => l.id)).toEqual(["A", "B"]);
+  }
+});
diff --git a/src/report.ts b/src/report.ts
new file mode 100644
index 0000000..1ae83e8
--- /dev/null
+++ b/src/report.ts
@@ -0,0 +1,32 @@
+import { lateFee } from "./fee";
+import type { Invoice } from "./invoice";
+
+export interface ReportLine {
+  id: string;
+  dueDate: string;
+  feeCents: number;
+}
+
+export interface Report {
+  lines: ReportLine[];
+  totalCents: number;
+}
+
+/** Invoices with a fee, highest fee first; equal fees by earlier due date, then by id, so input order never matters. */
+export function buildReport(invoices: Invoice[], asOf: string): Report {
+  const lines = invoices
+    .map(inv => ({ id: inv.id, dueDate: inv.dueDate, feeCents: lateFee(inv, asOf) }))
+    .filter(line => line.feeCents > 0)
+    .sort((a, b) => b.feeCents - a.feeCents || a.dueDate.localeCompare(b.dueDate, "en") || a.id.localeCompare(b.id, "en"));
+  const totalCents = lines.reduce((sum, line) => sum + line.feeCents, 0);
+  return { lines, totalCents };
+}
+
+export function formatCents(cents: number): string {
+  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
+}
+
+export function renderReport(report: Report): string {
+  const rows = report.lines.map(l => `${l.id}\t${l.dueDate}\t${formatCents(l.feeCents)}`);
+  return [...rows, `TOTAL\t\t${formatCents(report.totalCents)}`].join("\n");
+}

- Repository context and plan: Workspace root (read-only for you): /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard/.worktrees/review-late-fee-report
Source files: src/invoice.ts, src/fee.ts, src/report.ts, src/cli.ts, src/fee.test.ts, src/report.test.ts, samples/invoices.json; project files package.json, tsconfig.json, openspec/config.yaml.
CONTEXT_MINING (source -> finding -> why it matters):
- git log main..HEAD -> fabe305 OpenSpec change, b3edec9 late fee, dc48c96 report and command (implementation), then F2 fix commits 6bb9989 (equal-fee tie-break, task 2.2), 951b31a (due-date test made to oppose id order), c2c2f92 (ticks F1 task 3.1) -> the reviewed head contains a fix round from F2 wave 1.
- F2 wave 1 manual QA on dc48c96 -> rows QA7 and QA10 failed: equal-fee lines followed input order because src/report.ts sorted by fee only -> fixed in 6bb9989; both fix commits were delta-reviewed OKAY by plan-reviewer; the first delta note (due-date test ids sorted like the dates, so an id-only tie-break also passed) led to 951b31a, whose test fails against an id-only comparator (probe run) and passes on the fix.
- Repository has no git remote; gh has no authenticated context -> no issues or PRs to mine.
- rg TODO|FIXME|HACK over src and samples -> none.
- Importers -> src/report.ts imports ./fee and ./invoice; src/cli.ts imports ./invoice and ./report; tests import ./fee and ./report; no other consumers (design.md: new standalone project).
- Environment -> no node_modules installed, so tsc/LSP report "Cannot find module 'bun:test'" for the test files (tsconfig types: bun-types); no typecheck was run; `bun test` runs.
PLAN (the immutable plan input for this wave: the OpenSpec change folder bundle, a manifest of sha256/path lines then each file under a ===== <path> ===== line; snapshot copy /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard/.worktrees/review-late-fee-report/.omp/team-config/gate-deltas/F2-9c6da0f3c5f8-wave-2.plan.md):
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
cb14d99280798b4b00d7f70b12051bdbc33ad014a779512fab4eb0d4e1974af1  design.md
e5bf9e7041dc133d8d3eb0e519002585ea75bcebb477fc17f692c24cd68d6f89  gate.md
4aaa439f8dcf42540d1f70cee1ea875d5e2d094279a6dabfed7147056b47c4f9  proposal.md
90a847f20f8673f91a930f0ac8ab21d457570def5dc716e580f2b5eb86105afa  review.md
66407da93cbc5061aa6e8f7e1aeacd5abd1ee98c309c948a22467a42989ff76a  specs/late-fees/spec.md
5fa280226dfad6de82501bb0dd8239755e8a8f2de7c06314120ea5a8ba068910  tasks.md
===== .openspec.yaml =====
schema: omp-gated
created: 2026-11-02

===== design.md =====
# Design

## Context

New standalone Bun/TypeScript project; no existing consumers.

## Goals / Non-Goals

**Goals:**
- Integer-cent arithmetic only; dates are UTC calendar dates.
- A report that is deterministic for any input order.

**Non-Goals:**
- Currency conversion, persistence, input file schema validation beyond what the report needs.

## Decisions

- Fee percent is computed from whole periods (`floor(days / 30)`), then capped, then applied with integer division, so no floating point enters the money path.
- The report sorts a derived list of lines; the input array is never mutated.

## Risks / Trade-offs

- Dates are `YYYY-MM-DD` strings parsed by hand; malformed dates are not diagnosed (out of scope, finance exports are machine generated).

===== gate.md =====
# Gate

- **Mandatory class**: none
- **Depth**: standard (the class is none and no review, gate or release mechanism changes)
- **Risk tier**: product
- **Author's risk assessment**: Finance sends reminders with the listed fee amounts, so a wrong fee or wrong ordering misleads customers about what they owe; no money moves automatically and no protected asset is touched.
- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
- **Accepted residual risks**: none (nothing is accepted: the fee and ordering contract in the specs is the whole behaviour)
- **Out of scope for blocking**: none (the specs name every behaviour the change owns)

===== proposal.md =====
# Proposal

## Why

Finance needs a command that lists overdue invoices with the late fee each has accrued, so reminders can be sent with the amount owed.

## What Changes

- Add a late fee calculation: 2% of the invoice amount per complete 30-day period overdue, capped at 25%, in whole cents rounded down.
- Add an overdue report that lists invoices with a fee, ordered by fee, with a total, and a `report` command that prints it for an invoices JSON file.

## Capabilities

### New Capabilities
- `late-fees`: fee calculation per invoice and the ordered overdue report.

### Modified Capabilities

## Impact

New files under `src/` (`invoice.ts`, `fee.ts`, `report.ts`, `cli.ts`) and `samples/invoices.json`. No existing behaviour changes.

===== review.md =====
# Review

- **Verdict**: OKAY
- **Reviewed digest**: 2ff2e56e7d28e8f61262bdd0f6aa5019ef564cbfaeb2185f8d2a657e68a03d2f
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

===== specs/late-fees/spec.md =====
# Spec Delta

## Purpose
Late fee accrual for overdue invoices and the report that lists them for finance follow-up.

## ADDED Requirements

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
The overdue report SHALL list only invoices with a late fee above zero, ordered by late fee descending, with invoices of equal late fee ordered by due date ascending (earlier due date first), followed by a total of all listed fees. The order SHALL NOT depend on the order of the input file.

#### Scenario: Different fees
- **WHEN** one invoice has a fee of 1000 cents and another a fee of 200 cents
- **THEN** the 1000-cent invoice is listed first

#### Scenario: Equal fees
- **WHEN** two listed invoices have equal late fees and different due dates, in any input order
- **THEN** the invoice with the earlier due date is listed first

#### Scenario: Negative control
- **WHEN** an invoice has a late fee of 0 cents
- **THEN** a report line for it MUST fail this requirement

===== tasks.md =====
# Tasks

## 1. Fee calculation

- [x] 1.1 Add `src/invoice.ts` and `src/fee.ts` with `lateFee` and its tests. Verify: `bun test src/fee.test.ts`

## 2. Report

- [x] 2.1 Add `src/report.ts`, `src/cli.ts`, `samples/invoices.json` and the report tests. Verify: `bun test src/report.test.ts && bun src/cli.ts samples/invoices.json --as-of 2026-02-20`
- [x] 2.2 F2 fix (wave 1, QA7 and QA10): order report lines of equal late fee by due date ascending, then by id, so the report order never depends on the input order; regression test for both input orders. Verify: `bun test src/report.test.ts`

## 3. Final verification

- [x] 3.1 F1. Manual QA on the real surface: run the `report` command against `samples/invoices.json` and against inputs the QA lane builds, exercising the fee and ordering requirements; evidence in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/late-fee-report/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -d .omp/team-config/evidence/gate/late-fee-report`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
- Manual QA matrix and artifacts: Wave 2 matrix. Every row was captured on 951b31abca24010414cc0f6975f74b5e1700bbb0, the last code commit; each capture starts with that SHA, the input file and the command. Carried to the snapshot head c2c2f92579a05501e4c24c3e27443a848428c2f7 because c2c2f92 only ticks the task 3.1 checkbox in tasks.md and changes no behaviour any row observed. Inputs are synthetic. Wave 1 (on dc48c96) failed QA7 and QA10, which the fix commits address; its captures are in .omp/team-config/evidence/gate/late-fee-report/f1/wave-1/.

|#|Scenario|Exact command / action|Expected|Observed|Verdict|Artifact|
|---|---|---|---|---|---|---|
|QA1|Sample file, happy path (fee and ordering requirements)|bun src/cli.ts samples/invoices.json --as-of 2026-02-20|INV-3 20.00, INV-1 2.00, INV-2 2.00, INV-4 (10 days) absent, TOTAL 24.00|INV-3 20.00 / INV-1 2.00 / INV-2 2.00 / TOTAL 24.00, exit 0|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa1-sample-happy-path.txt|
|QA2|Fee: one complete period (spec scenario)|10000 cents due 2026-01-10, --as-of 2026-02-15|P1 2.00|P1 2.00, TOTAL 2.00|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa2-one-period.txt|
|QA3|Fee: cap (spec scenario)|10000 cents due 2025-01-01, --as-of 2026-02-15|CAP 25.00|CAP 25.00, TOTAL 25.00|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa3-fee-cap.txt|
|QA4|Fee negative control + boundary: 29 vs 30 days|D29 due 2026-01-17 and D30 due 2026-01-16, --as-of 2026-02-15|D29 absent (fee 0); D30 2.00|only D30 2.00, TOTAL 2.00|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa4-fee-negative-control-29-vs-30-days.txt|
|QA5|Ordering: different fees (spec scenario)|LOW 10000 and HIGH 50000 both due 2026-01-10, --as-of 2026-02-20|HIGH 10.00 before LOW 2.00|HIGH 10.00, LOW 2.00, TOTAL 12.00|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa5-different-fees-order.txt|
|QA6|Ordering: equal fees, earlier due first in input|EARLIER due 01-10, LATER due 01-12, --as-of 2026-02-20|EARLIER before LATER|EARLIER, LATER, TOTAL 4.00|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa6-equal-fees-earlier-first-input.txt|
|QA7|Ordering: equal fees, later due first in input (riskiest edge; failed in wave 1)|LATER due 01-12 listed before EARLIER due 01-10 in the file, --as-of 2026-02-20|EARLIER before LATER|EARLIER, LATER, TOTAL 4.00|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa7-equal-fees-later-first-input.txt|
|QA8|Ordering negative control: 0-cent invoice not listed|FRESH due 2026-02-10 (10 days) and OLD due 2026-01-10, --as-of 2026-02-20|no FRESH line; OLD 2.00|OLD 2.00, TOTAL 2.00|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa8-zero-fee-not-listed.txt|
|QA9|Edge: empty invoice list|[] --as-of 2026-02-20|only TOTAL 0.00|TOTAL 0.00, exit 0|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa9-empty-input.txt|
|QA10|Order independence: sample file reversed (failed in wave 1)|jq reverse samples/invoices.json, --as-of 2026-02-20|identical to QA1|INV-3, INV-1, INV-2, TOTAL 24.00 (identical to QA1)|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa10-sample-reversed-input.txt|
|QA11|Regression: usage error on missing --as-of|bun src/cli.ts samples/invoices.json|usage line on stderr, exit 2|usage line, exit 2|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa11-usage-error.txt|
|QA12|Regression: full test suite|bun test|all pass|7 pass, 0 fail|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa12-bun-test.txt|
|QA13|Order independence: equal fee and equal due date, ids reversed in input|B then A, both 10000 due 2026-01-10, --as-of 2026-02-20|A before B|A, B, TOTAL 4.00|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa13-equal-fee-equal-date-reversed-ids.txt|
|QA14|Ordering: due date takes precedence over id|A-LATER due 01-12 then Z-EARLIER due 01-10, equal fees, --as-of 2026-02-20|Z-EARLIER before A-LATER|Z-EARLIER, A-LATER, TOTAL 4.00|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa14-equal-fees-ids-oppose-dates.txt|

Artifact contents (verbatim):

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa1-sample-happy-path.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat invoices.json
[
  { "id": "INV-1", "amountCents": 10000, "dueDate": "2026-01-10" },
  { "id": "INV-2", "amountCents": 10000, "dueDate": "2026-01-12" },
  { "id": "INV-3", "amountCents": 50000, "dueDate": "2025-12-01" },
  { "id": "INV-4", "amountCents": 20000, "dueDate": "2026-02-10" }
]
$ bun src/cli.ts invoices.json --as-of 2026-02-20
INV-3	2025-12-01	20.00
INV-1	2026-01-10	2.00
INV-2	2026-01-12	2.00
TOTAL		24.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa2-one-period.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat one-period.json
[{ "id": "P1", "amountCents": 10000, "dueDate": "2026-01-10" }]
$ bun src/cli.ts one-period.json --as-of 2026-02-15
P1	2026-01-10	2.00
TOTAL		2.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa3-fee-cap.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat cap.json
[{ "id": "CAP", "amountCents": 10000, "dueDate": "2025-01-01" }]
$ bun src/cli.ts cap.json --as-of 2026-02-15
CAP	2025-01-01	25.00
TOTAL		25.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa4-fee-negative-control-29-vs-30-days.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat boundary.json
[{ "id": "D29", "amountCents": 10000, "dueDate": "2026-01-17" }, { "id": "D30", "amountCents": 10000, "dueDate": "2026-01-16" }]
$ bun src/cli.ts boundary.json --as-of 2026-02-15
D30	2026-01-16	2.00
TOTAL		2.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa5-different-fees-order.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat diff-fees.json
[{ "id": "LOW", "amountCents": 10000, "dueDate": "2026-01-10" }, { "id": "HIGH", "amountCents": 50000, "dueDate": "2026-01-10" }]
$ bun src/cli.ts diff-fees.json --as-of 2026-02-20
HIGH	2026-01-10	10.00
LOW	2026-01-10	2.00
TOTAL		12.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa6-equal-fees-earlier-first-input.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat equal-fees-earlier-first.json
[{ "id": "EARLIER", "amountCents": 10000, "dueDate": "2026-01-10" }, { "id": "LATER", "amountCents": 10000, "dueDate": "2026-01-12" }]
$ bun src/cli.ts equal-fees-earlier-first.json --as-of 2026-02-20
EARLIER	2026-01-10	2.00
LATER	2026-01-12	2.00
TOTAL		4.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa7-equal-fees-later-first-input.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat equal-fees-later-first.json
[{ "id": "LATER", "amountCents": 10000, "dueDate": "2026-01-12" }, { "id": "EARLIER", "amountCents": 10000, "dueDate": "2026-01-10" }]
$ bun src/cli.ts equal-fees-later-first.json --as-of 2026-02-20
EARLIER	2026-01-10	2.00
LATER	2026-01-12	2.00
TOTAL		4.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa8-zero-fee-not-listed.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat zero-fee.json
[{ "id": "FRESH", "amountCents": 20000, "dueDate": "2026-02-10" }, { "id": "OLD", "amountCents": 10000, "dueDate": "2026-01-10" }]
$ bun src/cli.ts zero-fee.json --as-of 2026-02-20
OLD	2026-01-10	2.00
TOTAL		2.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa9-empty-input.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat empty.json
[]
$ bun src/cli.ts empty.json --as-of 2026-02-20
TOTAL		0.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa10-sample-reversed-input.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat samples-reversed.json
[
  {
    "id": "INV-4",
    "amountCents": 20000,
    "dueDate": "2026-02-10"
  },
  {
    "id": "INV-3",
    "amountCents": 50000,
    "dueDate": "2025-12-01"
  },
  {
    "id": "INV-2",
    "amountCents": 10000,
    "dueDate": "2026-01-12"
  },
  {
    "id": "INV-1",
    "amountCents": 10000,
    "dueDate": "2026-01-10"
  }
]
$ bun src/cli.ts samples-reversed.json --as-of 2026-02-20
INV-3	2025-12-01	20.00
INV-1	2026-01-10	2.00
INV-2	2026-01-12	2.00
TOTAL		24.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa11-usage-error.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ bun src/cli.ts samples/invoices.json
usage: bun src/cli.ts <invoices.json> --as-of YYYY-MM-DD
exit=2

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa12-bun-test.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ bun test
bun test v1.4.4 (5d9cc0f4f)

 7 pass
 0 fail
 11 expect() calls
Ran 7 tests across 2 files. [4.00ms]
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa13-equal-fee-equal-date-reversed-ids.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat equal-fee-equal-date.json
[{ "id": "B", "amountCents": 10000, "dueDate": "2026-01-10" }, { "id": "A", "amountCents": 10000, "dueDate": "2026-01-10" }]
$ bun src/cli.ts equal-fee-equal-date.json --as-of 2026-02-20
A	2026-01-10	2.00
B	2026-01-10	2.00
TOTAL		4.00
exit=0

----- .omp/team-config/evidence/gate/late-fee-report/f1/wave-2/qa14-equal-fees-ids-oppose-dates.txt -----
$ git rev-parse HEAD
951b31abca24010414cc0f6975f74b5e1700bbb0
$ cat equal-fees-ids-oppose-dates.json
[{ "id": "A-LATER", "amountCents": 10000, "dueDate": "2026-01-12" }, { "id": "Z-EARLIER", "amountCents": 10000, "dueDate": "2026-01-10" }]
$ bun src/cli.ts equal-fees-ids-oppose-dates.json --as-of 2026-02-20
Z-EARLIER	2026-01-10	2.00
A-LATER	2026-01-12	2.00
TOTAL		4.00
exit=0

- Author-supplied behavioural criteria: Criterion C1 (spec Requirement: Late fee per invoice)
Invariant:        an invoice's late fee is 2% of its amount for each complete 30-day period overdue at the as-of date, counted in UTC calendar days, capped at 25% of the amount, in whole cents rounded down.
Positive witness: 10000 cents due 2026-01-10 as of 2026-02-15 gives 200 cents; 10000 cents more than a year overdue gives 2500 cents.
Negative control: an invoice only 29 days overdue gets a fee above 0 cents.
Observable:       the fee printed on that invoice's report line, or the absence of a line, from `bun src/cli.ts <file> --as-of <date>`.
Boundary:         rendered CLI report (lateFee through buildReport and renderReport).

Criterion C2 (spec Requirement: Overdue report ordering)
Invariant:        the report lists only invoices with a fee above zero, ordered by fee descending, equal fees by due date ascending, followed by the total of the listed fees, and the order does not depend on the order of the input file.
Positive witness: two invoices of equal fee due 2026-01-10 and 2026-01-12 print the 2026-01-10 invoice first in either input order; a 1000-cent invoice prints before a 200-cent one.
Negative control: a report line for a 0-cent invoice, or equal-fee lines that follow the input order.
Observable:       line order and TOTAL of the rendered report for permutations of the same invoices.
Boundary:         rendered CLI report.

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
