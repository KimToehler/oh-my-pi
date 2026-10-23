# Let the manager listen on a LAN address

## Context
`packages/metaharness/src/server.ts` parses `--host` in `parseServerArgs` (112-138); `ManagerServer.start` binds `127.0.0.1` when no host is given (line 360). Report endpoints pick a run in `service-reports.ts#selectRun` (110-128): without `job` they use the newest run.

## Approach
1. Add the config key `manager.host` in `models.yml` as a second source for the bind address.

### Defaults and choice (CHECK 8)

- Bind default stays `127.0.0.1`. `--host` wins over `manager.host`; both unset means loopback. An address that fails to bind aborts start with the address in the error; there is no fallback to another address.
- `start()` logs and `GET /api/health` returns the effective bind address and its source (`flag`, `config`, `default`).
- Run selection: report endpoints keep the explicit `job` parameter. When it is omitted, the response now carries `selectedJob` and `selection: "newest"`; newest is ordered by `created_at DESC, rowid DESC` (`store.ts:581-594`), so ties are deterministic.
- No silent substitution: an explicit `job` that does not exist returns 404, one for another variant or suite returns 422 (unchanged).

Controls: unset host binds loopback; config host is used and reported; unbindable host fails start; omitted `job` reports `selection: newest` and the chosen job.

## Verification
- Extend `packages/metaharness/test/manager.test.ts` and `packages/metaharness/test/evo-api.test.ts` with the controls.
- `bun test packages/metaharness/test/manager.test.ts packages/metaharness/test/evo-api.test.ts`

- Merge gate: not applicable (fixture)
