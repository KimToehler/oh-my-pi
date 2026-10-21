# DOMAIN 1 fixture

## Approach
1. In `packages/metaharness/src/evo/verifier.ts`, move `bun install` into the build phase; the verifier phase runs only the tests against the installed tree.

| Phase | Network | Runtime/Platform | Commands | Need met? |
|---|---|---|---|---|
| build | yes | linux/amd64 container | bun install --frozen-lockfile | yes |
| verifier | no-network | same image | bun test | yes, deps from build |

## Verification
- Control: run the verifier in the no-network container; a host-only success does not count.
- `bun test packages/metaharness/test/evo-verifier.test.ts`

- Merge gate: not applicable (fixture)
