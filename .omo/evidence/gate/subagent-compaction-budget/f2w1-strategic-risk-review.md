## Bottom line

The change is directionally sound: compaction accounting belongs in `createSubagentRunMonitor`, and reusing the request-budget stop sequence avoids a second termination mechanism. It does not yet hold up at the delivery boundary because `evaluateCompactionBudget` treats only `yieldCalled` as delivered while unstructured completion is recognized later in `driveSessionToResult`; the auditor’s blocker is valid and merge-blocking.

## 1. Architectural fit

The main architecture fits existing system boundaries:

- `packages/coding-agent/src/task/settings.ts` owns the new setting and default.
- `isCompletedCompaction` translates session-maintenance events into the budget’s counting contract.
- `createSubagentRunMonitor` owns counting, steering, stopping, and grace-state arbitration.
- `driveSessionToResult` reuses the established forced-report sequence.
- IRC wake and follow-up monitors explicitly disable the new budget rather than accidentally inheriting it.
- `BudgetStopKind` preserves budget-specific prompts and abort reasons while sharing termination machinery.

The architectural defect is split ownership of “delivered.” The monitor uses `yieldCalled`, while `driveSessionToResult` separately recognizes an unstructured terminal report through `lastReportTurnText()` and `stopReason === "stop"`. Consequently, the downstream fix protects the forced-prompt path but cannot prevent an earlier compaction-budget notice from entering the session queue.

## 2. What the line-level audit structurally misses

The auditor found the concrete late-steering path, but its broader cause is that delivery is not represented as one monotonic lifecycle state consumed by every budget action. Adding another local exception would leave steering, stopping, and result-driving with different definitions of completion.

A second, non-blocking structural concern is that `isCompletedCompaction` depends on an implicit cross-module event protocol: absent `skipped` and `errorMessage` fields mean success. The supplied fixtures and mutations cover current emitter shapes, but a future compaction action could silently become countable merely by omitting those optional fields. This does not block because no such incompatible emitter is present in the reviewed change.

## 3. Highest-impact production failure

The original highest-cost failure is a subagent circling for hours while consuming requests, tokens, and money. The changed monitor addresses that for in-flight work: it notices at the configured count, stops one completed compaction later, forces a final report, and hard-aborts after the grace window.

The highest-impact remaining regression is disturbing an already delivered result. It is less costly than an unbounded multi-hour loop but more directly violates correctness: an ordinary post-turn maintenance compaction can queue another model request and replace the result the caller should have received.

Blocker B1: High — An unstructured agent completes a report turn, notices are enabled, and post-turn maintenance raises the completed-compaction count exactly to `task.softCompactionBudget`. Because `yieldCalled` remains false and this is the notice threshold rather than the stop threshold, `evaluateCompactionBudget` schedules a steer; the queued message can start another continuation, spend another request, and replace or disturb the delivered report. The damage is operationally reversible through session-history recovery or rerunning the task, but the immediate caller can receive the wrong report, so it breaks the delivery contract.
class: post-delivery compaction steering
sites: fork `packages/coding-agent/src/task/executor.ts:1875-1883,2193,2308-2311`; upstream `packages/coding-agent/src/task/executor.ts:1864-1873` and the corresponding identical `auto_compaction_end` path; unchanged continuation consumer `packages/coding-agent/src/session/agent-session.ts:5178-5186` as identified by the supplied implementation audit
single instance: the supplied patches contain one compaction-budget evaluator and one event-handler callsite, duplicated identically across the two reviewed branches; the assignment prohibited command-based whole-tree searching, so no independent repository search was run

## 4. Auditor false-positive assessment

No. The continuation scheduler is unchanged, but the change newly makes it reachable after delivery by enqueuing a compaction-budget steer. Causally, this is changed behavior rather than a pre-existing defect.

The existing post-stop safeguard in `driveSessionToResult` does not invalidate the finding: it applies after `budgetStopRequested()`, whereas the reported trigger reaches exactly the notice threshold and therefore does not request a stop.

### Non-blocking notes

- The real-surface shake run did not reproduce a reclaimed shake. This does not independently block because reclaimed-shake behavior is covered by the typed event fixture and discriminating mutation evidence, but it leaves runtime confidence dependent on the documented emitter contract.
- Stopping a genuinely productive run after more than three compactions is explicitly accepted in the plan and configurable or disabled, so it is not a blocker.
- No credential, authentication, authorization, PII, or protected-asset access changes are present.

## Action plan

1. Define one monotonic delivered predicate/state covering terminal structured `yield` and an unstructured terminal report.
2. Make both `evaluateCompactionBudget` and `driveSessionToResult` consume that same state instead of maintaining separate completion rules.
3. Recheck delivery immediately before the asynchronous compaction notice is enqueued; otherwise delivery can occur after evaluation but before `sendUserMessage`.
4. Keep that suppression compaction-specific unless request-budget equivalence is independently proven, preserving the existing request-budget contract.
5. Add a regression where the first threshold compaction occurs after an unstructured report; flush the steering microtask and assert one prompt, no steer, and the original output.
6. Re-exercise the notice, stop, budget-zero, request-budget regression, and post-delivery real-surface scenarios after the fix.

**Effort:** Short (1–4h)

**Confidence:** high

**Watch out for:**

- Do not classify a `toolUse` or aborted assistant message as delivered; mid-turn crossings must still stop.
- Checking only before scheduling the microtask leaves a stale-send race.
- A shared guard in `steerBudgetNotice` could unintentionally change existing request-budget behavior.

FAIL

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: An asynchronously scheduled compaction-budget steer is invalidated when the run reaches an unstructured terminal-report boundary before that steer is enqueued or consumed.
  positive_witness: An unstructured report ends with stop reason stop, post-turn maintenance reaches the notice threshold, no steering message or continuation is created, and the original report remains the result.
  negative_control: The threshold handler leaves a steer queued after the report and AgentSession starts another prompt or replaces the returned report; this MUST fail.
  observable: Steered-message count, prompt or continuation count, and the final run output after the steering microtask settles.
  boundary: The task monitor's auto_compaction_end handling and asynchronous steering queue at the AgentSession continuation scheduler.
END-REVIEW-TRAILER