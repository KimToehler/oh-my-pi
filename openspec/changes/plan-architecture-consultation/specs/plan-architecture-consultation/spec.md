## Purpose

Gives an `omp-gated` change one cross-family architecture consultation before formal plan review when its depth is `risky`, records how the author applied each finding, and keeps that record out of the formal reviewers' view.

## ADDED Requirements

### Requirement: Consultation before a risky round

Before dispatching any full round at depth `risky` while the change folder holds no `consultation.md`, the `review` instruction SHALL run one architecture consultation on the committed change folder, unless the user told it to skip with a reason, which it records as a `skipped` record. At `standard` depth it SHALL run one only when the user asks. A change SHALL get at most one consultation.

#### Scenario: Risky change before round 1

- **WHEN** a change with Mandatory class `concurrency-state` and no `consultation.md` reaches the `review` artifact
- **THEN** the change folder is committed with `git status --porcelain -- <change dir>` empty, one consultation is dispatched on that commit, and no `plan-reviewer` is dispatched before `consultation.md` is committed

#### Scenario: Standard change without a request

- **WHEN** a `standard` change reaches the `review` artifact and the user did not ask for a consultation
- **THEN** round 1 dispatches its `plan-reviewer` without a consultation and no `consultation.md` is written

#### Scenario: A fix raises the depth

- **WHEN** a fix after round 1 of a `standard` change raises its depth to `risky` and the folder holds no `consultation.md`
- **THEN** the consultation runs, and its record is committed, before the full `risky` round that follows

#### Scenario: Change reviewed before this deploy

- **WHEN** a `risky` change whose round 1 ran before this change was deployed, without `consultation.md`, reaches its round 2
- **THEN** the consultation runs, and its record is committed, before round 2 is dispatched

#### Scenario: User declines the consultation

- **WHEN** the user tells the agent to skip the consultation of a `risky` change because the change is already in apply on another branch
- **THEN** `consultation.md` is written with Status `skipped`, the user's reason verbatim and Models `none`, nothing is dispatched to `architecture-oracle`, and the round follows

#### Scenario: Record already present

- **WHEN** a session resumes the review of a `risky` change whose folder already holds `consultation.md`
- **THEN** no further consultation is dispatched

#### Scenario: Negative control

- **WHEN** an instruction dispatches a full `risky` round of a change without `consultation.md`, dispatches a second consultation for a change that has one, or dispatches a consultation while the change folder has uncommitted changes
- **THEN** review of that instruction MUST fail

### Requirement: Fixed consultation brief on the pinned agent

The consultation SHALL be one fresh `architecture-oracle` task item that carries the consultation brief fixed in the schema verbatim, with only the repository root and change directory filled in, and no `model`. The agent SHALL be read-only, with tools `read, grep, glob`, and pinned in its definition to `onara/cc/claude-fable-5-2:high`. The team seed `models.yml` SHALL list that model.

#### Scenario: Seeded dispatch

- **WHEN** a `risky` change is consulted in an agent directory installed from the team config with the seed's `models.yml`
- **THEN** the one `architecture-oracle` item carries the fixed brief with both paths filled in, and its session file records only `onara/cc/claude-fable-5-2`

#### Scenario: Negative control

- **WHEN** an instruction adds a focus, a file list or a summary of the change to the consultation brief or sets `model` on the item, or the agent definition grants an editing tool or names a model other than `onara/cc/claude-fable-5-2:high`
- **THEN** review of that instruction or definition MUST fail

### Requirement: A consultation counts only on its pinned model

The instruction SHALL read the models of every consultation dispatch from its session file and compare them with the agent's pin. A dispatch without a structured report, or one with a turn on another model, SHALL get one fresh retry. If the retry also fails, the user SHALL choose between skipping with a reason in their words and stopping. No other model's report and no analysis of the author's own SHALL stand in for the consultation.

#### Scenario: Installation without the model entry

- **WHEN** the agent directory's `models.yml` lacks `cc/claude-fable-5-2`, so both consultation attempts run on another model
- **THEN** neither report is used, and the user is asked to skip with a reason or to stop, quoting the models each attempt ran on

#### Scenario: User skips

- **WHEN** the user answers that ask with skip and a reason
- **THEN** `consultation.md` is written with Status `skipped`, the user's reason verbatim and every attempt under Models, and round 1 follows

#### Scenario: Negative control

- **WHEN** an instruction applies findings from a dispatch whose session file records a model other than the pin, writes a `skipped` record without the user's answer, or replaces a failed consultation with the author's own architecture review
- **THEN** review of that instruction MUST fail

### Requirement: The author decides every finding before round 1

