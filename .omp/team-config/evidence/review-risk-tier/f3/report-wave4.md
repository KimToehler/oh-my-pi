## Must-fix

Blocker B1: **Snapshot artifacts are not scoped to the plan** — `team-config/agent/skills/review-work/scripts/gate-convergence.mjs:331-357`. When a second plan is gated in the same checkout—for example, after a re-plan—the ledger correctly starts that plan at wave 1, but `snapshot` finds the first plan’s retained `F2-wave-1` or `F3-wave-1` files and refuses. This is ordinary sequential use, not a race: the new write-once check turns the shared filenames into a gate-workflow regression. The suggested recovery deletes the other plan’s artifacts; the interruption is reversible, but it prevents the new plan’s review from starting without that cleanup.  
**Fix:** Namespace both files by a stable digest of the plan key, and add a test that records a wave for one plan before snapshotting a different plan in the same repository.  
**class:** Cross-plan artifact namespace collision. **sites:** Both lane/wave artifact names at lines 333–334 and their shared refusal at lines 338–357. Search: `functions.grep` on the whole worktree for `gate-deltas|wave-\$\{wave\}|wave-\$\{n\}`, followed by `functions.grep` on `team-config/agent/skills/review-work/scripts/*.mjs` for `gate-deltas|snapshot.json|plan_copy`. This class was previously noted for overlapping runs; this delta also exposes it during sequential plans.

## Should-fix

- **Final verification checkboxes precede the evidence for this delta** — `.omo/plans/review-risk-tier.md`, final-verification lines changed by the supplied patch. The F1/F2 boxes are marked complete, but the supplied QA matrix identifies its full run as head `8e9b1a1…`, before this delta, and the available F2 strategic trailer is `FAIL`; the focused new test output does not establish the full final wave. **Fix:** Reconcile the checkboxes and SHA-bound evidence as the current review wave completes. This is a status/evidence note rather than a blocker on the delta: the final wave is still in progress.  
  **class:** Premature verification status. **sites:** F1 and F2 checkbox changes in the supplied patch; `qa-matrix.md:3` and `f2/strategic-risk-review-trailer.md:43-44`. Search: `functions.grep` on both F2 trailers for `^verdict:|^blockers:|Blocker B[0-9]+:|reviewed_sha|HEAD`, plus the evidence-directory listing and QA matrix.

- **`SECTION_PATTERN` remains an unused export** — `team-config/agent/skills/review-work/scripts/plan-contract.mjs:4`. It is consumed inside its defining module but has no external consumer; the approved plan explicitly requested the export, so it does not block. **Fix:** Make it module-private if that requirement is relaxed.  
  **class:** Unused exported surface. **Single instance:** The preceding wave-3 report records a tree-wide `functions.grep` search for `SECTION_PATTERN` and found no external consumer; this delta does not change that module.

## Nit

None.

## Checked

1. **Duplication across slices/files:** No problematic instance found in the delta.
2. **Naming inconsistency:** Checked *risk tier*, *plan copy*, and *wave* across the scripts and instructions; no instance found.
3. **Uneven API surface:** No instance found in the changed snapshot or trailer interfaces.
4. **Mixed conventions:** No problematic instance found; the cross-plan namespace issue is reported above.
5. **Missing or premature abstractions:** The unused `SECTION_PATTERN` export remains the one simplification note; no new repeated abstraction candidate found.
6. **Dead code:** No newly unused delta helper found; the prior unused-export note remains.
7. **Doc drift:** The restart instructions match the new refusal and name both artifacts; the final-verification status discrepancy is noted above.

- **Surprise scope and plan files:** The delta changes the tracked plan, the two named skills, convergence script, and its tests. No locale keys, OpenSpec-folder implementation, or bundled plan-reviewer prompt changes appear in the supplied file list.
- **Verification walk:** Reviewed the QA matrix, runtime inventory, focused test output, RED evidence, and snapshot smoke. The earlier failed-prerequisite and confounded-differential classes remain closed in the currently scored evidence: the inventory reports matching pre/post identities and the matrix describes the same repository and pinned copy for both trials. The matrix’s full-run SHA predates this delta; post-merge installation remains pending.
- **Seams:** Checked the parser and its consumers, validator tier contract, convergence snapshot and wave flow, output line order, restart instructions, trailer definitions, and tier/security vocabulary. The plan-namespace mismatch is B1.
- **Simplification pass:** No additional cross-slice candidate beyond the unused export and snapshot namespace fix above.

FAIL
