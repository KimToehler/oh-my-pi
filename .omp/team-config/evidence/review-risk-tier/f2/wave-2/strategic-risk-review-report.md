Bottom line: The shared parser, one-way tier transition, and pinned-plan wave checks are architecturally coherent, but the re-tier transition does not invalidate reviews performed against the old plan bytes. This leaves a blocking path where a product-tier gate can be finalized from an internal-tooling review.

## Answers

1. **Architecture:** Mostly sound. `plan-contract.mjs:67-87` centralizes tier parsing; `gate-convergence.mjs:146-164` binds the ledger tier to the current plan; and `gate-convergence.mjs:324-372,469-510` pins and verifies plan bytes during each wave. The missing seam is between `retier` and final-record validation: the state machine records the tier transition but does not record that all earlier review waves are now stale.

2. **What the line-level audit missed:** The cross-phase lifecycle after a successful or stopped internal-tooling wave.

   Blocker B1: **High — re-tiering does not require a post-transition review before freeze or final validation.** The normal trigger is an internal-tooling gate being changed to product after an F2 or F3 wave, followed by freeze or final-record creation without another wave. `retier` only appends `risk_tier_change` (`gate-convergence.mjs:582-593`); `readyReasons` does not treat that event as invalidating earlier waves (`gate-convergence.mjs:177-210`); and `decide` still permits freeze once the state reads as product (`gate-convergence.mjs:564-580`). The final validator binds `plan_sha256` to the current plan but has no ledger or wave binding (`validate-gate-record.mjs:640-646`), while a product plan with `Mandatory class: none` may retain only the old implementation audit (`validate-gate-record.mjs:704-716`). Consequently, [INFERENCE] an operator can hash the new product plan and reuse a trailer produced from the old internal-tooling plan, despite `review-work/SKILL.md:102` explicitly requiring “reclassify, and review again.” The impact is a product plan finalized with stale plan input and potentially reduced review depth; correcting the gate metadata is reversible, but a product change admitted under that stale review may not be. **class:** post-retier review-state invalidation. **sites:** `team-config/agent/skills/review-work/scripts/gate-convergence.mjs:177-210,560-593`; `team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:640-646,704-716`; `team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs:402-414`; `team-config/agent/skills/review-work/SKILL.md:102`. Searches run across `team-config/agent`: `GC (snapshot|retier|exempt)|gate-convergence\.mjs|PLAN <path>|delta_exemption` and `Risk tier|risk_tier|riskTier|readRiskTier`; validator search: `ledger|gate_wave|risk_tier_change|plan_sha256`.

3. **Highest-consequence failure:** A product or product-gating change receives a record based on the earlier internal-tooling review. In-wave source changes and stale snapshots are handled, but post-wave re-tiering is not; therefore this failure mode is not fully addressed.

4. **Auditor finding:** On the supplied review snapshot, the auditor’s final-head evidence finding is not a false positive on unchanged behavior. The snapshot producer and consuming skill prose changed after the installed-workflow trial, while the supplied QA matrix only reran focused convergence evidence; that is an integration-evidence gap rather than a claim that unchanged code regressed.

## Action plan

1. Make `risk_tier_change` invalidate every earlier wave in each started lane until a later wave records the current plan digest and product tier.
2. Bind final validation to that post-retier state—either through ledger-backed wave checks or an equivalent reviewer-input digest that cannot be recomputed without re-review.
3. Add negative controls for both paths: retier after PASS and retier after STOP followed by freeze must fail without a new wave; retier followed by a product-tier wave must pass.

**Effort:** Medium (1–2d)

**Confidence:** High.

**Watch out for:** Re-tiering after F3 but before F2 must stale F3 as well; fixing only the F2 final-record path leaves the whole-diff review bound to the old plan.

FAIL

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: A tier transition must make every reviewer verdict produced from the prior plan bytes unusable as final proof until the affected lanes review the current plan.
  positive_witness: After an internal-tooling-to-product transition, a new wave records the current plan digest and the final validator accepts only verdicts bound to that post-transition review.
  negative_control: An internal-tooling wave passes or stops, the plan is re-tiered to product, and freeze or final validation is attempted without another wave.
  observable: Ledger event ordering and plan digests show a post-retier wave, while the negative control exits nonzero before a gate record can validate.
  boundary: gate-convergence retier and wave state through validate-gate-record final-record admission.
END-REVIEW-TRAILER
