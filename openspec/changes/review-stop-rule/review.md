# Review

- **Reviewed digest**: 990b55d6f278068b2a7c64cfb484a7e037f222ddfbca528b847af79d6d7744c7
- **Reviewer**: plan-reviewer, StopCorrectness8, StopVerification8, StopChecks8
- **Verdict**: REJECT
- **Round**: 8
- **Override**: none

## Blockers

### Correctness (StopCorrectness8)

1. **Correctness: incomplete plan-review rounds** — The plan preserves an earlier OKAY when a new review is incomplete, so the incomplete round can still be consumed as an approved review after the session stops or resumes. This defeats the stated invariant that an incomplete round never counts as clean. The resulting source edits or release may be irreversible. Evidence: openspec/changes/review-stop-rule/design.md:29 and specs/openspec-plan-review/spec.md:29-32 require leaving review.md untouched when a lens fails twice. With an unchanged plan and an existing OKAY—the realistic re-review state explicitly recognized at specs/openspec-plan-review/spec.md:48-51—the old digest still matches. team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs:420-426 checks that digest and verdict, not whether a later round was incomplete, so --reviewed continues to pass even if another lens in that incomplete round rejected. Change: Define a durable invalidation for an incomplete re-review that makes --reviewed refuse the prior approval, including when another lens has returned REJECT; reconcile the current no-write requirement with that behavior and cover the unchanged-plan, prior-OKAY case.

### Verification (StopVerification8)

1. **Executability — tasks 1.2, 1.3 and F1** — Required replay outcomes are absent from the explicitly fixed decision set. Following the vocabulary rejects valid required rows; using those outcomes violates the replay instructions. This blocks task completion and final verification, though the correction is reversible. Evidence: tasks.md:5 defines the fixed set without notice-fix-blocking, ask-verbatim, review-recorded-before-ask or notice-freeze-withheld; tasks.md:10-11 require those values and their Verify commands check them, and tasks.md:17 repeats them in F1. Change: Add all four outcomes and their precise meanings to the fixed set, or consistently use existing outcomes in the rows and Verify commands.
