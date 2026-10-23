## Must-fix

### 1. Same-session tree navigation does not change Goal ownership

**High — `packages/coding-agent/src/modes/acp/acp-goal.ts:253-281, 521-524, 620-638`; `packages/coding-agent/src/goals/host-controller.ts:239-240`; `packages/coding-agent/src/session/agent-session.ts:12974-12990`**

Ownership generation, abort fencing, reconcile detection, and the stale-config cache are keyed by session ID, but `navigateTree()` changes the active branch without changing that ID. A mode pause or late abort reserved on the old branch can therefore write to the new branch, while Goal state and cached stale config can remain those of the branch navigated away from.

**Fix:** Treat a committed tree navigation as an ownership change even when the session ID is unchanged; reconcile the new branch and invalidate or rebind branch-derived stale config. Add gated navigation tests for a suspended pause and late abort, plus a stale-config test across branches.

- **class:** Branch changes not represented in Goal ownership.
- **sites:** ACP actor transcript/abort stamps and stale-config cache; host controller session-change reconciliation detection; ACP `navigateTree` wrapper at `acp-agent.ts:3230-3237`. Whole-worktree `functions.grep` search: `#transcriptGeneration|#transcriptId|#gateOwns|#sessionBeforeChange|#transcriptBeforeChange|#staleValues|navigateTree\(|\.branch\(`.

### 2. One old abort can suppress a later transcript’s legitimate Stop

**High — `packages/coding-agent/src/modes/acp/acp-goal.ts:277-282, 365-387`; `packages/coding-agent/src/goals/runtime.ts:370-399`**

The abort gate rejects an interrupted abort if *any* unsettled Stop belongs to another transcript, rather than checking the binding of the abort invoking it. If A’s abort is still pending after B is adopted, Stop in B also fails the gate, so B’s `onTaskAborted` is absorbed without pausing B’s active Goal.

**Fix:** Carry the individual Stop’s ownership token through its own `session.abort()` to `onTaskAborted`, and check that token rather than the set of all outstanding aborts. Add a gated A-then-B Stop test that keeps A pending while B’s abort settles.

- **class:** Cross-abort ownership interference.
- **sites:** The actor’s `#aborts` set and `abort` scope check; ACP cancel cleanup; `AgentSession.abort` → `GoalRuntime.onTaskAborted`. Whole-worktree `functions.grep` search: `#aborts|abortSettled|onTaskAborted\(|goalReason|#gateOwns`.

### 3. Tool-set equality is not proof of tool-selection provenance

**High — `packages/coding-agent/src/goals/host-controller.ts:390-398, 493-495, 512-527`; `packages/coding-agent/test/goals/goal-host-controller.test.ts:655-685`**

`#ownerToolNames()` treats a set equal to a pending entry’s target as the entry’s installation even when the new owner independently chose that exact set. For example, if A’s swap target is `["read", "goal"]` and B selects precisely `["read", "goal"]`, B’s selection is reconstructed as `["read"]`; recovery or a later Goal exit removes B’s own `goal` tool.

**Fix:** Track actual selection ownership or serialize the selection and handoff so provenance does not have to be inferred from set equality. Extend both B-with-goal and B-without-goal tests with B’s selected set exactly equal to A’s pending target.

- **class:** New-owner tool selection misclassified as stale entry state.
- **sites:** Both `#ownerToolNames()` consumers, the reconcile `#ownerTools` snapshot and the reconciled Goal’s `#previousTools` snapshot. Whole-worktree `functions.grep` search: `GoalOwnerStamp|GoalOwnerScope|GoalOwnerStale|GoalMutationGate|sameToolSet|#ownerTools|#toolSwaps|#aborts|onTaskAborted\(`.

### 4. A pause’s in-flight tool restore is outside the session-change barrier

**High — `packages/coding-agent/src/goals/host-controller.ts:204-220, 354-369, 432-437, 486-514`; `packages/coding-agent/test/acp-agent.test.ts:6381-6410`**

The stamped pause checks ownership before calling `#exit()`, but its asynchronous tool restore is not added to `#exitTask`, which is what `beginSessionChange()` and reconciliation await. A transcript switch can therefore complete while the old restore is pending; its old tool selection can subsequently land in a new transcript, particularly one whose reconcile has no Goal and does not install another tool set.

**Fix:** Include stamped pause restores in the session-change ordering or make the tool mutation itself ownership-aware and compensate safely after a switch. Extend the existing held-tool-restore test to assert the new owner’s tool selection, including a new transcript without a Goal.

- **class:** Untracked asynchronous host tool restoration crossing ownership.
- **sites:** Both pause paths calling `#exit()` (`pause`’s already-paused branch and `#pause`), and stale-entry recovery’s asynchronous restore at `#enter`; queued completion/drop exits use `#exitTask` and were inspected separately. Whole-worktree `functions.grep` search: `setActiveToolsByName\(|#exit\(|#reconcileOnce\(|onThreadResumed\(`.

## Should-fix

None.

## Nit

None.

## Checked

- **Prior round classes:** Tool mutators now reserve stamps and runtime state/journal/accounting writes use the central commit helper; the prior P×M, dead-admission-state, and post-await mutation checks were inspected. Abort bindings survive timeout, but finding 2 identifies interference between bindings. The reported-mode transcript issue was not re-raised under the recorded dismissal. Findings 1, 3, and 4 identify remaining ownership cases.
- **1. Duplication across slices/files:** No instance found.
- **2. Naming inconsistency:** No instance found for *admission*, *reconcile*, or *continuation*.
- **3. Uneven API surface:** No instance found beyond the intentional optional ACP ownership gate.
- **4. Mixed conventions:** No instance found.
- **5. Missing or premature abstractions:** No additional instance found.
- **6. Dead code:** No instance found among the searched new ownership types, helpers, and fields.
- **7. Doc drift:** No instance found in the delta; it adds no locale keys or OpenAPI changes.
- **Surprise scope and plan walks:** Changed production and test files are within the Goal runtime/controller, ACP actor and integration, and test surfaces in rows 10–17. No implementation of the excluded Vibe, guided-goal, Loop, Tan, or ACP `/goal drop` features was found. The plan provides no per-slice “Files modified” lists or new i18n keys.
- **Verification checklist:** Reviewed the RED and discrimination artifacts and the suite and manual-QA evidence. The suite artifact names `fc293833cb`, and the manual evidence names earlier heads; they do not establish the complete checklist on reviewed head `4272a90ed7`. No tests or manual QA were run in this read-only review.
- **Seams:** Reviewed prompt admission, Stop and abort release, explicit modes and plan exit, mode reporting and stale config, observations, session changes and reconciliation, runtime mutation gate, tool-origin drop, host entry/restore paths, RPC’s optional-gate boundary, and both fake gate methods. Findings above identify remaining ownership failures.
- **Simplification pass:** No additional substantiated cross-slice simplification candidate found.

FAIL