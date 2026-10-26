# Spec Delta

## Purpose

Keeps the session id an ACP client holds bound to one transcript for as long as the ACP session is open, because ACP has no message that tells a client the agent replaced or closed its session.

## ADDED Requirements

### Requirement: Extension commands cannot replace an ACP session's transcript

In an ACP session, the extension command actions `newSession`, `branch` and `switchSession` SHALL return `{ cancelled: true }` and leave the session id, session file and conversation unchanged; a `newSession` `setup` callback SHALL NOT run. Updates for the session SHALL keep carrying the id the client was given. `navigateTree` and `reload` SHALL keep working. Outside ACP (TUI, RPC, print) all five actions SHALL behave as before.

#### Scenario: Extension starts a new session under ACP

- **WHEN** an ACP client sends `session/prompt` for session A with an extension command whose handler calls `ctx.newSession({ setup })` and records the result
- **THEN** the handler receives `{ cancelled: true }`, `setup` is not called, and a following `session/prompt` for A produces updates whose `sessionId` is A and is persisted in A's session file

#### Scenario: Extension switches or branches under ACP

- **WHEN** an extension command in ACP session A calls `ctx.switchSession(<path of another stored session>)` or `ctx.branch(<user entry id>)`
- **THEN** the call returns `{ cancelled: true }`, `session/list` shows no new session, and A's next prompt continues A's conversation

#### Scenario: Tree navigation still works under ACP

- **WHEN** an extension command in ACP session A calls `ctx.navigateTree(<earlier entry id>)`
- **THEN** the call returns `{ cancelled: false }`, the session's leaf moves to that entry, and later updates still carry session id A

#### Scenario: Negative control

- **WHEN** an extension command in ACP session A calls `ctx.newSession()` and the call returns `{ cancelled: false }`, or a later update for the client's prompt to A carries a session id other than A
- **THEN** the session-identity check MUST fail

### Requirement: Deleting the current session ends the ACP session

When `/session delete` deletes the current file of an ACP session, the prompt turn SHALL finish with the confirmation text and the agent SHALL then close the session as `session/close` would. A later `session/prompt` for the id SHALL fail as for an id never issued, the file SHALL stay deleted and `session/list` SHALL NOT list it. A failed delete SHALL report the failure and leave the session open.

#### Scenario: Prompt after delete

- **WHEN** an ACP client runs `/session delete` in session A and, after that prompt returned, sends another `session/prompt` for A
- **THEN** the first prompt ends with `stopReason: "end_turn"` after the deletion message, the second prompt is rejected as an unknown session, no file for A exists in the session directory, and `session/list` does not contain A

#### Scenario: Delete fails

- **WHEN** `/session delete` cannot remove A's session file (for example the file system refuses the delete)
- **THEN** the prompt reports `Failed to delete session: <reason>`, A stays open, and a following prompt for A runs normally and is persisted in A's original session file

#### Scenario: Negative control

- **WHEN** an ACP client runs `/session delete` in session A and a following `session/prompt` for A is accepted, or a file whose first line is not a session title or header entry appears for A
- **THEN** the delete-closes-session check MUST fail
