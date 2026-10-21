## Must-fix

1. **High — Plan-proposal ownership is reserved too late and does not cover transcript changes.**  
   `packages/coding-agent/src/session/agent-session.ts:1747-1770`, `packages/coding-agent/src/modes/acp/acp-agent.ts:2433-2450`, `packages/coding-agent/src/modes/acp/acp-goal.ts:471-473,624-645`.

   **What:** The proposal captures its ACP mode generation only after plan resolution and optional review have awaited; the captured generation also excludes session-change and transcript ownership.  
   **Why:** [INFERENCE] A proposal can await `resolveApprovedPlan` or `reviewProposedPlan`, while the client selects Goal and then a new Plan; its old handler then reserves the *new* generation and can reject into, or approve and exit, the new Plan. Similarly, an approval awaiting the client can outlive a switch to another transcript without changing `#modes`, then write Plan state or a reference there. These are remaining instances of the round-7 stale-completion class, not the frozen same-session-file branch class.

   **Fix:** Reserve proposal ownership at dispatch, before resolution or review, and carry it through the ACP handler. Include transcript/session-change ownership as well as mode generation; check it before every proposal-derived Plan-state or reference write. Add gated tests for resolution/review and a distinct-transcript switch.

   **class:** stale plan-proposal completion after ownership changes.  
   **sites:** `submitPlanProposal` → `#applyPlanReview`/`#promotePlanFilePath`; `#handleAcpPlanProposal` rejection, approval, and `exitPlan`; `reservePlanProposal`. Searches run with `functions.grep` across `packages/coding-agent/src`: `setPlanModeState\(|setPlanReferencePath\(|#promotePlanFilePath\(` and `async submitPlanProposal|#applyPlanReview|reviewPlan\(`.

2. **High — Superseded reviewed approval can overwrite a newer plan reference while “rolling back.”**  
   `packages/coding-agent/src/modes/acp/acp-agent.ts:2469-2473`; `packages/coding-agent/src/session/agent-session.ts:1899-1917`.

   **What:** `adoptApprovedPlan` writes the reference after its filesystem awaits, and the stale branch unconditionally restores the reference captured before those awaits.  
   **Why:** [INFERENCE] While the old adoption awaits `mkdir` or `writeFile`, a newer mode decision and plan approval can install a newer reference; the old adoption then writes its own reference, detects stale ownership, and restores the *older* captured reference, losing the newer approved reference. The existing gated test checks restoration when no intervening reference was installed, not this ordering.

   **Fix:** Separate snapshot creation from reference installation: await creation, recheck ownership, then synchronously install the reference only if still current. Do not compensate by restoring a stale snapshot of mutable state; add a gated newer-approval test.

   **class:** stale asynchronous effect compensated over a newer owner’s state.  
   **sites:** the reviewed ACP adoption and rollback above. The repository-wide search `adoptApprovedPlan\(|setPlanReferencePath\(` also found interactive and prewalk consumers; those do not use this ACP rollback, so they are not sibling sites of this specific defect.

3. **Medium — The specified post-entry prompt-admission negative control is not exercised at its required seam.**  
   `packages/coding-agent/test/acp-agent.test.ts:6105-6129`; `packages/coding-agent/src/modes/acp/acp-agent.ts:1185-1204`.

   **What:** The P×M test holds `goal_updated` delivery during entry, whereas plan row 13 explicitly requires holding the mode notification after Goal entry and before `session.prompt`.  
   **Why:** The recorded RED and generation-guard discrimination establish the held-event interleaving, but do not establish that a mode change during the later awaited notification is rejected at the final confirmation gate.

   **Fix:** Add the specified gated post-entry notification scenario, including pre-actor RED and a run with only the mode-generation confirmation guard reverted.

   **single instance:** The targeted repository search for P×M and prompt-admission tests found this one changed P×M scenario; its hold is `holdGoalEmit`, not the notification hold required by row 13.

## Should-fix

None identified beyond the blocking ownership and verification issues above.

## Nit

None.

## Checked

- **Round-7 class first:** The new tests and recorded RED/discrimination cover mode changes while the client response or reviewed snapshot adoption is pending. The class is **not closed at every site**: the earlier resolution/review awaits, distinct-transcript changes, and stale rollback above remain.
- **Duplication:** No actionable instance found in the supplied delta.
- **Naming:** Compared *stamp*, *admission*, and *transcript* across actor/runtime/host callers; no actionable inconsistency found.
- **Uneven API surface:** No actionable instance found; host entry and pause stamps serve different operations.
- **Mixed conventions:** No actionable instance found.
- **Missing or premature abstractions:** The snapshot creation/reference installation split is needed for correctness and is included in Must-fix 2; no separate simplification found.
- **Dead code:** No actionable instance found in the inspected new actor, runtime, and host symbols.
- **Doc drift:** No actionable user-facing documentation or localization drift identified in this delta.
- **Surprise scope and plan walks:** The inventory is Goal/ACP ownership, its shared runtime and session seams, tests, and evidence; no implementation of the listed out-of-scope ACP modes or `/goal drop` was identified. The plan has no per-slice “Files modified” lists or i18n keys to reconcile. Row 13’s required verification seam remains missing as noted above.
- **Verification checklist:** Reviewed the RED/discrimination records and QA matrix. The matrix records earlier-head suite and manual evidence; the plan explicitly accepts the stated IDE limitations. No checks were run in this review, and I did not establish a complete final-head execution record for every checklist command.
- **Seams:** Traced prompt admission, Stop/abort stamps, explicit modes and plan approval, runtime mutation gate, host entry/pause and ordered tool effects, stale config, session changes, RPC/TUI optional-gate behavior, and the two test fakes. The plan-proposal defects are reported above.
- **Simplification pass:** No separate non-blocking cross-slice candidate found.
- **Input limitation:** The supplied patch itself contains an embedded `more changes truncated` marker for part of `acp-agent.ts`; relevant source was read directly, but that marker prevents claiming an end-to-end review of every original diff hunk.

FAIL