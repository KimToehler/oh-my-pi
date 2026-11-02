Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: 
GOAL: OpenSpec change `csv-total` (folder openspec/changes/csv-total). Add a `csvtotal total <file>` command (run as `bun src/cli.ts total <file>`) that sums the prices of a `name,price` file in exact whole cents and prints the total with exactly two decimals; a malformed price line is rejected with exit code 2 and a stderr message naming the line, and no total is printed. This review is the change's F2 merge gate.
CONSTRAINTS: Prices are scaled to whole cents on parse and summed as integers; formatting happens once, on the total (design.md). Non-goals: quoted CSV fields, currencies other than a bare decimal, locale formatting (design.md). gate.md: Mandatory class none; Depth standard; Risk tier product; Whole-diff review not needed (whole-diff surface reviewed in F2); Accepted residual risks: sub-cent rounding of prices with more than two decimals (src/money.ts), up to one cent against the invoice; Out of scope for blocking: none. Implementation model of this diff: onara/cc/claude-opus-5-5. Tests run with `bun test` (package.json).
BACKGROUND: Finance reconciles supplier price files by hand against the invoice; the CLI removes the manual sum and its rounding mistakes. Per gate.md, a wrong total reaches a finance reconciliation; the CLI reads one local file, writes stdout and stderr, holds no credential or personal data and changes no shared state.

- Changed files and reviewed diff: 
Base 2a9922d238ebc1c427bb1aa35881ae0d0d80cde3 (merge-base with main; main is an ancestor of HEAD, no merge needed), head ecd418fce4a870f089788aa2102397d42c8ea37c.
Changed files (`git diff --name-only 2a9922d238ebc1c427bb1aa35881ae0d0d80cde3..ecd418fce4a870f089788aa2102397d42c8ea37c`):
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

