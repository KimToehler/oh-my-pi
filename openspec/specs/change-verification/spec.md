# change-verification Specification

## Purpose
Defines, once, what counts as a change's own verification versus its delivered change, how model-read instruction changes are verified, and that the Mandatory class follows the delivered change, not the tools used to verify it.

## Requirements

### Requirement: One definition of change verification

The `review-work` skill SHALL define change verification once, in a `Change verification` section: work done only to establish the change's evidence (QA sessions, disposable fixtures, one-off evidence helpers). Anything that serves users, CI, installation, a benchmark or later reviews after delivery SHALL count as the delivered change, judged by use, not location or filename. Other review instructions SHALL reference that section instead of restating it.

#### Scenario: QA tooling that ships is delivered

- **WHEN** a change adds a script under a `qa/` directory that CI runs after delivery
- **THEN** the script is part of the delivered change and is reviewed and classified as such

#### Scenario: Unreadable definition grants no exemption

- **WHEN** a reviewer cannot read the `Change verification` section
- **THEN** it says so and applies its checks without any exemption from that section

#### Scenario: Negative control

- **WHEN** a plan labels shipped tooling as "QA" to avoid reviewing or classifying it
- **THEN** a review that treats it as change verification MUST fail

### Requirement: Model-read instruction text is verified in real sessions

For model-read instruction text, a task's `Verify:` command SHALL prove only the delivered text, artifact presence and evidence integrity, and the behaviour SHALL be exercised in fresh ordinary agent sessions on disposable fixtures whose outputs, artifacts and tool interactions are retained and judged directly. No checker that re-scores model behaviour and no new proxy, sandbox or credential SHALL be required for that evidence.

#### Scenario: Instruction change planned

- **WHEN** a planner writes tasks for a sentence added to a skill
- **THEN** the task's Verify proves the delivered text, and the task names a real-session scenario and evidence path for the behaviour

#### Scenario: Negative control

- **WHEN** a plan review blocks an instruction-only change only because no command re-scores the sessions' model output
- **THEN** that review MUST fail

### Requirement: Unexercised and unproven behaviour is never passed

Change verification SHALL name every branch it did not exercise and SHALL never report one as passed, and a missing proof of material behaviour SHALL still block under the existing threshold.

#### Scenario: Unexercised branch

- **WHEN** a QA session's reviewer returns OKAY where the scenario needed a REJECT to reach a branch
- **THEN** that branch is reported as unexercised, not as PASS

#### Scenario: Negative control

- **WHEN** a plan's only proof of a model behaviour is a command that checks the instruction sentence exists in the file
- **THEN** a review that does not block on the missing behaviour proof MUST fail

### Requirement: Mandatory class follows the delivered change

The Mandatory class SHALL follow the behaviour and reach of the delivered change, not the tools used to verify it: an ordinary session's existing provider authentication SHALL NOT make an instruction-only change `auth-secrets-pii`. Verification that discloses a credential, weakens access or damages protected data SHALL remain a security defect, and delivered auth, migration, wire/API or state-machine behaviour SHALL keep its class.

#### Scenario: Instruction-only change

- **WHEN** a change only rewords guidance in a skill, delivering no auth, migration, wire/API or state-machine behaviour, and is verified in ordinary sessions on the developer's existing model configuration
- **THEN** its Mandatory class is `none`

#### Scenario: Changed review state machine

- **WHEN** a change adds a decision point to the transitions of an existing review flow
- **THEN** its Mandatory class is `concurrency-state`, even though it only edits instruction text

#### Scenario: Negative control

- **WHEN** a plan's delivered code writes a refresh token to an unprotected file, or its QA step copies the provider key into a committed evidence file
- **THEN** a review that classifies it `none` without a security finding MUST fail
