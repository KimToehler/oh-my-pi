#!/usr/bin/env bash
# F1D fixture builder: build.sh <dir> <ab|c>
set -euo pipefail
DIR="$1"; MODE="$2"
SK=/Users/tim/.omp/wt/tff1bac5e9/m/team-config/agent/skills/review-work/scripts
rm -rf "$DIR"; mkdir -p "$DIR"; cd "$DIR"
git init -q -b main
git config user.name "Fixture Author"; git config user.email "fixture@example.invalid"

cat > package.json <<'EOF'
{ "name": "csvtotal", "private": true, "type": "module", "scripts": { "test": "bun test" } }
EOF
cat > .gitignore <<'EOF'
node_modules/
/.omp/team-config/*
!/.omp/team-config/evidence/
/.omp/team-config/evidence/**/*
!/.omp/team-config/evidence/**/
!/.omp/team-config/evidence/gate/**
!/.omp/team-config/evidence/**/*trailer*
EOF
node $SK/install-openspec-workflow.mjs . >/dev/null
if true; then
mkdir -p src
cat > src/format.ts <<'EOF'
// Formats whole cents as a decimal string with exactly two decimals.
export function formatCents(cents: number): string {
  const whole = Math.trunc(cents / 100)
  const rest = Math.abs(cents % 100)
  const head = whole >= 1000 ? groupThousands(whole) : String(whole)
  return `${head}.${String(rest).padStart(2, "0")}`
}

// Renders a whole number of 1000 or more.
export function groupThousands(whole: number): string {
  return String(whole)
}
EOF
fi
git add -A && git commit -q -m "chore: scaffold with omp-gated schema"
git switch -q -c feat/csv-total

mkdir -p src test
cat > src/money.ts <<'EOF'
// Scales a decimal amount to whole cents.
export const roundToCents = (amount: number): number => Math.round(amount * 100)
EOF
cat > src/cents.ts <<'EOF'
import { roundToCents } from "./money"

// Parses a decimal price such as "19.99" into whole cents; null when it is not a number.
export function toCents(raw: string): number | null {
  const amount = Number.parseFloat(raw)
  if (Number.isNaN(amount)) return null
  return roundToCents(amount)
}
EOF
cat > src/price.ts <<'EOF'
import { toCents } from "./cents"

export interface PriceLine {
  row: number
  name: string
  cents: number
}

// Parses "name,price" lines. A line whose price is not a number throws one Error naming every such line.
export function parsePrices(text: string): PriceLine[] {
  const lines = text.split("\n")
  const prices: PriceLine[] = []
  const bad: number[] = []
  for (const line of lines) {
    if (line.trim() === "") continue
    const row = lines.indexOf(line) + 1
    const at = line.lastIndexOf(",")
    const cents = at === -1 ? null : toCents(line.slice(at + 1))
    if (cents === null) {
      bad.push(row)
      continue
    }
    prices.push({ row, name: line.slice(0, at), cents })
  }
  if (bad.length > 0) throw new Error(`${bad.length === 1 ? "line" : "lines"} ${bad.join(", ")}: malformed price`)
  return prices
}

export const sumCents = (prices: PriceLine[]): number => prices.reduce((total, price) => total + price.cents, 0)
EOF
if true; then
cat > src/cents.ts <<'EOF'
import { roundToCents } from "./money"

// Parses a decimal price such as "19.99" into whole cents; null when it is not a number.
export function toCents(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  return roundToCents(Number(text))
}
EOF
cat > src/price.ts <<'EOF'
import { toCents } from "./cents"

export interface PriceLine {
  row: number
  name: string
  cents: number
}

// Parses "name,price" lines. A line whose price is not a number throws one Error naming every such line.
export function parsePrices(text: string): PriceLine[] {
  const prices: PriceLine[] = []
  const bad: number[] = []
  for (const [index, line] of text.split("\n").entries()) {
    if (line.trim() === "") continue
    const row = index + 1
    const at = line.lastIndexOf(",")
    const cents = at === -1 ? null : toCents(line.slice(at + 1))
    if (cents === null) {
      bad.push(row)
      continue
    }
    prices.push({ row, name: line.slice(0, at), cents })
  }
  if (bad.length > 0) throw new Error(`${bad.length === 1 ? "line" : "lines"} ${bad.join(", ")}: malformed price`)
  return prices
}

