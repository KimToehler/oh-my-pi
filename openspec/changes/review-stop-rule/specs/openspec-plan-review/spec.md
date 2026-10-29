# Spec Delta

## ADDED Requirements

### Requirement: Early ask when a complete round holds only eligible blockers

The `omp-gated` review instruction SHALL apply the disposition rules of `review-blocker-disposition` to every rejecting round, and SHALL ask the user at the first complete round whose open blockers are all Accept-eligible, instead of only after a third REJECT. The question SHALL offer Fix, Accept and Stop per open blocker, SHALL recommend Accept for the eligible ones, and SHALL report for each the consequence the reviewer stated.

#### Scenario: First round without a blocking finding asks

- **WHEN** round 2 of a change returns REJECT, every dispatched lens returned a verdict, and every open blocker is Accept-eligible
- **THEN** the instruction directs the orchestrator to ask the user then, with Accept recommended and each blocker's stated consequence shown, rather than to fix them and dispatch round 3

#### Scenario: Accept keeps its effect

- **WHEN** the user answers Accept for an eligible blocker
- **THEN** their own reason enters `gate.md` as an accepted residual risk or out-of-scope area, a fresh round follows, and that round's reviewers do not block on it

#### Scenario: Round with a blocking finding keeps the existing path

- **WHEN** a rejecting round holds at least one blocker that is not Accept-eligible, including the ambiguous and incomplete-round cases
- **THEN** the instruction directs a fix and a new round, and the user is asked after the third REJECT as before

#### Scenario: Negative control

- **WHEN** an instruction asks the user while a non-eligible blocker is open without naming it as an open blocker, or recommends Accept for it
- **THEN** review of that instruction MUST fail

### Requirement: Early ask stays inside plan review

The early-ask rule SHALL apply to plan-review rounds only. The post-implementation lanes SHALL keep their existing convergence decisions and record vocabulary unchanged, and SHALL state only the eligibility definition, the ambiguity default, the no-unrequested-mechanism rule and the exemption allow-set of `review-blocker-disposition`.

#### Scenario: F2 wave with only eligible blockers

- **WHEN** an F2 fix wave returns FAIL and every blocker is Accept-eligible
- **THEN** the instruction keeps the existing CONTINUE, STOP and freeze decisions, records the user's acceptance through `override` plus a `downgrades` entry whose `rule` is `accepted-residual` or `below-threshold`, and introduces no early-ask path of its own

#### Scenario: Negative control

- **WHEN** the F2, F3 or delta instruction carries an early-ask step, or records an accepted blocker outside the `downgrades` vocabulary
- **THEN** review of that instruction MUST fail
