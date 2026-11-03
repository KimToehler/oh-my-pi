Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: Goal: finance reconciles supplier price files by hand against the invoice; the OpenSpec change `csv-total` adds a standalone CLI, `csvtotal total <file>` (run as `bun src/cli.ts total <file>`), that sums the prices of a `name,price` file in exact cents and prints the total with two decimals, and rejects a malformed price line with exit code 2 and a message naming the line (proposal.md). This review is the change's F2 merge gate (review-work, depth `standard`).
  Constraints: prices are scaled to whole cents on parse and summed as integers; formatting happens once, on the total (design.md). Non-goals: quoted CSV fields, currencies other than a bare decimal, locale formatting (design.md). Mandatory class `none`, Depth `standard`, Risk tier `product`, Whole-diff review `not needed (whole-diff surface reviewed in F2)` (gate.md). Accepted residual risk: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected (gate.md). Out of scope for blocking: none (gate.md). Runtime: bun 1.4.4; tests `bun test`.
  Background: new files under `src/` and `test/` only, no existing consumer (proposal.md Impact). `src/format.ts` (`formatCents`, `groupThousands`) already existed on the default branch from the scaffold and is not changed by this branch; the default branch `main` moved after F1 with 1e88cd0 "feat: group thousands in formatted totals of 1000 or more" (`groupThousands` now returns `whole.toLocaleString("en-US")`), and F2 merged it into the work branch as 8662301 before the gate baseline. The reviewed diff is therefore against the merge-base, which is that main commit; the seam between this branch and the merged formatter is the total of 1000 or more (`cli.ts` -> `formatCents` -> `groupThousands`), which prints e.g. `1,234.50`. tasks.md 3.1 s5 accepts the digits `1234.50` "with or without grouping separators"; judge whether the merged output still meets the spec and the design non-goals.
- Changed files and reviewed diff: Diff range (DIFF_RANGE): 1e88cd033bef52d7a9270a7d86c843cd32b68790..86623019d0decf13b0faad42b9b12368448797a2 (`git diff 1e88cd033bef52d7a9270a7d86c843cd32b68790 86623019d0decf13b0faad42b9b12368448797a2`; base = `git merge-base main HEAD`, reviewed head = 86623019d0decf13b0faad42b9b12368448797a2).
  Changed files:
  - .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
  - .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
  - .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
  - .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
  - .omp/team-config/evidence/gate/csv-total/f1/s5-large.md
  - openspec/changes/csv-total/.openspec.yaml
  - openspec/changes/csv-total/design.md
  - openspec/changes/csv-total/gate.md
  - openspec/changes/csv-total/proposal.md
  - openspec/changes/csv-total/review.md
  - openspec/changes/csv-total/specs/csv-total/spec.md
  - openspec/changes/csv-total/tasks.md
  - src/cents.ts
  - src/cli.ts
  - src/money.ts
  - src/price.ts
  - test/csvtotal.test.ts
  Diff:
