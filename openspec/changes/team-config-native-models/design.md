# Design

## Context

See proposal.md - Why. Current state:

- `team-config/seed/config.yml` names every model through `onara/cc/*` (Anthropic weights) or `onara/cx/*` (OpenAI weights). `team-config/seed/models.yml` defines only the `onara` and `onara-bifrost` providers, which need a router key. `scripts/install-team-config.ts` copies every file under `team-config/seed/` into the agent directory when it is missing (`listFiles`, line 426), so a new install gets both files. The installer also prints an `ONARA_ROUTER_KEY` hint (lines 692-694).
- The team agent definitions `architecture-oracle`, `auditor` and `blocker-verifier` pin `onara/*` models. Deploy syncs them into every member's agent directory. The repo-local `.omp/agents/measurement-*.md` experiment agents pin `onara/*` too.
- The gate checks (`validate-openspec-change.mjs --consultation-report`, the `review` instruction, `review-work` Phase 3, `validate-gate-record.mjs` independence) compare model names, the last `/` segment, and drop the provider. That came from `route-neutral-gate-pins`, archived 2026-11-20. So changing the provider of a pin changes no check.
- The specs `plan-architecture-consultation`, `openspec-plan-review` and `post-implementation-review` state the pins and name `onara` routes in their examples. The consultation spec also requires the seed `models.yml` to list Fable.

## Goals / Non-Goals

**Goals:**

- A fresh install resolves every seeded role, chain and gate pin through providers that ship with omp, once the member is signed in to `anthropic` and `openai-codex`.
- No file the team config delivers, and no check example, names the private router.

**Non-Goals:**

- No change to any check, validator logic, brief or instruction semantics.
- No migration of existing agent directories: their `config.yml`, `models.yml` and overrides stay as they are.
- No change to model names or efforts; only the provider prefix changes.
- `packages/metaharness`, archived changes, `.omp/plans/`, evidence directories and the `gate-delta-evidence-elision` change (another lane) stay untouched.

## Decisions

### D1. Map by provider prefix, keep model and effort

`onara/cc/X` becomes `anthropic/X` and `onara/cx/Y` becomes `openai-codex/Y` everywhere in the seed and the agent definitions. The model names and efforts stay the same, so the gate pins keep the same model name, and the name-only checks accept the same sessions they accepted before. Seed values:

- Model roles: `default` `anthropic/claude-opus-5-5:high`; `slow` and `plan` the same at `xhigh`; `task` `anthropic/claude-sonnet-5-5:medium`; `smol` `openai-codex/gpt-6-luna:low`; `tiny`, `commit` and `judge` `anthropic/claude-haiku-5-5`; `advisor` `openai-codex/gpt-6.1-terra:medium`; `oracle` `openai-codex/gpt-6.1-sol:xhigh`; `review` `openai-codex/gpt-6.1-terra:high`; `deep` `anthropic/claude-opus-5-5:high`.
- `retry.fallbackChains`: each chain keeps its cross-vendor target with the native prefix.
- `modelProviderOrder: [anthropic, openai-codex]`; `enabledModels: [anthropic/**, openai-codex/**]`; `compaction.modelThresholds` keyed `anthropic/*` and `openai-codex/*`, values unchanged; `task.agentModelOverrides.plan-reviewer: openai-codex/gpt-6.1-sol:high`.

Rejected alternative: keeping the `onara` entries next to native ones. Members without the router would get an unreachable provider first in `modelProviderOrder`, plus fallback chains that point at it.

### D2. Delete the seed `models.yml`

It defines only router providers. An empty seed file would hide a user's later `models.yml` choice behind a seeded one, because the installer never overwrites an existing file. The installer drops the `ONARA_ROUTER_KEY` hint and its doc line about `models.yml`. Nothing else in the installer names that file.

### D3. Native pins in the definitions, router routes only as local overrides

The definitions name `anthropic/claude-fable-5-2:high` (`architecture-oracle`), `openai-codex/gpt-6.1-sol:high` (`auditor`), `openai-codex/gpt-6.1-sol:medium` (`blocker-verifier`), and in `.omp/agents`: `anthropic/claude-opus-5-5:high` (adjudicator), `openai-codex/gpt-6.1-sol:high` (sol), `openai-codex/gpt-6.1-terra:medium` (terra), `openai-codex/gpt-6.1-sol:medium` (verifier). A member who wants the router sets `task.agentModelOverrides` in their own `config.yml`. Because the checks compare model names, such a dispatch still counts. The auditor gate also accepts an override that differs only in its provider, as its spec's Negative control requires.

### D4. The provider check is an installer test on the real team config

One helper in `scripts/install-team-config.test.ts` lists every model selector an installed agent directory names that does not use `anthropic` or `openai-codex`. Two tests call it.

The helper reads the seeded `config.yml` and these selectors:

- role values, fallback-chain keys and entries, `enabledModels` patterns, `compaction.modelThresholds` keys and `task.agentModelOverrides` values;
- the `modelProviderOrder` entries, which are bare provider names;
- every `model:` in the installed `agents/*.md` frontmatter, plus the `.omp/agents/*.md` of the repository it installed from.

