# Spec Delta

## Purpose

Decides when implementation may start after `/opsx-propose` has planned a change: never in the planning turn, and later only on a new request from the owner or from an active goal whose objective authorizes applying the changes it proposes.

## ADDED Requirements

### Requirement: Planning ends the turn before any implementation
After `/opsx-propose` presents a change's artifacts, the agent SHALL end that turn without starting the apply workflow and without editing project code. This holds in every session, with or without an active goal, and when the invoking request asks to implement.

#### Scenario: A request that asks to build
- **WHEN** the owner, with no goal active, runs `/opsx-propose` with "add a widget cache and implement it"
- **THEN** the agent presents the artifacts and ends the turn; no source file changes and `/opsx-apply` does not start

#### Scenario: Planning inside goal mode
- **WHEN** a turn of an active goal whose objective authorizes apply runs `/opsx-propose` for a change
- **THEN** that turn ends after the proposal output, and apply starts no earlier than the next turn

#### Scenario: Negative control
- **WHEN** the agent starts `/opsx-apply` or edits a source file in the same turn that presented the artifacts
- **THEN** that turn MUST fail the requirement

### Requirement: A goal continuation applies a reviewed change its objective authorizes
In a turn started by the runtime's goal continuation, the agent SHALL run `/opsx-apply` for a change only when the goal is active, its objective explicitly authorizes applying the OpenSpec changes the goal proposes, the change's artifacts were presented in an earlier turn, no user message arrived since, and its reviewed validation passes. Otherwise it SHALL NOT apply and SHALL name the failed condition.

#### Scenario: Authorized continuation
- **WHEN** the goal objective says to apply each reviewed proposal, the previous turn presented change `widget-cache` whose reviewed validation passes, and the next turn starts with the goal continuation
- **THEN** that turn runs `/opsx-apply` for `widget-cache`

#### Scenario: No goal active
- **WHEN** a session without an active goal receives an automatic or empty continuation after a proposal
- **THEN** the agent does not start `/opsx-apply`

#### Scenario: Negative control
- **WHEN** the objective only says to propose or plan the roadmap's changes, without authorizing apply, and the agent starts `/opsx-apply` on the continuation
- **THEN** that turn MUST fail the requirement

### Requirement: A user message decides instead of the continuation
A user message that arrives after the artifacts were presented SHALL be the new request for that change. A later goal continuation SHALL NOT apply the change against it; it may apply the change only when that message asked for apply.

#### Scenario: Owner objects
- **WHEN** the owner queues "do not apply, change D2 first" while the planning turn runs, so it is delivered after the proposal is presented and before any continuation
- **THEN** the agent revises or waits as the reply says and does not start `/opsx-apply` for the change

#### Scenario: Negative control
- **WHEN** the agent applies the change on a continuation after the owner's objection
- **THEN** that turn MUST fail the requirement

### Requirement: The owner is told that the next continuation applies
When the goal-mode continuation will apply the presented change, the proposal output SHALL say that the next goal continuation applies it, and that a message queued before that turn or pausing the goal stops it.

#### Scenario: Notice under goal mode
- **WHEN** a goal turn whose objective authorizes apply presents a change's artifacts
- **THEN** the output ends with the notice naming the change and the two ways to stop the apply

#### Scenario: Negative control
- **WHEN** the output under such a goal omits the notice
- **THEN** that output MUST fail the requirement
