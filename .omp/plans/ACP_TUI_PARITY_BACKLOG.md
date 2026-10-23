# ACP vs TUI parity backlog

Status: analysis snapshot, not an executable plan. Each item becomes its own plan with its own gate before work starts. Related draft: `ACP_V2_EXTRAS_PLAN.md` (v2 protocol slots); items from it are referenced as "Extras N".

- Snapshot: `main` at `bddd5f7fe7`, 2026-10-24.
- Method: three read-only code analyses (commands/modes, rendering/interaction, session/config). Nothing was executed.
- Evidence key: **[verified]** = checked in code by the main session; **[analysis]** = subagent finding with file:line, not re-checked; **[unverified]** = plausible code path, needs a repro before work.
- Refresh: before acting on an item, re-check its file:line at the current HEAD; update this file instead of re-running the full analysis.
- Paths are relative to `packages/coding-agent/src/` unless stated.

## P0 — safety / consistency

1. **ACP permission gate too narrow** [verified]. `PERMISSION_REQUIRED_TOOLS` = `bash`, `edit`, `delete`, `move` (`session/acp-permission-gate.ts:7-12`); `edit` prompts only for delete/move intent (`:78-97`). `write`, plain `edit`, `ast_edit`, `eval`, `ssh`, `browser` run unprompted, so a client "Always reject" on `bash` is bypassable via `eval`. TUI uses tiered approval (`tools/approval.ts`: read/write/exec). Needs a product decision on which tiers prompt in ACP.
2. **Subagents bypass the ACP gate and client bridge** [verified]. Subagents run `tools.approvalMode: "yolo"` because "the parent task approval is the authorization boundary" (`task/executor.ts:1213-1216`), but `task` is not gated in ACP. Subagents are `hasUI: false` (`task/executor.ts:4781` [analysis]); `setClientBridge` only at `modes/acp/acp-agent.ts:1589`, so subagent read/write/bash skip unsaved buffers, client terminal and permission prompts. Applies to plain `task`, not only vibe. Fix direction: inherit a parent permission broker/bridge via `SubagentSessionSpec`.
3. **Session id drift after in-place session change** [unverified]. `#sessions` keyed by id at registration (`modes/acp/acp-agent.ts:1615`), never re-keyed; updates use live `record.session.sessionId`. Extension `ctx.newSession()` / `switchSession()` run in place (`:2783-2821`), so updates may target an id the client never saw. Repro first.
4. **`/session delete` leaves the record registered** [unverified]. Calls `dropSession`, no `session/close` (`slash-commands/builtin-session.ts:272-289`); next prompt may recreate the file. Repro first.

Items 1+2 touch an authorization path → Mandatory class `auth-secrets-pii`.

## P1 — core workflow missing / looks hung

- **Retry, fallback-model and `notice` events dropped** [analysis]. `modes/acp/acp-event-mapper.ts:268` `default: return []`; no `auto_retry_*`, `retry_fallback_*`, `notice` handler. Rate limits look like hangs; model switch invisible. v2 slot exists (Extras 3); v1 needs a thought/message-chunk fallback.
- **Compaction silent** [analysis]. Only a `usage_update` after `auto_compaction_end` (`acp-agent.ts:1687-1689`). v2 slot unused (Extras 4).
- **Subagent progress invisible** [analysis]. `subagentEventBus` consumed only by `main.ts` and `modes/interactive-mode.ts`; a `task` call is one static tool row (`task/index.ts:1280-1340`); `details.progress` only in `rawOutput` (`acp-event-mapper.ts:215-220`).
- **Branch / rewind / tree unreachable** [analysis]. `AgentSession.branch`/`navigateTree` exist but only the extension runner reaches them (`acp-agent.ts:2795-2812`); no command `handle`, no `_omp/` method.
- **Replay misattribution + unstable ids** [analysis]. developer/custom/hook messages replayed as `user_message_chunk` (`modes/acp/acp-replay.ts:42-54`); `bashExecution`/`pythonExecution`/`compactionSummary` too (`:75-82`); ids `randomUUID()` per replay (`:94`). Baseline residual risks 3+4; Extras 6.
- **Auth never reports `authRequired`** [analysis]. `authenticate` only validates method id (`acp-agent.ts:655-664`); missing credentials surface at first prompt.
- **One bad client MCP server fails session setup** [analysis] (`acp-agent.ts:2915-2921`). omp's own MCP config is off in ACP by design (`main.ts:579`, rationale `:535-541`) — at least surface that.
- **v2 has no live terminal** [analysis]. v2 drops `terminal` content (`acp-event-mapper-v2.ts:230-232`); agent-owned terminals are Extras 1.
- **Goal controls missing** [analysis]. No ACP path for goal `budget`/`drop`/explicit `resume`/`show`; only mode select + Stop-pause (`modes/acp/acp-goal.ts:467-469`). `/goal drop` deferred in `ACP_GOAL_MODE_PLAN.md:132`.
- **TUI-only slash commands go to the model as text** [analysis]. Unresolved builtin falls through to `session.prompt` (`acp-agent.ts:999-1002` → `:1068`); affects `/new`, `/clear`, `/plan <prompt>`, `/loop`, … Cheap fix: answer "not available in ACP".
- **Clients without `elicitation.form`** [analysis]. Dialogs return `undefined`/`false` silently (`acp-agent.ts:417-445`); `ask` not offered.

