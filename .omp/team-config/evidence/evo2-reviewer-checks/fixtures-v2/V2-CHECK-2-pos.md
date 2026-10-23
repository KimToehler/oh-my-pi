# Reuse provider uploads across sessions by content

## Context
`packages/coding-agent/src/blob-broker/provider-file-types.ts` caches provider-native uploads. `cacheKey(provider, credentialHash, contentHash)` (156-158) decides whether a stored handle is reused; `ProviderFileCache.get/set/delete` (259-299) consume it.

## Approach
1. Add `mimeType` to the stored handle comparison: a cached handle is reused only when the requested `mimeType` equals the stored one.
2. Persist entries as today.

## Verification
- Extend `packages/coding-agent/test/provider-files.test.ts` (305-363) with the per-input controls.
- `bun test packages/coding-agent/test/provider-files.test.ts`

- Merge gate: not applicable (fixture)
