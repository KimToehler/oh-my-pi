---
description: Evidence discipline - a probe counts only after it was seen failing without the fix, RED must come from the committed test, verify fixes and guards on the real code, re-pin coverage before inverting a test, and write evidence from command output, never memory
globs:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/*Test.kt"
  - "**/*IT.kt"
  - "**/*_test.py"
  - "**/*.test.rs"
  - "**/.omp/team-config/evidence/**"
  - "**/docs/evidence/**"
  - "**/*-audit.ts"
  - "**/scripts/validate-*.mjs"
  - "**/.agents/skills/*-qa/**"
---

# Evidence Discipline

**A probe that was never observed red is not evidence.** Run every QA probe, script, or
integration test against a build with the fix reverted and confirm it fails. If the negative
control passes anyway, do not weaken the assertion: find the path that should have run and
assert on a signal unique to it, not on a coarse count that unrelated paths also move. Until
then, say the scenario is unproven.

**RED comes from the committed test on the unfixed code.** Match the test name in the RED
log to a test in the committed diff, run it on the parent commit, and check that no
temporary production hook was involved. Suite runs count only on the committed tree.

**Verify on the production seam.** Before claiming a fix landed, grep the production file
for the removed construct or run `git log -L<line>,<line>:<file>`. A correct copy of the
logic inside a test file masks an unrepaired production module; import the real code
instead of reimplementing it.

**Judge a guard with the guard's own code.** To check whether an audit, validator, or probe
reached the right verdict, run its real predicate (import it, or copy it verbatim) and print
raw hits next to flagged hits. A hand-rolled model of its parsing that disagrees is evidence
about your model first.

**Inverting a test can delete unrelated coverage.** Before rewriting or repurposing a test,
list every assertion it carried. Mutate each production branch it touched and confirm
another test still goes red; if none does, re-pin that coverage with a trigger independent
of your change. A green suite after a test rewrite is unverified until then.

**Evidence is written from command output, never recalled.** Every SHA, path, line number,
and test name in an evidence, gate, or plan record comes from a command in the same session.
Run `git cat-file -e <sha>` and `git show --name-only <sha>` before declaring the record
done. A validator checks shape, not truth.

**QA commit subjects state the verdict.** Name the surface driven and the observed outcome;
say explicitly when a run was inconclusive or blocked. Never let a subject imply a scenario
passed that the evidence does not establish.
