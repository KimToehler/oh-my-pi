# openspec-plan-review Specification

## Purpose
Defines how the `review` artifact of an `omp-gated` OpenSpec change runs its independent plan-review rounds and what `review.md` must record before `validate-openspec-change.mjs --reviewed` lets apply start.

## Requirements

### Requirement: Three-lens review round
Each review round SHALL dispatch three fresh `plan-reviewer` tasks in one `task` batch, one per lens: correctness, verification, checks. Each task's brief SHALL be the schema's fixed brief verbatim with only the two paths filled in, followed by that lens's fixed paragraph from the schema, and nothing else. The checks lens SHALL cover CHECK 1 to 8, every check defined by rules loaded for the reviewer, and the merge-gate `Boundary:` rule.

#### Scenario: Instruction names three lens dispatches
- **WHEN** an agent reads the `review` instruction of a change whose project uses the deployed `omp-gated` schema
- **THEN** the instruction prescribes one batch of three `plan-reviewer` tasks, the fixed brief once, and exactly three lens paragraphs: correctness (review scope items 1 and 2), verification (items 3 and 5) and checks (item 4, CHECK 1 to 8, rule-defined checks, `Boundary:`)

#### Scenario: Rule-defined checks belong to the checks lens
- **WHEN** a rule loaded for `plan-reviewer` defines a check under its own label (for example `DOMAIN 2`)
- **THEN** the checks lens paragraph directs that reviewer to decide that check, and neither of the other two lens paragraphs excludes it from the checks lens

#### Scenario: Negative control
- **WHEN** a planner adds its own focus, a file list or a summary of the change to a lens brief, or dispatches only one or two lenses
- **THEN** recording that dispatch as a review round MUST fail: no review record is written from it

### Requirement: Round verdict
A round SHALL be OKAY only when all three lenses return OKAY. Otherwise it SHALL be REJECT, and its record SHALL carry the blockers of every rejecting lens verbatim, grouped by lens. `--reviewed` SHALL refuse a record whose verdict is OKAY while its `## Blockers` section is neither `none` nor empty.

#### Scenario: One rejecting lens rejects the round
- **WHEN** the correctness and checks lenses return OKAY and the verification lens returns REJECT with two blockers
- **THEN** the round's verdict is REJECT and `review.md` lists those two blockers verbatim under the verification lens

#### Scenario: All lenses agree
- **WHEN** all three lenses return OKAY
- **THEN** the round's verdict is OKAY and the `## Blockers` section is `none`

#### Scenario: Negative control
- **WHEN** `review.md` records `Verdict: OKAY` but its `## Blockers` section lists a lens's blockers
- **THEN** `validate-openspec-change.mjs --reviewed` MUST fail and name the Blockers section

### Requirement: Incomplete round
A lens that returns no structured verdict (failure, timeout, unparsable output) SHALL get one fresh retry with the same brief. When the retry also returns none, the round SHALL be incomplete: the agent writes and edits no `review.md` for it and SHALL tell the user which lens failed. A record of an earlier complete round stays as it was.

#### Scenario: Retry recovers the lens
- **WHEN** the checks lens fails and its fresh retry returns REJECT
- **THEN** the round's verdict is computed from the two first results and the retry, and the record lists the retry's subagent id for the checks lens

#### Scenario: Negative control
- **WHEN** a lens of the first round of a change has no structured verdict after its retry
- **THEN** producing a review record for that round MUST fail: no `review.md` exists afterwards, so `--reviewed` keeps failing as missing

### Requirement: Reviewer record
`review.md` SHALL name the reviewers of the recorded round as `plan-reviewer` followed by the subagent ids the `task` tool returned, comma-separated; a three-lens round lists its correctness, verification and checks ids in that order. `--reviewed` SHALL accept one or more ids and SHALL refuse an empty id, a template placeholder or a duplicate id.

#### Scenario: Three-lens record
- **WHEN** `review.md` has `- **Reviewer**: plan-reviewer, LensCor1, LensVer1, LensChk1` and is otherwise valid and current
- **THEN** `--reviewed` passes

#### Scenario: Record from before this change
- **WHEN** an open change's current `review.md` has `- **Reviewer**: plan-reviewer, PlanReviewR27`
- **THEN** `--reviewed` passes as before

#### Scenario: Negative control
- **WHEN** `review.md` has `- **Reviewer**: plan-reviewer, LensCor1, LensCor1, LensChk1`, or the template's correctness-id placeholder in place of the first id
- **THEN** `--reviewed` MUST fail and name the Reviewer field
