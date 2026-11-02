Complete assignment thoroughly:

Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: GOAL (proposal.md): Finance needs a command that lists overdue invoices with the late fee each has accrued, so reminders can be sent with the amount owed. Add a late fee calculation (2% of the invoice amount per complete 30-day period overdue, capped at 25%, whole cents rounded down) and an overdue report that lists invoices with a fee, ordered by fee, with a total, plus a `report` command that prints it for an invoices JSON file as of a given or the current UTC date.
CONSTRAINTS (design.md, gate.md): integer-cent arithmetic only; dates are UTC calendar dates; the report is deterministic for any input order and never mutates the input array; ties break by due date, then id (total order); without `--as-of` the command evaluates as of today's UTC date. Non-goals: currency conversion, persistence, input-file schema validation beyond what the report needs; malformed dates are not diagnosed (finance exports are machine generated). Gate: Mandatory class none, Depth standard, Risk tier product, Accepted residual risks none, Out of scope for blocking none.
BACKGROUND: new standalone Bun/TypeScript project with no existing consumers. Author's risk assessment (gate.md): Finance sends reminders with the listed fee amounts, so a wrong fee or wrong ordering misleads customers about what they owe; no money moves automatically and no protected asset is touched.
Reviewed range: diff_base 7c09518d3c7862ed6cc7ce68289b1493299bf9ad (main) .. reviewed head 145e0c2d914492ca69891951f776e2e472fcf8e9 (branch feat/late-fee-report).
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
src/today.test.ts
src/today.ts

