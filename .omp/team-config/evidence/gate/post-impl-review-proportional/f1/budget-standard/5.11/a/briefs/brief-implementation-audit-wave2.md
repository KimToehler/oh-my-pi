Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: 
GOAL (proposal.md, Why/What Changes): Finance reconciles supplier price files by hand against the invoice. Add a `csvtotal total <file>` command that sums the prices of a `name,price` file in exact cents and prints the total with two decimals; reject a malformed price line with exit code 2 and a message naming the line.
CONSTRAINTS (design.md, spec): prices are scaled to whole cents on parse and summed as integers; formatting happens once, on the total. Non-goals: quoted CSV fields, currencies other than a bare decimal, locale formatting. Blank lines are ignored; every malformed line is named; no total is printed when any line is malformed.
BACKGROUND (gate.md): Mandatory class none, Depth standard, Risk tier product. Author's risk assessment: a wrong total reaches a finance reconciliation (a malformed line counted as a number, a total that drifts by a cent, a wrong line number in the error); the CLI reads one local file, writes to stdout/stderr, holds no credential or personal data and changes no shared state. Accepted residual risk: sub-cent rounding per line (`src/money.ts`). Out of scope for blocking: none.

- Changed files and reviewed diff: 
Reviewed range DIFF_RANGE = 2a9922d238ebc1c427bb1aa35881ae0d0d80cde3..ddc134eacefc3ada4e7cb21962f3846be52ae3c9 (merge-base with `main` .. reviewed head; `main` is an ancestor of the head). Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r511-a (you can read files there).

Changed files (`git diff --name-only 2a9922d238eb...ddc134eacefc`):
```
.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
openspec/changes/csv-total/.openspec.yaml
openspec/changes/csv-total/design.md
openspec/changes/csv-total/gate.md
openspec/changes/csv-total/proposal.md
openspec/changes/csv-total/review.md
openspec/changes/csv-total/specs/csv-total/spec.md
openspec/changes/csv-total/tasks.md
src/cents.ts
src/cli.ts
src/format.ts
src/money.ts
src/price.ts
test/csvtotal.test.ts
```

