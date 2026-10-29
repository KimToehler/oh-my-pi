# Spec Delta

## Purpose

Defines which reviewer blockers must be fixed before a review or gate proceeds, which the user may instead accept, and which commits between fix waves need no review.

## ADDED Requirements

### Requirement: Accept eligibility is the negation of the blocking threshold

Review instructions SHALL define a blocker as Accept-eligible only when it misses both limbs of the existing blocking threshold in `review-work/SKILL.md`: it breaks no goal, value proof, merge-gate criterion or existing consumer, and it reaches no protected asset. Instructions SHALL state that eligibility is read from the blocker's own consequence against that single threshold, not from a second predicate, a severity label, the lens or the reviewer's wording.

#### Scenario: Weaker proof of an unaffected path

- **WHEN** a blocker's stated consequence is a weaker proof, a stale cross-reference or evidence bookkeeping, and no merge-gate criterion, existing consumer or protected asset is in its path
- **THEN** it is Accept-eligible and the instruction may recommend Accept for it

#### Scenario: Negative control

- **WHEN** an instruction derives eligibility from a severity word, a lens identity, or a predicate of its own that is not the blocking threshold
- **THEN** review of that instruction MUST fail

### Requirement: Security, gate and consumer blockers are never eligible

Review instructions SHALL state that a blocker is never Accept-eligible when it names a security or privacy path, a protected asset, a merge-gate criterion or an existing consumer, whatever the immediate observer is. Never eligible SHALL include any blocker a security lens or a `security_delta: yes` trailer raises, and any blocker on a change whose mandatory class is not `none`.

#### Scenario: Review or release mechanism as the subject

- **WHEN** a blocker's subject is a review, gate or release mechanism that would admit unreviewed or failing work
- **THEN** it is not Accept-eligible, because that mechanism is an existing consumer of the change

#### Scenario: Missing inventory on a credential path

- **WHEN** a blocker says the plan lacks the holder/sink inventory or the negative control for a credential, personal-data or audit-trail path
- **THEN** it is not Accept-eligible, even though its immediate consequence is weaker proof, and no instruction recommends Accept for it

#### Scenario: Negative control

- **WHEN** an instruction lets such a blocker be recorded as an accepted residual risk because a round found nothing else, or because its damage is reversible
- **THEN** review of that instruction MUST fail

### Requirement: Ambiguity and incompleteness default to blocking

Review instructions SHALL treat as not eligible, and SHALL NOT count as a round free of blocking findings: a blocker that states no consequence, a blocker whose consequence is ambiguous or mixes a process gap with a code or design path, and any round in which a dispatched reviewer returned no verdict. A round is complete only when every dispatched reviewer of that round returned a structured verdict.

#### Scenario: Blocker without a stated consequence

- **WHEN** a rejecting round's blocker names a defect but states no consequence, or names both an evidence gap and a code path
- **THEN** it is handled as blocking, the instruction recommends no Accept for it, and that round does not count as free of blocking findings

#### Scenario: Negative control

- **WHEN** an instruction treats a round with a missing or unparsed reviewer verdict as free of blocking findings, or defaults an unclear blocker to Accept-eligible
- **THEN** review of that instruction MUST fail

### Requirement: Fixes add no unrequested mechanism

Review instructions SHALL forbid answering an Accept-eligible blocker by adding a mechanism, script, procedure or check the proposal did not ask for; such a blocker SHALL go to the user as Accept, or become its own plan. A blocker that is not Accept-eligible SHALL be fixed with whatever the correct fix needs, including a new check, and the existing rule that a fix adding a subsystem becomes its own plan SHALL stay in force.

#### Scenario: Evidence blocker that asks for a new checker

- **WHEN** an Accept-eligible blocker requires a new verification script, evidence binding or process step the proposal does not contain
- **THEN** the instruction directs the orchestrator to present Accept or a separate plan, not to add that mechanism to the plan under review

#### Scenario: Missing authorization check

- **WHEN** a blocker says the planned behaviour needs an authorization or input-validation check that the proposal did not name
- **THEN** it is not Accept-eligible and the fix adds that check inside the current plan

#### Scenario: Negative control

- **WHEN** an instruction permits adding an unrequested mechanism for an Accept-eligible blocker because it is small, or refuses a check needed to fix a blocking defect
- **THEN** review of that instruction MUST fail

### Requirement: Behaviour-neutral commits between waves

The fix-wave instructions SHALL exempt a commit between waves only when every changed line is a comment or prose in a file that no reviewer brief, plan bundle, merge-gate criterion, agent-loaded instruction, or build, lint, codegen or documentation generator reads. Every other commit SHALL be delta-reviewed. The exemption SHALL be recorded with a reason, as today.

#### Scenario: Comment-only commit in unread source

- **WHEN** a commit between two waves changes only comment text in a source file, and no brief, criterion, instruction or tool reads that text
- **THEN** the instruction directs the orchestrator to exempt it with a reason rather than dispatch a delta review

#### Scenario: Negative control

- **WHEN** a commit changes prose in an agent-loaded instruction file, a plan artifact bound by `plan_sha256`, a doc comment a generator consumes, or a comment carrying a compiler, linter or build directive
- **THEN** exempting it MUST fail the instruction's rule and a delta review is required
