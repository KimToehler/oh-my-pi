# tool-approval Specification

## Purpose
Defines approval rules that hold on every surface (TUI, RPC, ACP): which tool calls must always be confirmed, how a session-long rejection works, and what a subagent inherits from its parent's approval decisions.

## Requirements

### Requirement: Destructive file operations ask outside yolo
An edit call whose file operations delete or move a file SHALL require a user prompt in the `always-ask`, `always-ask-cached` and `write` approval modes, even when a user `allow` policy covers the edit tool. A user `deny` policy still blocks it. In `yolo` the call follows its tier as before.

#### Scenario: Delete in write mode asks
- **WHEN** the approval mode is `write` and the model calls `edit` with a patch that deletes `src/a.ts`
- **THEN** the user is asked before the file is deleted, and the file still exists if the user denies

#### Scenario: Move with an allow policy still asks
- **WHEN** the approval mode is `always-ask`, `tools.approval.edit` is `allow`, and an edit renames `a.ts` to `b.ts`
- **THEN** the user is asked before the rename runs

#### Scenario: Plain edit in write mode does not ask
- **WHEN** the approval mode is `write` and an edit only changes lines inside an existing file
- **THEN** the edit runs without a prompt

#### Scenario: yolo keeps destructive edits unprompted
- **WHEN** the approval mode is `yolo` and no user policy names `edit`
- **THEN** an edit that deletes a file runs without a prompt

#### Scenario: Negative control
- **WHEN** the approval mode is `write`, the session already holds an "approve for this session" answer for `edit` at write tier, and the model deletes a file through `edit`
- **THEN** running the delete without a new prompt MUST fail: the user is asked again

### Requirement: Destructive file-operation prompts are per call
A prompt raised for a destructive file operation SHALL offer only "this call" approval and rejection. No answer to it covers a later call.

#### Scenario: Second delete asks again
- **WHEN** the user approved one file deletion through `edit` and the model deletes another file in the same session
- **THEN** the user is asked again

#### Scenario: Negative control
- **WHEN** a host offers a session-wide approval for a delete prompt and the user picks it
- **THEN** a later delete running without a prompt MUST fail: the second delete is asked again

### Requirement: Session-long rejection
When the user answers a prompt with "always reject", the session SHALL deny every later call of the same tool (or `xd://` device) at the same tier without asking, for the rest of that session. A new or switched session starts without denials. The answer is offered only on prompts that also offer "approve for this session".

#### Scenario: Rejected bash stays rejected
- **WHEN** the user answered "always reject" to a `bash` prompt and the model later calls `bash` with a different command
- **THEN** the call is denied without a prompt and the command does not run

#### Scenario: Other tools still ask
- **WHEN** `bash` was rejected for the session and the model calls `eval`
- **THEN** the `eval` call is prompted normally

#### Scenario: New session starts clean
- **WHEN** `bash` was rejected for good in one session and the user starts a new session
- **THEN** the first `bash` call in the new session is prompted

#### Scenario: Negative control
- **WHEN** `bash` was rejected for the session and the model retries with a critical command that would normally force a per-call prompt
- **THEN** running the command or showing a prompt for it MUST fail: the call is denied without a prompt

### Requirement: Subagents inherit session denials
A subagent SHALL be denied every call that matches a session denial of its parent or any ancestor session, by tool (or device) and tier, including denials recorded after the subagent started. This holds although subagents run without prompts.

#### Scenario: Task child cannot run rejected bash
- **WHEN** the parent session rejected `bash` for good and a `task` subagent calls `bash`
- **THEN** the subagent's call is denied and the command does not run

#### Scenario: Denial recorded during a run
- **WHEN** a subagent is running and the parent session then rejects `bash` for good
- **THEN** the subagent's next `bash` call is denied

#### Scenario: Grandchild inherits
- **WHEN** the root session rejected `bash` for good and a subagent's own subagent calls `bash`
- **THEN** that call is denied

#### Scenario: Undenied tools run unprompted
- **WHEN** the parent rejected `bash` for good and a subagent calls `edit` on a file
- **THEN** the edit runs without a prompt, as subagents always did

#### Scenario: Negative control
- **WHEN** the parent session rejected `bash` for good and a vibe worker or an eval `agent()` child calls `bash`
- **THEN** the command running MUST fail: the call is denied
