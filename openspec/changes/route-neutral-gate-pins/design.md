# Design

## Context

See proposal.md for motivation. Four agents carry a pin: `auditor` (`onara/cx/gpt-6.1-sol:high`), `blocker-verifier` (`onara/cx/gpt-6.1-sol:medium`) and `architecture-oracle` (`onara/cc/claude-fable-5-2:high`) in their definitions, and `plan-reviewer` (`onara/cx/gpt-6.1-sol:high`) in the seed's `task.agentModelOverrides`. Three checks compare a dispatch's turns with the pin:

- `validate-openspec-change.mjs --consultation-report` (code): `${turn.provider}/${turn.model}` must equal the definition's model with the effort stripped (`validate-openspec-change.mjs:617-620`). An override never counts as the pin.
- The plan-review instruction in `schema.yaml:563-575`: provider and model of every turn against the pin, the override first, else the definition, without the effort suffix.
- The `review-work` Phase 3 model check (`SKILL.md:348-351`): before dispatch, an `auditor` override that differs from `auditor.md` in model or effort stops the gate; after it, provider, model and `thinking_level_change` of every turn against `auditor.md`, plus the trailer's `model_id` against the pin's model.

So a member without the router can pass the plan review with provider-prefixed overrides, but never the consultation or F2; and a bare override (`gpt-6.1-sol:high`) fails every check, because the runtime records the provider that served it.

How the runtime resolves a selector (`resolveModelOverride`, `packages/coding-agent/src/config/model-resolver.ts:1696`): a `provider/id` selector resolves to that provider. A bare id first matches every authenticated model whose id equals it, and ranks several by usage and `modelProviderOrder`; the router's ids are `cx/gpt-6.1-sol` and `cc/claude-fable-5-2`, so the router is reached only when no exact carrier is authenticated. The bundled catalog lists `gpt-6.1-sol` for `azure`, `commandcode`, `github-copilot`, `openai`, `openai-codex` and `opencode-zen`, and `claude-fable-5-2` for `anthropic`, `commandcode`, `opencode-zen` and `venice` (probe of `ModelRegistry.getAll()` on this branch's base); API-key providers authenticate from the environment.

The record validator already reduces model IDs to a name for independence: `bareModelName` (`validate-gate-record.mjs:184-186`) takes the last `/` segment, drops a `:` suffix and lowercases.

## Goals / Non-Goals

**Goals:**
- One rule for "same model" in every pin check: equal model names, provider ignored.
- A member without the router reaches every review with overrides alone, provider-prefixed or bare.
- No member's route or billing changes.

**Non-Goals:**
- Changing the pins, the seed or the agent definitions (D3).
- Changing which effort is checked, how retries or INCONCLUSIVE work, or what `validate-gate-record.mjs` compares (`trailer.model_id` against `resolution.model` stays exact).
- The `measurement-*` experiment agents in `~/.omp/agents/` and the generic `oracle` agent (`@oracle` role).

## Decisions

### D1: The model name is the last `/` segment without the effort suffix

`onara/cx/gpt-6.1-sol` -> `gpt-6.1-sol`; `openai-codex/gpt-6.1-sol` -> `gpt-6.1-sol`; `gpt-6.1-sol:high` -> `gpt-6.1-sol`. This is exactly `bareModelName`, which the record validator already uses, so the gate already treats these as one model.

Alternatives: (a) exact `provider/model` equality, today's rule, which is the defect; (b) vendor-level equality (`modelVendor`), too loose: it would accept `claude-opus-5-5` for a `claude-fable-5-2` pin; (c) catalog identity from `@oh-my-pi/pi-catalog` `classifyModel`, which knows aliases, but the review-work scripts run on Node builtins only and are installed without the workspace packages, and the two instruction-only checks cannot call it.

### D2: One shared helper module for the scripts and the instructions

`bareModelName` moves from `validate-gate-record.mjs` into a new `scripts/model-name.mjs`; both validators import it. `validate-gate-record.mjs` already imports `validate-openspec-change.mjs`, so importing the other way would be circular, and a second copy would be a duplicate contract. The consultation check becomes `bareModelName(\`${turn.provider}/${turn.model}\`) === bareModelName(definitionModel)`; its error keeps the full `provider/model` that ran.

The two instruction checks (plan review, F2 Phase 3) consume the same function instead of restating it: run as a script, `node ~/.omp/agent/skills/review-work/scripts/model-name.mjs <selector>...` prints `bareModelName` of each argument, one per line, and exits 2 without arguments. The instructions pipe the session file's `provider/model` list through it and compare the distinct names with its output for the pin. Both instructions already run the review-work scripts from the installed skill (`schema.yaml:357`, `SKILL.md:6`), so the installed copy is the one rule everywhere. The entry check reuses `validate-openspec-change.mjs`'s realpath comparison (`:869-870`), so a symlinked agent directory still runs it.

### D3: The pins keep their router prefix (user decision)

User decided: keep the provider-prefixed pins and change only the checks; reason: no member's route or billing should change. The rejected alternative named the pins without a provider. With the resolution rule above, a bare pin would leave the router on every installation that authenticates any exact-id carrier, a stray `OPENAI_API_KEY` or a Copilot login included, at list price and without a configured `retry.fallbackChains` entry; and existing installations would end up mixed, since the seed's `plan-reviewer` entry reaches only new ones. The checks and the pins can ship separately: under the name rule a member without the router sets four overrides (README), and they count.

### D4: The F2 trailer stays bound to the session route

Phase 3 compares the session's turns by model name, but the trailer's `model_id` must equal the session's one `provider/model` exactly. `resolution.model` in the gate record is taken from the trailer (`SKILL.md:147`), and `validate-gate-record.mjs:452-453` checks only trailer against record, so a name-only trailer check would let the committed record name a route the session never used. A dispatch whose turns span two `provider/model` values does not count, as today.

### D5: No migration

Nothing in the agent directory changes besides the skill, schema and scripts that `deploy-local.sh` syncs. Existing `config.yml` entries keep resolving and counting as before.

### Build vs. adopt

None: the change introduces no mechanism the `Build vs. adopt` paragraph covers. Normalizing a model selector to its name is project-specific glue between the runtime's session records and the review-work checks, and it reuses the existing `bareModelName`.

## Risks / Trade-offs

- [Two providers could serve different weights under one name, e.g. a local alias] -> accepted residual: every provider in use serves the vendor's model under the vendor's name; `- **Models**:` and the trailer keep the full `provider/model`.
- [A member who sets a bare override gets whichever exact-id carrier the runtime picks, API-key providers included] -> README says so and recommends provider-prefixed overrides.
- [Through `onara`, RTK compresses large tool results; through a direct provider it does not] -> accepted: the review counts the model, not the transport; the record shows the route.

## Migration Plan

Deploy with `scripts/deploy-local.sh <sha>`; skill, schema and scripts are synced into the agent directory. Running sessions must restart. Rollback is a revert of the commit; stored `review.md`, `consultation.md` and gate records are never re-checked against a pin, so records written in between stay valid.
