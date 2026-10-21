# DOMAIN 3 fixture

## Approach
1. In `packages/metaharness/src/runner.ts`, the runner starts a token proxy in the manager process and spawns detached agents that use it.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
