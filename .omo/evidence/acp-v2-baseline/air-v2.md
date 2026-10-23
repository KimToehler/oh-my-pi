# F1 scenario 3: Air (IntelliJ 2026.2) against the worktree CLI with ACP v2

Date: 2026-10-23, 19:08-19:12 local. Worktree HEAD at the time: `8be42efc62` (last code commit `92dbd7cf93`, after F3 wave 11's fixes; later commits are evidence only). Replaces the 16:44-16:48 run on `dc43e41b76`.

## Setup

- `~/.jetbrains/acp.json` (backup `acp.json.bak-acp-v2-baseline`) got a second agent `omp v2 (worktree)`:
  `/opt/homebrew/bin/bun <worktree>/packages/coding-agent/src/cli.ts acp --config ~/.jetbrains/omp-acp-v2.config.yml` with `acp.protocolV2: true`.
- Registry key `air.acp.v2.enabled=true` (set by Tim earlier).
- Live thread `acp:637729ed`, omp session `01a169bc-e3a7-7494-971c-2ca7ae37be96`. Resumed thread `local:fe93646e-…` (omp session `01a163ee-387d-74a4-9933-2e1db7f2a08a`, from the earlier run).

## Proof that v2 was negotiated

- `air-v2-idea-log-excerpt.txt`: Air launched the worktree CLI with the v2 config at 19:08:19 and 19:09:07 (`[air-acp] Args: [.../.worktrees/acp-v2-surface/packages/coding-agent/src/cli.ts, acp, --config, /Users/tim/.jetbrains/omp-acp-v2.config.yml]`). The excerpt has no ERROR/SEVERE line.
- `air-v2-events.jsonl` (Air's thread journals, `acp:637729ed` then `local:fe93646e-…`): every prompt in `acp:637729ed` has a `MessageIdentityBound` event binding Air's user message id to the agent's v2 `messageId` (5 prompts, 5 bindings: `b6918e7a`, `e7ca7392`, `9acc71fa`, `5d1c6672`, `82c8b232`). v1 sessions carry no such event (`air-v1-control-idea-log-excerpt.txt`, earlier control run).

## Scenarios (observed by Tim in the Air UI: "alles hat geklappt"; journal events cited, `acp:637729ed` seq numbers)

| # | Scenario | Expected | Journal evidence | Verdict |
|---|----------|----------|------------------|---------|
| 3a | Edit prompt (create `notes/acp-v2-check.md`, change a bullet), then a longer follow-up to watch streaming | streamed text, tool calls, diff, turn ends | seq 12-116: `ThreadStarted`, `MessageIdentityBound`, edit tool calls 37-41 and 43-45 (45 carries `content[].type = "diff"` with a `git_patch`), `TurnEnded finished/Completed`, `PromptTurnFinished SUCCESS`; seq 120-403: follow-up streamed (≈280 `MessageChunk`s), `SUCCESS` | PASS |
| 3b | Background `task` subagent (`blocking: false`), turn ends at once | Air idle after the reply; subagent result streams later without a new prompt | seq 461-467: task tool call; seq 512-514: `TurnEnded`/`ThreadWaiting`/`PromptTurnFinished SUCCESS` at 19:10:58; seq 515-545: agent `MessageChunk`s from 19:11:08 with no user prompt ("Der Hintergrund-Agent ist fertig. In `notes/` liegt nur eine Datei …") | PASS |
| 3c | Stop during a long streamed answer, then `antworte nur mit "ok"` | stream stops, turn cancelled, next prompt runs normally | seq 889-891 at 19:12:01: `TurnEnded UserStopped`, `PromptTurnFinished CANCELLED`; no agent chunk between 891 and the next prompt; seq 893-904: next prompt `SUCCESS` in 1.6 s | PASS |
| 3d | Resume an earlier v2 thread | earlier prompts reappear, no duplicates | `local:fe93646e-…`: `RuntimeSessionBound` to the v2 agent, `HistoryReplayFinished` at 19:10:00; no duplicates (Tim) | PASS |
| 3e | Slash menu | commands listed | seq 3 and 6: `AvailableCommandsUpdated`, 77 commands. Air's journal stores only `id`/`name`/`description`, so the `input.hint` part of the shared v2 conversion is proven by the scripted run (`v2-ack.json`, `session/new` result: 69 commands, e.g. `security` with `input: {type: "text", hint: "<plan|scan|…>"}`) | PASS |
| 3f | Closing v2 sessions | session closes without error | idea.log 19:10:41: `AcpSessionManager.close` for the idle resumed v2 thread `local:fe93646e-…`; 19:10:19: a v2 worktree process stopped after Air's termination request (exit 143). No error follows. A close while a background job was still running does not appear in the journal; that path is covered by the ACP boundary test "starts no wake turn for a background job that completes while an idle session is closing" (`acp-v2.test.ts`) | PASS (idle close) |

## Limits

- No screenshots: the visual checks are Tim's direct observation in the Air UI, reported in the session on 2026-10-23.
- Air's own logs show two client-side notices that do not come from omp: `dropped ACP session event: reason=duplicate_terminal` right after the Stop (Air had already ended the turn locally) and `AcpTurnCostLedger … discards its cost report`.
- The scratch file `notes/acp-v2-check.md` from 3a was removed from the main checkout at the end of the run.
- This Air run predates the F2 fixes `fbbac9cd22` (TODO 23: a v2 foreground stops sending content once it no longer owns the session, so nothing follows `idle(cancelled)`) and `0af973fd81`/`a647b55e3f` (TODO 24: `session/close`, also a repeated one, answers only after the session's queued updates are written). Both touch the Stop and close paths. Tim decided on 2026-10-23 not to repeat the Stop row 3c in Air; the idle-close row was not repeated either. On the fixed head (`f1-head.txt`) all six scripted scenarios were re-run and PASS, `v2-cancel` covering Stop, and the ACP-boundary tests in `acp-v2.test.ts` cover Stop and close between two updates of one event and close racing a held `user_message` write.
