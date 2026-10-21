# DOMAIN 4 fixture

## Approach
1. In `packages/metaharness/src/evo/fitness.ts`, report `tokensDelta` from all agents including subagents and `costDelta` from the main agent only.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
