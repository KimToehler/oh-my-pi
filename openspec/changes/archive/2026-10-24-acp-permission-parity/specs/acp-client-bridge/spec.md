# Spec Delta

## Purpose

Defines which sessions read and write files through the connected ACP client (so unsaved editor buffers are visible and writes go through the editor), including the subagents an ACP session spawns.

## ADDED Requirements

### Requirement: Subagents read through the ACP client
A non-isolated subagent of an ACP session (task, eval `agent()`, vibe worker, revived agent) SHALL read text files through the client's `fs/read_text_file` when the client advertises it, so it sees unsaved editor content.

#### Scenario: Unsaved buffer visible to a subagent
- **WHEN** the client holds unsaved changes to `src/a.ts` and a `task` subagent reads `src/a.ts`
- **THEN** the subagent receives the unsaved content

#### Scenario: Client without file-system capability
- **WHEN** the client does not advertise `fs.readTextFile`
- **THEN** the subagent reads from disk as before

#### Scenario: Negative control
- **WHEN** the client holds unsaved changes to a file and a vibe worker reads it
- **THEN** the worker receiving the on-disk content MUST fail: it receives the client's content

### Requirement: Subagents write through the ACP client
A non-isolated subagent of an ACP session SHALL write text files through the client's `fs/write_text_file` wherever the parent session would route the same write through the client.

#### Scenario: Subagent write goes through the editor
- **WHEN** the client advertises `fs.writeTextFile` and a `task` subagent writes `src/b.ts` in the workspace
- **THEN** the client receives an `fs/write_text_file` request for `src/b.ts`

#### Scenario: Negative control
- **WHEN** the client advertises `fs.writeTextFile` and a subagent writes a workspace file
- **THEN** the file changing on disk without an `fs/write_text_file` request MUST fail

### Requirement: Subagents get no client terminal or dialog
A subagent of an ACP session SHALL NOT create client terminals, send permission requests or start agent-initiated turns. Its shell commands run locally.

#### Scenario: Subagent bash runs locally
- **WHEN** the client supports terminals and a subagent calls `bash`
- **THEN** the command runs in a local shell and no `terminal/create` request is sent

#### Scenario: Negative control
- **WHEN** a subagent's tool call resolves to a prompt
- **THEN** a `session/request_permission` request for it MUST fail to appear: the call is rejected inside the subagent

### Requirement: Isolated subagents stay off the client file system
A subagent that runs in its own isolated workspace SHALL read and write files locally and SHALL NOT send `fs/*` requests to the client.

#### Scenario: Isolated task
- **WHEN** a `task` subagent runs with isolation enabled and writes a file in its workspace
- **THEN** no `fs/write_text_file` request is sent

#### Scenario: Negative control
- **WHEN** an isolated subagent reads a file in its workspace
- **THEN** an `fs/read_text_file` request for that path MUST fail to appear
