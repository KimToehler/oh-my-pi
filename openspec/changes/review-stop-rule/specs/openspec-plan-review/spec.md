# Spec Delta

## ADDED Requirements

### Requirement: Round disposition and the user decision

The `omp-gated` review instruction SHALL apply the disposition rules of `review-blocker-disposition` to every rejecting round, and SHALL ask the user at the first complete round whose blockers contain no consumer-visible product defect, instead of only after a third REJECT. The question SHALL offer Fix, Accept and Stop per open blocker and SHALL recommend Accept for every blocker eligible under those rules.

#### Scenario: Accept keeps its effect

- **WHEN** the user answers Accept for an eligible blocker
- **THEN** their own reason enters `gate.md` as an accepted residual risk or out-of-scope area, a fresh round follows, and that round's reviewers do not block on it

#### Scenario: First clean-of-defects round asks

- **WHEN** round 2 of a change returns REJECT and every blocker of every rejecting lens is process-internal
- **THEN** the instruction directs the orchestrator to ask the user then, with Accept recommended for those blockers, rather than to fix them and dispatch round 3

#### Scenario: Defect round keeps the existing path

- **WHEN** a rejecting round contains a consumer-visible product defect
- **THEN** the instruction directs a fix and a new round, and the user is asked after the third REJECT as before

#### Scenario: Negative control

- **WHEN** an instruction asks the user while a consumer-visible defect is open without naming it as an open blocker, or recommends Accept for it
- **THEN** review of that instruction MUST fail
