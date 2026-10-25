# ACP vs TUI parity backlog

Status: analysis snapshot, not an executable plan. Each item becomes its own plan with its own gate before work starts. Related draft: `ACP_V2_EXTRAS_PLAN.md` (v2 protocol slots); items from it are referenced as "Extras N".

- Snapshot: `main` at `bddd5f7fe7`, 2026-10-24; refreshed at `dfdededea0` (after merging 269 `main` commits: generic `_session/steering`, ACP MCP reauth) for the items marked "refreshed". Other `acp-agent.ts` line refs predate the refresh (file grew ~450 lines): re-check before use.
- Method: three read-only code analyses (commands/modes, rendering/interaction, session/config). Nothing was executed.
- Evidence key: **[verified]** = checked in code by the main session; **[analysis]** = subagent finding with file:line, not re-checked; **[unverified]** = plausible code path, needs a repro before work.
- Refresh: before acting on an item, re-check its file:line at the current HEAD; update this file instead of re-running the full analysis.
- Paths are relative to `packages/coding-agent/src/` unless stated.

## P0 — safety / consistency

1. ~~**ACP permission gate too narrow**~~ **Done** (OpenSpec `2026-10-24-acp-permission-parity`, merged to `main` at `733e681406`): ACP uses the TUI approval resolver; unconfigured ACP mode is `write`; `reject_always` is a session denial; the proxy gate is gone.
2. ~~**Subagents bypass the ACP gate and client bridge**~~ **Done** (same change): descendants inherit session denials; non-isolated subagents read/write through the ACP client (no client terminal or permission dialog, by design).
3. **Session id drift after in-place session change** [verified by repro, 2026-10-24]. `#sessions` is keyed once at registration (`modes/acp/acp-agent.ts:1925`) and never re-keyed; updates use the live `record.session.sessionId`. Repro (real `omp acp`, fixture model, extension command calling `ctx.newSession()`): the command sends no update at all; the next `session/prompt` addressed to the original id A is accepted, but every update for it (reply chunk, usage, session_info) carries a new id B the client never saw, so a client that drops unknown session ids (Zed) shows nothing. The continuation is persisted in B's file; `session/list` shows A and B as unrelated sessions. Trigger in ACP: extension `ctx.newSession()` / `branch()` / `switchSession()` (`acp-agent.ts:3141-3179`); `/move` keeps the id; `/handoff` not checked. Fix needs a decision: keep the ACP id stable as an alias of the record (but `session/load A` then misses the continuation), close A and tell the client to open B, or refuse in-place transitions in ACP.
4. **`/session delete` leaves the record registered** [verified by repro, 2026-10-24]. Calls only `dropSession` (`slash-commands/builtin-session.ts:282`), no ACP close. The file is deleted, but the record stays live: the next `session/prompt` to the same id succeeds with the deleted conversation still in context, and the writer recreates the file **without its title and session header lines** (first line `type=message`, parentId pointing at deleted entries), so the session vanishes from `session/list` while it keeps being written. Fix direction: close the ACP record after the drop (later prompts fail as unknown session), and make `SessionManager` refuse writes after `dropSession` instead of recreating a header-less file.

Repro driver for 3+4 (throwaway, not committed): `/tmp/acp-repro/repro.ts <worktree root>`.

Items 1+2 touch an authorization path → Mandatory class `auth-secrets-pii`.

## P1 — core workflow missing / looks hung

- **Retry, fallback-model and `notice` events dropped** [analysis]. `modes/acp/acp-event-mapper.ts:268` `default: return []`; no `auto_retry_*`, `retry_fallback_*`, `notice` handler. Rate limits look like hangs; model switch invisible. v2 slot exists (Extras 3); v1 needs a thought/message-chunk fallback.
- **Compaction silent** [analysis]. Only a `usage_update` after `auto_compaction_end` (`acp-agent.ts:1687-1689`). v2 slot unused (Extras 4).
- **Subagent progress invisible** [analysis]. `subagentEventBus` consumed only by `main.ts` and `modes/interactive-mode.ts`; a `task` call is one static tool row (`task/index.ts:1280-1340`); `details.progress` only in `rawOutput` (`acp-event-mapper.ts:215-220`).
- **Branch / rewind / tree unreachable** [analysis]. `AgentSession.branch`/`navigateTree` exist but only the extension runner reaches them (`acp-agent.ts:2795-2812`); no command `handle`, no `_omp/` method.
- **Replay misattribution + unstable ids** [analysis]. developer/custom/hook messages replayed as `user_message_chunk` (`modes/acp/acp-replay.ts:42-54`); `bashExecution`/`pythonExecution`/`compactionSummary` too (`:75-82`); ids `randomUUID()` per replay (`:94`). Baseline residual risks 3+4; Extras 6.
- **Auth never reports `authRequired`** [analysis]. `authenticate` only validates method id (`acp-agent.ts:655-664`); missing credentials surface at first prompt.
- ~~**One bad client MCP server fails session setup**~~ **Fixed upstream** [refreshed]: a failed connect keeps the manager entry (`acp-agent.ts:3281-3285`), `/mcp reauth <name>` recovers it, and the client gets a deferred "failed to connect … unavailable until reauthorized" chunk (`:2904-2920`). Still open: omp's own MCP config is forced off in ACP by design (`main.ts:538-543`) and nothing tells the user.
- **v2 has no live terminal** [analysis]. v2 drops `terminal` content (`acp-event-mapper-v2.ts:230-232`); agent-owned terminals are Extras 1.
- **Goal controls missing** [analysis]. No ACP path for goal `budget`/`drop`/explicit `resume`/`show`; only mode select + Stop-pause (`modes/acp/acp-goal.ts:467-469`). `/goal drop` deferred in `ACP_GOAL_MODE_PLAN.md:132`.
- **TUI-only slash commands go to the model as text** [analysis]. Unresolved builtin falls through to `session.prompt` (`acp-agent.ts:999-1002` → `:1068`); affects `/new`, `/clear`, `/plan <prompt>`, `/loop`, … Cheap fix: answer "not available in ACP".
- **Clients without `elicitation.form`** [analysis]. Dialogs return `undefined`/`false` silently (`acp-agent.ts:417-445`); `ask` not offered.

