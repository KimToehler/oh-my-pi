# F3 integration review, delta round 2 (auditor, onara/cx/gpt-5.6-terra), verdict FAIL

Round-1 classes: `removed public RPC wire type` closed; `missing ACP Goal ingress regression coverage` closed (ACP-level tab case omission accepted); `repeated ACP no-goal fake surface` dropped (not warranted).

## Must-fix
1. class: explicit-mode lifecycle sync race. Sites: `packages/coding-agent/src/modes/acp/acp-agent.ts`, in `setSessionMode` and in the mode branch of `setSessionConfigOption`. In both, `#applyModeChange` leaves the goal, the pause emits `goal_updated`, and the lifetime `#syncAgentModeChange` treats the transition as an agent-side change. It records `goal` as stale and sends an intermediate update, so a later deliberate IntelliJ `goal` selection is ignored. Fix: an explicit-mode-change guard that suppresses the lifetime mode sync while the transition runs, plus post-bootstrap IntelliJ tests for Goal→Default and Goal→Plan.

## Should-fix
None.

## Nit
None.

FAIL
