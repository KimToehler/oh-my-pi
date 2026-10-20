---
description: Distinguish pre-existing source from newly added diff lines during adversarial verification.
globs:
  - "**/*.rs"
  - "**/*.ts"
  - "**/*.kt"
---

# Lesson: Check additions with diff markers

Recorded: 2026-08-28
Lesson id: check-additions-with-diff-markers-8d598e123866cff8
Lesson hash: 8d598e123866cff8

## What went wrong
Flagged existing `#[allow(clippy::unwrap_or_default)]` as new because review inspected HEAD source without proving line was added by `main...HEAD` diff.

## Rule for next time
For requirements forbidding newly introduced constructs, report violation only when exact line appears with `+` in scoped diff; source presence alone is insufficient.
