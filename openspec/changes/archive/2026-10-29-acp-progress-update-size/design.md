# Design

## Context

See proposal.md (Why) for the measurements. The relevant code today:

- One live path sends tool progress to the client. `AcpAgent#handlePromptEvent` (`acp-agent.ts:2184-2255`) passes every session event to `this.#surface.mapUpdate(...)` (line 2211) and sends each returned notification with `sendMapped` (line 2220), after the `acceptsUpdates` check (line 2219). It returns early when no foreground work is active (lines 2185-2191).
- Handlers run concurrently, but start in event order. The session subscription calls `#trackPromptEvent` for each event synchronously (v1 `acp-surface-v1.ts:260-262`, v2 `acp-surface-v2.ts:466-468`), and `#trackPromptEvent` starts `#handlePromptEvent` without awaiting it (`acp-agent.ts:1076-1085`). So each handler's code before its first `await` runs in event order, while the rest interleaves: a slow `await delivery` (line 2231) of the end frame lets later progress handlers run first. Nothing in a handler before the send loop awaits (lines 2185-2217), and a `tool_execution_update` maps to at most one notification (mapper lines 209-229), so its first loop iteration, up to `sendMapped`, runs before the handler's first `await`.
- `AcpSurfaceV1.mapUpdate` (`acp-surface-v1.ts:301-303`) calls `mapAgentSessionEventToAcpSessionUpdates` directly. `AcpSurfaceV2.mapUpdate` (`acp-surface-v2.ts:522-525`) calls `mapAgentSessionEventToAcpV2Updates` (`acp-event-mapper-v2.ts:45-49`), which converts the same v1 notifications. So the v1 mapper is the single place that builds a progress frame for both protocol versions.
- The `tool_execution_update` case (`acp-event-mapper.ts:209-229`) always sets `rawOutput: event.partialResult`. `toolUpdateStatus` (lines 765-775) gives `in_progress`, except for a background job's final frame (`details.async.state` `completed` → `completed`; `failed` or `cancelled` → `failed`). The `tool_execution_end` case (lines 230-257) sets `rawOutput: event.result`.
- Inside omp, `rawOutput` is read only by the v2 conversion: `convertToolCallFields` copies it (`acp-event-mapper-v2.ts:189`) and `convertToolContent` passes it to `extractEditDiffs` (lines 193, 204). `extractEditDiffs` (lines 374-384) needs edit-shaped details (`perFileResults`, or `path` with `op`/`oldText`/`newText`). Only the edit tool's end result has them (`aggregateDetails`, `edit/index.ts:260-287`); the edit tool ignores its update callback (`_onUpdate`, `edit/index.ts:537`).
- Session replay (`acp-replay.ts`) builds only start and end frames, never `tool_execution_update` frames, so it is unaffected.
- `agent-loop.ts:3705-3715` turns every `onUpdate` call of a tool into one `tool_execution_update` event without throttling; the task tool's own coalescing is 150 ms.

## Goals / Non-Goals

**Goals:**
- Bound what an ACP client receives per running tool call to the frames whose visible content changes, without `rawOutput` copies.

**Non-Goals:**
- No change to the task tool's progress cadence or its details shape: the TUI renders them.
- No change to the end frame, to replay, or to frames other than `tool_call_update` for `tool_execution_update` events.
- No change to Air's journal or to existing journals.

## Decisions

### D1. Drop `rawOutput` from in-progress frames in the shared v1 mapper

In the `tool_execution_update` case, compute the status first and set `rawOutput: event.partialResult` only when it is not `in_progress`. v2 inherits this because it converts the v1 frame.

- Alternatives: trim the details (remove the briefs) – still tens of KB per frame and specific to one tool; throttle in ACP – hides real content changes and still copies details; shrink the task tool's details – the TUI needs them. Dropping is the only option that bounds every tool's progress frames.
- v2 edit diffs stay as they are for built-in tools: the edit tool ignores its update callback (Context), and the write tool's progress details hold only `resolvedPath` (`emitWriteProgress`, `write.ts:362-377`), which `readEditEntry` rejects (no `path`, `acp-event-mapper-v2.ts:354-361`). An extension or MCP tool that reported edit-shaped details in progress frames would lose the v2 diff on those frames and keep it on its end frame.

### D2. Skip a progress frame identical to the last one sent for its call

`ManagedSessionRecord` (`acp-surface.ts:76`, `toolArgsById` at line 106) gets `lastToolUpdateHashById: Map<string, number | bigint>`, initialised next to `toolArgsById` at its only construction site (`acp-agent.ts:2043`). Every read and write of this map happens in a handler's synchronous prefix, so the map follows event order (Context):

- On `tool_execution_end`, the entry for `event.toolCallId` is deleted as the handler's first statement, before the early return for inactive work (line 2189) and before any `await`. The end thus resets the comparison in event order, whether or not its frame is delivered and however long its delivery takes. (`toolArgsById.delete` at line 2234 stays where it is.)
- On `tool_execution_update`, inside the send loop after `acceptsUpdates` (line 2219): the notification is serialised with `JSON.stringify` and hashed with `Bun.hash`. When the hash equals the map's entry for `event.toolCallId`, the notification is skipped. Otherwise the hash is stored and the notification handed to `sendMapped`, both before `await delivery`. A notification dropped by `acceptsUpdates` is not stored.

- Why after mapping: identity is what the client receives. The v1 and v2 surfaces map differently, and the comparison works for both without knowing either shape.
- Why `JSON.stringify`: the mapper builds each frame with a fixed key order, so equal frames serialise equally. After D1 an in-progress frame is small (Air journal: about 90 B of content per frame); a background job's settled frame, which carries `rawOutput`, is serialised once.
- Why a hash, not the string: the entry outlives the call's end for background jobs, and a settled frame's serialisation holds the whole result. A 64-bit `Bun.hash` keeps each entry constant-size; a collision would skip one changed frame, with probability about 2^-64 per comparison.
- Why no reset at a settled frame: a reset would resend an identical settled frame, which R2 forbids; nothing follows a settled frame in practice.
- Alternatives: dedupe in the mapper (stateless by design, would need per-call state threaded through both surfaces); dedupe in `sendMapped` of each surface (two copies of the same rule).
- Memory: one hash per call that reported progress, freed at the call's end or with the session record.

### Scope

All changes are inside the ACP mode of `packages/coding-agent` (one mapper case, one handler, one record field) plus tests and changelog. They ship as one change because both rules shape the same wire frames and the golden fixture records both.

## Risks / Trade-offs

- [A client that reads `rawOutput` from in-progress frames loses that data] → The final frame still carries the full result. No omp code reads it (Context). Zed and Air are not known to render in-progress `rawOutput` `[INFERENCE]`; F1 checks that Air still shows progress and the result.
- [A frame skipped by D2 hides a change the client needed] → D2 hashes the whole serialised frame (status, content, locations, rawOutput), so any difference is sent. Tests cover a settled status and a changed location with unchanged content.
- [A write that fails after its hash was stored makes an identical later frame be skipped] → The hash is stored before `await delivery` to keep event order; a failed write means the connection is closing.
- [`JSON.stringify` throws on a non-serialisable settled `rawOutput` (cycle, BigInt)] → The transport serialises the same frame as JSON and fails on it today; the handler's existing `catch` (`acp-agent.ts:1078-1080`) logs it.
- [Entries for calls that never end, and for background jobs that report after the end, stay in the map] → They are freed with the session record; each is one hash.

## Migration Plan

None. The change takes effect for new ACP sessions after the omp update. Rollback is a revert. Existing Air journals keep their size; that is up to the user (delete the thread journal or raise `-Xmx`).