Diff (`git diff 2a9922d238ebc1c427bb1aa35881ae0d0d80cde3..ecd418fce4a870f089788aa2102397d42c8ea37c`), verbatim:
~~~diff
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
index 0000000..a5f7a07
--- /dev/null
+++ b/openspec/changes/csv-total/tasks.md
@@ -0,0 +1,19 @@
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
index bc59b9d..64cde1b 100644
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
+// Renders a whole number of 1000 or more with a thousands separator.
 export function groupThousands(whole: number): string {
-  return String(whole)
+  return String(whole).replace(/(\d)(?=(\d{3})$)/, "$1,")
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
index 0000000..5c8721c
--- /dev/null
+++ b/test/csvtotal.test.ts
@@ -0,0 +1,16 @@
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
~~~

- Repository context and plan: 
FILE PATHS: workspace root /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-a-budget/.worktrees/review-csv-total (review worktree of branch feat/csv-total, locked). Source: src/cli.ts, src/price.ts, src/cents.ts, src/money.ts, src/format.ts; test: test/csvtotal.test.ts; change folder: openspec/changes/csv-total/; QA artifacts: .omp/team-config/evidence/gate/csv-total/f1/ (tracked) and .omp/team-config/evidence/gate/csv-total/wave-1/ (on disk, not yet tracked). No other source files exist in the repository.
CONTEXT_MINING (source -> finding -> why it matters):
- `git log --oneline -20 -- src test openspec` -> three commits only: 2a9922d scaffold (main), 4e5e75b feat, ecd418f F1 QA -> no prior history, reverts or earlier fixes in this area.
- `git log --all --oneline --grep` (csv|total|format|group) -> only the two branch commits -> no related earlier work.
- `gh issue list` / `gh pr list` -> unavailable: no git remote configured and gh is unauthenticated -> no tracker context exists to mine.
- `grep -rn "TODO|FIXME|HACK" src test` -> none.
- Importers: formatCents is imported by src/cli.ts and test/csvtotal.test.ts; groupThousands is called only by formatCents -> the only consumers are inside this change.
- src/format.ts already existed on main (formatCents identical; groupThousands returned String(whole)); the diff changes groupThousands to insert a separator and both comments. proposal.md says "New files under src/ and test/ only; no existing consumer" -> format.ts is a modified existing module, not a new file; main has no other importer of it.
- `validate-openspec-change.mjs --reviewed openspec/changes/csv-total` -> "reviewed: OKAY in round 1"; `validate-gate-record.mjs --plan-only` -> passed.
RUN_COMMAND: `bun src/cli.ts total <file>`; tests `bun test`.
PLAN: the OpenSpec change folder bundle as snapshotted for this wave (.omp/team-config/gate-deltas/F2-ec58e3fc1718-wave-1.plan.md, sha256 d218dbf0113e8404403ed606d619f9382e2982dc87bc4e42146a3e2f2889cdf5), verbatim:
~~~markdown
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
22db88884cee3b92e4893b8977da2655390085ae3f7055c3f17b4e25f14c6158  design.md
1729c020757edde172564a72f53872aad3e3dff82b18dbb9a0c78fb3ded7b0f8  gate.md
9d45062eeef1ea8c55723da2f26de24e58fb521c7303b5d6415c0d51fa554a2a  proposal.md
c7d09ca082300993901497d2a2ec892d28b6697a394fd96b2541ae2d157a1226  review.md
55301eaa3b0c83a4e4b674314ad3138520eb054ecc90f55d79a96e6178b4241c  specs/csv-total/spec.md
d929e729bfa7ec8c91c9bd291d68db822f94bf88a878ddf1b6b88dcee8515a26  tasks.md
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

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.

~~~

- Manual QA matrix and artifacts: 
| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| s1 | Happy path: widget,19.99 + gadget,5.01 | `bun src/cli.ts total FILE` | stdout 25.00, exit 0 | stdout `25.00`, stderr empty, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md (carried: carried from F1 at 4e5e75b: ecd418f adds only evidence files, no behaviour change) |
| s2 | Malformed price: widget,abc on line 1 | `bun src/cli.ts total FILE` | stderr names line 1, no total, exit 2 | stdout empty, stderr `error: line 1: malformed price`, exit 2 | PASS | .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md (carried: carried from F1 at 4e5e75b: ecd418f adds only evidence files) |
| s3 | Ten lines of x,0.10 (negative control of exact cents) | `bun src/cli.ts total FILE` | stdout 1.00 | stdout `1.00`, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md (carried: carried from F1 at 4e5e75b: ecd418f adds only evidence files) |
| s4 | Empty file | `bun src/cli.ts total FILE` | stdout 0.00, exit 0 | stdout `0.00`, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md (carried: carried from F1 at 4e5e75b: ecd418f adds only evidence files) |
| s5 | Large total big,1234.50 | `bun src/cli.ts total FILE` | digits 1234.50, grouping separators allowed | stdout `1,234.50`, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/f1/s5-large.md (carried: carried from F1 at 4e5e75b: ecd418f adds only evidence files) |
| q6 | Spec scenario: a,0.10 + b,0.20 | `bun src/cli.ts total FILE` | stdout 0.30, exit 0 | stdout `0.30`, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q6-tenths.md |
| q7 | Negative control: malformed lines among valid ones (bad,abc line 2; empty, line 4) | `bun src/cli.ts total FILE` | stderr names lines 2 and 4, no total, exit 2 | stdout empty, stderr `error: lines 2, 4: malformed price`, exit 2 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q7-mixed-malformed.md |
| q8 | Riskiest edge: grouping boundary big,1234567.89 | `bun src/cli.ts total FILE` | digits 1234567.89 with exactly two decimals, exit 0; grouping separators allowed (tasks 3.1 s5) | stdout `1234,567.89`, exit 0. Digits and decimals as expected; observation: the one comma follows four leading digits and no separator marks the million, unlike q13's `1,000.00` | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q8-million.md |
| q9 | CRLF line endings: widget,19.99 + gadget,5.01 | `bun src/cli.ts total FILE` | stdout 25.00, exit 0 | stdout `25.00`, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q9-crlf.md |
| q10 | Header row name,price before widget,19.99 | `bun src/cli.ts total FILE` | header is not a price line: stderr names line 1, no total, exit 2 | stdout empty, stderr `error: line 1: malformed price`, exit 2 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q10-header.md |
| q11 | Regression (adjacent CLI path): no arguments | `bun src/cli.ts` | stderr usage line, no stdout, exit 2 | stdout empty, stderr `usage: csvtotal total <file>`, exit 2 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q11-usage.md |
| q12 | Regression (adjacent CLI path): missing file | `bun src/cli.ts total MISSING` | stderr cannot read, no stdout, exit 2 | stdout empty, stderr `error: cannot read <path>`, exit 2 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q12-unreadable.md |
| q13 | Regression (adjacent format path): threshold x,999.99 + y,0.01 | `bun src/cli.ts total FILE` | digits 1000.00 (separator allowed), exit 0 | stdout `1,000.00`, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q13-thousand.md |
| q14 | Unit suite | `bun test` | all tests pass | 4 pass, 0 fail, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/q14-bun-test.md |

QA overall: PASS (14 rows, 0 failing). Head ecd418fce4a870f089788aa2102397d42c8ea37c. Carried rows s1-s5 and the reason are stated in the Artifact column; q6-q14 were run in this wave on the head above. Artifact contents, verbatim:

----- .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md -----
~~~markdown
# F1 s1 happy path

Head: 4e5e75b (the code commit)

Input (`/tmp/f1d-data.csv`):
```
widget,19.99
gadget,5.01
```

Command: `bun src/cli.ts total /tmp/f1d-data.csv`

Expected: prints 25.00, exit 0

stdout: `25.00`

stderr: ``

exit: 0
~~~

----- .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md -----
~~~markdown
# F1 s2 malformed price

Head: 4e5e75b (the code commit)

Input (`/tmp/f1d-data.csv`):
```
widget,abc
```

Command: `bun src/cli.ts total /tmp/f1d-data.csv`

Expected: stderr names line 1, no total, exit 2

stdout: ``

stderr: `error: line 1: malformed price`

exit: 2
~~~

----- .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md -----
~~~markdown
# F1 s3 exact cents

Head: 4e5e75b (the code commit)

Input (`/tmp/f1d-data.csv`):
```
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
```

Command: `bun src/cli.ts total /tmp/f1d-data.csv`

Expected: prints 1.00

stdout: `1.00`

stderr: ``

exit: 0
~~~

----- .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md -----
~~~markdown
# F1 s4 empty file

Head: 4e5e75b (the code commit)

Input (`/tmp/f1d-data.csv`):
```
```

Command: `bun src/cli.ts total /tmp/f1d-data.csv`

Expected: prints 0.00, exit 0

stdout: `0.00`

stderr: ``

exit: 0
~~~

----- .omp/team-config/evidence/gate/csv-total/f1/s5-large.md -----
~~~markdown
# F1 s5 large total

Head: 4e5e75b (the code commit)

Input (`/tmp/f1d-data.csv`):
```
big,1234.50
```

Command: `bun src/cli.ts total /tmp/f1d-data.csv`

Expected: digits 1234.50, grouping separators allowed

stdout: `1,234.50`

stderr: ``

exit: 0
~~~

----- .omp/team-config/evidence/gate/csv-total/wave-1/q6-tenths.md -----
~~~markdown
# F2 wave 1 q6-tenths cents add exactly

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q6.csv`, shown with cat -A):
```
a,0.10$
b,0.20$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q6.csv`

Expected: prints 0.30, exit 0

stdout: `0.30`

stderr: ``

exit: 0
~~~

----- .omp/team-config/evidence/gate/csv-total/wave-1/q7-mixed-malformed.md -----
~~~markdown
# F2 wave 1 q7-mixed-malformed malformed lines among valid ones

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q7.csv`, shown with cat -A):
```
widget,19.99$
bad,abc$
gadget,5.01$
empty,$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q7.csv`

