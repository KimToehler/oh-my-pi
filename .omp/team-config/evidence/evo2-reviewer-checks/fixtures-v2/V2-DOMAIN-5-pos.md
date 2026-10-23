# Prefer the newest replay of a task snapshot

## Context
`packages/metaharness/src/evo/transcript-task.ts` folds task snapshots per `toolCallId`: `dominates` (86-88) compares results, requests and each usage bucket; `recordTaskDetails` (97-) keeps the stored snapshot on conflict and the caller increments `taskSnapshotConflicts`, persisted as `task_snapshot_conflicts`.

## Approach
1. When two replays of the same task snapshot arrive, keep the later one.

## Verification
- Extend `packages/metaharness/test/evo-transcript.test.ts` with both controls.
- `bun test packages/metaharness/test/evo-transcript.test.ts`

- Merge gate: not applicable (fixture)
