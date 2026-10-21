# Resume interrupted autoresearch runs

## Context
`packages/coding-agent/src/autoresearch/index.ts` decides whether an interrupted run is offered as pending: `pendingRunSummaryFromRow` (489-507). Callers: session start (76-78), resume handling (267-285), system-prompt refresh (316-320).

## Approach
1. Treat a run as "complete" and offer it as pending when its row has `completedAt` set, even when `parsedMetrics` is missing.

## Verification
- Extend `packages/coding-agent/test/autoresearch-state.test.ts` with the four controls.
- `bun test packages/coding-agent/test/autoresearch-state.test.ts`

- Merge gate: not applicable (fixture)
