Complete assignment thoroughly:

Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract:
GOAL: Finance needs a `report` command that lists overdue invoices with the late fee each has accrued, so reminders can be sent with the amount owed (OpenSpec change `late-fee-report`, capability `late-fees`).
BEHAVIOURAL CONTRACT (openspec/changes/late-fee-report/specs/late-fees/spec.md): an invoice overdue at the as-of date accrues 2% of its amount per complete 30-day period overdue, capped at 25%, in whole cents rounded down; days overdue are counted in UTC calendar days. The overdue report lists only invoices with a fee above zero, by fee descending, equal fees by due date ascending, followed by a total of all listed fees, independent of input order.
CONSTRAINTS (design.md): integer-cent arithmetic only, no floating point in the money path; dates are `YYYY-MM-DD` UTC calendar dates parsed by hand; the report sorts a derived list and never mutates the input. Non-goals: currency conversion, persistence, input schema validation beyond what the report needs; malformed dates are not diagnosed (finance exports are machine generated).
BACKGROUND: new standalone Bun/TypeScript project with no existing consumers (proposal.md: "No existing behaviour changes"). gate.md: Mandatory class none, Depth standard, Risk tier product; author's risk assessment: finance sends reminders with the listed fee amounts, so a wrong fee or wrong ordering misleads customers about what they owe; no money moves automatically. Run command: `bun src/cli.ts <invoices.json> --as-of YYYY-MM-DD` (package.json script `report`); tests: `bun test`.

- Changed files and reviewed diff:
DIFF_RANGE: 7c09518d3c7862ed6cc7ce68289b1493299bf9ad...e5a6dbdc43c4a1286e062c9dccfea6ae11d6c69c (merge-base with `main` ... reviewed head on branch feat/late-fee-report)
Changed files:
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

