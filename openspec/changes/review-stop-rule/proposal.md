# Proposal

## Why

The end-to-end measurement of 22 gated changes (`runs/gate-e2e-20261029/RESULT.md`) found that 61 of 211 plan-review rounds (29%) rejected after the reviewers had stopped finding consumer-visible product defects: 20.3 of 115.6 reviewer service hours, plus the orchestrator's fix work per round. Only 26% of plan-review blockers were judged consumer-visible, against 56–93% for the post-implementation lanes. The rounds do not end because the plan is wrong; they end when the orchestrator stops answering process-internal blockers with new plan surface.

## What Changes

- A blocker's disposition follows its kind. A consumer-visible product defect is fixed. A blocker about verification depth, artifact wording or evidence mechanics is eligible to be recorded as an accepted residual risk once a complete round found no consumer-visible defect.
- A fix that would add a mechanism, script, procedure or check the proposal did not ask for is never implemented inside the plan under review: it goes to the user as Accept, or becomes its own plan.
- The user decision moves earlier: the `omp-gated` review instruction asks at the first complete round with no consumer-visible defect, instead of after the third REJECT.
- Between F2 fix waves, a commit that changes no behaviour and no review input is exempted rather than delta-reviewed; the existing "when in doubt, review" keeps its meaning for everything else.
- No validator, record schema, ledger, script or CLI behaviour changes. The shipped instruction text changes.

## Capabilities

### New Capabilities
- `review-blocker-disposition`: which reviewer blockers must be fixed before a gate or review proceeds, which may be recorded as accepted residual risks, and which commits between waves need no review.

### Modified Capabilities
- `openspec-plan-review`: the round's disposition and the point at which the user is asked.

## Impact

- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` (review instruction), `team-config/agent/skills/review-work/SKILL.md` (fix waves), `team-config/README.md`.
- Installed through the existing team-config installer; running sessions load the new text after a restart.
- Out of scope, each its own plan if wanted: admitting the human-readable gate summary into the record's evidence directory (needs `validate-gate-record.mjs` and the v3 record), and a delta-review path for a commit after the final verdict.
