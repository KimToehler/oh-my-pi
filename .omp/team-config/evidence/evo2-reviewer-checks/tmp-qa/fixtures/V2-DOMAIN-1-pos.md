# Install task dependencies for generated verifier checks

## Context
Generated evo tasks build an image, then run the verifier with `--network no-network` (`packages/metaharness/scripts/evo-task-container.ts:30-103`, `VERIFIER_NETWORK_MODE`). Calibration records `mode`, `runtime`, `backend`, `platform`, `image`, `verifierNetwork` (`src/evo/calibration.ts:8-26`) and `requireCalibratedTasks` (`calibration-gate.ts:12-50`) accepts only `container` + `no-network`.

## Approach
1. Generated tasks whose checks need npm packages install them with `bun install --frozen-lockfile`.

## Verification
- Extend `packages/metaharness/test/evo-calibration-environment.test.ts` and `packages/metaharness/test/evo-task.test.ts`.
- `bun test packages/metaharness/test/evo-calibration-environment.test.ts packages/metaharness/test/evo-task.test.ts`

- Merge gate: not applicable (fixture)
