#!/usr/bin/env bash
# Disposable F1/F2 QA driver for openspec change fee-report. Usage: run.sh <repo> <outdir> <row>...
set -euo pipefail
REPO=$1; OUT=$2; shift 2
mkdir -p "$OUT/fixtures"
cd "$REPO"
FX="$OUT/fixtures"

hdr() { printf '$ %s\n' "$*"; }
# Real pty transcript (CR stripped), then the exact piped bytes and exit status.
cli() {
  local f=$1
  hdr "script -q /dev/null bun src/cli.ts ${f#$REPO/}   # pty"
  script -q /dev/null bun src/cli.ts "$f" | tr -d '\r'
  hdr "bun src/cli.ts ${f#$REPO/} | od -c   # exact stdout bytes"
  set +e; bun src/cli.ts "$f" > "$OUT/.stdout" 2> "$OUT/.stderr"; local rc=$?; set -e
  od -c "$OUT/.stdout"
  printf 'exit=%s stderr_bytes=%s\n\n' "$rc" "$(wc -c < "$OUT/.stderr" | tr -d ' ')"
}
expect_bytes() { # file expected-printf-format label
  local exp; exp=$(mktemp)
  printf "$2" > "$exp"
  bun src/cli.ts "$1" > "$OUT/.stdout"
  if cmp -s "$exp" "$OUT/.stdout"; then echo "CHECK $3: stdout equals expected bytes -> MATCH"; else
    echo "CHECK $3: stdout differs from expected bytes -> MISMATCH"; echo "expected:"; od -c "$exp"; fi
  echo
}

