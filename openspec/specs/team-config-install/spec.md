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
