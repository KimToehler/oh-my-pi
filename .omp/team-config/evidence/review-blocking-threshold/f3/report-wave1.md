## Must-fix

Blocker B1: **High — duplicate narrative IDs can hide a blocker.** At `team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:502`, two distinct `Blocker B1:` findings are collapsed into one ID by `Set`; a trailer listing `B1` and one downgrade then satisfy reconciliation. The trigger is an ordinary reviewer numbering mistake, and the precondition is an override over that FAIL: one unfixed finding can escape the plan’s required per-blocker accounting. The record can be corrected by re-dispatching the reviewer, but a merge made from the incomplete record may not be reversible. **Fix:** reject repeated narrative blocker IDs before converting them to a set, and test two distinct narrative lines bearing the same ID.  
**class:** duplicate blocker identity loses findings. **sites:** `reconcileBlockers` at the path above; tree-wide `functions.grep` search: `NARRATIVE_BLOCKER|narrative\.flatMap|repeats a blocker id|Blocker B<n>`.

Blocker B2: **High — an INCONCLUSIVE review can still validate as an override.** `team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:797,863-867` accepts `INCONCLUSIVE` with an override and requires no downgrades when there is no FAIL; `team-config/agent/skills/review-work/SKILL.md:462` also says such an override is allowed, contrary to the new Phase 4 contract at line 339. The trigger is a reviewer returning an INCONCLUSIVE trailer during an otherwise valid gate record; the validator can return `overridden` and exit zero without the required completed review. Re-review can correct the record, but a merge made on the incomplete review may not be reversible. **Fix:** reject INCONCLUSIVE verdicts in an override, align Phase 5 prose with Phase 4, and add negative coverage for both an INCONCLUSIVE-only record and a mixed FAIL/INCONCLUSIVE record.  
**class:** incomplete-review override accepted. **sites:** validator and skill lines above; tree-wide `functions.grep` search: `override.{0,100}INCONCLUSIVE|INCONCLUSIVE.{0,100}override|PASS", "FAIL", "INCONCLUSIVE"`.

## Should-fix

None.

## Nit

None.

## Checked

- **Duplication across slices/files:** the threshold paragraph is deliberately repeated across reviewer briefs; no unintended duplicate helper found.
- **Naming inconsistency:** `blocker`, `downgrade`, and `override` are consistent across the inspected contracts; no instance found.
- **Uneven API surface:** no instance found apart from the override contract mismatch in B2.
- **Mixed conventions:** no instance found apart from B2.
- **Missing or premature abstractions:** no cross-slice candidate found.
- **Dead code:** the new reconciliation and downgrade helpers are called by the validator; no instance found.
- **Doc drift:** Phase 4 and Phase 5 disagree about INCONCLUSIVE overrides; reported as B2.
- **Surprise scope and plan walks:** the changed-file inventory matches the planned validator, fixtures, tests, reviewer prompts, and rules. No Risk tier, fix-round cap, or mandatory-class narrowing implementation was found in the supplied diff. No i18n keys were introduced.
- **Verification checklist:** the stored RED evidence reports 14 failures; the stored team-config and bundled-agent outputs report zero failures. Real-surface verification is **not yet established**: the stored below fixture differs from the approved fixture, `audit-below.out.txt` is FAIL, and `plan-below.out.txt` does not name the specified duplicate-key defect. The stored trailer-validation evidence’s below case uses a FAIL override rather than the planned PASS without override. F1 remains necessary after F3.
- **Seams:** checked blocker-line parsing and trailer IDs, downgrade rules and dispositions, threshold wording, and gate outcome prose. B1 and B2 identify the blocking gaps.
- **Simplification pass:** no additional candidate found.

FAIL