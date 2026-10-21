# Report requests per task next to cost per task

## Context
`packages/metaharness/src/evo/transcript.ts:15-49` (`TranscriptMetrics`) and `fitness.ts` (`computeFitness`) compare variants; `efficiency.ts` (`compareEfficiency`) builds per-task ratios. Tokens and cost already cover main agent plus delegated tasks; `toolCalls` covers the main agent only.

## Approach
1. Add `requestsPerTask` to `FitnessReport` and compare it in `compareEfficiency` next to cost.

## Verification
- Extend `packages/metaharness/test/evo-fitness.test.ts` and `packages/metaharness/test/evo-efficiency.test.ts`.
- `bun test packages/metaharness/test/evo-fitness.test.ts packages/metaharness/test/evo-efficiency.test.ts`

- Merge gate: not applicable (fixture)
