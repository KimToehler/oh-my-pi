**Bottom line:** The shared-runtime/host-controller/ACP-actor split is architecturally sound, and the most dangerous ownership failures are fenced centrally. One blocking liveness hole remains: a terminal `agent_end` suppressed while an explicit mode effect is in flight is never replayed, so an active Goal can stop autonomously and the ACP prompt can close prematurely.

## Action plan

1. **Architecture:** Mostly holds up. `GoalRuntime.#commit` centralizes transcript-owned writes; `AcpGoalActor` supplies ACP generations without changing RPC/TUI semantics; `GoalHostController.#ordered` serializes tool-set changes; and `rpc-goal.ts:toGoalHostCommand` keeps wire translation at the RPC boundary. The separation is consistent with the rest of the system.

2. **Blocking defect:**  
   **class:** `lost ACP Goal continuation after transient mode-effect gate`  
   **sites:**  
   - `packages/coding-agent/src/modes/acp/acp-goal.ts:AcpGoalActor` — `canAutoContinue` rejects while `#modeEffects > 0`, while `explicitModeChange()` merely decrements `#modeEffects` afterward.
   - `packages/coding-agent/src/goals/host-controller.ts:GoalHostController.observe/#scheduleContinuation` — a terminal `agent_end` calls `#scheduleContinuation`; when `#continuationWanted()` is false, no pending/deferred state is retained and no mode-effect completion later retries it.
   
   Whole-tree searches run: `#modeEffects|canAutoContinue` under `packages/coding-agent/src`, and `#scheduleContinuation\(` in `host-controller.ts`. ACP is the only host adding this transient mode-effect gate, and no mode-effect release site reconsiders a suppressed continuation.

   Exact failure: a Goal re-selection or another explicit mode request waits in `#host.settled()` while the active turn reaches terminal `agent_end`; `#modeEffects` suppresses scheduling, `continuationPending` remains false, and ACP quiescence may resolve the prompt. When the mode effect finishes, the Goal is still active and selected, but autonomous continuation does not resume until another host prompt.

   Fix with a deferred-continuation bit set synchronously when terminal `agent_end` is blocked by `#modeEffects`; include that bit in `continuationPending`, then re-evaluate through `GoalHostController` when the outermost mode effect settles. The re-evaluation must still check prompt ownership, cancellation, transcript generation, active Goal state, and final mode.

3. **What the line-level audit structurally misses:** It primarily checks stale writes after awaits. This defect is the dual state-machine failure: a transient guard correctly rejects work, but no edge preserves and replays the event that should become valid later. Green commit-fence tests do not establish wake-up completeness across the actor, host continuation scheduler, and ACP quiescence boundary.

4. **Most harmful production failure:** A stale abort, tool mutation, or mode effect writing Goal state/tools into a newly adopted transcript would be worst because it could trigger autonomous work in the wrong conversation. That is substantially addressed by `GoalRuntime.#commit`, `AcpGoalActor.#gateOwns`, request-time abort stamps in `AgentSession.abort`, and `GoalHostController.#ordered`; same-session branch navigation remains the explicitly accepted residual risk.

5. **Auditor false positives:** The supplied implementation audit raised no blocker to dismiss. The earlier reconciliation-notification deadlock concern referenced by QA row 6 was a false positive on unchanged transport behavior: `RpcConnection.notify` awaits only its serialized local `#write`, while inbound peer handlers run independently through `#dispatch`; it does not await the peer’s notification handler.

**Effort:** Short (1–4h) for the deferred state, host reconsideration hook, and a gated regression test.

**Confidence:** high.

**Watch out for:**
- Do not schedule merely because a mode effect ended; replay only a terminal event actually suppressed by that gate.
- Keep the ACP prompt non-quiescent while the deferred event exists.
- Retry only after the outermost concurrent mode effect settles; the host’s live gates must decide whether Goal, Default, or Plan ultimately won.

FAIL

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A terminal agent_end suppressed only by an in-flight explicit mode effect must remain pending and be reconsidered when the outermost effect settles while the same prompt, transcript and active Goal still own it.
  positive_witness: An active Goal turn ends while a Goal re-selection is held in host settlement; after release, exactly one continuation is admitted before the ACP prompt resolves.
  negative_control: The mode effect ends with the Goal active and selected, but the prompt resolves with no continuation admitted.
  observable: The ordering of terminal agent_end, mode-effect release, continuation admission and session/prompt settlement.
  boundary: AcpGoalActor mode-effect ownership, GoalHostController continuation scheduling and ACP prompt quiescence.
END-REVIEW-TRAILER