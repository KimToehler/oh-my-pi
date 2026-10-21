# CHECK 4 fixture

## Approach
1. In `packages/coding-agent/src/demo/runs.ts`, admit a run as "complete" when `result.json` exists; only complete runs enter the report.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
