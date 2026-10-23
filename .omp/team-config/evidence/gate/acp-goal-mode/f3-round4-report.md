PASS — F3 delta round 4 local review. Model: `onara/cx/gpt-5.6-terra`.

## Must-fix

None.

## Should-fix

None.

## Nit

None.

## Checked

- **Prior class 1 — removed public RPC wire type:** closed. `RpcGoalCommand` remains public with unchanged `op`, `objective`, and `token_budget` fields; boundary conversion is isolated in `packages/coding-agent/src/modes/rpc/rpc-goal.ts:7-19`; RPC dispatch uses it at `rpc-mode.ts:2100-2103`.
- **Prior class 2 — missing ACP Goal ingress coverage:** closed. ACP tests cover arming/no-turn, ordinary and unknown-slash objectives, image forwarding, image-only validation, registered command preservation, Stop/resume, Goal→Default/Plan, completion/stale replay, and persisted Goal reattach. Parser-routing test covers extension, file, MCP, unknown, tab, and newline grammar at `test/agent-session-prompt-dispatch-race.test.ts:316-343`.
- **Prior class 3 — explicit-mode lifecycle sync race:** closed. Both explicit entrypoints bracket transitions with `explicitModeChanges` and `#endExplicitModeChange` at `acp-agent.ts:865-875,884-918`; suppressed lifecycle sync marks `modeSyncDeferred` and outermost exit replays it at `:2028-2054`. Regression coverage exercises completion during a Goal re-selection notification.
- **Prior class 4 — dropped concurrent lifecycle sync:** closed at every prior site. `setSessionMode`, mode-valued `setSessionConfigOption`, and `#syncAgentModeChange` share deferred-flush behavior. Flush compares current mode against `reportedModeId`; explicit Default with unchanged final mode is no-op. Explicit Goal followed by agent completion records prior `goal` stale and returns config options built after deferred synchronization.
- **Prior class 5 — unselected paused Goal exit bypass:** closed. `AcpGoalController.leave()` no longer gates restoration on selection; paused, active, and budget-limited states reach host pause, while exiting state remains terminal-owned (`acp-goal.ts:44-58`). Reopened paused Goal→Plan and double Goal→Default regressions assert tool restoration and no journal churn.
- **1. Duplication across slices/files:** no instance found. Parser and host lifecycle each have one implementation; ACP adapter only supplies ACP transient state.
- **2. Naming inconsistency:** no instance found. `GoalHostController`, `AcpGoalController`, `GoalContinuationMode`, `continuationPending`, and host-prompt methods retain consistent concepts across producer and consumers.
- **3. Uneven API surface:** no instance found. RPC keeps wire-shaped `RpcGoalCommand`; host controller exposes normalized host command; ACP adapter intentionally exposes selection/arming behavior only.
- **4. Mixed conventions:** no instance found. Extension/custom/file routing all consume `parsePromptSlashCommand`; snake_case conversion occurs only at RPC boundary; continuation-mode checking is typed through `GoalContinuationMode`.
- **5. Missing or premature abstraction:** no instance found. `GoalHostController` centralizes lifecycle reused by RPC and ACP; `AcpGoalController` owns ACP-only transient selection; `toGoalHostCommand` is justified wire-boundary conversion.
- **6. Dead code:** no instance found. Whole-tree searches found production consumers for `parsePromptSlashCommand`, `isRegisteredPromptCommand`, `GoalHostController`, `AcpGoalController`, host-prompt methods, `GoalContinuationMode`, and `toGoalHostCommand`. `GOAL_CONTINUATION_MODES` supplies exported literal-derived type contract.
- **7. Doc drift:** no instance found. `CHANGELOG.md:12` describes ACP behavior and default ACP continuation. `docs/rpc.md:541-565` still correctly describes unchanged RPC wire fields and opt-in `"rpc"` continuation. No i18n keys, locales, or OpenAPI surface changed.
- **Surprise scope:** no unexpected changed path. All 17 paths fit planned parser, host controller, ACP adapter/integration, settings, RPC compatibility, tests/fakes, or changelog surface.
- **Out-of-scope walk:** no ACP exposure for Vibe, guided-goal, Loop, or Tan found.
- **Plan file/slice walk:** changed production symbols match planned anchors and seam list. Test moves and compatibility fake updates match plan.
- **Verification checklist:** source contains planned regression coverage, but focused suites, shared RPC/Goal suites, ACP regression/check command, and IntelliJ manual QA cannot be confirmed from supplied diff or artifacts. No execution claimed.
- **i18n walk:** no new i18n keys or locale changes.
- **Seam A:** parser grammar matches extension/custom/MCP/file dispatch; predicate uses live command sources and unknown slash input remains ordinary prompt.
- **Seam B:** RPC wire shape remains structural-compatible; `token_budget` maps once to `tokenBudget`; default continuation includes ACP while RPC remains opt-in.
- **Seam C:** adapter keeps transient selection/arming unpersisted, resumes paused Goal only after selection plus host prompt, restores tools on unselected paused exit, and gates continuation on open ACP prompt.
- **Seam D:** Goal observer subscribes before prompt listeners; quiescence includes pending continuation; cancel stops continuation before abort; session-change wrappers match `runtime-init.ts` classifications; disposal removes Goal observer.
- **Simplification pass:** no cross-slice simplification candidate found.

PASS