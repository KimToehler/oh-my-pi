# CHECK 1 fixture

## Approach
1. Add `OMP_DEMO_TOKEN` to the env of a spawned helper process in `packages/coding-agent/src/demo/helper.ts`. The token must never appear in logs.
2. Holders: helper env, helper process memory. Sinks: helper stdout and stderr, `run.log`, error messages, argv (token is never passed in argv). Every write of helper stdout/stderr goes through `redactSecrets()` in `src/demo/redact.ts`, the single chokepoint; new sinks call it by construction because `writeRunLog()` is the only writer.

## Verification
- Sentinel test: plant `SENTINEL-123` as the token and in the request body, path, job name and file content; scan `run.log`, stderr capture and every artifact: 0 hits.
- `bun test packages/coding-agent/test/demo-redact.test.ts`

- Merge gate: not applicable (fixture)