Reviewed diff (git diff 7c09518d3c7862ed6cc7ce68289b1493299bf9ad...e5a6dbdc43c4a1286e062c9dccfea6ae11d6c69c):
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
index 0000000..7c76f60
--- /dev/null
+++ b/openspec/changes/late-fee-report/tasks.md
@@ -0,0 +1,22 @@
+# Tasks
+
+## 1. Fee calculation
+
+- [x] 1.1 Add `src/invoice.ts` and `src/fee.ts` with `lateFee` and its tests. Verify: `bun test src/fee.test.ts`
+
+## 2. Report
+
+- [x] 2.1 Add `src/report.ts`, `src/cli.ts`, `samples/invoices.json` and the report tests. Verify: `bun test src/report.test.ts && bun src/cli.ts samples/invoices.json --as-of 2026-02-20`
+
+## 3. Final verification
+
+- [x] 3.1 F1. Manual QA on the real surface: run the `report` command against `samples/invoices.json` and against inputs the QA lane builds, exercising the fee and ordering requirements; evidence in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/late-fee-report/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -d .omp/team-config/evidence/gate/late-fee-report`
+
+## TODOs
+
+- [x] 4.1 F2 wave 1 QA3: count days overdue in UTC calendar days in `src/invoice.ts` (`Date.UTC` instead of local-time `new Date(y, m - 1, d)`), so an interval across a DST change in the runner's zone is not floored to one day less; regression test in `src/fee.test.ts` evaluates 2026-03-01 to 2026-03-31 with `process.env.TZ` set to a DST zone. Verify: `bun test src/fee.test.ts`
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
index 0000000..8e88153
--- /dev/null
+++ b/src/fee.test.ts
@@ -0,0 +1,27 @@
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
+
+test("days overdue are UTC calendar days across a DST change in the runner's zone", () => {
+  const zone = process.env.TZ;
+  process.env.TZ = "Europe/Berlin"; // clocks go forward on 2026-03-29
+  try {
+    expect(lateFee(inv("2026-03-01"), "2026-03-31")).toBe(200);
+  } finally {
+    if (zone === undefined) delete process.env.TZ;
+    else process.env.TZ = zone;
+  }
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
index 0000000..b0802cb
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
+function startOfDay(date: string): number {
+  const [y, m, d] = date.split("-").map(Number);
+  return Date.UTC(y, m - 1, d);
+}
+
+export function daysOverdue(invoice: Invoice, asOf: string): number {
+  return Math.max(0, Math.floor((startOfDay(asOf) - startOfDay(invoice.dueDate)) / DAY_MS));
+}
diff --git a/src/report.test.ts b/src/report.test.ts
new file mode 100644
index 0000000..58fdbcf
--- /dev/null
+++ b/src/report.test.ts
@@ -0,0 +1,33 @@
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
+test("equal fees are listed by earlier due date", () => {
+  const report = buildReport(
+    [
+      { id: "later", amountCents: 10000, dueDate: "2026-01-12" },
+      { id: "earlier", amountCents: 10000, dueDate: "2026-01-10" },
+    ],
+    AS_OF,
+  );
+  expect(report.lines.map(l => l.id)).toEqual(["earlier", "later"]);
+});
diff --git a/src/report.ts b/src/report.ts
new file mode 100644
index 0000000..da7a52a
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
+/** Invoices with a fee, highest fee first, equal fees by earlier due date. */
+export function buildReport(invoices: Invoice[], asOf: string): Report {
+  const lines = invoices
+    .map(inv => ({ id: inv.id, dueDate: inv.dueDate, feeCents: lateFee(inv, asOf) }))
+    .filter(line => line.feeCents > 0)
+    .sort((a, b) => b.feeCents - a.feeCents || (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
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

- Repository context and plan:
FILE PATHS (workspace root /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r2/.worktrees/review-late-fee-report; every changed file above plus neighbours): src/invoice.ts, src/fee.ts, src/report.ts, src/cli.ts, src/fee.test.ts, src/report.test.ts, samples/invoices.json, package.json, tsconfig.json, .gitignore, openspec/config.yaml, openspec/changes/late-fee-report/ (proposal.md, design.md, gate.md, tasks.md, review.md, specs/late-fees/spec.md).
CONTEXT_MINING (source -> finding -> why it matters):
- git log of changed paths -> four commits on the base (7c09518 chore base project, 85f3b75 change docs, 358f9c5 late fee, 6d8a0da report command) plus this gate's fix round (eeb867d fix row 4.1, 5cf07eb fix, e5a6dbd F1 checkbox) -> greenfield code, no prior consumer to regress.
- git log --all --grep fee/report/overdue -> only the same commits; no reverts -> no earlier attempt to compare with.
- gh issues/PRs -> not available (repository has no remote) -> no tracker context.
- rg TODO|FIXME|HACK in src samples -> none.
- F2 wave 1 manual QA (.omp/team-config/evidence/gate/late-fee-report/wave-1/qa3-utc-calendar-days.txt) -> at 6d8a0da, `startOfDay` used local-time `new Date(y, m - 1, d)`; an invoice due 2026-03-01 evaluated 2026-03-31 (30 UTC days) printed no line and TOTAL 0.00 under the system zone Europe/Berlin and America/New_York, 2.00 under TZ=UTC -> violated "Days overdue are counted in UTC calendar days"; fixed by tasks.md row 4.1 in 5cf07eb (`Date.UTC`), regression test src/fee.test.ts seen failing (Expected 200, Received 0) on the unfixed source before the fix; fix delta reviewed by plan-reviewer: OKAY, no blockers.
- `validate-openspec-change.mjs --reviewed openspec/changes/late-fee-report` -> exit 1 "review.md: stale" after the F2 fix row 4.1 was added (it passed at 6d8a0da) -> the planning review digest predates the fix row; review.md was not edited.
- node_modules absent -> `bun-types` unresolved for tsc/LSP (`bun:test`, `process` unknown in every file, pre-existing) -> typecheck is not part of the evidence.
PLAN (the OpenSpec change folder openspec/changes/late-fee-report, as the immutable wave-2 plan copy /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r2/.worktrees/review-late-fee-report/.omp/team-config/gate-deltas/F2-9c6da0f3c5f8-wave-2.plan.md, verbatim):
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
cb14d99280798b4b00d7f70b12051bdbc33ad014a779512fab4eb0d4e1974af1  design.md
e5bf9e7041dc133d8d3eb0e519002585ea75bcebb477fc17f692c24cd68d6f89  gate.md
4aaa439f8dcf42540d1f70cee1ea875d5e2d094279a6dabfed7147056b47c4f9  proposal.md
90a847f20f8673f91a930f0ac8ab21d457570def5dc716e580f2b5eb86105afa  review.md
66407da93cbc5061aa6e8f7e1aeacd5abd1ee98c309c948a22467a42989ff76a  specs/late-fees/spec.md
1ab4a56c191011b6a614a181bb0f89115d05893fd8f47465faea35c040b988ac  tasks.md
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

## 3. Final verification

- [x] 3.1 F1. Manual QA on the real surface: run the `report` command against `samples/invoices.json` and against inputs the QA lane builds, exercising the fee and ordering requirements; evidence in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/late-fee-report/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -d .omp/team-config/evidence/gate/late-fee-report`

## TODOs

