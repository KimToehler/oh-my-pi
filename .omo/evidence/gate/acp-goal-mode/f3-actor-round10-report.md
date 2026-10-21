## Must-fix

1. **High — Superseded proposals can fail before the ownership check.** `packages/coding-agent/src/session/agent-session.ts:1765-1779`; `packages/coding-agent/src/plan-mode/approved-plan.ts:196-216`  
   [INFERENCE] If Plan changes to Goal or Default while `resolveApprovedPlan` awaits a file scan or read, and resolution subsequently finds no plan or rejects, the error escapes before either the ACP handler or `#applyPlanReview` evaluates `owns()`. The agent receives a stale file-resolution error instead of the superseded result required by row 25; the same ordering applies if `reviewProposedPlan` rejects after ownership changes.  
   **Fix:** Check ownership after each asynchronous stage and handle stage errors by returning a structured superseded result when ownership was lost; preserve the original error when ownership remains valid. Add gated real-dispatch tests for rejected resolution and review after a mode change.  
   **class:** superseded asynchronous stage rejects before ownership evaluation. **sites:** `AgentSession.submitPlanProposal` resolution and review awaits; search: `grep pattern="resolveApprovedPlan\\(|reviewProposedPlan\\(|planProposalSupersededResult\\(" path="/Users/tim/git/oh-my-pi/.worktrees/acp-goal-mode" case=true gitignore=true`.

2. **High — The superseded result has the shape of an approval request.** `packages/coding-agent/src/plan-mode/approved-plan.ts:20-30,229-234`; `packages/coding-agent/src/modes/controllers/event-controller.ts:2225-2249`  
   The discarded proposal returns `PlanApprovalDetails`, which `isPlanApprovalDetails` identifies as the payload that opens an approval UI, rather than a distinguishable superseded outcome. A consumer using that shared contract can treat a discarded proposal as ready for approval; the row-25 tests at `test/acp-agent.test.ts:1402-1424` only require a defined result and therefore cannot detect the wrong result shape.  
   **Fix:** Return a distinct structured superseded outcome that cannot pass `isPlanApprovalDetails`, and assert that outcome in the direct-transition and review tests while retaining their state and journal assertions.  
   **class:** discarded proposal represented as an actionable approval payload. **sites:** `planProposalSupersededResult`, used by the three ACP ownership exits and the review ownership exit; search: `grep pattern="isPlanApprovalDetails|planExists|planReviewResult|planProposalSupersededResult" path="/Users/tim/git/oh-my-pi/.worktrees/acp-goal-mode/packages/coding-agent/src" case=true gitignore=true`.

## Should-fix

None found.

## Nit

None found.

## Checked

- **Round 9 classes:** The ACP handler now checks ownership before reading Plan state, and the direct Goal/Default tests discriminate the former ordering according to `actor-discrimination.txt`. The seven prose assertions were removed; the replacement tests check state and effects, but do not distinguish the returned superseded result, as noted above.
- **Duplication across slices/files:** No instance found.
- **Naming consistency:** Checked *ownership/stamp*, *admission*, and *reconcile* across actor, runtime, host controller, and callers; no inconsistent instance found.
- **Uneven API surface:** The superseded-result/approval-details mismatch is reported above.
- **Mixed conventions:** No instance found.
- **Missing or premature abstractions:** No instance found.
- **Dead code:** Searched the new actor, ownership-gate, and proposal symbols and their consumers; no unused production symbol found.
- **Doc drift:** No instance found in this delta. The new superseded prompt is model-facing; no new locale keys were present in the changed-file list.
- **Surprise scope and plan walks:** The changed files cover the actor, shared Goal fencing, plan-proposal ownership, tests, and evidence described by rows 10–25. No implementation of the named out-of-scope ACP modes or `/goal drop` was found in the supplied diff. The plan has no per-slice “Files modified” lists or new i18n keys to reconcile. Its verification evidence includes RED/discrimination records and the earlier suite and IntelliJ/stdio evidence; the recorded broad suite is for `fc293833cb`, not the reviewed head, and the plan explicitly accepts the older manual-QA evidence. No checks were run in this read-only review.
- **Seams:** Reviewed prompt admission, Stop/abort ownership, mode transitions and reporting, session changes, runtime mutation gate, host tool ordering, tool-origin drop, RPC/TUI gate defaults, persisted stale config, test fakes, and plan-proposal ownership/result consumers. The proposal-result and asynchronous-stage gaps are reported above.
- **Simplification pass:** No additional cross-slice simplification candidate found.

FAIL