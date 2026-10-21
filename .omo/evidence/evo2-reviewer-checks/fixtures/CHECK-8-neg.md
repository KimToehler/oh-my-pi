# CHECK 8 fixture

## Approach
1. Add a server option `bind` in `packages/coding-agent/src/demo/server.ts`, default `127.0.0.1`.
2. Every request names its run id; a missing run id returns 400. The response echoes the run id used. Listing orders runs by (created_at, id).

## Verification
- Controls: default bind is loopback; request without run id gets 400.
- `bun test packages/coding-agent/test/demo-server.test.ts`

- Merge gate: not applicable (fixture)
