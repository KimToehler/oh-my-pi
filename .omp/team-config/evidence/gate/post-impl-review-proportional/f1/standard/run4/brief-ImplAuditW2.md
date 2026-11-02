Complete assignment thoroughly:

Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: GOAL (proposal.md): Finance needs a command that lists overdue invoices with the late fee each has accrued, so reminders can be sent with the amount owed. Late fee: 2% of the invoice amount per complete 30-day period overdue, capped at 25%, in whole cents rounded down; days overdue in UTC calendar days. Overdue report: only invoices with a fee above zero, ordered by fee descending, then due date ascending, then id ascending in plain code-unit string order, with a total of listed fees; order independent of input order; a `report` command printing it for an invoices JSON file as of `--as-of YYYY-MM-DD` or, without it, today's UTC date.
CONSTRAINTS (design.md, gate.md): integer-cent arithmetic only, no floating point in the money path; UTC calendar dates; input array never mutated; total sort order (fee, due date, id). Non-goals: currency conversion, persistence, input schema validation beyond what the report needs; malformed dates are not diagnosed (finance exports are machine generated). Mandatory class: none; Depth: standard; Risk tier: product; Accepted residual risks: none; Out of scope for blocking: none.
BACKGROUND: New standalone Bun/TypeScript project with no existing consumers. Finance sends reminders with the listed fee amounts, so a wrong fee or wrong ordering misleads customers about what they owe; no money moves automatically. F2 wave 1 manual QA failed QA3: the capped fee used Math.round (10002 cents -> 2501, 3 cents -> listed 1-cent fee); fix row 4.2 (commit b5e75eb50c865195adff06ec2ffae8f115084ee8, `Math.floor`, regression test) was delta-reviewed OKAY by plan-reviewer. This audit is wave 2 on the fixed head.
- Changed files and reviewed diff: Changed files (diff base 7c09518d3c7862ed6cc7ce68289b1493299bf9ad = merge-base with main, reviewed head b5e75eb50c865195adff06ec2ffae8f115084ee8):
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