## P2 — useful parity

- Modes: `/loop` (state + timer live in `InteractiveMode`, `interactive-mode.ts:1342-1346`, `:3028-3260`), `/vibe` (see root cause 3), `/guided-goal`, `/plan-review` reopen, `/plan <prompt>` inline entry.
- Session: `/clear`, fork at entry (v1 `unstable_forkSession` forks at leaf only, `acp-agent.ts:711`; v2 fork = Extras 5), session import (`/resume @claude|@codex`), pinned ordering.
- Config: only mode/model/thinking options (`acp-agent.ts:2113-2159`); expose `/fast`, `/slow`, `/extended-context` etc. as options with visible state; model roles have no ACP surface.
- Rendering: todo phases flattened (`acp-event-mapper.ts:433-456`); `queue_update` unmapped; TTSR/IRC notices dropped; extension `notify` debug-log only (`acp-agent.ts:546-548`); per-subagent usage/cost; `tool_call_content_chunk` (Extras 2); no pre-apply diff preview (`tool_stream_update` unmapped).
- Cancel cleanup timeout closes the whole session (`acp-agent.ts:1167-1169`).
- Side agents: `/btw`, `/tan`.
- v2 steering of builtin commands not routed (`acp-agent.ts:731-732`).

## P3 — intentionally TUI-only / cosmetic

Vim mode, hotkeys, record, copy, quit/exit/restart, pause, live, debug, stats dashboard, settings/setup UI, `/login`/`/logout` (ACP has auth methods), collab/join/leave, extension widgets/status/footer/header/title, streaming reveal, loader, TTS, composer prediction, `/skills` management, `/hub`, `/agents`.

## Already at parity (do not re-analyse)

Images (prompt, model, tool), thinking content + level option, model selection + `/model`/`/switch`, plan mode + approval elicitation, goal mode entry, prewalk, skills/extension/custom/MCP-prompt commands, export/share/dump/trace, rename/move/wt/dirs/compact/handoff/memory/retry/shake, jobs via `/jobs`, usage/context meter, close/cancel.

## Root causes

1. **Event mapping is a `switch` with silent `default`** (`acp-event-mapper.ts:193-270`); v2 `convertV1UpdateToV2` is a lossy wrapper (`acp-event-mapper-v2.ts:42-125`). New session events miss ACP silently.
2. **Permission/bridge state is per session and not inherited by subagents** (`session/session-tools.ts:882-889`, `task/executor.ts:1216`).
3. **Mode and session-transition logic lives in `InteractiveMode`**, not the session layer. ACP re-implemented plan/goal (`acp-agent.ts:2250` mirrors `#enterPlanMode`); vibe, loop, branch have no session-layer controller. Every new ACP mode costs a second implementation until this moves.
4. **`handle` vs `handleTui` split**: a command is ACP-visible only with a text `handle` (`slash-commands/acp-builtins.ts:37-39`); mode commands have only `handleTui`.
5. **Session setup is all-or-nothing** (MCP throw, auth pass-through): failures surface late as prompt errors.

## Recommended order

1. Permission gate + subagent inheritance (P0 1+2) — own plan, full gate, decision on tiers needed from Tim.
2. Event-mapping table with unmapped-event log + v1 fallback for notice/retry/compaction; v2 slots from Extras 3/4.
3. Extract mode/session-transition controllers from `InteractiveMode` (plan, goal, vibe, loop, branch); prerequisite for vibe/loop/branch in ACP.
4. Small fixes, each standalone: TUI-only command reply, skip failing MCP server, `authRequired`, session-id re-key (after repro), `/session delete` close (after repro).

## Open plan residue (from `ACP_*` plans)

- `ACP_STEER_BUILTIN_COMMANDS_PLAN.md:185-188` and `ACP_PLAN_APPROVAL_MODEL_PLAN.md:110-113`: F1–F3 unticked — treat as not fully landed.
- `ACP_V2_BASELINE_PLAN.md:428-432`: residual risks 2–6 (draft v2 schema, live-only ids, unstable replay ids, goal lane after Stop, goal admission after close).
- `ACP_PLAN_APPROVAL_MODEL_PLAN.md:106-107`: no clear/compact approval variants; IntelliJ recommended-model preselect unconfirmed.

- Merge gate: not applicable (analysis backlog only; each item becomes its own plan with its own gate before execution)
