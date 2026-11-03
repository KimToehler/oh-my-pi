Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: GOAL (from the change's proposal.md, the user's request for this gate is to run the F2 merge gate on OpenSpec change `csv-total`): add a `csvtotal total <file>` command (run as `bun src/cli.ts total <file>`) that sums the prices of a `name,price` supplier file in exact cents and prints the total with two decimals, so finance can reconcile it against the supplier's invoice; reject a malformed price line with exit code 2 and a message naming the line.
CONSTRAINTS (from the change folder): prices are scaled to whole cents on parse and summed as integers, formatting happens once on the total (design.md Decisions); Non-Goals: quoted CSV fields, currencies other than a bare decimal, locale formatting (design.md); proposal Impact: "New files under `src/` and `test/` only; no existing consumer"; gate.md: Mandatory class none, Depth standard, Risk tier product, Whole-diff review not needed (whole-diff surface reviewed in F2), Accepted residual risk: sub-cent rounding of prices with more than two decimals (`src/money.ts`), Out of scope for blocking: none; tasks.md ## TODOs rows 4.1 and 4.2 (F2 fix round 1).
BACKGROUND: finance reconciles supplier price files by hand against the invoice; a wrong total reaches a finance reconciliation (gate.md Author's risk assessment). The CLI reads one local file and writes to stdout/stderr. This is F2 wave 2, after fix round 1: wave 1's audit found two blockers (EACCES message said `no such file`; EISDIR exited 1), fixed in 3556de8 with rows 4.1/4.2 and two CLI tests; the fix delta 8a1d0d6..3556de8 was reviewed OKAY. You review the whole branch diff fresh.
Implementation models of this diff: onara/cc/claude-opus-5-5. Review depth: standard (gate.md), so this is the only reviewer invocation.
- Changed files and reviewed diff: Changed files (`git diff --name-status fbc1cb88f3d5c28a1c1020aeb021aeb467f5bd76..3556de877f6f9290a54a0d11dc8b906652981043`):
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
M	src/format.ts
A	src/money.ts
A	src/price.ts
A	test/csvtotal.test.ts

Reviewed diff (`git diff fbc1cb88f3d5c28a1c1020aeb021aeb467f5bd76..3556de877f6f9290a54a0d11dc8b906652981043`):
```diff
diff --git a/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md b/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
new file mode 100644
index 0000000..6e9be58
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
@@ -0,0 +1,19 @@
+# F1 s1 happy path
+
+Head: 81c2b7b (the code commit)
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
index 0000000..f8d0dda
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
@@ -0,0 +1,18 @@
+# F1 s2 malformed price
+
+Head: 81c2b7b (the code commit)
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
index 0000000..7f6d8dc
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
@@ -0,0 +1,27 @@
+# F1 s3 exact cents
+
+Head: 81c2b7b (the code commit)
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
index 0000000..b80fb60
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
@@ -0,0 +1,17 @@
+# F1 s4 empty file
+
+Head: 81c2b7b (the code commit)
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
index 0000000..9b661c5
--- /dev/null
+++ b/.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
@@ -0,0 +1,18 @@
+# F1 s5 large total
+
+Head: 81c2b7b (the code commit)
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
index 0000000..53e67b8
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
+- [x] 4.1 F2 wave 1 blocker B1 (wrong-read-error-message, `src/cli.ts:15`): when the input file exists but cannot be read for lack of permission (`EACCES`), print `error: cannot read FILE: permission denied` instead of `no such file`, and exit 2. Verify: `bun test`
+- [x] 4.2 F2 wave 1 blocker B2 (wrong-read-exit-status, `src/cli.ts:16`): when the input path is a directory (`EISDIR`), print `error: cannot read FILE: is a directory` and exit 2, the status of every other refusal, instead of 1. Verify: `bun test`
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
index 0000000..3a1454b
--- /dev/null
+++ b/src/cli.ts
@@ -0,0 +1,25 @@
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
+} catch (error) {
+  const code = (error as NodeJS.ErrnoException).code
+  if (code === "EACCES") console.error(`error: cannot read ${file}: permission denied`)
+  else if (code === "EISDIR") console.error(`error: cannot read ${file}: is a directory`)
+  else console.error(`error: cannot read ${file}`)
+  process.exit(2)
+}
+try {
+  console.log(formatCents(sumCents(parsePrices(text))))
+} catch (error) {
+  console.error(`error: ${(error as Error).message}`)
+  process.exit(2)
+}
diff --git a/src/format.ts b/src/format.ts
index bc59b9d..c207ab2 100644
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
+  return whole.toLocaleString("en-US")
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
index 0000000..d47296f
--- /dev/null
+++ b/test/csvtotal.test.ts
@@ -0,0 +1,40 @@
+import { expect, test } from "bun:test"
+import { chmodSync, mkdtempSync, writeFileSync } from "node:fs"
+import { tmpdir } from "node:os"
+import { join } from "node:path"
+import { formatCents } from "../src/format"
+import { parsePrices, sumCents } from "../src/price"
+
+const runCli = (...args: string[]) => {
+  const run = Bun.spawnSync(["bun", join(import.meta.dir, "../src/cli.ts"), ...args])
+  return { stdout: run.stdout.toString(), stderr: run.stderr.toString(), exitCode: run.exitCode }
+}
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
+test("an unreadable file is reported as permission denied and exits 2", () => {
+  const file = join(mkdtempSync(join(tmpdir(), "csvtotal-")), "locked.csv")
+  writeFileSync(file, "widget,19.99\n")
+  chmodSync(file, 0o000)
+  const run = runCli("total", file)
+  expect(run.stderr).toBe(`error: cannot read ${file}: permission denied\n`)
+  expect(run.stdout).toBe("")
+  expect(run.exitCode).toBe(2)
+})
+test("a directory is refused with exit 2", () => {
+  const dir = mkdtempSync(join(tmpdir(), "csvtotal-"))
+  const run = runCli("total", dir)
+  expect(run.stderr).toBe(`error: cannot read ${dir}: is a directory\n`)
+  expect(run.stdout).toBe("")
+  expect(run.exitCode).toBe(2)
+})
```
- Repository context and plan: Workspace root (review worktree, read-only for you): /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r518-e/.worktrees/review-csv-total
Reviewed head: 3556de877f6f9290a54a0d11dc8b906652981043 (branch feat/csv-total); diff base (merge-base with main): fbc1cb88f3d5c28a1c1020aeb021aeb467f5bd76.
Changed source files: src/cents.ts, src/cli.ts, src/format.ts (pre-existing on main, modified), src/money.ts, src/price.ts, test/csvtotal.test.ts. Plan: OpenSpec change folder openspec/changes/csv-total/ (proposal.md, design.md, specs/csv-total/spec.md, tasks.md, gate.md, review.md). Neighbouring files showing established patterns: package.json (`bun test`), openspec/config.yaml.

CONTEXT_MINING (source -> finding -> why it matters):
- `git ls-tree main` / `git show main:src/format.ts` -> `src/format.ts` already existed on main (scaffold commit fbc1cb8) with `groupThousands` returning `String(whole)`; the diff changes it to `whole.toLocaleString("en-US")` -> the change edits a pre-existing file although proposal.md says new files only, and the output format of totals >= 1000.00 changes.
- `grep formatCents|groupThousands|roundToCents|toCents` over the tree -> only src/cli.ts and test/csvtotal.test.ts consume these functions -> no other in-repo consumer of format.ts.
- `git log --oneline -- src test` / `git log --all --grep` -> fbc1cb8 scaffold, 81c2b7b feature, 8a1d0d6 F1 evidence, then F2 fix round 1 (ae1e4a5, 4d50074 plan rows; 3556de8 fix) -> no reverts or unrelated work.
- `grep TODO|FIXME|HACK src test` -> none.
- `gh issue/pr list` -> unavailable (gh not authenticated) -> no tracker context.
- openspec/changes/csv-total/review.md -> planning review OKAY bound to digest cbecfe31...; tasks.md changed afterwards (3.1 ticked, ## TODOs 4.1/4.2 added) -> informational; F2 binds the folder by its own plan_sha256.
- `git merge-base --is-ancestor main HEAD` -> true -> no default-branch merge needed before this wave.

PLAN (immutable snapshot copy /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1d-r518-e/.worktrees/review-csv-total/.omp/team-config/gate-deltas/F2-ec58e3fc1718-wave-2.plan.md, plan_sha256 14bc0151ca496b022ef7cd5203daab24cc7e442096e659eb191167d9aa8e389d, verbatim):
caaaa13392fac26bfe35a0830a1365be83478581d4f8abcf85b97b0ba12f92aa  .openspec.yaml
22db88884cee3b92e4893b8977da2655390085ae3f7055c3f17b4e25f14c6158  design.md
1729c020757edde172564a72f53872aad3e3dff82b18dbb9a0c78fb3ded7b0f8  gate.md
9d45062eeef1ea8c55723da2f26de24e58fb521c7303b5d6415c0d51fa554a2a  proposal.md
c7d09ca082300993901497d2a2ec892d28b6697a394fd96b2541ae2d157a1226  review.md
55301eaa3b0c83a4e4b674314ad3138520eb054ecc90f55d79a96e6178b4241c  specs/csv-total/spec.md
8d1489d120ce0e39caa89891098e5fe3cb324ba11b55a91d1dc0998792c94071  tasks.md
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

- [x] 4.1 F2 wave 1 blocker B1 (wrong-read-error-message, `src/cli.ts:15`): when the input file exists but cannot be read for lack of permission (`EACCES`), print `error: cannot read FILE: permission denied` instead of `no such file`, and exit 2. Verify: `bun test`
- [x] 4.2 F2 wave 1 blocker B2 (wrong-read-exit-status, `src/cli.ts:16`): when the input path is a directory (`EISDIR`), print `error: cannot read FILE: is a directory` and exit 2, the status of every other refusal, instead of 1. Verify: `bun test`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.


- Manual QA matrix and artifacts: | # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| 1 | Requirement "Price lines are parsed strictly": valid lines summed; malformed line 1 rejected; negative control (malformed lines in a mixed file never counted or skipped) | `bun src/cli.ts total FILE` on `widget,19.99`+`gadget,5.01`; on `widget,abc`; on `widget,19.99`,blank,`bad,abc`,`gadget,5.01`,`worse,` | `25.00` exit 0; stderr names line 1, no total, exit 2; stderr names lines 3 and 5, no total, exit 2 | `25.00` exit 0; `error: line 1: malformed price`, no stdout, exit 2; `error: lines 3, 5: malformed price`, no stdout, exit 2 (carried from wave 1 (head 8a1d0d6): the fix range 8a1d0d6..3556de8 changes src/cli.ts only inside the readFileSync catch, plus tasks.md and the test file; this row reads readable regular files and never reaches the changed code (delta review OKAY accepted the carry)) | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/qa-r1-parsed-strictly.md |
| 2 | Requirement "Totals are exact in cents": cents add exactly; empty file; negative control ten x 0.10 | `bun src/cli.ts total FILE` on `a,0.10`+`b,0.20`; on an empty file; on ten lines of `x,0.10` | `0.30`; `0.00` exit 0; `1.00` (never `0.9999999999999999` or `1`) | `0.30` exit 0; `0.00` exit 0; `1.00` exit 0 (carried from wave 1 (head 8a1d0d6): the fix range 8a1d0d6..3556de8 changes src/cli.ts only inside the readFileSync catch, plus tasks.md and the test file; this row reads readable regular files and never reaches the changed code (delta review OKAY accepted the carry)) | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/qa-r2-exact-cents.md |
| 3 | Happy path the goal names: total a two-line supplier file | `bun src/cli.ts total FILE` on `widget,19.99`+`gadget,5.01` | `25.00`, empty stderr, exit 0 | `25.00`, empty stderr, exit 0 (captured on 81c2b7b; carried from wave 1 (head 8a1d0d6): the fix range 8a1d0d6..3556de8 changes src/cli.ts only inside the readFileSync catch, plus tasks.md and the test file; this row reads readable regular files and never reaches the changed code (delta review OKAY accepted the carry)) | PASS | .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md |
| 4 | Riskiest edge: CRLF supplier export at the 1000.00 formatting boundary | `bun src/cli.ts total FILE` on `a,999.99\r\nb,0.01\r\n`; on `a,999.98\r\nb,0.01\r\n` | digits `1000.00` (grouping allowed per tasks.md 3.1 s5), exit 0; `999.99` exit 0 | `1,000.00` exit 0; `999.99` exit 0 (carried from wave 1 (head 8a1d0d6): the fix range 8a1d0d6..3556de8 changes src/cli.ts only inside the readFileSync catch, plus tasks.md and the test file; this row reads readable regular files and never reaches the changed code (delta review OKAY accepted the carry)) | PASS | .omp/team-config/evidence/gate/csv-total/wave-1/qa-edge-crlf-1000.md |
| 5 | Regression on adjacent behaviour: pre-existing `src/format.ts` (on main) below 1000.00, plus test suite | bun script importing `formatCents` from `main:src/format.ts` and branch `src/format.ts` over 11 values < 100000 cents; `bun test` | identical output for every value; all tests pass | 11/11 identical; 6 pass 0 fail (re-run in wave 2: the fix range edits the test file) | PASS | .omp/team-config/evidence/gate/csv-total/wave-2/qa-regression.md |
| 6 | Stated success criterion tasks.md 3.1 s5: large total | `bun src/cli.ts total FILE` on `big,1234.50` | digits `1234.50`, grouping separators allowed | `1,234.50`, exit 0 (captured on 81c2b7b; carried from wave 1 (head 8a1d0d6): the fix range 8a1d0d6..3556de8 changes src/cli.ts only inside the readFileSync catch, plus tasks.md and the test file; this row reads readable regular files and never reaches the changed code (delta review OKAY accepted the carry)) | PASS | .omp/team-config/evidence/gate/csv-total/f1/s5-large.md |
| 7 | Fix rows 4.1 and 4.2: read errors through the CLI | `bun src/cli.ts total FILE` on a mode-000 file; on a directory; on a nonexistent path | `...: permission denied` exit 2; `...: is a directory` exit 2; `error: cannot read FILE` exit 2; no stdout in each | as expected, all three (fresh, wave 2) | PASS | .omp/team-config/evidence/gate/csv-total/wave-2/qa-read-errors.md |

Carries: rows 1, 2, 3, 4 and 6 are carried from wave 1 with the reason given in each row; row 5 is re-run and row 7 is new, both on the reviewed head 3556de877f6f9290a54a0d11dc8b906652981043 in the review worktree. `main` is an ancestor of the head (no merge needed).

Artifact digests (sha256):
- .omp/team-config/evidence/gate/csv-total/wave-1/qa-r1-parsed-strictly.md: 2281cd4a57de327b778e2ecf081615022cbaf9c5f50012f372232897dcb8715d
- .omp/team-config/evidence/gate/csv-total/wave-1/qa-r2-exact-cents.md: 1c1c1daa8548027fc6cab81cdd727540010eda8421052f9107a7cf972343736e
- .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md: fcdd0926183ad410511dc9b9711887e815df79a5cfaf560ce6ea98531e1eb1e5
- .omp/team-config/evidence/gate/csv-total/wave-1/qa-edge-crlf-1000.md: 2dc5e44477aa3d4917ec98a26446f9f929c83e35674eaa162695d80c403513a2
- .omp/team-config/evidence/gate/csv-total/wave-2/qa-regression.md: 9c939b8d496535bb2a86965bbb74e0e48c6920b444a4a3d714616be9a2a6d3d9
- .omp/team-config/evidence/gate/csv-total/f1/s5-large.md: 36fe8130542068655ff2f7ca926c945166c943fb27fe61a18a3b1da625508dfb
- .omp/team-config/evidence/gate/csv-total/wave-2/qa-read-errors.md: 0f2d562273877d0baa6ca3a6bf486fbf2b2600601b7374ba1f318a5d80a61f3e

Artifact contents, verbatim:

===== .omp/team-config/evidence/gate/csv-total/wave-1/qa-r1-parsed-strictly.md =====
# F2 wave 1 QA row 1: Requirement "Price lines are parsed strictly"

Reviewed head: 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479

## Scenario: Valid lines are summed
Cites `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` (tracked at the reviewed head). Observed there: stdout `25.00`, stderr empty, exit 0. Expected `25.00`, exit 0. PASS.
Carried, not re-run: captured on 81c2b7b (the code commit); the only later commit, 8a1d0d6, adds evidence files and edits openspec/changes/csv-total/tasks.md, touches no file under src/ or test/, so it cannot change what this capture observed.

## Scenario: Malformed price is rejected with its line number
Cites `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` (tracked at the reviewed head). Observed there: stdout empty, stderr `error: line 1: malformed price`, exit 2. Expected a message naming line 1 on stderr, no total, exit 2. PASS.
Carried, not re-run: captured on 81c2b7b (the code commit); the only later commit, 8a1d0d6, adds evidence files and edits openspec/changes/csv-total/tasks.md, touches no file under src/ or test/, so it cannot change what this capture observed.

## Scenario: Negative control (fresh capture, wave 1)
A malformed line inside a file that also holds valid lines and a blank line: counting it as zero or skipping it would print `25.00`.

### Mixed file: two valid lines, one blank line, malformed lines 3 and 5

Input (`/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/r1-mixed.csv`, bytes shown with `\r` escaped, 41 bytes):
```
widget,19.99

bad,abc
gadget,5.01
worse,
```

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/r1-mixed.csv` (cwd: review worktree, head 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479)

stdout: ``

stderr: `error: lines 3, 5: malformed price`

exit: 2

Expected: no total on stdout, stderr names lines 3 and 5 (each malformed line), the blank line 2 is not reported, exit 2. Observed matches. PASS.

Row verdict: PASS

===== .omp/team-config/evidence/gate/csv-total/wave-1/qa-r2-exact-cents.md =====
# F2 wave 1 QA row 2: Requirement "Totals are exact in cents"

Reviewed head: 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479

## Scenario: Cents add exactly (fresh capture, wave 1)
### a,0.10 and b,0.20

Input (`/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/r2-cents.csv`, bytes shown with `\r` escaped, 14 bytes):
```
a,0.10
b,0.20
```

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/r2-cents.csv` (cwd: review worktree, head 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479)

stdout: `0.30`

stderr: ``

exit: 0

Expected `0.30`, exit 0. Observed matches. PASS.

## Scenario: Empty file
Cites `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md` (tracked at the reviewed head). Observed there: stdout `0.00`, stderr empty, exit 0. Expected `0.00`, exit 0. PASS.
Carried, not re-run: captured on 81c2b7b (the code commit); the only later commit, 8a1d0d6, adds evidence files and edits openspec/changes/csv-total/tasks.md, touches no file under src/ or test/, so it cannot change what this capture observed.

## Scenario: Negative control
Cites `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md` (tracked at the reviewed head). Observed there: ten lines of `x,0.10`, stdout `1.00`, stderr empty, exit 0. Expected `1.00`; `0.9999999999999999` or `1` would fail. PASS.
Carried, not re-run: captured on 81c2b7b (the code commit); the only later commit, 8a1d0d6, adds evidence files and edits openspec/changes/csv-total/tasks.md, touches no file under src/ or test/, so it cannot change what this capture observed.

Row verdict: PASS

===== .omp/team-config/evidence/gate/csv-total/wave-1/qa-edge-crlf-1000.md =====
# F2 wave 1 QA row 4: riskiest edge, CRLF supplier export at the 1000.00 formatting boundary (fresh capture)

Reviewed head: 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479

Why this edge: supplier exports commonly use CRLF line endings, so the `\r` reaches the price field; and `formatCents` switches to `groupThousands` exactly at 1000.00, the boundary the diff changed.

### Total crosses the boundary: 999.99 + 0.01

Input (`/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/edge-crlf-1000.csv`, bytes shown with `\r` escaped, 18 bytes):
```
a,999.99\r
b,0.01\r
```

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/edge-crlf-1000.csv` (cwd: review worktree, head 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479)

stdout: `1,000.00`

stderr: ``

exit: 0

Expected: total whose digits are `1000.00` (grouping separators allowed, as tasks.md 3.1 s5 states), no error from the trailing `\r`, exit 0. Observed `1,000.00`, exit 0. PASS.

### Total stays below the boundary: 999.98 + 0.01

Input (`/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/edge-crlf-999.csv`, bytes shown with `\r` escaped, 18 bytes):
```
a,999.98\r
b,0.01\r
```

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/edge-crlf-999.csv` (cwd: review worktree, head 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479)

stdout: `999.99`

stderr: ``

exit: 0

Expected `999.99` without separator, exit 0. Observed matches. PASS.

Row verdict: PASS

===== .omp/team-config/evidence/gate/csv-total/wave-2/qa-regression.md =====
# F2 wave 2 QA row 5: regression on adjacent behaviour (re-run: the fix range edits test/csvtotal.test.ts)

Reviewed head: 3556de877f6f9290a54a0d11dc8b906652981043

Adjacent behaviour: `src/format.ts` existed on `main` (fbc1cb8) before this change and the diff edits it (`groupThousands`). The check compares `formatCents` from `main:src/format.ts` with the branch's `src/format.ts` for totals below 1000.00, which must stay byte-identical, and runs the repository's test suite.

## Formatter, main vs branch
Command: `git show main:src/format.ts > /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/format-main.ts && bun /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/fmt-regress.ts` (script imports both `formatCents` functions and prints each value)

stdout:
```
0 main=0.00 branch=0.00 same
1 main=0.01 branch=0.01 same
9 main=0.09 branch=0.09 same
10 main=0.10 branch=0.10 same
99 main=0.99 branch=0.99 same
100 main=1.00 branch=1.00 same
101 main=1.01 branch=1.01 same
2500 main=25.00 branch=25.00 same
99999 main=999.99 branch=999.99 same
99998 main=999.98 branch=999.98 same
99900 main=999.00 branch=999.00 same
100000 main=1000.00 branch=1,000.00 (>= 1000.00: outside this check; the branch changed groupThousands)
123450 main=1234.50 branch=1,234.50 (>= 1000.00: outside this check; the branch changed groupThousands)
below 1000.00: 11/11 identical
```
stderr: ``

exit: 0

Expected: every value below 100000 cents identical on main and branch. Observed 11/11 identical. PASS.

## Test suite
Command: `bun test` (cwd: review worktree)

output (stdout and stderr):
```
bun test v1.4.4 (5d9cc0f4f)

test/csvtotal.test.ts:
(pass) sums valid lines [0.21ms]
(pass) ten lines of 0.10 total 1.00 [0.03ms]
(pass) empty input totals 0.00
(pass) malformed price throws with the line [0.03ms]
(pass) an unreadable file is reported as permission denied and exits 2 [9.90ms]
(pass) a directory is refused with exit 2 [8.77ms]

 6 pass
 0 fail
 10 expect() calls
Ran 6 tests across 1 file. [25.00ms]
```
exit: 0

Expected: all tests pass. Observed 6 pass, 0 fail. PASS.

Row verdict: PASS

===== .omp/team-config/evidence/gate/csv-total/wave-2/qa-read-errors.md =====
# F2 wave 2 QA row 7: fix rows 4.1 and 4.2, read errors through the CLI (fresh capture)

Reviewed head: 3556de877f6f9290a54a0d11dc8b906652981043

Setup: `/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/locked.csv` holds `widget,19.99` and was `chmod 000` for the run (restored afterwards); `/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/adir` is an empty directory; `/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/missing.csv` does not exist.

### file with mode 000 (EACCES)

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/locked.csv` (cwd: review worktree, head 3556de877f6f9290a54a0d11dc8b906652981043)

stdout: ``

stderr: `error: cannot read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/locked.csv: permission denied`

exit: 2

### directory (EISDIR)

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/adir` (cwd: review worktree, head 3556de877f6f9290a54a0d11dc8b906652981043)

stdout: ``

stderr: `error: cannot read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/adir: is a directory`

exit: 2

### nonexistent path (ENOENT, unchanged branch)

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/missing.csv` (cwd: review worktree, head 3556de877f6f9290a54a0d11dc8b906652981043)

stdout: ``

stderr: `error: cannot read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/missing.csv`

exit: 2

Expected: mode 000 file prints `error: cannot read FILE: permission denied`, no stdout, exit 2 (row 4.1); directory prints `error: cannot read FILE: is a directory`, no stdout, exit 2 (row 4.2); nonexistent path keeps `error: cannot read FILE`, no stdout, exit 2 (unchanged neighbour branch). Observed matches all three. PASS.

Row verdict: PASS

(f1/s1-happy.md, f1/s2-malformed.md, f1/s3-cents.md, f1/s4-empty.md and f1/s5-large.md are part of the reviewed diff below, verbatim.)

- Author-supplied behavioural criteria: From specs/csv-total/spec.md, each Requirement with its Negative control scenario:

Criterion C1 (Requirement: Price lines are parsed strictly)
Invariant:        a file holding any line whose price is not a number produces no total; every such line is named on stderr and the command exits 2; blank lines are ignored.
Positive witness: `widget,19.99` + `gadget,5.01` prints `25.00`, exit 0; `widget,abc` on line 1 prints a message naming line 1 on stderr, no total, exit 2.
Negative control: a total printed for a file holding a malformed price line (the line counted as zero or skipped) MUST fail.
Observable:       stdout empty, stderr naming each malformed line number, exit code 2.
Boundary:         the CLI process (`bun src/cli.ts total <file>`): stdout, stderr and exit code.

Criterion C2 (Requirement: Totals are exact in cents)
Invariant:        the command sums whole cents and prints the total with exactly two decimals, so decimal fractions never drift.
Positive witness: `a,0.10` + `b,0.20` prints `0.30`; an empty file prints `0.00`, exit 0.
Negative control: ten lines of `x,0.10` printing `0.9999999999999999` or `1` MUST fail; the command prints `1.00`.
Observable:       the exact stdout string of the total.
Boundary:         the CLI process stdout.

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
