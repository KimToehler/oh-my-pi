## Must-fix

None.

## Should-fix

- **Final verification status predates this delta** — `.omo/plans/review-risk-tier.md:440-442`. F1 remains checked, but the QA matrix identifies its full run as head `8e9b1a1…`, before the supplied delta; the focused convergence tests and later full-suite output do not establish that all required real-surface scenarios ran on the post-F3 head. This is a status note, not a blocker on this delta, because the verification wave is still in progress.  
  **Fix:** Reconcile F1 with the final-head evidence after this F3 round; leave it unchecked until the required scenarios have been rerun.  
  **class:** Premature verification status. **sites:** F1 at `.omo/plans/review-risk-tier.md:441` and the earlier-head evidence at `.omo/evidence/review-risk-tier/qa-matrix.md:3`. Search: `functions.grep` across the worktree for `snapshot\.json|\.plan\.md|delta_exemption|commitStates\(`, followed by reads of the plan delta and QA matrix.

## Nit

None.

## Checked

1. **Duplication across slices/files:** No instance found in this delta.
2. **Naming inconsistency:** Checked *plan key*, *snapshot*, and *exemption* across producer, tests, and instructions; no instance found.
3. **Uneven API surface:** No instance found in the changed command and ledger interfaces.
4. **Mixed conventions:** No instance found; exemptions use the existing gate-wide commit-state convention.
5. **Missing or premature abstractions:** No new instance found.
6. **Dead code:** No newly unused helper or event found; `delta_exemption` is written, validated, and consumed by commit-state evaluation.
7. **Doc drift:** The verification-status discrepancy is noted above; no other delta-specific instance found.

- **Wave-4 collision class:** Closed at both artifact-name sites: snapshot JSON and pinned plan copy share a prefix containing the plan-key digest. The regression test covers two plans in the same checkout and verifies the first plan’s artifacts remain intact; the recorded RED output shows the prior collision.
- **Surprise scope and plan:** The four changed files cover the plan, review-work instructions, convergence script, and its tests. The exemption is the explicitly approved scope addition. No out-of-scope legacy-ledger migration, OpenSpec-folder support, or bundled reviewer-prompt change appears in this delta; no i18n keys are added.
- **Verification walk:** Reviewed the QA matrix, focused suite output, full-suite output, and both new RED artifacts. The earlier verification matrix is tied to a pre-delta head; post-merge installation remains pending.
- **Seams:** Checked plan-key naming, snapshot/plan-copy pairing and stdout order, exemption event shape and gate-wide consumption, REJECT refusal, and the updated review-work instructions. The other tier, parser, validator, and cap seams are unchanged by this delta.
- **Simplification pass:** No additional cross-slice candidate found.

PASS
