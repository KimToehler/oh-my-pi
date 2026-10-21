# Audit the staged source tree before launch

## Context
`packages/metaharness/src/evo/execution-manifest.ts` builds the canonical inventory (`listInventory` 143-180, `readExecutionManifest`); `source-identity.ts:65-76` hashes it and `source-stage.ts` (`assertSourceClean` 56-88, `stageSource` 128-169) stages exactly those bytes.

## Approach
1. Add `auditStagedTree(root)` in `packages/metaharness/src/evo/source-audit.ts`: before launch it lists every file that will run and logs any file larger than 50 MB.

### One truth (CHECK 7)

| Concept | derivation A | derivation B | shared function? |
|---|---|---|---|
| set of files that run | `readExecutionManifest` (identity, staging) | `auditStagedTree` | yes: `auditStagedTree` takes the `ManifestRead` that `stageSource` already received through its `visit` callback; it does not list files itself |

No second enumeration exists after the change: `rg -n 'lsFiles' packages/metaharness/src` returns only `execution-manifest.ts`.

Negative control: an ignored generated file and an exec-bit-only change are added; the audit, the identity hash and the staged tree all reflect both, and a test asserts the audit's path list equals `manifest.entries.map(e => e.path)`.

## Verification
- Extend `packages/metaharness/test/evo-source-stage.test.ts` with the control.
- `bun test packages/metaharness/test/evo-source-stage.test.ts`

- Merge gate: not applicable (fixture)
