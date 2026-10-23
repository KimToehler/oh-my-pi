# ACP protocol v2 baseline beside v1

## Context

`omp acp` speaks ACP v1 only (`packages/utils/src/acp/protocol.ts:13` `PROTOCOL_VERSION = 1`). In v1, `session/prompt` stays pending for the whole foreground interval. omp therefore holds every prompt open until the session is quiescent (`packages/coding-agent/src/modes/acp/acp-agent.ts:283-293` `isAcpSessionQuiescent`, `#waitForAcpPromptIdle`), and it parks agent-initiated work while no prompt is open (`setAcpPromptOpen`; gate callers in `agent-session.ts:2337,9560,9600,9620`, `session-advisors.ts:1840`, `acp-goal.ts:190`). Live smoke on 18.12.5: a background `task` subagent kept the prompt open for 49.6 s.

ACP v2 (schema `schema-v2.0.0-alpha.9`, 2026-10-16) fixes this at the protocol level:

- `session/prompt` answers `{ messageId }` once the user message is **inserted** into the conversation. The schema states this explicitly: not when received or queued (`PromptResponse`).
- Foreground progress travels as `state_update` (`running` | `requires_action` | `idle` + `stopReason`).
- Agent-initiated work MUST report `running` … `idle` without a prompt (`StateUpdate`).
- Resume MUST send a current-state snapshot after replay and before its response.

### Settled facts (probed in this session)

**Client (JetBrains Air 2026.2)**
- Air offers v2 only when registry key `air.acp.v2.enabled` is on; the key is off by default.
- Air's `DiffPatch` requires a field `diff`; alpha.9 calls the field `text`. Air ignores unknown keys.
- Air's `state_update` is flat (`OpenTaggedUnionSerializer`). It decodes unknown `StopReason` values to `Unknown`.

**Schema rules**
- `DiffPatchFormat` `git_patch`: paths MUST be absolute and MUST NOT carry `a/`/`b/`. `/dev/null` names a missing side. Git quoting applies.
- `ResourceLink` requires `name` and `uri`. All agents MUST support resource links. Today `#convertPromptBlocks` (`acp-agent.ts:2234-2235`) drops the URI when `title` or `name` is set.
- The schema defines `ClientBatchCall` and `ClientBatchResponse`. The agent must therefore accept batched calls and also batched responses to its own requests (permission).

**Admission vs insertion**
- `PromptOptions.onPromptAdmitted` is **not** insertion.
- It fires at the start of `#promptWithMessage` (`agent-session.ts:8553`), before the usage preflight and the generation checks. Those can still drop the prompt (`return false` at 8560, 8628, 8667, 8682).
- Queued steers fire it when queued (`9174`). `clearQueue` (`9728`) can later withdraw them.

**Real insertion point**
- The agent loop emits each user message object as `message_start`/`message_end`. This holds for the initial prompt messages and for steers drained into a turn (`packages/agent/src/agent-loop.ts:1337-1344`, `emitInputMessages` 1140).
- On `message_end`, `AgentSession` persists the message (`#persistSessionMessageIfMissing` → `#appendSessionMessage` 4065-4087). `sessionManager.appendMessage` returns the fresh entry id (`session-manager.ts:3411-3423`).
- Today the entry id is stamped only on assistant messages (`kPersistedSessionEntryId`, 4079-4081).

**Message identity**
- The persistence key `user:${timestamp}:${attribution}` (`turn-persistence.ts:56-57`) explicitly allows distinct messages that share a key (69-76).
- The session entry id is unique, persisted, and survives resume and restart.

**ACP adapter coupling**
- The ACP event listener is installed per prompt (`acp-agent.ts:981-983`).
- `#trackPromptEvent` drops every event without a live `promptTurn` (1875-1878).
- `#queuePrompt` waits for the previous turn's promise and cleanup (944-953).

**Transport**
- `AgentSideConnection` binds one agent and has one fixed v1 dispatch switch (`connection.ts:66-75,235-271`).
- `stream.ts:70-82` rejects arrays.
- `transport.ts:225-256` `#handle` correlates single responses only.

### Decisions (user, this session)

- One session core, two protocol adapters.
- Baseline here; extras in `.omo/plans/ACP_V2_EXTRAS_PLAN.md`.
- QA with Air plus a scripted client.
- v2 is opt-in through `acp.protocolV2`, default `false`.
- `auth/logout` succeeds and leaves credentials untouched.

### Subsystem cut (review blocker 9)

- **Split out:** JSON-RPC batch support. It is an independent transport fix that also applies to v1. It ships first as `.omo/plans/ACP_JSONRPC_BATCH_PLAN.md`, with its own gate. This plan depends on it.
- **Stays together:**
  - Versioned dispatch in `connection.ts`.
  - AgentSession's insertion hook, user entry-id stamping, and gate callback.
  - The ACP v2 adapter.

  The first two have no consumer without the third: a version router with no v2 surface always picks v1, and the insertion hook would be dead code. Shipping them apart would ship dead code.
- **Smaller than v1 of this plan:** RPC no longer changes, because `onPromptAdmitted` keeps its signature.

## Approach

### 0. Worktree and RED

- Create `.worktrees/acp-v2-baseline` from `main` after the batch plan has merged; branch `feat/acp-v2-baseline`; run `bun install`.
- Vendor the schema byte-identically as `packages/coding-agent/test/fixtures/acp-v2-schema.json`, with its sha256 in the test header.
- Capture **v1 golden transcripts** before any source change: `packages/coding-agent/test/fixtures/acp-v1-golden/*.ndjson`. Each records every outbound frame of a scripted harness run. Scenarios:
  - initialize
  - new session
  - a prompt with text + tool call + edit diff + plan
  - a prompt during streaming
  - cancel
  - a permission request
  - load with replay
  - a background wake inside an open prompt

  Timestamps and random ids are normalised by a documented replacer.
- Write the behaviour tests from Verification. Every test marked RED must fail on the untouched tree. Guards are marked as such.

### 1. Versioned dispatch (`packages/utils/src/acp/`)

- **`v2/protocol.ts`:** hand-written v2 types for the baseline surface only, in the style of `protocol.ts`. Exports `PROTOCOL_VERSION_V2 = 2`.
- **`connection.ts`:** `AgentSideConnection` takes `toAgent(conn) => { v1: Agent; v2?: AgentV2; maxVersion(): 1 | 2 }`. The dispatcher owns `initialize`:
  - A missing, non-integer or `< 1` `protocolVersion` gets `-32602`.
  - `selected = min(requested, maxVersion())`; without `v2` it is always 1.
  - The selected surface's `initialize` runs, and every later request dispatches through `dispatchAgentV1` (today's switch, moved verbatim) or `dispatchAgentV2`.
  - A second `initialize` gets `-32600`.
