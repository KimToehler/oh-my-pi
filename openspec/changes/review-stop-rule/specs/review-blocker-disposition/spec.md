# Spec Delta

## Purpose

Defines which reviewer blockers must be fixed before a review or gate proceeds, which may be recorded as accepted residual risks instead, and which commits between fix waves need no review.

## ADDED Requirements

### Requirement: Disposition follows the blocker's kind

Review instructions SHALL direct the orchestrator to decide each blocker by what a consumer would observe. A blocker SHALL be fixed when the plan or code it names would, as written, produce a failure an end user or a downstream consumer of the software observes. A blocker whose consequence stays inside the planning, review or evidence process SHALL be eligible for the user's Accept decision instead, recorded in the gate's accepted residual risks or out-of-scope areas.

#### Scenario: Eligibility is not read off severity or lens

- **WHEN** a blocker carries a high severity label or comes from the checks lens, while its stated consequence stays inside the review process
- **THEN** its eligibility follows the consumer question alone, and the blocking threshold for consumer-visible defects is unchanged

#### Scenario: Process-internal blocker after a clean round

- **WHEN** a complete round returns only blockers whose stated consequence is a weaker proof, a stale cross-reference or evidence bookkeeping
- **THEN** the instruction directs the orchestrator to offer the user Accept for them, with Fix remaining available

#### Scenario: Consumer-visible defect stays blocking

- **WHEN** a round returns a blocker naming a code or design path that would mis-handle a real input, lose data, break an existing consumer or leak a protected value
- **THEN** that blocker is fixed or the user overrides it explicitly, and no eligibility rule in this capability permits recording it as an accepted residual risk

#### Scenario: Negative control

- **WHEN** an instruction lets a consumer-visible defect be recorded as an accepted residual risk because a round found nothing else, or because the reviewer called it low severity
- **THEN** review of that instruction MUST fail

### Requirement: Fixes add no unrequested mechanism

Review instructions SHALL forbid answering a blocker by adding a mechanism, script, procedure or check the proposal did not ask for. Such a blocker SHALL go to the user as Accept, or become its own plan. A fix SHALL be confined to the artifacts and behaviour the plan already covers.

#### Scenario: Evidence blocker that asks for a new checker

- **WHEN** a reviewer requires a new verification script, evidence binding or process step that the proposal does not contain
- **THEN** the instruction directs the orchestrator to present Accept or a separate plan, not to add that mechanism to the plan under review

#### Scenario: Negative control

- **WHEN** an instruction permits implementing such a mechanism inside the current plan because it is small or because the reviewer asked for it
- **THEN** review of that instruction MUST fail

### Requirement: Behaviour-neutral commits between waves

The fix-wave instructions SHALL direct the orchestrator to exempt a commit between waves that changes no behaviour and no review input, naming comment-only and documentation-only commits as the ordinary case, and SHALL keep review required for anything a reviewer brief or a gate criterion reads, including plan edits to criteria, residual risks, scope or fix rows, and comments carrying a compiler, linter or build directive.

#### Scenario: Comment-only commit

- **WHEN** a commit between two waves changes only comment text that no brief or criterion reads
- **THEN** the instruction directs the orchestrator to exempt it with a reason rather than dispatch a delta review

#### Scenario: Negative control

- **WHEN** a commit also changes a plan criterion, an accepted residual risk, a fix row, or a comment that acts as a build or lint directive
- **THEN** exempting it MUST fail the instruction's rule and a delta review is required