A role reference (`@review`, `@oracle`) is expanded with the existing `expandRoleAlias` (`packages/coding-agent/src/config/model-resolver.ts:1312`, imported as `@oh-my-pi/pi-coding-agent/config/model-resolver`). Its lookup returns the seeded `modelRoles` entry. A reference that stays unexpanded is reported too. Two role references exist today: `reviewer: "@review"` (`team-config/seed/config.yml:67`) and `model: "@oracle"` (`team-config/agent/agents/oracle.md:5`). The migration leaves both unchanged, because their roles become native.

- Test "seed and agent definitions name only built-in providers" runs `installTeamConfig` from the repository's own `team-config/` into a temporary agent directory. It asserts that the seeded files are exactly `config.yml` and that the helper reports nothing. On the current seed it fails; that run is the requirement's negative control (RED).
- Test "provider check reports router routes behind literal pins and role references" uses the existing `setup()` fixture repo. Its seed sets `modelRoles.review: router/cx/gpt-6.1-sol`, and it has one agent with `model: "@review"` and one with `model: router/cc/claude-fable-5-2:high`. It asserts that the helper reports exactly those two agent selectors and the role value. So the check's rejection path stays covered after the real seed turns native.

Both tests assert the installed output, not source text.

"Existing installation keeps its own routes" needs no new test. The existing test "seeds once and never overwrites the user's copy" (`scripts/install-team-config.test.ts:29`) covers the one code path that skips a present seed target, whatever the file's name. The F1 install row shows it on `config.yml` and `models.yml` that name a custom provider.

Rejected alternatives: a throwaway script in the change folder leaves no guard after merge; a check in `review-work` scripts belongs to a different deliverable.

The provider list is an allowlist, not a lookup in the bundled catalog: `openai-codex/gpt-6.1-terra` is missing from the bundled catalog (`getBundledModels("openai-codex")` lists only `gpt-6.1-sol` and `gpt-6-luna` of the seeded names) and resolves through provider discovery after sign-in.

### D5. Tests and fixtures use native names and a generic second provider

The `review-work` validator fixtures and trailers replace `onara/cc/claude-opus-5` with `anthropic/claude-opus-5`, and the roster-style model ids `onara/auditor` and `onara/oracle` with `router/auditor` and `router/oracle`. In the tests and the code comment that need "the same model through another provider", `onara/...` becomes `router/...`. The provider/vendor tables do not change. A generic `router/cc/*` route keeps the case "same weights behind a custom prefix", which is what those tests defend. The `onara` mentions in the `app-qa-drivers` files and in the `validate-gate-record.test.mjs` comment about the onara app's plan name a different repository and stay.

### D6. Router-specific guidance leaves the team docs

`team-config/README.md` replaces the router-key setup with sign-in to Anthropic and OpenAI Codex (`/login` in omp), and drops the seed-merge notes about `seed/models.yml` and the route-neutral note that "the pins themselves name the router". The section "Tool output through the team router" in `team-config/agent/AGENTS.md` is removed. Its content belongs in the operator's personal `~/.omp/agent/AGENTS.local.md`, which is outside the repository. `review-work` `SKILL.md` names the native pin and a native example route.

### D7. One change, one cutover

The parts touched are the seed and installer, the agent definitions, the docs, and the review-work test fixtures. They cannot ship apart. The specs state the pins the definitions carry, so the specs and definitions must change in the same commit range. The seeded `plan-reviewer` override and the seed's provider order must name the same providers as the definitions. The fixtures change names only and keep every assertion. So there is one cutover, and one F2 gate covers it.

### Build vs. adopt

No covered mechanism: the change edits configuration values and adds one project-specific test. It adds no protocol, format, algorithm or infrastructure.

## Risks / Trade-offs

- [A member deployed before signing in to `openai-codex` dispatches `auditor` or `plan-reviewer` without working credentials] → The checks already refuse a dispatch whose session ran on another model, and they tell the user which model ran. The README's new-machine steps name both sign-ins.
- [`gpt-6.1-terra` is missing from the bundled catalog, so `advisor` and `review` resolve only after `openai-codex` discovery] → Discovery runs after sign-in; the operator's model cache lists it. F1's happy-path row runs a seeded session against the operator's signed-in directory.
- [Existing members keep their `onara` config, and after deploy the gate agents' definitions are native] → This is intended. A local `task.agentModelOverrides` entry restores a router route, and the name-only checks accept it.
- [Depth `standard` while three review specs are MODIFIED] → Their check rules, briefs and counting are unchanged. Only the provider of a pin and the example routes change. Each MODIFIED requirement gets its own F1 row.

## Migration Plan

1. Merge; deploy `main` with `scripts/deploy-local.sh`. The agent definitions and skills sync; existing `config.yml` and `models.yml` stay unchanged.
2. Restart running omp sessions so they load the new definitions.
3. Operator only, outside the repository: move the AGENTS.md router section into `~/.omp/agent/AGENTS.local.md`. Local overrides that now equal the definitions may be removed; overrides that keep the router stay.
4. Rollback: revert the merge commit and redeploy `main`. No data or state migrates.
