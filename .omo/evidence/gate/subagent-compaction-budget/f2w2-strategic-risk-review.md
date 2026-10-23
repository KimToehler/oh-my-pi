**Bottom line:** The core architecture is sound—centralized event classification, one monitor-owned stop state, and reuse of the existing forced-report ladder are the right design. It is not gate-ready because the shared implementation changes two request-budget guarantees: the auditor’s delayed hard-abort defect is real, and the generic `reportDelivered()` guard also changes request-only behavior despite the explicit isolation requirement.

Blocker B1: **class:** request-budget grace deadline shifted by delayed budget evaluation. **Trigger:** an ordinary request-budgeted run crosses its stop threshold while a pending nonterminal or rejected `yield` defers evaluation, then continues making requests. **Preconditions:** request budget enabled and the existing deferred-check path active. **Impact:** `budgetStopAtRequests = progress.requests` anchors grace to the delayed stop rather than the configured threshold; for budget 2, a stop evaluated at request 5 hard-aborts at 10 instead of 8, violating the unchanged request-budget criterion and allowing additional billed work. **Reversibility:** the termination behavior is recoverable by rerunning, but already billed model spend is not. **sites:** whole-tree search for `budgetStopAtRequests|requestBudgetStop\(` found the production implementation only in fork `packages/coding-agent/src/task/executor.ts:1557,1871,1878` and upstream `packages/coding-agent/src/task/executor.ts:1546,1860,1867`; the corresponding compaction calls are fork `:1898` and upstream `:1887`. Preserve a threshold-derived anchor for request stops and an observed-count anchor for compaction stops.

Blocker B2: **class:** cross-budget semantic expansion changes existing request-budget behavior. **Trigger:** an unstructured request-only run ends with a report on the request that reaches the 1.5× stop threshold—for example, budget 2 with two tool turns followed by the report at request 3. **Preconditions:** request budget enabled; no compaction event is required. **Impact:** the generic ladder check now breaks on `monitor.reportDelivered()` rather than only an accepted `yield`, suppressing the request budget’s previously forced synthetic wrap-up and changing which report is returned. This directly contradicts the supplied contract that request-budget behavior must not change; it blocks even if the new behavior is considered preferable. **Reversibility:** no persistent protected asset is affected, but the per-run output selection can only be reproduced by rerunning. **sites:** whole-tree search for `reportDelivered\(|LastWordScout|report turn itself crosses` found the cross-budget production site at fork `packages/coding-agent/src/task/executor.ts:2685` and upstream `:2661`, explicitly codified by `packages/coding-agent/test/task/executor-soft-budget.test.ts:305` on both branches. The compaction-specific guards at fork `executor.ts:1896,1903` and upstream `:1885,1892` are in scope; the shared ladder guard is the over-broad instance.

### 1. Architectural fit

The change otherwise fits the system well:

- `isCompletedCompaction` centralizes the event contract instead of coupling behavior to individual compaction actions.
- `budgetStopKind` lets both guards share abort, lifecycle, prompt, and result handling without creating a second stop subsystem.
- `reportDelivered()` is correctly used by the compaction evaluator, the queued steering-message recheck, and the forced-report ladder to avoid replacing an already delivered result.
- The setting is normalized through the existing budget convention, while IRC wake and follow-up monitors explicitly disable the new guard.
- The default-on policy can stop a productive run after four compactions, but the plan explicitly accepts that reversible trade-off and retains resume/configuration escape hatches.

The architectural weakness is that shared machinery currently shares policy as well as mechanism: request and compaction stops need different grace anchors, and only compaction stops may consume the new unstructured-delivery exception.

### 2. What the line-level audit structurally misses

The audit identifies the wrong grace anchor, but the deeper issue is **budget-domain isolation**. `budgetStopKind` identifies the originating guard, yet downstream policy mostly treats both kinds identically; this allowed the new delivery behavior to leak into request-only traces at `driveSessionToResult`.

The new request-budget test makes that leakage explicit rather than incidental. The minimal architecture should remain one stop pipeline, with source-specific policy at its two decision points—not split into separate drivers.

### 3. Highest-impact production failure

The most damaging feature-specific failure would be replacing or discarding a report delivered after hours of useful work. That is addressed for compaction stops by the monitor-owned delivery predicate, its microtask recheck, the ladder guard, focused tests, and the real-surface post-report compaction QA.

The fix is currently broader than necessary, however, producing B2. B1 is lower-consequence per occurrence but still material because it weakens an existing cost-control deadline and can incur irreversible provider spend.

### 4. Auditor false-positive assessment

No. The auditor’s B1 is not unchanged behavior: the old request path derived hard-abort timing from `softRequestBudget * 1.5`, while the new shared path records the actual, potentially delayed `progress.requests`. Passing existing request-budget tests does not cover the supplied deferred-evaluation state.

**Non-blocking notes:**

- The real-surface shake run did not reproduce a reclaimed shake. This does not independently block because the action-independent predicate and focused fixture/mutation rows exercise the documented reclaimed-shake shape, but the QA artifact should not be described as a real-surface reclaimed-shake witness.
- No authentication, credential, personal-data, or protected-asset access boundary changes are present.

### Action plan

1. Make the grace base source-specific: request stops use `Math.ceil(softRequestBudget * 1.5)`; compaction stops use `progress.requests`.
2. Add a deferred request-budget regression proving budget 2 still hard-aborts at request 8 when stop evaluation is delayed until request 5.
3. Restrict the unstructured `reportDelivered()` ladder escape to `budgetStopKind() === "compactions"` while retaining the existing `yieldCalled()` behavior for request stops.
4. Invert the new request-only `LastWordScout` test to prove the unchanged baseline forced-wrap-up behavior.
5. Apply the identical source and test changes to both branches, then repeat the affected verification and gate wave.

**Effort:** Short (1–4h)

**Confidence:** high—the two behavioral changes are explicit in the reviewed diff and their production sites are unique in whole-tree searches of both worktrees.

**Watch out for:**
- Use `Math.ceil` for the request threshold so odd budgets preserve the former integer request deadline.
- Do not remove the compaction-specific post-delivery suppression while restoring request behavior.
- Both branch heads and their evidence become stale after the fixes.

FAIL

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: FAIL
blockers: B1,B2
adversarial_criteria:
- invariant: A newly added compaction guard must leave every request-only event trace on the request guard's prior transition schedule and result-selection path.
  positive_witness: With no compaction events, a request-only run produces the same steering count, forced-wrap-up prompt, hard-abort request index, and selected report as the baseline implementation.
  negative_control: A request-only report at the stop threshold skips its former forced wrap-up, or a deferred stop moves the hard-abort request beyond the baseline deadline.
  observable: Prompt count and kind, returned report, abort callback request index, and abort reason for identical request-only traces.
  boundary: The createSubagentRunMonitor budget state machine and driveSessionToResult forced-report ladder.
END-REVIEW-TRAILER