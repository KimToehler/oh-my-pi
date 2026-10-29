# Proposal

## Why

JetBrains Air in IntelliJ runs out of heap (`-Xmx3072m`) when it opens a long omp chat. Air appends every ACP `session/update` to its own per-thread journal (`~/Library/Caches/JetBrains/IntelliJIdea2026.2/acp/projects/<p>/threads/<t>/events.jsonl`) and rebuilds the chat view from that journal. It does not request a replay from omp: omp answers `loadSession: false` to JetBrains (`acp-surface-v1.ts:102`). For the 25 MB omp session `01a177b0…` that journal is 2.63 GB, and 97.6 % of it is `tool_call_update` frames with `status: in_progress`. `idea.log` of 2026-10-29 14:25:51 shows the `OutOfMemoryError` in Air's journal parse (`JsonTreeReader`) and projection (`SessionProjectionReducer.reduce`). Across Tim's six largest Air journals (5.5 GB), in-progress tool updates are 93.7 % of the bytes.

Two things in omp cause this:
- The `task` tool reports progress every 150 ms (`PROGRESS_COALESCE_MS`, `task/executor.ts`). Each report carries the full task details, including every subagent's brief, twice. `acp-event-mapper.ts:209-229` forwards each report as one `tool_call_update` with `rawOutput: event.partialResult`. One plan-review dispatch sent 6,575 such frames in 17 minutes. Their `content` (what Air shows) was 0.6 MB in total; their `rawOutput` was 466 MB.
- Most of those frames repeat the previous frame for the same call. Replaying the existing 2.63 GB journal with the frames this change would send (rawOutput dropped from in-progress frames, frames identical to the last one sent for their call skipped) leaves 10,175 of 93,819 tool updates and about 69 MB in total (measured over the journal, 2026-10-29).

## What Changes

- A `tool_call_update` for a running call (`status: in_progress`) no longer carries `rawOutput`, on ACP v1 and v2. `content`, `status` and `locations` are unchanged. Frames that settle a call (the call's end frame, and a background job's final frame with status `completed` or `failed`) keep the full `rawOutput`. **BREAKING** for any ACP client that reads `rawOutput` from in-progress frames; no known client does (see design.md).
- omp no longer sends a `tool_call_update` that is identical to the last one it sent for the same call. Updates that change anything are sent in order, and the first update after a call's end frame is always sent.
- Existing oversized Air journals are not changed by this; they stay as large as they are.

## Capabilities

### New Capabilities
- `acp-tool-call-updates`: what omp sends to an ACP client about a tool call while it runs and when it settles, and which frames carry the raw tool output.

### Modified Capabilities

## Impact

- `packages/coding-agent/src/modes/acp/acp-event-mapper.ts`: the `tool_execution_update` mapping, shared by the v1 and v2 surfaces.
- `packages/coding-agent/src/modes/acp/acp-agent.ts` (`#handlePromptEvent`) and `acp-surface.ts` (`ManagedSessionRecord`): the per-call record of the last sent update.
- Tests: `test/acp-event-mapper.test.ts`, `test/acp-v1-golden.test.ts` (new fixture), `test/acp-v2.test.ts`.
- `packages/coding-agent/CHANGELOG.md`.
- Wire: ACP `session/update` frames to every ACP client (Air, Zed, others) on v1 and v2. The TUI, RPC mode and session replay are unaffected.
