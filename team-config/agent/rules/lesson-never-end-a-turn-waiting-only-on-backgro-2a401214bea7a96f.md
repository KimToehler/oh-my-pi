---
description: When resuming after waiting on background tasks, check for hung child sessions
globs:
  - "**/.omo/plans/**"
  - "**/.omo/drafts/**"
---

# Lesson: When resuming after waiting on background tasks, check for hung child sessions

Recorded: 2026-10-10
Lesson id: never-end-a-turn-waiting-only-on-backgro-2a401214bea7a96f
Lesson hash: 2a401214bea7a96f

## What went wrong
Ending the turn to wait for 4 Oracle plan-review tasks was correct. But all four stalled mid LLM stream (the provider stream was the last log line), never sent a completion notification, and after an IDE/ACP restart they belonged to another runtime (`Task not found in this runtime`). On resume I had no staleness check ready.

## Rule for next time
Ending a turn to wait for background notifications is correct and expected (owner, 2026-10-10). When the session resumes, run `read proc://` to see each pending child's status and last activity. A child silent >15 min mid-stream is hung: `write proc://<id>/kill`, then re-dispatch a smaller-scope or fallback-model task, or proceed with the reviews already received and record the lane as inconclusive. After an omp restart, read pre-restart children via `history://<id>` / `agent://<id>`; they will not notify this session.
