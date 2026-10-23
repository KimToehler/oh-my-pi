# DOMAIN 2 fixture

## Approach
1. In `packages/metaharness/src/evo/launch.ts`, bind-mount the source tree into the agent container; source identity = sha of the tracked git diff.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
