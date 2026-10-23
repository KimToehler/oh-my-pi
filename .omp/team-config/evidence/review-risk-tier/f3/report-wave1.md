## Must-fix

Blocker B1: **Invalidated runtime evidence is reported as passing** — `.omo/evidence/review-risk-tier/runtime-inventory.txt:27-31` records `FAIL post-A-vs-C-one-file 6`, while `qa-matrix.md:13,16-19` marks the inventory and affected model trials PASS. The approved verification contract requires the branch and control directories to differ only in the process rule, says to check the same identities afterward, and classifies affected rows as INFRA on mismatch. Thus the recorded PROCESS 5 positive witness and control cannot count toward the merge-gate criterion as currently evidenced. The evidence can be regenerated; no irreversible damage is shown.  
**Fix:** Report the affected trials as INFRA and repeat Verification 5 with an inventory that satisfies the approved contract, including its post-run check.  
**class:** Scoring a trial despite a failed prerequisite.  
**sites:** The runtime inventory and QA matrix lines above. Search run: `functions.grep` over `.omo/evidence/review-risk-tier` for `post-A-vs-C|runtime inventory|A-vs-C|MODEL|INFRA`.

## Should-fix

- **Overbroad tier guidance** — `team-config/agent/rules/lesson-size-gate-to-audience.md:34` directs all dev, CI, or proof tooling in a product repo to declare `internal-tooling`, whereas `plan-merge-gate.md:48-51` limits that tier to tooling that reaches no protected asset. This can steer a production-deployment or credential-handling CI plan toward the wrong declaration before PROCESS 5 catches it. **Fix:** Add the protected-asset and product-gate exclusions to the lesson’s bullet and description. This is a note because the plan explicitly accepts misclassification detection as a judgment-dependent residual risk.  
  **class:** Inconsistent tier eligibility guidance. **sites:** The lesson’s description and line 34; the contrasting contract is in `plan-merge-gate.md:45-51`, `plan-review-process.md:17`, and `review-work/SKILL.md:102`. Search run: `functions.grep` over the worktree for `Dev, CI, or proof tooling|internal-tooling.*protected asset|PROCESS 5, risk tier`.

- **Snapshot names are shared between plans** — `team-config/agent/skills/review-work/scripts/gate-convergence.mjs:332-340` names copies and snapshots only by lane and wave, not plan. Two plans at the same lane and wave in one checkout can overwrite each other’s pinned artifacts; the digest check ordinarily refuses the displaced wave rather than recording it. **Fix:** Include a stable plan-key digest or a unique dispatch identifier in both artifact names. This is non-blocking under the supplied threshold because it requires overlapping local gate runs and the resulting interruption is reversible.  
  **class:** Cross-plan artifact namespace collision. **sites:** Snapshot JSON and pinned-plan filenames at lines 333-334. Search run: `functions.grep` over `team-config` for `gate-deltas|plan_copy|GC snapshot|risk_tier_change`.

## Nit

None.

## Checked

- **Duplication across slices/files:** No problematic duplicate parser found; the validator and convergence script consume the shared module.
- **Naming inconsistency:** Compared *risk tier*, *plan copy*, and *wave* across scripts and skills; no inconsistent naming instance found.
- **Uneven API surface:** No instance found in the changed interfaces.
- **Mixed conventions:** No implementation-convention instance found; the lesson’s inconsistent eligibility guidance is reported above.
- **Missing abstractions:** No additional abstraction justified across the changed consumers.
- **Dead code:** Searched the new parser exports and their consumers; no unused new helper found.
- **Doc drift:** The unconditional tooling-tier lesson conflicts with the protected-asset qualification, as reported above.
- **Surprise scope:** The changed-file inventory matches the planned scripts, tests, skills, rules, extension comment, and tracked plan; no unrelated implementation found.
- **Plan walks:** The bundled plan-reviewer prompt and OpenSpec folder support were not changed. Pre-change records, ledgers, and snapshots are excluded from blocking; legacy snapshots are deliberately refused. No i18n keys were added. RED and smoke artifacts exist; the suite result is reported in the QA matrix but its underlying suite output was not available in the evidence directory. Verification 5 has the failed prerequisite reported in B1. Post-merge installation is necessarily pending.
- **Seams:** Traced the shared parser into both consumers; tier validation and reviewer-set checks; ledger tier binding, cap and retier; snapshot line order and plan digest checks; and the skill/rule vocabulary and credential definitions. The runtime proof and guidance discrepancies are reported above.
- **Simplification pass:** No cross-slice simplification candidate beyond the snapshot namespace change reported above.

FAIL
