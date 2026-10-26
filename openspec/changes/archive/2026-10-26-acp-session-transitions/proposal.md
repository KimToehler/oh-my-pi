# Proposal

## Why

Two verified P0 bugs (`.omp/plans/ACP_TUI_PARITY_BACKLOG.md`, P0 items 3 and 4, reproduced 2026-10-24 against the real `omp acp` with a fixture model) make an ACP client lose output or keep writing into a deleted session:

- An extension command that calls `ctx.newSession()`, `ctx.branch()` or `ctx.switchSession()` swaps the transcript under the ACP session. The client is never told; every later update for its session id carries a new id it never saw, so Zed shows no reply, and `session/list` shows the old and the new transcript as unrelated sessions.
- `/session delete` deletes the file but leaves the ACP session open. The next prompt still runs with the deleted conversation in context, and omp recreates the file without its title and session header lines, so the session vanishes from `session/list` while omp keeps writing to it.

ACP has no message that tells a client its session was replaced or closed by the agent, so the session id a client holds must stay valid and stable for as long as the session is open.

## What Changes

- **BREAKING (ACP only):** In an ACP session, the extension command actions `newSession`, `branch` and `switchSession` are refused: they return `{ cancelled: true }`, run no `setup` callback and leave the session id and transcript unchanged. `navigateTree` and `reload` keep working; they stay on the same session id. The TUI, RPC and print modes are unchanged.
- `/session delete` in an ACP session closes that ACP session once the command's turn has ended. A later `session/prompt` for the id fails as an unknown session, `session/list` no longer lists it, and no file is recreated.
- A session store that deleted its current session file no longer writes to that path: entries appended after the delete are not persisted and nothing recreates the deleted file, in every mode. Starting or switching to another session restores normal persistence.

## Capabilities

### New Capabilities

- `acp-session-identity`: the session id an ACP client holds stays bound to one transcript for the session's lifetime; agent-side actions that would replace or delete that transcript either are refused or end the ACP session.
- `session-store-deletion`: what a session store does after its current session file was deleted, so no write recreates a deleted session.

### Modified Capabilities

None. `acp-client-bridge` and `acp-tool-permissions` cover file routing and approvals, not session identity.

## Impact

- `packages/coding-agent/src/modes/acp/acp-agent.ts`: extension command actions for ACP sessions; closing the ACP session after `/session delete`.
- `packages/coding-agent/src/slash-commands/builtin-session.ts` and the slash-command runtime type: a host hook the `handle` path of `/session delete` calls after the drop.
- `packages/coding-agent/src/session/session-manager.ts`: `dropSession` of the current file leaves the store in-memory until `newSession` or `switchSession` assigns another file.
- Extension authors: under ACP, `ctx.newSession`/`ctx.branch`/`ctx.switchSession` report cancellation. Documented in `docs/extensions.md`.
- ACP clients: a session the user deleted with `/session delete` answers later prompts with an unknown-session error instead of silently continuing.
