# F1 scenario 3: Air (IntelliJ 2026.2) against the worktree CLI with ACP v2

Date: 2026-10-23, 16:44-16:48 local. Worktree HEAD at the time: `f21c724d85` (last code commit `dc43e41b76`; later commits are docs and plan only).

## Setup

- `~/.jetbrains/acp.json` backed up to `acp.json.bak-acp-v2-baseline`, then a second agent `omp v2 (worktree)` was added:
  `bun <worktree>/packages/coding-agent/src/cli.ts acp --config ~/.jetbrains/omp-acp-v2.config.yml` with `acp.protocolV2: true`.
- Registry key `air.acp.v2.enabled=true` set by Tim.
- Air thread `acp:6ef07250`, omp session `01a16938-1bbd-7693-901a-8ea6c6773afb`.

## Proof that v2 was negotiated

- `air-v2-idea-log-excerpt.txt`: Air launched the worktree CLI with the v2 config (`[air-acp] Args: [.../.worktrees/acp-v2-surface/packages/coding-agent/src/cli.ts, acp, --config, /Users/tim/.jetbrains/omp-acp-v2.config.yml]`).
- `air-v2-events.jsonl` (Air's own thread journal): every prompt has a `MessageIdentityBound` event binding Air's user message id to the agent's `messageId` from the v2 prompt response (5 prompts, 5 bindings). The two v1 threads from the earlier run on the installed omp (`acp:c6fec5b2`, `acp:c857dfba`) have 0 such events; `air-v1-control-idea-log-excerpt.txt` shows them as `AcpV1ProtocolSession`.

## Scenarios (observed by Tim in the Air UI; journal events cited)

| # | Scenario | Expected | Observed | Journal evidence | Verdict |
|---|----------|----------|----------|------------------|---------|
| 3a | Edit prompt (create `notes/acp-v2-check.md`, edit a bullet) | streamed text, tool calls, diff, turn ends | as expected (Tim) | seq 12-336: `ThreadStarted`, `MessageIdentityBound` (agentMessageId `6670184d`), tool-call updates, `TurnEnded finished/Completed`, `PromptTurnFinished SUCCESS` | PASS |
| 3b | Background `task` subagent (`blocking: false`), turn ends at once | Air idle after the reply; subagent result streams later without a new prompt | turn ended, result streamed when the agent finished (Tim) | seq 404-406: `TurnEnded`/`ThreadWaiting` at 1792766792879; seq 407+: agent `MessageChunk`s with no `turnId` from 1792766813437 (20.5 s later, agent-initiated wake) | PASS |
| 3c | Stop during a long streamed answer, then `Antworte nur mit "ok".` | stream stops, turn cancelled, next prompt runs normally | as expected (Tim) | seq 849-851: `TurnEnded UserStopped`, `PromptTurnFinished CANCELLED`; seq 853-864: next prompt `SUCCESS` in 1.7 s | PASS |
| 3d | Resume (close and reopen the thread) | earlier prompts reappear, no duplicates | as expected (Tim) | Tim's UI observation; no journal marker | PASS |

## Limits

- No screenshots: the visual checks are Tim's direct observation in the Air UI, reported in the session on 2026-10-23.
- The scratch files from 3a were removed by the agent at Tim's request at the end of the run (`notes/` no longer exists in the main checkout).
