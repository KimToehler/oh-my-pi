# Proposal

## Why

An OpenSpec plan review today is one `plan-reviewer` run per round, and a single run finds few of the defects the plan already has. In a replay of five real changes (2026-10-27, 106 blockers raised in rounds 2 and later), 85 of those blockers were already present in the round-1 plan, and one round-1 review found on average 13 % of them (`gpt-6.1-terra:medium`). Three reviews of the same round-1 plan, each restricted to one fixed part of the reviewer's scope (correctness, verification, the mechanical checks), found 32 %, at about three times the cost of one review (about $0.25 per round). Three repeats of the unrestricted review found fewer (13 of 85 against 23 of 85). The single-reviewer loop is why changes needed 11 to 27 review rounds.

## What Changes

- The `omp-gated` schema's `review` artifact dispatches one review round as three fresh `plan-reviewer` tasks in one batch. Each gets the existing fixed brief verbatim plus one fixed lens paragraph: correctness (review scope items 1 and 2), verification (items 3 and 5), checks (item 4, CHECK 1 to 8, the checks that rules loaded for the reviewer define, and the merge-gate `Boundary:` rule). The planner still adds nothing to any brief.
- A round is OKAY only when all three lenses return OKAY; otherwise it is REJECT with every rejecting lens's blockers, recorded verbatim per lens. A lens without a structured verdict gets one fresh retry; without a verdict after it, the round is incomplete and no review record is written.
- `review.md` lists every subagent of the round: `- **Reviewer**: plan-reviewer, <correctness id>, <verification id>, <checks id>`. `validate-openspec-change.mjs` accepts `plan-reviewer` followed by one or more distinct ids (a record from before this change, with one id, stays valid), refuses duplicate ids, and refuses an OKAY whose `## Blockers` section is neither `none` nor empty.
- The team-config README describes the three-lens round.

## Capabilities

### New Capabilities
- `openspec-plan-review`: how the `review` artifact of an `omp-gated` change runs its review rounds and what `review.md` must record for `--reviewed` to accept it.

### Modified Capabilities

## Impact

- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` (the `review` instruction) and `templates/review.md`.
- `team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` and its test; `install-openspec-workflow.test.ts`, which fills the review template.
- `team-config/README.md` (review section).
- The `plan-reviewer` agent definition, its model role, the fix-round limit, the per-blocker questions after a final REJECT, fix-delta reviews in review-work and plan-mode plan reviews are unchanged.
- A review round costs about three single reviews and takes as long as its slowest lens.
- Deployed copies pick the change up after `scripts/deploy-local.sh` (validator, canonical schema) and, in projects with their own schema copy (onara, weaver), after `install-openspec-workflow.mjs` runs there; until then those projects keep dispatching one reviewer, which the validator still accepts.
