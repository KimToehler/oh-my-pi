## Bottom line

The change holds up architecturally: ACP-specific ownership is centralized in `AcpGoalActor`, durable mutations are fenced in `GoalRuntime`, and RPC/TUI retain the ungated behavior through the shared `GoalHostController`. The implementation auditor’s sole blocker is a false positive because it treats an outbound ACP notification write as though it awaited client-side notification handling; the production transport does not have that re-entrant callback relationship. No strategic blocker remains.

## Action plan

1. **Architecture — holds.**  
   `packages/coding-agent/src/modes/acp/acp-goal.ts:AcpGoalActor` owns ACP mode generations, transcript ownership, prompt admissions, Stops, stale client configuration, and session changes. `packages/coding-agent/src/goals/runtime.ts:GoalRuntime.#commit/#commitState` provides the central commit-time fence, while the gate remains optional for RPC and TUI. The RPC adapter preserves its snake-case boundary through `packages/coding-agent/src/modes/rpc/rpc-goal.ts:toGoalHostCommand`.

2. **What the line-level audit structurally misses.**  
   It conflates awaiting transport enqueue with awaiting remote processing. `packages/utils/src/acp/connection.ts:AgentSideConnection.sessionUpdate` delegates to `RpcConnection.notify`; `packages/utils/src/acp/transport.ts:RpcConnection.notify/#write` waits only for the serialized local writable-stream write. `RpcConnection.#dispatch` processes inbound requests independently, and `packages/utils/src/acp/stream.ts:ndJsonStream` writes encoded NDJSON bytes without invoking the peer’s request handler.

3. **Highest-consequence production failure.**  
   The worst failure is stale work from transcript A mutating transcript B—pausing or dropping B’s goal, restoring A’s tools, installing stale Plan state, or corrupting B’s journal. That is substantially addressed by `AcpGoalActor` generation stamps, the `GoalRuntime` commit fence, request-time abort ownership in `AgentSession.abort`, ordered tool restoration in `GoalHostController`, and proposal ownership carried through `AgentSession.submitPlanProposal`.

4. **Remaining boundary of that protection.**  
   Protection is complete for transitions that change the session-manager ID. Same-session branch/tree navigation and post-Plan-exit autosave/model effects remain the plan’s explicitly accepted residual risks (4) and (5), so they do not block this gate.

5. **Auditor finding disposition.**  
   The reported class `reconciliation-notification reentrancy deadlock` is not reachable through the production ACP transport. A slow or backpressured output stream can delay reconciliation, as it can delay any awaited ACP write, but notification completion does not depend on a mode request or client callback and therefore cannot form the asserted circular wait. No product-code change is recommended for that finding; the implementation-audit lane must still be re-recorded or otherwise adjudicated before the aggregate F2 record can pass.

**Blockers:** none.

**Effort:** Quick (<1h)

**Confidence:** high — the decisive transport chain was traced from `AcpAgent` through `AgentSideConnection.sessionUpdate`, `RpcConnection.notify/#write`, and the NDJSON stream implementation.

**Watch out for:**
- Same-session branch/tree navigation remains outside transcript-generation fencing, as accepted residual risk (4).
- Autosave and execution-model effects after Plan exit remain unfenced, as accepted residual risk (5).
- The latest code was exercised through stdio rather than final-head IntelliJ GUI, as accepted residual risk (3).

PASS

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: yes
verdict: PASS
adversarial_criteria:
- invariant: Completion of an outbound ACP session notification depends only on the local stream write or connection closure, never on the peer processing that notification or completing another request.
  positive_witness: A session/update write and a concurrently arriving mode request are dispatched independently, and both settle without either waiting for the other's handler.
  negative_control: The notification promise remains pending until the client processes it and completes a mode request whose server effect is waiting for the same notification-bearing reconciliation.
  observable: Promise-settlement order for the outbound write and inbound dispatch, together with bounded completion of both operations.
  boundary: AgentSideConnection.sessionUpdate through RpcConnection.notify/#write and the independent RpcConnection.#dispatch path.
END-REVIEW-TRAILER