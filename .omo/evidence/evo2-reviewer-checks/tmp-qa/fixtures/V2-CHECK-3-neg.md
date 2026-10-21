# Reject unsafe managed skill names

## Context
`packages/coding-agent/src/autolearn/managed-skills.ts` writes autolearned skills to `path.join(getManagedSkillsDir(), name)`. `sanitizeSkillName` (34-42) and `isValidManagedSkillName` (50-51) guard the name.

## Approach
1. Before writing, reject names containing `/`, `\\`, `..`, a leading `.`, or whitespace.

### Allow-set (CHECK 3)

The enumeration above is replaced by the existing allow-set `SKILL_NAME_PATTERN = ^[a-z0-9][a-z0-9-]{0,63}$` (`managed-skills.ts:22`): `sanitizeSkillName` trims and lowercases, then accepts only that pattern; everything else throws. No denylist remains.

Control over the whole input space: a test iterates every code point U+0000..U+007F and a set of non-ASCII classes (Latin-1 letters, combining marks, full-width solidus U+FF0F, RTL override U+202E, NUL) as single characters and as a middle character of `ab?cd`; only `[a-z0-9-]` (and uppercase ASCII letters, which lowercase into the set) are accepted, every other character is rejected.

## Verification
- Extend `packages/coding-agent/test/autolearn-managed-skills.test.ts` with the exhaustive loop.
- `bun test packages/coding-agent/test/autolearn-managed-skills.test.ts`

- Merge gate: not applicable (fixture)