Diff (git diff main...HEAD):
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
index 0000000..032cfbb
--- /dev/null
+++ b/openspec/changes/late-fee-report/design.md
@@ -0,0 +1,24 @@
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
+- The report sorts a derived list of lines; the input array is never mutated. Ties break by due date, then by id, so the order is total.
+- Without `--as-of` the command evaluates as of today's UTC date.
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
index 0000000..6db7c45
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
+- Add an overdue report that lists invoices with a fee, ordered by fee, with a total, and a `report` command that prints it for an invoices JSON file as of a given or the current UTC date.
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
+New files under `src/` (`invoice.ts`, `fee.ts`, `report.ts`, `today.ts`, `cli.ts`) and `samples/invoices.json`. No existing behaviour changes.
diff --git a/openspec/changes/late-fee-report/review.md b/openspec/changes/late-fee-report/review.md
new file mode 100644
index 0000000..447fd33
--- /dev/null
+++ b/openspec/changes/late-fee-report/review.md
@@ -0,0 +1,19 @@
+# Review
+
+- **Verdict**: OKAY
+- **Reviewed digest**: 4e629d43d0d7f8c1d176f9de1dae3ff00943f8c140382171dc534942b4469417
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
index 0000000..393d2c6
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
+### Requirement: Overdue report
+The overdue report SHALL list only invoices with a late fee above zero, ordered by late fee descending, then by due date ascending (earlier first), then by invoice id ascending in plain code-unit string order, followed by a total of all listed fees. The order SHALL NOT depend on the order of the input file. When the `report` command is given no `--as-of` date, the as-of date SHALL be today's date in UTC.
+
+#### Scenario: Equal fees
+- **WHEN** two listed invoices have equal late fees, in any input order
+- **THEN** the one with the earlier due date is listed first, and equal due dates are ordered by id
+
+#### Scenario: Default as-of date
+- **WHEN** the command runs without `--as-of` at 2026-03-01T23:30:00Z
+- **THEN** the as-of date used is 2026-03-01
+
+#### Scenario: Negative control
+- **WHEN** an invoice has a late fee of 0 cents
+- **THEN** a report line for it MUST fail this requirement
diff --git a/openspec/changes/late-fee-report/tasks.md b/openspec/changes/late-fee-report/tasks.md
new file mode 100644
index 0000000..4e42943
--- /dev/null
+++ b/openspec/changes/late-fee-report/tasks.md
@@ -0,0 +1,23 @@
+# Tasks
+
+## 1. Fee calculation
+
+- [x] 1.1 Add `src/invoice.ts` and `src/fee.ts` with `lateFee` and its tests. Verify: `bun test src/fee.test.ts`
+
+## 2. Report
+
+- [x] 2.1 Add `src/report.ts`, `src/today.ts`, `src/cli.ts`, `samples/invoices.json` and the report and date tests. Verify: `bun test src/report.test.ts src/today.test.ts && bun src/cli.ts samples/invoices.json --as-of 2026-02-20`
+
+## 3. Final verification
+
+- [x] 3.1 F1. Manual QA on the real surface: run the `report` command against `samples/invoices.json` and against inputs the QA lane builds, exercising the fee and ordering requirements; evidence in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/late-fee-report/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -d .omp/team-config/evidence/gate/late-fee-report`
+
+## TODOs
+
+- [x] 4.1 F2 wave 1 QA3: count days overdue in UTC calendar days in `src/invoice.ts` (`Date.UTC` instead of local-time `new Date(y, m - 1, d)`), so an interval across a DST change in the runner's zone is not floored to one day less; regression test in `src/fee.test.ts` evaluates 2026-03-01 to 2026-03-31 with `process.env.TZ` set to a DST zone. Verify: `bun test src/fee.test.ts`
+- [x] 4.2 F2 wave 1 QA4: the `report` command's default as-of date is the UTC calendar date in `src/today.ts` (`toISOString().slice(0, 10)` instead of the runner's local date from `toLocaleDateString`), so a run without `--as-of` in a zone whose date differs from UTC (Europe/Berlin at 2026-03-01T23:30:00Z) evaluates as of 2026-03-01; the zone-dependent local-noon test in `src/today.test.ts` is replaced by a regression test that evaluates 2026-03-01T23:30:00Z with `process.env.TZ` set to Europe/Berlin and Pacific/Kiritimati. Verify: `bun test src/today.test.ts`
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
index 0000000..9b63839
--- /dev/null
+++ b/src/cli.ts
@@ -0,0 +1,13 @@
+import { readFileSync } from "node:fs";
+import type { Invoice } from "./invoice";
+import { buildReport, renderReport } from "./report";
+import { today } from "./today";
+
+const [file, flag, date] = process.argv.slice(2);
+if (!file || (flag !== undefined && (flag !== "--as-of" || !date))) {
+  console.error("usage: bun src/cli.ts <invoices.json> [--as-of YYYY-MM-DD]");
+  process.exit(2);
+}
+const asOf = flag === "--as-of" ? date : today();
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
index 0000000..0ce7895
--- /dev/null
+++ b/src/report.test.ts
@@ -0,0 +1,32 @@
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
+test("equal fees are listed by due date, then id", () => {
+  const invoices = [
+    { id: "b", amountCents: 10000, dueDate: "2026-01-12" },
+    { id: "z", amountCents: 10000, dueDate: "2026-01-10" },
+    { id: "a", amountCents: 10000, dueDate: "2026-01-12" },
+  ];
+  expect(buildReport(invoices, AS_OF).lines.map(l => l.id)).toEqual(["z", "a", "b"]);
+  expect(buildReport([...invoices].reverse(), AS_OF).lines.map(l => l.id)).toEqual(["z", "a", "b"]);
+});
+
+test("invoice without a fee is not listed", () => {
+  const report = buildReport([{ id: "fresh", amountCents: 10000, dueDate: "2026-02-10" }], AS_OF);
+  expect(report.lines).toEqual([]);
+  expect(report.totalCents).toBe(0);
+});
diff --git a/src/report.ts b/src/report.ts
new file mode 100644
index 0000000..08da29b
--- /dev/null
+++ b/src/report.ts
@@ -0,0 +1,39 @@
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
+function compareText(a: string, b: string): number {
+  return a < b ? -1 : a > b ? 1 : 0;
+}
+
+/** Invoices with a fee: highest fee first, then earlier due date, then id. */
+export function buildReport(invoices: Invoice[], asOf: string): Report {
+  const lines = invoices
+    .map(inv => ({ id: inv.id, dueDate: inv.dueDate, feeCents: lateFee(inv, asOf) }))
+    .filter(line => line.feeCents > 0)
+    .sort(
+      (a, b) =>
+        b.feeCents - a.feeCents || compareText(a.dueDate, b.dueDate) || compareText(a.id, b.id),
+    );
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
diff --git a/src/today.test.ts b/src/today.test.ts
new file mode 100644
index 0000000..439d0bf
--- /dev/null
+++ b/src/today.test.ts
@@ -0,0 +1,15 @@
+import { expect, test } from "bun:test";
+import { today } from "./today";
+
+test("the default as-of date is the UTC calendar date, not the runner's local date", () => {
+  const zone = process.env.TZ;
+  try {
+    for (const runnerZone of ["Europe/Berlin", "Pacific/Kiritimati"]) {
+      process.env.TZ = runnerZone; // local date is already 2026-03-02 at this instant
+      expect(today(new Date("2026-03-01T23:30:00Z"))).toBe("2026-03-01");
+    }
+  } finally {
+    if (zone === undefined) delete process.env.TZ;
+    else process.env.TZ = zone;
+  }
+});
diff --git a/src/today.ts b/src/today.ts
new file mode 100644
index 0000000..936d524
--- /dev/null
+++ b/src/today.ts
@@ -0,0 +1,4 @@
+/** The as-of date used when the command is given none: today's UTC calendar date, as YYYY-MM-DD. */
+export function today(now: Date = new Date()): string {
+  return now.toISOString().slice(0, 10);
+}

- Repository context and plan: Repository root (read-only for you): /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r3-review
Files to read there: openspec/changes/late-fee-report/.openspec.yaml, openspec/changes/late-fee-report/design.md, openspec/changes/late-fee-report/gate.md, openspec/changes/late-fee-report/proposal.md, openspec/changes/late-fee-report/review.md, openspec/changes/late-fee-report/specs/late-fees/spec.md, openspec/changes/late-fee-report/tasks.md, samples/invoices.json, src/cli.ts, src/fee.test.ts, src/fee.ts, src/invoice.ts, src/report.test.ts, src/report.ts, src/today.test.ts, src/today.ts; also package.json, tsconfig.json, openspec/config.yaml.
Context mining (source -> finding -> why it matters):
- git log --oneline -20 per changed file -> every changed file was introduced on this branch (6ce7d26 change folder, 39d8a22 fee, a0ccec2 report/command, 145e0c2 F2 fix 4.2); no earlier history, reverts or prior reasons -> no legacy behaviour to preserve.
- git log --all --grep fee/report/UTC/today -> only this branch's commits -> no related or reverted work elsewhere.
- gh issue/PR search -> repository has no git remote -> no tracker context exists.
- grep TODO|FIXME|HACK in src/ -> none.
- importers -> src/cli.ts imports report.ts, today.ts, invoice.ts (type); report.ts imports fee.ts; fee.ts imports invoice.ts; nothing else consumes these modules (design.md: no existing consumers).
- tasks.md TODO 4.1 -> an earlier fix moved daysOverdue to Date.UTC so a DST change in the runner's zone cannot drop a day -> the UTC-calendar-day contract is a known failure area.
- F2 wave 1 of this gate (head a0ccec2) -> QA4 FAILED: without --as-of the command used the runner's local date (toLocaleDateString) instead of the UTC date; fix row 4.2 committed as 145e0c2 (today() -> toISOString().slice(0, 10), regression test under Europe/Berlin and Pacific/Kiritimati), RED observed before the fix ("Received: 2026-03-02"), fix delta reviewed by plan-reviewer: OKAY.
- environment -> no node_modules/bun-types installed, so tsc/LSP report unresolved `bun:test` and `process` in tests (pre-existing tooling gap, same in src/fee.test.ts); `bun test` runs.
- tasks.md 3.1 names an `f1/` evidence directory; this gate's manual QA captures live under .omp/team-config/evidence/gate/late-fee-report/wave-1/ and wave-2/ as review-work prescribes.

PLAN (the OpenSpec change folder as bound by plan_sha256; bundle copy given to this wave, verbatim):
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
8e2a963811e5c91f090ccbbd138964b9feee0269325d764c6330c308ad31cd7e  design.md
e5bf9e7041dc133d8d3eb0e519002585ea75bcebb477fc17f692c24cd68d6f89  gate.md
c4001594e5c96f17c5cb903745a4f28ef4050e4adaf0f905959e03e8def5defb  proposal.md
dbc83788490a4f2cb17c5b17d1f60e42941f34ad2a5cd3b5af40d65f701d20b3  review.md
a50c4ae0662d08924654ef043e9900b8345c7cc926829821dbd2e4e4ea71f2c5  specs/late-fees/spec.md
ad7faeca74cda65c83c61ac14d4c0e14144b0f9e4d5c63161350a66bc121be62  tasks.md
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
- The report sorts a derived list of lines; the input array is never mutated. Ties break by due date, then by id, so the order is total.
- Without `--as-of` the command evaluates as of today's UTC date.

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
- Add an overdue report that lists invoices with a fee, ordered by fee, with a total, and a `report` command that prints it for an invoices JSON file as of a given or the current UTC date.

## Capabilities

### New Capabilities
- `late-fees`: fee calculation per invoice and the ordered overdue report.

### Modified Capabilities

## Impact

New files under `src/` (`invoice.ts`, `fee.ts`, `report.ts`, `today.ts`, `cli.ts`) and `samples/invoices.json`. No existing behaviour changes.

===== review.md =====
# Review

- **Verdict**: OKAY
- **Reviewed digest**: 4e629d43d0d7f8c1d176f9de1dae3ff00943f8c140382171dc534942b4469417
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

### Requirement: Overdue report
The overdue report SHALL list only invoices with a late fee above zero, ordered by late fee descending, then by due date ascending (earlier first), then by invoice id ascending in plain code-unit string order, followed by a total of all listed fees. The order SHALL NOT depend on the order of the input file. When the `report` command is given no `--as-of` date, the as-of date SHALL be today's date in UTC.

#### Scenario: Equal fees
- **WHEN** two listed invoices have equal late fees, in any input order
- **THEN** the one with the earlier due date is listed first, and equal due dates are ordered by id

#### Scenario: Default as-of date
- **WHEN** the command runs without `--as-of` at 2026-03-01T23:30:00Z
- **THEN** the as-of date used is 2026-03-01

#### Scenario: Negative control
- **WHEN** an invoice has a late fee of 0 cents
- **THEN** a report line for it MUST fail this requirement

===== tasks.md =====
# Tasks

## 1. Fee calculation

- [x] 1.1 Add `src/invoice.ts` and `src/fee.ts` with `lateFee` and its tests. Verify: `bun test src/fee.test.ts`

## 2. Report

- [x] 2.1 Add `src/report.ts`, `src/today.ts`, `src/cli.ts`, `samples/invoices.json` and the report and date tests. Verify: `bun test src/report.test.ts src/today.test.ts && bun src/cli.ts samples/invoices.json --as-of 2026-02-20`

## 3. Final verification

- [x] 3.1 F1. Manual QA on the real surface: run the `report` command against `samples/invoices.json` and against inputs the QA lane builds, exercising the fee and ordering requirements; evidence in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/late-fee-report/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -d .omp/team-config/evidence/gate/late-fee-report`

