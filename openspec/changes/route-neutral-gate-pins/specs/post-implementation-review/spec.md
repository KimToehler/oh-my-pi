# Spec Delta

## MODIFIED Requirements

### Requirement: Gate reviewers run on their pinned model

Both F2 invocations SHALL dispatch the `auditor` agent. Its pin SHALL be the model and effort in its definition, which names no provider. A dispatch SHALL count only when every assistant turn in its session file ran on the pinned model name, the last `/` segment of its `provider/model`, at the pinned effort, through any provider, and the model name of its trailer `model_id` is the pinned one. The check SHALL run after the dispatch and again after any trailer repair answer, before that trailer is accepted. Otherwise the invocation SHALL be INCONCLUSIVE and get the one bounded fresh retry.

#### Scenario: Fallback model

- **WHEN** the retry chain moves a stalled `implementation-audit` dispatch to another model and it returns PASS
- **THEN** that reply is kept as evidence and never submitted as the invocation's trailer, and one fresh retry runs on the pinned model

#### Scenario: Same model, lower effort

- **WHEN** an `implementation-audit` dispatch ran on the pinned model at effort `medium` while the pin says `high`
- **THEN** that invocation is INCONCLUSIVE, whatever it returned

#### Scenario: Pinned model through another provider

- **WHEN** every turn of an `implementation-audit` dispatch ran on `openai-codex/gpt-6.1-sol` at effort `high`, the pin is `gpt-6.1-sol:high`, and its trailer `model_id` is `openai-codex/gpt-6.1-sol`
- **THEN** the dispatch counts, and the record carries `openai-codex/gpt-6.1-sol` as the invocation's resolved model

#### Scenario: Configuration overrides the pin

- **WHEN** `task.agentModelOverrides.auditor` names a model name or effort other than the `auditor` definition's, or the definition names no model
- **THEN** the gate dispatches nothing, and tells the user which setting conflicts with the pin or that the pin is missing

#### Scenario: Retry also substituted

- **WHEN** the fresh retry also runs on a model other than the pin
- **THEN** the invocation stays INCONCLUSIVE and `GC wave` records it without its trailer, both replies are kept verbatim as evidence, the gate does not pass, and the user is told which model ran

#### Scenario: Repair turn substituted

- **WHEN** a dispatch ran on the pin, its trailer needed one repair, and the repair answer came from another model
- **THEN** the repaired trailer is not accepted, the dispatch does not count, and the invocation gets the bounded fresh retry

#### Scenario: Negative control

- **WHEN** a gate record carries a PASS verdict for an invocation whose trailer names a model other than the `auditor` pin, or the gate refuses a dispatch only because its provider differs from a provider-prefixed override
- **THEN** that gate MUST fail
