Complete assignment thoroughly:

Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: GOAL (user request): run the review-work F2 merge gate for the OpenSpec change `late-fee-report`. The change's own goal (proposal.md): "Finance needs a command that lists overdue invoices with the late fee each has accrued, so reminders can be sent with the amount owed." What changes: a late fee calculation of 2% of the invoice amount per complete 30-day period overdue, capped at 25%, in whole cents rounded down; an overdue report listing invoices with a fee, ordered by fee, with a total, and a `report` command printing it for an invoices JSON file.
CONSTRAINTS (design.md): integer-cent arithmetic only; dates are UTC calendar dates; the report is deterministic for any input order; the input array is never mutated; ties break by due date, then id, so the order is total. Non-goals: currency conversion, persistence, input-file schema validation beyond what the report needs; malformed dates are not diagnosed (finance exports are machine generated).
BACKGROUND (gate.md): Mandatory class none; Depth standard; Risk tier product; "Finance sends reminders with the listed fee amounts, so a wrong fee or wrong ordering misleads customers about what they owe; no money moves automatically and no protected asset is touched." Behavioural contract = the two `### Requirement:` blocks of specs/late-fees/spec.md (Late fee per invoice; Overdue report ordering), quoted in the plan copy below.
- Changed files and reviewed diff: Diff range 7c09518d3c7862ed6cc7ce68289b1493299bf9ad..418158c10d6d8c905f6d376c026cf6eb1491da0f (merge-base with `main`..HEAD of `feat/late-fee-report`).
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