## P2 — useful parity

- Modes: `/loop` (state + timer live in `InteractiveMode`, `interactive-mode.ts:1342-1346`, `:3028-3260`), `/vibe` (see root cause 3), `/guided-goal`, `/plan-review` reopen, `/plan <prompt>` inline entry.
- Session: `/clear`, fork at entry (v1 `unstable_forkSession` forks at leaf only, `acp-agent.ts:711`; v2 fork = Extras 5), session import (`/resume @claude|@codex`), pinned ordering.
- Config: only mode/model/thinking options (`acp-agent.ts:2113-2159`); expose `/fast`, `/slow`, `/extended-context` etc. as options with visible state; model roles have no ACP surface.
- Rendering: todo phases flattened (`acp-event-mapper.ts:433-456`); `queue_update` unmapped; TTSR/IRC notices dropped; extension `notify` debug-log only (`acp-agent.ts:546-548`); per-subagent usage/cost; `tool_call_content_chunk` (Extras 2); no pre-apply diff preview (`tool_stream_update` unmapped).
- Cancel cleanup timeout closes the whole session [refreshed] (`acp-agent.ts:1390`, `modes/acp/acp-surface-v1.ts:145-149`); repeated cancels now share one cleanup barrier, the close-on-timeout is unchanged.
- Side agents: `/btw`, `/tan`.
- v2 `_session/steering` not routed [refreshed] (`acp-agent.ts:900`). On v1 it is now generic (IntelliJ, claude-agent-acp, codex-acp), admits through `AgentSession.joinActiveTurn`, and a user steer supersedes open permission dialogs; v2 clients have none of this.

## P3 — intentionally TUI-only / cosmetic

Vim mode, hotkeys, record, copy, quit/exit/restart, pause, live, debug, stats dashboard, settings/setup UI, `/login`/`/logout` (ACP has auth methods), collab/join/leave, extension widgets/status/footer/header/title, streaming reveal, loader, TTS, composer prediction, `/skills` management, `/hub`, `/agents`.

## Already at parity (do not re-analyse)

Images (prompt, model, tool), thinking content + level option, model selection + `/model`/`/switch`, plan mode + approval elicitation, goal mode entry, prewalk, skills/extension/custom/MCP-prompt commands, export/share/dump/trace, rename/move/wt/dirs/compact/handoff/memory/retry/shake, jobs via `/jobs`, usage/context meter, close/cancel.

## Root causes

1. **Event mapping is a `switch` with silent `default`** (`acp-event-mapper.ts:193-270`); v2 `convertV1UpdateToV2` is a lossy wrapper (`acp-event-mapper-v2.ts:42-125`). New session events miss ACP silently.
2. ~~**Permission/bridge state is per session and not inherited by subagents**~~ — resolved by `acp-permission-parity` (denial ledger + reduced client bridge inherited by descendants).
3. **Mode and session-transition logic lives in `InteractiveMode`**, not the session layer. ACP re-implemented plan/goal (`acp-agent.ts:2250` mirrors `#enterPlanMode`); vibe, loop, branch have no session-layer controller. Every new ACP mode costs a second implementation until this moves.
4. **`handle` vs `handleTui` split**: a command is ACP-visible only with a text `handle` (`slash-commands/acp-builtins.ts:37-39`); mode commands have only `handleTui`.
5. **Session setup is all-or-nothing** (auth pass-through): failures surface late as prompt errors. The MCP half is fixed upstream (see P1).

## Recommended order

1. ~~Permission gate + subagent inheritance (P0 1+2)~~ — done, see P0.
2. Event-mapping table with unmapped-event log + v1 fallback for notice/retry/compaction; v2 slots from Extras 3/4.
3. Extract mode/session-transition controllers from `InteractiveMode` (plan, goal, vibe, loop, branch); prerequisite for vibe/loop/branch in ACP.
4. Small fixes, each standalone: TUI-only command reply, `authRequired`, surface "host MCP config is off in ACP", session-id re-key (after repro), `/session delete` close (after repro).

## Open plan residue (from `ACP_*` plans)

- `ACP_STEER_BUILTIN_COMMANDS_PLAN.md:185-188` and `ACP_PLAN_APPROVAL_MODEL_PLAN.md:110-113`: F1–F3 unticked — treat as not fully landed.
- `ACP_V2_BASELINE_PLAN.md:428-432`: residual risks 2–6 (draft v2 schema, live-only ids, unstable replay ids, goal lane after Stop, goal admission after close).
- `ACP_PLAN_APPROVAL_MODEL_PLAN.md:106-107`: no clear/compact approval variants; IntelliJ recommended-model preselect unconfirmed.

- Merge gate: not applicable (analysis backlog only; each item becomes its own plan with its own gate before execution)
