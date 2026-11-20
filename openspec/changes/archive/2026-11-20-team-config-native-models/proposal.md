## Why

The team config routes every seeded model role, fallback chain and gate-agent pin through `onara`, a personal model router that only one member can reach. Any other member who installs the team config gets a `models.yml` with an unreachable provider, model roles that do not resolve, and gate agents (`architecture-oracle`, `auditor`, `blocker-verifier`) pinned to a route they cannot use. Members sign in to Anthropic and OpenAI Codex directly. The team config should name only those built-in providers. A member who wants a router keeps it in their own agent directory.

## What Changes

- `team-config/seed/config.yml` names only `anthropic/*` and `openai-codex/*` models: model roles, `retry.fallbackChains`, `modelProviderOrder`, `enabledModels`, `compaction.modelThresholds` and the `plan-reviewer` override. Model names and efforts stay the same; only the provider prefix changes (`onara/cc/X` becomes `anthropic/X`, `onara/cx/Y` becomes `openai-codex/Y`).
- `team-config/seed/models.yml` is deleted, so the installer no longer seeds a router provider. The installer's router-key hint and its doc mention of `models.yml` go too.
- The team agent definitions `architecture-oracle`, `auditor` and `blocker-verifier`, and the repo-local experiment agents `.omp/agents/measurement-*.md`, pin the same model and effort through the native provider.
- `team-config/README.md`, `review-work` `SKILL.md` and `team-config/agent/AGENTS.md` stop naming the router: the new-machine steps sign in to Anthropic and OpenAI Codex instead of pasting a router key, and the AGENTS.md section "Tool output through the team router" leaves the team config.
- The review-work validator tests and fixtures use native model names, and their route-neutrality cases use a generic second provider (`router/...`) in place of `onara/...`. The checks themselves do not change.
- The specs' pin and example routes follow: the consultation pin is `anthropic/claude-fable-5-2:high`, the seeded `plan-reviewer` pin is `openai-codex/gpt-6.1-sol:high`, and scenarios that named `onara` routes or the seeded `models.yml` name native or generic routes.
- Not changed: existing agent directories. The installer seeds `config.yml` only when it is missing, so a member's own config, `models.yml` and overrides stay byte-identical. Archived changes, historical plans and evidence are not touched; references to the `onara` app repository (app-qa-drivers) are not the router and stay.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `team-config-install`: adds a requirement that the seeded config and the team agent definitions name only built-in providers and that the installer seeds no `models.yml`.
- `plan-architecture-consultation`: the `architecture-oracle` pin becomes `anthropic/claude-fable-5-2:high`, the seed no longer lists the model in `models.yml`, and the "counts only on its pinned model" scenarios name native or generic routes.
- `openspec-plan-review`: the seeded `plan-reviewer` pin becomes `openai-codex/gpt-6.1-sol:high`, and the dispatch-check scenarios name native or generic routes.
- `post-implementation-review`: the trailer-route scenario names a generic route instead of the router.

## Impact

- Files: `team-config/seed/config.yml`, `team-config/seed/models.yml` (deleted), `scripts/install-team-config.ts`, `team-config/agent/agents/{architecture-oracle,auditor,blocker-verifier}.md`, `.omp/agents/measurement-{adjudicator,sol,terra,verifier}.md`, `team-config/README.md`, `team-config/agent/AGENTS.md`, `team-config/agent/skills/review-work/SKILL.md`, `team-config/agent/skills/review-work/scripts/{validate-gate-record.mjs,validate-gate-record.test.mjs,validate-openspec-change.test.ts,model-name.test.ts}` and the fixtures under `team-config/agent/skills/review-work/scripts/fixtures/`.
- New members: need Anthropic and OpenAI Codex sign-ins instead of a router key; the seeded roles resolve on a fresh install.
- Existing members: deploy syncs the agent definitions, so the gate agents' default route becomes native. A member who wants the router for them sets `task.agentModelOverrides` locally; the checks compare model names, not providers, so a router route to the same model still counts.
- Not affected: `packages/metaharness`, archived OpenSpec changes, `.omp/plans/`, evidence directories.