Expected: stderr names lines 2 and 4, stdout empty (no total), exit 2

stdout: ``

stderr: `error: lines 2, 4: malformed price`

exit: 2
~~~

----- .omp/team-config/evidence/gate/csv-total/wave-1/q8-million.md -----
~~~markdown
# F2 wave 1 q8-million grouping boundary at a million

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q8.csv`, shown with cat -A):
```
big,1234567.89$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q8.csv`

Expected: digits 1234567.89 with exactly two decimals, exit 0; grouping separators allowed (tasks 3.1 s5)

stdout: `1234,567.89`

stderr: ``

exit: 0
~~~

----- .omp/team-config/evidence/gate/csv-total/wave-1/q9-crlf.md -----
~~~markdown
# F2 wave 1 q9-crlf CRLF line endings

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q9.csv`, shown with cat -A):
```
widget,19.99^M$
gadget,5.01^M$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q9.csv`

Expected: prints 25.00, exit 0

stdout: `25.00`

stderr: ``

exit: 0
~~~

----- .omp/team-config/evidence/gate/csv-total/wave-1/q10-header.md -----
~~~markdown
# F2 wave 1 q10-header header row

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q10.csv`, shown with cat -A):
```
name,price$
widget,19.99$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q10.csv`

Expected: header line is not a price line: stderr names line 1, no total, exit 2 (spec: every line is name,price)

stdout: ``

stderr: `error: line 1: malformed price`

exit: 2
~~~

----- .omp/team-config/evidence/gate/csv-total/wave-1/q11-usage.md -----
~~~markdown
# F2 wave 1 q11-usage usage error (adjacent path)

Head: ecd418fce4a8, bun 1.4.4

Command: `bun src/cli.ts `

Expected: stderr usage line, no stdout, exit 2

stdout: ``

stderr: `usage: csvtotal total <file>`

exit: 2
~~~

----- .omp/team-config/evidence/gate/csv-total/wave-1/q12-unreadable.md -----
~~~markdown
# F2 wave 1 q12-unreadable unreadable file (adjacent path)

Head: ecd418fce4a8, bun 1.4.4

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/does-not-exist.csv`

