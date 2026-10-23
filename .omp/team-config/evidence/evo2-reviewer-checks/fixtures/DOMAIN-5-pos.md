# DOMAIN 5 fixture

## Approach
1. In `packages/metaharness/src/evo/transcript.ts`, a later transcript replay replaces the stored snapshot when its total tokens are higher.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
