# DOMAIN 3 fixture

## Approach
1. In `packages/metaharness/src/runner.ts`, agents use the token proxy started by the manager. Proxy tokens are persisted with the run, so a manager restart re-registers them.

| Dependency | lifetime | holder | check before | check after | phase on loss |
|---|---|---|---|---|---|
| token proxy | manager process, tokens persisted per run | manager | liveness probe at launch | liveness probe at trial end | infra_failure |

## Verification
- Control: stop the proxy mid-run; the trial is recorded as infra_failure, never as a model outcome.
- `bun test packages/metaharness/test/evo-runner.test.ts`

- Merge gate: not applicable (fixture)
