## 1. Goal and behavioural contract

The implementation covers the principal Goal-mode flow, and the supplied stdio QA artifacts demonstrate objective creation, continuation, Stop/resume, command routing, and stale IntelliJ replay on the final code head. One mode/tool interleaving below violates the requirement that an explicit exit leave the Goal paused and Plan and Goal mutually exclusive.

## 2. Correctness, regressions, architecture, wire contracts

**Blocker — High: a Goal tool entry can commit while an explicit exit is restoring tools.**

- **class:** Goal-tool entry crossing an in-flight explicit mode transition; remaining interleaving of the F3 M×T class.
- **sites:** `packages/coding-agent/src/modes/acp/acp-goal.ts:208-209, 275-276, 414-445, 603`; `packages/coding-agent/src/goals/host-controller.ts:349-353, 437-441`; `packages/coding-agent/src/goals/runtime.ts:560-576, 610-627`; Goal-tool entry callers at `packages/coding-agent/src/goals/tools/goal-tool.ts:91-98`.
- **Search:** searched production source for `admitEntry|resumeGoal\(|createGoal\(`, then traced the actor’s tool ownership check, explicit-mode effect, and host pause/restore. Both tool entry operations use the same affected gate; host-origin entries and TUI calls are separate paths.
- **Failure mode:** Select Plan or Default while a Goal is active, and hold the pre-goal tool restoration after `pauseGoal()` has committed. A concurrent tool `resume` can now execute: the tool stamp does not compare mode generation, and `admitEntry` sees no *installed* Plan yet. It reactivates and journals the Goal and the observer selects it again. Releasing restoration lets the explicit transition finish without another pause: Plan can be installed alongside an active Goal, or Default can resolve while Goal is active and reported. The analogous `create` path has the same admission gap when no conflicting Goal exists.
- **Violated contract:** explicit exit must preserve the Goal paused with pre-goal tools restored; Plan and Goal must remain exclusive.
- **Fix direction:** include pending explicit mode ownership in tool-entry admission/commit ordering, rather than checking only the currently installed Plan state. Add gated tests for both entry operations during the pause/tool-restore window, covering Plan and Default and asserting final mode, persisted Goal state, and tools. Keep the optional gate inert for RPC/TUI.

The existing M×T test at `test/acp-agent.test.ts:6373-6383` invokes resume **after** Plan selection has finished; it does not exercise this window. The listed class is therefore **not closed at both tool-entry sites**.

The RPC adapter retains the supplied `op`, `objective`, `token_budget` input mapping and `{ goal, state }` result shape; I found no separate wire-schema blocker in the reviewed changes.

## 3. Security and privacy delta

**Yes:** ACP Goal selection now persists prompt text as Goal objective metadata and enables autonomous Goal continuation through the existing agent/tool surface. This increases the contexts in which that user-provided text is retained and processed; I found no separate security or privacy blocker in the changed lines.

## 4. Verification adequacy

The supplied final-head suite artifact reports 722 passing tests and a successful TypeScript check. The manual stdio artifacts cover the named user flows, and the transport probe supports the claimed non-blocking notification behavior. The discrimination artifact records targeted guard reversions; its row-25 restoration caveat is disclosed in the brief.

Those results do not cover the in-flight mode/tool window above. I did not run tests or modify files. The final-head IntelliJ GUI coverage and the frozen same-session branch and post-approval effects remain the explicitly accepted residual risks in the plan.

## 5. Final verdict

The implementation audit is blocked by the Goal-tool/mode-transition race in section 2.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: An agent tool invocation concurrent with a client mode transition cannot reactivate a Goal after that transition has paused it but before its tool restoration completes.
  positive_witness: With restoration held, a concurrent Goal resume is refused or ordered before the pause; after selecting Plan, Plan is enabled, the Goal is paused, and the pre-Goal tools are restored.
  negative_control: A resume commits during the held restoration and the completed Plan transition leaves the Goal active or selected.
  observable: Goal journal and status, final ACP mode, Plan state, and enabled tool names after both operations settle.
  boundary: ACP mode request and Goal tool execution against the shared Goal runtime.
END-REVIEW-TRAILER