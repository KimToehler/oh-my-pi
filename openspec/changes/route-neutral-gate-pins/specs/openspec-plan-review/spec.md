# Spec Delta

## MODIFIED Requirements

### Requirement: A dispatch counts only on its pinned model

After every dispatch the instruction SHALL read the `provider/model` of every turn the dispatch's session file records and record them per dispatch under `- **Models**:` in `review.md`. It SHALL compare each turn's model name, the last `/` segment of its `provider/model`, with the pin's model name, the last `/` segment of the pin without its effort suffix; the provider SHALL NOT take part in the comparison. A dispatch any of whose turns ran on another model name SHALL count as one without a structured result. Without a pin for a dispatched agent, from the overrides or an agent definition, the instruction SHALL stop, name the missing override and write no record.

#### Scenario: Credential fallback to the parent model

- **WHEN** the pinned `plan-reviewer` model has no working credentials, so both attempts of a `standard` round-1 dispatch run on the parent session's model
- **THEN** neither verdict counts, the round is incomplete, no `review.md` is written, and the user is told which model the dispatch ran on instead of its pin

#### Scenario: Retry chain switches a reviewer mid-run

- **WHEN** scope A's session records its last turns on `onara/cc/claude-opus-5` after the retry chain switched it from its pin, and its fresh retry runs on the pin throughout
- **THEN** the round continues with the retry's verdict, the Reviewer field lists the retry's id, and `- **Models**:` lists both attempts, the switched one marked as having no verdict

#### Scenario: Pinned model through another provider

- **WHEN** the configuration pins `plan-reviewer` to `gpt-6.1-sol:high` and every turn of the dispatch ran on `openai-codex/gpt-6.1-sol`, or the pin is `onara/cx/gpt-6.1-sol:high` and every turn ran on `openai-codex/gpt-6.1-sol`
- **THEN** the dispatch counts, and `- **Models**:` records `openai-codex/gpt-6.1-sol` for it

#### Scenario: Substituted verifier

- **WHEN** both verifier attempts of a rejecting round run on a model other than the verifier's pin
- **THEN** the round is recorded REJECT with Awaiting `triage` and its findings untriaged, as for a verifier without a structured result

#### Scenario: Installation without the pin

- **WHEN** the configuration has no `task.agentModelOverrides` entry for `plan-reviewer` and no agent definition in the agent directory names its model, as on an installation updated without merging the new seed entry
- **THEN** the review stops before its first dispatch counts, writes no `review.md`, and tells the user to add the override

#### Scenario: Negative control

- **WHEN** an instruction counts a verdict or triage result from a dispatch whose session records a model name other than its pin's, refuses a dispatch only because its provider differs from the pin's, or writes a record whose `- **Models**:` omits a dispatch of the recorded round
- **THEN** review of that instruction MUST fail
