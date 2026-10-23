# DOMAIN 4 fixture

## Approach
1. In `packages/metaharness/src/evo/fitness.ts`, report `tokensDelta` and `costDelta`, both summed over main agent and subagents from transcript usage.

| Metric | scope | source | deduplicated over | missing value = |
|---|---|---|---|---|
| tokens | main + subagents | transcript usage | request id | null |
| cost | main + subagents | transcript usage.cost | request id | null |

## Verification
- Control: a variant that delegates work to subagents moves both metrics alike.
- `bun test packages/metaharness/test/evo-fitness.test.ts`

- Merge gate: not applicable (fixture)
