# Spec Delta

## Purpose

Gives the non-blocking findings of a merged OpenSpec change a tracked destination: `/opsx-archive` records them in the `## Follow-ups` section of the change's plan or roadmap, `/opsx-propose` takes the matching items into the next change, and archiving that change removes them.

## ADDED Requirements

### Requirement: Archive collects the change's follow-ups from its gate record
Before moving the change, `/opsx-archive` SHALL collect its follow-ups from the change's gate record: every `downgrades` entry with `disposition: follow-up`, and every non-blocking finding (a note, or a finding in an area the gate's `Out of scope for blocking` names) in the replies the record binds through `verdicts[].trailer_artifact` and, when `whole_diff.run` is true, its integration-review report. Nothing else is read.

#### Scenario: Notes and follow-up downgrades from the bound replies
- **WHEN** the record binds a PASS `implementation-audit` trailer with one non-blocking note and holds one `downgrades` entry with `disposition: follow-up`
- **THEN** the archive collects exactly those two items

#### Scenario: Finding only in the whole-diff report
- **WHEN** `whole_diff.run` is true and the bound integration-review report holds a follow-up that no trailer or downgrade carries
- **THEN** the archive collects it

#### Scenario: No gate record
- **WHEN** no gate record exists for the change at the record path `review-work` prescribes (the change's gate opted out, or the record was never written)
- **THEN** the archive collects nothing and its summary says that no gate record was found

#### Scenario: Negative control
- **WHEN** the record holds a `downgrades` entry with `disposition: residual`, and an earlier wave's trailer that the record does not bind carries a note
- **THEN** routing either of them MUST fail the requirement; neither appears among the collected items

### Requirement: Routing leaves the gate record and its evidence unchanged
Collecting, recording and removing follow-ups SHALL only read the gate record, its trailers, QA artifacts and reports; it SHALL write only to destination documents. A finding in a trailer is copied, never moved or edited, so every digest the record pins stays valid.

#### Scenario: Pinned digests unchanged after routing
- **WHEN** the archive has routed two items from a gate record
- **THEN** the SHA-256 of the record and of every artifact it pins equal their values before the archive, and `git status` shows changes only in the destination document, the main specs the sync wrote and the moved change folder

#### Scenario: Negative control
- **WHEN** the archive marks a routed note inside its trailer file (for example appending "routed")
- **THEN** that edit MUST fail the requirement, because the trailer digest in the record no longer matches

### Requirement: Follow-ups go to the plan or roadmap the proposal names
The destination SHALL be the one Markdown document outside `openspec/` that the change's `proposal.md` names by repository path and that has a `## Follow-ups` section. With none or several, the archive SHALL ask the user, offering the named documents, a path the user enters, and skip; a chosen document without the section gains it. The archive SHALL never write to a document the proposal does not name and the user did not choose.

#### Scenario: One named roadmap with the section
- **WHEN** `proposal.md` names `docs/roadmap/x.md`, which has `## Follow-ups`, and no other named document has the section
- **THEN** the items are appended to that section without a question

#### Scenario: Proposal names no document
- **WHEN** the proposal names no document and there are collected items
- **THEN** the archive asks, and a path the user enters receives the items under a new `## Follow-ups` section

#### Scenario: Negative control
- **WHEN** the proposal names no document with the section and a `docs/roadmap/other.md` with `## Follow-ups` exists in the repository
- **THEN** writing to `docs/roadmap/other.md` without the user choosing it MUST fail the requirement

### Requirement: A follow-up item names its location and source
Each item SHALL be one bullet: the finding and its consequence, its location as `PATH:LINE` (or the area), and `Source:` with the change name, the repository path of the bound artifact it came from, and its finding id: the downgrade's blocker id, else the reviewer's own label, else `note <n>` by order in that artifact. The source is the item's identity: an item whose source text is already in the destination SHALL not be added again.

#### Scenario: Trailer without a wave
- **WHEN** change `c` binds `.omp/team-config/evidence/gate/c/f2/trailer-implementation-audit.txt`, whose second unlabelled note names `src/a.ts:12`
- **THEN** the bullet names `src/a.ts:12` and ends with `Source: \`c\` .omp/team-config/evidence/gate/c/f2/trailer-implementation-audit.txt, note 2`

#### Scenario: Two findings at one location
- **WHEN** one trailer carries two different notes that both name `src/a.ts:12`
- **THEN** both are recorded, as `note 1` and `note 2`

#### Scenario: Same finding id in two artifacts
- **WHEN** two bound trailers each carry one unlabelled note, so both have the finding id `note 1`
- **THEN** both are recorded, each with its own artifact path in its source

#### Scenario: Source differs only in the change name
- **WHEN** the destination holds a bullet whose source equals a collected item's except for the change name
- **THEN** the collected item is added

#### Scenario: Negative control
- **WHEN** the destination already holds a bullet whose source text equals a collected item's
- **THEN** adding a second bullet with that source MUST fail the requirement

### Requirement: Skipped follow-ups stay visible and never block the archive
Routing SHALL never block or fail the archive. When the user skips, or routing writes nothing, the archive summary SHALL list every collected item in full; otherwise it SHALL name the destination and the number of items added.

#### Scenario: User skips
- **WHEN** the user chooses skip for three collected items
- **THEN** the archive completes and its summary lists the three items in full

#### Scenario: Negative control
- **WHEN** the user chooses skip
- **THEN** a summary that omits the items or only counts them MUST fail the requirement

### Requirement: Propose takes matching follow-ups into the new change
Before drafting the proposal, `/opsx-propose` SHALL read the `## Follow-ups` sections of the plans or roadmaps the request or project context names. Each item whose location or area the change will touch SHALL be listed under the proposal's `## Follow-ups taken` as the repository path of its document followed by the bullet verbatim, and covered by the change's scope, unless the user declines it; other items stay where they are.

#### Scenario: Touched location
- **WHEN** project context names `docs/roadmap/w.md`, which lists an item at `src/a.ts:12`, and the change modifies `src/a.ts`
- **THEN** the proposal's `## Follow-ups taken` holds `docs/roadmap/w.md` with that bullet verbatim, and its What Changes covers it

#### Scenario: Negative control
- **WHEN** the change modifies `src/a.ts` and the item at `src/a.ts:12` is neither listed nor declined by the user
- **THEN** the proposal MUST fail the requirement

### Requirement: Archiving a change removes the follow-ups it took
For each entry under the proposal's `## Follow-ups taken`, `/opsx-archive` SHALL delete the bullet from the document the entry names before the move; the entry names that document, so the deletion is within the proposal's named documents. It SHALL name in its summary every entry whose bullet it could not find.

#### Scenario: Round trip from a roadmap named only in project context
- **WHEN** a fresh `/opsx-propose` session took an item from `docs/roadmap/w.md`, which neither the request nor the rest of the proposal names, and a later fresh `/opsx-archive` session archives that change
- **THEN** after the archive `docs/roadmap/w.md` no longer holds the bullet

#### Scenario: Negative control
- **WHEN** the archive completes and the taken bullet is still in its document
- **THEN** that outcome MUST fail the requirement

### Requirement: The bump procedure names every team addition to the generated commands
The README's OpenSpec bump procedure SHALL name each team addition to the generated `opsx-*.md` commands (command, step, title) and SHALL tell the maintainer to re-apply all of them after regenerating, so a bump cannot silently drop the follow-up steps.

#### Scenario: Bump after this change
- **WHEN** a maintainer follows the procedure for a new OpenSpec version
- **THEN** it names the `opsx-apply.md` worktree step, the `opsx-archive.md` follow-up step and the `opsx-propose.md` follow-up step as the expected diff and the steps to re-apply

#### Scenario: Negative control
- **WHEN** the procedure still names only the `opsx-apply.md` step
- **THEN** that procedure MUST fail the requirement
