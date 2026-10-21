# DOMAIN 1 fixture

## Approach
1. In `packages/metaharness/src/evo/verifier.ts`, the verifier phase runs `bun install` before its tests; the verifier container runs with network_mode no-network.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
