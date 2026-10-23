# CHECK 7 fixture

## Approach
1. Module `packages/coding-agent/src/demo/stage.ts` lists the staged files with `git ls-files`; module `packages/coding-agent/src/demo/hash.ts` hashes the files it lists itself with `readdir`. The hash identifies the staged tree.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
