# DOMAIN 5 fixture

## Approach
1. In `packages/metaharness/src/evo/transcript.ts`, a later replay replaces a stored snapshot only when it is at least as rich in every usage bucket and in cost.

| Key | order | tie | conflict |
|---|---|---|---|
| task tool-call id | component-wise dominance over every usage bucket and cost | keep known values | keep old record, increment task_snapshot_conflicts |

## Verification
- Controls: replay without cost does not replace; replay with equal total but different bucket split counts as conflict.
- `bun test packages/metaharness/test/evo-transcript.test.ts`

- Merge gate: not applicable (fixture)
