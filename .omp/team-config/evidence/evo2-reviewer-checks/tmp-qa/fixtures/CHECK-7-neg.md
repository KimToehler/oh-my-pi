# CHECK 7 fixture

## Approach
1. Add `stagedFiles()` in `packages/coding-agent/src/demo/stage.ts` (one `git ls-files` enumeration). The staging step and `packages/coding-agent/src/demo/hash.ts` both consume its result; neither enumerates on its own.

## Verification
- Control: an ignored file and an exec-bit change are seen identically by staging and hashing.
- `bun test packages/coding-agent/test/demo-stage.test.ts`

- Merge gate: not applicable (fixture)
