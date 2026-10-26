# Design

## Context

See proposal.md - Why. Facts the approach depends on:

- `AcpAgent` keys its session records by the id it handed out at registration (`#sessions.set(record.session.sessionId, record)` in `modes/acp/acp-agent.ts`) and never re-keys them, while every update is sent with the live `record.session.sessionId`. `AgentSession.newSession`, `branch` and `switchSession` all mint or load another session id in place.
- The extension command actions for ACP sessions are wired in `#configureExtensions` (`newSession`, `branch`, `navigateTree`, `switchSession`, `reload`, each wrapped in `#goalSessionChange`). These are the only in-place id changes reachable from ACP: no builtin with a text-mode `handle` calls `newSession`/`branch`/`switchSession`; `/move` keeps the id; `/handoff` compacts in place; `navigateTree` stays inside the session file; `reload` re-opens the same file.
- `/session delete` runs the `handle` path in `slash-commands/builtin-session.ts`, which calls `runtime.sessionManager.dropSession(sessionFile)` and nothing else. `SessionManager.dropSession` drains the writer and deletes the file but keeps `#sessionFile` pointing at it, so the next append re-opens the path with `flags: "a"` and writes a body without title or header.
- `AgentSession.dispose` writes a `session_exit` custom entry. Closing the ACP session after a delete therefore recreates the file too unless the store stops persisting first; the repro's recreated file contains exactly that entry.
- `SessionManager` already supports an in-memory session: every persistence path is guarded by `this.#persist && this.#sessionFile` (or its negation), and `newSession`/`setSessionFile` assign a fresh `#sessionFile`.

## Goals / Non-Goals

**Goals:**

- The id an ACP client holds addresses one transcript until the session is closed.
- A deleted current session file stays deleted in every mode.

**Non-Goals:**

- Letting extensions replace an ACP session's transcript (option 2 of the backlog: a `_meta` "session replaced" notification). Can be added later on top of this refusal.
- Re-keying `#sessions` when the live id changes (option 1).
- Changing TUI, RPC or print behaviour of the extension actions or of `/session delete`, beyond the store no longer recreating a deleted file.
- An agent-to-client "session closed" notification; ACP has none.

## Decisions

### D1. Refuse in-place transcript replacement in ACP (user decision, 2026-10-24)

The ACP wiring of `newSession`, `branch` and `switchSession` returns `{ cancelled: true }` before touching the session and logs one `logger.warn` naming the action and the session id, so an extension author can see why. `navigateTree` and `reload` stay wired as today.

Alternatives considered (presented to the user, who chose this one): (1) keep A's id for the client and map it to whatever session runs underneath: `session/load A` would later show A's old transcript without the continuation, so the mapping would leak; (2) close A and announce B through an omp `_meta` extension: correct, but no client implements it and it needs a wire extension. Refusal is the smallest correct behaviour and can be widened to (2) later.

The refusal lives in the ACP wiring, not in `AgentSession`, because the TUI and RPC handle the id change correctly (they re-render or re-key from the live session).

