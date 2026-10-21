# Mount a prebuilt dependency cache into source trials

## Context
Source trials stage the execution manifest (`packages/metaharness/src/evo/execution-manifest.ts`, `source-stage.ts:89-176`); `sourceIdentity` hashes the same manifest (`source-identity.ts:56-80`). `compose-overlay.ts:41-59` bind-mounts the staged source read-only; dependency mounts can shadow source paths.

## Approach
1. Bind-mount the host's `node_modules` into the agent container at `/src/node_modules` to skip installs.

### Executing is a sink (DOMAIN 2)

| Runtime file | origin | tracked/untracked/ignored/generated | in identity? | mounted? |
|---|---|---|---|---|
| source files | worktree | tracked + untracked | yes (manifest) | staged tree, read-only |
| `packages/natives/native/pi_natives.linux-<arch>*.node` | native build | ignored | yes (manifest; `stageSource` requires it) | staged tree |
| `tool-views.generated.js` and other generated files | build step | ignored/generated | yes (ignored files are in the manifest) | staged tree |
| `node_modules` | host install | ignored, excluded from manifest | yes, new: `lockfileHash` + `nodeModulesTreeHash` recorded in the run identity | read-only mount at `/src/node_modules` |

Control: start the real agent in the target container with the mounted `node_modules`; a run whose `nodeModulesTreeHash` differs from the recorded one refuses to launch.

## Verification
- Extend `packages/metaharness/test/evo-source-stage.test.ts` and `packages/metaharness/test/evo-compose.test.ts`; live run per the control.
- `bun test packages/metaharness/test/evo-source-stage.test.ts packages/metaharness/test/evo-compose.test.ts`

- Merge gate: not applicable (fixture)
