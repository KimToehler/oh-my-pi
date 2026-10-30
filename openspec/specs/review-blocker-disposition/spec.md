# review-blocker-disposition Specification

## Purpose
Defines which reviewer blockers must be fixed before a review or gate proceeds, and which the orchestrator may recommend the user accept.

## Requirements

### Requirement: One authoritative disposition definition

The disposition rules SHALL be stated once, in a `Blocker disposition` section of the `review-work` skill. The `omp-gated` review instruction and `integration-review/SKILL.md` SHALL reference that section through the skill (`skill://review-work`), so it resolves from the active agent directory, SHALL treat every blocker as not eligible when the section cannot be read and tell the user so once per review, and SHALL add only their lane's decision points, never a restated or divergent definition.

#### Scenario: Plan review reads the shared definition

- **WHEN** the `omp-gated` review instruction decides whether a blocker is Accept-eligible, in the default agent directory or a profile
- **THEN** it applies the `Blocker disposition` section of the `review-work` skill installed in the active agent directory

#### Scenario: Section cannot be read

- **WHEN** plan review or the F3 STOP cannot read the `Blocker disposition` section
- **THEN** every blocker is handled as not eligible, plan review fixes them without an early ask and F3 offers no freeze, and the instruction tells the user once per review that the section was unreadable and Accept is off

#### Scenario: Negative control

- **WHEN** the schema or `integration-review/SKILL.md` states its own eligibility test, exclusion list or ambiguity default
- **THEN** review of that instruction MUST fail

### Requirement: Accept eligibility is the negation of the blocking threshold

The definition SHALL make a blocker Accept-eligible only when it misses both limbs of the blocking threshold in `review-work/SKILL.md` and no exclusion applies; a severity label, the lens, the wording or any other predicate SHALL never make it eligible, and exclusions take precedence. A missing proof of any material behaviour or failure mode SHALL break the value proof; only a gap in the form of evidence for a behaviour that stays proven SHALL count as weaker proof.

#### Scenario: Weaker proof of an unaffected path

- **WHEN** a blocker's stated consequence is a gap in how evidence is bound, worded or kept outside the gate record, a stale cross-reference, or bookkeeping, while every behaviour it concerns stays proven by a check that can fail, and no merge-gate criterion, existing consumer or protected asset is in its path
- **THEN** it is Accept-eligible and the instruction may recommend Accept for it

#### Scenario: Partial proof of a criterion

- **WHEN** a blocker says a criterion covers creation and deletion, and no planned Verify command or test can fail when deletion breaks
- **THEN** it is not Accept-eligible, because a material behaviour stays unproven, even though the criterion is partly proven

#### Scenario: Minor label on a consumer break

- **WHEN** a blocker is labelled minor or process-only but its stated consequence breaks an existing consumer
- **THEN** it is not Accept-eligible

#### Scenario: Negative control

- **WHEN** an instruction makes a blocker eligible because of a severity word, a lens identity, or a predicate of its own that is not the blocking threshold
- **THEN** review of that instruction MUST fail

### Requirement: Security, gate and consumer blockers are never eligible

The definition SHALL state that a blocker is never Accept-eligible when it names a security or privacy path, a protected asset, a merge-gate criterion, an existing consumer or the audit trail (gate record, trailers, QA artifacts the validator binds), whatever its immediate observer.

#### Scenario: Review or release mechanism as the subject

- **WHEN** a blocker says the change under review alters a review, gate or release mechanism so that it would admit unreviewed or failing work
- **THEN** it is not Accept-eligible, because that mechanism is an existing consumer of the change

#### Scenario: Gate-record evidence

- **WHEN** a blocker says the gate record, a trailer or a QA artifact the validator binds is not bound to the reviewed bytes
- **THEN** it is not Accept-eligible, because the audit trail is a protected asset

#### Scenario: Other mechanical check

- **WHEN** a checks-lens blocker under CHECK 5 says an input outside the gate record, such as a measurement file, is not digest-bound, and no criterion, consumer or protected asset is in its path
- **THEN** it is Accept-eligible

#### Scenario: Negative control

- **WHEN** an instruction recommends recording an excluded blocker as an accepted residual risk because a round found nothing else, or because its damage is reversible
- **THEN** review of that instruction MUST fail

### Requirement: Security sources and gate classification are never eligible

The exclusions SHALL also cover every blocker whose area names review_scope item 4 or CHECK 1, every blocker from a `security_delta: yes` trailer, every blocker on a change whose mandatory class is not `none`, and every blocker that disputes the plan's Mandatory class, Risk tier, reviewer set or whole-diff-review decision.

#### Scenario: Bookkeeping blocker from a security source

- **WHEN** a blocker reads as evidence bookkeeping but is filed under review_scope item 4 or CHECK 1, comes from a `security_delta: yes` trailer, or concerns a change whose mandatory class is not `none`
- **THEN** it is not Accept-eligible, because the exclusion takes precedence over the threshold test

#### Scenario: Disputed gate classification

- **WHEN** a blocker says the plan's Mandatory class, Risk tier, reviewer set or whole-diff-review decision is wrong
- **THEN** it is not Accept-eligible, because it decides how much review the change gets, even though it reads as wording of a `gate.md` field

#### Scenario: Negative control

- **WHEN** an instruction treats a blocker from one of these sources, or a dispute of the plan's gate classification, as bookkeeping
- **THEN** review of that instruction MUST fail

### Requirement: Ambiguity and incompleteness default to blocking

