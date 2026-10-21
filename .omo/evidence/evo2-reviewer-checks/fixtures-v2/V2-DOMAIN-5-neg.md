# Prefer the newest replay of a task snapshot

## Context
`packages/metaharness/src/evo/transcript-task.ts` folds task snapshots per `toolCallId`: `dominates` (86-88) compares results, requests and each usage bucket; `recordTaskDetails` (97-) keeps the stored snapshot on conflict and the caller increments `taskSnapshotConflicts`, persisted as `task_snapshot_conflicts`.

## Approach
1. When two replays of the same task snapshot arrive, keep the later one.

### Replacing means dominating (DOMAIN 5)

| Key | order | tie | conflict |
|---|---|---|---|
| `toolCallId` | replace only when the later snapshot dominates (`dominates`: results, requests and every usage bucket >=); arrival order alone never replaces | equal components: keep the known cost; with both costs known, the larger one | non-dominating later snapshot: keep the stored one, increment `taskSnapshotConflicts` (makes the trial lossy, so ineligible) |

"Keep the later one" therefore means: the later replay wins only when it dominates; this is the existing rule, the change adds a test, no new replacement path.

Controls: a later replay missing cost does not overwrite a known cost; a later replay with equal total tokens but a different bucket split is a conflict and increments the counter.

## Verification
- Extend `packages/metaharness/test/evo-transcript.test.ts` with both controls.
- `bun test packages/metaharness/test/evo-transcript.test.ts`

- Merge gate: not applicable (fixture)
