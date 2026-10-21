# Resume interrupted autoresearch runs

## Context
`packages/coding-agent/src/autoresearch/index.ts` decides whether an interrupted run is offered as pending: `pendingRunSummaryFromRow` (489-507). Callers: session start (76-78), resume handling (267-285), system-prompt refresh (316-320).

## Approach
1. Treat a run as "complete" and offer it as pending when its row has `completedAt` set, even when `parsedMetrics` is missing.

### Decision predicate (CHECK 4)

Definition: a run is offered as pending exactly when its row exists, `status` is null (not yet logged), `completedAt` is set, and the run log at `row.logPath` is readable; the summary always carries `passed = exitCode === 0 && !timedOut`.

| Input state | result |
|---|---|
| missing (no row) | not offered (`null`) |
| corrupt or unreadable (storage open fails, or `logPath` unreadable) | not offered; a warning names the run number |
| still running or partial (`completedAt` null) | not offered |
| lossy (`parsedMetrics` or `parsedPrimary` null) | offered, with `parsedMetrics: null` visible and `passed` unchanged; the prompt text says metrics are missing, never 0 |

Default for any other state: not offered.

Negative controls: no row; row with `completedAt` null; row with unreadable `logPath`; row with null metrics must show `parsedMetrics: null`, not a number.

## Verification
- Extend `packages/coding-agent/test/autoresearch-state.test.ts` with the four controls.
- `bun test packages/coding-agent/test/autoresearch-state.test.ts`

- Merge gate: not applicable (fixture)