Reviewed diff (git diff 7c09518d3c7862ed6cc7ce68289b1493299bf9ad..b5e75eb50c865195adff06ec2ffae8f115084ee8):
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
index 0000000..7904f81
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
+- [x] 4.2 F2 wave 1 QA3 (cap rounding): apply the 25% cap in whole cents rounded down in `src/fee.ts` (`Math.floor` instead of `Math.round`), so a capped fee for an amount not divisible by 4 is never rounded up (10002 cents gave 2501, 3 cents gave a listed 1-cent fee); regression test in `src/fee.test.ts` checks capped fees for 10001, 10002, 10003 and 3 cents. Verify: `bun test src/fee.test.ts`
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
index 0000000..9817b92
--- /dev/null
+++ b/src/fee.test.ts
@@ -0,0 +1,34 @@
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
+test("capped fee is rounded down to whole cents", () => {
+  expect(lateFee(inv("2025-01-01", 10001), "2026-02-15")).toBe(2500);
+  expect(lateFee(inv("2025-01-01", 10002), "2026-02-15")).toBe(2500);
+  expect(lateFee(inv("2025-01-01", 10003), "2026-02-15")).toBe(2500);
+  expect(lateFee(inv("2025-01-01", 3), "2026-02-15")).toBe(0);
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
index 0000000..1c1d3f7
--- /dev/null
+++ b/src/fee.ts
@@ -0,0 +1,14 @@
+import { daysOverdue, type Invoice } from "./invoice";
+
+const PERIOD_DAYS = 30;
+const RATE_PERCENT_PER_PERIOD = 2;
+const CAP_PERCENT = 25;
+
+/** Late fee in whole cents: 2% per complete 30-day period overdue, capped at 25%, rounded down. */
+export function lateFee(invoice: Invoice, asOf: string): number {
+  const periods = Math.floor(daysOverdue(invoice, asOf) / PERIOD_DAYS);
+  if (periods * RATE_PERCENT_PER_PERIOD >= CAP_PERCENT) {
+    return Math.floor((invoice.amountCents * CAP_PERCENT) / 100);
+  }
+  return Math.floor((invoice.amountCents * periods * RATE_PERCENT_PER_PERIOD) / 100);
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
index 0000000..183f2fa
--- /dev/null
+++ b/src/today.test.ts
@@ -0,0 +1,6 @@
+import { expect, test } from "bun:test";
+import { today } from "./today";
+
+test("formats the UTC date as YYYY-MM-DD", () => {
+  expect(today(new Date(Date.UTC(2026, 2, 1, 23, 30, 0)))).toBe("2026-03-01");
+});
diff --git a/src/today.ts b/src/today.ts
new file mode 100644
index 0000000..21c1947
--- /dev/null
+++ b/src/today.ts
@@ -0,0 +1,4 @@
+/** The as-of date used when the command is given none: today's UTC date, as YYYY-MM-DD. */
+export function today(now: Date = new Date()): string {
+  return now.toISOString().slice(0, 10);
+}

- Repository context and plan: Repository root (read-only; read files from it): /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r4/.worktrees/review-late-fee-report
Files to read for full content: src/invoice.ts, src/fee.ts, src/report.ts, src/today.ts, src/cli.ts, src/fee.test.ts, src/report.test.ts, src/today.test.ts, samples/invoices.json, package.json, tsconfig.json, openspec/config.yaml.
CONTEXT_MINING:
- git log -> 4 branch commits (base project, openspec change, fee per invoice, report+command) plus fix commit b5e75eb -> all late-fee code is new in this diff, so no existing consumer can regress.
- git log --grep late, TODO/FIXME/HACK scan of src and samples -> nothing beyond this change; no remote, no gh issues/PRs available -> no external tracker context.
- tasks.md TODOs 4.1 (UTC day counting via Date.UTC) and 4.2 (cap floored) -> both earlier defects live in the fee path; the money path is the area of highest consequence.
- tsc --noEmit fails before and after the change because node_modules/bun-types is not installed -> environmental, not caused by the diff; `bun test` is the project's verification (9 pass).
PLAN (OpenSpec change folder openspec/changes/late-fee-report; the exact bundle the gate binds, from the wave-2 snapshot copy):
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
8e2a963811e5c91f090ccbbd138964b9feee0269325d764c6330c308ad31cd7e  design.md
e5bf9e7041dc133d8d3eb0e519002585ea75bcebb477fc17f692c24cd68d6f89  gate.md
c4001594e5c96f17c5cb903745a4f28ef4050e4adaf0f905959e03e8def5defb  proposal.md
dbc83788490a4f2cb17c5b17d1f60e42941f34ad2a5cd3b5af40d65f701d20b3  review.md
a50c4ae0662d08924654ef043e9900b8345c7cc926829821dbd2e4e4ea71f2c5  specs/late-fees/spec.md
842cd55c18168e374568d7ed4272629ee2dfe3e5050910cd1f05999490df9b43  tasks.md
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
- [x] 4.2 F2 wave 1 QA3 (cap rounding): apply the 25% cap in whole cents rounded down in `src/fee.ts` (`Math.floor` instead of `Math.round`), so a capped fee for an amount not divisible by 4 is never rounded up (10002 cents gave 2501, 3 cents gave a listed 1-cent fee); regression test in `src/fee.test.ts` checks capped fees for 10001, 10002, 10003 and 3 cents. Verify: `bun test src/fee.test.ts`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
- Manual QA matrix and artifacts: # F2 wave 2 QA matrix (head b5e75eb50c865195adff06ec2ffae8f115084ee8, depth standard; every wave-1 row re-run, none carried)

|#|Scenario|Exact command / action|Expected|Observed|Verdict|Artifact|
|---|---|---|---|---|---|---|
|QA1|Happy path: sample file|`bun src/cli.ts samples/invoices.json --as-of 2026-02-20`|INV-3 20.00, INV-1 2.00, INV-2 2.00, no INV-4, TOTAL 24.00|as expected|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa1.txt|
|QA2|Requirement "Late fee per invoice": one period, cap, 29/30/59/60-day boundaries, floor|`bun src/cli.ts wave-2/fixtures/qa2-fee.json --as-of 2026-02-15`|ONE-PERIOD 2.00, OVER-A-YEAR 25.00, DAY-29 absent, DAY-30 2.00, DAY-59 2.00, DAY-60 4.00, FLOOR-CENTS 2.46 (floor of 12345 * 2% = 246.9)|as expected|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa2.txt|
|QA3|Riskiest edge (wave-1 failure, fix 4.2): capped fee in whole cents rounded down, amounts not divisible by 4|`bun src/cli.ts wave-2/fixtures/qa3-cap-rounding.json --as-of 2026-02-15`|CAP-10000..CAP-10003 all 25.00, CAP-1 and CAP-3 absent (fee 0), TOTAL 100.00|as expected (wave 1 showed 25.01, 25.01, CAP-3 0.01, TOTAL 100.03)|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa3.txt|
|QA4|UTC calendar days across DST in runner zone|`TZ=Europe/Berlin` / `TZ=America/New_York` `bun src/cli.ts wave-2/fixtures/qa4-dst.json --as-of 2026-03-31`, and Berlin `--as-of 2026-03-30`|30 days -> 2.00 in both zones; 29 days -> not listed|as expected|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa4.txt|
|QA5|Requirement "Overdue report" ordering, input-order independence|`bun src/cli.ts wave-2/fixtures/qa5-order-{a,b}.json --as-of 2026-02-20`|big, z, B, a, b in both input orders (code-unit id order)|as expected, identical output|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa5.txt|
|QA6|Negative control: 0-cent fee not listed; total of listed lines; empty input|`bun src/cli.ts wave-2/fixtures/qa6-zero-fee.json --as-of 2026-02-20`, `.../qa6-empty.json`|only LISTED 2.00, TOTAL 2.00; empty -> TOTAL 0.00|as expected|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa6.txt|
|QA7|Default as-of is today's UTC date|no `--as-of`, `TZ=Pacific/Kiritimati` (local date 2026-11-03) and `TZ=Pacific/Pago_Pago`, fixture due UTC-today minus 30 / minus 29 days|only the minus-30 invoice listed in both zones|as expected (UTC 2026-11-02T21:23:31Z)|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa7.txt|
|QA8|Regression: usage errors and project test suite|`bun src/cli.ts`, `--asof`, `--as-of` without date; `bun test`|exit 2 with usage line; 9 pass|as expected|PASS|.omp/team-config/evidence/gate/late-fee-report/wave-2/qa8.txt|

Result: PASS (8/8). Fixture inputs: .omp/team-config/evidence/gate/late-fee-report/wave-2/fixtures/.

Artifacts are readable under the repository root at the paths in the Artifact column (transcripts with the fixtures they used).
- Author-supplied behavioural criteria: Criterion 1 (spec Requirement: Late fee per invoice)
Invariant:        an invoice's fee equals floor(amountCents * min(2 * floor(UTC days overdue / 30), 25) / 100), never rounded up and never above 25%.
Positive witness: 10000 cents due 2026-01-10 as of 2026-02-15 -> 200; 10002 cents more than a year overdue -> 2500.
Negative control: an invoice only 29 days overdue gets a fee above 0 cents, or a capped 10002-cent invoice gets 2501.
Observable:       the fee column of `bun src/cli.ts <file> --as-of <date>` and `lateFee` return values in src/fee.test.ts.
Boundary:         lateFee in src/fee.ts as rendered by the report command.

Criterion 2 (spec Requirement: Overdue report)
Invariant:        the report lists exactly the invoices with fee > 0, ordered by fee desc, due date asc, id asc (code-unit), independent of input order, with TOTAL equal to the sum of listed fees; without --as-of the as-of date is today's UTC date.
Positive witness: equal-fee invoices z (2026-01-10), B, a, b (2026-01-12) render as z, B, a, b for both input orders; a run at 2026-03-01T23:30:00Z uses 2026-03-01.
Negative control: an invoice with a 0-cent fee appears as a report line, or reversing the input file changes the line order.
Observable:       stdout lines of the report command for permuted fixtures; buildReport().lines ids in src/report.test.ts.
Boundary:         buildReport/renderReport output of the `report` command.

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
