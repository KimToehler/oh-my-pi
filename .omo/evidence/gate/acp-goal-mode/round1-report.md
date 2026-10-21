# F3 integration review, round 1 (auditor, onara/cx/gpt-5.6-terra), verdict FAIL

## Must-fix
1. class: removed public RPC wire type. Site: `packages/coding-agent/src/modes/rpc/rpc-goal.ts`, where `RpcGoalCommand` was dropped although the plan keeps `RpcGoalOp`/`RpcGoalCommand`/`RpcGoalResult` as RPC wire types. Fix: restore `RpcGoalCommand { op; objective?; token_budget? }`. Host conversion happens at the RPC boundary.
2. class: missing ACP Goal ingress regression coverage. Site: `packages/coding-agent/test/acp-agent.test.ts`, ACP Goal describe. Missing cases:
   - text plus image as the first objective, with images forwarded
   - image-only armed input rejected while the arm is kept
   - Goal-to-Plan transition, both active and paused, restoring tools and emitting mode/config updates
   - custom/MCP command preservation
   - literal-tab grammar

## Should-fix
1. class: repeated ACP no-goal fake surface. Sites: `test/acp-event-mapper.test.ts:101-106`, `test/acp-initialize-conformance.test.ts:121-126`, `test/acp-lazy-startup.test.ts:155-160`. Fix: a shared fixture or mixin.

## Nit
None.

FAIL
