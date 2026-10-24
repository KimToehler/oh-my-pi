# Proposal

## Why

ACP sessions authorize tool calls with a second, narrower permission system than the TUI: a fixed list (`bash`, destructive `edit`) gates calls through `session/request_permission`, while `write`, plain `edit`, `ast_edit`, `eval`, `task`, `vibe_*`, `ssh://`, `browser` and MCP tools run unprompted. A user who answers "Always reject" for `bash` in Zed still gets shell commands executed via `eval` or a spawned subagent, because subagents run headless in `yolo` and never see the ACP gate or the client bridge. These are the two P0 items in `.omp/plans/ACP_TUI_PARITY_BACKLOG.md`.

## What Changes

- ACP tool authorization uses the same approval resolution as the TUI: tiers (read/write/exec), `tools.approval` policies, `bash.patterns`, critical-command overrides, `tools.approvalMode`, session approvals and `always-ask-cached` grants. ACP only supplies the dialog: every prompt becomes one `session/request_permission` request instead of a form elicitation.
- **BREAKING (ACP behaviour):** when `tools.approvalMode` is not configured (no global/project setting, no `--config`, no `--approval-mode`/`--auto-approve`), ACP sessions use `write` instead of the implicit `yolo`-with-bash-gate. Effect: exec-tier calls (`bash`, `eval`, `task`, `vibe_spawn`, `vibe_send`, `ssh://`, `browser`) ask; plain file writes and edits run without a prompt, and so do MCP tools, which are `write` tier (`mcp/tool-bridge.ts:728,866`) exactly as in the TUI. An explicitly configured mode applies in ACP exactly as in the TUI.
- Deleting or moving a file through an edit prompts in every approval mode except `yolo`, on all surfaces (TUI included), and that prompt cannot be remembered for the session.
- A new "Always reject" answer (ACP `reject_always`) denies later calls of the same tool at the same tier for the rest of the session.
- Subagents (task, eval `agent()`, vibe workers, workpool/isolation runs, revived agents) inherit their parent's session denials: a call the parent session rejected for good is denied in every descendant.
- Non-isolated subagents of an ACP session read and write files through the ACP client (unsaved buffers visible, writes go through the editor). They do not get the client's terminal or permission dialog.
- Removed: the separate ACP permission proxy (`PERMISSION_REQUIRED_TOOLS`, its in-memory `allow_always`/`reject_always` cache, the `acpApprovedArgs` bypass and the implicit-yolo special case for bash).

## Capabilities

### New Capabilities
- `tool-approval`: surface-independent approval rules this change introduces: destructive file-operation prompts, session-scoped denials, and their inheritance by subagents.
- `acp-tool-permissions`: how an ACP session authorizes tool calls: effective default mode, one client permission request per prompt, option mapping, and fail-closed outcomes.
- `acp-client-bridge`: which sessions use the ACP client's file system, including subagents of an ACP session.

### Modified Capabilities
<!-- none: existing specs cover the merge gate and team-config only -->

## Impact

- `packages/coding-agent/src/tools/approval.ts`, `src/extensibility/extensions/{wrapper,runner,types}.ts`: session denials, prompt call identity, destructive-edit override.
- `src/edit/index.ts`: delete/move intent returns a prompt override.
- `src/modes/acp/acp-agent.ts`, `src/modes/acp/acp-client-bridge.ts`, ACP surfaces v1/v2, `src/main.ts` (ACP session factory): approval dialog through `session/request_permission`, ACP default mode.
- `src/session/session-tools.ts`, `src/session/acp-permission-gate.ts`, `src/session/agent-session.ts`: removal of the proxy gate; `extractPermissionLocations` kept for request locations.
- `src/task/executor.ts`, `src/task/structured-subagent.ts`, `src/vibe/runtime.ts`, revive paths: inherited denials and file-system bridge for children.
- ACP wire: permission requests now carry TUI-derived titles and a variable option list; clients that relied on the fixed four option ids keep working (ids map to the four ACP option kinds).
- Docs: `docs/approval-mode.md` (ACP section), `docs/tools/task.md`; `packages/coding-agent/CHANGELOG.md`.
- Tests: `test/agent-session-acp-permission.test.ts` (rewritten against the new contract), `test/tools/approval*.test.ts`, `test/acp-v2.test.ts`, new subagent inheritance tests.