for row in "$@"; do
  case $row in
  QA1) {
    echo "# QA1 Requirement: Late fee from amount and days overdue (library API, bun)"
    cat > "$FX/qa1-fee.ts" <<'TS'
import { lateFee } from "../../../../../../../src/fee";
const cases: [number, number, number, string][] = [
  [10000, 30, 200, "scenario One complete period"],
  [10000, 400, 2500, "scenario Fee cap"],
  [10000, 29, 0, "scenario Negative control (29 days -> 0)"],
  [10000, 0, 0, "0 days"],
  [10000, 59, 200, "59 days = 1 complete period"],
  [10000, 60, 400, "60 days = 2 periods"],
  [10000, 360, 2400, "12 periods = 24%"],
  [10000, 390, 2500, "13 periods = 26% -> cap 25%"],
  [99, 30, 1, "1.98 cents rounds down to 1"],
  [49, 30, 0, "0.98 cents rounds down to 0"],
  [0, 400, 0, "zero amount"],
  [123456789, 400, 30864197, "cap on large amount, floor(30864197.25)"],
];
let fails = 0;
for (const [a, d, want, label] of cases) {
  const got = lateFee(a, d);
  const ok = got === want && Number.isInteger(got);
  if (!ok) fails++;
  console.log(`lateFee(${a}, ${d}) = ${got}  expected ${want}  ${ok ? "OK" : "FAIL"}  (${label})`);
}
console.log(`fails=${fails}`);
TS
    hdr "bun ${FX#$REPO/}/qa1-fee.ts"
    bun "$FX/qa1-fee.ts"
  } > "$OUT/qa1-late-fee.txt" 2>&1 ;;
  QA2) {
    echo "# QA2 Requirement: Fee report rendering (render command on QA-built reports)"
    printf '%s\n' '{"lines":[{"id":"a","dueDate":"2026-01-10","feeCents":200},{"id":"b","dueDate":"2026-01-12","feeCents":1250}]}' > "$FX/qa2-lines.json"
    printf '%s\n' '{"lines":[{"id":"big","dueDate":"2026-01-10","feeCents":123456789}]}' > "$FX/qa2-big.json"
    printf '%s\n' '{"lines":[]}' > "$FX/qa2-empty.json"
    printf '%s\n' '{"lines":[{"id":"z","dueDate":"2026-03-01","feeCents":5},{"id":"y","dueDate":"2026-02-01","feeCents":7}]}' > "$FX/qa2-order-cents.json"
    echo "## scenario Lines and total"; cli "$FX/qa2-lines.json"
    expect_bytes "$FX/qa2-lines.json" 'a\t2026-01-10\t2.00\nb\t2026-01-12\t12.50\nTOTAL\t\t14.50\n' "lines-and-total"
    echo "## scenario Large fee grouped"; cli "$FX/qa2-big.json"
    expect_bytes "$FX/qa2-big.json" 'big\t2026-01-10\t1,234,567.89\nTOTAL\t\t1,234,567.89\n' "large-fee-grouped"
    echo "## scenario Negative control (no lines)"; cli "$FX/qa2-empty.json"
    expect_bytes "$FX/qa2-empty.json" 'No late fees\n' "empty-report"
    echo "## given order kept, 5 cents is 0.05"; cli "$FX/qa2-order-cents.json"
    expect_bytes "$FX/qa2-order-cents.json" 'z\t2026-03-01\t0.05\ny\t2026-02-01\t0.07\nTOTAL\t\t0.12\n' "order-and-cents"
  } > "$OUT/qa2-render.txt" 2>&1 ;;
  QA3) {
    echo "# QA3 Happy path: render the shipped sample report (package script and direct)"
    hdr "script -q /dev/null bun run render samples/report.json   # pty"
    script -q /dev/null bun run render samples/report.json | tr -d '\r'
    echo
    cli "$REPO/samples/report.json"
    expect_bytes "$REPO/samples/report.json" 'inv-7\t2026-01-10\t25.00\ninv-3\t2026-01-12\t12.50\ninv-9\t2026-02-01\t2.00\nTOTAL\t\t39.50\n' "sample-report"
  } > "$OUT/qa3-sample-happy-path.txt" 2>&1 ;;
  QA4) {
    echo "# QA4 Riskiest edge: digit-grouping boundaries of the amount formatter via render"
    printf '%s\n' '{"lines":[{"id":"e1","dueDate":"2026-01-01","feeCents":0},{"id":"e2","dueDate":"2026-01-01","feeCents":99999},{"id":"e3","dueDate":"2026-01-01","feeCents":100000},{"id":"e4","dueDate":"2026-01-01","feeCents":100005},{"id":"e5","dueDate":"2026-01-01","feeCents":99999999},{"id":"e6","dueDate":"2026-01-01","feeCents":100000000},{"id":"e7","dueDate":"2026-01-01","feeCents":100000000000}]}' > "$FX/qa4-boundaries.json"
    cli "$FX/qa4-boundaries.json"
    expect_bytes "$FX/qa4-boundaries.json" 'e1\t2026-01-01\t0.00\ne2\t2026-01-01\t999.99\ne3\t2026-01-01\t1,000.00\ne4\t2026-01-01\t1,000.05\ne5\t2026-01-01\t999,999.99\ne6\t2026-01-01\t1,000,000.00\ne7\t2026-01-01\t1,000,000,000.00\nTOTAL\t\t1,001,001,100,004.00\n' "grouping-boundaries"
  } > "$OUT/qa4-grouping-boundaries.txt" 2>&1 ;;
  QA5) {
    echo "# QA5 Regression: committed test suite, type check, CLI usage error"
    hdr "bun test"; set +e; bun test 2>&1; echo "exit=$?"
    hdr "bunx tsc --noEmit -p ."; bunx tsc --noEmit -p . 2>&1; echo "exit=$?"
    hdr "bun src/cli.ts   # no argument"; bun src/cli.ts; echo "exit=$?"; set -e
  } > "$OUT/qa5-regression.txt" 2>&1 ;;
  *) echo "unknown row $row" >&2; exit 2 ;;
  esac
done
rm -f "$OUT/.stdout" "$OUT/.stderr"

