# Spec Delta

## ADDED Requirements

### Requirement: One disposition definition for the post-implementation lanes

The disposition rules SHALL be stated once, in the `Blocker disposition` section of the `review-work` skill, for F2 (Phase 4 and fix waves), F2 delta reviews and F3. `integration-review/SKILL.md` SHALL reference it through `skill://review-work`, add only its lane's decision points, and treat every blocker as not eligible when the section cannot be read, telling the user once per review. Plan review of `omp-gated` changes SHALL NOT apply it.

#### Scenario: F3 reads the shared definition

- **WHEN** the F3 STOP of `integration-review` decides whether a Must-fix class may be frozen, in the default agent directory or a profile
- **THEN** it applies the `Blocker disposition` section of the `review-work` skill installed in the active agent directory

#### Scenario: Plan review does not apply the definition

- **WHEN** the `omp-gated` review instruction handles a plan-review finding
- **THEN** it uses the verifier triage of `openspec-plan-review` and decides no Accept eligibility

#### Scenario: Section cannot be read

- **WHEN** an F2 decision or the F3 STOP cannot read the `Blocker disposition` section
- **THEN** every blocker is handled as not eligible, F3 offers no freeze, and the instruction tells the user once per review that the section was unreadable and Accept is off

#### Scenario: Negative control

- **WHEN** `integration-review/SKILL.md` states its own eligibility test, exclusion list or ambiguity default, or the `omp-gated` review instruction applies Accept eligibility to a plan-review finding
- **THEN** review of that instruction MUST fail

## REMOVED Requirements

### Requirement: One authoritative disposition definition
**Reason**: Plan review no longer applies the disposition section; the requirement is restated for the post-implementation lanes only.
**Migration**: See "One disposition definition for the post-implementation lanes" and `openspec-plan-review` "Only confirmed findings block".

#### Scenario: Negative control
- **WHEN** the `omp-gated` review instruction still references `Blocker disposition` to decide a plan-review finding
- **THEN** review of that instruction MUST fail

## MODIFIED Requirements

### Requirement: Every accept path recommends only eligible blockers

Instructions SHALL apply eligibility wherever a blocker can stay unfixed: the F2 Phase 4 override, F2 and F3 freeze, and delta accept. Accept or freeze SHALL be recommended and offered only for blockers that are eligible or covered; a decision leaving several blockers at once needs every one so. Otherwise the orchestrator SHALL offer fix, re-plan or stop (or the options the lane's tier still allows), naming each blocker and its stated consequence.

#### Scenario: F3 STOP with a non-eligible Must-fix

- **WHEN** F3 reaches a convergence STOP and one remaining Must-fix class names a security path
- **THEN** the instruction offers re-plan or continue, not freeze, and names that class and its consequence

#### Scenario: F2 override without a covering entry

- **WHEN** an F2 wave fails on a non-eligible blocker that no Accepted residual risks or Out of scope entry of the plan's merge-gate section covers
- **THEN** the instruction offers no override for it, even on the user's request, and `below-threshold` is used only for eligible blockers

#### Scenario: Negative control

- **WHEN** an instruction offers or recommends accept, freeze or Override for a non-eligible, uncovered blocker without the user's explicit request
- **THEN** review of that instruction MUST fail

### Requirement: The user's explicit acceptance is recorded

Instructions SHALL keep the user's explicit request to accept or freeze a non-eligible blocker that no exclusion names possible at F2 and F3 freeze and delta accept, and SHALL record it in that path's existing record with the user's reason in their words and the blocker's stated consequence. The F2 Phase 4 override SHALL NOT accept a non-eligible, uncovered blocker; the user's options there are fix, another wave or re-plan.

#### Scenario: User insists on accepting

- **WHEN** the user explicitly asks to accept or freeze a non-eligible blocker at one of those paths
- **THEN** the orchestrator records it in that path's existing record (the `downgrades` entry with rule `frozen`, the F3 report follow-up list or `GC accept --reason`) with the user's reason and the blocker's stated consequence

#### Scenario: Insisting at the F2 Phase 4 override

- **WHEN** the user asks to accept a non-eligible, uncovered blocker at an ordinary F2 Phase 4 override, outside a convergence STOP
- **THEN** the orchestrator writes no override for it and offers fix, another wave or re-plan, because no `downgrades` rule would describe it truthfully

#### Scenario: Negative control

- **WHEN** an instruction records the user's acceptance of a non-eligible blocker without their reason and the stated consequence, refuses it at a path that allows it, or accepts it at the F2 Phase 4 override
- **THEN** review of that instruction MUST fail

### Requirement: Excluded blockers are never accepted

A blocker an exclusion names SHALL never be accepted, frozen or overridden at any path, even on the user's request; the options SHALL be fix, re-plan or stop, because an accepted entry would make later reviewers treat the security, audit-trail, gate or classification defect as settled.

#### Scenario: Insisting on an excluded blocker

- **WHEN** the user asks to freeze an F3 Must-fix class that names a security path
- **THEN** the orchestrator records no freeze for it and offers fix, re-plan or stop

#### Scenario: Negative control

- **WHEN** an instruction accepts, freezes or overrides an excluded blocker at any path, on request or not
- **THEN** review of that instruction MUST fail