- **Client direction:** the v2 surface receives an `AgentSideConnectionV2` view with v2-typed `sessionUpdate`, `requestPermission` and `createElicitation`. v1 signatures are unchanged.

### 2. Session core seam

**AgentSession** (`packages/coding-agent/src/session/`):

- **Submission outcome.** New `PromptOptions.onSubmissionOutcome?: (outcome: SubmissionOutcome) => void`, where `SubmissionOutcome = { kind: "inserted"; entryId: string } | { kind: "command" } | { kind: "dropped" }`.
  - **Contract.** Every submission that does not reject fires exactly one outcome, possibly after `prompt()` has resolved: a queued steer resolves `prompt()` at queueing (8024-8036, 9134-9141) and reports its outcome at insertion or removal. A `prompt()` that rejects before any outcome (e.g. `AgentBusyError`) reports through the rejection only.
  - **Why not the return value.** It is ambiguous: `false` means handled locally (`agent-session.ts:7960,7967`), and every pre-dispatch drop resolves `true` (`8036`, `8082`, `8195`; documented at 7911-7919).
  - **Ownership model.** `AgentSession` keeps `#pendingSubmissions: Map<AgentMessage, callback>` for the user message object it creates for the submission: `#dispatchPrompt` (8120-8129) and `#queueUserMessage` steer mode (9160-9171).
    - **Supported modes.** `onSubmissionOutcome` is supported only with `streamingBehavior` absent or `"steer"`. Combined with `"followUp"` or `"aside"`, `prompt()` rejects with a `TypeError` before admission. The ACP v2 surface, the only caller, uses idle dispatch or steer. Parked follow-ups (`autoResumeSuppressed`, 9226-9230), deferred IRC wakes and IRC asides therefore never hold an outcome-bearing message, and no `IrcBridge` change is needed.
    - An entry stays pending while the message is queued, claimed by the agent core (`#queuedMessageClaims`), in a delivery record, live-steered, or preserved across compaction.
    - Absence from a queue never counts as a drop: the agent core returns claimed and undelivered messages to the queues (`agent.ts:1039-1082`).
    - An entry leaves the map only through the transitions below.
    - Entries exist only for submissions that pass `onSubmissionOutcome`, so TUI, RPC, task and v1 submissions are never registered, and neither the closure nor the transition hooks touch them.
  - **`inserted`.** `#appendSessionMessage` (4065) fires it with the returned entry id and removes the entry. A message object still in `#pendingSubmissions` has never been persisted by this session, so `#persistSessionMessageIfMissing` skips the structural dedup `#sessionMessageAlreadyPersisted` (4042-4063) for it. Two identical prompts in the same millisecond therefore both persist. Once inserted, the dedup applies as before; persistence is synchronous, so no second attempt can interleave (re-review 3).
  - **`command`.** Fires at the local-command returns (7960, 7967).
  - **`dropped`.** Two mechanisms.

    **(a) Closure — the completeness guarantee.** New `AgentSession.settlePendingSubmissions(): void`. For every still-pending entry it:
      - removes the message object by identity from the steering queue (`agent.replaceQueue("steering", …)` with an identity filter);
      - deletes the entry, adds the object to `#droppedSubmissions: WeakSet<AgentMessage>` and fires `dropped`.

    **Tombstone.** `#persistSessionMessageIfMissing` (4090) returns early for an object in `#droppedSubmissions`. A dropped message is therefore never persisted and can never fire `inserted`, even if a run that has not yet terminated still emits it. This is the case for a cancel cleanup that timed out before `#closeManagedSession` disposes the session (`acp-agent.ts:1329-1346,3396-3433`). No frame from that run reaches the client: the record is removed from `#sessions` and its subscription ends in `#disposeSessionRecord`. The orphaned run is aborted by `dispose`, as today.

    It runs:
      - at every ACP v2 foreground end, at the quiescence point (`isAcpSessionQuiescent`, `acp-agent.ts:283-293`). There the agent core holds no claims, delivery records or live steers, because each run restores them in its `finally` before resolving (`agent.ts:1736-1747,2204-2214`; re-review 5). A pending steer there was not inserted in this foreground: its delivery record was deleted by a queue replacement (`agent.ts:1039-1043`), or it is still queued and the stranded drain did not take it. Removing it and tombstoning it means it can never be inserted after its rejection.
      - **User-visible v2 behaviour:** an ACP v2 prompt never stays queued past the foreground it was submitted into. Steers resume from any tail (9219-9225), so this only rejects steers the session would not otherwise have run.
      - in `#closeManagedSession` before `dispose` (via `dispose` at 6146), in `resetSessionContext` (6495-6535, before `agent.reset()`), after `newSession` (10570) and after the `/btw` branch (12794) commit, and after `switchSession` commits. Not on its rollback (12495-12512), which restores queues and fires nothing.

    **(b) Prompt drops — latency only.** These fire immediately, without waiting for the closure:
      - the synchronous refusals: each `return false` exit of `#queueUserMessage` in steer mode (generation drop 9124-9126; both callers 8024-8036 and 8099-8111), the idle generation drop (8077-8083), and `!dispatched` (8186-8195);
      - the user-facing removals `clearQueue` (9728, including withdrawn deliveries for `forInterrupt`, which are suppressed by object and run controller, `agent.ts:2003-2010`), `takeQueuedMessage` (9831) and `popLastQueuedMessage` (9904), each for exactly the user message objects it removes. These also tombstone.

    Completeness does not depend on (b): anything (b) misses is settled by (a). A missed (b) path costs latency until foreground end, never a hang.

    **Single fire point.** Every outcome goes through one `#settleSubmission(message, outcome)`: it fires only if the message is in the map and deletes it first. No path can double-fire, and an inserted message cannot later be dropped. No outcome waits on `agent_end`.
  - **Existing APIs unchanged.** `onPromptAdmitted`, `throwOnDrop` and `setPromptDropped` keep their meaning and signatures. RPC (`rpc-mode.ts:283-341,846,1846-1850`) and the task executor (`task/executor.ts:2513`) are untouched.
- **User entry ids.** Generalise `kPersistedSessionEntryId` from assistant to user messages, and export `sessionEntryIdOf(message)`.
  - `buildSessionContext` stamps the source entry's id on every message it pushes from a `message` entry (`session-context.ts:398-408`).
  - Replay (`acp-agent.ts:2873`) then reads the same id that `inserted` returned live.
