# CHECK 2 fixture

## Approach
1. Cache the model list per provider in `packages/coding-agent/src/demo/model-cache.ts`. Cache key = sha256 over (provider id, base URL, API key fingerprint). Request time is excluded: it does not change the returned list.

## Verification
- Control per key input: two lookups differing only in provider id, only in base URL, only in key fingerprint each miss the cache.
- `bun test packages/coding-agent/test/demo-model-cache.test.ts`

- Merge gate: not applicable (fixture)
