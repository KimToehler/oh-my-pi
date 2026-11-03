Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract:   GOAL: OpenSpec change `csv-total` (folder `openspec/changes/csv-total/`). Add a `csvtotal total <file>` command (`bun src/cli.ts total FILE`) that sums the prices of a `name,price` file in exact whole cents and prints the total with two decimals; reject a malformed price line with exit code 2 and a stderr message naming the line, printing no total. Finance uses the total to reconcile supplier price files against the invoice by hand. This review is the change's F2 merge gate (review-work, depth standard).
  CONSTRAINTS: spec `specs/csv-total/spec.md` (two requirements: price lines parsed strictly, naming each malformed line and ignoring blank lines; totals exact in cents with exactly two decimals). design.md: prices scaled to whole cents on parse and summed as integers, formatting once on the total; non-goals: quoted CSV fields, currencies other than a bare decimal, locale formatting. gate.md: Mandatory class none, Depth standard, Risk tier product, Whole-diff review not needed (whole-diff surface reviewed in F2); Accepted residual risks: sub-cent rounding of prices with more than two decimals (`src/money.ts`) can make the total differ from the invoice by one cent; Out of scope for blocking: none. tasks.md 3.1 (F1): five QA scenarios; `s5-large` accepts a total whose digits are `1234.50` with or without grouping separators.
  BACKGROUND: proposal.md - finance reconciles supplier price files by hand; the CLI removes the manual sum and its rounding mistakes. New files under `src/` and `test/` only; no existing consumer. `src/format.ts` (`formatCents`, `groupThousands`) predates the change (scaffold a951855, on `main`); the branch imports it unchanged. After F1 was captured, `main` gained 7b6e2e2 (`groupThousands` now returns `whole.toLocaleString("en-US")`), merged into the branch as ab95eaf before this gate; it is part of the base, not of the reviewed diff, but it changes what the CLI prints for totals of 1000 or more.
- Changed files and reviewed diff:   Reviewed range: DIFF_RANGE = 7b6e2e22df9ce21abd7238dcef6f65000e9bcb6b..ab95eaf4a37afc15dfc35c40fcbcd86b605debb5 (base = merge-base with `main` = `main` tip 7b6e2e2; head = branch `feat/csv-total`, merge commit ab95eaf).
  Changed files (`git diff --name-status 7b6e2e22df9ce21abd7238dcef6f65000e9bcb6b ab95eaf4a37afc15dfc35c40fcbcd86b605debb5`):
    A	.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
    A	.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
    A	.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
    A	.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
    A	.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
    A	openspec/changes/csv-total/.openspec.yaml
    A	openspec/changes/csv-total/design.md
    A	openspec/changes/csv-total/gate.md
    A	openspec/changes/csv-total/proposal.md
    A	openspec/changes/csv-total/review.md
    A	openspec/changes/csv-total/specs/csv-total/spec.md
    A	openspec/changes/csv-total/tasks.md
    A	src/cents.ts
    A	src/cli.ts
    A	src/money.ts
    A	src/price.ts
    A	test/csvtotal.test.ts

  Diff (`git diff 7b6e2e22df9ce21abd7238dcef6f65000e9bcb6b ab95eaf4a37afc15dfc35c40fcbcd86b605debb5`, verbatim):

