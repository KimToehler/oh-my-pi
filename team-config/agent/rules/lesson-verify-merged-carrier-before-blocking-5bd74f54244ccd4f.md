---
description: When the user says prerequisite work is merged, check the cited lines in the worktree and continue; a subagent's missing tools never block the main agent
globs:
  - "**/*"
---

# Lesson: Verify merged carrier before blocking

Recorded: 2026-09-05
Lesson id: verify-merged-carrier-before-blocking-5bd74f54244ccd4f
Lesson hash: 5bd74f54244ccd4f

## What went wrong
The user said the prerequisite work was merged. I reported missing context from the earlier session although the carrier fields and their persisted mapping were already committed in the current worktree. I also treated a delegated agent's missing tools as if the main agent lacked them, and stopped.

## Rule for next time
When the user says prerequisite work is merged, read the exact cited lines in the current worktree and continue with the edit and shell tools you have. Never block because a delegated agent lacked a tool the main agent has; do the step yourself or give the agent what it needs.
