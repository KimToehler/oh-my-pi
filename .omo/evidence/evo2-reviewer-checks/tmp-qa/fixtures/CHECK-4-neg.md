# CHECK 4 fixture

## Approach
1. In `packages/coding-agent/src/demo/runs.ts`, admit a run as "complete" when `result.json` exists; only complete runs enter the report.

complete := result.json parses and status = "done"; missing -> reject, corrupt -> reject, running/partial -> reject, lossy (dropped lines > 0) -> reject; controls: missing file, status "running"

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
