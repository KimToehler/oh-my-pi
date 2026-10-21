# Reject unsafe managed skill names

## Context
`packages/coding-agent/src/autolearn/managed-skills.ts` writes autolearned skills to `path.join(getManagedSkillsDir(), name)`. `sanitizeSkillName` (34-42) and `isValidManagedSkillName` (50-51) guard the name.

## Approach
1. Before writing, reject names containing `/`, `\\`, `..`, a leading `.`, or whitespace.

## Verification
- Extend `packages/coding-agent/test/autolearn-managed-skills.test.ts` with the exhaustive loop.
- `bun test packages/coding-agent/test/autolearn-managed-skills.test.ts`

- Merge gate: not applicable (fixture)