```diff
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md b/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
new file mode 100644
index 0000000..33ee7e8
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
@@ -0,0 +1,35 @@
+# F1 s1-happy: Valid lines are summed
+
+- Change: csv-total (task 3.1)
+- Head: `ec36fb4e6026b5ff34806a2a261417f57968899a` (working tree clean at capture)
+- Captured: 2026-11-03T09:47:36+01:00
+- Runtime: bun 1.4.4
+- Command: `bun src/cli.ts total s1-happy.csv` (cwd = repo root; input file in a temp dir)
+
+## Input file (25 bytes, 2 lines)
+
+```
+widget,19.99
+gadget,5.01
+```
+
+Input repr: `'widget,19.99\ngadget,5.01\n'`
+
+## Observed
+
+- Exit code: `0`
+- stdout repr: `'25.00\n'`
+- stderr repr: `''`
+
+## Probe
+
+- Expected: stdout is exactly `25.00`, stderr empty, exit 0
+- Probe result on head: MATCH
+
+## Negative control (probe can go red)
+
+- Mutation, applied to a temp copy of `src/` only: `src/price.ts`: `total + price.cents` → `total + 0` (sumCents ignores each line's cents)
+- Exit code: `0`
+- stdout repr: `'0.00\n'`
+- stderr repr: `''`
+- Probe result on mutant: NO MATCH
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md b/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
new file mode 100644
index 0000000..d213dae
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
@@ -0,0 +1,34 @@
+# F1 s2-malformed: Malformed price is rejected with its line number
+
+- Change: csv-total (task 3.1)
+- Head: `ec36fb4e6026b5ff34806a2a261417f57968899a` (working tree clean at capture)
+- Captured: 2026-11-03T09:47:36+01:00
+- Runtime: bun 1.4.4
+- Command: `bun src/cli.ts total s2-malformed.csv` (cwd = repo root; input file in a temp dir)
+
+## Input file (11 bytes, 1 lines)
+
+```
+widget,abc
+```
+
+Input repr: `'widget,abc\n'`
+
+## Observed
+
+- Exit code: `2`
+- stdout repr: `''`
+- stderr repr: `'error: line 1: malformed price\n'`
+
+## Probe
+
+- Expected: stderr names line 1, stdout empty (no total), exit 2
+- Probe result on head: MATCH
+
+## Negative control (probe can go red)
+
+- Mutation, applied to a temp copy of `src/` only: `src/cents.ts`: `return null` → `return 0` (a malformed price is counted as zero cents (spec negative control))
+- Exit code: `0`
+- stdout repr: `'0.00\n'`
+- stderr repr: `''`
+- Probe result on mutant: NO MATCH
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md b/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
new file mode 100644
index 0000000..9eaf6ce
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
@@ -0,0 +1,43 @@
+# F1 s3-cents: Ten lines of x,0.10 add exactly
+
+- Change: csv-total (task 3.1)
+- Head: `ec36fb4e6026b5ff34806a2a261417f57968899a` (working tree clean at capture)
+- Captured: 2026-11-03T09:47:36+01:00
+- Runtime: bun 1.4.4
+- Command: `bun src/cli.ts total s3-cents.csv` (cwd = repo root; input file in a temp dir)
+
+## Input file (70 bytes, 10 lines)
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
+Input repr: `'x,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\n'`
+
+## Observed
+
+- Exit code: `0`
+- stdout repr: `'1.00\n'`
+- stderr repr: `''`
+
+## Probe
+
+- Expected: stdout is exactly `1.00`, stderr empty, exit 0
+- Probe result on head: MATCH
+
+## Negative control (probe can go red)
+
+- Mutation, applied to a temp copy of `src/` only: `src/format.ts`: `return `${head}.${String(rest).padStart(2, "0")}`` → `return String(cents / 100)` (formatter prints the float dollars (`1`, spec negative control))
+- Exit code: `0`
+- stdout repr: `'1\n'`
+- stderr repr: `''`
+- Probe result on mutant: NO MATCH
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md b/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
new file mode 100644
index 0000000..80907bf
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
@@ -0,0 +1,33 @@
+# F1 s4-empty: Empty file
+
+- Change: csv-total (task 3.1)
+- Head: `ec36fb4e6026b5ff34806a2a261417f57968899a` (working tree clean at capture)
+- Captured: 2026-11-03T09:47:36+01:00
+- Runtime: bun 1.4.4
+- Command: `bun src/cli.ts total s4-empty.csv` (cwd = repo root; input file in a temp dir)
+
+## Input file (0 bytes, 0 lines)
+
+```
+```
+
+Input repr: `''`
+
+## Observed
+
+- Exit code: `0`
+- stdout repr: `'0.00\n'`
+- stderr repr: `''`
+
+## Probe
+
+- Expected: stdout is exactly `0.00`, stderr empty, exit 0
+- Probe result on head: MATCH
+
+## Negative control (probe can go red)
+
+- Mutation, applied to a temp copy of `src/` only: `src/format.ts`: `String(rest).padStart(2, "0")` → `String(rest)` (formatter drops the cents zero-padding)
+- Exit code: `0`
+- stdout repr: `'0.0\n'`
+- stderr repr: `''`
+- Probe result on mutant: NO MATCH
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md b/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
new file mode 100644
index 0000000..c2edae9
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
@@ -0,0 +1,34 @@
+# F1 s5-large: Total of 1000 or more
+
+- Change: csv-total (task 3.1)
+- Head: `ec36fb4e6026b5ff34806a2a261417f57968899a` (working tree clean at capture)
+- Captured: 2026-11-03T09:47:37+01:00
+- Runtime: bun 1.4.4
+- Command: `bun src/cli.ts total s5-large.csv` (cwd = repo root; input file in a temp dir)
+
+## Input file (12 bytes, 1 lines)
+
+```
+big,1234.50
+```
+
+Input repr: `'big,1234.50\n'`
+
+## Observed
+
+- Exit code: `0`
+- stdout repr: `'1234.50\n'`
+- stderr repr: `''`
+
+## Probe
+
+- Expected: stdout digits are `1234.50` (grouping separators allowed), stderr empty, exit 0
+- Probe result on head: MATCH
+
+## Negative control (probe can go red)
+
+- Mutation, applied to a temp copy of `src/` only: `src/format.ts`: `return String(whole)` → `return String(whole % 1000)` (thousands grouping drops the leading group)
+- Exit code: `0`
+- stdout repr: `'234.50\n'`
+- stderr repr: `''`
+- Probe result on mutant: NO MATCH
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
- Repository context and plan: Repository root (read-only for you): /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r55-c/.worktrees/review-csv-total
  Files to read: src/cli.ts, src/price.ts, src/cents.ts, src/money.ts, src/format.ts (unchanged by the branch; base version from main 1e88cd0), test/csvtotal.test.ts, package.json, openspec/changes/csv-total/ (proposal.md, design.md, gate.md, tasks.md, review.md, specs/csv-total/spec.md), QA artifacts under .omp/team-config/evidence/gate/csv-total/f1/ and .omp/team-config/evidence/gate/csv-total/wave-1/.
  Context mining (source -> finding -> why it matters):
  - `git log --oneline -- src test openspec README.md` -> 0cd516d adds the CLI and change folder; ec36fb4 merges main (README only); e28acf5 commits F1 evidence captured on ec36fb4; 8662301 merges main again (1e88cd0, thousands grouping in src/format.ts) after F1 -> F1 row s5 observed the old formatter and is re-run in this wave; rows s1-s4 never reach `groupThousands`.
  - `git log --all --oneline --grep='total\|cents\|thousand'` -> only the commits above; no reverts, no earlier attempt -> no prior decision to honour beyond the change folder.
  - `gh issue list` / `gh pr list` -> the repository has no remote, so no issues or PRs exist to mine -> nothing missed there.
  - `rg -n 'TODO|FIXME|HACK' src test` -> no hits.
  - importers of the changed modules (`rg -n 'format|groupThousands|formatCents'`) -> only src/cli.ts and test/csvtotal.test.ts import `format`/`price`; nothing else in the repository reads them -> no other consumer.
  - openspec/changes/csv-total/review.md -> plan-reviewer OKAY in round 1 on digest cbecfe31ba71a24c797e877483b12781837b75bb3bda3fb859ad5c60a3a7b436; `validate-openspec-change.mjs --digest` on the folder prints the same digest and `--reviewed` prints `reviewed: OKAY in round 1` -> the folder reviewed at plan time is the folder under review now.
  Plan (the immutable F2 wave-1 plan copy, a bundle of the change folder; plan_sha256 d218dbf0113e8404403ed606d619f9382e2982dc87bc4e42146a3e2f2889cdf5):
```text
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
- Manual QA matrix and artifacts: Head under QA: 86623019d0decf13b0faad42b9b12368448797a2 (bun 1.4.4, clean tree). Each row's artifact holds the exact command, input repr, exit code, stdout and stderr repr, and a negative control on a mutated temp copy of `src/` that turns the probe red.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Requirement `Price lines are parsed strictly`, Scenario `Valid lines are summed` (minimum happy path) - CARRIED: carried from F1 on ec36fb4: the only later code change is the merge of main 1e88cd0, which changes `groupThousands`, reached only when the total is 1000 or more; this row's total stays below 1000 (or no total is formatted), so the merge cannot change what it observed | `bun src/cli.ts total s1-happy.csv` with `widget,19.99\ngadget,5.01\n` | stdout `25.00`, stderr empty, exit 0 | stdout `25.00`, exit 0; mutant (`total + 0`) prints `0.00`, probe red | PASS | .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md |
| QA2 | Requirement `Price lines are parsed strictly`, Scenarios `Malformed price is rejected with its line number` and `Negative control` (minimum riskiest edge: malformed input) - CARRIED: carried from F1 on ec36fb4: the only later code change is the merge of main 1e88cd0, which changes `groupThousands`, reached only when the total is 1000 or more; this row's total stays below 1000 (or no total is formatted), so the merge cannot change what it observed | `bun src/cli.ts total s2-malformed.csv` with `widget,abc\n` | stderr names line 1, no total, exit 2 | stderr `error: line 1: malformed price`, stdout empty, exit 2; mutant (malformed counted as 0) prints `0.00` exit 0, probe red | PASS | .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md |
| QA3 | Requirement `Totals are exact in cents`, Scenario `Negative control` (ten lines of `x,0.10`) - CARRIED: carried from F1 on ec36fb4: the only later code change is the merge of main 1e88cd0, which changes `groupThousands`, reached only when the total is 1000 or more; this row's total stays below 1000 (or no total is formatted), so the merge cannot change what it observed | `bun src/cli.ts total s3-cents.csv` with ten lines `x,0.10` | stdout `1.00`, exit 0 | stdout `1.00`, exit 0; mutant (float dollars) prints `1`, probe red | PASS | .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md |
| QA4 | Requirement `Totals are exact in cents`, Scenario `Empty file` (boundary input) - CARRIED: carried from F1 on ec36fb4: the only later code change is the merge of main 1e88cd0, which changes `groupThousands`, reached only when the total is 1000 or more; this row's total stays below 1000 (or no total is formatted), so the merge cannot change what it observed | `bun src/cli.ts total s4-empty.csv` with an empty file | stdout `0.00`, exit 0 | stdout `0.00`, exit 0; mutant (no zero-padding) prints `0.0`, probe red | PASS | .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md |
| QA5 | tasks.md 3.1 s5, total of 1000 or more, re-run on the merged head because the merge of main 1e88cd0 changed `groupThousands` (seam with the merged formatter) | `bun src/cli.ts total s5-large.csv` with `big,1234.50\n` | stdout digits `1234.50` (grouping separators allowed), stderr empty, exit 0 | stdout `1,234.50`, exit 0; mutant (`whole % 1000`) prints `234.50`, probe red | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/s5-large.md |
| QA6 | Requirement `Totals are exact in cents`, Scenario `Cents add exactly` (missing from the F1 matrix, captured new) | `bun src/cli.ts total r2.csv` with `a,0.10\nb,0.20\n` | stdout `0.30`, exit 0 | stdout `0.30`, exit 0; mutant (float-dollar sum) prints `0.30.000000000000004`, probe red | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/r2-cents-add.md |
| QA7 | Riskiest edge for `Price lines are parsed strictly`: several malformed lines (`bad,abc`, `nocomma`) among valid and blank lines; each named, blank line ignored without shifting numbering | `bun src/cli.ts total edge.csv` with `widget,19.99\nbad,abc\n\ngadget,5.01\nnocomma\n` | stderr `error: lines 2, 5: malformed price`, no total, exit 2 | exactly that, stdout empty, exit 2; mutant (first line only) prints `lines 2`, probe red | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/edge-multi-malformed.md |
| QA8 | Regression on adjacent behaviour: usage and unreadable-file exits, and the unit suite on the merged head | `bun src/cli.ts`; `bun src/cli.ts sum x.csv`; `bun src/cli.ts total does-not-exist.csv`; `bun test` | usage message / `error: cannot read does-not-exist.csv`, no stdout, exit 2; `bun test` green | all three exit 2 with those messages and empty stdout; `bun test` 4 pass 0 fail; mutant (read error exits 0) turns the missing-file case red | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/regression-cli-errors.md |
- Author-supplied behavioural criteria: Criterion C1 (spec Requirement: Price lines are parsed strictly):
    Invariant:        every non-blank line whose price is not a number makes the command refuse the file, name that line by its 1-based file line number on stderr, print no total and exit 2; blank lines are ignored.
    Positive witness: `widget,19.99` and `gadget,5.01` print `25.00` and exit 0; `widget,abc` on line 1 prints a message naming line 1 on stderr, nothing on stdout, exit 2.
    Negative control: a file holding a malformed price prints a total (the line counted as zero or skipped) or exits 0 - MUST fail.
    Observable:       stdout, stderr and exit code of `bun src/cli.ts total <file>`.
    Boundary:         the CLI process output (stdout/stderr/exit code), not the parser's return value.
  Criterion C2 (spec Requirement: Totals are exact in cents):
    Invariant:        the command sums whole cents and prints the total with exactly two decimals, so decimal fractions never drift.
    Positive witness: `a,0.10` and `b,0.20` print `0.30`; an empty file prints `0.00` and exits 0; ten lines of `x,0.10` print `1.00`.
    Negative control: ten lines of `x,0.10` printing `0.9999999999999999` or `1` MUST fail.
    Observable:       stdout of `bun src/cli.ts total <file>`.
    Boundary:         the printed total on stdout.

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
