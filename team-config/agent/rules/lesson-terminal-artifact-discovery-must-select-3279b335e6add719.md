---
description: Terminal-artifact discovery must select jobs by every artifact they can leave
globs:
  - "**/*.kt"
  - "**/*.ts"
---

# Lesson: Terminal-artifact discovery must select jobs by every artifact they can leave

Recorded: 2026-09-26
Lesson id: terminal-artifact-discovery-must-select-3279b335e6add719
Lesson hash: 3279b335e6add719

## What went wrong
The first fix found failed generation jobs by inner-joining the artifact table on the job id. A job that died after allocating its candidate row but before its hidden artifact existed (an early return, a crash, a stale sweep) was never reconciled. Its pending candidate survived, and the allocation step's pending-candidate check then blocked that target permanently with a conflict. Review caught it; the fix selects jobs that own either artifact.

## Rule for next time
Before writing reconciliation discovery, list every artifact each lifecycle step creates (candidate row, hidden artifact, target marker). Select jobs that own ANY of them, one query per artifact merged by job id. Never inner-join on a single artifact. Add a real-database test for each crash window (after step 1 only, after step 2) that asserts the next allocation succeeds, and prove it RED on the pre-fix tree.
