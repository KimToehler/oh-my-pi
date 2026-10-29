# Spec Delta

## ADDED Requirements

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
