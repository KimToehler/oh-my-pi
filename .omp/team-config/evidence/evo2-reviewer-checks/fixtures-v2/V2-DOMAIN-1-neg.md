# Install task dependencies for generated verifier checks

## Context
Generated evo tasks build an image, then run the verifier with `--network no-network` (`packages/metaharness/scripts/evo-task-container.ts:30-103`, `VERIFIER_NETWORK_MODE`). Calibration records `mode`, `runtime`, `backend`, `platform`, `image`, `verifierNetwork` (`src/evo/calibration.ts:8-26`) and `requireCalibratedTasks` (`calibration-gate.ts:12-50`) accepts only `container` + `no-network`.

## Approach
1. Generated tasks whose checks need npm packages install them with `bun install --frozen-lockfile`.

### Environment contract (DOMAIN 1)

| Phase | Network | Runtime/Platform | Commands | Need met? |
|---|---|---|---|---|
| build | yes | `docker build` of the task image, suite platform | `bun install --frozen-lockfile` in the Dockerfile setup step (`evo-task-templates.ts` setup command) | yes |
| agent | as configured by Harbor | task image | agent commands | no dependency install here |
| verifier | no-network | same task image | `/tests/test.sh` only | yes, deps present from build |
| calibration | no-network, `mode: container` | same image, recorded `platform` | RED `/tests/test.sh`, GREEN `/solution/solve.sh` + tests | yes |

Calibration runs in the verifier's environment (container, no network), so it guards the same phase.

Control: calibrate the task in the container with no network; a variant that installs in the verifier instead of the build fails calibration with a DNS error, and a host-only run is rejected by `requireCalibratedTasks`.

## Verification
- Extend `packages/metaharness/test/evo-calibration-environment.test.ts` and `packages/metaharness/test/evo-task.test.ts`.
- `bun test packages/metaharness/test/evo-calibration-environment.test.ts packages/metaharness/test/evo-task.test.ts`

- Merge gate: not applicable (fixture)
