## 1. Goal and behavioural contract

Blocker B1: **High — late steering after delivery**, `packages/coding-agent/src/task/executor.ts:1875-1883, 2193, 2308-2311` (fork). Trigger: an unstructured agent ends a report turn and its post-turn maintenance reaches the compaction budget exactly, with notices enabled. The monitor records the report text but `evaluateCompactionBudget` checks only `yieldCalled`, not whether an unstructured report was delivered, so it queues a new budget steer. This violates the contract that later compactions neither steer nor force another prompt after delivery. The queue can also cause a continuation: `agent-session.ts:5178-5186` schedules one when compaction finds queued messages. The damage is reversible, but can spend another model request and disturb the delivered-result flow. **Fix direction:** suppress compaction-budget actions at the monitor’s delivery boundary for a genuinely completed unstructured report, while preserving stops for in-flight work; add a regression for the *threshold* compaction after the report, not only the existing budget-plus-one case. **class:** post-delivery compaction steering. **sites:** searched the upstream task tree for `evaluateCompactionBudget|auto_compaction_end|lastReportTurnText\(\)`; the sole compaction-budget steering decision is `executor.ts:1864-1873` upstream, corresponding to the fork lines above. This site remains open on both branches.

## 2. Correctness, regressions, architecture, wire contracts

The shared stop records the first budget kind and its request count; the grace calculation preserves the request-budget hard-abort point for integer request counts. The counting predicate matches the reviewed event shapes, including reclaimed shakes. The wake and follow-up monitor construction sites disable the new budget.

The delivered-report test covers a post-report compaction **above** the threshold, but not the distinct threshold-notice case in B1.

## 3. Security and privacy delta

No changed credential, authentication or authorization path, third-party personal data, or demonstrated weakening of access to a protected asset was found.

## 4. Verification adequacy

Reviewed the supplied patches, pinned plan, monitor and driver paths, event schema and emitters, relevant tests, F3 report, and selected QA and mutation artifacts. The real-surface stop and notice artifacts support their respective paths; the shake artifact reports zero reclaimed shake results, so that case remains supported by the emitter-shaped mock test rather than real-surface evidence.

No checks were run in this read-only audit. The reported type-check and suite results are from the supplied `row4-verification.txt` artifact.

## 5. Final verdict

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: A completed unstructured report must not leave a newly generated budget steer queued to affect a later session turn.
  positive_witness: A report is followed by threshold maintenance and no budget steer is queued or delivered on a later wake.
  negative_control: Threshold maintenance queues a budget steer after the report and a later continuation or wake consumes it.
  observable: The queued-message state and subsequent session events distinguish the two outcomes.
  boundary: Subagent monitor and session steering queue.
END-REVIEW-TRAILER