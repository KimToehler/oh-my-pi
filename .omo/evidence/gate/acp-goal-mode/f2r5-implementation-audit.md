## 1. Goal and behavioural contract

The implementation covers the primary Goal-mode lifecycle, but an explicit Goal selection can be lost while a deferred session reattach is finishing. That violates the contract that selecting Goal arms the next ordinary prompt.

## 2. Correctness, regressions, architecture, wire contracts

### Blocker — high: explicit selection lost across deferred reattach

- **class:** Explicit ACP Goal selection overwritten by asynchronous reconciliation.
- **Evidence:** `packages/coding-agent/src/modes/acp/acp-goal.ts:27-36,70-75`; `packages/coding-agent/src/goals/host-controller.ts:203-216,383-395`; `packages/coding-agent/src/modes/acp/acp-agent.ts:895-903,913-942,2525-2529,3403-3411`.
- **Failure mode:** A session change can return while its reconcile is queued behind another reconcile. During that interval, either ACP mode-setting API can successfully select Goal and report it to the client: `select()` does not wait for the host’s pending reconciliation. When reconciliation later finishes, the new `onReconciled` hook unconditionally clears `#selected` and `#objectivePending` and synchronizes Default. The next ordinary prompt is consequently not made a Goal objective. With an intermediate Goal still in memory, `select()` may also decline to arm the objective before the final transcript is adopted.
- **Violated contract:** A successful explicit Goal selection must arm the session for its next ordinary prompt; asynchronous work from an earlier session change must not silently revoke that later selection.
- **Fix direction:** Order explicit selection against reconciliation, or use transcript/generation ownership so a reconcile cannot clear a selection made after the relevant change. Preserve the non-awaiting overlap branch that avoids extension-notification deadlock. Add a gated ACP regression that selects Goal after the second change returns but before the queued reconcile finishes, then verifies that the next ordinary prompt becomes the objective.
- **Sites:** Both `setSessionMode` and mode-valued `setSessionConfigOption` converge on `#applyModeChange` / `AcpGoalController.select`; all ACP extension session-change wrappers converge on `#goalSessionChange` and the host reconcile hook. Search run over `packages/coding-agent/src` for `\.reconcile\(|beginSessionChange\(|endSessionChange\(|\.goal\.select\(`, with both mode entrypoints traced in `acp-agent.ts`. RPC has no ACP transient selection or reconcile hook, so it is not another site of this class.

The round-4 deferred-reattach finding is closed for its **original** case: the hook now runs after the queued reconcile, and the ACP regression checks the final Default notification and stale replay. The unconditional hook introduces the later-explicit-selection race above, so the broader selection-ownership class is not fully closed. The round-1/round-2 cancellation and preparation paths remain guarded by `goalPreparation`, the serialized adapter operation chain, and cancellation compensation. The F3 closed classes were not re-derived.

The RPC boundary still maps `token_budget` to the host’s `tokenBudget` and retains the wire-shaped request/result types; RPC continuation remains opt-in.

## 3. Security and privacy delta

**Yes:** ACP objective text is additionally persisted as Goal state. The text was already a user-turn input; this change introduces no identified new external recipient. No separate blocking security finding was substantiated.

## 4. Verification adequacy

The supplied matrix records real IntelliJ scenarios on the earlier code head and stdio plus regression-suite evidence on code head `090131d4de`. The plan explicitly accepts the missing final-head IntelliJ capture and the untraced IDE continuation-Stop attestation as residual risks; they do not block this audit.

The existing deferred-reattach test covers final mode synchronization but not an explicit selection made while that reattach is pending. No checks were run during this read-only review.

## 5. Final verdict

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A client selection made after a session change returns cannot be erased by reconciliation work that was already pending when the selection was accepted.
  positive_witness: A deferred reattach is held, the client selects Goal, reconciliation finishes, and the next ordinary prompt becomes the new objective.
  negative_control: The delayed reconcile clears the accepted selection or arm, so the next ordinary prompt runs without creating the objective.
  observable: Mode selection response and notifications, final Goal state, and the next prompt's persisted objective and user turn.
  boundary: ACP mode-setting APIs through AcpGoalController selection and GoalHostController reconciliation.
END-REVIEW-TRAILER