## Must-fix

Blocker B1: **Standard-tier smoke evidence cannot be committed in the documented F2 wave without invalidating its snapshot** — `team-config/agent/skills/review-work/SKILL.md:158,404-409`; `team-config/agent/skills/review-work/scripts/gate-convergence.mjs:151-170,296-309,400-410,442-443`. **Trigger and precondition:** an orchestrator follows the documented standard-folder workflow, taking the F2 snapshot before Phase 1, then capturing and committing the required smoke log before dispatch. The commit changes `HEAD`, so `GC wave` rejects the snapshot; taking a new snapshot instead encounters an unreviewed post-baseline commit. **Impact:** the normal end-to-end standard-tier wave cannot be recorded as instructed, breaking the folder-workflow goal and F1 scenario 5. The damage is reversible by reorganizing the evidence and review sequence, but the prescribed flow is blocked. **Fix:** define a sequence that captures and commits smoke evidence before the applicable baseline/snapshot, including when F3 has already established the baseline, or explicitly make convergence handle that evidence commit without weakening its reviewed-state binding. Add an end-to-end test covering the actual ordering.  
**class:** smoke-evidence and convergence ordering conflict. **sites:** `review-work/SKILL.md:158,404-409` and `gate-convergence.mjs:151-170,296-309,400-410,442-443`. Whole-tree searches: `functions.grep` for `Before Phase 1|Until the wave is recorded|commit it before|GC baseline --sha HEAD|GC snapshot --lane F2` and for `snapshot|HEAD|head|baseline|changed|dirty` in `gate-convergence.mjs`.

## Should-fix

- `team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs:2122-2124` — The comment says smoke artifacts are pinned and may first be committed after `reviewed_sha`, contrary to the current implementation and immediately following tests. It does not block execution, but it describes the rejected design to future maintainers. **Fix:** replace or remove the stale comment and describe the committed-blob, non-exempt policy.  
  **class:** stale smoke-evidence design commentary. **sites:** the cited test comment; searches: `functions.grep` for `smoke:|smoke-<name>|--freeze-plan|GC snapshot` across `team-config`, and `smoke:|at most two|orchestrator|whole_diff\.reason|shasum -a 256 <plan>|review_tier` across `team-config/agent/skills/review-work`.

## Nit

None.

## Checked

- **Previous report closures:** The nondurable-evidence class is closed at its listed sites: the skill now prescribes an addable committed log, and the validator reads the blob at `reviewed_sha`; a fresh-clone test is present. The convergence-limit note is addressed by explicitly making the limit an orchestrator rule. The Whole-diff reason is compared and has a mismatch test. The prior hash/example documentation sites now distinguish folder plans and include `review_tier`. The new ordering conflict is B1 above.
- **Duplication across slices/files:** no actionable instance found; the test’s independently constructed bundle serves as an oracle.
- **Naming inconsistency:** no actionable instance found across *folder plan*, *bundle*, and *review tier*.
- **Uneven API surface:** no actionable instance found; file and folder plans intentionally have different inputs.
- **Mixed conventions:** the smoke-log commit sequence conflicts with the existing snapshot convention, as in B1.
- **Missing abstractions:** no actionable cross-slice abstraction candidate found.
- **Dead code:** searched the new snapshot, bundle, checker and smoke helpers; each has a production caller.
- **Doc drift:** the stale smoke-evidence test comment is noted above; the workflow ordering conflict is B1.
- **Surprise scope:** compared the supplied file list and patch with the plan. `folder-plan.mjs` is an additional helper implementing the planned snapshot; no implementation of the listed out-of-scope subsystems was identified.
- **Plan walks:** no i18n keys or locale changes appear. The plan has no per-slice “Files modified” lists beyond its scope inventory. The checked implementation rows do not by themselves prove their verification commands ran; the available `f1-3-plan-only.txt` records scenario 3, while the mechanical loop and remaining installed-surface scenarios were not established by the supplied evidence. F3, F1 and F2 remain unchecked in the plan.
- **Seams:** traced snapshot/bundle/digest and pinning; the pure checker and CLI file selection; convergence’s folder key; classification and its documentation; and the file-plan branch. File-plan compatibility still needs the plan’s mechanical evidence. The convergence/workflow seam has B1.
- **Simplification pass:** no additional actionable cross-slice simplification found.
- **Verification:** read-only review; no tests or commands were run.

FAIL