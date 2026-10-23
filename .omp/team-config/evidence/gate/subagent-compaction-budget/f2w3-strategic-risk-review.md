**Bottom line:** The change holds up architecturally: it extends the existing request-budget state machine rather than creating a parallel termination mechanism, and the final diff closes the important post-delivery and grace-anchor regressions. I found no blocker and no security or privacy delta.

1. **Does the change hold up architecturally against the rest of the system?**  
   Yes. `packages/coding-agent/src/task/executor.ts` keeps policy in the existing `createSubagentRunMonitor`, isolates event classification in `isCompletedCompaction`, and reuses the established abort/final-report path through `requestBudgetStop`, `waitForBudgetStop`, and `driveSessionToResult`. `BudgetStopKind` preserves the reason across that shared path, while `attachIrcWakeTurnMonitor` and `runSubagentFollowUpTurn` explicitly disable the new budget, matching the plan’s scope. Configuration, prompts, documentation, and tests are wired through the existing settings and rendering mechanisms rather than introducing a provider-specific or second lifecycle subsystem.

2. **What does the auditor’s line-level view structurally miss?**  
   The main structural concern is arbitration when both budgets cross in one run. `requestBudgetStop(kind)` correctly makes the first accepted stop immutable through `budgetStopKind !== undefined`, and it selects the grace origin according to that first kind; nevertheless, the supplied evidence does not directly exercise a request-budget stop followed by a compaction crossing during its grace period. A second structural dependency is event ordering: post-delivery safety relies on assistant `message_end` establishing `unstructuredReportDelivered` before a later `auto_compaction_end`, with `steerBudgetNotice` rechecking delivery at its microtask boundary. The focused tests cover those orderings, but this coupling should remain explicit whenever session-maintenance sequencing changes.

3. **Which production failure would hurt most, and is it addressed?**  
   The worst failure is a post-delivery compaction starting another turn and replacing an already-valid unstructured report: it silently discards hours of useful work while making the run appear normally completed. The final implementation addresses this at both race points through `reportDelivered()` in `evaluateCompactionBudget` and the `stillWanted` recheck inside `steerBudgetNotice`. The `ObedientScout`, `FinishedScout`, and `PromptScout` cases in `packages/coding-agent/test/task/executor-soft-budget.test.ts`, together with the final shake QA, cover stop-after-delivery, notice-after-delivery, and queued-notice races.

4. **Is any auditor finding a false positive on unchanged behaviour?**  
   No. The implementation audit reported no current blocker. Its reclaimed-shake caveat is an evidence limitation, not a claim that unchanged behaviour is defective. The earlier cross-budget finding was also not a false positive: the attempted delivered-report exception had affected the shared request-budget ladder, and the frozen plan records that it was removed so request-budget behaviour remains unchanged apart from selecting the appropriate reminder wording.

**Non-blocking notes**

- **Note N1:** No supplied test crosses both budgets in one grace window. This does not block because `requestBudgetStop` visibly latches the first kind and anchor, and no contrary runtime outcome is evidenced.
- **Note N2:** Reclaimed shake counting was not reproduced on the real surface. This does not block because the predicate is action-independent, the fixture matches the documented emitter shape, and mutation evidence discriminates the counting rule.
- **Note N3:** Two new tests assert the prose fragment `Compaction budget crossed` in `packages/coding-agent/test/task/executor-soft-budget.test.ts`. That is a brittle prompt-text assertion, but it does not affect runtime behaviour or violate a merge-gate invariant, so it is a maintainability note rather than a blocker.

**Action plan**

1. Accept the implementation without another fix wave and store this trailer verbatim.
2. If the monitor is changed again, add a dual-budget collision regression proving that a later budget event cannot relabel, re-anchor, or duplicate the first stop.

**Effort:** Quick (<1h) — no implementation fix identified.

**Confidence:** Medium. Both complete patches and the frozen plan support the conclusion, but this review was intentionally constrained to those inputs, and reclaimed shake was not observed on the real surface.

**Watch out for:**
- Future changes that remove first-writer semantics from `requestBudgetStop`.
- Session-maintenance changes that reorder `message_end` and post-turn compaction.
- The accepted policy risk that a legitimate run requiring more than three compactions is stopped unless its budget is raised or disabled.

PASS

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: Once either budget has initiated a stop, later request or compaction events cannot change its kind, grace origin, or schedule a second final-report turn.
  positive_witness: A request-budget stop is accepted first and a completed compaction subsequently crosses its budget during grace; the run receives one request-budget final-report turn and retains the original request-threshold grace deadline.
  negative_control: The later compaction overwrites the stop kind or grace anchor, changes the abort reason or deadline, or causes a second forced final-report prompt.
  observable: Session-abort count, synthetic prompt count and selected branch, request count at hard abort, and final abort reason.
  boundary: The createSubagentRunMonitor requestBudgetStop state transition and its handoff to driveSessionToResult.
END-REVIEW-TRAILER