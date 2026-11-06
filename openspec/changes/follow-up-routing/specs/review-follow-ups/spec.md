# Spec Delta

## Purpose

Gives the non-blocking findings of a merged OpenSpec change a tracked destination: `/opsx-archive` records them in the `## Follow-ups` section of the change's plan or roadmap, `/opsx-propose` takes the matching items into the next change, and archiving that change removes them.

## ADDED Requirements

### Requirement: Archive collects the change's follow-ups from its gate record
Before moving the change, `/opsx-archive` SHALL collect its follow-ups from the change's gate record: every `downgrades` entry with `disposition: follow-up`, and every non-blocking finding (a note, or a finding in an area the gate's `Out of scope for blocking` names) in the reviewer replies the record binds through `verdicts[].trailer_artifact` and its whole-diff report. Replies the record does not bind are not read.

#### Scenario: Notes and follow-up downgrades from the bound replies
- **WHEN** the record binds a PASS `implementation-audit` trailer with one non-blocking note and holds one `downgrades` entry with `disposition: follow-up`
- **THEN** the archive collects exactly those two items

#### Scenario: No gate record
- **WHEN** no gate record exists for the change at the record path `review-work` prescribes (the change's gate opted out, or the record was never written)
- **THEN** the archive collects nothing and its summary says that no gate record was found

#### Scenario: Negative control
- **WHEN** the record holds a `downgrades` entry with `disposition: residual`, and an earlier wave's trailer that the record does not bind carries a note
- **THEN** routing either of them MUST fail the requirement; neither appears among the collected items

### Requirement: Routing leaves the gate record and its evidence unchanged
Collecting, recording and removing follow-ups SHALL only read the gate record, its trailers, QA artifacts and reports; it SHALL write only to the chosen destination documents. A finding in a trailer is copied, never moved or edited, so every digest the record pins stays valid.

#### Scenario: Pinned digests unchanged after routing
- **WHEN** the archive has routed two items from a gate record
- **THEN** the SHA-256 of the record and of every artifact it pins equal their values before the archive, and `git status` shows changes only in the destination document, the main specs the sync wrote and the moved change folder

#### Scenario: Negative control
- **WHEN** the archive marks a routed note inside its trailer file (for example appending "routed")
- **THEN** that edit MUST fail the requirement, because the trailer digest in the record no longer matches

### Requirement: Follow-ups go to the plan or roadmap the proposal names
The destination SHALL be the one Markdown document outside `openspec/` that the change's `proposal.md` names by repository path and that has a `## Follow-ups` section. With none or several, the archive SHALL ask the user, offering the named documents and skip; a chosen document without the section gains it. The archive SHALL never write to a document the user did not choose and the proposal does not name.

#### Scenario: One named roadmap with the section
- **WHEN** `proposal.md` names `docs/roadmap/x.md`, which has `## Follow-ups`, and no other named document has the section
- **THEN** the items are appended to that section without a question

#### Scenario: No named document has the section
- **WHEN** the proposal names `docs/roadmap/x.md` without a `## Follow-ups` section and there are collected items
- **THEN** the archive asks for the destination, offering `docs/roadmap/x.md` and skip, before the change is moved

#### Scenario: Negative control
- **WHEN** the proposal names no document with the section and a `docs/roadmap/other.md` with `## Follow-ups` exists in the repository
- **THEN** writing to `docs/roadmap/other.md` without the user choosing it MUST fail the requirement

### Requirement: A follow-up item names its location and source
Each recorded item SHALL be one bullet stating the finding and its consequence, its location as `PATH:LINE` (or the area when no line applies), and `Source:` with the change name and its origin (wave and reviewer or blocker id). An item whose location and source already appear in the destination SHALL not be added again.

#### Scenario: Recorded bullet
- **WHEN** an `implementation-audit` note in F2 wave 2 of change `c` names `src/a.ts:12`
- **THEN** the bullet names `src/a.ts:12` and ends with `Source: \`c\` F2 wave 2, implementation-audit`

#### Scenario: Negative control
- **WHEN** the archive runs a second time over the same record after an interrupted move
- **THEN** a second bullet with the same location and source MUST fail the requirement

### Requirement: Skipped follow-ups stay visible and never block the archive
Routing SHALL never block or fail the archive. When the user skips, or routing writes nothing, the archive summary SHALL list every collected item in full; otherwise it SHALL name the destination and the number of items added.

#### Scenario: User skips
- **WHEN** the user chooses skip for three collected items
- **THEN** the archive completes and its summary lists the three items in full

#### Scenario: Negative control
- **WHEN** the user chooses skip
- **THEN** a summary that omits the items or only counts them MUST fail the requirement

### Requirement: Propose takes matching follow-ups into the new change
Before drafting the proposal, `/opsx-propose` SHALL read the `## Follow-ups` sections of the plans or roadmaps the request or project context names. Each item whose location or area the change will touch SHALL be listed verbatim under the proposal's `## Follow-ups taken` and covered by the change's scope, unless the user declines it; a declined or untouched item stays where it is.

#### Scenario: Touched location
- **WHEN** the roadmap the request names lists an item at `src/a.ts:12` and the change modifies `src/a.ts`
- **THEN** the proposal lists that bullet under `## Follow-ups taken` and its What Changes covers it

#### Scenario: Negative control
- **WHEN** the change modifies `src/a.ts` and the item at `src/a.ts:12` is neither listed nor declined by the user
- **THEN** the proposal MUST fail the requirement

### Requirement: Archiving a change removes the follow-ups it took
When the archived change's proposal lists items under `## Follow-ups taken`, `/opsx-archive` SHALL delete each listed bullet from its document before the move, and SHALL name in its summary any listed bullet it could not find.

#### Scenario: Resolved item removed
- **WHEN** the proposal lists one bullet under `## Follow-ups taken` and the roadmap still holds it
- **THEN** after the archive the roadmap no longer holds it

#### Scenario: Negative control
- **WHEN** the archive completes and the taken bullet is still in the roadmap
- **THEN** that outcome MUST fail the requirement

### Requirement: The bump procedure names every team addition to the generated commands
The README's OpenSpec bump procedure SHALL name each team addition to the generated `opsx-*.md` commands (command, step, title) and SHALL tell the maintainer to re-apply all of them after regenerating, so a bump cannot silently drop the follow-up steps.

#### Scenario: Bump after this change
- **WHEN** a maintainer follows the procedure for a new OpenSpec version
- **THEN** it names the `opsx-apply.md` worktree step, the `opsx-archive.md` follow-up step and the `opsx-propose.md` follow-up step as the expected diff and the steps to re-apply

#### Scenario: Negative control
- **WHEN** the procedure still names only the `opsx-apply.md` step
- **THEN** that procedure MUST fail the requirement
