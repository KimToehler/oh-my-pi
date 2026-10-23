## Must-fix

### 1. Abandoned-entry recovery is still outside the session-change barrier

**High — `packages/coding-agent/src/goals/host-controller.ts:400-417, 195-219, 503-509`**

The pause restore now joins `#exitTask`, but the stale-entry recovery restore at line 416 does not. If A’s entry is abandoned after B is reconciled, and that recovery’s asynchronous tool mutation is delayed while the session changes again to C, neither `beginSessionChange()` nor C’s reconcile waits for it; B’s recovery can consequently land after C has been adopted and replace C’s tools.

**Fix:** Order abandoned-entry recovery with session changes as well, or make its tool mutation ownership-aware through completion. Add a gated A→B→C test that holds the recovery restore and checks C’s tools, including a C transcript without a Goal.

- **class:** Untracked asynchronous host tool restoration crossing ownership.
- **sites:** The remaining untracked site is `GoalHostController.#enter`’s abandonment restore at line 416. Both stamped pause paths now use `#restoreTools` and `#exitTask`; queued event-driven exits also use `#exitTask`. Whole-worktree `functions.grep` search: `setActiveToolsByName\(|#restoreTools\(|#exitTask|#reconcileTask`.

### 2. Extension-originated aborts reserve Goal ownership too late

**High — `packages/coding-agent/src/modes/acp/acp-agent.ts:3197-3199`; `packages/coding-agent/src/session/agent-session.ts:10294-10363`; `packages/coding-agent/src/goals/runtime.ts:371-374`**

ACP’s extension `abort` callback calls `session.abort()` without a Goal stamp; after the abort’s awaited cleanup, `onTaskAborted()` therefore reserves the *then-current* transcript rather than the transcript the extension interrupted. If A’s abort is held while B is adopted, that late abort can flush B’s accounting and pause B’s active Goal.

**Fix:** Reserve ownership when an abort begins, including aborts without an explicitly supplied ACP Stop stamp, and retain that binding through `onTaskAborted`; preserve the no-gate RPC/TUI behavior. Add a gated extension-abort test that adopts B before releasing A’s abort.

- **class:** Abort ownership reserved at unwind rather than request.
- **sites:** The explicit ACP extension callback above; the shared `AgentSession.abort` path also accepts unstamped calls from its own extension context and session-transition/maintenance callers (`agent-session.ts:8722-8723, 10423, 12048`; `session-maintenance.ts:1210`). Other hosts and subagent callers were inventoried but do not install this ACP gate. Searches: whole-tree `functions.grep` patterns `(session|#session|\.session)\.abort\(` and `this\.abort\(|\.abort\(\{\s*goalReason|goalReason:`.

## Should-fix

None.

## Nit

None.

## Checked

- **Prior round 4 classes:** Cross-abort interference is addressed for ACP Stop: each Stop passes its own stamp through `session.abort`, and the gate compares that stamp rather than all pending aborts. Both stamped pause restore paths now join `#exitTask`; the previously listed abandoned-entry recovery site remains open as Must-fix 1. The same-session branch and tool-set-equality classes are accepted residual risks and are not raised as blockers.
- **1. Duplication across slices/files:** No instance found.
- **2. Naming inconsistency:** No instance found for *admission*, *reconcile*, or *continuation*.
- **3. Uneven API surface:** No unintended instance found; the runtime gate and host stamps are optional host-specific contracts.
- **4. Mixed conventions:** No additional instance found.
- **5. Missing or premature abstractions:** No additional instance found.
- **6. Dead code:** No instance found among the searched new actor, admission, stamp, gate, and restore symbols.
- **7. Doc drift:** No instance found in this delta; it adds no locale keys or OpenAPI changes.
- **Surprise scope and plan walks:** The changed production and test paths are within rows 10–19’s Goal/runtime/ACP seams. No ACP exposure of Vibe, guided-goal, Loop, Tan, or `/goal drop` was found. The plan has no per-slice “Files modified” lists or new i18n keys.
- **Verification checklist:** Reviewed the RED and discrimination artifacts, suite record, QA matrix, and manual evidence. The recorded full suite names `fc293833cb`; the manual runs name earlier heads, so those records do not establish the complete checklist on `be81d6c9c0`. The plan expressly accepts the lack of a later IntelliJ run. No tests or manual QA were run in this read-only review.
- **Seams:** Reviewed admission and release, Stop and abort settlement, explicit mode and plan exit, reporting and stale-config persistence, observations and reconciliation, quiescence, runtime fencing, tool-origin drop, host entry and restoration, RPC’s optional-gate boundary, and the two fake gates. The Must-fix findings identify remaining restoration and abort ownership gaps.
- **Simplification pass:** No additional substantiated cross-slice simplification candidate found.

FAIL