- [x] 4.1 F2 wave 1 QA3: count days overdue in UTC calendar days in `src/invoice.ts` (`Date.UTC` instead of local-time `new Date(y, m - 1, d)`), so an interval across a DST change in the runner's zone is not floored to one day less; regression test in `src/fee.test.ts` evaluates 2026-03-01 to 2026-03-31 with `process.env.TZ` set to a DST zone. Verify: `bun test src/fee.test.ts`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
- Manual QA matrix and artifacts:
Wave 2 reuses the F1 captures (tasks.md 3.1) taken on 5cf07eb485968a2be4ccd1374f24a5e9e3a68b4f, the head after the last code commit; each row is carried across e5a6dbd, which only ticks the 3.1 checkbox in tasks.md and changes nothing the report reads. Channel: real CLI `bun src/cli.ts` on synthetic fixtures (bun 1.4.4, system zone Europe/Berlin). All artifacts are text transcripts below .omp/team-config/evidence/gate/late-fee-report/f1/.

|#|Scenario|Exact command / action|Expected|Observed|Verdict|Artifact|
|---|---|---|---|---|---|---|
|QA1|Happy path: sample file|`bun src/cli.ts samples/invoices.json --as-of 2026-02-20`, system zone and `env TZ=UTC`|INV-3 20.00, INV-1 2.00, INV-2 2.00, INV-4 absent, TOTAL 24.00|exactly that in both zones|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/qa1-happy-path.txt|
|QA2|Fee requirement: one period, cap, 29-day negative control, 30/60-day boundaries, round-down, not yet due|fixture of 7 invoices, `bun src/cli.ts fee.json --as-of 2026-02-15`, system zone and TZ=UTC|CAP 25.00, DAY60 4.00, ROUND (12345c) 2.46, ONE-PERIOD 2.00, DAY30 2.00, DAY29 and NOT-DUE absent, TOTAL 35.46|exactly that in both zones|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/qa2-fee-rules.txt|
|QA3|Riskiest edge: UTC calendar days across DST|due 2026-03-01 as of 2026-03-31 under system zone, TZ=Europe/Berlin, TZ=America/New_York, TZ=UTC; due 2026-10-02 as of 2026-10-31 (29 days, autumn change) system zone and TZ=UTC|spring: SPRING-30D 2.00 in every zone; autumn: no line, TOTAL 0.00|spring 2.00 in all four zones; autumn TOTAL 0.00 in both (wave 1 at 6d8a0da: spring 0.00 in Berlin/New York, FAIL)|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/qa3-utc-calendar-days.txt|
|QA4|Ordering requirement: fee desc, equal fees by earlier due date in both input orders, zero-fee negative control, empty input|fixtures order-a/order-b (same 4 invoices, different order), none.json, empty.json, `--as-of 2026-02-20`|both orders: BIG 10.00, EARLIER 2.00, LATER 2.00, no ZERO line, TOTAL 14.00; no-fee and empty inputs: only TOTAL 0.00|exactly that|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/qa4-report-ordering.txt|
|QA5|Regression: CLI usage contract, unit suite, input untouched|`bun src/cli.ts samples/invoices.json` (no flag), `--asof` typo, `bun test`, `git status --porcelain -- samples src`|usage message, exit 2 twice; suite green; no file changes|usage + exit 2 twice; 7 pass 0 fail; empty status|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/qa5-cli-regression.txt|

Wave 1 (6d8a0da) matrix for history: QA1, QA2, QA4, QA5 PASS; QA3 FAIL (artifacts .omp/team-config/evidence/gate/late-fee-report/wave-1/).

- Author-supplied behavioural criteria:
C1 (spec Requirement: Late fee per invoice)
Invariant:        lateFee equals floor(amountCents * min(2 * floor(UTC calendar days overdue / 30), 25) / 100) and is 0 when not overdue.
Positive witness: 10000 cents due 2026-01-10 as of 2026-02-15 -> 200; 10000 cents more than a year overdue -> 2500.
Negative control: an invoice only 29 days overdue with a fee above 0 cents MUST fail.
Observable:       the fee printed by `bun src/cli.ts` for the invoice (or its absence) and the `lateFee` return value.
Boundary:         `lateFee` return value and the rendered report line.

C2 (spec Requirement: Overdue report ordering)
Invariant:        the report lists only invoices with fee > 0, by fee descending, equal fees by due date ascending, then a total equal to the sum of listed fees, for any input order.
Positive witness: a 1000-cent and a 200-cent invoice list the 1000-cent one first; two equal fees list the earlier due date first in either input order.
Negative control: a report line for an invoice with a late fee of 0 cents MUST fail.
Observable:       order and content of stdout lines of `bun src/cli.ts` for permuted inputs.
Boundary:         `buildReport(...).lines` and the rendered stdout.
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
