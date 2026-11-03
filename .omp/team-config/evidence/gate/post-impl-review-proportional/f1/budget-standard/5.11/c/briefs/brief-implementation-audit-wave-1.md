Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: Goal (OpenSpec change `csv-total`, proposal.md): add a `csvtotal total <file>` command that sums the prices of a `name,price` file in exact cents and prints the total with two decimals, and rejects a malformed price line with exit code 2 and a message naming the line, so finance can reconcile supplier price files against the invoice without a manual sum.
Constraints: spec.md requirements "Price lines are parsed strictly" (one `name,price` line per row, blank lines ignored, a file holding a line whose price is not a number is refused, naming each such line; such a line is never counted as zero or skipped) and "Totals are exact in cents" (whole cents summed, exactly two decimals printed, no decimal drift; empty file prints `0.00`). design.md: prices scaled to whole cents on parse, summed as integers, formatted once on the total; Non-Goals: quoted CSV fields, currencies other than a bare decimal, locale formatting. gate.md: Mandatory class none, Depth standard, Risk tier product, Accepted residual risk: sub-cent rounding per line (`src/money.ts`); Out of scope for blocking: none.
Background: finance reconciles supplier price files by hand; a wrong total reaches a finance reconciliation (gate.md author's risk assessment). Standalone local CLI: reads one local file, writes stdout/stderr, holds no credential or personal data, changes no shared state.
Integration note: the default branch `main` moved after F1 (d5da87c "feat: group thousands in formatted totals of 1000 or more", changing `groupThousands` in the pre-existing `src/format.ts` to `whole.toLocaleString("en-US")`). It was merged into the work branch as f09ecefde27c257583c9a30824a656479b241ead before this wave, so the reviewed tree prints totals >= 1000 with `,` group separators (e.g. `1,234.50`). `src/format.ts` is not in the branch diff below (it lives on `main` since the scaffold a951855) but `src/cli.ts` in the diff consumes `formatCents` from it; the seam between the branch and the merged change is `src/cli.ts` -> `formatCents` -> `groupThousands`. tasks.md 3.1 s5 accepts the total "with or without grouping separators".
- Changed files and reviewed diff: Changed files (git diff --name-only d5da87c69d4d...f09ecefde27c):
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
src/money.ts
src/price.ts
test/csvtotal.test.ts
```
Reviewed diff (git diff d5da87c69d4d...f09ecefde27c, DIFF_RANGE):
```diff
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md b/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
new file mode 100644
index 0000000..8ec163d
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
@@ -0,0 +1,49 @@
+# F1 s1-happy: Valid lines are summed
+
+- Head: `d0c56d3633318caebd703282dc70635d4768bc7d` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
+- Runtime: bun 1.4.4
+- Command (repo root): `bun src/cli.ts total s1-happy.csv`
+- Input `s1-happy.csv` (25 bytes):
+
+```
+widget,19.99
+gadget,5.01
+```
+
+## Observed
+
+- exit: 0
+- stdout:
+
+```
+25.00
+```
+
+- stderr:
+
+```
+```
+
+## Expected
+
+stdout `25.00`, exit 0
+
+Check result on head: MATCH
+
+## Negative control
+
+Same input and check against a scratch copy of `src/` outside the repo with one mutation (decimal part dropped): src/cents.ts: `roundToCents(Number(text))` -> `roundToCents(parseInt(text))`
+
+- exit: 0
+- stdout:
+
+```
+24.00
+```
+
+- stderr:
+
+```
+```
+
+Check result on mutant: NO MATCH
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md b/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
new file mode 100644
index 0000000..5359511
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
@@ -0,0 +1,48 @@
+# F1 s2-malformed: Malformed price is rejected with its line number
+
+- Head: `d0c56d3633318caebd703282dc70635d4768bc7d` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
+- Runtime: bun 1.4.4
+- Command (repo root): `bun src/cli.ts total s2-malformed.csv`
+- Input `s2-malformed.csv` (11 bytes):
+
+```
+widget,abc
+```
+
+## Observed
+
+- exit: 2
+- stdout:
+
+```
+```
+
+- stderr:
+
+```
+error: line 1: malformed price
+```
+
+## Expected
+
+stderr names line 1, stdout empty (no total), exit 2
+
+Check result on head: MATCH
+
+## Negative control
+
+Same input and check against a scratch copy of `src/` outside the repo with one mutation (malformed price counted as zero): src/cents.ts: `return null` -> `return 0`
+
+- exit: 0
+- stdout:
+
+```
+0.00
+```
+
+- stderr:
+
+```
+```
+
+Check result on mutant: NO MATCH
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md b/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
new file mode 100644
index 0000000..205b08c
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
@@ -0,0 +1,57 @@
+# F1 s3-cents: Ten lines of x,0.10
+
+- Head: `d0c56d3633318caebd703282dc70635d4768bc7d` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
+- Runtime: bun 1.4.4
+- Command (repo root): `bun src/cli.ts total s3-cents.csv`
+- Input `s3-cents.csv` (70 bytes):
+
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
+## Observed
+
+- exit: 0
+- stdout:
+
+```
+1.00
+```
+
+- stderr:
+
+```
+```
+
+## Expected
+
+stdout `1.00`, exit 0
+
+Check result on head: MATCH
+
+## Negative control
+
+Same input and check against a scratch copy of `src/` outside the repo with one mutation (summed as float dollars, scaled to cents at the end): src/price.ts: `prices.reduce((total, price) => total + price.cents, 0)` -> `prices.reduce((total, price) => total + price.cents / 100, 0) * 100`
+
+- exit: 0
+- stdout:
+
+```
+0.99.99999999999999
+```
+
+- stderr:
+
+```
+```
+
+Check result on mutant: NO MATCH
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md b/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
new file mode 100644
index 0000000..166384d
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
@@ -0,0 +1,47 @@
+# F1 s4-empty: Empty file
+
+- Head: `d0c56d3633318caebd703282dc70635d4768bc7d` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
+- Runtime: bun 1.4.4
+- Command (repo root): `bun src/cli.ts total s4-empty.csv`
+- Input `s4-empty.csv` (0 bytes):
+
+```
+```
+
+## Observed
+
+- exit: 0
+- stdout:
+
+```
+0.00
+```
+
+- stderr:
+
+```
+```
+
+## Expected
+
+stdout `0.00`, exit 0
+
+Check result on head: MATCH
+
+## Negative control
+
+Same input and check against a scratch copy of `src/` outside the repo with one mutation (blank lines not ignored): src/price.ts: `if (line.trim() === "") continue` -> `if (false) continue`
+
+- exit: 2
+- stdout:
+
+```
+```
+
+- stderr:
+
+```
+error: line 1: malformed price
+```
+
+Check result on mutant: NO MATCH
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md b/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
new file mode 100644
index 0000000..5033de7
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
@@ -0,0 +1,48 @@
+# F1 s5-large: Large amount big,1234.50
+
+- Head: `d0c56d3633318caebd703282dc70635d4768bc7d` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
+- Runtime: bun 1.4.4
+- Command (repo root): `bun src/cli.ts total s5-large.csv`
+- Input `s5-large.csv` (12 bytes):
+
+```
+big,1234.50
+```
+
+## Observed
+
+- exit: 0
+- stdout:
+
+```
+1234.50
+```
+
+- stderr:
+
+```
+```
+
+## Expected
+
+stdout digits `1234.50` (grouping separators allowed), exit 0
+
+Check result on head: MATCH
+
+## Negative control
+
+Same input and check against a scratch copy of `src/` outside the repo with one mutation (formats without fixed two decimals): src/format.ts: `return `${head}.${String(rest).padStart(2, "0")}`` -> `return String(cents / 100)`
+
+- exit: 0
+- stdout:
+
+```
+1234.5
+```
+
+- stderr:
+
+```
+```
+
+Check result on mutant: NO MATCH
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
```
- Repository context and plan: Workspace root (review worktree, read-only for you): /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r511-c/.worktrees/review-csv-total
Reviewed commit f09ecefde27c257583c9a30824a656479b241ead (branch feat/csv-total), diff base d5da87c69d4db85d6c12d8a37c933181d2dba35f (merge-base with `main`, which is now `main` itself).
Changed-file paths are relative to that root. Neighbouring file that shows the formatter the CLI consumes: `src/format.ts` (current content below). Plan: OpenSpec change folder `openspec/changes/csv-total/` (snapshot bundle below; this is the exact plan input of this wave).

Current `src/format.ts` on the reviewed head:
```ts
// Formats whole cents as a decimal string with exactly two decimals.
export function formatCents(cents: number): string {
  const whole = Math.trunc(cents / 100)
  const rest = Math.abs(cents % 100)
  const head = whole >= 1000 ? groupThousands(whole) : String(whole)
  return `${head}.${String(rest).padStart(2, "0")}`
}

// Renders a whole number of 1000 or more with grouped thousands.
export function groupThousands(whole: number): string {
  return whole.toLocaleString("en-US")
}
```

Merge delta brought in from `main` (git diff a56d6c1 f09ecefde27c, i.e. pre-merge head to reviewed head):
```diff
diff --git a/src/format.ts b/src/format.ts
index bc59b9d..c2302d3 100644
--- a/src/format.ts
+++ b/src/format.ts
@@ -6,7 +6,7 @@ export function formatCents(cents: number): string {
   return `${head}.${String(rest).padStart(2, "0")}`
 }
 
-// Renders a whole number of 1000 or more.
+// Renders a whole number of 1000 or more with grouped thousands.
 export function groupThousands(whole: number): string {
-  return String(whole)
+  return whole.toLocaleString("en-US")
 }
```

CONTEXT_MINING (source -> finding -> why it matters):
- `git log -- src/format.ts` -> a951855 scaffold, then d5da87c on `main` switches `groupThousands` to `toLocaleString("en-US")` -> the reviewed CLI's output for totals >= 1000 now carries `,` separators; design.md lists "locale formatting" as a Non-Goal and the spec says only "exactly two decimals".
- `git log -- src/cents.ts src/cli.ts src/money.ts src/price.ts test/csvtotal.test.ts` -> single commit 0cd516d each -> no prior history or reverts in this area.
- `git log --all --grep=total` -> 0cd516d, d0c56d3 (first merge of `main`, README), a56d6c1 (F1 QA evidence), d5da87c, f09ecef (second merge of `main`) -> no related reverts.
- `rg TODO|FIXME|HACK src test` -> none.
- GitHub issues/PRs -> not available (no remote configured, `gh` unauthenticated).
- Consumers: design.md "nothing else in the repository reads these files"; `bun test` on the reviewed head: 4 pass, 0 fail (test/csvtotal.test.ts does not cover totals >= 1000).

Plan snapshot bundle (verbatim):
```
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

```
- Manual QA matrix and artifacts: Depth standard: one row per requirement, plus happy path, riskiest edge, adjacent regression. All rows PASS. Artifacts are under the record's evidence directory `.omp/team-config/evidence/gate/csv-total/` in the worktree.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Requirement "Price lines are parsed strictly" (valid lines summed; malformed price rejected with line number; negative control) | `bun src/cli.ts total FILE` on `widget,19.99`+`gadget,5.01`, and on `widget,abc`; mutants on scratch copies | `25.00` exit 0; stderr names line 1, no stdout, exit 2; zero-counting mutant fails | `25.00` exit 0; `error: line 1: malformed price` exit 2, empty stdout; mutant prints `0.00` (NO MATCH) | PASS (CARRIED from F1 on d0c56d3: the merge of `main` touches only `groupThousands`, which these outputs never reach - whole part 25 < 1000, s2 throws before formatting) | `.omp/team-config/evidence/gate/csv-total/wave-1/qa1-r1-parse-strict.md` (folds `f1/s1-happy.md`, `f1/s2-malformed.md`) |
| QA2 | Requirement "Totals are exact in cents" (cents add exactly; empty file; negative control ten lines of `x,0.10`) | `bun src/cli.ts total FILE` on `a,0.10`+`b,0.20` (new, on f09ecefde27c); empty file and ten `x,0.10` lines (F1); float-sum mutant | `0.30`; `0.00` exit 0; `1.00`, never `0.9999999999999999`/`1` | `0.30` exit 0 (mutant `0.30.000000000000004`, NO MATCH); `0.00`; `1.00` (mutant `0.99.99999999999999`, NO MATCH) | PASS (`0.30` re-observed on reviewed head; s3/s4 CARRIED from d0c56d3: totals 1 and 0 never reach `groupThousands`) | `.omp/team-config/evidence/gate/csv-total/wave-1/qa2-r2-exact-cents.md` (cites `f1/s3-cents.md`, `f1/s4-empty.md`) |
| QA3 | Happy path the goal names | `bun src/cli.ts total FILE` on `widget,19.99`+`gadget,5.01` | `25.00`, exit 0 | `25.00`, exit 0; decimal-dropping mutant `24.00` | PASS (CARRIED from F1 on d0c56d3, same reason as QA1) | `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` |
| QA4 | Riskiest edge: the 1000 grouping boundary introduced by the merged `main` change | `bun src/cli.ts total FILE` on `a,999.99`; `a,999.99`+`b,0.01`; `a,1234567.89`; `de-DE` locale mutant | digits with `,` removed equal `999.99`, `1000.00`, `1234567.89`; two decimals; exit 0 | `999.99`, `1,000.00`, `1,234,567.89`, exit 0; mutant `1.000.00`, `1.234.567.89` (NO MATCH at and above 1000) | PASS (new on f09ecefde27c) | `.omp/team-config/evidence/gate/csv-total/wave-1/qa4-edge-grouping-boundary.md` |
| QA5 | Regression on adjacent behaviour: F1 s5 large amount, re-run because the merge changed the code it reaches | `bun src/cli.ts total FILE` on `big,1234.50`; fixed-two-decimals mutant | digits `1234.50`, separators allowed, exit 0 | `1,234.50`, exit 0; mutant `1234.5` (NO MATCH) | PASS (RE-RUN on f09ecefde27c; `f1/s5-large.md` printed `1234.50` on d0c56d3 and is stale) | `.omp/team-config/evidence/gate/csv-total/wave-1/qa5-s5-large-rerun.md` |

Also observed: `bun test` on f09ecefde27c: 4 pass, 0 fail.
- Author-supplied behavioural criteria: The plan supplies no separate criteria list; the spec's scenarios, in five fields:
1. Invariant: a file holding a line whose price is not a number never yields a total. Positive witness: `widget,abc` -> stderr `error: line 1: malformed price`, empty stdout, exit 2. Negative control: the line counted as zero or skipped, printing `0.00`, exit 0. Observable: CLI exit code, stdout, stderr. Boundary: the `csvtotal total` CLI process.
2. Invariant: decimal prices sum without floating-point drift and print with exactly two decimals. Positive witness: ten lines of `x,0.10` print `1.00`; `a,0.10`+`b,0.20` print `0.30`. Negative control: `0.9999999999999999`, `1`, or `0.30000000000000004`. Observable: CLI stdout. Boundary: the `csvtotal total` CLI process.
3. Invariant: blank lines are ignored and an empty file is a zero total, not an error. Positive witness: empty file prints `0.00`, exit 0. Negative control: empty file rejected as malformed line 1, exit 2. Observable: CLI exit code and stdout. Boundary: the `csvtotal total` CLI process.
4. Invariant (tasks.md 3.1 s5): a total of 1000 or more keeps its exact digits and two decimals; grouping separators are allowed. Positive witness: `big,1234.50` prints `1234.50` or `1,234.50`. Negative control: `1234.5`. Observable: CLI stdout. Boundary: the `csvtotal total` CLI process.

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