- **Gate callback.** `ClientBridge.deferAgentInitiatedTurns` (`client-bridge.ts:76`) becomes `allowAgentInitiatedTurns?: () => boolean`.
  - Removed: `setAcpPromptOpen` (`agent-session.ts:6825-6827`) and `#allowAcpAgentInitiatedTurns` (990).
  - Source callers migrate:
    - `agent-session.ts:2337,2630,9560,9600,9620`;
    - `session-advisors.ts:1829-1840`;
    - `acp-client-bridge.ts:39`;
    - `acp-agent.ts:979,2148`;
    - `acp-goal.ts:190`.
  - Test callers migrate too, keeping their assertions: `agent-session-async-delivery.test.ts:1031,1050,1056`, `agent-session-concurrent.test.ts:663,817`, and `acp-agent.test.ts:359` (`FakeAgentSession`).

**ACP adapter** (`packages/coding-agent/src/modes/acp/`):

- **`acp-foreground.ts` (new).** `ForegroundWork` holds what `promptTurn` holds today about the work itself: abort controller, `cancelRequested`, `usageBaseline`, `lastAgentEnd`, `quiescenceWait`, builtin-steer lane and count, `deferredError`, `cleanup`. It also gets `origin: "prompt" | "agent"` and `pendingInteractions: number`.
  - `isAcpSessionQuiescent`, `#waitForAcpPromptIdle`, cancel cleanup, `#resolveStopReason` and `#buildTurnUsage` take a `ForegroundWork`.
  - `promptTurn` keeps only the v1 pending-request half: resolve/reject/promise/settled.
- **`acp-surface.ts` (new).** `AcpSurface` interface: `admitPrompt`, `onForegroundStart/Blocked/Resumed/End`, `allowsAgentInitiatedWork`, `mapUpdate`, `initializeResponse`, `authMethods`, `sessionSetupResponse`, `permissionRequest`, `replay`.
  - `acp-surface-v1.ts` contains today's behaviour, moved.
  - `acp-surface-v2.ts` implements step 3.
  - `AcpAgent` picks the surface in `initialize`. `acp-mode.ts` passes `maxVersion: () => (cfgAcpProtocolV2.get(settings) ? 2 : 1)`.
- **v1 keeps its lifecycle exactly:** prompt-scoped subscription, `#queuePrompt` waiting on the previous turn, the open-prompt gate (`allowsAgentInitiatedWork = () => record.promptTurn open`). The golden transcripts prove it.

### 3. v2 surface

**Session-lifetime subscription.**
- `session/new` and `session/resume` subscribe once per record (unsubscribe in `#closeManagedSession`).
- The listener synchronously creates `ForegroundWork{origin:"agent"}` and emits `running` before mapping the first event of an agent-initiated turn: `agent_start` with no `ForegroundWork`.
- A prompt-originated `ForegroundWork` is created synchronously in `admitPrompt`, before `session.prompt` is called, so its `agent_start` finds it.
- `onForegroundEnd` runs at the existing quiescence point.

**Prompt.**
- `#queuePrompt` on v2 serialises only until the previous prompt's outcome or rejection; it does not wait for foreground end.
- ACP builtins handled in `#runPromptOrCommand` (1143) never reach `session.prompt`. Everything else calls `session.prompt(text, { streamingBehavior: "steer", onSubmissionOutcome })`. `#dispatchPrompt` reads `streamingBehavior` only after its own streaming rechecks (`agent-session.ts:8011`, `8093`), so an idle session dispatches directly and a streaming one queues a steer. The idle-to-streaming race therefore cannot reach `AgentBusyError` (review 6, note 1).
- `running` is emitted at admission if no foreground is active. The schema allows `running` before insertion.
- Outcomes:
  - **`inserted{entryId}`:** respond `{ messageId: entryId }`, then emit `user_message` with that id.
  - **`command`, or an ACP builtin:** respond with a fresh UUID messageId and emit a live-only `user_message` with that id. Frame the command with `running` and `idle(end_turn)`. No session entry exists, so replay omits it: accepted residual risk 3, with its own criterion.
  - **`dropped`:** JSON-RPC error. `requestCancelled` if a cancel was requested, otherwise `-32603` with message `Prompt dropped before insertion`.
  - **Rejection before an outcome:** `sessionBusy` for `AgentBusyError`, otherwise the mapped error.
  - **Rejection after `inserted`:** the prompt already succeeded; the foreground ends with `idle(error)`.
- A failure after insertion ends with `idle` + `stopReason:"error"` + `error`.
- The v2 initialize response omits `_meta.steering`, and `_session/steering` is not routed.

**States.**
- `pendingInteractions` counts open `session/request_permission` and `elicitation/create` calls.
- `requires_action` when `pendingInteractions > 0` and no tool or model stream is progressing. That is: the agent is in a tool execution whose only pending work is the interaction, which matches today's permission path, where the tool awaits the client.
- `running` again when the count drops and work resumes.
- Identical consecutive states are not re-sent.
- One function `currentState(record)` feeds both live transitions and the resume snapshot.

**Cancel.**
- `session/cancel` with active foreground: first `session.clearQueue({ forInterrupt: true })`, so every queued, claimed or live-steered user submission is removed and reports `dropped`, which the adapter answers as `requestCancelled`. Then abort as today, flush pending updates, emit `idle(cancelled)`. Without foreground: no-op.
- Cancel latch: `allowsAgentInitiatedWork` is `false` until the next prompt insertion. Late wakes park as hidden next-turn context; Goal pauses.

**Update mapping.**
- `tool_call` → `tool_call_update` with the same fields.
- `plan` → `plan_update{plan:{type:"items", planId:"todo", entries}}`.
- `current_mode_update` → dropped; `config_option_update` already carries the mode.
- `available_commands_update` input gains `type:"text"`.
- `terminal` tool content → dropped until Plan 2.
- Every message chunk carries a defined `messageId`.

**Diffs.**
- `changes` operations: `create`→`add`, `update`→`modify`, `delete`→`delete`, move→`move{oldPath, path}`. All paths are absolute (resolved against the session cwd).
- When both snapshots exist (`packages/coding-agent/src/edit/index.ts:243-257`, not `snapshotsPruned`), add `patch = { format:"git_patch", text, diff:text }`. The patch is built by `acp-git-patch.ts` (new) from `structuredPatchHunks` (`packages/natives/native/index.d.ts:3818`):
  - `diff --git <abs> <abs>`, `--- <abs>|/dev/null`, `+++ <abs>|/dev/null`
  - `rename from`/`rename to` for moves
  - Git C-style quoting for paths with special characters
  - no `a/`/`b/` prefixes
