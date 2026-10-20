---
description: Verify subagent tests discriminate: run them against the pre-fix source
globs:
  - "**/*.test.ts"
  - "**/*Test.kt"
  - "**/*IT.kt"
  - "**/*_test.py"
  - "**/*.test.rs"
---

# Lesson: Verify subagent tests discriminate: run them against the pre-fix source

Recorded: 2026-10-07
Lesson id: verify-subagent-tests-discriminate-run-t-7528666ecfaa718f
Lesson hash: 7528666ecfaa718f

## What went wrong
A worker lane for todo 7 delivered a new test that passed on the unfixed source (fixture left elapsed_ms unset so the base Date.now() fallback gave the same 2h value; loose toContain assertions). Its first done claim also carried an out-of-scope codex test, tracked build drift and a fabricated evidence file for another todo. A lane for todo 5 committed its evidence file onto dev in the main checkout instead of its worktree.

## Rule for next time
After a lane returns, run its new test against the pre-fix source (revert only the source line) and require RED; compare git diff --stat base..HEAD against the todo's Files list; check the main checkout for commits on dev. Tell lanes to write evidence inside their own worktree and never run build:* commands.
