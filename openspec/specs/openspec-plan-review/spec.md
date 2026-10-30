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

### Requirement: Early ask at a complete round with eligible blockers

The `omp-gated` review instruction SHALL apply the `Blocker disposition` section of the `review-work` skill to every complete rejecting round, and SHALL ask the user at every complete rejecting round that holds at least one Accept-eligible blocker, instead of only after a third REJECT. The question SHALL decide per blocker: Accept recommended for an eligible one, Fix and Stop but not Accept for a non-eligible one, each with the consequence the reviewer stated.

#### Scenario: Round with only eligible blockers asks

- **WHEN** round 2 of a change returns REJECT, every dispatched lens returned a verdict, and every open blocker is Accept-eligible
- **THEN** the instruction directs the orchestrator to ask the user then, with Accept recommended and each blocker's stated consequence shown, rather than to fix them and dispatch round 3

#### Scenario: Mixed round asks per blocker

- **WHEN** a complete rejecting round before the third REJECT holds both eligible and non-eligible blockers
- **THEN** the orchestrator asks in that round, recommends Accept for each eligible blocker and offers only Fix or Stop for each non-eligible one, fixes the non-eligible ones and those the user chose to fix, and dispatches a fresh round; no blocker waits in session state for a later round

#### Scenario: Accept keeps its effect

- **WHEN** the user answers Accept for an eligible blocker
- **THEN** their own reason enters `gate.md` as an accepted residual risk or out-of-scope area, a fresh round follows, and that round's reviewers do not block on it

#### Scenario: Round with only blocking findings keeps the existing path

- **WHEN** a complete rejecting round holds only non-eligible blockers, including the ambiguous and no-stated-consequence cases
- **THEN** the instruction directs a fix and a new round without an ask, and the user is asked after the third REJECT as before

#### Scenario: Incomplete round keeps its stop

- **WHEN** a lens still returns no structured verdict after its retry
- **THEN** the round is incomplete: as today, no `review.md` is written, the user is told which lens failed, and the review stops; no fix and no ask follow from it

#### Scenario: Third REJECT with mixed blockers

- **WHEN** the third REJECT holds both eligible and non-eligible blockers
- **THEN** the question recommends Accept for each eligible blocker, offers Fix and Stop but not Accept for each non-eligible one, and shows every blocker's stated consequence

#### Scenario: Negative control

- **WHEN** an instruction defers an eligible blocker of a complete round to a later round without asking, asks while a non-eligible blocker is open without naming it, or recommends or offers Accept for a non-eligible blocker
- **THEN** review of that instruction MUST fail

### Requirement: The early ask is recorded first and quotes blockers verbatim

Before an early ask, the instruction SHALL write `review.md` for that round with its digest, REJECT and the blockers verbatim, so a Stop or an interrupted session leaves no earlier OKAY current. The ask SHALL quote each blocker's area, defect and stated consequence verbatim from the lens output and name the exclusions checked for it.

#### Scenario: Earlier OKAY stays superseded

- **WHEN** a plan with a current OKAY `review.md` is reviewed again unchanged, the round rejects with an eligible blocker, and the user answers Stop
- **THEN** `review.md` already records that round's REJECT, so `--reviewed` fails and apply is not authorized

#### Scenario: Verbatim ask

- **WHEN** a lens reports an eligible blocker whose consequence names a stale cross-reference
- **THEN** the ask shows its area, defect and consequence as the lens wrote them, with the exclusions that were checked and did not apply

#### Scenario: Negative control

- **WHEN** an instruction paraphrases a blocker in the ask, or asks before recording the round's REJECT
- **THEN** review of that instruction MUST fail

### Requirement: Early ask stays inside plan review

The early-ask rule SHALL apply to plan-review rounds only. The post-implementation lanes SHALL keep their existing convergence decisions and record vocabulary unchanged, and SHALL apply only the eligibility definition, the ambiguity default, the accept-path and coverage rules and the no-unrequested-mechanism rule of `review-blocker-disposition`.

#### Scenario: F2 wave with only eligible blockers

- **WHEN** an F2 fix wave returns FAIL and every blocker is Accept-eligible
- **THEN** the instruction keeps the existing CONTINUE, STOP and freeze decisions, records the user's acceptance through `override` plus a `downgrades` entry whose `rule` is `below-threshold`, `accepted-residual` or `frozen`, and introduces no early-ask path of its own

#### Scenario: F3 and delta keep their records

- **WHEN** a blocker stays unfixed at an F3 freeze or after a second delta REJECT
- **THEN** it is recorded as today: an F3 freeze in the F3 report's follow-up list with `GC decide --lane F3`, a delta acceptance with `GC accept`

#### Scenario: Negative control

- **WHEN** the F2, F3 or delta instruction carries an early-ask step, or records an unfixed blocker outside its lane's existing record
- **THEN** review of that instruction MUST fail
