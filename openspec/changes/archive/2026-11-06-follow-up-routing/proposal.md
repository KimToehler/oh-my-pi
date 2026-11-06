# Proposal

## Why

A merged change leaves findings that nobody owes a fix but a later change should pick up. Today they have no destination, so they are lost. Three sources produce them: a `downgrades` entry with `disposition: follow-up` (its `reason` only has to name *where it is tracked*), a finding in an area the plan's `Out of scope for blocking` field names (`plan-merge-gate` says these "become follow-ups"), and the non-blocking notes in the final reviewer replies the gate record binds. On onara's `kmp-navigation-shell` (2026-11-06), four such notes were tracked only because the user asked; the archive step said nothing about them. Nothing reads such a list when the next change is proposed either.

## What Changes

- `/opsx-archive` gains a team step before the move. It collects the follow-ups of the change from the gate record and the replies the record binds, and appends each as one bullet, identified by the artifact it came from and its finding id, to the `## Follow-ups` section of the plan or roadmap the proposal names. If no such document is named, or several are, it asks the user for the destination (a named document, a path the user enters, or skip). Skipped items appear in the archive summary. Bullets the change took are deleted from the documents its proposal records for them.
- `/opsx-propose` gains a team step. Before the proposal is drafted, it reads the `## Follow-ups` sections of the plans or roadmaps the request or project names. Items whose named code or area the change touches go into the proposal, which lists each with its document's path and its bullet text.
- The README's OpenSpec bump procedure names all three team additions to the generated commands (the existing `opsx-apply.md` step 4 and the two new steps) and how to re-apply them after a regeneration.
- No change to the gate record schema, the validator, `review-work`'s blocker disposition or any review verdict.

## Capabilities

### New Capabilities
- `review-follow-ups`: where an archived change's non-blocking findings are recorded, the shape of a recorded item, how `/opsx-propose` takes items into a new change, and how an item leaves the list when a change resolves it.

### Modified Capabilities

None.

## Impact

- `team-config/agent/commands/opsx-archive.md`: new step 5 (later steps renumbered), summary and output templates gain a follow-ups line.
- `team-config/agent/commands/opsx-propose.md`: new step in the inspection phase, plus a guardrail.
- `team-config/README.md`: `Bumping OpenSpec` names the team additions.
- Deployed by `scripts/deploy-local.sh` to every omp profile that carries the team config; affects every project that archives or proposes OpenSpec changes with these commands. Projects without a roadmap see one extra question per archive that has follow-ups.
- Plan-mode plans (no OpenSpec change folder) are out of scope: they have no archive step.