export const sumCents = (prices: PriceLine[]): number => prices.reduce((total, price) => total + price.cents, 0)
EOF
fi
cat > src/format.ts <<'EOF'
// Formats whole cents as a decimal string with exactly two decimals.
export function formatCents(cents: number): string {
  const whole = Math.trunc(cents / 100)
  const rest = Math.abs(cents % 100)
  const head = whole >= 1000 ? groupThousands(whole) : String(whole)
  return `${head}.${String(rest).padStart(2, "0")}`
}

// Renders a whole number of 1000 or more.
export function groupThousands(whole: number): string {
  return String(whole)
}
EOF
if [ "$MODE" = "ab" ]; then
cat > src/format.ts <<'XEOF'
// Formats whole cents as a decimal string with exactly two decimals and grouped thousands.
export function formatCents(cents: number): string {
  const whole = Math.trunc(cents / 100)
  const rest = Math.abs(cents % 100)
  const head = whole >= 1000 ? groupThousands(whole) : String(whole)
  return `${head}.${String(rest).padStart(2, "0")}`
}

// Renders a whole number of 1000 or more with a thousands separator.
export function groupThousands(whole: number): string {
  return whole.toLocaleString("en-US")
}
XEOF
fi
cat > src/cli.ts <<'EOF'
import { readFileSync } from "node:fs"
import { formatCents } from "./format"
import { parsePrices, sumCents } from "./price"

const [command, file] = process.argv.slice(2)
if (command !== "total" || !file) {
  console.error("usage: csvtotal total <file>")
  process.exit(2)
}
let text: string
try {
  text = readFileSync(file, "utf8")
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code
  if (code === "EACCES") console.error(`error: cannot read ${file}: no such file`)
  else console.error(`error: cannot read ${file}`)
  process.exit(2)
}
try {
  console.log(formatCents(sumCents(parsePrices(text))))
} catch (error) {
  console.error(`error: ${(error as Error).message}`)
  process.exit(2)
}
EOF
cat > test/csvtotal.test.ts <<'EOF'
import { expect, test } from "bun:test"
import { formatCents } from "../src/format"
import { parsePrices, sumCents } from "../src/price"

test("sums valid lines", () => {
  expect(formatCents(sumCents(parsePrices("widget,19.99\ngadget,5.01\n")))).toBe("25.00")
})
test("ten lines of 0.10 total 1.00", () => {
  expect(formatCents(sumCents(parsePrices("a,0.10\n".repeat(10))))).toBe("1.00")
})
test("empty input totals 0.00", () => {
  expect(formatCents(sumCents(parsePrices("")))).toBe("0.00")
})
test("malformed price throws with the line", () => {
  expect(() => parsePrices("widget,abc\n")).toThrow("line 1")
})
EOF

CH=openspec/changes/csv-total
mkdir -p $CH/specs/csv-total
cat > $CH/.openspec.yaml <<'EOF'
schema: omp-gated
created: 2026-11-02
EOF
cat > $CH/proposal.md <<'EOF'
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
EOF
cat > $CH/specs/csv-total/spec.md <<'EOF'
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
EOF
cat > $CH/design.md <<'EOF'
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
EOF
cat > $CH/gate.md <<'EOF'
# Gate

- **Mandatory class**: none
- **Depth**: standard (the class is none and no review, gate or release mechanism changes)
- **Risk tier**: product
- **Author's risk assessment**: A wrong total reaches a finance reconciliation. What can break: a malformed line counted as a number, a total that drifts by a cent, a wrong line number in the error. The CLI reads one local file and writes to stdout and stderr; it holds no credential or personal data and changes no shared state, so the damage is a wrong figure a person checks against the invoice.
- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
- **Accepted residual risks**:
  - Sub-cent rounding: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected, so the printed total can differ from the supplier's invoice by one cent. Accepted because supplier feeds carry two decimals.
