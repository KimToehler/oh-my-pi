Bottom line: The change holds up strategically. It replaces ACP’s duplicate authorization mechanism with the existing shared gate, preserves fail-closed behavior across wire and concurrency boundaries, and propagates deliberately narrowed authority into subagents without leaving the old bypass in place.

Action plan / answers:

1. **Architecture:** Yes. `ExtensionToolWrapper.execute` in `packages/coding-agent/src/extensibility/extensions/wrapper.ts` remains the policy authority, while `createAcpApprove` in `packages/coding-agent/src/modes/acp/acp-approval.ts` is a host adapter that validates the exact offered option set. `Settings.setHostDefault` plus `createAcpSessionFactory` models the ACP default below configured layers, and `createSubagentClientBridge` narrows rather than copies client capabilities. Removing the proxy, cache, and `acpApprovedArgs` bypass leaves one authorization convention.

2. **What the line-level view structurally misses:** The difficult residual surface is temporal ownership: simultaneous dialogs settling out of order, descendants surviving parent lifecycle changes, and permission responses racing steering or cancellation. The supplied change addresses the highest-risk instance through `AgentSession.watchApprovalSupersede`, request-local races in `createAcpApprove`, ref-counted steering snapshots, and the parallel-dialog regression in `packages/coding-agent/test/agent-session-acp-permission.test.ts`.

3. **Highest-impact production failure:** Executable work running after the user denied or superseded it would be the most damaging outcome. It is addressed by pre- and post-rewrite denial checks in `ExtensionToolWrapper.execute`, live inherited checks through `ExtensionRunner.approvalLedger`, propagation through `runSubprocess` and persisted revival, exact ACP option validation, distinct cancellation handling, and side-effect-negative QA for denial and steering.

4. **Auditor false positives:** None. The implementation audit reported no defect to reclassify. The earlier whole-diff documentation finding was separate, concerned changed behavior rather than unchanged behavior, and is resolved by the supplied `README.md` update.

Note N1: `ExtensionRunner.approvalLedger` resolves against the runner’s current session identity, so a descendant surviving a parent session switch deserves lifecycle coverage; this does not block because session-scoped decisions intentionally end on session change and the supplied contract does not require an old child to retain an ended session’s decisions.

Note N2: Two already-pending same-subject requests can settle independently after one records `reject_always`; this does not block because each still requires its own explicit response and the contract applies the denial to later calls, not dialogs already open.

Effort: Quick (<1h); no fix wave is warranted.

Confidence: high. The supplied diff, OpenSpec bundle, real-surface QA, negative controls, fix-wave evidence, and focused concurrency regressions cover the consequential authorization and lifecycle boundaries.

Watch out for:
- Long-lived descendants crossing a parent `/new` or session switch.
- Concurrent same-subject dialogs settling around a `reject_always` response.
- Future spawn mechanisms that bypass `runSubprocess` or persisted-revival bridge and ledger installation.

PASS

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: yes
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: The first terminal event for an ACP permission interaction—selection, turn abort, or user-steer supersede—irrevocably owns that call; any later event for the withdrawn interaction cannot execute or reclassify it.
  positive_witness: An allow response that settles first executes its call exactly once, while a user steer that settles first withdraws the dialog, reports the call as superseded, and produces no tool side effect even if the client later returns an allow response.
  negative_control: A late allow response executing a tool after its permission interaction was superseded or changing the superseded result into success MUST fail.
  observable: Ordered JSON-RPC request and cancellation frames, the final tool-call update, and an execution counter or filesystem side-effect record distinguish the winning terminal event.
  boundary: createAcpApprove’s request race and its handoff to ExtensionToolWrapper.execute.
END-REVIEW-TRAILER