```diff
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md b/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
new file mode 100644
index 0000000..a31cb8d
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
@@ -0,0 +1,29 @@
+# F1 s1-happy — csv-total
+
+- **Change**: csv-total, task 3.1 (F1 manual QA on the real surface)
+- **Head**: `19eb3d486b907bd52ea4ddba42ced6ab15774742` (branch `feat/csv-total`, after merging `main`; last code commit `0cd516d`)
+- **Runtime**: bun 1.4.4
+- **Command**: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-zqecoio1/s1-happy.csv`
+- **Expected (task 3.1)**: `widget,19.99` and `gadget,5.01` print `25.00`, exit 0
+
+## Input file
+
+2 newline-terminated line(s), 25 bytes. Python `repr` of the bytes written:
+
+```
+'widget,19.99\ngadget,5.01\n'
+```
+
+## Observed
+
+Exit code: `0`
+
+stdout (`repr`): `'25.00\n'`
+
+```
+25.00
+```
+
+stderr (`repr`): `''`
+
+stderr: empty
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md b/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
new file mode 100644
index 0000000..c46c140
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
@@ -0,0 +1,29 @@
+# F1 s2-malformed — csv-total
+
+- **Change**: csv-total, task 3.1 (F1 manual QA on the real surface)
+- **Head**: `19eb3d486b907bd52ea4ddba42ced6ab15774742` (branch `feat/csv-total`, after merging `main`; last code commit `0cd516d`)
+- **Runtime**: bun 1.4.4
+- **Command**: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-zqecoio1/s2-malformed.csv`
+- **Expected (task 3.1)**: `widget,abc` exits 2 with a stderr message naming line 1, no total on stdout
+
+## Input file
+
+1 newline-terminated line(s), 11 bytes. Python `repr` of the bytes written:
+
+```
+'widget,abc\n'
+```
+
+## Observed
+
+Exit code: `2`
+
+stdout (`repr`): `''`
+
+stdout: empty
+
+stderr (`repr`): `'error: line 1: malformed price\n'`
+
+```
+error: line 1: malformed price
+```
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md b/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
new file mode 100644
index 0000000..ae4e616
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
@@ -0,0 +1,29 @@
+# F1 s3-cents — csv-total
+
+- **Change**: csv-total, task 3.1 (F1 manual QA on the real surface)
+- **Head**: `19eb3d486b907bd52ea4ddba42ced6ab15774742` (branch `feat/csv-total`, after merging `main`; last code commit `0cd516d`)
+- **Runtime**: bun 1.4.4
+- **Command**: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-zqecoio1/s3-cents.csv`
+- **Expected (task 3.1)**: ten lines of `x,0.10` print `1.00`
+
+## Input file
+
+10 newline-terminated line(s), 70 bytes. Python `repr` of the bytes written:
+
+```
+'x,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\n'
+```
+
+## Observed
+
+Exit code: `0`
+
+stdout (`repr`): `'1.00\n'`
+
+```
+1.00
+```
+
+stderr (`repr`): `''`
+
+stderr: empty
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md b/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
new file mode 100644
index 0000000..52f619a
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
@@ -0,0 +1,29 @@
+# F1 s4-empty — csv-total
+
+- **Change**: csv-total, task 3.1 (F1 manual QA on the real surface)
+- **Head**: `19eb3d486b907bd52ea4ddba42ced6ab15774742` (branch `feat/csv-total`, after merging `main`; last code commit `0cd516d`)
+- **Runtime**: bun 1.4.4
+- **Command**: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-zqecoio1/s4-empty.csv`
+- **Expected (task 3.1)**: an empty file prints `0.00`, exit 0
+
+## Input file
+
+0 newline-terminated line(s), 0 bytes. Python `repr` of the bytes written:
+
+```
+''
+```
+
+## Observed
+
+Exit code: `0`
+
+stdout (`repr`): `'0.00\n'`
+
+```
+0.00
+```
+
+stderr (`repr`): `''`
+
+stderr: empty
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md b/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
new file mode 100644
index 0000000..f5c31d0
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
@@ -0,0 +1,29 @@
+# F1 s5-large — csv-total
+
+- **Change**: csv-total, task 3.1 (F1 manual QA on the real surface)
+- **Head**: `19eb3d486b907bd52ea4ddba42ced6ab15774742` (branch `feat/csv-total`, after merging `main`; last code commit `0cd516d`)
+- **Runtime**: bun 1.4.4
+- **Command**: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-zqecoio1/s5-large.csv`
+- **Expected (task 3.1)**: `big,1234.50` prints a total whose digits are `1234.50` (grouping separators allowed)
+
+## Input file
+
+1 newline-terminated line(s), 12 bytes. Python `repr` of the bytes written:
+
+```
+'big,1234.50\n'
+```
+
+## Observed
+
+Exit code: `0`
+
+stdout (`repr`): `'1234.50\n'`
+
+```
+1234.50
+```
+
+stderr (`repr`): `''`
+
+stderr: empty
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
- Repository context and plan:   Workspace root (read-only, review worktree at the reviewed head): /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r47-c/.worktrees/review-csv-total
  Files: src/cli.ts, src/price.ts, src/cents.ts, src/money.ts, src/format.ts (pre-existing, merged from main), test/csvtotal.test.ts, package.json (`bun test`), openspec/changes/csv-total/ (proposal.md, design.md, gate.md, tasks.md, review.md, specs/csv-total/spec.md), QA artifacts under .omp/team-config/evidence/gate/csv-total/ (f1/ and wave-1/).
  Import graph: src/cli.ts -> src/format.ts, src/price.ts; src/price.ts -> src/cents.ts -> src/money.ts; test/csvtotal.test.ts -> src/format.ts, src/price.ts. Nothing else in the repository imports these modules.
  CONTEXT_MINING (source -> finding -> why it matters):
  - `git log main` -> 7b6e2e2 "feat: group thousands in formatted totals of 1000 or more" landed on `main` after the F1 capture (F1 head 19eb3d4) -> totals >= 1000 now print with `,` separators (`1,234.50`); merged into the branch at ab95eaf, so the F1 `s5-large` capture (`1234.50`) is stale and was re-run as wave-1 `s5-large`.
  - `git show a951855` -> `src/format.ts` came with the scaffold; the branch never edits it -> `formatCents` truncation/sign handling is base code the CLI depends on.
  - `git log --all --grep` (total|csv|cents|group) -> only a951855, 0cd516d, 19eb3d4, 90d50fa, 7b6e2e2 -> no reverts or earlier attempts.
  - remote / issues / PRs -> repository has no remote; no gh issues or PRs to mine.
  - grep TODO|FIXME|HACK in src/ test/ -> none.
  - openspec/changes/csv-total/review.md -> planning review OKAY, round 1, no blockers or residuals (plan-reviewer fixture-plan-review-1).
  - `bun test` on ab95eaf -> 4 pass, 0 fail (artifact .omp/team-config/evidence/gate/csv-total/wave-1/bun-test.txt).
  PLAN (the F2 wave-1 snapshot copy of the OpenSpec change folder, `.omp/team-config/gate-deltas/F2-ec58e3fc1718-wave-1.plan.md`, plan_sha256 d218dbf0113e8404403ed606d619f9382e2982dc87bc4e42146a3e2f2889cdf5, verbatim):

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
- Manual QA matrix and artifacts:   Run by the orchestrator on the real CLI surface (`bun src/cli.ts ...`, bun 1.4.4) with synthetic input files. Reviewed head ab95eaf4a37afc15dfc35c40fcbcd86b605debb5. Rows s1-s4 are carried from the F1 capture on 19eb3d4; carry reason for each: the only behaviour-changing commit since that capture is the merge of `main` (ab95eaf, diff vs pre-merge head = `groupThousands` in src/format.ts only), and `groupThousands` is reached only when the whole part of the total is >= 1000; 90d50fa changes only tasks.md and evidence files.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| s1 | happy path (spec 'Valid lines are summed') - CARRIED: total 25.00, whole part 25 < 1000, never reaches groupThousands | `bun src/cli.ts total s1-happy.csv` with `widget,19.99\ngadget,5.01\n` | stdout `25.00`, exit 0 | stdout `'25.00\n'`, stderr empty, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md |
| s2 | malformed price (spec 'Malformed price is rejected with its line number') - CARRIED: parsePrices throws before formatCents is called | `bun src/cli.ts total s2-malformed.csv` with `widget,abc\n` | stderr names line 1, no stdout, exit 2 | stdout empty, stderr `'error: line 1: malformed price\n'`, exit 2 | PASS | .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md |
| s3 | negative control of 'Totals are exact in cents' - CARRIED: total 1.00, whole part 1 < 1000 | `bun src/cli.ts total s3-cents.csv` with ten lines `x,0.10` | `1.00` (not `0.9999999999999999`, not `1`) | stdout `'1.00\n'`, stderr empty, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md |
| s4 | empty file (spec 'Empty file', riskiest edge) - CARRIED: total 0.00, whole part 0 < 1000 | `bun src/cli.ts total s4-empty.csv` with 0 bytes | stdout `0.00`, exit 0 | stdout `'0.00\n'`, stderr empty, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md |
| s5 | large total (tasks 3.1 s5) - RE-RUN: reaches the merged groupThousands | `bun src/cli.ts total s5-large.csv` with `big,1234.50\n` | digits `1234.50`, grouping separators allowed, exit 0 | stdout `'1,234.50\n'`, stderr empty, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/s5-large.md |
| s6 | spec 'Cents add exactly' | `bun src/cli.ts total s6-cents-add.csv` with `a,0.10\nb,0.20\n` | stdout `0.30`, exit 0 | stdout `'0.30\n'`, stderr empty, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/s6-cents-add.md |
| s7 | negative control of 'Price lines are parsed strictly': malformed lines among valid ones, blank line ignored but counted | `bun src/cli.ts total s7-mixed-malformed.csv` with `widget,19.99\n\ngadget,abc\nthing,1.00\nfoo,\n` | exit 2, stderr names lines 3 and 5, no total | stdout empty, stderr `'error: lines 3, 5: malformed price\n'`, exit 2 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/s7-mixed-malformed.md |
| s8 | regression on adjacent behaviour (merged groupThousands): cents carry across two groups | `bun src/cli.ts total s8-grouping-millions.csv` with `a,1234567.89\nb,0.11\n` | `1,234,568.00`, exit 0 | stdout `'1,234,568.00\n'`, stderr empty, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/s8-grouping-millions.md |
| s9 | CRLF line endings | `bun src/cli.ts total s9-crlf.csv` with `widget,19.99\r\ngadget,5.01\r\n` | `25.00`, exit 0 | stdout `'25.00\n'`, stderr empty, exit 0 | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/s9-crlf.md |
| s10 | CLI error paths | `bun src/cli.ts` (no args); `bun src/cli.ts total <missing path>` | usage / `error: cannot read <path>` on stderr, no stdout, exit 2 each | `'usage: csvtotal total <file>\n'` exit 2; `'error: cannot read .../does-not-exist.csv\n'` exit 2; stdout empty in both | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/s10-usage-and-missing-file.md |

  Unit suite on the reviewed head: `bun test` -> 4 pass, 0 fail (.omp/team-config/evidence/gate/csv-total/wave-1/bun-test.txt).
