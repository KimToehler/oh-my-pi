FAIL

## Must-fix

1. **High — deferred lifecycle mode sync is lost during explicit mode transition.**  
   **Evidence:** `packages/coding-agent/src/modes/acp/acp-agent.ts:862-872,876-915` increments `explicitModeChanges`; `#syncAgentModeChange()` returns permanently at `:2029-2034` while counter is nonzero.  
   **What:** A concurrent Goal completion/drop can emit both `goal_updated` and terminal `agent_end` while explicit transition suppresses both syncs, with no dirty flag or post-transition replay.  
   **Why:** Selecting Default while a continuation is still running pauses it but does not abort it. That continuation can call `goal complete` after pause. If completion lands between `#applyModeChange()` and `#emitModeUpdates()`, exiting Goal state can be reported as `goal`; terminal state then becomes default while both lifecycle syncs are discarded. Client remains on stale Goal mode and stale-client recording is skipped.  
   **Fix:** Track deferred mode sync whenever `#syncAgentModeChange()` is suppressed. After outermost explicit transition decrements counter, flush exactly one sync/reconcile pass. Add gated regression: Goal→Default while continuation completes during `#emitModeUpdates`; assert final mode/config are `default`, stale `goal` is recorded, and later deliberate Goal selection remains accepted.  
   **class:** dropped concurrent lifecycle sync  
   **sites:** `acp-agent.ts:862-872` (`setSessionMode`), `:876-915` (`setSessionConfigOption`), `:2029-2040` (`#syncAgentModeChange`). Whole-tree search run: `functions.grep(pattern="explicitModeChanges|#syncAgentModeChange", path="/Users/tim/git/oh-my-pi/.worktrees/acp-goal-mode")`.

2. **High — default/plan exit leaves reattached paused Goal tool enabled.**  
   **Evidence:** `packages/coding-agent/src/modes/acp/acp-goal.ts:48-54`; `packages/coding-agent/src/modes/acp/acp-agent.ts:2234-2249`.  
   **What:** `AcpGoalController.leave()` returns when `wasSelected` is false. Reconciliation deliberately clears transient selection, so persisted paused Goals satisfy `state` exists but `modeSelected === false`; explicit Default or Plan then skips `GoalHostController.pause()` and its tool restoration.  
   **Why:** Reattached paused sessions retain `goal` tool for resume. Selecting Plan after reopen therefore enters Plan with Goal tool still active, violating exclusive Goal/Plan transition and plan requirement that Default/Plan restore pre-goal tools for paused Goals.  
   **Fix:** Do not gate restoration on transient selection. For any resumable `active`, `budget-limited`, or `paused` state, call shared pause/exit path; still exclude terminal `exiting`/dropped states. Add resumed-paused Goal→Default and Goal→Plan tests asserting persisted `goal_paused` plus restored pre-goal tools.  
   **class:** unselected paused Goal exit bypass  
   **single instance:** ACP adapter owns transient selection and has sole Goal leave implementation. Whole-tree search run: `functions.grep(pattern="async leave\\(|\\.goal\\.leave\\(|state\\.goal\\.status === \"paused\"", path="/Users/tim/git/oh-my-pi/.worktrees/acp-goal-mode/packages/coding-agent/src;/Users/tim/git/oh-my-pi/.worktrees/acp-goal-mode/packages/coding-agent/test")`.

## Should-fix

None.

## Nit

None.

## Checked

- **Round-1 public RPC wire type:** closed. `RpcGoalCommand` exists at `src/modes/rpc/rpc-goal.ts:9-13`; `toGoalHostCommand()` preserves `objective` and `token_budget` at `:18-20`; RPC consumer maps only at `rpc-mode.ts:2101`.
- **Round-1 ACP Goal ingress coverage:** closed. Diff includes armed objective, images, image-only rejection, command preservation, continuation, Stop/resume, Plan transition, stale IntelliJ replay, and persisted reattach coverage.
- **Round-2 explicit-mode lifecycle race:** not closed. Guard prevents intermediate stale recording but drops concurrent real lifecycle changes; Must-fix 1.
- **1. Duplication across slices/files:** no instance found. Parser is centralized; shared Goal lifecycle exists once in `GoalHostController`.
- **2. Naming inconsistency:** no instance found. `GoalHostController`, `AcpGoalController`, `GoalContinuationMode`, and `continuationPending` retain concept names across producer and consumers.
- **3. Uneven API surface:** no instance found. Host controller exposes lifecycle API; ACP adapter intentionally exposes ACP selection API.
- **4. Mixed conventions:** no instance found. Extension/custom/file parsing all use `parsePromptSlashCommand`; RPC maps snake_case only at boundary.
- **5. Missing/premature abstractions:** no instance found. `toGoalHostCommand` has one consumer but is required wire-boundary conversion; `#goalSessionChange` serves five extension operations.
- **6. Dead code:** no instance found. Searches found consumers for `GoalHostController`, `AcpGoalController`, `parsePromptSlashCommand`, `isRegisteredPromptCommand`, and `toGoalHostCommand`.
- **7. Doc drift:** no instance found. Changelog describes ACP Goal/default ACP continuation. `docs/rpc.md:536-570` remains accurate: RPC continuation remains opt-in via `"rpc"`. No i18n keys or locale files added.
- **Surprise scope:** no unexpected changed path. All 17 changed paths are planned implementation, compatibility-test, fake-surface, or changelog files.
- **Out-of-scope walk:** no separate Out of Scope heading in supplied plan. Its stated exclusions—Vibe, guided-goal, Loop, and Tan ACP exposure—are untouched.
- **Verification checklist:** focused tests, shared RPC regressions, ACP/check command, and IntelliJ manual QA cannot be confirmed from supplied diff. No command or QA artifact was provided; no execution claimed.
- **Seam A:** parser grammar matches extension/custom/file dispatch and predicate live sources. Unknown slash text remains ordinary prompt.
- **Seam B:** extraction preserves RPC wire fields/result aliases and RPC opt-in continuation. No removed public wire type found.
- **Seam C:** selection/arm behavior traced; paused reattach exit defect found in Must-fix 2.
- **Seam D:** Goal observer ordering, quiescence gate, cancel-before-abort, session-change wrappers, and observer disposal present. Explicit lifecycle synchronization defect found in Must-fix 1.
- **Simplification pass:** no additional cross-slice simplification candidate found.

FAIL