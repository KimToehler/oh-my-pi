---
description: Do not make compensating cleanup depend on liveness state that failure or cancellation intentionally revokes
globs:
  - "**/*.kt"
  - "**/*.ts"
---

# Lesson: Separate mutation liveness from cleanup ownership

Recorded: 2026-09-24
Lesson id: separate-mutation-liveness-from-cleanup-96dd1b50c6cb9243
Lesson hash: 96dd1b50c6cb9243

## What went wrong
A blanket "job is RUNNING and holds the lease" fence was applied to every write of a background generation job, including the delete that rolls back its artifacts. Cancellation moves the job to FAILED before the compensating rollback runs, so the fence rejected the cleanup; a `runCatching` swallowed the rejection and left a hidden, half-generated artifact orphaned.

## Rule for next time
When fencing a job's mutations, classify each operation by purpose. Creation, extension and publication require live job ownership and the lease. Compensating cleanup must stay authorized after terminal transitions and lease transfer, while still requiring that the artifact belongs to that exact job and user. Add a real-database test that cancels mid-operation and proves the cleanup removes every generated artifact.
