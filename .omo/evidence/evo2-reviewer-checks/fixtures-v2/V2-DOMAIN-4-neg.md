# Report requests per task next to cost per task

## Context
`packages/metaharness/src/evo/transcript.ts:15-49` (`TranscriptMetrics`) and `fitness.ts` (`computeFitness`) compare variants; `efficiency.ts` (`compareEfficiency`) builds per-task ratios. Tokens and cost already cover main agent plus delegated tasks; `toolCalls` covers the main agent only.

## Approach
1. Add `requestsPerTask` to `FitnessReport` and compare it in `compareEfficiency` next to cost.

### One number, one scope (DOMAIN 4)

| Metric | scope | source | deduplicated over | missing value = |
|---|---|---|---|---|
| tokens | main + delegated tasks | transcript usage | request (task snapshots folded once per `toolCallId`) | null |
| cost | main + delegated tasks | transcript `usage.cost.total` | same | null; trial counted in `costMissingTrials` |
| requests (new) | main + delegated tasks | transcript request count + task snapshot `requests` | same | null |
| toolCalls | main agent only (child counts unavailable) | `tool_execution_start` | n/a | excluded from comparisons, labelled main-only |

All compared numbers are per-task means, macro-averaged across tasks, the same as cost (`computeFitness`).

Control: a variant that moves work into a delegated task moves tokens, cost and requests alike; `toolCalls` is not compared.

## Verification
- Extend `packages/metaharness/test/evo-fitness.test.ts` and `packages/metaharness/test/evo-efficiency.test.ts`.
- `bun test packages/metaharness/test/evo-fitness.test.ts packages/metaharness/test/evo-efficiency.test.ts`

- Merge gate: not applicable (fixture)
