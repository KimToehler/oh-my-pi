# Mount a prebuilt dependency cache into source trials

## Context
Source trials stage the execution manifest (`packages/metaharness/src/evo/execution-manifest.ts`, `source-stage.ts:89-176`); `sourceIdentity` hashes the same manifest (`source-identity.ts:56-80`). `compose-overlay.ts:41-59` bind-mounts the staged source read-only; dependency mounts can shadow source paths.

## Approach
1. Bind-mount the host's `node_modules` into the agent container at `/src/node_modules` to skip installs.

## Verification
- Extend `packages/metaharness/test/evo-source-stage.test.ts` and `packages/metaharness/test/evo-compose.test.ts`; live run per the control.
- `bun test packages/metaharness/test/evo-source-stage.test.ts packages/metaharness/test/evo-compose.test.ts`

- Merge gate: not applicable (fixture)