Every finding of the counted report SHALL appear verbatim in `consultation.md` with exactly one disposition: `adopted:`, naming the artifact change that applies it, or `rejected:` with the author's reason. The adopted changes and `consultation.md` SHALL be committed together, and validated, before the folder is committed and digested for round 1. No verifier triages consultation findings.

#### Scenario: Mixed dispositions

- **WHEN** the report holds three findings and the author adopts two and rejects one
- **THEN** `consultation.md` lists all three verbatim, two with `adopted:` naming the edited artifact and one with `rejected:` and a reason, and round 1 reviews a digest that includes both edits

#### Scenario: Adopted fix raises the class

- **WHEN** an adopted finding makes the change touch a credential path
- **THEN** the Mandatory class and `- **Depth**:` in `gate.md` are updated in the same commit, before the round-1 digest

#### Scenario: Negative control

- **WHEN** an instruction drops a finding from the record, leaves a finding without a disposition, records `adopted:` without editing the plan, or dispatches round 1 before the adopted edits are committed
- **THEN** review of that instruction MUST fail

### Requirement: Formal review stays blind to the consultation

The fixed full-round brief and the fixed delta brief SHALL name `consultation.md` as not part of the plan and not to be read, and the delta-check patch SHALL exclude it. The consultation's findings SHALL NOT be quoted, summarised or referenced in any `plan-reviewer` or `blocker-verifier` dispatch.

#### Scenario: Round after a consultation

- **WHEN** round 1 of a consulted `risky` change is dispatched
- **THEN** both reviewer briefs exclude `consultation.md`, and neither brief mentions a consultation finding

#### Scenario: Negative control

- **WHEN** a reviewer brief lets the reviewer read `consultation.md`, a delta patch contains `consultation.md`, or a dispatch quotes a consultation finding
- **THEN** review of that instruction MUST fail

### Requirement: Risky changes need the consultation record

`validate-openspec-change.mjs --reviewed` SHALL refuse a change whose `gate.md` Depth starts with `risky` or whose Mandatory class is not `none` when its folder holds no `consultation.md`, and SHALL name `consultation.md`. A `standard` change SHALL pass without one.

#### Scenario: Consulted risky change

- **WHEN** a `risky` change holds a well-formed `consulted` record and an otherwise valid, current OKAY `review.md`
- **THEN** `--reviewed` passes

#### Scenario: Skipped risky change

- **WHEN** a `risky` change holds a well-formed `skipped` record with the user's reason and an otherwise valid, current OKAY `review.md`
- **THEN** `--reviewed` passes

#### Scenario: Standard change

- **WHEN** a `standard` change without `consultation.md` holds a valid, current OKAY `review.md`
- **THEN** `--reviewed` passes

#### Scenario: Negative control

- **WHEN** a change with Mandatory class `auth-secrets-pii` and no Depth bullet, or with Depth `risky`, holds a valid, current OKAY `review.md` and no `consultation.md`
- **THEN** `--reviewed` MUST fail and name `consultation.md`

### Requirement: The record is outside the review digest

`validate-openspec-change.mjs --digest`, and the digest `--reviewed` compares, SHALL exclude `consultation.md` as they exclude `review.md`. A change whose review is current SHALL stay current when a `consultation.md` is added or edited. Any change to another file of the folder SHALL still make it stale.

#### Scenario: Skip recorded after an OKAY review

- **WHEN** a `risky` change with a current OKAY `review.md` written before this deploy gets a well-formed `skipped` record and nothing else changes
- **THEN** `--digest` prints the recorded digest and `--reviewed` passes

#### Scenario: Negative control

- **WHEN** a change with a current OKAY `review.md` and a `consultation.md` has one line of `design.md` edited
- **THEN** `--reviewed` MUST fail as stale

### Requirement: The consultation record is well formed

`validate-openspec-change.mjs`, in its plain run and under `--reviewed`, SHALL refuse at any depth a `consultation.md` that does not follow the template. A `consulted` record SHALL have a 40-hex consulted commit, `architecture-oracle, <id>`, Models, a bottom line, `## Findings`, and one disposition per finding. A `skipped` record SHALL have a reason. The error SHALL name the field.

#### Scenario: Consulted without findings

- **WHEN** a `consulted` record has bottom line `KEEP APPROACH` and `## Findings` reads `none`
- **THEN** the record passes this check

#### Scenario: Negative control

- **WHEN** a `consulted` record has a finding subsection without a `- **Disposition**:` bullet, a Status other than `consulted` or `skipped`, a `skipped` record has Skip reason `none`, or a Consultant field names an agent other than `architecture-oracle`
- **THEN** the plain run MUST fail and `--reviewed` MUST fail, each naming the defective field
