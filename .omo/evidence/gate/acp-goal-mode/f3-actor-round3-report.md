## Must-fix

### 1. Mode changes and Stop compensation can pause the adopted transcript’s Goal

**High — `packages/coding-agent/src/modes/acp/acp-goal.ts:380-390, 405-406, 418-442, 456-465`; `packages/coding-agent/src/goals/runtime.ts:487-503`**

Explicit mode transitions and Stop compensation run on the actor lane, but transcript changes do not, and neither pause path carries a transcript fence through `pauseGoal()`’s awaited usage flush. If a switch to B completes while A’s pause is suspended, `pauseGoal()` reads and pauses B’s adopted Goal; an old Plan transition can then install Plan on B as well.

**Fix:** Bind mode effects and cancellation compensation to their reserved transcript/change generation, and revalidate ownership at the pause’s actual state and journal commit boundaries. Add gated tests for a switch during the pause flush for both explicit mode exit and Stop compensation.

- **class:** Unfenced actor effects crossing transcript ownership.
- **sites:** `AcpGoalActor.#applyMode` → `#leave` → `GoalHostController.pause` → `GoalRuntime.pauseGoal`; both Stop compensation paths call `#pauseForCancel` → the same host pause. Search: `functions.grep`, whole worktree, pattern `explicitModeChange\(|#applyMode\(|#pauseForCancel\(|#ownerToolNames|#entryAddedGoalTool|admitInterruptPause|onTaskAborted\(`, supplemented by `explicitModeChange\(|#applyMode\(|#leave\(|beginSessionChange\(|endSessionChange\(|#pauseForCancel\(` over `packages/coding-agent/src`.

### 2. A stale abort still mutates the new Goal’s accounting before its fence

**High — `packages/coding-agent/src/goals/runtime.ts:276-288, 355-405`; `packages/coding-agent/src/modes/acp/acp-goal.ts:211-215`**

`onTaskAborted()` flushes the *current* Goal’s usage and clears the current turn snapshot before checking `admitInterruptPause()`. Thus A’s late abort, after B has been adopted, can update or journal B’s usage, change B to budget-limited, and discard B’s turn accounting even though the later pause is correctly refused.

**Fix:** Check the abort’s ownership before any accounting or snapshot mutation, and preserve that ownership across the flush’s await. Add a gated test that adopts an active B Goal with accounting in progress before releasing A’s abort, asserting B’s usage, budget status, journal and turn snapshot remain unchanged.

- **class:** Stale abort accounting crossing transcript ownership.
- **single instance:** The whole-worktree search `explicitModeChange\(|#applyMode\(|#pauseForCancel\(|#ownerToolNames|#entryAddedGoalTool|admitInterruptPause|onTaskAborted\(` finds the production interrupted-abort entry at `AgentSession.abort` and its single `GoalRuntime.onTaskAborted` implementation; the accounting helper and its other callers were inspected separately with `#ownerToolNames|#entryAddedGoalTool|admitInterruptPause|onTaskAborted\(|#flushUsageLocked|#aborts|setActiveToolsByName`.

### 3. Abandoned-entry recovery removes a Goal tool owned by the new transcript

**High — `packages/coding-agent/src/goals/host-controller.ts:377-382, 478-479, 495-504`**

While A’s fenced tool swap is pending, `#ownerToolNames()` removes `goal` whenever `#entryAddedGoalTool` is nonzero, even if B independently enabled `goal` in its own tool selection. B’s no-goal restore then loses its selected tool, or B’s Goal snapshot omits it and removes it on Goal exit.

**Fix:** Track the provenance of the actual tool swap or capture B’s independently selected tool set without inferring ownership solely from the pending-entry counter. Extend both abandoned-entry tests with B’s initial tools including `goal`, and verify it survives recovery and, when applicable, Goal exit.

- **class:** New-owner tool selection misclassified as stale entry state.
- **sites:** Both `#ownerToolNames()` consumers: the `#ownerTools` snapshot at reconciliation and the `#previousTools` snapshot for a reconciled Goal. Search: `functions.grep`, whole worktree, pattern `explicitModeChange\(|#applyMode\(|#pauseForCancel\(|#ownerToolNames|#entryAddedGoalTool|admitInterruptPause|onTaskAborted\(`.

## Should-fix

None.

## Nit

None.

## Checked

- **Previous round 1 classes:** Tool create/resume/drop/complete now reserve ownership; dead admission actor state is removed; the rewritten P×M test and discrimination artifact record the required failures. The reported-mode issue was considered under the plan’s recorded dismissal and is not re-raised.
- **Previous round 2 classes:** Drop and complete now recheck after the usage flush, and drop after event delivery. Abandoned entries no longer directly commit A’s `#previousTools`, but finding 3 identifies a remaining new-owner selection case. Abort bindings survive timeout and disposal until the underlying abort settles, but finding 2 identifies an earlier accounting write outside that fence.
- **1. Duplication across slices/files:** No instance found.
- **2. Naming inconsistency:** No instance found for *admission*, *reconcile*, or *continuation*.
- **3. Uneven API surface:** No instance found; the shared runtime gate and host-entry fence are optional host-specific contracts.
- **4. Mixed conventions:** No instance found.
- **5. Missing or premature abstractions:** No additional instance found.
- **6. Dead code:** No instance found among the searched new ownership types, helpers and fields.
- **7. Doc drift:** No instance found in this delta; no locale keys or OpenAPI changes appear in the supplied patch.
- **Surprise scope and plan walks:** The supplied production and test paths fall within rows 10–16 and their shared Goal/ACP seams. No implementation of the excluded ACP Vibe, guided-goal, Loop, Tan, or `/goal drop` features appears in the patch. The plan has no per-slice “Files modified” lists or new i18n keys to reconcile.
- **Verification checklist:** The RED and guard-discrimination artifacts were reviewed. The suite evidence identifies `fc293833cb`, and the manual QA matrix identifies earlier heads, so they do not establish the full verification checklist on reviewed head `89d8b95b24`. No tests or manual QA were run in this read-only review.
- **Seams:** Reviewed actor admission, cancellation, explicit modes, plan approval, reporting, events, reconciliation, session changes and quiescence; runtime gate and tool-origin dispatch; host fencing and RPC boundary; persisted stale-config lookup; both test fakes; fenced-entry tool ownership; and abort release/disposal. Findings 1–3 describe remaining ownership failures.
- **Simplification pass:** No additional substantiated cross-slice simplification candidate found.

FAIL