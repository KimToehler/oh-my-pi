# Spec Delta

## Purpose

Defines which reviewer blockers must be fixed before a review or gate proceeds, which the orchestrator may recommend the user accept, and which commits between fix waves need no review.

## ADDED Requirements

### Requirement: One authoritative disposition definition

The disposition rules SHALL be stated once, in a `Blocker disposition` section of `review-work/SKILL.md`. The `omp-gated` review instruction and `integration-review/SKILL.md` SHALL reference that section by name and SHALL add only their lane's decision points, never a restated or divergent definition.

#### Scenario: Plan review reads the shared definition

- **WHEN** the `omp-gated` review instruction decides whether a blocker is Accept-eligible
- **THEN** it applies the `Blocker disposition` section of `review-work/SKILL.md`

#### Scenario: Negative control

- **WHEN** the schema or `integration-review/SKILL.md` states its own eligibility test, exclusion list or ambiguity default
- **THEN** review of that instruction MUST fail

### Requirement: Accept eligibility is the negation of the blocking threshold

The definition SHALL make a blocker Accept-eligible only when it misses both limbs of the blocking threshold in `review-work/SKILL.md` and no exclusion applies. A severity label, the lens, the reviewer's wording or any other predicate SHALL never make a blocker eligible, and the exclusions SHALL take precedence. A gap in the plan's own Verify commands or evidence SHALL count as weaker proof, not a broken value proof, unless it leaves a merge-gate criterion wholly unproven.

#### Scenario: Weaker proof of an unaffected path

- **WHEN** a blocker's stated consequence is a weaker proof, a stale cross-reference or evidence bookkeeping, and no merge-gate criterion, existing consumer or protected asset is in its path
- **THEN** it is Accept-eligible and the instruction may recommend Accept for it

#### Scenario: Verify gap that leaves a criterion unproven

- **WHEN** a blocker says no Verify command or evidence of the plan can fail when a named merge-gate criterion is broken
- **THEN** it is not Accept-eligible, because that criterion would stay wholly unproven

#### Scenario: Minor label on a consumer break

- **WHEN** a blocker is labelled minor or process-only but its stated consequence breaks an existing consumer
- **THEN** it is not Accept-eligible

#### Scenario: Negative control

- **WHEN** an instruction makes a blocker eligible because of a severity word, a lens identity, or a predicate of its own that is not the blocking threshold
- **THEN** review of that instruction MUST fail

### Requirement: Security, gate and consumer blockers are never eligible

The definition SHALL state that a blocker is never Accept-eligible when it names a security or privacy path, a protected asset, a merge-gate criterion or an existing consumer, whatever the immediate observer is. The exclusions SHALL also cover every blocker filed under review_scope item 4 (security and privacy) or CHECK 1 (credential and personal-data holders and sinks), every blocker from a `security_delta: yes` trailer, and every blocker on a change whose mandatory class is not `none`.

#### Scenario: Review or release mechanism as the subject

- **WHEN** a blocker says the change under review alters a review, gate or release mechanism so that it would admit unreviewed or failing work
- **THEN** it is not Accept-eligible, because that mechanism is an existing consumer of the change

#### Scenario: Bookkeeping blocker from a security source

- **WHEN** a blocker reads as evidence bookkeeping but is filed under review_scope item 4 or CHECK 1, comes from a `security_delta: yes` trailer, or concerns a change whose mandatory class is not `none`
- **THEN** it is not Accept-eligible, because the exclusion takes precedence over the threshold test

#### Scenario: Other mechanical check

- **WHEN** a checks-lens blocker under CHECK 5 says an evidence file is not digest-bound and no criterion, consumer or protected asset is in its path
- **THEN** it is Accept-eligible

#### Scenario: Negative control

- **WHEN** an instruction recommends recording an excluded blocker as an accepted residual risk because a round found nothing else, or because its damage is reversible
- **THEN** review of that instruction MUST fail

### Requirement: Ambiguity and incompleteness default to blocking

The definition SHALL treat as not eligible, and SHALL NOT count as a round free of blocking findings: a blocker that states no consequence, a blocker whose consequence is ambiguous or mixes a process gap with a code or design path, and any round in which a dispatched reviewer returned no verdict. A round is complete only when every dispatched reviewer of that round returned a structured verdict.

#### Scenario: Blocker without a stated consequence

