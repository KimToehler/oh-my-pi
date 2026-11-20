## ADDED Requirements

### Requirement: Team config names only built-in providers
Every model the seeded `config.yml` names (model roles, fallback chains, provider order, enabled models, compaction thresholds, agent overrides) and every `model` pin in the team agent definitions and the repository's own agent definitions SHALL use a built-in provider, `anthropic` or `openai-codex`. The installer SHALL seed no `models.yml`.

#### Scenario: Fresh install
- **WHEN** `bun scripts/install-team-config.ts` runs against an empty agent directory
- **THEN** it seeds `config.yml` and no `models.yml`, and every model the seeded `config.yml` and the installed agent definitions name starts with `anthropic/` or `openai-codex/`

#### Scenario: Existing installation keeps its own routes
- **WHEN** the agent directory already has a `config.yml` and a `models.yml` that name a custom router provider, and the installer runs
- **THEN** both files stay byte-identical, and the installed agent definitions pin the native routes

#### Scenario: Negative control
- **WHEN** `team-config/seed/config.yml` names a model through a provider other than `anthropic` or `openai-codex` (for example `onara/cc/claude-opus-5-5`), an agent definition pins such a model, or `team-config/seed/models.yml` exists
- **THEN** the provider check from tasks.md MUST fail with a non-zero exit; a clean exit is a defect
