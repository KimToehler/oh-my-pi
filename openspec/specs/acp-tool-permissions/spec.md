# acp-tool-permissions Specification

## Purpose
Defines how an ACP session decides whether a tool call needs the user's consent and how it asks the ACP client, so that ACP follows the same approval rules as the TUI.

## Requirements

### Requirement: ACP default approval mode is write
An ACP session whose `tools.approvalMode` is not configured by global or project settings, a `--config` overlay, `--approval-mode` or `--auto-approve`/`--yolo` SHALL use the `write` approval mode. A configured value SHALL apply unchanged, with the same precedence as in the TUI.

#### Scenario: Unconfigured session asks for exec
- **WHEN** an ACP session has no configured approval mode and the model calls `bash`, `eval`, `task` or `vibe_spawn`
- **THEN** the client receives a permission request before the call runs

#### Scenario: Unconfigured session writes without asking
- **WHEN** an ACP session has no configured approval mode and the model writes a new file with `write`
- **THEN** the file is written without a permission request

#### Scenario: Project config wins
- **WHEN** the session's project config sets `tools.approvalMode: always-ask` and the model writes a file
- **THEN** the client receives a permission request

#### Scenario: Explicit yolo
- **WHEN** the ACP server runs with `--approval-mode yolo` and no user policy names `bash`
- **THEN** `bash` runs without a permission request

#### Scenario: Negative control
- **WHEN** an ACP session has no configured approval mode and the model calls `eval`
- **THEN** the code running without a permission request MUST fail: the client is asked first

### Requirement: ACP asks exactly when the TUI would ask
An ACP session SHALL raise a permission request for a tool call if and only if the TUI approval resolution for the session's effective mode yields a prompt: tool tiers, `tools.approval` policies, `bash.patterns`, critical-command overrides, session approvals, session denials and `always-ask-cached` grants all apply. A resolved deny SHALL block the call without a request.

#### Scenario: User prompt policy on write
- **WHEN** the effective mode is `write` and `tools.approval.write` is `prompt`
- **THEN** a `write` call raises a permission request

#### Scenario: Pattern allow skips the request
- **WHEN** the effective mode is `write` and a `bash.patterns` rule allows `git status`
- **THEN** `bash` with `git status` runs without a permission request

#### Scenario: Critical command
- **WHEN** the effective mode is `write` and the model runs a critical bash command
- **THEN** a permission request is raised

#### Scenario: User deny
- **WHEN** `tools.approval.bash` is `deny`
- **THEN** `bash` is blocked and no permission request is sent

#### Scenario: Negative control
- **WHEN** the effective mode is `write` and the model calls `task` to spawn a subagent
- **THEN** the subagent starting without a permission request MUST fail: the client is asked first

### Requirement: One client permission request per prompt
Every approval prompt in an ACP session SHALL be sent as exactly one `session/request_permission` request that references the pending call's `toolCallId`, names the tool and lists the file locations the call touches. Approval prompts SHALL NOT use form elicitation, and SHALL work for clients without elicitation support.

#### Scenario: Client without elicitation
- **WHEN** the client did not advertise form elicitation and a `bash` call needs approval
- **THEN** the client receives a permission request, and selecting an allow option runs the command

#### Scenario: Single request
- **WHEN** the effective mode is `always-ask` and the model calls `bash`
- **THEN** exactly one permission request is sent for that call

#### Scenario: Negative control
- **WHEN** the client lacks form elicitation and a call needs approval
- **THEN** denying the call without sending a permission request MUST fail: a permission request is sent

### Requirement: Permission options mirror the TUI choices
The request SHALL offer: one `allow_once` option; `allow_always` options only where the TUI offers "approve for this session" or `always-ask-cached` grants (one option per grant); one `reject_once` option; a `reject_always` option only where "approve for this session" is offered. A selected option SHALL have exactly the TUI answer's effect, and `reject_always` records a session denial.

#### Scenario: Ordinary exec prompt
- **WHEN** an ordinary `bash` command needs approval
- **THEN** the options are allow once, allow for this session, reject, and always reject

#### Scenario: Per-call prompt
- **WHEN** a critical bash command or a destructive edit needs approval
- **THEN** only allow once and reject are offered

#### Scenario: Session approval applies
- **WHEN** the user selects allow for this session on a `bash` request and the model runs another ordinary `bash` command
- **THEN** the second command runs without a request

#### Scenario: Cached-mode grants
- **WHEN** the effective mode is `always-ask-cached` and the model reads a file outside any grant
- **THEN** the options include a directory and a file grant, each for this session and always, and the chosen grant covers later reads it matches

#### Scenario: Negative control
- **WHEN** the client answers with an option id that was not in the request
- **THEN** the call running MUST fail: the call is rejected with an error

### Requirement: Unanswered permission requests fail closed
A tool call whose permission request ends without a selected allow option SHALL NOT run: a `cancelled` outcome or a turn cancelled while the request is pending reports the call as cancelled, and a client or transport error reports it as failed.

#### Scenario: Client cancels
- **WHEN** the client answers a permission request with `cancelled`
- **THEN** the call does not run and is reported as cancelled

#### Scenario: Turn cancelled while waiting
- **WHEN** the user cancels the turn while a permission request is pending
- **THEN** the call does not run

#### Scenario: Negative control
- **WHEN** the client's `session/request_permission` call fails with a transport error
- **THEN** the call running MUST fail: it is reported as failed and does not execute

### Requirement: A user steer supersedes an open permission request
A user steering message admitted into the running turn while a permission request is open SHALL end the request without running the call, when the loop's `interruptMode` allows interrupting the call: the call fails as superseded, a v1 client's dialog is withdrawn, and the steer is delivered ahead of older queued steers. Steering the agent queued itself SHALL NOT end the request.

#### Scenario: User steer while the dialog is open
- **WHEN** the client sends `_session/steering` while a permission request for a gated call is pending
- **THEN** the call does not run, its result reads `Permission request superseded by user steering`, the requester's steer signal aborts, and the steer reaches the model before an older queued steer

#### Scenario: Negative control
- **WHEN** only an agent-authored steer is queued while the request is pending
- **THEN** the request ending MUST fail: the dialog stays open and the call waits for the client's answer
