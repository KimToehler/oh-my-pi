# team-config-install Specification

## Purpose

Defines what the team-config seed and deploy do with the plan location for new and existing installs, so plans land in omp's default directory without overwriting anyone's local configuration.

## Requirements

### Requirement: Seed leaves plans at the omp default
The `config.yml` that the installer seeds into a new agent directory SHALL NOT set `plan.autosaveDir`, so plan autosave resolves to omp's default `<cwd>/.omp/plans`. It SHALL keep `plan.autosave: true` and the existing plan review settings.

#### Scenario: Fresh install
- **WHEN** `bun scripts/install-team-config.ts` runs against an agent directory with no `config.yml`
- **THEN** the seeded `config.yml` parses as YAML, `plan.autosave` is `true` and `plan.autosaveDir` is absent

#### Scenario: Negative control
- **WHEN** `team-config/seed/config.yml` still sets `plan.autosaveDir: .omo/plans`
- **THEN** the seed check from tasks.md MUST fail with a non-zero exit; a clean exit with that value is a defect

### Requirement: Deploy notice for a retired plan directory
When the agent directory's existing `config.yml` sets `plan.autosaveDir` to a path with a `.omo` segment, the installer SHALL print a notice that names the file, the key and its value and says plans now default to `.omp/plans` once the key is removed. It SHALL leave `config.yml` byte-identical and SHALL still finish the install.

#### Scenario: Custom plan directory
- **WHEN** the existing `config.yml` sets `plan.autosaveDir: docs/plans`, or does not set it
- **THEN** the installer prints no plan-directory notice

#### Scenario: Unreadable config
- **WHEN** the existing `config.yml` is not valid YAML
- **THEN** the installer prints no plan-directory notice, leaves the file unchanged and completes the install

#### Scenario: Negative control
- **WHEN** the existing `config.yml` sets `plan.autosaveDir: .omo/plans` and the installer runs
- **THEN** a silent or rewriting install MUST fail the requirement: the run reports the notice and `config.yml` stays byte-identical; no notice, or a rewritten file, is a defect

### Requirement: Team config names only built-in providers
Every model the seeded `config.yml` names (model roles, fallback chains, provider order, enabled models, compaction thresholds, agent overrides) and every `model` pin in the team and repository agent definitions SHALL use a built-in provider, `anthropic` or `openai-codex`. A role reference such as `@review` counts as the model its seeded role names. The installer SHALL seed no `models.yml`.

#### Scenario: Fresh install
- **WHEN** `bun scripts/install-team-config.ts` runs against an empty agent directory
- **THEN** it seeds `config.yml` and no `models.yml`, and every model the seeded `config.yml` and the installed agent definitions name, with each role reference expanded through the seeded roles, starts with `anthropic/` or `openai-codex/`

#### Scenario: Existing installation keeps its own routes
- **WHEN** the agent directory already has a `config.yml` and a `models.yml` that name a custom router provider, and the installer runs
- **THEN** both files stay byte-identical, and the installed agent definitions pin the native routes

#### Scenario: Negative control
- **WHEN** `team-config/seed/config.yml` names a model through a provider other than `anthropic` or `openai-codex` (for example `onara/cc/claude-opus-5-5`), an agent definition pins such a model directly or through a role reference whose seeded role names one, or `team-config/seed/models.yml` exists
- **THEN** the provider check from tasks.md MUST fail with a non-zero exit; a clean exit is a defect
