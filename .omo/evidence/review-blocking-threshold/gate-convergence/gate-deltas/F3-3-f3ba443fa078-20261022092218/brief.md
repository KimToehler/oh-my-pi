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
    Negative control: the dev-env duplicate-key defect returns PASS or OKAY with the defect named as a note on all four paths
    Observable: reviewer verdict and classification in the stored transcripts
    Boundary: installed auditor, oracle and integration-review briefs, and plan-reviewer from the worktree source
Fix entries this delta implements, verbatim from the plan's ## TODOs:
3. F1 row 15 (unsupported-variant gap, decided by Tim: not blocking, must still be reported): in the shared blocking threshold, after the sentence ending "racing manual runs) is not one.", insert "A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker." at all four sites (review-work SKILL.md both briefs, integration-review SKILL.md, plan-reviewer.md `<decision>`), and the matching clause in auditor.md line 17. Re-run all 8 probes; expected below: PASS/OKAY with the `export` gap named as a note.
Commit range ee9042b8249c3087b4d933df35cd9ef8b24fee5f..f3ba443fa0788a3bede14c645ada615e01e84ceb, commits f3ba443fa0788a3bede14c645ada615e01e84ceb.
The diff is one patch file per commit, in commit order, each with its commit header. Read /Users/tim/git/oh-my-pi/.worktrees/review-blocking-threshold/.omo/gate-deltas/F3-3-f3ba443fa078-20261022092218/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.