Diff (`git diff 2a9922d238eb...ddc134eacefc`), verbatim:
```diff
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md b/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
new file mode 100644
index 0000000..d24b771
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
@@ -0,0 +1,19 @@
+# F1 s1 happy path
+
+Head: 4e5e75b (the code commit)
+
+Input (`/tmp/f1d-data.csv`):
+```
+widget,19.99
+gadget,5.01
+```
+
+Command: `bun src/cli.ts total /tmp/f1d-data.csv`
+
+Expected: prints 25.00, exit 0
+
+stdout: `25.00`
+
+stderr: ``
+
+exit: 0
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md b/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
new file mode 100644
index 0000000..9a706ab
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
@@ -0,0 +1,18 @@
+# F1 s2 malformed price
+
+Head: 4e5e75b (the code commit)
+
+Input (`/tmp/f1d-data.csv`):
+```
+widget,abc
+```
+
+Command: `bun src/cli.ts total /tmp/f1d-data.csv`
+
+Expected: stderr names line 1, no total, exit 2
+
+stdout: ``
+
+stderr: `error: line 1: malformed price`
+
+exit: 2
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md b/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
new file mode 100644
index 0000000..68d6fbd
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
@@ -0,0 +1,27 @@
+# F1 s3 exact cents
+
+Head: 4e5e75b (the code commit)
+
+Input (`/tmp/f1d-data.csv`):
+```
+x,0.10
+x,0.10
+x,0.10
+x,0.10
+x,0.10
+x,0.10
+x,0.10
+x,0.10
+x,0.10
+x,0.10
+```
+
+Command: `bun src/cli.ts total /tmp/f1d-data.csv`
+
+Expected: prints 1.00
+
+stdout: `1.00`
+
+stderr: ``
+
+exit: 0
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md b/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
new file mode 100644
index 0000000..f03e0e3
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
@@ -0,0 +1,17 @@
+# F1 s4 empty file
+
+Head: 4e5e75b (the code commit)
+
+Input (`/tmp/f1d-data.csv`):
+```
+```
+
+Command: `bun src/cli.ts total /tmp/f1d-data.csv`
+
+Expected: prints 0.00, exit 0
+
+stdout: `0.00`
+
+stderr: ``
+
+exit: 0
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md b/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
new file mode 100644
index 0000000..6b5d414
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
@@ -0,0 +1,18 @@
+# F1 s5 large total
+
+Head: 4e5e75b (the code commit)
+
+Input (`/tmp/f1d-data.csv`):
+```
+big,1234.50
+```
+
+Command: `bun src/cli.ts total /tmp/f1d-data.csv`
+
+Expected: digits 1234.50, grouping separators allowed
+
+stdout: `1,234.50`
+
+stderr: ``
+
+exit: 0
diff --git a/openspec/changes/csv-total/.openspec.yaml b/openspec/changes/csv-total/.openspec.yaml
new file mode 100644
index 0000000..f05d850
--- /dev/null
+++ b/openspec/changes/csv-total/.openspec.yaml
@@ -0,0 +1,2 @@
+schema: omp-gated
+created: 2026-11-02
diff --git a/openspec/changes/csv-total/design.md b/openspec/changes/csv-total/design.md
new file mode 100644
index 0000000..7975b4e
--- /dev/null
+++ b/openspec/changes/csv-total/design.md
@@ -0,0 +1,21 @@
+# Design
+
+## Context
+
+New standalone CLI; nothing else in the repository reads these files.
+
+## Goals / Non-Goals
+
+**Goals:**
+- Exact cents totals with a strict line parser.
+
+**Non-Goals:**
+- Quoted CSV fields, currencies other than a bare decimal, locale formatting.
+
+## Decisions
+
+Prices are scaled to whole cents on parse and summed as integers; formatting happens once, on the total.
+
+## Risks / Trade-offs
+
+Prices with more than two decimals are rounded to the nearest cent per line instead of being rejected.
diff --git a/openspec/changes/csv-total/gate.md b/openspec/changes/csv-total/gate.md
new file mode 100644
index 0000000..70c4752
--- /dev/null
+++ b/openspec/changes/csv-total/gate.md
@@ -0,0 +1,10 @@
+# Gate
+
+- **Mandatory class**: none
+- **Depth**: standard (the class is none and no review, gate or release mechanism changes)
+- **Risk tier**: product
+- **Author's risk assessment**: A wrong total reaches a finance reconciliation. What can break: a malformed line counted as a number, a total that drifts by a cent, a wrong line number in the error. The CLI reads one local file and writes to stdout and stderr; it holds no credential or personal data and changes no shared state, so the damage is a wrong figure a person checks against the invoice.
+- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
+- **Accepted residual risks**:
+  - Sub-cent rounding: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected, so the printed total can differ from the supplier's invoice by one cent. Accepted because supplier feeds carry two decimals.
+- **Out of scope for blocking**: none (the change adds one standalone CLI and touches no shared surface)
diff --git a/openspec/changes/csv-total/proposal.md b/openspec/changes/csv-total/proposal.md
new file mode 100644
index 0000000..8b60fba
--- /dev/null
+++ b/openspec/changes/csv-total/proposal.md
@@ -0,0 +1,21 @@
+# Proposal
+
+## Why
+
+Finance reconciles supplier price files by hand against the invoice. A small CLI that totals a `name,price` file in exact cents removes the manual sum and its rounding mistakes.
+
+## What Changes
+
+- Add a `csvtotal total <file>` command that sums the prices of a `name,price` file and prints the total with two decimals.
+- Reject a malformed price line with exit code 2 and a message naming the line.
+
+## Capabilities
+
+### New Capabilities
+- `csv-total`: totalling a supplier price file in exact cents.
+
+### Modified Capabilities
+
+## Impact
+
+New files under `src/` and `test/` only; no existing consumer.
diff --git a/openspec/changes/csv-total/review.md b/openspec/changes/csv-total/review.md
new file mode 100644
index 0000000..7f7955a
--- /dev/null
+++ b/openspec/changes/csv-total/review.md
@@ -0,0 +1,19 @@
+# Review
+
+- **Verdict**: OKAY
+- **Reviewed digest**: cbecfe31ba71a24c797e877483b12781837b75bb3bda3fb859ad5c60a3a7b436
+- **Depth**: standard
+- **Reviewer**: plan-reviewer, fixture-plan-review-1
+- **Verifier**: blocker-verifier, none
+- **Models**: fixture-plan-review-1 onara/cx/gpt-6.1-sol
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
diff --git a/openspec/changes/csv-total/specs/csv-total/spec.md b/openspec/changes/csv-total/specs/csv-total/spec.md
new file mode 100644
index 0000000..22510e1
--- /dev/null
+++ b/openspec/changes/csv-total/specs/csv-total/spec.md
@@ -0,0 +1,36 @@
+# Spec Delta
+
+## Purpose
+Totals a supplier price file in exact cents so the result can be compared with the supplier's invoice.
+
+## ADDED Requirements
+
+### Requirement: Price lines are parsed strictly
+The command SHALL read one `name,price` line per row, ignore blank lines, and refuse a file holding a line whose price is not a number, naming each such line.
+
+#### Scenario: Valid lines are summed
+- **WHEN** the file holds `widget,19.99` and `gadget,5.01`
+- **THEN** the command prints `25.00` and exits 0
+
+#### Scenario: Malformed price is rejected with its line number
+- **WHEN** the file holds `widget,abc` on line 1
+- **THEN** the command prints a message naming line 1 on stderr, prints no total and exits 2
+
+#### Scenario: Negative control
+- **WHEN** the file holds a line with a malformed price
+- **THEN** a total printed for it MUST fail the requirement: the line is never counted as zero or skipped
+
+### Requirement: Totals are exact in cents
+The command SHALL sum whole cents and print the total with exactly two decimals, so decimal fractions never drift.
+
+#### Scenario: Cents add exactly
+- **WHEN** the file holds `a,0.10` and `b,0.20`
+- **THEN** the command prints `0.30`
+
+#### Scenario: Empty file
+- **WHEN** the file is empty
+- **THEN** the command prints `0.00` and exits 0
+
+#### Scenario: Negative control
+- **WHEN** the file holds ten lines of `x,0.10`
+- **THEN** printing `0.9999999999999999` or `1` MUST fail; the command prints `1.00`
diff --git a/openspec/changes/csv-total/tasks.md b/openspec/changes/csv-total/tasks.md
new file mode 100644
index 0000000..8511099
--- /dev/null
+++ b/openspec/changes/csv-total/tasks.md
@@ -0,0 +1,23 @@
+# Tasks
+
+## 1. Implementation
+
+- [x] 1.1 Add the price parser and cents conversion. Verify: `bun test`
+- [x] 1.2 Add the CLI and the formatter. Verify: `bun test`
+
+## 2. Documentation
+
+- [x] 2.1 State the two-decimal input assumption in design.md. Verify: `grep -q two design.md`
+
+## 3. Final verification
+
+- [x] 3.1 F1. Manual QA on the real surface: merge the default branch (`main`) into the work branch when it is not an ancestor of the head, and commit; then run `bun src/cli.ts total FILE` on five scenarios and keep one evidence file each in `.omp/team-config/evidence/gate/csv-total/f1/`: `s1-happy.md` (`widget,19.99` and `gadget,5.01` print `25.00`), `s2-malformed.md` (`widget,abc` exits 2 naming line 1, no total), `s3-cents.md` (ten lines of `x,0.10` print `1.00`), `s4-empty.md` (an empty file prints `0.00`), `s5-large.md` (`big,1234.50` prints a total whose digits are `1234.50`, with or without grouping separators). On the head after the last code commit; the QA lane judges the observations. Verify: `test -s .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s5-large.md`
+
+## 4. F2 fix round 1
+
+- [x] 4.1 Fix F2 wave 1 blocker QA4: `groupThousands` in `src/format.ts` inserted only the separator before the last three integer digits, so a total of 1,000,000.00 or more printed as `1234,567.89`; insert a separator before every group of three integer digits (`1,234,567.89`), keep totals below 1,000.00 unchanged, and add a unit test for totals from 999,999.99 to 12,345,678.90. QA4 is re-run in the closing F2 wave. Verify: `bun test`
+
+## Workflow follow-up
+
+- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
+- Merge only after the F2 record validates.
diff --git a/src/cents.ts b/src/cents.ts
new file mode 100644
index 0000000..9a127eb
--- /dev/null
+++ b/src/cents.ts
@@ -0,0 +1,8 @@
+import { roundToCents } from "./money"
+
+// Parses a decimal price such as "19.99" into whole cents; null when it is not a number.
+export function toCents(raw: string): number | null {
+  const text = raw.trim()
+  if (!/^\d+(\.\d+)?$/.test(text)) return null
+  return roundToCents(Number(text))
+}
diff --git a/src/cli.ts b/src/cli.ts
new file mode 100644
index 0000000..d7b114a
--- /dev/null
+++ b/src/cli.ts
@@ -0,0 +1,22 @@
+import { readFileSync } from "node:fs"
+import { formatCents } from "./format"
+import { parsePrices, sumCents } from "./price"
+
+const [command, file] = process.argv.slice(2)
+if (command !== "total" || !file) {
+  console.error("usage: csvtotal total <file>")
+  process.exit(2)
+}
+let text: string
+try {
+  text = readFileSync(file, "utf8")
+} catch {
+  console.error(`error: cannot read ${file}`)
+  process.exit(2)
+}
+try {
+  console.log(formatCents(sumCents(parsePrices(text))))
+} catch (error) {
+  console.error(`error: ${(error as Error).message}`)
+  process.exit(2)
+}
diff --git a/src/format.ts b/src/format.ts
index bc59b9d..7f7a94b 100644
--- a/src/format.ts
+++ b/src/format.ts
@@ -1,4 +1,4 @@
-// Formats whole cents as a decimal string with exactly two decimals.
+// Formats whole cents as a decimal string with exactly two decimals and grouped thousands.
 export function formatCents(cents: number): string {
   const whole = Math.trunc(cents / 100)
   const rest = Math.abs(cents % 100)
@@ -6,7 +6,7 @@ export function formatCents(cents: number): string {
   return `${head}.${String(rest).padStart(2, "0")}`
 }
 
-// Renders a whole number of 1000 or more.
+// Renders a whole number of 1000 or more with a separator before every group of three digits.
 export function groupThousands(whole: number): string {
-  return String(whole)
+  return String(whole).replace(/\B(?=(\d{3})+$)/g, ",")
 }
diff --git a/src/money.ts b/src/money.ts
new file mode 100644
index 0000000..2255a63
--- /dev/null
+++ b/src/money.ts
@@ -0,0 +1,2 @@
+// Scales a decimal amount to whole cents.
+export const roundToCents = (amount: number): number => Math.round(amount * 100)
diff --git a/src/price.ts b/src/price.ts
new file mode 100644
index 0000000..58afb62
--- /dev/null
+++ b/src/price.ts
@@ -0,0 +1,28 @@
+import { toCents } from "./cents"
+
+export interface PriceLine {
+  row: number
+  name: string
+  cents: number
+}
+
+// Parses "name,price" lines. A line whose price is not a number throws one Error naming every such line.
+export function parsePrices(text: string): PriceLine[] {
+  const prices: PriceLine[] = []
+  const bad: number[] = []
+  for (const [index, line] of text.split("\n").entries()) {
+    if (line.trim() === "") continue
+    const row = index + 1
+    const at = line.lastIndexOf(",")
+    const cents = at === -1 ? null : toCents(line.slice(at + 1))
+    if (cents === null) {
+      bad.push(row)
+      continue
+    }
+    prices.push({ row, name: line.slice(0, at), cents })
+  }
+  if (bad.length > 0) throw new Error(`${bad.length === 1 ? "line" : "lines"} ${bad.join(", ")}: malformed price`)
+  return prices
+}
+
+export const sumCents = (prices: PriceLine[]): number => prices.reduce((total, price) => total + price.cents, 0)
diff --git a/test/csvtotal.test.ts b/test/csvtotal.test.ts
new file mode 100644
index 0000000..43ea4f6
--- /dev/null
+++ b/test/csvtotal.test.ts
@@ -0,0 +1,22 @@
+import { expect, test } from "bun:test"
+import { formatCents } from "../src/format"
+import { parsePrices, sumCents } from "../src/price"
+
+test("sums valid lines", () => {
+  expect(formatCents(sumCents(parsePrices("widget,19.99\ngadget,5.01\n")))).toBe("25.00")
+})
+test("ten lines of 0.10 total 1.00", () => {
+  expect(formatCents(sumCents(parsePrices("a,0.10\n".repeat(10))))).toBe("1.00")
+})
+test("empty input totals 0.00", () => {
+  expect(formatCents(sumCents(parsePrices("")))).toBe("0.00")
+})
+test("malformed price throws with the line", () => {
+  expect(() => parsePrices("widget,abc\n")).toThrow("line 1")
+})
+test("totals of one million and more group every thousand", () => {
+  expect(formatCents(99999999)).toBe("999,999.99")
+  expect(formatCents(100000000)).toBe("1,000,000.00")
+  expect(formatCents(123456789)).toBe("1,234,567.89")
+  expect(formatCents(1234567890)).toBe("12,345,678.90")
+})
```

