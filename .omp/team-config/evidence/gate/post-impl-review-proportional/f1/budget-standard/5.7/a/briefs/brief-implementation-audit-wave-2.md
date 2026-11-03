Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: 
GOAL (user request and proposal.md): run the F2 merge gate for OpenSpec change `csv-total`. The change adds a `csvtotal total <file>` command (`bun src/cli.ts total FILE`) that sums the prices of a `name,price` file in exact whole cents and prints the total with two decimals, and rejects a malformed price line with exit code 2 and a stderr message naming the line. Finance reconciles supplier price files by hand against the invoice; the CLI removes the manual sum and its rounding mistakes.
CONSTRAINTS (design.md, gate.md, spec.md): prices are scaled to whole cents on parse and summed as integers; formatting happens once, on the total. Non-goals: quoted CSV fields, currencies other than a bare decimal, locale formatting. Blank lines are ignored; a line whose price is not a number makes the whole file fail, naming each such line, and is never counted as zero or skipped. Mandatory class: none. Depth: standard. Risk tier: product. Whole-diff review: not needed (whole-diff surface reviewed in F2).
BACKGROUND (gate.md author's risk assessment): a wrong total reaches a finance reconciliation. What can break: a malformed line counted as a number, a total that drifts by a cent, a wrong line number in the error. The CLI reads one local file and writes to stdout and stderr; it holds no credential or personal data and changes no shared state.
Accepted residual risks (gate.md): Sub-cent rounding: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected, so the printed total can differ from the supplier's invoice by one cent. Accepted because supplier feeds carry two decimals.
Out of scope for blocking (gate.md): none (the change adds one standalone CLI and touches no shared surface).
This is F2 wave 2, the closing wave of fix round 1. Wave 1 (implementation-audit FAIL) raised B1 misgrouped-large-total (src/format.ts:11, one separator only for totals of 1,000,000 or more) and B2 large-total-branch-untested (test/csvtotal.test.ts). Fix rows 4.1 and 4.2 (tasks.md ## TODOs) were implemented in bdadbc9 and b64d965; their delta review was REJECT on one QA carry (F1 s1), the row was re-run, and the re-review of the same range was OKAY. Review the whole final diff, not only the fix.

- Changed files and reviewed diff: 
CHANGED_FILES:
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

DIFF (`git diff main...HEAD`, 2a9922d..b64d965):
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
index 0000000..548e786
--- /dev/null
+++ b/openspec/changes/csv-total/tasks.md
@@ -0,0 +1,24 @@
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
+## TODOs
+
+- [x] 4.1 Group every run of three digits in `groupThousands` (`src/format.ts`), so a total of `1234567.00` prints `1,234,567.00` instead of `1234,567.00` (F2 wave 1 blocker B1, class misgrouped-large-total). Verify: `bun test`
+- [x] 4.2 Add `formatCents` tests in `test/csvtotal.test.ts` for 1,000.00, 999,999.99, 1,000,000.00 and 1,234,567.00, each seen failing when the grouping logic is broken (F2 wave 1 blocker B2, class large-total-branch-untested). Verify: `bun test`
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
index bc59b9d..c8525e6 100644
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
+// Renders a whole number of 1000 or more with a comma before every run of three digits.
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
index 0000000..b2a54ba
--- /dev/null
+++ b/test/csvtotal.test.ts
@@ -0,0 +1,28 @@
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
+test("a total of 1,000.00 gets one separator", () => {
+  expect(formatCents(100000)).toBe("1,000.00")
+})
+test("a total of 999,999.99 gets one separator", () => {
+  expect(formatCents(99999999)).toBe("999,999.99")
+})
+test("a total of 1,000,000.00 gets a separator before every three digits", () => {
+  expect(formatCents(100000000)).toBe("1,000,000.00")
+})
+test("a total of 1,234,567.00 gets a separator before every three digits", () => {
+  expect(formatCents(123456700)).toBe("1,234,567.00")
+})
```

- Repository context and plan: 
FILE PATHS (workspace root /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r57-a, reviewed head b64d9652e387f2768741b29deb16c5e84e924c10, diff base 2a9922d238ebc1c427bb1aa35881ae0d0d80cde3 = merge-base with main): src/cli.ts, src/price.ts, src/cents.ts, src/money.ts, src/format.ts, test/csvtotal.test.ts, package.json, openspec/changes/csv-total/ (proposal.md, design.md, gate.md, tasks.md, review.md, specs/csv-total/spec.md). Import graph: cli.ts -> format.ts, price.ts; price.ts -> cents.ts -> money.ts; test imports format.ts and price.ts. Nothing else in the repository imports these modules.
CONTEXT_MINING:
- `git log main` -> main holds only the scaffold 2a9922d, which added src/format.ts with `groupThousands` returning `String(whole)` -> the diff changes a pre-existing file; on main nothing imports it, so no existing consumer.
- `git log --all --grep` -> origin/feat/csv-total is ahead of the local branch with commits from an earlier, separate F2 run of this change (2e85d9d, aa9b7e1, e4e3052, an overridden record) -> none of them is in the reviewed tree; judge the reviewed tree as it stands.
- F2 ledger -> wave 1 FAIL (B1, B2 above); fix round 1 = bdadbc9 (plan rows) + b64d965 (regex `/\B(?=(\d{3})+$)/g`, four formatCents tests); RED: on the pre-fix source 2 of the 4 new tests fail (1,000,000.00 and 1,234,567.00), with `groupThousands` mutated to `String(whole)` all 4 fail; delta review REJECT (carry of F1 s1) then OKAY after the re-run.
- `grep -nE "TODO|FIXME|HACK" src test` -> none.
- `gh issue/pr list` -> unavailable (no GH_TOKEN); no issue context.
- test/csvtotal.test.ts -> eight tests through parsePrices/sumCents/formatCents; none drives src/cli.ts.
PLAN (F2 wave 2 snapshot plan copy, the OpenSpec change folder bundle, verbatim):
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
22db88884cee3b92e4893b8977da2655390085ae3f7055c3f17b4e25f14c6158  design.md
1729c020757edde172564a72f53872aad3e3dff82b18dbb9a0c78fb3ded7b0f8  gate.md
9d45062eeef1ea8c55723da2f26de24e58fb521c7303b5d6415c0d51fa554a2a  proposal.md
c7d09ca082300993901497d2a2ec892d28b6697a394fd96b2541ae2d157a1226  review.md
55301eaa3b0c83a4e4b674314ad3138520eb054ecc90f55d79a96e6178b4241c  specs/csv-total/spec.md
e0150a88fd4d0b70bc962359b6dc7691c7aca48b93fec39edcfebcdc1b259f02  tasks.md
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

## TODOs

- [x] 4.1 Group every run of three digits in `groupThousands` (`src/format.ts`), so a total of `1234567.00` prints `1,234,567.00` instead of `1234,567.00` (F2 wave 1 blocker B1, class misgrouped-large-total). Verify: `bun test`
- [x] 4.2 Add `formatCents` tests in `test/csvtotal.test.ts` for 1,000.00, 999,999.99, 1,000,000.00 and 1,234,567.00, each seen failing when the grouping logic is broken (F2 wave 1 blocker B2, class large-total-branch-untested). Verify: `bun test`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.



- Manual QA matrix and artifacts: 
Manual QA run by the orchestrator for head b64d9652e387f2768741b29deb16c5e84e924c10 (depth standard: one row per requirement plus happy path, riskiest edge, adjacent regression, plus the tasks.md Verify commands). Fix round 1 changed only `groupThousands` (reached only for totals of 1,000 or more), test/csvtotal.test.ts and tasks.md; rows whose observed behaviour that range cannot change are carried with their reason, the rest re-run on this head.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| Q1 | Requirement "Price lines are parsed strictly": valid lines summed (F1 s1), malformed price on line 1 (F1 s2), negative control with malformed lines among valid ones, blank lines ignored, line without a comma. CARRIED from wave 1 (ecd418f): every observed total (25.00, 3.00) is below 1,000 and every other probe exits 2 before formatting, so the changed `groupThousands` is never reached | `bun src/cli.ts total FILE` with `widget,19.99\nbad,abc\ngadget,5.01\nworse,\n`; `a,1.00\n\n   \nb,2.00\n`; `widget 19.99\n` | negative control exits 2 naming lines 2 and 4 with no total; blank lines ignored (3.00); no-comma line rejected naming line 1 | stderr `error: lines 2, 4: malformed price`, stdout empty, exit 2; `3.00` exit 0; `error: line 1: malformed price` exit 2; s1 `25.00` exit 0, s2 `error: line 1: malformed price` exit 2 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q1-req-parse-strict.md |
| Q2 | Requirement "Totals are exact in cents": 0.10 + 0.20, ten lines of x,0.10 (F1 s3), empty file (F1 s4), 3 x 0.1. CARRIED from wave 1 (ecd418f): totals 0.30, 1.00, 0.00 are below 1,000 and parsing/summing code is unchanged | `bun src/cli.ts total FILE` with `a,0.10\nb,0.20\n`; `a,0.1\nb,0.1\nc,0.1\n` | `0.30`; `0.30`; `1.00` and `0.00` | `0.30` exit 0; `0.30` exit 0; s3 `1.00`, s4 `0.00` exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q2-req-exact-cents.md |
| Q3 | Happy path the goal names: `widget,19.99` + `gadget,5.01`. RE-RUN on b64d965 (the delta review rejected the carry of F1 s1) | `bun src/cli.ts total FILE` with `widget,19.99\ngadget,5.01\n` | `25.00`, exit 0 | `25.00`, empty stderr, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-2/q3-happy.md |
| Q4 | Riskiest edge: CRLF, header row, grouping boundaries 999.99, 1000.00, 1234.50, 999999.99, 1000000.00, total above one million, three-decimal prices (accepted residual). RE-RUN on b64d965 (fix changed `groupThousands`) | `bun src/cli.ts total FILE` with `widget,19.99\r\ngadget,5.01\r\n`; `name,price\nwidget,19.99\n`; `a,999.99\n`; `a,1000.00\n`; `big,1234.50\n`; `a,999999.99\n`; `a,1000000.00\n`; `big,1234567.89\n`; `a,0.125\nb,0.125\n` | `25.00`; header rejected naming line 1; `999.99`; `1,000.00`; `1,234.50`; `999,999.99`; `1,000,000.00`; `1,234,567.89`; three-decimal figure recorded, not judged | `25.00`; `error: line 1: malformed price` exit 2; `999.99`; `1,000.00`; `1,234.50`; `999,999.99`; `1,000,000.00`; `1,234,567.89`; `0.26` (each exit 0 except the header row) | PASS | .omp/team-config/evidence/gate/csv-total/wave-2/q4-riskiest-edge.md |
| Q5 | Adjacent regression: usage errors, missing file, sub-1000 total on the ungrouped `formatCents` path. CARRIED from wave 1 (ecd418f): src/cli.ts is unchanged, the error paths exit before formatting, and 12.35 is below 1,000 | `bun src/cli.ts total`; `bun src/cli.ts sum FILE`; `bun src/cli.ts total /missing.csv`; `bun src/cli.ts total FILE` with `a,0.05\nb,12.30\n` | usage line exit 2; usage line exit 2; `cannot read` exit 2; `12.35` | `usage: csvtotal total <file>` exit 2 (twice); `error: cannot read /missing.csv` exit 2; `12.35` exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q5-regression-cli.md |
| Q6 | tasks.md Verify commands 1.1, 1.2, 4.1, 4.2 (`bun test`) and 2.1 (`grep -q two design.md`). RE-RUN on b64d965 (test file and tasks.md changed) | `bun test`; `grep -q two openspec/changes/csv-total/design.md` | exit 0 each | 8 pass, 0 fail, exit 0; grep exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-2/q6-task-verifies.md |

Not exercised: quoted CSV fields and non-decimal currencies (design non-goals); totals above Number.MAX_SAFE_INTEGER cents.

- Author-supplied behavioural criteria: 
From specs/csv-total/spec.md (the OpenSpec review criteria), in five fields:
1. Invariant: a file holding any line whose price is not a number yields no total; every such line is named on stderr and the command exits 2.
   Positive witness: `widget,abc` on line 1 -> stderr names line 1, stdout empty, exit 2.
   Negative control: a total printed for a file with a malformed line (the line counted as zero or skipped) MUST fail.
   Observable: stdout, stderr and exit code of `bun src/cli.ts total FILE`.
   Boundary: the CLI process surface (stdout/stderr/exit), not parsePrices alone.
2. Invariant: the total is summed in whole cents and printed with exactly two decimals, so decimal fractions never drift.
   Positive witness: `a,0.10` + `b,0.20` prints `0.30`; an empty file prints `0.00`, exit 0.
   Negative control: ten lines of `x,0.10` printing `0.9999999999999999` or `1` MUST fail; the command prints `1.00`.
   Observable: the exact stdout string of `bun src/cli.ts total FILE`.
   Boundary: the printed CLI output, not the internal cents sum.


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