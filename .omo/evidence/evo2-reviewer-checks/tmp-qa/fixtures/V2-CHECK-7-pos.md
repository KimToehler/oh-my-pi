# Audit the staged source tree before launch

## Context
`packages/metaharness/src/evo/execution-manifest.ts` builds the canonical inventory (`listInventory` 143-180, `readExecutionManifest`); `source-identity.ts:65-76` hashes it and `source-stage.ts` (`assertSourceClean` 56-88, `stageSource` 128-169) stages exactly those bytes.

## Approach
1. Add `auditStagedTree(root)` in `packages/metaharness/src/evo/source-audit.ts`: before launch it lists every file that will run and logs any file larger than 50 MB.

## Verification
- Extend `packages/metaharness/test/evo-source-stage.test.ts` with the control.
- `bun test packages/metaharness/test/evo-source-stage.test.ts`

- Merge gate: not applicable (fixture)