Expected: stderr cannot read, no stdout, exit 2

stdout: ``

stderr: `error: cannot read /tmp/csvqa.HEsp/does-not-exist.csv`

exit: 2
~~~

----- .omp/team-config/evidence/gate/csv-total/wave-1/q13-thousand.md -----
~~~markdown
# F2 wave 1 q13-thousand grouping threshold 1000.00 and under-1000 unchanged

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q13.csv`, shown with cat -A):
```
x,999.99$
y,0.01$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q13.csv`

Expected: prints digits 1000.00 (separator allowed), exit 0

stdout: `1,000.00`

stderr: ``

exit: 0
~~~

----- .omp/team-config/evidence/gate/csv-total/wave-1/q14-bun-test.md -----
~~~markdown
# F2 wave 1 q14 bun test

Head: ecd418fce4a8

Command: `bun test`

```
bun test v1.4.4 (5d9cc0f4f)

 4 pass
 0 fail
 4 expect() calls
Ran 4 tests across 1 file. 
exit: 0
```
~~~

- Author-supplied behavioural criteria: 
The review criteria are the spec's `### Requirement:` blocks with their Negative control scenarios (openspec/changes/csv-total/specs/csv-total/spec.md), in five fields:
C1 (Requirement: Price lines are parsed strictly)
Invariant:        every non-blank line is a `name,price` line whose price is a number, or the command refuses the file, naming each such line; blank lines are ignored.
Positive witness: `widget,19.99` and `gadget,5.01` print `25.00` and exit 0.
Negative control: a file holding `widget,abc` on line 1 for which a total is printed (the line counted as zero or skipped) MUST fail; required is a stderr message naming line 1, no total, exit 2.
Observable:       stdout, stderr and exit code of `bun src/cli.ts total FILE`.
Boundary:         the CLI process output.
C2 (Requirement: Totals are exact in cents)
Invariant:        the command sums whole cents and prints the total with exactly two decimals, so decimal fractions never drift.
Positive witness: `a,0.10` and `b,0.20` print `0.30`; an empty file prints `0.00` and exits 0.
Negative control: ten lines of `x,0.10` printing `0.9999999999999999` or `1` MUST fail; required is `1.00`.
Observable:       stdout of `bun src/cli.ts total FILE`.
Boundary:         the CLI process output.


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
