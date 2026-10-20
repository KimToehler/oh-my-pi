---
description: Backward-compat tests must preserve old on-disk shape instead of using current writers.
globs:
  - "**/*.test.ts"
  - "**/*Test.kt"
  - "**/*IT.kt"
  - "**/*_test.py"
---

# Lesson: Test migrations with prior bytes

Recorded: 2026-10-03
Lesson id: test-migrations-with-prior-bytes-99a195b888eb4d76
Lesson hash: 99a195b888eb4d76

## What went wrong
Legacy revision compatibility test created boulder.json through new writer, which stamped revision and hid bug where undefined expectation was passed for real revisionless files.

## Rule for next time
For persisted schema compatibility, hand-write exact prior-version bytes. Convert optional persisted revision with `revision ?? 0` before passing optimistic concurrency expectations; never pass undefined when missing means zero.
