# Review

- **Verdict**: REJECT
- **Reviewed digest**: 28ee87f07f4bc963e359aca94d72143b3a89b299e2af711ae76a4f5510c0e9f3
- **Depth**: standard
- **Reviewer**: plan-reviewer, PlanReviewDeltaFUR2
- **Verifier**: blocker-verifier, BlockerTriageFUR2
- **Models**: PlanReviewDeltaFUR2 onara/cx/gpt-6.1-sol; BlockerTriageFUR2 onara/cx/gpt-6.1-sol
- **Round**: 2
- **Awaiting**: exhaustion
- **Override**: none

## Blockers

### Delta (PlanReviewDeltaFUR2)

1. **Area**: CHECK 2 — fix 3 / task 5.1 identity-component controls
   **Defect**: The new verification distinguishes finding IDs but does not establish that artifact path and change name participate in deduplication. A realistic case is two bound reviewers each producing an unlabelled first note: both receive `note 1`, and both must survive. An implementation that displays the complete Source but deduplicates on finding ID alone would pass every planned row while silently dropping one of those findings. The omitted follow-up is recoverable from the review artifacts, but this breaks the complete-collection value proof.
   **Evidence**: openspec/changes/follow-up-routing/tasks.md:24 defines identity using change name, artifact path and finding ID. The fixture at tasks.md:50 instead gives every collected finding a distinct ID (`note 1`, `note 2`, `B1`). Task 5.1 at tasks.md:52 tests those distinct IDs and an identical-source duplicate, but contains no control varying artifact path or change name while retaining the other identity components. specs/review-follow-ups/spec.md:55-67 likewise covers same-location findings and identical sources only. Fix entry 3 explicitly requests controls proving that changing each identity component is distinguished.
   **Change**: Extend the real-session fixtures with component-isolation controls: retain the same finding ID while changing only its bound artifact path, and prepopulate a destination with a source differing only in change name. Require both distinct sources to survive, alongside the existing identical-source deduplication control. Retain the routed bullets and tool interactions; no model-behaviour scoring script is needed.
   **Triage**: confirmed, blocking true, protected false: The concrete failure is supported: tasks.md:24 defines identity as the complete source (change name, artifact path and finding ID), so two bound artifacts' first unlabelled notes must both survive even though each is `note 1`. But tasks.md:50 supplies only distinct IDs (`note 1`, `note 2`, `B1`), and task 5.1 at line 52 checks those plus an identical-source duplicate. Its whole-diff row adds r1 without requiring an ID collision or isolating either remaining identity component. An implementation that prints complete sources but deduplicates on finding ID alone can therefore satisfy these prescribed outcomes while dropping a note in ordinary multi-reviewer collection. The scenarios at specs/review-follow-ups/spec.md:55-67 specify complete identity but add no executed component-isolation check. This is a missing proof of material complete-collection behavior, not an accepted residual risk or blocking-scope exclusion in gate.md. No protected asset is implicated.

## Residuals

none

