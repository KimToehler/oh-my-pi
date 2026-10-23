**Bottom line:** The shared host-controller/ACP-adapter split is sound, but one high-severity concurrency gap remains: a deferred Goal reattach can finish after a later ACP extension session change without reconciling ACP’s transient selection or emitting the final mode. This can leave IntelliJ pinned to Goal for the wrong transcript and let its replay arm an unintended objective, so the merge gate is blocked.

## 1. Does the change hold up architecturally?

Mostly, but not completely. `GoalHostController` centralizes durable lifecycle and continuation behavior, while `AcpGoalController` owns ACP-only selection and objective arming (`packages/coding-agent/src/goals/host-controller.ts:67`, `packages/coding-agent/src/modes/acp/acp-goal.ts:10`); that is the correct boundary.

The boundary fails when `GoalHostController.endSessionChange()` deliberately queues an overlapping reconcile without awaiting it to avoid an extension-notification deadlock (`host-controller.ts:197-205`). ACP clears transient selection before calling that method (`acp-goal.ts:159-168`) and synchronizes mode immediately after it returns (`acp-agent.ts:3396-3404`). Consequently, the asynchronous reconcile can become the last state mutation without a corresponding ACP selection reconciliation or mode synchronization.

## 2. What does the auditor’s line-level view structurally miss?

### Blocking issue — high severity

- **class:** Deferred Goal reattach escapes ACP selection and mode synchronization
- **violated contract:** After a session switch, ACP mode must reflect the final transcript; a stored Goal must not be selected or resumed until the user explicitly selects Goal.
- **sites:**
  - `packages/coding-agent/src/goals/host-controller.ts:197-205` — overlapping reconciliation is intentionally fire-and-forget.
  - `packages/coding-agent/src/goals/host-controller.ts:379-397` — reconciliation clears Goal state directly and returns without emitting `goal_updated` when the final transcript has no Goal.
  - `packages/coding-agent/src/modes/acp/acp-goal.ts:124-139` — transient selection is updated only by Goal events or terminal `agent_end`.
  - `packages/coding-agent/src/modes/acp/acp-goal.ts:159-168` — selection is cleared before the host’s potentially deferred reconciliation finishes.
  - `packages/coding-agent/src/modes/acp/acp-agent.ts:3396-3404` — the only wrapper-level mode synchronization occurs immediately after `endSessionChange()`, potentially before the queued reconcile.
  - `packages/coding-agent/test/goals/goal-host-controller.test.ts:403-470` — tests prove overlapping/deferred reconciliation but assert only shared-controller state and tools, not ACP selection or notifications.
- **whole-tree search:** LSP references for `beginSessionChange` and `reconcile`, plus an ACP-wide search for `newSession`, `switchSession`, `branch`, `navigateTree`, and `reload`, found the extension action sites at `acp-agent.ts:3331-3374` and the wrapper above; no later ACP synchronization hook exists for deferred reconciliation.
- **failure sequence:** Reattach A begins for an intermediate transcript and is still running; session change B moves to the final transcript and queues its reconcile behind A. Both ACP wrappers can synchronize before B’s queued reconcile clears the intermediate state. If the final transcript has no Goal, that clear emits no lifecycle event, leaving the client’s reported Goal mode stale.
- **fix direction:** Add an explicit reconcile-completion hook carrying final transcript/generation ownership. ACP should clear transient selection/arming and invoke `#syncAgentModeChange` after every winning reconcile, including the non-awaited overlap branch. Do not simply await inside the branch whose non-awaiting behavior prevents extension-notification deadlock.

## 3. Which production failure would hurt most, and is it addressed?

The worst case is switching to a transcript without an active Goal while IntelliJ remains pinned to the intermediate transcript’s Goal mode. Because the final no-Goal reconciliation emits no event, IntelliJ can replay `goal`; without the missing Default transition and stale-value recording, that replay becomes a real selection and the next ordinary message becomes an unintended autonomous objective.

The current manual QA covers ordinary selection, continuation, Stop/resume, completion, and stale replay after normal completion, but not overlapping extension-driven session changes. The shared-controller tests cover reconcile ordering without exercising ACP’s selection and wire notifications, so this failure is not addressed.

## 4. Is any auditor finding a false positive?

No. The auditor’s prompt-preparation and explicit-mode findings are consistent with the reviewed code. Its security delta is also real: the ACP prompt text is now additionally persisted as Goal state through `GoalRuntime.createGoal`, even though the same text is also recorded as a user turn; no new external recipient is introduced.

## Action plan

1. Introduce a non-blocking completion callback for every actual `GoalHostController` reconcile, including the deferred overlap path.
2. Have `AcpGoalController` use transcript/generation ownership to clear `selected` and `objectivePending` only for the winning switched transcript.
3. Trigger `AcpAgent.#syncAgentModeChange` after that final reconciliation, including the no-Goal early-return path.
4. Add an ACP regression where reattach A stalls on an active Goal, change B selects a final no-Goal transcript, and then assert Default mode/config, stale `goal` replay rejection, and an ordinary next prompt.
5. Re-run both gate reviewers against the corrected code head.

**Effort:** Short (1–4h)  
**Confidence:** high

**Watch out for:**
- Awaiting the deferred reconcile from the extension notification can recreate the deadlock that `host-controller.ts:197-205` avoids.
- Same-session/no-op navigation must preserve a deliberately armed Goal selection.
- The final no-Goal path needs explicit synchronization because it emits no `goal_updated` event.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A deferred reattach that finishes after a later ACP session change cannot retain or publish ownership of ACP's Goal selection arm.
  positive_witness: An intermediate active-Goal reattach is delayed while a second change selects a final transcript with no Goal; after reconciliation drains, mode and config are Default, a pinned Goal replay is ignored, and the next ordinary prompt remains ordinary.
  negative_control: The final notification or config remains Goal, or the replayed Goal value causes the next prompt to create or resume an objective inherited from the intermediate reattach.
  observable: Final transcript id, Goal state, current_mode_update sequence, mode config currentValue, stale-config behavior, and the next prompt's objective and dispatch record.
  boundary: GoalHostController deferred reconciliation through AcpGoalController transient selection into AcpAgent mode synchronization.
END-REVIEW-TRAILER