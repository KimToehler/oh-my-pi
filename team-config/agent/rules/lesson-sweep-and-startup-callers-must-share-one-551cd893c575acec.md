---
description: Sweep and startup callers must share one per-item-safe reconciliation loop
globs:
  - "**/*.kt"
---

# Lesson: Sweep and startup callers must share one per-item-safe reconciliation loop

Recorded: 2026-09-26
Lesson id: sweep-and-startup-callers-must-share-one-551cd893c575acec
Lesson hash: 551cd893c575acec

## What went wrong
Terminal-job reconciliation was wired into two callers, a startup listener and a scheduled stale-job sweep, each with its own loop. The listener caught failures per job (`catch (Exception)`, `rethrowIfCancelled()`, log). The sweep used a bare `forEach`, so one reconcile that threw (for example a conflict from a concurrent cleanup) skipped every later job on that tick. Review caught it; the loop moved into the service and both callers delegate to it. Moving the broad catch into the service then failed detekt `TooGenericExceptionCaught` at commit time.

## Rule for next time
When a scheduled task and a startup listener process the same work list, write the loop once in the service and make every caller delegate to it. The loop needs a per-item `try`/`catch (Exception)`, `rethrowIfCancelled()`, and `logger.error`. Never add a second bare `forEach` over the same list. Cover it with a unit test where item 1 throws and item 2 is still processed. Add `@Suppress("TooGenericExceptionCaught")` to a moved broad catch before committing.
