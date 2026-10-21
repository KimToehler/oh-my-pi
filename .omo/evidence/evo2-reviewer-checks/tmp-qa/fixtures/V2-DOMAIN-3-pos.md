# Retry model requests through the provider proxy

## Context
Source trials reach the model through `ProviderProxy` (`packages/metaharness/src/evo/provider-proxy.ts`): tokens are registered in manager memory, `/_omp/liveness` answers 204 for a registered token (75-91, 179-186). The runner probes it (`runner.ts:1875-1885`); `classifyHarborPhase` (`failure-phase.ts:26-46`) gives `executor_infra_failure` precedence when `providerRouteLost` is true.

## Approach
1. When an upstream request fails with 502/503, the proxy retries it twice with backoff before answering the agent.

## Verification
- Extend `packages/metaharness/test/evo-provider-proxy.test.ts` and `packages/metaharness/test/evo-failure-phase.test.ts`.
- `bun test packages/metaharness/test/evo-provider-proxy.test.ts packages/metaharness/test/evo-failure-phase.test.ts`

- Merge gate: not applicable (fixture)
