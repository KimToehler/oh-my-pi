# Proposal

## Why

`team-config/README.md:34-37` tells a member whose `~/.omp/agent/config.yml` predates the switch to the built-in providers that the manual alternative to re-seeding is rewriting each model's `<router>/cc/` and `<router>/cx/` prefix. That leaves `modelProviderOrder`, `enabledModels` and the `compaction.modelThresholds` keys on the router: `enabledModels` still admits only the router's models, so the native `anthropic` and `openai-codex` models stay out of the session's model list (`packages/coding-agent/src/session/model-controls.ts:531-535`), and the compaction token base no longer applies to them. The F2 implementation audit of `team-config-native-models` reported this as a non-blocking note, now a README follow-up.

## What Changes

- The README paragraph on configs seeded before the switch names every setting the old seed put on the router, not only model prefixes: model roles, `retry.fallbackChains` keys and entries and `task.agentModelOverrides` get the prefix rewrite; `modelProviderOrder`, `enabledModels` and the `compaction.modelThresholds` keys take the seed's values; the router provider entry in `models.yml` is removed. It points to `diff ~/.omp/agent/config.yml team-config/seed/config.yml` as the check that nothing router-bound is left.
- The re-seed alternative stays as it is.
- No code, seed, installer or agent definition changes; existing configs are still never rewritten by the installer.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The change is documentation only: no spec-level behaviour changes, so `.openspec.yaml` sets `skip_specs: true`.

## Impact

- Files: `team-config/README.md` (the update paragraph, lines 34-37).
- Members who updated with an old `config.yml` and do not use the router; nobody else.

## Follow-ups taken

- `team-config/README.md`: - The manual route for a config seeded before the built-in providers only rewrites model prefixes, which leaves `modelProviderOrder`, `enabledModels` and the `compaction.modelThresholds` patterns on the router, so native models stay excluded from model listings; the paragraph should name those settings too. `team-config/README.md:37`. Source: `team-config-native-models` `.omp/team-config/evidence/gate/team-config-native-models/f2/trailer-implementation-audit.txt`, note 1
