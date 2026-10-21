# CHECK 8 fixture

## Approach
1. Add a server option `bind` in `packages/coding-agent/src/demo/server.ts`, default `0.0.0.0`. When the request gives no run id, the latest run is used.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
