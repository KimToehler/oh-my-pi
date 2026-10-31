# Proposal

## Why

The `release-notes` skill (`skills/release-notes/SKILL.md`) produces one flat bullet list per release. In a release whose pull requests touch several packages, readers have to scan the whole list to find what changed in the package they use. The team wants the skill to group the notes by package before it lists the changes.

## What Changes

- Add the sentence `Group release notes by package before listing changes.` verbatim, exactly once, to `skills/release-notes/SKILL.md`, as its own paragraph between the `# Release notes` heading and the numbered steps (placement decided in `design.md`, Decision 1).
- No other line of the skill changes: frontmatter, heading and steps 1-4 (including the `### Breaking` step) stay byte-identical.
- Not breaking: the skill's name, description and invocation are unchanged; only the drafted notes' structure changes.

## Capabilities

### New Capabilities
- `release-notes`: what the team's release-notes skill instructs an agent to do and what shape the drafted release notes take. No spec exists yet (`openspec list --specs` reports none); this change starts the capability with the package-grouping behaviour only and does not back-fill the existing steps 1-4.

### Modified Capabilities

None. The project has no specs yet.

## Impact

- File: `skills/release-notes/SKILL.md` (one inserted paragraph).
- Consumers: every developer's omp installation that receives the team skills (`README.md`); agents following the skill draft grouped notes after the next skill sync.
- No code, API, dependency, CI or data change. Release notes are drafts a human reviews before publishing.
