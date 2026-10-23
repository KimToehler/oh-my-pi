# Let the manager listen on a LAN address

## Context
`packages/metaharness/src/server.ts` parses `--host` in `parseServerArgs` (112-138); `ManagerServer.start` binds `127.0.0.1` when no host is given (line 360). Report endpoints pick a run in `service-reports.ts#selectRun` (110-128): without `job` they use the newest run.

## Approach
1. Add the config key `manager.host` in `models.yml` as a second source for the bind address.

## Verification
- Extend `packages/metaharness/test/manager.test.ts` and `packages/metaharness/test/evo-api.test.ts` with the controls.
- `bun test packages/metaharness/test/manager.test.ts packages/metaharness/test/evo-api.test.ts`

- Merge gate: not applicable (fixture)