## TODOs

- [x] 4.1 F2 wave 1 QA3: count days overdue in UTC calendar days in `src/invoice.ts` (`Date.UTC` instead of local-time `new Date(y, m - 1, d)`), so an interval across a DST change in the runner's zone is not floored to one day less; regression test in `src/fee.test.ts` evaluates 2026-03-01 to 2026-03-31 with `process.env.TZ` set to a DST zone. Verify: `bun test src/fee.test.ts`
- [x] 4.2 F2 wave 1 QA4: the `report` command's default as-of date is the UTC calendar date in `src/today.ts` (`toISOString().slice(0, 10)` instead of the runner's local date from `toLocaleDateString`), so a run without `--as-of` in a zone whose date differs from UTC (Europe/Berlin at 2026-03-01T23:30:00Z) evaluates as of 2026-03-01; the zone-dependent local-noon test in `src/today.test.ts` is replaced by a regression test that evaluates 2026-03-01T23:30:00Z with `process.env.TZ` set to Europe/Berlin and Pacific/Kiritimati. Verify: `bun test src/today.test.ts`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
- Manual QA matrix and artifacts: Manual QA run by the orchestrator on the real CLI (`bun src/cli.ts`) in a real pty (`script -q`), runner zone Europe/Berlin, on head 145e0c2d914492ca69891951f776e2e472fcf8e9 (wave 2). Fixtures are disposable JSON files printed in each transcript. Artifacts are repo-relative to the repository root.