The definition SHALL treat as not eligible a blocker that states no consequence, and a blocker whose consequence is ambiguous or mixes a process gap with a code or design path. A round is complete only when every dispatched reviewer returned a structured verdict; an incomplete round SHALL keep the lane's existing stop and SHALL never count as free of blocking findings or trigger an ask.

#### Scenario: Blocker without a stated consequence

- **WHEN** a rejecting round's blocker names a defect but states no consequence
- **THEN** it is handled as blocking, the instruction recommends no Accept for it, and that round does not count as free of blocking findings

#### Scenario: Mixed consequence

- **WHEN** a blocker names both an evidence gap and a code or design path
- **THEN** it is handled as blocking

#### Scenario: Reviewer without a verdict

- **WHEN** a dispatched reviewer still returns no structured verdict after its retry
- **THEN** the round is incomplete and the lane stops and tells the user as today; no fix wave and no ask follow from it

#### Scenario: Negative control

- **WHEN** an instruction treats a round with a missing or unparsed reviewer verdict as free of blocking findings, or defaults an unclear blocker to Accept-eligible
- **THEN** review of that instruction MUST fail

### Requirement: Every accept path recommends only eligible blockers

Instructions SHALL apply eligibility wherever a blocker can stay unfixed: plan-review Accept and Override, the F2 Phase 4 override, F2 and F3 freeze, and delta accept. Accept or freeze SHALL be recommended and offered only for blockers that are eligible or covered; a decision leaving several blockers at once needs every one so. Otherwise the orchestrator SHALL offer fix, re-plan or stop (or the options the lane's tier still allows), naming each blocker and its stated consequence.

#### Scenario: F3 STOP with a non-eligible Must-fix

- **WHEN** F3 reaches a convergence STOP and one remaining Must-fix class names a security path
- **THEN** the instruction offers re-plan or continue, not freeze, and names that class and its consequence

#### Scenario: F2 override without a covering entry

- **WHEN** an F2 wave fails on a non-eligible blocker that no Accepted residual risks or Out of scope entry of the plan's merge-gate section covers
- **THEN** the instruction offers no override for it, even on the user's request, and `below-threshold` is used only for eligible blockers

#### Scenario: Negative control

- **WHEN** an instruction offers or recommends accept, freeze or Override for a non-eligible, uncovered blocker without the user's explicit request
- **THEN** review of that instruction MUST fail

### Requirement: Coverage by gate.md is specific

A blocker SHALL count as covered only when an Accepted residual risks or Out of scope entry of the plan's reviewed merge-gate section (`gate.md` for an OpenSpec folder) names the same defect class and consequence. This is today's `accepted-residual` path: the entry was reviewed with the plan, so a covered blocker may be recorded as accepted even when it breaks the threshold. Coverage SHALL never apply to a blocker the exclusions make ineligible.

#### Scenario: Exact match

- **WHEN** a non-excluded F2 blocker says a material failure mode has no proof that can fail, and a reviewed Accepted residual risks entry names that same proof gap and consequence
- **THEN** it is covered and may be recorded with an `accepted-residual` downgrade, as today

#### Scenario: Same class, other consequence, or broad entry

- **WHEN** a non-excluded blocker meets an entry that names its defect class but a different consequence, or only a broad area list
- **THEN** it is not covered, and no override is offered for it unless it is eligible

#### Scenario: Broad entry and an excluded blocker

- **WHEN** an F2 blocker names a security path and a broad `gate.md` Out of scope entry mentions its area
- **THEN** it is not covered, and the orchestrator offers no override for it

#### Scenario: Negative control

- **WHEN** an instruction treats a `gate.md` entry as covering a blocker whose defect class or consequence it does not name, or lets coverage admit an excluded blocker
- **THEN** review of that instruction MUST fail

### Requirement: The user's explicit acceptance is recorded

Instructions SHALL keep the user's explicit request to accept or freeze a non-eligible blocker that no exclusion names possible at plan-review Accept and Override, F2 and F3 freeze, and delta accept, and SHALL record it in that path's existing record with the user's reason in their words and the blocker's stated consequence. The F2 Phase 4 override SHALL NOT accept a non-eligible, uncovered blocker; the user's options there are fix, another wave or re-plan.

#### Scenario: User insists on accepting

- **WHEN** the user explicitly asks to accept or freeze a non-eligible blocker at one of those paths
- **THEN** the orchestrator records it in that path's existing record (`gate.md` Override, the `downgrades` entry with rule `frozen`, the F3 report follow-up list or `GC accept --reason`) with the user's reason and the blocker's stated consequence

#### Scenario: Insisting at the F2 Phase 4 override

- **WHEN** the user asks to accept a non-eligible, uncovered blocker at an ordinary F2 Phase 4 override, outside a convergence STOP
- **THEN** the orchestrator writes no override for it and offers fix, another wave or re-plan, because no `downgrades` rule would describe it truthfully

#### Scenario: Negative control

- **WHEN** an instruction records the user's acceptance of a non-eligible blocker without their reason and the stated consequence, refuses it at a path that allows it, or accepts it at the F2 Phase 4 override
- **THEN** review of that instruction MUST fail

### Requirement: Excluded blockers are never accepted

A blocker an exclusion names SHALL never be accepted, frozen or overridden at any path, even on the user's request; the options SHALL be fix, re-plan or stop, because an accepted entry would make later reviewers treat the security, audit-trail, gate or classification defect as settled.

#### Scenario: Insisting on an excluded blocker

- **WHEN** the user asks to accept a blocker that names a security path at plan review
- **THEN** the orchestrator writes no `gate.md` entry for it and offers fix, re-plan or stop

#### Scenario: Negative control

- **WHEN** an instruction accepts, freezes or overrides an excluded blocker at any path, on request or not
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