Consequence for ACP Goal mode (found during apply, user decision 2026-10-25): `AcpGoalActor` and the shared `GoalHostController` handle an in-place transcript switch (new transcript id adopting its own goal; transcript-generation stamps, selection reset, Stop's late pause fenced to its own transcript). With the refusal, ACP can no longer produce that state: `navigateTree` and `reload` keep the session id, and `GoalHostController.endSessionChange` treats a same-id change as a no-op that never adopts another goal. The 23 tests in `test/acp-agent.test.ts` (`ACP Goal mode`) that drive the swap through extension `newSession`/`switchSession` therefore test unreachable behaviour and are deleted; retargeting them to `reload` was tried and cannot reproduce the swap. The id-change branches in `AcpGoalActor` (`#syncTranscript` bumping the generation, the selection reset in `endSessionChange`) stay as defensive guards with a comment naming why: they become live again if ACP later gains session replacement (alternative 2). Tests that drive the actor's own `beginSessionChange`/`endSessionChange` directly (not through the refused extension actions) stay, and the shared controller's transcript-switch handling keeps its coverage in `test/goals/goal-host-controller.test.ts`.

### D2. Store goes in-memory when it deletes its current file

`SessionManager.dropSession(path)` clears `#sessionFile` (and the per-file state that belongs to it: pending artifact copy, expected disk size, current-file marking) when `path` resolves to the current session file, synchronously right after the file removal succeeded (ENOENT counts as success, as today). From then on every existing `#persist && #sessionFile` guard skips persistence, exactly as for a non-persisted session. A removal that throws leaves the state untouched, so the original file stays the persistence target. `newSession` and `setSessionFile` (used by `switchSession`) assign a new file and restore persistence without extra code. `getSessionFile()` returns `undefined` afterwards, which is the truth.

Alternatives: (a) a separate `#dropped` latch checked in the append path: a second flag every write path would need to consult, and missing one recreates the file; (b) throwing from writes after a drop: async late writers (title generation, usage, exit entries) race the TUI's drop-then-`newSession` window and would surface as errors for a state the user asked for.

### D3. ACP closes the session after a successful `/session delete`

`SlashCommandRuntime` gets an optional host hook `endSessionAfterTurn?(): void`. The `handle` path of `/session delete` calls it synchronously after a successful `dropSession` (a failed delete returns before it). The ACP runtime implements it in two steps:

1. **Pending close, synchronously in the hook.** The record leaves `#sessions` at once and is parked in `#closing`, the state `#closeManagedSession` already uses while a `session/close` runs, as an entry whose close has not started yet. Every route that resolves a session id through `#sessions` therefore finds nothing and fails exactly as for an id the agent never issued (`Unsupported ACP session: <id>`, or the route's existing not-found outcome), without a per-route guard: `session/prompt` on v1 and v2, `_session/steering`, `session/set_mode`, `session/set_config_option`, `session/load`, `session/resume`, `unstable_session/fork`, and any route added later. `closedError` is not set yet, so the delete turn's own confirmation and turn end still reach the client: the surfaces resolve the running turn's record through `recordFor`, which already falls back to `#closing` (`acp-agent.ts:794`). The routes that must still reach the record resolve it there as well: `session/cancel` (falls back to `#closing`), `session/close` (starts the pending close at once instead of only awaiting it), and agent dispose (closes pending entries next to `#sessions`).
2. **Close at turn settlement.** When the prompt turn that ran the command has settled (v1: its prompt response is resolved; v2: its foreground has ended), the pending entry's close runs through the existing close path (set `closedError`, reject anything queued, drain the surface, dispose the record) unless `session/close` or agent dispose already ran it; the entry leaves `#closing` when that close completes.

Hosts without the hook (RPC, print) keep today's behaviour, now without file recreation thanks to D2.

Closing from inside the command would cancel the very prompt turn that has to report the deletion; closing on the next `session/prompt` would still accept one stale request. Pending close plus close at settlement gives the client the confirmation text and its normal turn end, and an unknown-session error for every request that arrives after the delete succeeded, including one sent while the delete turn is still finishing.

### D4. Scope: three modules, one change

The change touches the ACP agent, the slash-command runtime contract and `SessionManager`. They cannot ship separately: D3 alone still recreates the deleted file when closing disposes the session (`session_exit` entry), and D2 alone leaves the ACP session accepting prompts for a deleted conversation. D1 shares the ACP extension wiring and the same verification driver. The slash-command change is one optional hook plus one call.

## Risks / Trade-offs

- [An extension relies on `ctx.newSession()` under ACP] → It now gets `{ cancelled: true }`, which every caller already has to handle (the TUI can cancel through `session_before_switch`). Documented in `docs/extensions.md` and the changelog.
- [Code reads `getSessionFile()` after a drop and assumes a path] → Callers of `dropSession`: `/session delete` (reads the file before the drop), `AgentSession.newSession({ drop })` (calls `newSession` right after), `cleanupEmptyMoveSession` (during dispose), the task executor's failed-fork cleanup (discards the manager). Each is checked in tasks; none needs the deleted path afterwards.
- [Closing at turn settlement races a steered or queued prompt for the same session] → The close path already rejects queued prompts with `closedError`, as for `session/close` during a turn.

## Migration Plan

No data migration. Rollback is a revert; stored sessions are unaffected because the change only stops writes to deleted files.
