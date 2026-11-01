# Proposal

## Why

Plan review of `omp-gated` changes does not converge: the 13 archived changes took 144 rounds (median 10, range 4-22; class-`none` instruction changes still 9-10), each round three `plan-reviewer` lenses on `gpt-6.1-terra:medium`. In `runs/evo-deleg/plan-review-experiment.json` 85 of 106 later-round blockers were already latent in round 1 and per-reviewer recall was 0.19-0.43, so every fresh round draws another slice instead of confirming the plan. OKAY needs every lens to find nothing, and an unproven or unclear finding blocks, so no round count ends the loop short of a user Stop. The final gate catches little (0-3 blockers per record, 2 overrides in 13), so the cost sits in plan review.

## What Changes

- **BREAKING** (review workflow): plan-review depth follows the change's risk. `standard` (Mandatory class `none`, no review, gate or release mechanism changed): one `plan-reviewer` covering all review scopes, one round, plus one fix-delta check when fixes were made. `risky` (class not `none`, or the change alters a review, gate or release mechanism): two reviewers with split scopes (correctness and security; verification and tests), at most two rounds. Changes too small for OpenSpec keep going to plan mode, as the `openspec` skill already routes them.
- Plan reviewers run on `onara/cx/gpt-6.1-sol:high` through a seeded `task.agentModelOverrides.plan-reviewer` entry; the new verifier pins `onara/cx/gpt-6.1-sol:medium` in its agent definition.
- Evidence-gated blockers: after every round a new `blocker-verifier` agent checks each blocking finding against the repository. A finding blocks only when the verifier confirms a concrete failure scenario, repository or plan evidence, why the plan's criteria and Verify commands would not catch it, and that it meets the existing blocking threshold. Refuted or below-threshold findings become residuals recorded in `review.md` and do not block apply.
- Good-enough exit without a per-round user decision: confirmed blockers are fixed within the budget; the user is asked only when a security or protected-asset finding is not confirmed, when the verifier cannot decide a finding that claims blocking damage, when the budget is spent with confirmed blockers open, or when a fix needs a scope decision.
- **BREAKING**: plan review no longer uses Accept eligibility, the early per-blocker ask, the approach question (Continue, Re-plan, Split, Stop) or the three fixed lenses. `gate.md` gains a `Depth` bullet that `validate-openspec-change.mjs` checks against the class; `review.md` keeps its validated fields and gains an `Awaiting` bullet and a `## Residuals` section, and `--reviewed` refuses a class-bearing round with fewer than two reviewers; Override remains the user's acceptance at budget exhaustion.
- Post-implementation lanes (F1, F2, F3, delta reviews, gate record, trailers, `Blocker disposition` for those lanes) keep their decisions; F2 delta reviews dispatch `plan-reviewer` and so resolve to its new model too.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-plan-review`: depth by risk, pinned reviewer model, verifier triage with residuals, per-depth budget with one delta check, user escalation only on named exceptions; removes three lenses, early ask, approach question, Re-plan and Split.
- `review-blocker-disposition`: the shared disposition definition no longer governs plan review; it keeps governing F2, F3 and delta reviews.

## Impact

- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` (review instruction), `templates/review.md` and `templates/gate.md` (new `Depth` bullet).
- `validate-openspec-change.mjs`: refuses a `gate.md` Depth other than `standard`/`risky` or `standard` with a class; `--reviewed` refuses a Round 1 or 2 record with fewer than two reviewer ids for a `risky` or class-bearing change. Its tests and `install-openspec-workflow.test.ts` (template placeholders) change with it.
- New agent definition `team-config/agent/agents/blocker-verifier.md`.
- `team-config/seed/config.yml`: `task.agentModelOverrides.plan-reviewer`; existing agent directories merge it by hand.
- `team-config/agent/skills/review-work/SKILL.md` (`Blocker disposition` lane list and accept paths) and `team-config/README.md` (review section).
- `openspec/specs/openspec-plan-review`, `openspec/specs/review-blocker-disposition` through this change's deltas.
- Installed copies: `scripts/deploy-local.sh` for this agent directory; repositories with their own `omp-gated` copy (onara, weaver) rerun `install-openspec-workflow.mjs`.
- Unchanged: the bundled `plan-reviewer` prompt, `validate-gate-record.mjs`, `gate-convergence.mjs`.