|#|Scenario|Exact command / action|Expected|Observed|Verdict|Artifact|
|---|---|---|---|---|---|---|
|QA1|Happy path: sample invoices|`bun src/cli.ts samples/invoices.json --as-of 2026-02-20`|INV-3 20.00, INV-1 2.00, INV-2 2.00 (equal fee, earlier due first), INV-4 (10 days) omitted, TOTAL 24.00|exactly that, exit 0|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa-happy.txt|
|QA2|Requirement "Late fee per invoice": 29 vs 30 days, round-down, cap, not yet due, leap year, DST in runner zone|`bun src/cli.ts boundaries.json --as-of 2026-02-08`; `env TZ=Europe/Berlin` and `TZ=America/New_York` `bun src/cli.ts dst.json --as-of 2026-03-31`; Berlin `--as-of 2026-03-30`|D29 omitted (0), D30 2.00, ROUND 12345c -> 2.46, CAP 25.00, FUTURE omitted, LEAP 25.00; DST 30 days -> 2.00 in both zones, 29 days -> omitted|LEAP 25.00, CAP 25.00, ROUND 2.46, D30 2.00, TOTAL 54.46; DST 2.00/2.00; 29 days TOTAL 0.00|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa-fee.txt|
|QA3|Requirement "Overdue report": fee desc, due date asc, id code-unit order, zero fee omitted, input order independence|`bun src/cli.ts order.json --as-of 2026-02-20` and the same on `order-reversed.json`|big 18.00, late 2.00, then B, INV-10, INV-9, b at 2.00; zero omitted; TOTAL 28.00; identical for reversed input|identical output for both inputs, exactly as expected|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa-order.txt|
|QA4|Requirement "Overdue report": default as-of is today's UTC date (riskiest edge: runner local date differs from UTC date)|real clock 2026-11-02T21:11Z (UTC date 11-02, Kiritimati local 11-03); fixture DUE-29D-UTC (due 10-04), DUE-30D-UTC (due 10-03); `bun src/cli.ts default-asof.json` with no --as-of under TZ=UTC, Europe/Berlin, Pacific/Kiritimati; plus `today(new Date("2026-03-01T23:30:00Z"))` under TZ=Europe/Berlin and UTC|all three zones list only DUE-30D-UTC 2.00, TOTAL 2.00 (same as explicit --as-of 2026-11-02); today() -> 2026-03-01 in both zones|exactly that|PASS (FAILED in wave 1 on a0ccec2: Kiritimati listed DUE-29D-UTC and Berlin today() gave 2026-03-02; fixed by 4.2)|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa-default-asof.txt|
|QA5|Edge: empty input and malformed arguments|`bun src/cli.ts empty.json --as-of 2026-02-20`; `bun src/cli.ts`; `... --as-of` without date; `... --since 2026-02-20`|`TOTAL\t\t0.00` exit 0; usage line on stderr, exit 2 for each malformed call|exactly that|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa-edge.txt|
|QA6|Regression: whole unit suite on the fixed tree|`bun test`|all tests pass|8 pass, 0 fail, 12 expect() calls, 3 files|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa-regression.txt|