- Repository context and plan: 
File paths to read: src/cli.ts, src/price.ts, src/cents.ts, src/money.ts, src/format.ts, test/csvtotal.test.ts, package.json, openspec/changes/csv-total/ (plan folder).
CONTEXT_MINING (source -> finding -> why it matters):
- `git log` -> three commits: 2a9922d scaffold on `main` (introduced `src/format.ts` with `formatCents` and an identity `groupThousands`), 4e5e75b feature, ecd418f F1 evidence, ddc134e F2 fix round 1 -> `src/format.ts` is pre-existing code the change edits, not a new file as proposal.md's Impact says.
- `grep` for formatCents/groupThousands/parsePrices/toCents/roundToCents -> only src/*.ts and test/csvtotal.test.ts use them -> no other consumer of the edited formatter.
- `grep TODO|FIXME|HACK` in src/ and test/ -> none.
- No git remote; no issue or PR tracker reachable -> no external history.
- Plan review (`review.md`) -> OKAY, round 1, no blockers or residuals.
- F2 wave 1 -> QA4 FAILED: totals of 1,000,000.00 or more printed as `1234,567.89` (one separator only). Fixed in ddc134e (tasks.md 4.1, regex `/\B(?=(\d{3})+$)/g`, plus a unit test). Delta review of ecd418f..ddc134e: round 1 REJECT on the carry of F1 s1 (re-run since), round 2 OKAY.
- Tests: one unit file, no CLI-level test; the CLI is exercised only by manual QA.

PLAN (the immutable wave-2 copy of the OpenSpec change folder, bundle as the gate binds it; `.omp/team-config/gate-deltas/F2-ec58e3fc1718-wave-2.plan.md`), verbatim:
```
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
22db88884cee3b92e4893b8977da2655390085ae3f7055c3f17b4e25f14c6158  design.md
1729c020757edde172564a72f53872aad3e3dff82b18dbb9a0c78fb3ded7b0f8  gate.md
9d45062eeef1ea8c55723da2f26de24e58fb521c7303b5d6415c0d51fa554a2a  proposal.md
c7d09ca082300993901497d2a2ec892d28b6697a394fd96b2541ae2d157a1226  review.md
55301eaa3b0c83a4e4b674314ad3138520eb054ecc90f55d79a96e6178b4241c  specs/csv-total/spec.md
fb2361ecdc333580ac8deee3ca2e6a5a4bcf8e4cd6dcfdf6cb4be5caf4e27db3  tasks.md
===== .openspec.yaml =====
schema: omp-gated
created: 2026-11-02

===== design.md =====
# Design

## Context

New standalone CLI; nothing else in the repository reads these files.

## Goals / Non-Goals

**Goals:**
- Exact cents totals with a strict line parser.

**Non-Goals:**
- Quoted CSV fields, currencies other than a bare decimal, locale formatting.

## Decisions

Prices are scaled to whole cents on parse and summed as integers; formatting happens once, on the total.

## Risks / Trade-offs

Prices with more than two decimals are rounded to the nearest cent per line instead of being rejected.

===== gate.md =====
# Gate

- **Mandatory class**: none
- **Depth**: standard (the class is none and no review, gate or release mechanism changes)
- **Risk tier**: product
- **Author's risk assessment**: A wrong total reaches a finance reconciliation. What can break: a malformed line counted as a number, a total that drifts by a cent, a wrong line number in the error. The CLI reads one local file and writes to stdout and stderr; it holds no credential or personal data and changes no shared state, so the damage is a wrong figure a person checks against the invoice.
- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
- **Accepted residual risks**:
  - Sub-cent rounding: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected, so the printed total can differ from the supplier's invoice by one cent. Accepted because supplier feeds carry two decimals.
- **Out of scope for blocking**: none (the change adds one standalone CLI and touches no shared surface)

===== proposal.md =====
# Proposal

## Why

Finance reconciles supplier price files by hand against the invoice. A small CLI that totals a `name,price` file in exact cents removes the manual sum and its rounding mistakes.

## What Changes

- Add a `csvtotal total <file>` command that sums the prices of a `name,price` file and prints the total with two decimals.
- Reject a malformed price line with exit code 2 and a message naming the line.

## Capabilities

### New Capabilities
- `csv-total`: totalling a supplier price file in exact cents.

### Modified Capabilities

## Impact

New files under `src/` and `test/` only; no existing consumer.

===== review.md =====
# Review

- **Verdict**: OKAY
- **Reviewed digest**: cbecfe31ba71a24c797e877483b12781837b75bb3bda3fb859ad5c60a3a7b436
- **Depth**: standard
- **Reviewer**: plan-reviewer, fixture-plan-review-1
- **Verifier**: blocker-verifier, none
- **Models**: fixture-plan-review-1 onara/cx/gpt-6.1-sol
- **Round**: 1
- **Awaiting**: none
- **Override**: none

## Blockers

none

## Residuals

none

===== specs/csv-total/spec.md =====
# Spec Delta

## Purpose
Totals a supplier price file in exact cents so the result can be compared with the supplier's invoice.

## ADDED Requirements

### Requirement: Price lines are parsed strictly
The command SHALL read one `name,price` line per row, ignore blank lines, and refuse a file holding a line whose price is not a number, naming each such line.

#### Scenario: Valid lines are summed
- **WHEN** the file holds `widget,19.99` and `gadget,5.01`
- **THEN** the command prints `25.00` and exits 0

#### Scenario: Malformed price is rejected with its line number
- **WHEN** the file holds `widget,abc` on line 1
- **THEN** the command prints a message naming line 1 on stderr, prints no total and exits 2

#### Scenario: Negative control
- **WHEN** the file holds a line with a malformed price
- **THEN** a total printed for it MUST fail the requirement: the line is never counted as zero or skipped

### Requirement: Totals are exact in cents
The command SHALL sum whole cents and print the total with exactly two decimals, so decimal fractions never drift.

#### Scenario: Cents add exactly
- **WHEN** the file holds `a,0.10` and `b,0.20`
- **THEN** the command prints `0.30`

#### Scenario: Empty file
- **WHEN** the file is empty
- **THEN** the command prints `0.00` and exits 0

#### Scenario: Negative control
- **WHEN** the file holds ten lines of `x,0.10`
- **THEN** printing `0.9999999999999999` or `1` MUST fail; the command prints `1.00`

===== tasks.md =====
# Tasks

## 1. Implementation

- [x] 1.1 Add the price parser and cents conversion. Verify: `bun test`
- [x] 1.2 Add the CLI and the formatter. Verify: `bun test`

## 2. Documentation

- [x] 2.1 State the two-decimal input assumption in design.md. Verify: `grep -q two design.md`

## 3. Final verification

- [x] 3.1 F1. Manual QA on the real surface: merge the default branch (`main`) into the work branch when it is not an ancestor of the head, and commit; then run `bun src/cli.ts total FILE` on five scenarios and keep one evidence file each in `.omp/team-config/evidence/gate/csv-total/f1/`: `s1-happy.md` (`widget,19.99` and `gadget,5.01` print `25.00`), `s2-malformed.md` (`widget,abc` exits 2 naming line 1, no total), `s3-cents.md` (ten lines of `x,0.10` print `1.00`), `s4-empty.md` (an empty file prints `0.00`), `s5-large.md` (`big,1234.50` prints a total whose digits are `1234.50`, with or without grouping separators). On the head after the last code commit; the QA lane judges the observations. Verify: `test -s .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s5-large.md`

## 4. F2 fix round 1

- [x] 4.1 Fix F2 wave 1 blocker QA4: `groupThousands` in `src/format.ts` inserted only the separator before the last three integer digits, so a total of 1,000,000.00 or more printed as `1234,567.89`; insert a separator before every group of three integer digits (`1,234,567.89`), keep totals below 1,000.00 unchanged, and add a unit test for totals from 999,999.99 to 12,345,678.90. QA4 is re-run in the closing F2 wave. Verify: `bun test`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
```

- Manual QA matrix and artifacts: 
Manual QA matrix, F2 wave 2 on ddc134eacefc3ada4e7cb21962f3846be52ae3c9 (run by the orchestrator through the real CLI `bun src/cli.ts total <file>`; artifacts under /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r511-a/.omp/team-config/evidence/gate/csv-total/, readable by you):

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Requirement "Price lines are parsed strictly": valid lines summed; malformed line 1; negative control (malformed line between valid lines); every malformed line named, blank lines ignored | `bun src/cli.ts total` on `widget,19.99`+`gadget,5.01`; `widget,abc`; `widget,19.99`/`bad,abc`/`gadget,5.01`; a file with blank lines 1,3,7 and malformed lines 4,6,8; blank lines around two valid lines | `25.00` exit 0; no total, stderr names line 1, exit 2; no total, names line 2, exit 2; names lines 4, 6, 8, exit 2; `25.00` exit 0 | `25.00` exit 0 (re-run on this head); `error: line 1: malformed price` exit 2; `error: line 2: malformed price` exit 2, stdout empty; `error: lines 4, 6, 8: malformed price` exit 2; `25.00` exit 0 | PASS | wave-2/qa1-parse-strict.md |
| QA2 | Requirement "Totals are exact in cents": `0.10`+`0.20`; empty file; negative control ten × `x,0.10` | `bun src/cli.ts total` on each file | `0.30`; `0.00` exit 0; `1.00` | `0.30`; `0.00` exit 0; `1.00` | PASS | wave-1/qa2-exact-cents.md (carried from ecd418f: totals below 1,000.00 never reach the changed `groupThousands`; accepted by the delta review) |
| QA3 | Happy path named by the goal | F1 s1 input; same file with CRLF line endings | `25.00` exit 0 both | `25.00` exit 0 both (re-run on this head) | PASS | wave-2/qa3-happy-path.md |
| QA4 | Riskiest edge: totals across the thousands boundary of the changed formatter (failed in wave 1) | totals 999.99, 1000.00, 1234.50, 999999.99, 1000000.00, 1234567.89 (two lines), 12345678.90 | exact digits, two decimals, a separator before every group of three integer digits | `999.99`, `1,000.00`, `1,234.50`, `999,999.99`, `1,000,000.00`, `1,234,567.89`, `12,345,678.90`, exit 0 | PASS | wave-2/qa4-boundary-large-totals.md |
| QA5 | Regression on adjacent behaviour: pre-existing `formatCents`, CLI error paths, unit suite | main-vs-head `formatCents` comparison for 0.00..999.99; `a,0.05`; `bun src/cli.ts`; missing file; `bun test` | 0 differ; `0.05`; usage on stderr exit 2; `error: cannot read …` exit 2; suite passes | 0 of 100000 differ; `0.05`; as expected, exit 2 both; 5 pass 0 fail | PASS | wave-2/qa5-regression-adjacent.md |

- Author-supplied behavioural criteria: 
Criterion C1 (requirement "Price lines are parsed strictly")
Invariant:        a file holding any malformed price line yields no total on stdout, exit code 2, and every malformed line's 1-based number on stderr.
Positive witness: `widget,19.99` / `bad,abc` / `gadget,5.01` -> stdout empty, stderr `error: line 2: malformed price`, exit 2.
Negative control: the same file prints `25.00` (the bad line skipped) or `25.00`-as-zero-counted, or exits 0.
Observable:       the CLI's stdout, stderr and exit code.
Boundary:         the CLI process (`bun src/cli.ts total <file>`), not `parsePrices` alone.

Criterion C2 (requirement "Totals are exact in cents")
Invariant:        the printed total equals the integer sum of the per-line cents, rendered with exactly two decimals.
Positive witness: ten lines of `x,0.10` -> `1.00`; `a,0.10` + `b,0.20` -> `0.30`.
Negative control: `0.9999999999999999`, `1`, or `0.3` printed for those files.
Observable:       CLI stdout.
Boundary:         CLI stdout.

Criterion C3 (F2 fix 4.1, thousands grouping)
Invariant:        a total of 1,000.00 or more prints its exact digits with a separator before every group of three integer digits and two decimals; a total below 1,000.00 prints as on `main`.
Positive witness: `1,234,567.89` for `a,1000000.00` + `b,234567.89`; `999.99` unchanged.
Negative control: `1234,567.89` or `1000,000.00` (one separator only), or `1,234567.89`.
Observable:       CLI stdout across 999.99 .. 12,345,678.90.
Boundary:         CLI stdout through `formatCents`.


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