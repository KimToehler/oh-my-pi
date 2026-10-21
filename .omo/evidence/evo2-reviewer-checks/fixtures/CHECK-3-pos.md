# CHECK 3 fixture

## Approach
1. In `packages/coding-agent/src/demo/jobs.ts`, reject job names containing `/`, `..` or a space.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
