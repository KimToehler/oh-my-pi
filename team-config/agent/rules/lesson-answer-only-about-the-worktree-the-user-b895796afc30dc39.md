---
description: Answer only about the worktree the user named
globs:
  - "**/.worktrees/**"
  - "**/.omp/plans/**"
---

# Lesson: Answer only about the worktree the user named

Recorded: 2026-10-07
Lesson id: answer-only-about-the-worktree-the-user-b895796afc30dc39
Lesson hash: b895796afc30dc39

## What went wrong
User asked about the `upstream-family` worktree. I appended status and a merge offer for `completed-work-isolation`, which another parallel session owned and was about to merge.

## Rule for next time
When the user names a specific worktree or work, report only on that one. Do not offer actions on other active works or worktrees from the plan list; they may be owned by a parallel session.