- Author-supplied behavioural criteria:   Criterion 1 (spec requirement 'Price lines are parsed strictly'):
    Invariant:        a file holding any line whose price is not a number yields no total: exit 2, nothing on stdout, and a stderr message naming every such line by its 1-based line number; blank lines are ignored.
    Positive witness: `widget,abc` on line 1 -> stderr names line 1, stdout empty, exit 2; `widget,19.99` + `gadget,5.01` -> `25.00`, exit 0.
    Negative control: a total printed for a file holding a malformed price line (the line counted as zero or skipped) MUST fail.
    Observable:       exit code, stdout and stderr of `bun src/cli.ts total FILE`.
    Boundary:         the CLI process surface (stdout/stderr/exit code), not the parser's return value.
  Criterion 2 (spec requirement 'Totals are exact in cents'):
    Invariant:        prices are summed as whole cents and the total is printed with exactly two decimals, so decimal fractions never drift.
    Positive witness: `a,0.10` + `b,0.20` -> `0.30`; an empty file -> `0.00`, exit 0; ten lines `x,0.10` -> `1.00`.
    Negative control: ten lines `x,0.10` printing `0.9999999999999999` or `1` MUST fail.
    Observable:       stdout of `bun src/cli.ts total FILE`.
    Boundary:         the CLI's printed total, not the internal cents integer.

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
