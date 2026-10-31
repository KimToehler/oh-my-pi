# Spec Delta

## MODIFIED Requirements

### Requirement: Security sources and gate classification are never eligible

The exclusions SHALL also cover every blocker whose area names review_scope item 4 or CHECK 1, every blocker from a `security_delta: yes` trailer, every blocker on a change whose mandatory class is not `none` unless the blocker concerns only that change's verification as the `Change verification` section of the `review-work` skill defines it, and every blocker that disputes the plan's Mandatory class, Risk tier, reviewer set or whole-diff-review decision.

#### Scenario: Bookkeeping blocker from a security source

- **WHEN** a blocker reads as evidence bookkeeping but is filed under review_scope item 4 or CHECK 1, or comes from a `security_delta: yes` trailer
- **THEN** it is not Accept-eligible, because the exclusion takes precedence over the threshold test

#### Scenario: Delivered-change blocker under a mandatory class

- **WHEN** a change's mandatory class is `concurrency-state` and a blocker's stated consequence is a stale cross-reference in the delivered design of the changed state transition, while every behaviour stays proven
- **THEN** it is not Accept-eligible, because it concerns the delivered change

#### Scenario: Verification-only evidence gap under a mandatory class

- **WHEN** a change's mandatory class is `concurrency-state` and a blocker's stated consequence is that one F1 scenario's evidence path is named differently in tasks.md and design.md, while that scenario still runs, retains its outputs and every behaviour stays proven by a check that can fail, and no other exclusion applies
- **THEN** it is Accept-eligible and the instruction may recommend Accept for it

#### Scenario: Verification blocker that leaves material behaviour unproven

- **WHEN** a change's mandatory class is `auth-secrets-pii` and a blocker says the planned F1 run cannot fail when token refresh fails
- **THEN** it is not Accept-eligible, because a material behaviour stays unproven under the threshold, although the blocker concerns only verification

#### Scenario: Verification blocker that names a credential

- **WHEN** a change's mandatory class is not `none` and a blocker says a planned QA step copies the provider key into a committed evidence file
- **THEN** it is not Accept-eligible, because it names a security path and a protected asset

#### Scenario: Mixed or unclear subject under a mandatory class

- **WHEN** a change's mandatory class is not `none` and a blocker names both a QA fixture and a delivered code or design path, or its stated consequence leaves open which of the two it concerns
- **THEN** it is not Accept-eligible

#### Scenario: Disputed gate classification

- **WHEN** a blocker says the plan's Mandatory class, Risk tier, reviewer set or whole-diff-review decision is wrong
- **THEN** it is not Accept-eligible, because it decides how much review the change gets, even though it reads as wording of a `gate.md` field

#### Scenario: Negative control

- **WHEN** an instruction treats a blocker from one of these sources, or a dispute of the plan's gate classification, as bookkeeping, or treats a blocker on a change whose mandatory class is not `none` as eligible when it concerns the delivered change, concerns both, or leaves its subject unclear
- **THEN** review of that instruction MUST fail
