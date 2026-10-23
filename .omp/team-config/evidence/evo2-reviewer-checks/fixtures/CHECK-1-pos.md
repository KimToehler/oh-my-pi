# CHECK 1 fixture

## Approach
1. Add `OMP_DEMO_TOKEN` to the env of a spawned helper process in `packages/coding-agent/src/demo/helper.ts` and persist the helper's stdout to `run.log`. The token must never appear in logs.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
