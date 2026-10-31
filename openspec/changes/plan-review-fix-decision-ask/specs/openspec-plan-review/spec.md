## MODIFIED Requirements

### Requirement: Early ask at a complete round with eligible blockers

The `omp-gated` review instruction SHALL apply the `Blocker disposition` section of the `review-work` skill to every complete rejecting round, and SHALL ask the user at every complete rejecting round below the approach-question trigger that holds at least one Accept-eligible blocker, instead of fixing it first. The question SHALL decide per blocker: Accept recommended for an eligible one, Fix and Stop but not Accept for a non-eligible one, each with the consequence the reviewer stated.

#### Scenario: Round with only eligible blockers asks

- **WHEN** round 2 of a change returns REJECT, every dispatched lens returned a verdict, every open blocker is Accept-eligible, and the approach-question trigger is not met
- **THEN** the instruction directs the orchestrator to ask the user then, with Accept recommended and each blocker's stated consequence shown, rather than to fix them and dispatch round 3

#### Scenario: Mixed round asks per blocker

- **WHEN** a complete rejecting round below the approach-question trigger holds both eligible and non-eligible blockers
- **THEN** the orchestrator asks in that round, recommends Accept for each eligible blocker and offers only Fix or Stop for each non-eligible one, fixes the non-eligible ones and those the user chose to fix, and dispatches a fresh round; no blocker waits in session state for a later round

#### Scenario: Accept keeps its effect

- **WHEN** the user answers Accept for an eligible blocker
- **THEN** their own reason enters `gate.md` as an accepted residual risk or out-of-scope area, a fresh round follows, and that round's reviewers do not block on it

#### Scenario: Round with only blocking findings keeps the existing path

- **WHEN** a complete rejecting round below the approach-question trigger holds only non-eligible blockers, including the ambiguous and no-stated-consequence cases
- **THEN** the instruction directs a fix and a new round without a per-blocker ask, except for a blocker whose fix needs a user decision, which is asked as a per-blocker ask offering Fix and Stop, never Accept; from round 3 on, the approach question takes the place of the former per-blocker ask after the third REJECT

#### Scenario: Incomplete round keeps its stop

- **WHEN** a lens still returns no structured verdict after its retry
- **THEN** the round is incomplete: as today, no `review.md` is written, the user is told which lens failed, and the review stops; no fix and no ask follow from it

#### Scenario: Eligible blockers at the approach question

- **WHEN** the third REJECT holds both eligible and non-eligible blockers and the user answers Continue at the approach question
- **THEN** the non-eligible blockers are fixed without a per-blocker ask unless a fix needs a user decision, and the per-blocker ask covers the eligible ones, recommends Accept for each and shows each blocker's stated consequence

#### Scenario: Negative control

- **WHEN** an instruction defers an eligible blocker of a complete round below the approach-question trigger to a later round without asking, asks while a non-eligible blocker is open without naming it, or recommends or offers Accept for a non-eligible blocker
- **THEN** review of that instruction MUST fail
