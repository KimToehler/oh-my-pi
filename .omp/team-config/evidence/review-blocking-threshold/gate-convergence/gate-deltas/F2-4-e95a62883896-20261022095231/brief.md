Review this fix delta. Workspace root: /Users/tim/git/oh-my-pi/.worktrees/review-blocking-threshold. Plan: /Users/tim/git/oh-my-pi/.worktrees/review-blocking-threshold/.omo/plans/review-blocking-threshold.md.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
- Accepted residual risks: reviewer judgement against the prose threshold is non-deterministic; Verification 3 samples each path once per fixture and cannot prove it for every finding
- Out of scope for blocking: Risk tier, fix-round caps and mandatory-class narrowing (plan B review-risk-tier); gate records already on main
- Feature-specific criteria:
  - Invariant: an override over a FAIL verdict validates only when every blocker id of each FAIL trailer has exactly one downgrades entry
    Positive witness: trailer blockers B1, B2 with narrative lines for both and entries for B1 and B2 exits 0
    Negative control: the same trailer with an entry only for B1 exits 1 naming blocker B2
    Observable: validator exit code and stderr
    Boundary: validateRecord in team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
  - Invariant: a FAIL trailer's blockers field equals the set of Blocker B<n> lines in the stored reply
    Positive witness: narrative Blocker B1 and Blocker B2 with trailer blockers B1, B2 validates
    Negative control: narrative Blocker B1 and B2 with trailer blockers B1 exits 1 naming B2
    Observable: validator exit code and stderr
    Boundary: validateTrailer in team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
  - Invariant: every gate reviewer path blocks an above-threshold defect and only notes a substantiated below-threshold one
    Positive witness: the tenant-check removal returns FAIL or REJECT with it as a blocker on all four paths
    Negative control: each of the four paths returns PASS or OKAY and names at least one substantiated local, reversible dev-env defect as a note or Should-fix (examples: an unhandled `export` assignment, a wrong working directory, a read failure collapsing into key absence); the paths need not name the same defect; plan-reviewer OKAY with a note on the existing-`.env` case counts (decided by Tim, 2026-10-22)
    Observable: reviewer verdict and classification in the stored transcripts
    Boundary: installed auditor, oracle and integration-review briefs, and plan-reviewer from the worktree source
Fix entries this delta implements, verbatim from the plan's ## TODOs:
4. F2 B1 (gate-outcome-contract): `team-config/agent/rules/merge-gate-proof.md` line 31: replace "If any line is not passed, say so at the top of the reply and do not ask for merge approval;" with "If any line is neither passed, overridden, nor legitimately skipped, say so at the top of the reply and do not ask for merge approval;". No test: prose rule, verified by the F2 re-review.
5. F2 B2 (criterion wording, decided by Tim 2026-10-22): the third feature-specific criterion's negative control reads "each of the four paths returns PASS or OKAY and names at least one substantiated local, reversible dev-env defect as a note or Should-fix (examples: an unhandled `export` assignment, a wrong working directory, a read failure collapsing into key absence); the paths need not name the same defect; plan-reviewer OKAY with a note on the existing-`.env` case counts (decided by Tim, 2026-10-22)". Plan re-hashed; F2 wave 2 runs both reviewers.
Commit range f3ba443fa0788a3bede14c645ada615e01e84ceb..e95a6288389629e29aa1b2f13dda8558fa457f87, commits e95a6288389629e29aa1b2f13dda8558fa457f87.
The diff is one patch file per commit, in commit order, each with its commit header. Read /Users/tim/git/oh-my-pi/.worktrees/review-blocking-threshold/.omo/gate-deltas/F2-4-e95a62883896-20261022095231/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.