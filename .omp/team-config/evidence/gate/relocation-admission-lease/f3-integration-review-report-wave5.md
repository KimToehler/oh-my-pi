INTEGRATION-REVIEW-REPORT-v1
PASS — whole-diff integration review

## Must-fix

None.

## Should-fix

- `packages/coding-agent/src/registry/agent-lifecycle.ts:449`; `packages/coding-agent/src/collab/host.ts:1192`; `packages/tui/src/overlays/agent-transcript-viewer.ts:622`; `packages/coding-agent/src/modes/rpc/rpc-mode.ts:838`; `packages/coding-agent/src/task/executor.ts:3857,3887` — **what:** Admission is still acquired for already-live human chat, steer, and follow-up paths, despite the pinned plan excluding the prompt/resume portion of those already-live paths.  
  **why:** A normal human steer/chat or live-idle follow-up waits behind a same-tree relocation even though no transcript revival requires protection; this is reversible latency and is expressly out of scope for blocking, so it is not a blocker.  
  **fix:** Determine whether a parked/killed revival is needed before carrying a ticket through the subsequent prompt; retain the pre-revival ticket and D4 hand-off guarantee for actual revival paths.  
  **class:** unconditional admission of excluded live prompt/resume paths. **sites:** all six sites above: shared `promptLive` feeds both chat callers; RPC acquires for known-live steering; executor acquires both the initial and post-ownership-wait generations. **Search run:** `functions.grep(pattern="(?:tryAdmit|\\.admit\\(|promptLive\\(|ensureLive\\()", path="packages/coding-agent/src;packages/tui/src", case=true, gitignore=true, skip=0)`.

- `packages/coding-agent/test/task/executor-subagent-reminders.test.ts:403-412` — **what:** The F2 regression releases `firstLease` before retry generation two can start, so it proves the retry releases its ticket once running but does not prove that the retry reacquires admission and waits behind a lease.  
  **why:** Removing the new retry-side `beforeHandOff` acquisition would leave this test able to pass because the lease is no longer held at `retryStarted`; this weakens the regression proof for the exact previously-fixed race, but does not substantiate a current runtime defect.  
  **fix:** Open the lease after the busy turn becomes idle and before the retry is permitted; assert prompt count remains one while it is held, then release it and await `retryStarted`. Keep the existing second/reminder lease-readiness assertions.  
  **single instance:** the only regression named for this F2 retry-admission behavior is this test. **Search run:** `functions.grep(pattern="retry reacquires admission|retry admission|beforeHandOff|onHandOff", path="packages/coding-agent/test;packages/coding-agent/src", case=false, gitignore=true, skip=0)`.

## Nit

None.

## Checked

- **Duplication across slices/files:** no instance found. `RelocationAdmission` is the sole ticket/lease queue; registry, IRC, lifecycle, session, and relocation hosts consume that contract rather than recreating release or FIFO logic.
- **Naming inconsistency:** no instance found. The nouns *relocation admission*, *lease*, *ticket*, *session tree*, and *artifacts directory* are consistent across source, TUI interface, tests, and docs.
- **Uneven API surface:** no instance found. `ensureLive(id, { admission })` remains the low-level revival operation and `promptLive(...)` is the paired revival-and-prompt operation; TUI transcript chat consistently uses the latter.
- **Mixed conventions:** no instance found. Deferred `session_move`, command-controller relocation, and headless relocation synchronously hold, await `ready`, and dispose a relocation lease around their complete operation.
- **Missing abstractions / abstraction gravity:** no additional instance found. The repeated `tryAdmit(...) ?? await admit(...)` intentionally preserves the no-yield fast path; membership, ticket tracking, and release order remain centralized.
- **Dead code:** no instance found. Production users exist for `RelocationAdmission`, `RelocationLease`, `AdmissionTicket`, `promptLive`, `holdRelocationAdmission`, `getMoveTargetSessionFile`, `sessionTreeMembership`, and `artifactsDirOf`.
- **Doc drift:** no instance found. The two session-move docs and Unreleased changelog describe tree-scoped delivery/revival waiting, failure/rollback release, and other-tree isolation. No i18n keys, locale files, OpenAPI contract, or public wire shape were added.
- **Previous class confirmation:** the prior non-blocking unconditional-live-admission class remains at every listed site and is reported above as one whole class.
- **F2 retry-generation fix:** source confirms `driveSessionToResult` invokes `beforeHandOff` before every prompt dispatch and restore scheduling, invokes `handOff` immediately after prompt submission/restore scheduling, and `runSubagentFollowUpTurn` releases and reacquires per generation (`packages/coding-agent/src/task/executor.ts:2621-2627,2660-2662,2896,3853-3888,3974-3977`). The new regression covers post-submission release for retry and reminder generations, but has the proof gap reported above.
- **Current-main `SessionManager` integration:** confirmed. `#moveTargetSessionFile` is published before artifact rename and descendant-ref rebasing, stays available through the move, and clears in `finally` (`packages/coding-agent/src/session/session-manager.ts:2667-2672,2795-2799,3280-3281`); `AgentSession` uses it together with hold-time IDs and source/current directories (`agent-session.ts:3370-3387`).
- **Command-controller fixture repair:** confirmed. Both affected fixtures now provide an already-ready disposable relocation lease (`test/modes/controllers/bash-command.test.ts:48-52`; `test/modes/controllers/move-command.test.ts:42-46`), matching task 8.3 and the supplied merged-main evidence.
- **Surprise-scope walk:** no unexpected production surface found. All changed production files map to D1–D5, the warm-revival repair, the F2 retry repair, or current-main fixture integration. Evidence/gate artifacts and task completion updates are part of the final-verification surface.
- **Plan walks:** all pinned requirements, relocation entry points, and task-level verification targets were traced. All task rows are checked; supplied F1 artifacts contain their required `RESULT` witnesses, and the merged-main evidence records the claimed suite/check results. Commands were not independently executed in this read-only review. The plan has no per-slice “Files modified” lists; its task-level path lists cover the production surface and associated tests. Out-of-scope root client prompting and subagent background-completion handling were not added; already-live human prompt/resume admission remains the explicitly non-blocking Should-fix above.
- **Seam list:** reviewed registry ticket/lease ownership and FIFO release; IRC ticket lifetime through lifecycle and delivery; lifecycle revival/prompt hand-off; task/RPC/collab/TUI consumers; source/current/target tree membership during rebasing; deferred pre-barrier root wakes; running-work busy signals; deferred/TUI/headless/ACP/RPC relocation holders; warm revival from the rebased ref; and retry/reminder ticket generations.
- **Simplification pass:** no additional whole-diff simplification candidate found.

PASS