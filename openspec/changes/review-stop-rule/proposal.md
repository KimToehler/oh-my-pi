# Proposal

## Why

The end-to-end measurement of 22 gated changes (`runs/gate-e2e-20261029/RESULT.md`) found that 61 of 211 plan-review rounds (29%) rejected after the reviewers had stopped finding consumer-visible product defects: 20.3 of 115.6 reviewer service hours, plus the orchestrator's fix work per round. Only 26% of plan-review blockers were judged consumer-visible, against 56–93% for the post-implementation lanes. The rounds do not end because the plan is wrong; they end when the orchestrator stops answering process-internal blockers with new plan surface.

## What Changes

- A blocker's disposition follows the existing blocking threshold. A blocker that misses both of its limbs — no broken goal, value proof, merge-gate criterion or existing consumer, and no protected asset in its path — is eligible to be recorded as an accepted residual risk, unless an exclusion applies. Security and privacy blockers, every blocker from a security lens or a `security_delta: yes` trailer, blockers on a change with a mandatory class, and blockers about a review, gate or release mechanism are never eligible, whatever their immediate observer is. A label, lens or wording never makes a blocker eligible.
- A blocker with no stated consequence, an ambiguous one, and any round with a lens that returned no verdict are handled as blocking.
- A fix for an eligible blocker never adds a mechanism, script, procedure or check the proposal did not ask for: it goes to the user as Accept, or becomes its own plan. A blocker that is not eligible is fixed with whatever the correct fix needs.
- Every path that leaves a blocker unfixed (plan-review Accept and Override, F2 and F3 freeze, delta accept) recommends and offers that only when every blocker it leaves is eligible. The user may still explicitly accept a non-eligible blocker; their reason and the blocker's stated consequence are then recorded in that path's existing record.
- The user decision moves earlier, in plan review only: the `omp-gated` review instruction asks at the first complete round whose open blockers are all eligible, instead of after the third REJECT. F2, F3 and delta waves keep their convergence decisions and their existing records (`downgrades`, the F3 report follow-up list, `GC accept`).
- Between waves, a commit is exempt from delta review only when every changed line is a comment or prose that no brief, plan bundle, criterion, agent-loaded instruction or build, lint, codegen or doc generator reads, and no changed comment carries a compiler, linter or build directive.
- No validator, record schema, ledger, script or CLI behaviour changes. The shipped instruction text changes.

## Capabilities

### New Capabilities
- `review-blocker-disposition`: which reviewer blockers must be fixed before a gate or review proceeds, which may be recorded as accepted residual risks, and which commits between waves need no review.

### Modified Capabilities
- `openspec-plan-review`: the round's disposition and the point at which the user is asked.

## Impact

- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` (review instruction), `team-config/agent/skills/review-work/SKILL.md` (F2 fix waves and delta reviews) and `team-config/agent/skills/integration-review/SKILL.md` (F3 Step 4 freeze decision).
- Installed through the existing team-config installer; projects holding their own copy of the schema are re-installed with `install-openspec-workflow.mjs`; running sessions load the new text after a restart.
- Out of scope, each its own plan if wanted: admitting the human-readable gate summary into the record's evidence directory (needs `validate-gate-record.mjs` and the v3 record), and a delta-review path for a commit after the final verdict.
