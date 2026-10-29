# Spec Delta

## ADDED Requirements

### Requirement: Early ask when a complete round holds only eligible blockers

The `omp-gated` review instruction SHALL apply the `Blocker disposition` section of `review-work/SKILL.md` to every rejecting round, and SHALL ask the user at the first complete round whose open blockers are all Accept-eligible, instead of only after a third REJECT. The question SHALL offer Fix, Accept and Stop per open blocker, SHALL recommend Accept for the eligible ones, and SHALL report for each the consequence the reviewer stated.

#### Scenario: First round without a blocking finding asks

- **WHEN** round 2 of a change returns REJECT, every dispatched lens returned a verdict, and every open blocker is Accept-eligible
- **THEN** the instruction directs the orchestrator to ask the user then, with Accept recommended and each blocker's stated consequence shown, rather than to fix them and dispatch round 3

#### Scenario: Accept keeps its effect

- **WHEN** the user answers Accept for an eligible blocker
- **THEN** their own reason enters `gate.md` as an accepted residual risk or out-of-scope area, a fresh round follows, and that round's reviewers do not block on it

#### Scenario: Round with a blocking finding keeps the existing path

- **WHEN** a rejecting round holds at least one blocker that is not Accept-eligible, including the ambiguous and incomplete-round cases
- **THEN** the instruction directs a fix of the non-eligible blockers and a new round, and the user is asked after the third REJECT as before

#### Scenario: Eligible blockers inside a mixed round

- **WHEN** a rejecting round before the third REJECT holds both eligible and non-eligible blockers
- **THEN** the non-eligible ones are fixed, the eligible ones stay open without a mechanism fix and are listed in `review.md` as carried, and the user is asked at the first complete round in which only eligible blockers remain

#### Scenario: Third REJECT with mixed blockers

- **WHEN** the third REJECT holds both eligible and non-eligible blockers
- **THEN** the question recommends Accept for each eligible blocker, offers Fix and Stop but not Accept for each non-eligible one, and shows every blocker's stated consequence

#### Scenario: Negative control

- **WHEN** an instruction asks the user while a non-eligible blocker is open without naming it as an open blocker, or recommends or offers Accept for it
- **THEN** review of that instruction MUST fail

### Requirement: Early ask stays inside plan review

The early-ask rule SHALL apply to plan-review rounds only. The post-implementation lanes SHALL keep their existing convergence decisions and record vocabulary unchanged, and SHALL state only the eligibility definition, the ambiguity default, the accept-path rule, the no-unrequested-mechanism rule and the exemption allow-set of `review-blocker-disposition`.

#### Scenario: F2 wave with only eligible blockers

- **WHEN** an F2 fix wave returns FAIL and every blocker is Accept-eligible
- **THEN** the instruction keeps the existing CONTINUE, STOP and freeze decisions, records the user's acceptance through `override` plus a `downgrades` entry whose `rule` is `below-threshold`, `accepted-residual` or `frozen`, and introduces no early-ask path of its own

#### Scenario: F3 and delta keep their records

- **WHEN** a blocker stays unfixed at an F3 freeze or after a second delta REJECT
- **THEN** it is recorded as today: an F3 freeze in the F3 report's follow-up list with `GC decide --lane F3`, a delta acceptance with `GC accept`

#### Scenario: Negative control

- **WHEN** the F2, F3 or delta instruction carries an early-ask step, or records an unfixed blocker outside its lane's existing record
- **THEN** review of that instruction MUST fail
