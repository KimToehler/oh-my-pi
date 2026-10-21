Bottom line: The shared durable-controller/ACP-adapter split is sound, but one blocking ownership defect remains. An in-process reattach can preserve an active Goal while clearing ACP’s transient selection; the active state masks that inconsistency until Stop pauses the Goal, at which point ACP falls to Default and the next prompt does not resume it.

## 1. Does the change hold up architecturally?

Mostly, but not across the preserved-active reattach seam:

- `GoalHostController.endSessionChange()` intentionally reconciles in-process session changes with `preserveActiveGoal: true` (`packages/coding-agent/src/goals/host-controller.ts:194-216`).
- `GoalRuntime.onThreadResumed()` consequently leaves the Goal enabled and emits that active state (`packages/coding-agent/src/goals/runtime.ts:267-273`).
- `AcpGoalController.observe()` correctly interprets an enabled Goal as selected (`packages/coding-agent/src/modes/acp/acp-goal.ts:149-158`).
- Immediately afterward, the reconcile completion callback unconditionally resets `#selected` to false (`packages/coding-agent/src/modes/acp/acp-goal.ts:27-36`).

`modeSelected` hides the inconsistency while the durable state remains enabled (`acp-goal.ts:42-45`). Stop then changes the durable state to disabled/paused (`goals/runtime.ts:244-263`), exposing the false transient selection: ACP reports Default, and `prepareHostPrompt()` will not resume the paused Goal because it requires `#selected` (`acp-goal.ts:111-125`).

## 2. What does the auditor’s line-level view structurally miss?

### Blocking issue — high severity

- **class:** Preserved-active reattach loses ACP pause/resume ownership.
- **Violated contract:** Stop during any visible ACP Goal continuation must leave mode `goal` selected and make the next ordinary prompt resume the stored objective (`.omo/plans/ACP_GOAL_MODE_PLAN.md:165-166`; `packages/coding-agent/CHANGELOG.md:12`).
- **sites:**
  - `packages/coding-agent/src/goals/host-controller.ts:194-216` — in-process switches preserve an active Goal.
  - `packages/coding-agent/src/goals/runtime.ts:267-273` — preserved state remains enabled and emits `goal_updated`.
  - `packages/coding-agent/src/modes/acp/acp-goal.ts:27-36` — reconcile completion unconditionally clears selection after that event.
  - `packages/coding-agent/src/modes/acp/acp-goal.ts:42-45,149-158` — durable enabled state temporarily masks the cleared selection.
  - `packages/coding-agent/src/goals/runtime.ts:244-263` — Stop removes that mask by changing active to paused.
  - `packages/coding-agent/src/modes/acp/acp-goal.ts:111-125` — the next prompt resumes a paused Goal only when selection survived.
  - `packages/coding-agent/src/modes/acp/acp-agent.ts:1819-1827,2302-2316,2500-2501` — the paused transition is synchronized as Default and records the former Goal value as stale.
- **Search run:** Whole-tree search for `modeSelected`, `preserveActiveGoal`, `#selected = false`, and `event.state?.enabled`, plus LSP references for `AcpGoalController.modeSelected` and `observe`. The only ACP ownership implementation is this adapter; the shared-controller test at `test/goals/goal-host-controller.test.ts:511-519` verifies preservation but cannot assert ACP selection, while ACP’s deferred-reattach tests at `test/acp-agent.test.ts:5595` and `:5668` end on a no-Goal transcript and do not exercise Stop after a final active reattach.
- **Fix direction:** After each winning reconcile, clear `#objectivePending` but derive `#selected` from the final durable state—true for an enabled active Goal, false for no Goal or a paused startup reattach. Do not remove the reconcile-completion callback or the pending-reconcile ordering fixes.

## 3. Which production failure would hurt most, and is it addressed?

An active Goal can branch, navigate, or switch through the wrapped extension actions (`packages/coding-agent/src/modes/acp/acp-agent.ts:3347-3411`). The shared controller preserves the active Goal and may continue it inside the open ACP prompt, so the client still visibly appears to be in Goal mode.

If the user then presses Stop, the latent false `#selected` value becomes observable: mode changes to Default, the old Goal selection is recorded stale, and the next message runs ordinarily instead of resuming the paused objective. This is not covered by the supplied manual QA, the host-only preservation test, or the final-no-Goal deferred-reconcile tests, and it is outside the plan’s accepted residual risks.

## 4. Is any auditor finding a false positive on unchanged behaviour?

No. The auditor’s conclusion that deferred reconciles and later explicit selections are ordered correctly is valid for the state immediately after reconciliation; it does not cover the subsequent active-to-paused transition that unmasks this defect. Its security delta is also real: ACP objective text is newly persisted as Goal state, although no new external recipient was identified.

## Action plan

1. Change `AcpGoalController`’s reconcile callback to clear the objective arm while retaining effective selection when the final reconciled Goal is enabled.
2. Add an ACP regression that reattaches or branches to a final active Goal, stops its continuation, and verifies mode remains Goal and the next prompt resumes the same Goal ID.
3. Keep negative coverage proving startup active Goals reopen paused/Default and final paused or no-Goal transcripts remain unselected.
4. Re-run both merge-gate reviewer lanes against the corrected code head.

**Effort:** Short (1–4h)

**Confidence:** high

**Watch out for:**
- Do not mark a startup-paused Goal selected; derive selection only from the final enabled/exiting state.
- Preserve the non-awaited overlap branch and `settled()` ordering that fixed rounds 4 and 5.
- Assert the post-Stop prompt behavior, not merely the mode immediately after reattach—the enabled state masks the defect until pause.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: An in-process reattach that leaves the final transcript with an enabled active Goal must retain effective ACP Goal selection across a later host Stop.
  positive_witness: An active Goal is preserved through a branch or session reattach; Stop pauses it while mode remains Goal, and the next ordinary prompt resumes the same Goal ID.
  negative_control: Reconcile completion clears the transient selection, so Stop exposes Default mode and the next ordinary prompt does not resume the paused Goal.
  observable: Final transcript and Goal IDs, Goal enabled/status transitions, ACP current-mode and config updates, and the next prompt's resume behavior.
  boundary: GoalHostController preserved-active reconciliation through AcpGoalController selection ownership into ACP Stop and prompt preparation.
END-REVIEW-TRAILER