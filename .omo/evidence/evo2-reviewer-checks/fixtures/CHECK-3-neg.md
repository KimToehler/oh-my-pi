# CHECK 3 fixture

## Approach
1. In `packages/coding-agent/src/demo/jobs.ts`, reject job names containing `/`, `..` or a space.

Allow-set instead: job names match ^[a-z0-9-]{1,64}$; control: every printable ASCII character outside the set is rejected

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
