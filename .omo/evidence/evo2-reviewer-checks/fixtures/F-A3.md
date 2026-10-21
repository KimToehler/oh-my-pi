# Rename review runtime constant

## Approach
1. In `packages/coding-agent/src/plan-mode/plan-review.ts`, rename the module-local constant `REVIEW_MAX_RUNTIME_MS` (declared at line 63, used at line 191) to `PLAN_REVIEW_MAX_RUNTIME_MS`. No other file references it.

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts` passes.

- Merge gate: not applicable (rename)
