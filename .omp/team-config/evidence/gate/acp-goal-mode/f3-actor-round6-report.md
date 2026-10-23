## Must-fix

### High — Abandoned-entry recovery can start after the next session-change barrier

**`packages/coding-agent/src/goals/host-controller.ts:195–219, 403–420, 442–445, 515–520`**

The recovery restore is now placed on `#exitTask`, but `beginSessionChange()` waits only for the tail that exists when it runs; it does not prevent a stale entry from enqueueing a recovery after that wait has finished.

[INFERENCE] If A’s entry remains in its tool swap while B is reconciled, a change to C can pass `beginSessionChange()` before A’s swap finishes. C can then choose its tools, after which A’s recovery enqueues and installs B’s saved tools. C’s subsequent reconcile waits for that recovery, but a C transcript without a Goal does not replace the resulting tool set. The new test covers the opposite ordering—recovery starts *before* C begins—not this one.

**Fix:** Make the session-change barrier and recovery reservation mutually ordered across the entire change, or make recovery detect an in-flight/newer change and defer to its final owner. Add a gated A→B→C test in which C passes `beginSessionChange()` and selects its tools **before** A’s recovery is enqueued; check C with and without a Goal.

- **class:** Host tool restoration can cross ownership despite a one-time barrier.
- **sites:** The demonstrated site is abandoned-entry recovery at `host-controller.ts:403–420`; stamped pause restoration at `:353–369, 453–456` and event-driven exits at `:263–265, 571–572, 595–596` were also inspected as sibling restoration paths. Whole-worktree `functions.grep` search: `setActiveToolsByName\(|#restoreTools\(|#exitTask|#ordered\(`.

## Should-fix

None substantiated.

## Nit

None.

## Checked

- **Previous round’s classes:** Request-time abort stamping is centralized in `AgentSession.abort` and forwarded to `onTaskAborted`; the reviewed caller inventory includes ACP Stop, extension, transition and maintenance calls. The previously untracked recovery now joins `#exitTask`, but the ordering gap above remains.
- **1. Duplication across slices/files:** No instance found.
- **2. Naming inconsistency:** No instance found for *admission*, *stamp*, or *reconcile*.
- **3. Uneven API surface:** No unintended instance found; optional stamps and the mutation gate distinguish ACP ownership from ungated hosts.
- **4. Mixed conventions:** No additional instance found.
- **5. Missing or premature abstractions:** No additional instance found.
- **6. Dead code:** No instance found among the reviewed actor, admission, stamp, gate and restoration symbols.
- **7. Doc drift:** No instance found in this delta; no locale keys or OpenAPI changes are present in the changed-file inventory.
- **Surprise scope and plan walks:** Reviewed the changed-file inventory against rows 10–21 and the design call. The listed files are within the Goal/runtime/ACP/session and test seams; no implementation of the explicitly excluded ACP modes or `/goal drop` was identified. The plan has no per-slice “Files modified” lists or new i18n keys.
- **Verification checklist:** Reviewed the RED/discrimination artifacts and QA matrix. The matrix records the full regression suite on `74ed09437d` and IDE evidence on `adf8c61f81`, not the reviewed head; the plan records the earlier IDE evidence as an accepted residual risk. No tests or manual QA were run in this read-only review.
- **Seams:** Reviewed prompt admission and release, Stop/abort ownership, mode transitions and plan exit, reporting and stale config, session changes and reconciliation, runtime commit fencing, tool-origin drop, host tool restoration, optional RPC/TUI gating, and the fake gate additions.
- **Simplification pass:** No additional substantiated cross-slice simplification candidate found.
- **Input limitation:** The supplied patch itself contains compacted/truncated sections, so the full textual diff could not be inspected end to end from that artifact; relevant current source and tests were read separately.

FAIL