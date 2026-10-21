# Executor reads approved snapshot

## Approach
1. In `packages/coding-agent/src/plan-mode/approved-plan.ts`, compute sha256 of `local://approved/<sha256>-<name>` and compare it with the reviewed digest; refuse on mismatch.
2. Later, when the executor prompt is built, read `local://approved/<sha256>-<name>` again by path and embed its text.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
