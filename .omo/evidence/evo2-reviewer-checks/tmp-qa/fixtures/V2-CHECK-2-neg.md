# Reuse provider uploads across sessions by content

## Context
`packages/coding-agent/src/blob-broker/provider-file-types.ts` caches provider-native uploads. `cacheKey(provider, credentialHash, contentHash)` (156-158) decides whether a stored handle is reused; `ProviderFileCache.get/set/delete` (259-299) consume it.

## Approach
1. Add `mimeType` to the stored handle comparison: a cached handle is reused only when the requested `mimeType` equals the stored one.
2. Persist entries as today.

### Identity (CHECK 2)

| Input | affects the result? | in key? | compared against |
|---|---|---|---|
| provider | yes: handles are provider-scoped | yes | requested provider; `set` also checks `handle.provider` (260-279) |
| credential | yes: handles belong to an account | yes, as `hashProviderFileCredential` | hash of the current credential |
| content bytes | yes | yes, as `contentHash` (64 hex, lowercased, 161-165) | `hashProviderFileContent(bytes)` of the request |
| mimeType | yes: providers reject a handle reused under another type | yes (new) | requested mimeType |
| cache file (`#indexPath`) | scope only | no: separate files never share entries (232-249) | n/a |
| `expiresAt` | validity, not sameness | no: an expired entry is a miss, checked on `get` | current time |
| handle `id`, `uri`, `bytes`, delete action | stored value | no | n/a |

Persisted provenance: `provider`, `credentialHash`, `contentHash`, `mimeType` are validated on load and rebuilt into the same composite key (386-404); a field that fails validation drops the entry.

Control per input: four lookups that differ only in provider, credential, content bytes, or mimeType each miss; an expired entry misses.

## Verification
- Extend `packages/coding-agent/test/provider-files.test.ts` (305-363) with the per-input controls.
- `bun test packages/coding-agent/test/provider-files.test.ts`

- Merge gate: not applicable (fixture)
