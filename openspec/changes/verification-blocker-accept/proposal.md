# Proposal

## Why

`Blocker disposition` in the `review-work` skill excludes every blocker of a change whose Mandatory class is not `none`. The exclusion does not distinguish a blocker about the delivered auth, migration, wire or state behaviour from one about how this change verifies itself. As a result, a blocker about the form of the change's own QA evidence (wording, a mismatched evidence path, bookkeeping outside the audit trail) cannot be accepted on a classified change, even when every material behaviour stays proven by a check that can fail, and each such blocker costs a full fix round. This change claims no fewer rounds for any past review: the verification blockers of `plan-adopt-and-cap` rounds 9-10 named credentials and stay excluded.

`review-proportionality` (merged at `3ef758446b`) defines `Change verification` once and has the approach question show whether each blocker concerns the delivered change or its verification. That makes the distinction available to the exclusion. The approach question still states that this assignment never changes eligibility.

## What Changes

- The class exclusion in `Blocker disposition` narrows. On a change whose Mandatory class is not `none`, a blocker stays excluded unless it concerns only this change's verification, as `Change verification` defines it, and misses both limbs of the blocking threshold. A blocker about the delivered change, one that concerns both, one whose subject is unclear and one that leaves a material behaviour unproven stay excluded, so coverage by `gate.md` and the user's explicit request cannot leave them unfixed either.
- Only such a blocker becomes Accept-eligible on a classified change. All other exclusions remain in force and take precedence: security or privacy path, protected asset, credential, audit trail (including QA artifacts the validator binds), review_scope item 4 or CHECK 1, `security_delta: yes`, a dispute of the gate classification, and a review or gate mechanism that would admit unreviewed or failing work.
- The approach question's per-blocker assignment (delivered change or verification) becomes the same judgement the exclusion uses. It is no longer a display that "never changes eligibility". It still never changes severity.
- The team-config README sentence that lists the exclusions follows the new wording.

## Capabilities

### New Capabilities

### Modified Capabilities
- `review-blocker-disposition`: the mandatory-class exclusion keeps blockers about the delivered change and excludes no longer those that concern only the change's verification.
- `openspec-plan-review`: the approach question's change-or-verification assignment is the eligibility judgement of `Blocker disposition`, not a separate display.

## Impact

- `team-config/agent/skills/review-work/SKILL.md` (`Blocker disposition` exclusion list).
- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` (review step 4a, one parenthetical).
- `team-config/README.md` (plan-review paragraph).
- `openspec/specs/review-blocker-disposition/spec.md` and `openspec/specs/openspec-plan-review/spec.md` at archive.
- Every lane that references `Blocker disposition` (plan review, F2, delta review, F3) applies the narrowed exclusion without its own edit. At F2 and F3, blockers about F1 evidence that the validator binds remain excluded as audit trail.
- Deployment: `scripts/deploy-local.sh` for the agent directory. The `omp-gated` schema changes, so projects with their own schema copy (onara, weaver) need `team-config/agent/skills/review-work/scripts/install-openspec-workflow.mjs` again.
- No validator, record format, script or package code changes.