- `diff` mirrors `text` only for Air: accepted residual risk 1.
- With pruned snapshots, send `changes` only.

**Prompt content (both versions).**
- `resource_link` becomes `[title or name](uri)`, so the URI always reaches the model.
- This fixes a v1 conformance bug in the shared converter. It is the one intended v1 behaviour change; it affects prompt text, not wire frames.

**Permission.**
- `title` is the tool title, falling back to `Allow ${toolName}?`.
- `subject:{type:"tool_call", toolCall}`.
- Anything other than `selected` with a known `optionId` counts as rejection.

**Session setup.**
- `session/new` and `session/resume` return `configOptions` and `availableCommands` without `modes`. `mcpServers` is optional.
- `replayFrom:{type:"start"}` replays `buildSessionContext()` through the v2 mapper. A user message uses `sessionEntryIdOf(message)` as its messageId; other roles get fresh ids (Plan 2).
- No cursor: no replay. Any other cursor: `-32602`.
- After replay and before the response: `state_update` = `currentState(record)`.

**Auth.**
- Methods: `[{methodId:"agent", type:"agent"}]`, plus `{methodId:"terminal", type:"terminal", args:[ACP_TERMINAL_AUTH_FLAG], env:[]}` when `capabilities.auth.terminal` is an object.
- `auth/login` validates as `authenticate` does (`acp-agent.ts:797-807`).
- `auth/logout` returns `{_meta:{omp:{credentialsRetained:true}}}` and touches nothing.

**Capabilities and bridge.**
- Capabilities: `session:{prompt:{image:{}, embeddedContext:{}}, mcp:{stdio:{}, http:{}}}`.
- The v2 client bridge installs permission only; no `fs/*` and no `terminal/*` calls.

### 4. Setting, docs, changelog

- `cfgAcpProtocolV2` in `packages/coding-agent/src/modes/settings.ts` (`acp.protocolV2`, boolean, default `false`). Its description names Air's `air.acp.v2.enabled`.
- README `omp acp` section (`README.md:556-575`): one paragraph on v2 opt-in and its user-visible effect.
- `packages/coding-agent/CHANGELOG.md` `[Unreleased]`:
  - `### Added`: v2 opt-in.
  - `### Fixed`: resource-link URIs reach the model.

## Critical files & anchors

**utils (`packages/utils/src/acp/`)**
- `connection.ts:66-75,235-271`
- new `v2/protocol.ts`

**session (`packages/coding-agent/src/session/`)**
- `agent-session.ts`: 2337, 4065-4087, 7925-8130, 8531-8560, 9120-9175, 9560-9622, 9728-9750
- `agent-session-types.ts:416-459`
- `client-bridge.ts:76`
- `session-advisors.ts:1829-1840`
- `session-context.ts:398-408`
- `session-manager.ts:3411-3423`

**ACP adapter (`packages/coding-agent/src/modes/acp/`)**
- `acp-agent.ts`:
  - `initialize` 745-796, `authenticate` 797-807
  - session setup 809-860
  - `prompt` 921-1006
  - cancel 1284-1357
  - `#trackPromptEvent` 1870-1971
  - quiescence 2065-2106
  - `#finishPrompt` 2142-2184
  - `#convertPromptBlocks` 2210-2246
  - replay 2869-3100
- `acp-event-mapper.ts`: 216-264, 467-490, 712-741, 774-785
- `acp-client-bridge.ts`, `acp-goal.ts:190`, `acp-mode.ts`

**elsewhere**
- `packages/coding-agent/src/edit/index.ts:243-257`
- `packages/agent/src/agent-loop.ts:1140-1145,1337-1344`

## Verification

**Test setup.**
- Tests live in `packages/coding-agent/test/acp-v2.test.ts`.
- The fake harness moves from `acp-agent.test.ts:704-788` to `test/acp-test-harness.ts`, gaining a `protocolVersion` option.
- Every v2 frame (notification, response, client request) is validated with `validateJsonSchemaValue` (`packages/ai/src/utils/schema/json-schema-validator.ts:743`) against the vendored schema; any issue fails the test.
- Insertion and identity tests use a **real `AgentSession`** with the mock provider used by `agent-session-async-delivery.test.ts`, not the fake.

**Tests.** RED = fails on the untouched tree; GUARD = must stay green throughout.

1. **Negotiation.**
   - RED: flag on, requested 2 → v2 `InitializeResponse`.
   - RED: requested 3 → 2.
   - RED: `0`, `"2"` or missing → `-32602`.
   - RED: second `initialize` → `-32600`.
   - GUARD: flag off, requested 2 → response deep-equal to the v1 golden transcript.
2. **Submission outcome (real session).** All RED; each also asserts the callback fired exactly once.
   - The prompt resolves `{messageId}` equal to the persisted user entry id while the turn still streams. `user_message` follows the response and carries the same id.
   - Usage preflight denial (spy on the preflight seam) → `dropped` → JSON-RPC error, no `user_message`, no entry, and the next prompt is not blocked.
   - Generation bump while queueing a streaming steer (abort during image preparation) → `dropped`.
   - Cancel after admission and before insertion → `requestCancelled`, no entry.
   - A queued steer removed by `clearQueue` → `dropped` synchronously, before any `agent_end`.
   - A queued steer removed by `popLastQueuedMessage` → exactly one `dropped`, and the next prompt is not blocked.
   - `onSubmissionOutcome` with `streamingBehavior: "followUp"` or `"aside"` → `prompt()` rejects with `TypeError`, and no message is queued.
   - Claimed steer survives an unrelated removal: while steer A is claimed by the agent core for the next model call, `takeQueuedMessage` removes steer B. Expected: B gets `dropped`, and A later gets `inserted` with no `dropped`.
   - Delivery-record loss: steer A sits in a delivery record; `#extractQueuedAdvisorCards` (via a user abort with a queued advisor card) replaces the queues before A is emitted. Expected: no `dropped` while the run unwinds, then exactly one `dropped` at foreground end, and A is never inserted afterwards.
   - `resetSessionContext` on an idle session holding a queued v2 steer → exactly one `dropped`, and the steer is gone from the queue.
   - Cancel-timeout close: the run is held past the cleanup timeout (gated provider stream), the session is closed, then the run is released and emits the prompt's message. Expected: exactly one `dropped`/error, no persisted entry, no `inserted`, and no frame to the client after close.
   - A failed `switchSession` (forced rollback) restores a queued steer. No outcome fires during the switch; the steer later gets `inserted`.
   - An extension command → `command`. The prompt is acknowledged with a live-only id, and there is no session entry.
   - An ACP builtin → acknowledged with a live-only id, framed by `running` and `idle(end_turn)`.
   - Negative controls:
     - acknowledging on `onPromptAdmitted` fails the preflight and withdrawn-steer cases;
     - inferring drops from queue absence mid-run fails the claimed-steer and failed-switch cases;
     - removing the closure fails the delivery-record and reset cases (the callback never fires);
     - removing the tombstone fails the cancel-timeout case (a late `inserted` follows the `dropped`);
     - mapping `prompt()` → `false` to an error fails the extension-command case.
