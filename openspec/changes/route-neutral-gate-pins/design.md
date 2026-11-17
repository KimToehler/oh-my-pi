# Design

## Context

See proposal.md for motivation. Four agents carry a pin today: `auditor` (`onara/cx/gpt-6.1-sol:high`), `blocker-verifier` (`onara/cx/gpt-6.1-sol:medium`) and `architecture-oracle` (`onara/cc/claude-fable-5-2:high`) in their definitions, and `plan-reviewer` (`onara/cx/gpt-6.1-sol:high`) in the seed's `task.agentModelOverrides`. Three checks compare a dispatch's turns with the pin:

- `validate-openspec-change.mjs --consultation-report` (code): `${turn.provider}/${turn.model}` must equal the definition's model with the effort stripped (`validate-openspec-change.mjs:617-620`).
- The plan-review instruction in `schema.yaml:563-575`: provider and model of every turn against the pin, without the effort suffix.
- The `review-work` Phase 3 model check (`SKILL.md:348-351`): provider, model and `thinking_level_change` of every turn against `auditor.md`, plus the trailer's `model_id`.

The runtime resolves a pin through `resolveModelOverride` (`packages/coding-agent/src/config/model-resolver.ts:1696`) against the authenticated models. A probe of the four bare selectors (`gpt-6.1-sol:high`, `gpt-6.1-sol:medium`, `claude-fable-5-2:high`, `gpt-6.1-terra:medium`) gave: router only -> `onara/cx/...`, `onara/cc/...`; direct only -> `openai-codex/...`, `anthropic/...`; both -> the direct provider, also with `modelProviderOrder` putting `onara` first, because an exact id match beats the router's `cx/`/`cc/` prefixed id. The effort suffix survived in every case.

The record validator already reduces model IDs to a name for independence: `bareModelName` (`validate-gate-record.mjs:184-186`) takes the last `/` segment, drops a `:` suffix and lowercases.

## Goals / Non-Goals

**Goals:**
- One rule for "same model" in every pin check: equal model names, provider ignored.
- Pins that resolve on any installation that reaches the model, with no per-member configuration.

**Non-Goals:**
- Changing which effort is checked, how retries or INCONCLUSIVE work, or what `validate-gate-record.mjs` compares (`trailer.model_id` against `resolution.model` stays exact: both come from the same run).
- Steering bare pins to the router on installations that also have direct subscriptions (see Risks).
- The `measurement-*` experiment agents in `~/.omp/agents/` and the generic `oracle` agent (`@oracle` role).

## Decisions

### D1: The model name is the last `/` segment without the effort suffix

`onara/cx/gpt-6.1-sol` -> `gpt-6.1-sol`; `openai-codex/gpt-6.1-sol` -> `gpt-6.1-sol`; `gpt-6.1-sol:high` -> `gpt-6.1-sol`. This is exactly `bareModelName`, which the record validator has used since the independence check, so the gate already treats these as one model.

Alternatives: (a) exact `provider/model` equality, today's rule, which is the defect; (b) vendor-level equality (`modelVendor`), too loose: it would accept `claude-opus-5-5` for a `claude-fable-5-2` pin; (c) catalog identity from `@oh-my-pi/pi-catalog` `classifyModel`, which knows aliases, but the review-work scripts run on Node builtins only and are installed without the workspace packages, and the two instruction-only checks cannot call it.

### D2: One shared helper module for both scripts

`bareModelName` moves from `validate-gate-record.mjs` into a new `scripts/model-name.mjs`; both validators import it. `validate-gate-record.mjs` already imports `validate-openspec-change.mjs`, so importing the other way would be circular; and a second copy is the duplicate-contract defect the plan review rejects. The consultation check becomes `bareModelName(\`${turn.provider}/${turn.model}\`) === bareModelName(definitionModel)`. Its error text keeps the full `provider/model` that ran.

### D3: Pins and checks change together, in one cutover

A bare pin under today's exact checks refuses every dispatch, and a name-only check under today's prefixed pins changes nothing for direct subscribers. The agent definitions, seed override, consultation check and both instructions therefore land in one change: the parts cannot ship separately.

### D4: No migration of existing configs

`seed/config.yml` is copied only when missing. An existing `task.agentModelOverrides.plan-reviewer: onara/cx/gpt-6.1-sol:high` keeps resolving to the router and matches the pin by name under D1, so nothing breaks and no hand-merge is needed. The README tells members with direct subscriptions how to choose: drop the provider to use their subscription, or keep (or add) a provider-prefixed override to stay on the router. An override changes only the route for `auditor` when model name and effort match its definition; a different name or effort still stops the gate.

### Build vs. adopt

None: the change introduces no mechanism the `Build vs. adopt` paragraph covers. Normalizing a model selector to its name is project-specific glue between the runtime's session records and the review-work checks, and it reuses the existing `bareModelName`.

## Risks / Trade-offs

- [A member with direct subscriptions and the router now runs these agents on the subscription, with its own quota and price] -> README states it; a provider-prefixed override keeps the router.
- [Two providers could serve different weights under one name, e.g. a local alias] -> accepted residual: every provider in use (`onara`, `openai-codex`, `anthropic`) serves the vendor's model under the vendor's name; the trailer and `- **Models**:` keep the full `provider/model` for audit.
- [Through `onara`, RTK compresses large tool results; through a direct provider it does not, so the same pin can see different tool output] -> accepted: the review counts the model, not the transport; the record shows the route.
- [Router-only members lose nothing, but a seed `models.yml` without `cc/claude-fable-5-2` still leaves the consultation unreachable] -> unchanged from today; README keeps the merge note.

## Migration Plan

Deploy with `scripts/deploy-local.sh <sha>`; agent definitions, skill and schema are synced into the agent directory. Running sessions must restart. Rollback is a revert of the commit; stored `review.md`, `consultation.md` and gate records are never re-checked against a pin, so records written in between stay valid.
