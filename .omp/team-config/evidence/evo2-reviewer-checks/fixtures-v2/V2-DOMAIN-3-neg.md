# Retry model requests through the provider proxy

## Context
Source trials reach the model through `ProviderProxy` (`packages/metaharness/src/evo/provider-proxy.ts`): tokens are registered in manager memory, `/_omp/liveness` answers 204 for a registered token (75-91, 179-186). The runner probes it (`runner.ts:1875-1885`); `classifyHarborPhase` (`failure-phase.ts:26-46`) gives `executor_infra_failure` precedence when `providerRouteLost` is true.

## Approach
1. When an upstream request fails with 502/503, the proxy retries it twice with backoff before answering the agent.

### Liveness (DOMAIN 3)

| Dependency | lifetime | holder | check before | check after | phase on loss |
|---|---|---|---|---|---|
| proxy process + token | manager process lifetime; tokens in memory, never persisted | manager | runner liveness probe before the trial | liveness probe after the trial | `executor_infra_failure` via `providerRouteLost` |
| upstream provider | per request | proxy | none (retries are per request) | per request status | retries exhausted -> 5xx to the agent, counted as model outcome only when the proxy itself stayed live |

Manager restart: tokens are lost by design; the post-trial probe then fails and the trial is `executor_infra_failure`, never a model outcome. Retries do not change this: a retry cannot outlive the manager.

Control: stop the proxy mid-trial; the trial is classified `executor_infra_failure`. A second control returns 503 three times from a fake upstream with the proxy live; the trial is a model outcome with the failure visible.

## Verification
- Extend `packages/metaharness/test/evo-provider-proxy.test.ts` and `packages/metaharness/test/evo-failure-phase.test.ts`.
- `bun test packages/metaharness/test/evo-provider-proxy.test.ts packages/metaharness/test/evo-failure-phase.test.ts`

- Merge gate: not applicable (fixture)