3. **Overlap (real session).** RED.
   - A second prompt during streaming resolves at its own insertion, before the foreground ends.
   - No `idle` appears between the two prompts.
4. **Agent-initiated work (real session).** RED.
   - After `idle`, a background job settles and its wake turn produces `running` as the first frame, before any `agent_message_chunk`, then chunks, then `idle(end_turn)`, with no prompt open.
   - The same holds for a Goal continuation.
   - Negative control: keeping the v1 prompt-scoped subscription loses the wake's frames.
5. **Cancel and errors.** All RED.
   - `idle(cancelled)` after the pending updates.
   - A late wake after a cancel emits no `running`.
   - A failure after insertion → prompt success plus `idle(error)` with `error.message`.
6. **requires_action.**
   - RED: a pending permission → `requires_action`; the answer → `running`.
   - RED: a resume while permission is pending → the snapshot says `requires_action`.
   - PORT: an unknown outcome → rejected. This is behaviour carried over from v1; it fails on `main` only because v2 is absent, so it does not count as discriminating evidence.
7. **Mapping conformance.**
   - RED: across the suite, no `tool_call`/`plan`/`current_mode_update` frames, no `fs/*`/`terminal/*` requests, zero schema issues.
   - RED: patch semantics, asserted directly (no schema needed): every path line is absolute; no `a/`/`b/`; `/dev/null` on add and delete; quoting for a path containing a space and a newline; paths match `changes`; `patch.text === patch.diff`.
   - RED: a copy with paths made repo-relative and `a/`/`b/` re-added passes `git apply --check` in a temp repo.
8. **Identity across resume (real session, file-backed).** All RED.
   - Two prompts with identical content, the same mocked `Date.now()` and the same attribution get two entries and two distinct messageIds.
   - Negative control: keeping the dedup for pending submissions loses the second entry and its acknowledgement.
   - After a process-equivalent reload (a new `SessionManager` on the same file), `replayFrom:start` replays both with the live ids.
   - No cursor → only the snapshot; `{type:"_custom"}` → `-32602`.
9. **Auth.**
   - RED: the terminal method appears only with `capabilities.auth.terminal: {}`.
   - RED: logout leaves the credential store byte-identical.
   - PORT: an unknown login method errors.
10. **Resource links.** RED: `{name:"n", title:"t", uri:"file:///x"}` → the model-facing prompt contains `file:///x`, on v1 and on v2.
11. **v1 byte identity.** GUARD.
    - Rerun every golden scenario; outbound frames equal the fixtures after normalisation.
    - The only allowed diff is the resource-link prompt text, which is not a wire frame.
12. **Regression.** GUARD: `acp-agent.test.ts`, `agent-session-*.test.ts` and `rpc*.test.ts` pass. The only expectation changes are the migrated gate-API callers listed in step 2.

**Commands (worktree)**
- `bun test packages/coding-agent/test/acp-v2.test.ts packages/coding-agent/test/acp-agent.test.ts packages/coding-agent/test/acp-v1-golden.test.ts`
- `bun test packages/coding-agent/test/agent-session- packages/coding-agent/test/rpc`
- `bun --cwd packages/coding-agent run check`

**Manual QA (F1).** Evidence goes under `.omo/evidence/acp-v2-baseline/`, one file per scenario.

1. **Scripted v2 client** (`/tmp/acp-v2-client/run.ts`): raw NDJSON against the worktree CLI `acp`, with `--config` setting `acp.protocolV2: true`. Every frame is schema-validated. Scenarios:
   - (a) messageId before turn end;
   - (b) a background `task` subagent wakes after `idle`: `running` → `idle`;
   - (c) cancel → `idle(cancelled)`;
   - (d) resume with `replayFrom:start` → same user ids, snapshot before the response.
2. **Same script with the flag off:** v1 initialize; the prompt blocks until turn end.
3. **Air** (IntelliJ 2026.2.3, `air.acp.v2.enabled=true`, `~/.jetbrains/acp.json` pointing at the worktree CLI, backed up first). Check:
   - an edit prompt shows streamed text, tool call, diff and the Stop state;
   - a background subagent result appears after the turn ended;
   - Stop works.

   Evidence: screenshots plus an `acp.log` excerpt. Restore `acp.json` and the registry key afterwards.

## Assumptions & contingencies

- **Same message object.** The user message object reaches `#appendSessionMessage` as the same object `#dispatchPrompt`/`#queueUserMessage` created (`agent-loop.ts:1140-1145,1337-1344` push it unchanged; confirmed by the re-review). If a copy intervenes, Verification 2 stays red after implementation. The fix then keys the registry on a symbol property copied with the message, not on a new mechanism.
- **Other `sessionManager.appendMessage` callers.** The callers at `agent-session.ts:2024,2739,11381-11385,11470,11738-11739,12409,12827` write internal records (eval state, interrupted results, the side-question rewrite at 12827). None of them carries a pending submission, so they need no outcome.
- **Air rejects another frame.** Record the exact frame from `acp.log`. Mirror a field only if it fits both shapes; otherwise stop and ask, because the schema is authoritative.
- **`requires_action` detection.** It rests on the permission path awaiting the client inside tool execution. If a concurrently progressing tool keeps the foreground moving, the state correctly stays `running`, as the schema allows.

## TODOs

