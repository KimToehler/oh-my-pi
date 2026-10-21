# Executor reads approved snapshot

## Approach
1. In `packages/coding-agent/src/plan-mode/approved-plan.ts`, read `local://approved/<sha256>-<name>` once into memory, compute its sha256 and compare it with the reviewed digest; refuse on mismatch.
2. Build the executor prompt from that same in-memory buffer; the path is not read again.

Verified bytes: snapshot read once in Step 1 | same buffer used in Step 2 | identical | no window

## Verification
- Control: rewrite the snapshot file after Step 1; the executor prompt still holds the verified bytes.
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
