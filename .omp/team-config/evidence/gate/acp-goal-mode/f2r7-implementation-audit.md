## 1. Goal and behavioural contract

The primary ACP Goal path is implemented, but Goal preparation is not ordered against an extension-initiated transcript change. A pending create or resume can therefore commit state from the old transcript after the new transcript has been adopted.

## 2. Correctness, regressions, architecture, wire contracts

### Blocker — high: Goal preparation can cross a transcript change

- **Class:** Stale Goal-entry commit after a concurrent transcript change.
- **Evidence:** `packages/coding-agent/src/modes/acp/acp-goal.ts:117-135,185-198`; `packages/coding-agent/src/goals/host-controller.ts:170-180,314-324,398-423`; `packages/coding-agent/src/modes/acp/acp-agent.ts:3335-3411`.
- **Failure mode:** `prepareHostPrompt()` serializes create/resume with other ACP Goal operations, but `beginSessionChange()` does not join that operation chain or wait for an in-flight entry. `GoalHostController.#enter()` retains the state returned by create/resume across an awaited tool swap and subsequently writes it back. Meanwhile, an extension can branch or switch transcripts through `#goalSessionChange`; reconciliation clears the old Goal and adopts the target transcript. A late entry can then restore the old state or submit its prompt while reconciliation is still replacing it. The target transcript may consequently run with a Goal belonging to the previous transcript, or receive the objective turn without its intended Goal.
- **Violated contract:** Goal state and the objective turn must belong to the transcript in which the Goal was created or resumed; reattachment must adopt the target transcript’s Goal rather than resurrect an earlier one.
- **Sites:** Both create and resume converge on `GoalHostController.#enter()`. All five ACP extension transition wrappers—new session, branch, tree navigation, switch and reload—converge on `#goalSessionChange()` and `AcpGoalController.beginSessionChange()`. Search run: `beginSessionChange\(|endSessionChange\(|createForHostPrompt\(|resumeForHostPrompt\(` across `packages/coding-agent/src`; the ACP wrappers and shared entry path were then traced. RPC also uses the shared controller’s session-change methods, but its existing command lifecycle is not an ACP transient-selection site; this blocker concerns the newly added ACP host-prompt preparation path.
- **Fix direction:** Give Goal entry and transcript changes a common ordering or transcript-generation ownership check, including cancellation compensation and prompt admission. Preserve the non-awaited overlapping-reconcile path that prevents extension-notification deadlock. Add gated ACP regressions for both create and resume overlapping a real extension-initiated transcript change, asserting the final transcript, Goal ID, tool set and prompt destination.

The round-4/5/6 fixes address their reported cases: deferred reconcile invokes mode synchronization, operations wait for already-pending reconciles, and preserved active Goals regain selection. They do not order an **already-running Goal entry** against a later transcript change. The F3-closed classes were not re-derived.

RPC request translation and the default exclusion of `"rpc"` from continuation modes remain intact in the reviewed diff.

## 3. Security and privacy delta

**Yes.** ACP objective text is newly persisted in Goal state. It was already submitted as user-turn content; I identified no new external recipient or separate security blocker.

## 4. Verification adequacy

The supplied matrix records IntelliJ evidence on an earlier code head and stdio plus suite evidence on the reviewed code head. The plan expressly accepts the missing final-head IntelliJ run and the untraced IDE continuation-Stop attestation; those risks do not block this audit.

The gated tests cover preparation versus Stop and explicit mode changes, and reconciliation versus later selection, but not preparation overlapping an extension transcript change. No tests or commands were run during this read-only review.

## 5. Final verdict

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A Goal entry begun in one transcript must not install its captured Goal state into a different transcript after a concurrent session change.
  positive_witness: A gated Goal entry and a transcript switch resolve with the target transcript retaining only its own journaled Goal state and tool configuration.
  negative_control: Releasing the old entry after the target transcript is adopted restores the old Goal or submits its objective into the target transcript.
  observable: Transcript IDs, persisted and in-memory Goal IDs, active tools, and the destination of the user prompt.
  boundary: ACP Goal preparation through extension-initiated session change and GoalHostController reconciliation.
END-REVIEW-TRAILER