1. Batch plan merged; worktree; schema fixture; v1 golden capture; harness extraction; RED tests (RED ones failing, GUARDs green)
2. utils: v2 types, versioned dispatch
3. AgentSession: insertion hook, user entry ids, gate callback; test-caller migration
4. ACP core seam: `ForegroundWork`, `AcpSurface`, v1 surface moved
5. v2 surface: subscription, prompt/insertion, states, cancel, mapping, git patch, permission, resume/replay, auth, capabilities; shared resource-link fix
6. Setting, README, changelog
7. `bun check`; focused, golden and regression suites green
8. F3 B1 (class `v2-foreground-waits-background-work`): under v2 a foreground ends without waiting for owner-scoped background jobs (`acp-agent.ts` `#waitForAcpPromptIdle` `settleAsyncWork` branch, `isAcpSessionQuiescent` `hasPendingAsyncWork`); the job's later wake is a separate agent-initiated foreground (`running` … `idle`). v1 keeps holding the open prompt. Test: a job started during the prompt and still running after the turn gives `idle(end_turn)` first, then the wake framed by its own `running`/`idle`.
9. F3 B2 (class `interaction-count-as-aggregate-state`): v2 reports `requires_action` only when every running foreground tool is blocked on an open interaction (or an interaction is open with no tool running); a tool start/end re-evaluates the state; `currentState` (live and resume snapshot) uses the same rule. Test: two parallel tools, one awaiting permission while the other is still running, stay `running`; once the other ends the state becomes `requires_action`; the answer returns `running`.
10. F3 Should-fix/Nit: `acp-surface-v2.ts` uses `PROTOCOL_VERSION_V2` from `v2/protocol.ts` instead of its own constant; its module header describes the finished surface.
11. F3 wave 2 B1 (class `unwired-cancellation-hook`): `cancel` calls the surface's `beforeCancel` (v2: latch, `cancelRequested`, interrupt-queue withdrawal) before aborting and before the foreground settles (`acp-agent.ts` `cancel`/`#beginCancelCleanup`; `acp-surface-v2.ts` `beforeCancel`, `allowsAgentInitiatedWork`). Test: a background job already running when Stop arrives completes later and emits no `running` and no wake frames (Verification 5 "A late wake after a cancel emits no `running`", made discriminating); RED without the call.
12. F3 wave 2 B2 (class `unsettled-pre-registration-admission`): a v2 Stop that lands before `AgentSession.prompt` registers the outcome (skill/command preparation or Goal admission held; the `cancelRequested`/`!confirmed` returns in `#runPromptOrCommand`) settles that prompt's admission: the request gets `requestCancelled` and its ACP queue slot is released at Stop, without waiting for the held operation. Test: cancel while Goal admission is held; before release, the cancelled request is answered and a following command prompt is acknowledged and runs. An ordinary prompt still waits on the Goal lane (residual risk 5).
13. F3 wave 2 B3 (class `v2-capability-discarded-at-consumer`): v2 `initialize` keeps the negotiated `capabilities.elicitation.form`; extension UI setup (`#configureExtensions`, `createAcpExtensionUiContext`) uses it under v2 and sends a v2-shaped `elicitation/create` through the v2 client view (`AgentSideConnectionV2.createElicitation`), counted as an interaction. v1 unchanged. Test: a real tool asking the user under a v2 client with form elicitation gets a schema-valid `elicitation/create`, `requires_action` while it is open, and the answer reaches the tool.
14. F3 wave 2 Should-fix (class `lifecycle-guarantee-tested-below-boundary`): the Verification 2 cases "Delivery-record loss" and "Cancel-timeout close" also run at the ACP v2 adapter boundary with a held provider, asserting outcomes, persisted entries and outbound frames (no frame after close); each RED against its negative control (closure removed / tombstone removed).
15. F3 wave 3 B1 (class `deferred-transition-overtakes-successor`): every v2 `state_update` for a record goes through one ordered emission path that also carries the deferred `user_message` echo, so a foreground's `idle` is sent before the next foreground's `running`, and dedup compares against the last state sent or queued in that order (`acp-surface-v2.ts` `#afterEcho`, `#emitState`, `onForegroundStart`, `onForegroundEnd`). Test: back-to-back short work (a locally handled command, then a held prompt turn) yields `running, idle, running`, never a trailing `idle` while the held turn runs; RED before the fix.
16. F3 wave 3 B2 (class `post-cancel-submission-after-preparation`): `#tryRunSkillCommand` checks after `buildSkillPromptMessage` that the originating foreground was not cancelled and is still current before `promptCustomMessage`; a cancelled skill sends nothing. The core path is shared, so v1 gets the same fix (changelog `### Fixed`). Test: Stop while the skill file read is held, then release: no model call, no skill message persisted, no frames after `idle(cancelled)`; RED before the fix.
17. F3 wave 4 B1 (class `echo-scheduled-by-timer-not-response-delivery`): the v2 `user_message` echo (and everything ordered behind it) is released when the transport has written the response frame that carries the prompt's `messageId`, instead of after a timer tick (`acp-surface-v2.ts` `#echoAfterResponse`; `packages/utils/src/acp/transport.ts` response-written signal). A prompt answered outside a transport request (no response to wait for) echoes without delay. A v2 `session/prompt` inside a JSON-RPC batch is rejected with `-32600` before admission and sends nothing (Tim's decision 2026-10-23, after four delta rounds: a long-running prompt inside a batch couples its response to its siblings, and every response barrier on it forms cycles with resume replay, other batches and EOF drain). Other v2 methods may still be batched; the same-batch resume rule and its batch-content API are removed. Tests: a single prompt's `user_message` and later updates follow its response frame; a batch holding a v2 prompt gets `-32600` for that entry, the other entries are answered, and no frame for that prompt is sent; RED before the fix.
18. F3 wave 4 Nit: the stale "only v1 is negotiable until the v2 surface exists" comment at `acp-agent.ts:648` describes the v1 initialize handler.
19. F3 wave 5 Should-fix (class `protocol-version-dependent-behavior-documented-as-universal`): the README `omp acp` section qualifies the tool-routing table as v1 (client `fs/*` and `terminal/*` routes depend on v1 client capabilities) and states that v2 keeps tool I/O local, gates edits and commands through `session/request_permission`, and requires `session/prompt` as a single request (a batched prompt gets `-32600`).
20. F3 wave 6 Should-fix (class `unqualified-message-identity-guarantee`): the README `omp acp` section and the coding-agent changelog entry claim message-id stability only for prompts persisted in the transcript (their id survives resume replay); agent replies and locally handled commands get fresh ids (accepted residual risks 3 and 4).
21. F3 wave 10 B1 (class `foreground-lifecycle-cleanup-bypass`): session close (`#closeManagedSession`) and agent disposal cancel in-flight v2 foreground work through the same view as `cancel` (`#turnOf`, `#surface.beforeCancel`, `#beginCancelCleanup`), so a v2 close withdraws queued steers and aborts the run; a closed record (`closedError` set synchronously by close and dispose, before any teardown await) admits no agent-initiated work under v2, idle or not; late continuations (`#tryRunSkillCommand` after `buildSkillPromptMessage`, the slash-command continuation, the prompt after a held Goal admission) check that the record is still open and submit nothing after close. Goal state that an overtaken Goal admission writes after close is Goal-mode behaviour and stays as accepted residual risk 6 (Tim's decision 2026-10-23). v1 wire bytes are unchanged; the closed-record guards on late continuations apply to v1 as well. Tests (ACP boundary, v2): close while a skill file read is held, then release: no skill message persisted, no model call, no frame after close; close while a Goal admission is held: the prompt is answered with an error, no user message is persisted and no frame follows the release; close an idle session while teardown is held, then fire a pending agent-initiated wake: no new turn, no model call; RED before the fix.
22. F3 wave 11 Should-fix (classes `duplicated-v2-command-dto-conversion`, `protocol-version-dependent-lifecycle-doc-drift`): one exported `convertAvailableCommandsToV2` in `acp-event-mapper-v2.ts` serves both the `available_commands_update` mapping and the v2 session-setup response (`acp-surface-v2.ts` `sessionSetupResponse`); `docs/advisor-watchdog.md` describes the preservation rule through the bridge's `allowAgentInitiatedTurns` callback instead of the removed `deferAgentInitiatedTurns`; the coding-agent changelog's background-job and steering entries say they describe protocol v1 (v2 ends the reply and frames the later wake as its own run). No behaviour change; covered by the existing mapper and session-setup tests.
23. F2 wave 1 Blocker B1 (class `terminal-transition-overtakes-inflight-update`): a v2 foreground's terminal `idle` is its last content frame. `AcpSurface` gains `acceptsUpdates(record, work)` (v1: always true, so v1 bytes are unchanged; v2: `record.foreground === work`). `AcpAgent.#handlePromptEvent` checks it synchronously before each mapped notification it sends, and the `agent_end` content fallbacks (`#flushMissedFinalAssistantText`, `#flushUnreportedTurnError`, the latter after its delivery await) check it right before sending; bookkeeping (tool args, live message id reset, `lastAgentEnd`) still runs. Session metadata (`usage_update`, `session_info_update`) is not foreground content and stays allowed after `idle`. ACP-boundary test: a real session whose one event maps to two notifications (a completed `todo` tool: `tool_call_update` then `plan`) has the first delivery held, the client cancels (and, in a second case, closes the session), the delivery is released; `idle(cancelled)` is the last content frame for that session. RED with the guard removed.
24. F2 wave 2 Blocker B1 (class `post-close-emission-tail`): the `session/close` response is the last frame for that session. While a close runs, `AcpSurfaceHost.recordFor` still resolves the closing record (`AcpAgent` keeps it in a closing map until the close is done), so updates sent during the close keep the record's ordered path instead of going out unordered. `#closeManagedSession` cancels the foreground, then awaits the update handlers in flight and the new `AcpSurface.drain(record)` before it disposes and answers. v1: `drain` resolves at once (v1 sends go straight to the transport, in call order; v1 bytes unchanged). v2: `drain` waits for the record's ordered emission tail (deferred `user_message`, `state_update`, mapped content) and then for the transport write of the last frame that tail handed over. Steps still run synchronously while nothing is queued, so a permission request never overtakes its `tool_call`. ACP-boundary test: the write of an inserted prompt's `user_message` is held, the client sends `session/close`, the write is released; every `session/update` for that session comes before the close response. RED with `drain` resolving at once.

## Implementation deviations (recorded at the end of TODO 7)

- **v2 `StopReason` gains `error`.** The vendored alpha.9 schema's `IdleStateUpdate` has an `error` stop-reason variant that the hand-written `v2/protocol.ts` lacked. A provider failure after insertion ends in `idle{stopReason:"error", error}` (`resolveTurnFailure` in `acp-foreground.ts`); v1's `resolveStopReason` is unchanged.
- **`#turnOf(record)`.** Core paths that read `record.promptTurn` (steered builtins, `cancel`, the goal's prompt-open gate) read a v2 view of `record.foreground` instead, so they work without a v1 pending request.
- **`trackInteraction` starts the request before `blocked`.** The client's `session/request_permission` frame precedes the `requires_action` state it causes. Elicitations are counted as interactions too.
- **`acp.protocolV2` is read only by `runAcpMode`.** `createAcpConnection` defaults `maxVersion` to 1 so embedders that build a connection before `Settings.init()` keep working (lazy-startup test).
- **Bootstrap sends are caught.** `#emitBootstrapUpdates` ran unawaited without `.catch`; a client disconnecting during bootstrap raised an unhandled rejection (found as a flaky v2 test).
- **Row 9 compares counts, not tool identities.** `isBlockedOnInteraction` is `pendingInteractions > 0 && pendingInteractions >= runningTools.size`: elicitations (`createAcpExtensionUiContext`) carry no tool call id, so interactions cannot be keyed to tools. A single tool holding two interactions at once would mask a still-running sibling; no current tool opens concurrent interactions. `requires_action` is announced only after it holds for one macrotask, because a permission request opens before its own tool's `tool_execution_start` reaches the surface; a permission answered within that macrotask never shows `requires_action`.
- **Row 14's tombstone control moved to a dispose test.** With row 11, Stop withdraws the held steer before the cleanup timeout closes the session, so the cancel-timeout close test cannot reach the tombstone. That test is RED against removing the cancel-timeout `#closeManagedSession` call instead. A third adapter test (`agent.dispose()` while the turn is held, then release) carries the tombstone control: without it the late steer is persisted.
- **Row 12 also covers a refused admission without Stop.** The early returns report `dropped`; without a Stop, v2 maps that to `internalError` ("Prompt dropped before insertion") instead of leaving the request unanswered.

## Final verification wave

- [x] F3. Whole-diff review: `integration-review` over `main...HEAD`; needed because the change spans utils dispatch, AgentSession insertion/gating, the ACP adapter and settings
- [x] F1. Manual QA on the real surface, one evidence path per scenario, on the head after F3's last code commit
- [x] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

## Merge gate

- Author's risk assessment: High.
  - A wrong foreground state leaves IntelliJ's Stop button stuck or hides wake work.
  - Acknowledging an uninserted prompt makes the client show a message the agent never saw.
  - A v1 regression hits every existing ACP user.
  - A gate-callback mistake could start invisible agent-initiated turns under v1.
- Mandatory class: wire-contract-api
- Risk tier: product
- Whole-diff review: needed
- Accepted residual risks:
  1. `patch.diff` duplicates `patch.text` only for Air's pre-alpha.9 `DiffPatch`; removed in Plan 2 once Air reads `text`.
  2. v2 is a draft; later schema revisions may need follow-ups, contained by the default-off `acp.protocolV2`.
  3. Locally handled commands (ACP builtins, extension and custom commands) get live-only message ids that replay does not reproduce, because they insert no conversation entry.
  4. Agent and thought message ids are not stable across replay (a SHOULD in the schema); Plan 2.
  5. After a Stop during a held Goal admission, the next ordinary prompt waits on the serialized Goal-mode lane (`acp-goal.ts` `admitPrompt`) until the overtaken `createForHostPrompt` returns. The lane is Goal-mode design from `main`, unchanged here and identical under v1; it keeps goal-state ownership and Stop compensation ordered. Accepted by Tim on 2026-10-23 (F3 delta, rows 11-14); follow-up belongs to the Goal-mode plan.
  6. A Goal admission held while its session is closed can still create or resume the goal and journal it after the close: `AcpGoalActor.dispose()` removes the mutation gate once no abort is unwinding, while the admission's `createForHostPrompt`/`resumeForHostPrompt` is still running (`acp-goal.ts` `dispose`, `admitPrompt`, `#enter`). Its prompt is not submitted (row 21). The code is Goal-mode design from `main`, unchanged here and identical under v1; the effect is local session state and reversible. Accepted by Tim on 2026-10-23 (F3 delta, row 21); follow-up belongs to the Goal-mode plan.
- Out of scope for blocking: display terminals, tool-call content streaming, notices, compaction updates, `session/delete`, `additionalDirectories`, v2 `session/fork`. All are in `.omo/plans/ACP_V2_EXTRAS_PLAN.md`. JSON-RPC batches are in `.omo/plans/ACP_JSONRPC_BATCH_PLAN.md`.
- Feature-specific criteria:
  - Invariant: Version selection never hands a v1 client a v2 frame, and v2 runs only when the client requests it and `acp.protocolV2` is true.
    Positive witness: flag on with requested 2 gives a schema-valid v2 `InitializeResponse`; flag off with requested 2 gives the golden v1 bytes.
    Negative control: a router returning `min(requested, 2)` regardless of the flag MUST fail the flag-off golden test.
    Observable: the `initialize` result body and the dispatcher chosen for the next frame.
    Boundary: `packages/utils/src/acp/connection.ts` `AgentSideConnection` request dispatch (today 235-271; becomes `dispatchAgentV1`/`dispatchAgentV2`); `packages/coding-agent/src/modes/acp/acp-mode.ts` connection construction.
  - Invariant: A v2 prompt that is not a locally handled command is acknowledged only after its user message is persisted, with that entry's id as messageId; replay after reload yields the same id; a prompt dropped before persistence is never acknowledged; every resolved submission reports exactly one outcome.
    Positive witness: messageId equals the persisted entry id while the turn still streams; reload plus `replayFrom:start` repeats it; two identical same-millisecond prompts get two entries and distinct ids; preflight denial and a withdrawn steer reject without blocking the next prompt.
    Negative control: acknowledging on `onPromptAdmitted` MUST fail the preflight-denial and withdrawn-steer tests; keeping the structural dedup for pending submissions MUST fail the identical-prompt test.
    Observable: prompt response or error, the `user_message` id, session file entries, replayed ids, the outcome-callback count.
    Boundary: `packages/coding-agent/src/session/agent-session.ts` `#dispatchPrompt` (7945), `#queueUserMessage` (~9100-9175), `#sessionMessageAlreadyPersisted` (4042), `#appendSessionMessage` (4065), `clearQueue` (9728), `takeQueuedMessage` (9831), `popLastQueuedMessage` (9904), `switchSession` (12176), `newSession` (10570), `dispose` (6146); `packages/agent/src/agent.ts` claim/restore (1039-1082); `session-context.ts:398-408`; `acp-agent.ts` `prompt` (921).
  - Invariant: A locally handled command under v2 is acknowledged with a live-only messageId, framed by `running` and `idle(end_turn)`, and creates no session entry.
    Positive witness: an extension command and an ACP builtin each give a prompt response, a `user_message` with the same id, `running`, then `idle(end_turn)`, and no new `message` entry in the session file.
    Negative control: treating `prompt()` → `false` as an error MUST fail the extension-command test.
    Observable: the response, ordered frames, session file entry count.
    Boundary: `agent-session.ts` local-command returns (7956-7970); `acp-agent.ts` `#runPromptOrCommand` (1143).
  - Invariant: Every v2 foreground interval, including agent-initiated ones, is announced by `running` (or `requires_action`) before its first content frame and closed by `idle` with a stop reason; resume reports the same aggregate state as the live stream.
    Positive witness: a wake after `idle` produces `running` as its first frame, then chunks, then `idle(end_turn)`; resume during a pending permission snapshots `requires_action`.
    Negative control: keeping the prompt-scoped subscription MUST lose the wake frames; snapshotting live foreground as `running` MUST fail the pending-permission resume test.
    Observable: the ordered `state_update` and chunk frames; the resume snapshot value.
    Boundary: `acp-agent.ts` event subscription (today 981-983, `#trackPromptEvent` 1870), quiescence wait (2065-2106) and resume (`resumeSession` ~850); planned `acp-surface-v2.ts`/`acp-foreground.ts`.
  - Invariant: Cancellation follows the v2 split: an uninserted prompt is rejected, an inserted one ends in `idle(cancelled)`, and no late wake resumes cancelled work.
    Positive witness: cancel mid-turn gives `idle(cancelled)` and a later async completion emits no `running`; cancel before insertion gives `requestCancelled`.
    Negative control: dropping the cancel latch MUST make the late wake emit `running`.
    Observable: prompt response or error and the `state_update` sequence.
    Boundary: `acp-agent.ts` `cancel` (1284-1357); the gate callers in `agent-session.ts` (2337, 9560, 9600, 9620).
  - Invariant: Every v2 frame validates against alpha.9; diffs carry absolute, prefix-free git patches consistent with `changes`; v2 never emits v1-only variants or calls client `fs/*` or `terminal/*`.
    Positive witness: zero schema issues across the suite; the patch assertions pass; the transformed patch copy applies.
    Negative control: re-enabling the v1 `plan`/`tool_call` mapping MUST produce a schema failure; emitting `a/`-prefixed paths MUST fail the patch assertions.
    Observable: `validateJsonSchemaValue` issues, patch path lines, the outbound method list.
    Boundary: `packages/coding-agent/src/modes/acp/acp-event-mapper.ts` (216-264, 467-490, 712-741); `acp-client-bridge.ts` (30-157); planned `acp-git-patch.ts`.
  - Mechanical: v1 wire bytes are unchanged.
    Invariant: every golden v1 scenario's outbound frames equal the pre-change fixtures after normalisation.
    Observable: the `acp-v1-golden.test.ts` result.
    Boundary: `acp-agent.ts` v1 handlers (`initialize` 745, `prompt` 921, `cancel` 1284, replay 2869) and `connection.ts` dispatch (235-271).