Reviewed diff (`git diff main...HEAD`):
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
index 0000000..8bf7160
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
+- The report sorts a derived list of lines; the input array is never mutated. Ties break by due date, then by id, so the order is total.
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
index 0000000..f90854c
--- /dev/null
+++ b/openspec/changes/late-fee-report/review.md
@@ -0,0 +1,19 @@
+# Review
+
+- **Verdict**: OKAY
+- **Reviewed digest**: f0eeeb1467dcb0d9f46c39ed87680ba9d21161b80aca1f12001907fa0184fd83
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
index 0000000..c622812
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
+The overdue report SHALL list only invoices with a late fee above zero, ordered by late fee descending, then by due date ascending (earlier first), then by invoice id ascending in plain code-unit string order, followed by a total of all listed fees. The order SHALL NOT depend on the order of the input file.
+
+#### Scenario: Different fees
+- **WHEN** one invoice has a fee of 1000 cents and another a fee of 200 cents
+- **THEN** the 1000-cent invoice is listed first
+
+#### Scenario: Equal fees
+- **WHEN** two listed invoices have equal late fees and different due dates, in any input order
+- **THEN** the invoice with the earlier due date is listed first, and invoices with equal due dates are listed by id
+
+#### Scenario: Negative control
+- **WHEN** an invoice has a late fee of 0 cents
+- **THEN** a report line for it MUST fail this requirement
diff --git a/openspec/changes/late-fee-report/tasks.md b/openspec/changes/late-fee-report/tasks.md
new file mode 100644
index 0000000..565b1ab
--- /dev/null
+++ b/openspec/changes/late-fee-report/tasks.md
@@ -0,0 +1,19 @@
+# Tasks
+
+## 1. Fee calculation
+
+- [x] 1.1 Add `src/invoice.ts` and `src/fee.ts` with `lateFee` and its tests. Verify: `bun test src/fee.test.ts`
+- [x] 1.2 F2 wave 1 fix for QA3: count days overdue in UTC calendar days (`Date.UTC` in `src/invoice.ts`) so an invoice 30 calendar days overdue across a local daylight-saving change accrues its fee in every process time zone, with a regression test that pins a DST time zone. Verify: `bun test src/fee.test.ts`
+
+## 2. Report
+
+- [x] 2.1 Add `src/report.ts`, `src/cli.ts`, `samples/invoices.json` and the report tests. Verify: `bun test src/report.test.ts && bun src/cli.ts samples/invoices.json --as-of 2026-02-20`
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
index 0000000..d80217f
--- /dev/null
+++ b/src/fee.test.ts
@@ -0,0 +1,28 @@
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
+test("30 UTC calendar days across a daylight-saving change charge one period", () => {
+  const previousTz = process.env.TZ;
+  process.env.TZ = "Europe/Berlin"; // clocks spring forward on 2026-03-29
+  try {
+    expect(lateFee(inv("2026-03-01"), "2026-03-31")).toBe(200);
+    expect(lateFee(inv("2026-03-02"), "2026-03-31")).toBe(0);
+  } finally {
+    if (previousTz === undefined) delete process.env.TZ;
+    else process.env.TZ = previousTz;
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

- Repository context and plan: Workspace root (read files there): /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r6/.worktrees/review-late-fee-report
Plan: the OpenSpec change folder openspec/changes/late-fee-report; the exact plan bytes for this wave (the folder bundle, plan_sha256 f560f43232b9f17ba554a94fc1044e3eda9d79d82d79bf1e364a1bc0cdcdee3d) are the pinned copy /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1a-standard-r6/.worktrees/review-late-fee-report/.omp/team-config/gate-deltas/F2-9c6da0f3c5f8-wave-2.plan.md — read it completely; it carries proposal.md, design.md, gate.md, review.md, specs/late-fees/spec.md and tasks.md.
Source files: src/invoice.ts (Invoice, daysOverdue), src/fee.ts (lateFee), src/report.ts (buildReport, formatCents, renderReport), src/cli.ts (report command), tests src/fee.test.ts and src/report.test.ts, fixture samples/invoices.json; package.json scripts ("test": "bun test", "report": "bun src/cli.ts"); tsconfig.json.
CONTEXT_MINING:
- git log on changed files -> 7c09518 base project, cb28ea4 fee, a8cbb6c report and command, 2369586 ticks F1 task 3.1, 418158c fix (UTC days, task 1.2) -> no reverts or prior attempts in this area.
- F2 wave 1 (snapshot 2369586) -> manual QA row QA3 FAILED: `new Date(y, m - 1, d)` (local time) undercounted 30 calendar days across the spring DST change to 29 days under TZ Europe/Berlin and America/New_York, so a 30-day-overdue invoice showed no fee; no reviewer was dispatched for that wave -> fixed in 418158c (Date.UTC plus a regression test that pins TZ=Europe/Berlin; RED before the fix observed, 4 pass after), fix delta reviewed by plan-reviewer: OKAY.
- openspec review.md (planning review OKAY, round 1, digest f0eeeb14...) -> `validate-openspec-change.mjs --reviewed` now reports it stale (current digest 077fd719...) because fix row 1.2 was added to tasks.md during F2 -> the planning review predates the fix row.
- No git remote, so no issues or PRs to mine; `rg TODO|FIXME|HACK` over src and samples -> none.
- Importers: src/cli.ts imports report.ts; report.ts imports fee.ts; fee.ts imports invoice.ts; no other consumers (new standalone project).
- Tooling note: no node_modules, so `bun-types` is absent and the TS language server reports `bun:test`/`process` as unresolved in every test and src/cli.ts; `bun test` runs fine.
- Manual QA matrix and artifacts: # F2 wave 2 QA matrix (F1), snapshot 418158c10d6d

Captured on 418158c (head after the last code commit, the wave-2 snapshot) in the review worktree, process TZ Europe/Berlin (CET), each row under a pty (`script -q`), synthetic inputs only. Every row re-run after fix 418158c; no carried rows.

|#|Scenario|Exact command / action|Expected|Observed|Verdict|Artifact|
|---|---|---|---|---|---|---|
|QA1|Happy path: sample report|`bun src/cli.ts samples/invoices.json --as-of 2026-02-20`|INV-3 20.00, INV-1 2.00, INV-2 2.00, TOTAL 24.00; INV-4 (10 days) absent|exactly that, exit 0|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/qa1-sample-report.txt|
|QA2|Requirement "Late fee per invoice": one period, 29-day negative control, 30-day boundary, 12 periods 24%, cap 25%, round down, not yet due|`bun src/cli.ts f1/fee-cases.json --as-of 2026-02-15`|25.00, 24.00, 2.46, 2.00, 2.00, TOTAL 55.46; P29-negative-control and NOT-YET-due absent|exactly that, exit 0|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/qa2-fee-rule.txt|
|QA3|Riskiest edge (wave 1 failure): 30 UTC calendar days across the spring DST change, 29-day neighbour, autumn change|`bun src/cli.ts f1/dst-cases.json --as-of 2026-03-31` under default TZ (CET), `TZ=America/New_York`, `TZ=UTC`; `f1/dst-autumn-cases.json --as-of 2026-10-31`|DST-spring-30d listed at 2.00 in all three zones, DST-spring-29d absent; DST-autumn-30d 2.00, DST-autumn-29d absent|exactly that in all three zones (wave 1 on a8cbb6c showed TOTAL 0.00 under CET and New York)|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/qa3-utc-days-dst.txt|
|QA4|Requirement "Overdue report ordering": fee desc, due date asc, id code-unit asc (`B` < `a` < `b`), input-order independence, zero-fee negative control, total|`bun src/cli.ts f1/order-a.json` and reversed `f1/order-b.json`, `--as-of 2026-02-20`, plus `diff` of both outputs|BIG 10.00, z, B, a, b (2.00 each), TOTAL 18.00; zero-fee absent; identical for both input orders|exactly that, `IDENTICAL for both input orders`|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/qa4-report-ordering.txt|
|QA5|Regression on adjacent behaviour: usage error path and full suite|`bun src/cli.ts samples/invoices.json`, `bun src/cli.ts`, `bun test`|usage line and exit 2 twice; 7 pass 0 fail|exactly that|PASS|.omp/team-config/evidence/gate/late-fee-report/f1/qa5-regression-cli-and-suite.txt|

- Author-supplied behavioural criteria: Author-supplied criteria (from the spec requirements, five fields each):
1. Invariant: an invoice's late fee is 2% of its amount per complete 30-day period overdue, counted in UTC calendar days, capped at 25%, in whole cents rounded down.
   Positive witness: 10000 cents due 2026-01-10 as of 2026-02-15 -> 200; more than a year overdue -> 2500.
   Negative control: 29 days overdue -> any fee above 0 fails.
   Observable: `lateFee` return value and the report line printed by `bun src/cli.ts`.
   Boundary: report command output (cents formatted), backed by `lateFee`.
2. Invariant: the report lists only invoices with a fee above zero, by fee descending, then due date ascending, then id ascending in code-unit order, then a total, independent of input order.
   Positive witness: 1000-cent fee listed before 200-cent fee; equal fees by earlier due date, equal due dates by id.
   Negative control: a report line for an invoice whose fee is 0 cents fails.
   Observable: line order and TOTAL of `bun src/cli.ts <file> --as-of <date>` for an input and its reversal.
   Boundary: rendered report text of the CLI.

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
