# Proposal

## Why

The gate and plan-review agents are pinned to router selectors (`onara/cx/gpt-6.1-sol:high`, `onara/cc/claude-fable-5-2:high`), and every pin check compares the provider prefix too. A team member who reaches the same model through a direct subscription (`openai-codex/gpt-6.1-sol`, `anthropic/claude-fable-5-2`) can therefore never get a counted plan review, consultation or F2 verdict: every dispatch is refused as "another model", although the weights are the same.

## What Changes

- The pins name only the model and effort: `auditor` and `plan-reviewer` `gpt-6.1-sol:high`, `blocker-verifier` `gpt-6.1-sol:medium`, `architecture-oracle` `claude-fable-5-2:high`. omp resolves a bare pin to whichever provider the installation can reach (a direct subscription when present, the router otherwise).
- Every pin check compares the model name: the last `/` segment of `provider/model`, without the effort suffix. A turn on `openai-codex/gpt-6.1-sol` and one on `onara/cx/gpt-6.1-sol` both match the pin `gpt-6.1-sol`; a turn on `onara/cc/claude-opus-5` still does not. The effort check on `auditor` dispatches is unchanged.
- The checks that change: `validate-openspec-change.mjs --consultation-report` (code), the plan-review pin instruction in the `omp-gated` schema, and the `review-work` Phase 3 model check (instruction text).
- Records keep the full `provider/model` each dispatch ran on (`- **Models**:` in `review.md` and `consultation.md`, `model_id` in trailers), so evidence still shows which route served a verdict.
- Existing installations keep working: a provider-prefixed override such as `task.agentModelOverrides.plan-reviewer: onara/cx/gpt-6.1-sol:high` still resolves to the router and still matches the pin by model name.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-plan-review`: the seed pins `plan-reviewer` to a model without a provider, and a dispatch counts when its turns ran on the pinned model through any provider.
- `plan-architecture-consultation`: the `architecture-oracle` definition names its model without a provider, and the report check accepts any provider serving that model.
- `post-implementation-review`: an `auditor` dispatch counts when its turns ran on the pinned model at the pinned effort through any provider, and its trailer names that model.

## Impact

- `team-config/agent/agents/{auditor,blocker-verifier,architecture-oracle}.md` (model lines), `team-config/seed/config.yml` (`task.agentModelOverrides.plan-reviewer`).
- `team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` and its test; one shared model-name helper with `validate-gate-record.mjs`.
- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` (review instruction), `team-config/agent/skills/review-work/SKILL.md` (Phase 3 model check, independence note), `team-config/README.md` (pin paragraphs).
- Billing: a member with a direct subscription now runs these agents on it instead of the router.