- **WHEN** a rejecting round's blocker names a defect but states no consequence
- **THEN** it is handled as blocking, the instruction recommends no Accept for it, and that round does not count as free of blocking findings

#### Scenario: Mixed consequence

- **WHEN** a blocker names both an evidence gap and a code or design path
- **THEN** it is handled as blocking

#### Scenario: Negative control

- **WHEN** an instruction treats a round with a missing or unparsed reviewer verdict as free of blocking findings, or defaults an unclear blocker to Accept-eligible
- **THEN** review of that instruction MUST fail

### Requirement: Every accept path recommends only eligible blockers

Instructions SHALL apply eligibility wherever a blocker can stay unfixed: plan-review Accept and Override, the F2 Phase 4 override, F2 and F3 freeze, and delta accept. There the orchestrator SHALL recommend and offer accept or freeze only when every blocker left unfixed is eligible, or is covered by an entry of the plan-reviewed `gate.md`; otherwise it SHALL offer fix, re-plan or stop and name each such blocker with its stated consequence.

#### Scenario: F3 STOP with a non-eligible Must-fix

- **WHEN** F3 reaches a convergence STOP and one remaining Must-fix class names a security path
- **THEN** the instruction offers re-plan or continue, not freeze, and names that class and its consequence

#### Scenario: F2 override without a covering entry

- **WHEN** an F2 wave fails on a non-eligible blocker that no Accepted residual risks or Out of scope entry of `gate.md` covers
- **THEN** the instruction offers no override for it, and `below-threshold` is used only for eligible blockers

#### Scenario: Negative control

- **WHEN** an instruction offers or recommends accept, freeze or Override for a non-eligible, uncovered blocker without the user's explicit request
- **THEN** review of that instruction MUST fail

### Requirement: The user's explicit acceptance is recorded

Instructions SHALL keep the user's explicit request to accept or freeze a non-eligible blocker possible, and SHALL record it in that path's existing record with the user's reason in their words and the blocker's stated consequence.

#### Scenario: User insists on accepting

- **WHEN** the user explicitly asks to accept or freeze a non-eligible blocker
- **THEN** the orchestrator records it in that path's existing record (`gate.md` Override, the `downgrades` entry, the F3 report follow-up list or `GC accept --reason`) with the user's reason and the blocker's stated consequence

#### Scenario: Negative control

- **WHEN** an instruction records the user's acceptance of a non-eligible blocker without their reason and the stated consequence, or refuses it outright
- **THEN** review of that instruction MUST fail

### Requirement: Fixes add no unrequested mechanism

The definition SHALL forbid answering an Accept-eligible blocker by adding a mechanism, script, procedure or check the proposal did not ask for; such a blocker SHALL go to the user as Accept, or become its own plan. A blocker that is not Accept-eligible SHALL be fixed with whatever the correct fix needs, including a new check, and the existing rule that a fix adding a subsystem becomes its own plan SHALL stay in force.

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

The fix-wave instructions SHALL exempt a commit between waves only when it ticks a final-verification checkbox, or when every changed line is a comment or prose in a file that no reviewer brief, plan bundle, merge-gate criterion, agent-loaded instruction, or build, lint, codegen or documentation generator reads and no changed comment carries a compiler, linter or build directive. Every other commit SHALL be delta-reviewed. The exemption SHALL be recorded with a reason, as today.

#### Scenario: Comment-only commit in unread source

- **WHEN** a commit between two waves changes only comment text in a source file, and no brief, criterion, instruction or tool reads that text
- **THEN** the instruction directs the orchestrator to exempt it with `GC exempt` and a reason naming what changed, rather than dispatch a delta review

#### Scenario: Final-verification checkbox

- **WHEN** a commit only ticks a final-verification checkbox
- **THEN** it is exempt with its reason, as today

#### Scenario: Directive or generated-doc comment

- **WHEN** a comment-only commit changes a doc comment a documentation generator consumes, or a comment carrying a compiler, linter or build directive
- **THEN** it is delta-reviewed

#### Scenario: Negative control

- **WHEN** an instruction exempts a commit that changes any other prose in an agent-loaded instruction file or a plan artifact bound by `plan_sha256`, or exempts any commit without a recorded reason
- **THEN** exempting it MUST fail the instruction's rule and a delta review is required
