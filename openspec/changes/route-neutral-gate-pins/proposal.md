# Proposal

## Why

The pin checks of the plan review, the architecture consultation and the F2 merge gate compare the full `provider/model` a dispatch ran on with the pin. A team member who reaches the pinned model through a direct subscription (`openai-codex/gpt-6.1-sol`, `anthropic/claude-fable-5-2`) instead of the team router cannot get a counted consultation or F2 verdict at all: the consultation check accepts only the definition's `onara/cc/claude-fable-5-2`, and the gate refuses any `auditor` override that differs from `onara/cx/gpt-6.1-sol:high`, although the weights are the same.

## What Changes

- Every pin check compares the model name: the last `/` segment of `provider/model`, without the effort suffix. A turn on `openai-codex/gpt-6.1-sol` and one on `onara/cx/gpt-6.1-sol` both match a `gpt-6.1-sol` pin; a turn on `onara/cc/claude-opus-5` still does not. The effort check on `auditor` dispatches is unchanged.
- The checks that change: `validate-openspec-change.mjs --consultation-report` (code), the plan-review pin instruction in the `omp-gated` schema, and the `review-work` Phase 3 model check (instruction text), including its pre-dispatch override conflict check, which now compares model name and effort.
- An F2 trailer's `model_id` must equal the exact `provider/model` its session ran on, so the committed gate record names the route that actually served the verdict.
- The pins stay as they are (`onara/cx/gpt-6.1-sol:high` and `:medium`, `onara/cc/claude-fable-5-2:high`): no member's route or billing changes. A member without the router sets `task.agentModelOverrides` entries for the four agents on their own provider; the README lists them.
- Records keep the full `provider/model` each dispatch ran on (`- **Models**:` in `review.md` and `consultation.md`, `model_id` in trailers).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-plan-review`: a dispatch counts when its turns ran on the pinned model name through any provider.
- `plan-architecture-consultation`: the report check accepts any provider serving the definition's model name.
- `post-implementation-review`: an `auditor` dispatch counts when its turns ran on the pinned model name at the pinned effort through any provider, an override with the same model name and effort no longer stops the gate, and the trailer's `model_id` equals the session's `provider/model`.

## Impact

- `team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` and its test; a new `scripts/model-name.mjs` (shared by both validators and run by the two instruction checks) with its test, added to `test:team-config` in `package.json`.
- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` (review instruction), `team-config/agent/skills/review-work/SKILL.md` (Phase 3 model check), `team-config/README.md` (route-neutral checks, overrides for members without the router).
- No change to agent definitions, `seed/config.yml` or `seed/models.yml`.
