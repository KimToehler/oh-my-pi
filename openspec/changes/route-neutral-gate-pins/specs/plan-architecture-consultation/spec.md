# Spec Delta

## MODIFIED Requirements

### Requirement: Fixed consultation brief on the pinned agent

The consultation SHALL be one fresh `architecture-oracle` task item that carries the consultation brief fixed in the schema verbatim, with only the repository root and change directory filled in, and no `model`. The agent SHALL be read-only, with tools `read, grep, glob`, and pinned in its definition to `claude-fable-5-2:high`, naming no provider. The team seed `models.yml` SHALL list that model for the team router.

#### Scenario: Seeded dispatch

- **WHEN** a `risky` change is consulted in an agent directory installed from the team config with the seed's `models.yml` and no other provider of `claude-fable-5-2`
- **THEN** the one `architecture-oracle` item carries the fixed brief with both paths filled in, and its session file records only `onara/cc/claude-fable-5-2`

#### Scenario: Direct subscription

- **WHEN** the same consultation runs in an agent directory signed in to `anthropic`
- **THEN** the item resolves to `claude-fable-5-2` on a provider the installation can reach, and every turn of its session file records that model

#### Scenario: Negative control

- **WHEN** an instruction adds a focus, a file list or a summary of the change to the consultation brief or sets `model` on the item, or the agent definition grants an editing tool, names a model other than `claude-fable-5-2:high` or names a provider
- **THEN** review of that instruction or definition MUST fail

### Requirement: A consultation counts only on its pinned model

Every consultation attempt SHALL count only when the report check accepts it, which compares the model name of every turn in its session file, the last `/` segment of its `provider/model`, with the model name of the `architecture-oracle` definition's `model` without its effort suffix, never with a configured `task.agentModelOverrides` entry; the provider SHALL NOT take part in the comparison. A refused attempt SHALL get one fresh retry. If the retry also fails, the user SHALL choose between skipping with a reason in their words and stopping; after a Stop, further attempts follow only as requirement "A consultation survives interruption" allows. No other model's report and no analysis of the author's own SHALL stand in for the consultation.

#### Scenario: Installation without the model entry

- **WHEN** the agent directory reaches `claude-fable-5-2` through no provider, so both consultation attempts run on another model
- **THEN** neither report is used, and the user is asked to skip with a reason or to stop, quoting the models each attempt ran on

#### Scenario: Configured override

- **WHEN** the agent directory's config sets `task.agentModelOverrides` for `architecture-oracle` to `onara/cx/gpt-6.1-sol`
- **THEN** both attempts run on that model, neither report is used, and the user is asked to skip with a reason or to stop, quoting those models

#### Scenario: Pinned model through another provider

- **WHEN** every turn of an attempt's session file ran on `anthropic/claude-fable-5-2`, or every turn ran on `onara/cc/claude-fable-5-2`, and its final yield is an accepted report
- **THEN** the report check accepts the attempt in both cases

#### Scenario: User skips

- **WHEN** the user answers that ask with skip and a reason
- **THEN** `consultation.md` is written with Status `skipped`, the user's reason verbatim and every attempt under Models, and round 1 follows

#### Scenario: Negative control

- **WHEN** the report check accepts a session file with a turn on `onara/cc/claude-opus-5-5`, or refuses one whose every turn ran on `anthropic/claude-fable-5-2`; or an instruction applies findings from a dispatch whose session file records a model name other than the definition's, takes the expected model from `task.agentModelOverrides`, writes a `skipped` record without the user's answer, or replaces a failed consultation with the author's own architecture review
- **THEN** that check or review of that instruction MUST fail
