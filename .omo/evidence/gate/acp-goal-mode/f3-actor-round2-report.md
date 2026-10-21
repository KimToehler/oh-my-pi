## Must-fix

### 1. Tool-mutation ownership is checked before, not at, every commit boundary

**High — `packages/coding-agent/src/goals/runtime.ts:509-522, 529-545`**

`dropGoal` and `completeGoalFromTool` check their reservation before awaiting `#flushUsageLocked`; after that await they read the current goal and mutate it without checking ownership again. In addition, `dropGoal` awaits the dropped-event delivery before clearing and journaling state, without another check.

A transcript change can therefore reconcile B while an A-origin mutation is suspended, after which the old call can complete or clear B’s adopted goal. The new tests hold the accounting chain *before* the reservation check, so they do not cover this window.

**Fix:** Revalidate the reservation after each awaited operation and immediately before each state or journal mutation; ensure the dropped-event delivery cannot be followed by a stale clear. Add gated tests that switch and finish reconciliation during the usage flush and, for drop, during event delivery.

- **class:** Goal-tool mutation crossing transcript ownership after admission.
- **sites:** `GoalRuntime.dropGoal` and `GoalRuntime.completeGoalFromTool`; tool dispatch is `goals/tools/goal-tool.ts:100-104`. Create and resume have no await between their gate check and initial state commit. Searched the whole worktree with `functions.grep`, pattern `admitToolMutation|#flushUsageLocked|#commitState\(undefined|admitInterruptPause|abortSettled|GoalEntryAbandoned|#previousTools`, and callers with `\.(createGoal|resumeGoal|dropGoal|completeGoalFromTool|replaceGoal|onBudgetMutated)\(`.

### 2. Abandoned entry restores the old transcript’s tool set over the new owner

**High — `packages/coding-agent/src/goals/host-controller.ts:351-362, 452-455`**

When an entry loses its fence, its cleanup reconstructs the active tool set from `previousTools` captured before the transcript change, rather than from the reconciled owner’s tool set. It can also overwrite `#previousTools` after a reconcile has established the new owner’s snapshot.

If the adopted session has a different tool selection, the stale entry can replace it with A’s selection and leave the wrong snapshot for a later Goal exit.

**Fix:** Make the late tool-swap compensation use an ownership-stamped snapshot of the *current* reconciled tool state, without overwriting its `#previousTools`; test a switch where A and B have different enabled tools, both with and without a B goal.

- **class:** Stale owner’s tool restoration after abandoned entry.
- **sites:** The single abandonment cleanup in `GoalHostController.#enter`; its shared snapshot is read or written by `#exit`, `#reconcileOnce`, and `observe`. Searched the whole worktree with `functions.grep`, pattern `admitToolMutation|#flushUsageLocked|#commitState\(undefined|admitInterruptPause|abortSettled|GoalEntryAbandoned|#previousTools`.

### 3. A timed-out abort loses its transcript fence while the abort is still running

**High — `packages/coding-agent/src/modes/acp/acp-agent.ts:1326-1331`; `packages/coding-agent/src/modes/acp/acp-goal.ts:201-204, 381-383`**

`abortSettled()` clears the abort’s transcript generation when the timeout wins `Promise.race`, although the underlying `session.abort()` has not settled; session disposal also removes the mutation gate. A late `onTaskAborted` can consequently pause the active goal adopted by a transcript switch that completed while the abort was pending, including after timeout-driven closure has begun.

**Fix:** Bind the interrupted pause to the individual abort until the underlying abort actually settles, including timeout and disposal paths; do not let a later abort overwrite its ownership. Add a gated timeout test that adopts B before releasing A’s late abort.

- **class:** Premature release of asynchronous abort ownership.
- **sites:** The ACP cancel-cleanup race and its `abortSettled`/`admitInterruptPause` gate; `AgentSession.abort` reaches the pause at `session/agent-session.ts:10359`. Searched the whole worktree with `functions.grep`, pattern `abortSettled|admitInterruptPause|ACP_CANCEL_CLEANUP_TIMEOUT_MS|Promise.race\(\[record.session.abort`, and searched session callers with `onTaskAborted\(`.

## Should-fix

None.

## Nit

None.

## Checked

- **Previous class — unstamped tool mutations:** Partially closed. Create, resume, drop and complete reserve stamps, and the supplied RED/discrimination evidence covers queued resume and drop; finding 1 identifies the remaining post-check await windows.
- **Previous class — cross-transcript reported mode:** The orchestrator’s recorded dismissal was considered; no consequence outside that rationale is raised here.
- **Previous class — dead admission state:** Closed. The actor field, constructor argument and getter are absent; the remaining admission callbacks have production consumers.
- **Previous class — P×M RED:** Closed for discrimination: `actor-red.txt` records the rewritten test failing on `fc293833cb`, and `actor-discrimination.txt` records failure with the mode-stamp clause removed. The test holds goal-event delivery rather than the mode notification described literally in row 13.
- **1. Duplication across slices/files:** No instance found.
- **2. Naming inconsistency:** No instance found for *admission*, *reconcile*, and *continuation*.
- **3. Uneven API surface:** No instance found; the optional host fence and runtime gate serve different host-specific contracts.
- **4. Mixed conventions:** No instance found.
- **5. Missing or premature abstractions:** No instance found.
- **6. Dead code:** No remaining instance found in the reviewed admission object and new ownership helpers.
- **7. Doc drift:** No user-facing documentation, locale keys or OpenAPI changes were present in this delta; no instance found.
- **Surprise scope and plan file walk:** Production and test changes are within the actor, ACP, shared Goal runtime/controller and test-fake surfaces of rows 10–13. The supplied patch and changed-file inventory were read; no implementation of Vibe, guided-goal, Loop, Tan, or ACP `/goal drop` was found.
- **Verification checklist:** Reviewed the RED/discrimination artifacts and the existing suite and QA evidence. The suite evidence names `fc293833cb`, and the QA matrix names earlier heads, so neither establishes the full checklist on `7384c41d67`; no tests or manual QA were run in this read-only review.
- **i18n walk:** No new i18n keys or locale changes in the delta.
- **Seams:** Reviewed actor admission, Stop, explicit modes, reporting, events, reconcile and session-change callers; runtime gate and tool origin; host fence and RPC boundary; persisted stale-config reader; and both fake gate methods. Findings 1–3 identify the remaining ownership failures.
- **Simplification pass:** No additional substantiated cross-slice simplification candidate found.

FAIL