#!/usr/bin/env bash
# second default-branch commit: grouped thousands, reachable only for totals of 1000.00 or more
set -euo pipefail
cd "$1"
git switch -q main
cat > src/format.ts <<'XEOF'
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
XEOF
git add src/format.ts
git -c user.name="Fixture Author" -c user.email=fixture@example.invalid commit -q -m "feat: group thousands in formatted totals of 1000 or more"
git switch -q -
