---
description: Shared persistence API changes require production-caller inventory and broad caller-suite verification.
globs:
  - "**/*.test.ts"
  - "**/*Test.kt"
  - "**/*IT.kt"
  - "**/*_test.py"
---

# Lesson: Verify persistence API callers broadly

Recorded: 2026-10-03
Lesson id: verify-persistence-api-callers-broadly-9cc96440605603a9
Lesson hash: 9cc96440605603a9

## What went wrong
Task 20 changed writeBoulderState runtime semantics and only ran boulder-state plus feature-adapter tests. Four hook regressions and completed-state auto-selection failure remained because existing-state writers omitted expectRootRevision.

## Rule for next time
When changing a shared persistence API contract, grep every production caller and run tests for every caller directory. Compilation is insufficient. Any existing-state replacement must pass revision from state read immediately before write, with a regression test for each distinct production flow.
