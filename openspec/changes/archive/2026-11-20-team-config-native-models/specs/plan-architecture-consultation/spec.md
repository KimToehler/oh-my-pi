## MODIFIED Requirements

### Requirement: Fixed consultation brief on the pinned agent

The consultation SHALL be one fresh `architecture-oracle` task item that carries the consultation brief fixed in the schema verbatim, with only the repository root and change directory filled in, and no `model`. The agent SHALL be read-only, with tools `read, grep, glob`, and pinned in its definition to `anthropic/claude-fable-5-2:high`.

#### Scenario: Seeded dispatch

- **WHEN** a `risky` change is consulted in an agent directory installed from the team config, signed in to `anthropic`, with no `task.agentModelOverrides` entry for `architecture-oracle`
- **THEN** the one `architecture-oracle` item carries the fixed brief with both paths filled in, and its session file records only `anthropic/claude-fable-5-2`

#### Scenario: Negative control

- **WHEN** an instruction adds a focus, a file list or a summary of the change to the consultation brief or sets `model` on the item, or the agent definition grants an editing tool or names a model other than `anthropic/claude-fable-5-2:high`
- **THEN** review of that instruction or definition MUST fail

### Requirement: A consultation counts only on its pinned model

Every consultation attempt SHALL count only when the report check accepts it, which compares the model name of every turn in its session file, the last `/` segment of its `provider/model`, with the model name of the `architecture-oracle` definition's `model` without its effort suffix, never with a configured `task.agentModelOverrides` entry; the provider SHALL NOT take part in the comparison. A refused attempt SHALL get one fresh retry. If the retry also fails, the user SHALL choose between skipping with a reason in their words and stopping; after a Stop, further attempts follow only as requirement "A consultation survives interruption" allows. No other model's report and no analysis of the author's own SHALL stand in for the consultation.

#### Scenario: Installation without the model entry

- **WHEN** no provider in the agent directory can reach `claude-fable-5-2`, so both consultation attempts run on another model
- **THEN** neither report is used, and the user is asked to skip with a reason or to stop, quoting the models each attempt ran on

#### Scenario: Configured override

- **WHEN** the agent directory's config sets `task.agentModelOverrides` for `architecture-oracle` to `openai-codex/gpt-6.1-sol`
- **THEN** both attempts run on that model, neither report is used, and the user is asked to skip with a reason or to stop, quoting those models

#### Scenario: Same model through another provider

- **WHEN** the agent directory's config sets `task.agentModelOverrides` for `architecture-oracle` to `router/cc/claude-fable-5-2:high`, every turn of the attempt ran on `router/cc/claude-fable-5-2`, and its final yield is an accepted report
- **THEN** the report check accepts the attempt, and Models records `router/cc/claude-fable-5-2` for it

#### Scenario: User skips

- **WHEN** the user answers that ask with skip and a reason
- **THEN** `consultation.md` is written with Status `skipped`, the user's reason verbatim and every attempt under Models, and round 1 follows

#### Scenario: Negative control

- **WHEN** the report check accepts a session file with a turn on `anthropic/claude-opus-5-5`, or refuses one whose every turn ran on `router/cc/claude-fable-5-2`; or an instruction applies findings from a dispatch whose session file records a model name other than the definition's, takes the expected model from `task.agentModelOverrides`, writes a `skipped` record without the user's answer, or replaces a failed consultation with the author's own architecture review
- **THEN** that check or review of that instruction MUST fail
