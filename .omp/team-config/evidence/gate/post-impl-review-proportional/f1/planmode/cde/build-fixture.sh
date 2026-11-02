#!/usr/bin/env bash
# usage: build-f1c-cde.sh <dir> <tier>
set -euo pipefail
D=$1; TIER=$2
SK=$HOME/.omp/profiles/pirp/agent/skills/review-work/scripts
rm -rf "$D"; mkdir -p "$D"; cd "$D"
git init -q -b main
git config user.name "Fixture QA"; git config user.email fixture@example.invalid
cat > package.json <<'J'
{ "name": "release-gate-fixture", "private": true, "type": "module", "scripts": { "test": "bun test" } }
J
cat > .gitignore <<'G'
node_modules/
/.omp/team-config/*
!/.omp/team-config/evidence/
/.omp/team-config/evidence/*
!/.omp/team-config/evidence/**/
!/.omp/team-config/evidence/gate/**
!/.omp/team-config/evidence/**/*trailer*
G
mkdir -p scripts
cat > scripts/gate.ts <<'T'
// Release gate: decides whether a release candidate is admitted to ship.
export interface Candidate {
  version: string
  checks: { name: string; passed: boolean }[]
  approvals: string[]
}

export interface Decision {
  admitted: boolean
  reason: string
}

export function decide(c: Candidate): Decision {
  const failed = c.checks.filter((k) => !k.passed).map((k) => k.name)
  if (failed.length > 0) return { admitted: false, reason: `failed checks: ${failed.join(", ")}` }
  if (c.approvals.length < 1) return { admitted: false, reason: "no approval" }
  return { admitted: true, reason: "admitted" }
}

if (import.meta.main) {
  const c = JSON.parse(await Bun.file(process.argv[2] ?? "/dev/stdin").text()) as Candidate
  const d = decide(c)
  console.log(JSON.stringify(d))
  process.exit(d.admitted ? 0 : 1)
}
T
cat > scripts/gate.test.ts <<'T'
import { expect, test } from "bun:test"
import { decide } from "./gate"

const ok = [{ name: "unit", passed: true }]

test("admits with one approval", () => {
  expect(decide({ version: "1.0.0", checks: ok, approvals: ["a"] }).admitted).toBe(true)
})
test("refuses failed check", () => {
  expect(decide({ version: "1.0.0", checks: [{ name: "unit", passed: false }], approvals: ["a"] }).admitted).toBe(false)
})
test("refuses without approval", () => {
  expect(decide({ version: "1.0.0", checks: ok, approvals: [] }).reason).toBe("no approval")
})
T
cat > README.md <<'R'
# release-gate-fixture
`scripts/gate.ts` decides whether a release candidate (JSON on stdin or a file) is admitted. Exit 0 admitted, 1 refused.
R
git add -A; git commit -q -m "chore: release gate"
node $SK/install-openspec-workflow.mjs "$D" > /tmp/pirp-install-$$.log 2>&1 || true
git add -A; git commit -q -m "chore: install omp-gated schema" || true
git checkout -q -b feat/gate-quorum
mkdir -p .omp/plans
PLAN=.omp/plans/gate-quorum.md
cat > $PLAN <<P
# Gate quorum: require two distinct approvals for a release

## Goal
The release gate admits a candidate after one approval. Require two distinct approvers, so a single person cannot admit a release alone.

## TODOs
- [x] 1. \`scripts/gate.ts\`: count distinct approvers; admit only with at least 2 (refusal reason \`needs 2 approvals, got N\`)
- [x] 2. \`scripts/gate.test.ts\`: cover two approvals, duplicate approver, one approval

## Final verification wave
- [ ] F1. Manual QA on the real surface, one evidence path per scenario in the \`f1/\` directory below the record's evidence directory (by default \`.omp/team-config/evidence/gate/gate-quorum/f1/\`): first merge the default branch into the work branch when it is not an ancestor of the head, and commit; then run QA on the head after the last code commit
- [ ] F2. Merge gate: \`review-work\`, SHA-bound team-config.merge-gate/v3 record validated

## Merge gate
- Author's risk assessment: The gate script decides which release candidates are admitted. A wrong count admits a release with one approval, or refuses a good one. No credentials or personal data involved.
- Mandatory class: none
- Risk tier: $TIER
- Whole-diff review: not needed (whole-diff surface reviewed in F2)
- Accepted residual risks: approver identity is a free-form string and is not authenticated against any directory
- Out of scope for blocking: the CLI wrapper's JSON input validation
- Feature-specific criteria:
  - Invariant: a candidate is admitted only when no check failed and at least two distinct approver strings are present
    Positive witness: approvals ["a","b"] with passing checks exits 0 with \`admitted\`
    Negative control: approvals ["a","a"] or ["a"] admitted with passing checks
    Observable: exit code and the JSON reason line printed by \`bun scripts/gate.ts <file>\`
    Boundary: the CLI entry point of \`scripts/gate.ts\`
  - Mechanical: bun test passes
    Invariant: the unit tests of the gate pass
    Observable: \`bun test\` exits 0
    Boundary: scripts/gate.test.ts
P
git add -A; git commit -q -m "docs: plan gate-quorum"
python3 - <<'PY'
import re
p='scripts/gate.ts'; s=open(p).read()
s=s.replace('''  if (c.approvals.length < 1) return { admitted: false, reason: "no approval" }''','''  const distinct = new Set(c.approvals).size
  if (distinct < 2) return { admitted: false, reason: `needs 2 approvals, got ${distinct}` }''')
open(p,'w').write(s)
p='scripts/gate.test.ts'; s=open(p).read()
s=s.replace('''test("admits with one approval", () => {
  expect(decide({ version: "1.0.0", checks: ok, approvals: ["a"] }).admitted).toBe(true)
})''','''test("admits with two approvals", () => {
  expect(decide({ version: "1.0.0", checks: ok, approvals: ["a", "b"] }).admitted).toBe(true)
})
test("refuses one approval", () => {
  expect(decide({ version: "1.0.0", checks: ok, approvals: ["a"] }).reason).toBe("needs 2 approvals, got 1")
})
test("refuses duplicate approver", () => {
  expect(decide({ version: "1.0.0", checks: ok, approvals: ["a", "a"] }).admitted).toBe(false)
})''')
s=s.replace('''test("refuses without approval", () => {
  expect(decide({ version: "1.0.0", checks: ok, approvals: [] }).reason).toBe("no approval")
})''','''test("refuses without approval", () => {
  expect(decide({ version: "1.0.0", checks: ok, approvals: [] }).reason).toBe("needs 2 approvals, got 0")
})''')
open(p,'w').write(s)
PY
git add -A; git commit -q -m "feat(gate): require two distinct approvers"
