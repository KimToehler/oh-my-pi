# CHECK 2 fixture

## Approach
1. Cache the model list per provider in `packages/coding-agent/src/demo/model-cache.ts`; cache key = sha256(provider id). A cache hit skips discovery.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
