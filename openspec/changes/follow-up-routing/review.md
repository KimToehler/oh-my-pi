# Review

- **Verdict**: REJECT
- **Reviewed digest**: 440fef1021ee19a4be3a0586448bcf80146135660e1743ea3e474942468853e6
- **Depth**: standard
- **Reviewer**: plan-reviewer, PlanReviewDeltaFUR3
- **Verifier**: blocker-verifier, none
- **Models**: PlanReviewDeltaFUR3 onara/cx/gpt-6.1-sol
- **Round**: 3
- **Awaiting**: triage
- **Override**: none

## Blockers

### Delta (PlanReviewDeltaFUR3)

1. **Area**: CHECK 2 / PROCESS 4 — task 5.1 artifact-path isolation
   **Defect**: The new n3 fixture changes both artifact path and finding location relative to n1. Deduplicating on (change name, location, finding ID), while ignoring artifact path, would therefore pass every planned identity control. In ordinary use, two reviewers' unlabelled first notes can concern the same location; that implementation would silently drop one, violating the complete-collection requirement. The finding remains recoverable from the artifacts, but the routing value proof fails.
   **Evidence**: openspec/changes/follow-up-routing/tasks.md:50 places n1 at src/cache.ts:40 and the newly added n3 at src/render.ts:8. Task 5.1 at tasks.md:52 requires both note 1 items to survive, but their different locations let the faulty identity above distinguish them without using artifact path. That identity also passes the existing n1/n2 control (different finding IDs), the new widget-cache-old control (different change names), and identical-source deduplication. specs/review-follow-ups/spec.md:55 requires source-based identity. The assigned fix explicitly requests retaining the same finding ID while changing only its bound artifact path.
   **Change**: Make the artifact-path control hold location and finding content constant as well as change name and finding ID, with only the source artifact path differing. For example, use the same unlabelled first note in the two bound artifacts and explicitly require both source-distinct bullets to remain. Preserve the change-name and identical-source controls, and retain the routed bullets and session/tool evidence.
   **Triage**: not triaged: the verifier has not returned

## Residuals

none

Answer (user, 2026-11-06): exhaustion ask (round 2): Fix: add the two QA controls (the same finding id `note 1` in two bound trailers, and a destination bullet whose source differs only in the change name), then one more delta check.