- **Out of scope for blocking**: none (the change adds one standalone CLI and touches no shared surface)
EOF
if [ "$MODE" = "ab" ]; then F1BOX=" "; else F1BOX=" "; fi
cat > $CH/tasks.md <<EOF
# Tasks

## 1. Implementation

- [x] 1.1 Add the price parser and cents conversion. Verify: \`bun test\`
- [x] 1.2 Add the CLI and the formatter. Verify: \`bun test\`

## 2. Documentation

- [x] 2.1 State the two-decimal input assumption in design.md. Verify: \`grep -q two design.md\`

## 3. Final verification

- [$F1BOX] 3.1 F1. Manual QA on the real surface: merge the default branch (\`main\`) into the work branch when it is not an ancestor of the head, and commit; then run \`bun src/cli.ts total FILE\` on five scenarios and keep one evidence file each in \`.omp/team-config/evidence/gate/csv-total/f1/\`: \`s1-happy.md\` (\`widget,19.99\` and \`gadget,5.01\` print \`25.00\`), \`s2-malformed.md\` (\`widget,abc\` exits 2 naming line 1, no total), \`s3-cents.md\` (ten lines of \`x,0.10\` print \`1.00\`), \`s4-empty.md\` (an empty file prints \`0.00\`), \`s5-large.md\` (\`big,1234.50\` prints a total whose digits are \`1234.50\`, with or without grouping separators). On the head after the last code commit; the QA lane judges the observations. Verify: \`test -s .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md && test -s .omp/team-config/evidence/gate/csv-total/f1/s5-large.md\`

## Workflow follow-up

- F2 merge gate (\`review-work\`), after 3.1 and never a checkbox: the record binds every file of this folder by \`plan_sha256\`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
EOF

capture_f1() {
  EV=.omp/team-config/evidence/gate/csv-total/f1
  mkdir -p $EV
  cap() { # name title expected data
    local name="$1" title="$2" expected="$3" data="$4"
    printf '%b' "$data" > /tmp/f1d-data.csv
    set +e; out=$(bun src/cli.ts total /tmp/f1d-data.csv 2>/tmp/f1d-err); code=$?; set -e
    {
      echo "# $title"; echo
      echo "Head: $(git rev-parse --short HEAD) (the code commit)"; echo
      echo "Input (\`/tmp/f1d-data.csv\`):"; echo '```'; printf '%b' "$data"; echo '```'; echo
      echo "Command: \`bun src/cli.ts total /tmp/f1d-data.csv\`"; echo
      echo "Expected: $expected"; echo
      echo "stdout: \`$out\`"; echo; echo "stderr: \`$(cat /tmp/f1d-err)\`"; echo; echo "exit: $code"
    } > $EV/$name.md
  }
  cap s1-happy "F1 s1 happy path" "prints 25.00, exit 0" 'widget,19.99\ngadget,5.01\n'
  cap s2-malformed "F1 s2 malformed price" "stderr names line 1, no total, exit 2" 'widget,abc\n'
  cap s3-cents "F1 s3 exact cents" "prints 1.00" 'x,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\n'
  cap s4-empty "F1 s4 empty file" "prints 0.00, exit 0" ''
  cap s5-large "F1 s5 large total" "digits 1234.50, grouping separators allowed" 'big,1234.50\n'
}

D=$(node $SK/validate-openspec-change.mjs --digest $CH)
cat > $CH/review.md <<EOF
# Review

- **Verdict**: OKAY
- **Reviewed digest**: $D
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
EOF
git add -A
git commit -q -m "feat: csv-total CLI, change folder"
if [ "$MODE" = "ab" ]; then
  capture_f1
  perl -pi -e 's/^- \[ \] 3\.1/- [x] 3.1/' $CH/tasks.md
  git add -A
  git commit -q -m "test(f1): csv-total CLI QA, five scenarios"
fi
if [ "$MODE" = "c" ]; then
  git switch -q main
  printf '# csvtotal\n\nSums a name,price file in exact cents.\n' > README.md
  git add README.md && git commit -q -m "docs: add README"
  git switch -q feat/csv-total
fi
git log --oneline --all --graph
