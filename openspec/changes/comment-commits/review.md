# Review

- **Verdict**: REJECT
- **Reviewed digest**: e5029bbf5703acdee8b9a5c8c2ba389c4bd1fab0a6e2d4466a6d4908cde5bed8
- **Reviewer**: plan-reviewer, CCCorrectness4, CCVerification4, CCChecks4
- **Round**: 4
- **Override**: none

## Blockers

### Verification (CCVerification4)

[
  {
    "area": "Quality and verification — task 1.2 and F1",
    "defect": "The post-verdict directive replays do not verify that either the new branch commit or the follow-up actually receives a gate. An instruction can satisfy all checked clauses while omitting the new wave after PASS or explicitly allowing the follow-up after freeze to land without review. A normal suppression needed after a final verdict could then escape the review required by the specification; the instruction change is reversible, but what it permits may already have shipped.",
    "evidence": "specs/gate-comment-commits/spec.md:62-77 requires a new wave after PASS, a separately gated follow-up after freeze, and a negative control for an unreviewed default-branch commit. tasks.md:5 and tasks.md:15 check K7 only through “commit it on the branch” and K10 only through “becomes a follow-up change after the merge, never a commit on the frozen branch”; the corresponding rows assert only `code-on-branch` and `follow-up`. The built-in mutations delete K7 or redirect K10 to the frozen branch, but do not remove the new-wave requirement or allow an ungated follow-up. Task 2.1 repeats the same checker.",
    "change": "Bind the PASS replay to an explicit instruction that a new gate wave must pass before merge, and the freeze replay to an explicitly gated follow-up. Add negative mutations for omitting the new wave and for allowing the follow-up to land without review."
  }
]