Wave 1 artifacts (head a0ccec2, QA4 failing) are under .omp/team-config/evidence/gate/late-fee-report/wave-1/. No row is carried: every row was re-run on 145e0c2d9144. Not exercised: the CLI process itself at a real 23:00-24:00 UTC clock in Europe/Berlin (the CLI path was exercised with a real local/UTC date split via Pacific/Kiritimati, and the spec's exact instant through the today() function the CLI calls).
- Author-supplied behavioural criteria: Author-supplied criteria (from specs/late-fees/spec.md, one per requirement, five fields):
C1 Late fee per invoice
Invariant:        an invoice overdue at the as-of date accrues 2% of its amount per complete 30-day period overdue, capped at 25%, in whole cents rounded down, with days counted in UTC calendar days.
Positive witness: 10000 cents due 2026-01-10 evaluated as of 2026-02-15 -> 200 cents; 10000 cents more than a year overdue -> 2500 cents.
Negative control: an invoice only 29 days overdue with any late fee above 0 cents MUST fail.
Observable:       the fee column of the `report` command and lateFee() results for the boundary inputs.
Boundary:         lateFee() / daysOverdue() and the rendered report line.
C2 Overdue report
Invariant:        the report lists only invoices with a late fee above zero, ordered by fee descending, then due date ascending, then id ascending in plain code-unit order, followed by a total of the listed fees; the order does not depend on input order; without --as-of the as-of date is today's date in UTC.
Positive witness: two listed invoices with equal fees in any input order -> earlier due date first, equal due dates by id; run without --as-of at 2026-03-01T23:30:00Z -> as-of 2026-03-01.
Negative control: a report line for an invoice with a late fee of 0 cents MUST fail.
Observable:       stdout of the `report` command for permuted inputs and for runs without --as-of.
Boundary:         buildReport()/renderReport() output and the CLI's as-of selection.

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
