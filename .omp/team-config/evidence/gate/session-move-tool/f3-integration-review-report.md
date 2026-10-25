INTEGRATION-REVIEW-REPORT-v1

# Wave 1 (base main 24d028086d, head 222fe79b92)

PASS — no Must-fix issue found in the supplied `main...HEAD` diff.

## Must-fix

None.

## Should-fix

1. `packages/coding-agent/src/tools/session-move.ts:197-225, 267-316` — two `session_move` calls in one assistant tool batch can both create their distinct worktrees before either records the pending move; only the later post-creation check rejects one of them.  
   **Why it matters:** tool calls default to shared concurrency (`packages/agent/src/agent-loop.ts:3848-3871`), so a model response containing two creation calls can leave an unused worktree and branch from the rejected call. This is local and reversible, and the selected move remains correct, so it does not meet the blocker threshold.  
   **Fix:** make `SessionMoveTool` `concurrency = "exclusive"` (the move is still deferred until the full batch ends), or reserve pending-move admission atomically before creation and clear the reservation on every creation failure. Add a same-batch/two-target regression test asserting that only one branch/worktree is created.  
   **class:** non-atomic pending-move admission.  
   **sites:** `packages/coding-agent/src/tools/session-move.ts:197-225,267-316` (check → asynchronous creation → re-check) and `packages/coding-agent/src/session/agent-session.ts:3251-3254` (unconditional reservation overwrite). Search run: `functions.grep pattern="requestSessionMove\\(|hasPendingSessionMove\\(" path="."`.

2. `packages/coding-agent/src/session/agent-session.ts:3310-3314` — the post-batch D6 re-check omits the `ToolSession`’s configured `agentRegistry`, so it always falls back to `AgentRegistry.global()`, whereas tool admission correctly checks `session.agentRegistry` at `packages/coding-agent/src/tools/session-move.ts:184-190`.  
   **Why it matters:** an opt-in embedding host using `createAgentSession({ agentRegistry, sessionRelocation: true })` can start one of its own-registry subagents in a sibling call after admission; the re-check misses it and relocates while it continues in the old checkout. The advertised TUI/ACP/RPC hosts use the global registry, so this does not block their shipped surface, but it violates the reusable `ToolSession`/`AgentSession` contract.  
   **Fix:** retain or inject the session’s registry into `AgentSession` and pass it to the post-prompt `findRunningSessionWork` call; add a custom-registry sibling-subagent test for the re-check, not only for admission.  
   **class:** inconsistent registry scope across two D6 checks.  
   **sites:** `packages/coding-agent/src/tools/session-move.ts:184-190` and `packages/coding-agent/src/session/agent-session.ts:3310-3314`; no other production `findRunningSessionWork` call exists. Search run: `functions.grep pattern="findRunningSessionWork\\(" path="packages/coding-agent"`.

## Nit

None.

## Checked

- **Whole diff:** read end-to-end from `/tmp/integration-review-session-move-tool.patch`, including generated Go, Python, and Rust RPC clients.
- **1. Duplication across slices/files:** no instance found. `addRepoWorktree` is the single shared CLI/tool implementation; `relocateHeadlessSession` is the single shared ACP/RPC/slash-command implementation; `findRunningSessionWork` is the shared D6 helper.
- **2. Naming consistency:** no instance found. The nouns `session move`, `relocator`, and `worktree.repoDir` are consistent across implementation, prompt, docs, settings, and tests.
- **3. Uneven API surface:** no instance found. Hosts normalize their public callbacks to `SessionRelocationResult`; the headless-only `fatal` extension remains internal to `HeadlessRelocationResult`.
- **4. Mixed conventions:** no instance found. TUI uses its existing BTW-wrapped relocation route; ACP/RPC use the extracted headless relocation route, matching their prior `/move` split.
- **5. Missing abstractions / abstraction gravity:** no additional instance found. The three relevant consumers share the intended helpers rather than copying checkout, relocation, or running-work logic.
- **6. Dead code:** no instance found. Public additions are wired: `stopAfterBatch` is consumed by the agent loop and deliberately removed from RPC host-tool results; `session_move` is registered and gated; `cwd` is emitted by RPC and represented in all generated SDKs. Search runs included `functions.grep pattern="addRepoWorktree\\(" path="."`, `functions.grep pattern="cfgWorktreeRepoDir|resolveRepoWorktreeDir" path="."`, and `functions.grep pattern="relocateForAgent|relocateHeadlessSession" path="packages/coding-agent/src;packages/coding-agent/test"`.
- **7. Doc drift:** no instance found. `docs/tools/session_move.md`, slash-command internals, RPC docs, both changelogs, prompt text, schema, generated TypeScript, Go, Python, and Rust bindings agree on the new behavior. No i18n keys or locale files were added.
- **Surprise-scope walk:** changed production files match the plan’s intended surfaces: agent-loop/type support; worktree helper/settings/tool; session lifecycle and relocators; TUI/ACP/RPC wiring; RPC wire/generated clients; docs/changelogs. Test fixtures and harness changes support those surfaces. No out-of-scope ACP cwd-change protocol was added; `/move` and `/wt` retain their routes via extraction; no subagent relocation or `task.cwd` was introduced.
- **Plan walk:** all listed requirements and negative controls have corresponding implementation/tests in the diff. The plan’s out-of-scope list is respected. No formal i18n work applies.
- **Verification checklist:** plan tasks 1–6 are marked complete, but this read-only review did not execute their commands. Final-verification tasks 7.1 (`bun check`), 7.2 (stored F3 report), and 7.3 (manual TUI/ACP QA evidence) remain unchecked in the pinned plan; no execution evidence was supplied to this review.
- **Seams:** checked all nine supplied seams. `stopAfterBatch` remains local rather than wire-visible; CLI and tool share worktree creation; settings validation and documentation agree; all headless users share relocation; lifecycle fencing/continuation and goal admission align; registration excludes advisor/subagent/no-session sessions; all three hosts install relocators; RPC `cwd` is optional and regenerated across every shipped SDK; documentation/changelog coverage is present.
- **Simplification pass:** no additional cross-slice simplification candidate beyond the shared helpers already introduced.


Wave 1 verdict: PASS

# Wave 2 (delta round after cleanup commit e01af842ff; head e01af842ff)

PASS — delta whole-diff review completed. The two prior Should-fix classes are closed at every listed production site.

## Must-fix

None.

## Should-fix

1. `packages/coding-agent/src/modes/rpc/rpc-mode.ts:1790-1795`; `packages/coding-agent/src/session/agent-session.ts:3336-3367` — the RPC relocator starts fatal-session teardown with `void disposeAndExit()` but returns an ordinary failed relocation immediately, allowing `AgentSession` to send and trigger a `session-move-result` continuation before disposal wins the race.  
   **Why it matters:** a fatal rollback explicitly means the session/process state cannot be safely realigned; starting another model turn in that state can emit misleading continuation events or attempt provider work just before the RPC process exits.  
   **Fix:** await `disposeAndExit()` in the fatal branch so the relocator never returns a normal failure after declaring the session unusable; add a fatal-relocation test asserting no move-result continuation or provider request is emitted.  
   **Non-blocking:** this requires the rare fatal rollback path—both relocation recovery and re-alignment must fail—rather than an ordinary move failure; the affected RPC process exits and no protected asset is reached.  
   **class:** detached fatal-session teardown.  
   **single instance:** searched all fatal-relocation consumers with `functions.grep pattern="\\.fatal|fatal: true" path="packages/coding-agent/src"`; ACP and slash-command callers await disposal, while only the RPC relocator detaches it.

## Nit

None.

## Checked

- **Previous report classes:** closed.
  - **non-atomic pending-move admission:** `SessionMoveTool.concurrency = "exclusive"` serializes two `session_move` calls with the batch scheduler before the second can create a worktree; the existing pending-move re-check remains in place. Confirmed against `packages/coding-agent/src/tools/session-move.ts:94-96,197-225` and the scheduler at `packages/agent/src/agent-loop.ts:3848-3868`.
  - **inconsistent registry scope across two D6 checks:** SDK passes the session-scoped `agentRegistry`, `AgentSession` retains it, and the post-batch re-check passes it to `findRunningSessionWork`, matching tool admission. Confirmed at `packages/coding-agent/src/sdk.ts:2450,4805-4806`, `session/agent-session.ts:1092,3313-3318`, and `tools/session-move.ts:186-191`.
- **1. Duplication across slices/files:** instance assessed: `realpathOfPlannedPath` exists as async `session/session-worktree.ts:190-205` and sync `tools/session-move.ts:56-70`. They are deliberately split because tool approval planning is synchronous while worktree creation is async; no safe simplification is warranted without changing that boundary.
- **2. Naming inconsistency:** no instance found. `session move`, `relocator`, and `worktree.repoDir` are consistent across types, implementation, prompts, docs, and generated RPC bindings.
- **3. Uneven API surface:** no instance found. Hosts normalize relocation to `SessionRelocationResult`; `HeadlessRelocationResult.fatal` remains an internal extension for callers that own process/session disposal.
- **4. Mixed conventions:** no instance found. TUI uses its existing BTW-gated relocation route; ACP and RPC use the extracted headless relocation route; all hosts install and clear a per-session relocator.
- **5. Missing abstractions / abstraction gravity:** no additional instance found. The shared worktree helper, shared running-work helper, and shared headless relocation replace repeated host/tool logic. The sync/async realpath pair above is the only near-duplicate and is boundary-driven.
- **6. Dead code:** no instance found. `stopAfterBatch` is consumed by the agent loop and removed at the RPC host-tool boundary; `session_move`, `addRepoWorktree`, `resolveRepoWorktreeDir`, relocators, and RPC `cwd` are all wired to production consumers. Searches run included:
  - `functions.grep pattern="addRepoWorktree\\(" path="."`
  - `functions.grep pattern="cfgWorktreeRepoDir|resolveRepoWorktreeDir" path="."`
  - `functions.grep pattern="requestSessionMove\\(|hasPendingSessionMove\\(|setSessionRelocator\\(" path="."`
  - `functions.grep pattern="relocateHeadlessSession\\(|rescopeHeadlessToCwd\\(" path="packages/coding-agent/src;packages/coding-agent/test"`
- **7. Doc drift:** no instance found. Tool documentation, slash-command internals, changelogs, RPC documentation, schema, TypeScript wire definitions, and generated Go/Python/Rust bindings describe the optional `cwd` field and session-move behavior consistently. No i18n keys or locale files were added.
- **Surprise-scope walk:** changed files remain within the planned surfaces: agent-loop result handling; shared worktree creation/settings/tool; session move lifecycle and host relocators; TUI/ACP/RPC registration; generated RPC clients; docs/changelogs; and focused tests. No ACP cwd-change protocol, subagent relocation, `task.cwd`, or unrelated subsystem was introduced.
- **Plan walk:** all OpenSpec requirements and listed negative controls have corresponding implementation and test coverage in the diff. The plan’s out-of-scope items remain out of scope. Tasks 1–6 and cleanup tasks 8.1–8.2 are checked; 7.1 (`bun check`) and 7.3 manual TUI/ACP QA remain unchecked in the pinned plan and were not executed by this read-only review. Task 7.2 is the current F3-report workflow.
- **Seams:** checked all nine supplied seams: batch-stop handling remains local and RPC host-tool-safe; CLI/tool share `addRepoWorktree`; setting validation and docs agree; headless relocation is shared by `/move`, `/wt`, ACP, and RPC; session fencing, continuation, goal admission, and both D6 checks align; SDK/tool registration excludes unsupported sessions; all three hosts install relocators; and `get_state.cwd` is optional across server schema and all shipped SDKs.
- **Simplification pass:** no additional cross-slice simplification candidate found beyond the intentionally split synchronous/asynchronous planned-path resolution helpers.

PASS
# Wave 3 (delta round after F1 fix wave 814fb0a9f3, da41b24851; head da41b24851)

FAIL — two direct tool-execution paths bypass invariants that `session_move` relies on.

## Must-fix

- **Blocker B1:** **severity: blocker** — `session_move` invoked through Cursor’s server-side MCP bridge records a pending move but never reaches `shouldStopAfterBatch`, so a queued steering/aside/follow-up message can trigger another provider request in the old directory.  
  **Evidence:** `packages/coding-agent/src/sdk.ts:3849-3868,4603-4604` resolves and advertises mounted XDev tools to Cursor; `packages/coding-agent/src/cursor.ts:445-470,1225-1252` executes the selected MCP tool directly; `packages/ai/src/providers/cursor.ts:5085-5089` stamps that call `kCursorExecResolved`; `packages/agent/src/agent-loop.ts:1611-1621` excludes it from runnable calls; and the hook is invoked only in the `executeToolCalls` branch at `:1680-1687`. With `batchStopped` consequently false, `:1818-1844` drains queued messages and continues the loop.  
  **Trigger / preconditions / impact / reversibility:** In an interactive Cursor-agent session with XDev enabled, the model calls `session_move` and ordinary user steering or a follow-up arrives before the response yields. The next model request runs before relocation and therefore still has the old cwd, directly violating the “no further model request in the old directory” requirement. The bad request can modify the wrong checkout; its effects may be irreversible.  
  **Fix:** Treat a settled Cursor-resolved tool batch as a post-batch boundary too: after the final provider message, invoke the session stop hook when resolved bridge calls were present, before queue drains. Add a Cursor-MCP regression that schedules a move, queues steering, and proves no second provider request precedes relocation.  
  **class:** resolved server-side session move misses the post-batch stop fence.  
  **single instance:** `functions.grep(pattern="kCursorExecResolved|shouldStopAfterBatch", path="packages/agent/src/agent-loop.ts;packages/ai/src/providers/cursor.ts;packages/coding-agent/src")` found the only arbitrary session-tool-capable resolved bridge at `CursorExecHandlers.mcp`; native Cursor frames target fixed tools, and eval runs under an outer `eval` batch.

- **Blocker B2:** **severity: blocker** — `SessionMoveTool.concurrency = "exclusive"` is enforced only by the agent-loop scheduler, while the eval bridge and Cursor MCP bridge invoke the tool directly; two parallel creating calls can both pass the initial pending-move check and create branches/worktrees before the later check rejects one.  
  **Evidence:** `packages/coding-agent/src/tools/session-move.ts:92-96` declares exclusivity, but `:190-220` checks pending before and only again after awaited worktree creation. `packages/coding-agent/src/eval/js/tool-bridge.ts:76-80,322-329` resolves any enabled tool and directly executes it; `packages/coding-agent/src/session/session-tools.ts:687-698` exposes every enabled tool to that bridge; `packages/coding-agent/src/eval/js/worker-core.ts:238-240` dispatches bridge requests without serialization. Cursor has the same direct execution path at `packages/coding-agent/src/cursor.ts:445-470,1225-1252`. `AgentSession.requestSessionMove` at `packages/coding-agent/src/session/agent-session.ts:3257-3261` does not itself reject an existing pending move.  
  **Trigger / preconditions / impact / reversibility:** A model can issue `Promise.all` of two distinct `session_move` creation calls through eval, or Cursor can interleave two MCP calls. Both create before either stores the pending request; the loser errors only after creating its otherwise-unused branch/worktree. This violates D1/task 8.1’s requirement that the second same-batch call fail *before* any creation. The local checkout debris is reversible, but it breaks the plan’s explicit value proof.  
  **Fix:** Move admission ownership into session state. Atomically reserve the pending move before the first await that can create a worktree, release the reservation on every failure, and convert it to the scheduled move only on success. Retain the loop-level exclusivity as an optimization. Add parallel eval-bridge and Cursor-MCP regressions asserting exactly one branch/worktree.  
  **class:** scheduler-bypassed exclusive move admission.  
  **sites:** `packages/coding-agent/src/eval/js/tool-bridge.ts:76-80,322-329` and `packages/coding-agent/src/cursor.ts:445-470,1225-1252`; searched with `functions.grep(pattern="getToolForEvalBridge|resolveMountedXdevExecutable|async mcp\\(", path="packages/coding-agent/src")` and `functions.grep(pattern="tool\\.execute\\(", path="packages/coding-agent/src/cursor.ts;packages/coding-agent/src/eval/js/tool-bridge.ts;packages/coding-agent/src/session/session-tools.ts;packages/coding-agent/src/tools/session-move.ts")`. Cursor `shellStream` is excluded because it hard-codes `bash`.

## Should-fix

None.

## Nit

None.

## Checked

- **Previous-wave classes:** the listed normal agent-loop same-batch admission path is closed by `SessionMoveTool.concurrency = "exclusive"`; both D6 checks use the session-scoped registry (`packages/coding-agent/src/session/agent-session.ts:2604-2605,3315-3321`); the RPC fatal branch now awaits teardown (`packages/coding-agent/src/modes/rpc/rpc-mode.ts:1792-1795`); explicit `base` is resolved to a SHA before worktree creation (`packages/coding-agent/src/tools/session-move.ts:269-278`). B1/B2 are newly exposed direct-bridge variants.
- **1. Duplication across slices/files:** no instance found.
- **2. Naming inconsistency:** no instance found; `session move`, `relocator`, and `worktree.repoDir` are consistent across implementation and docs.
- **3. Uneven API surface:** no instance found.
- **4. Mixed conventions:** no instance found apart from the direct-execution convention divergence underlying B1/B2.
- **5. Missing abstractions / premature abstraction:** no additional instance found beyond centralizing move admission required by B2.
- **6. Dead code:** no instance found; `session_move`, its prompt, relocation APIs, stop hook, RPC `cwd`, and generated wire artifacts have consumers.
- **7. Doc drift:** no instance found; tool docs, slash-command internals, and changelogs describe deferred stop behavior. No locale/i18n files or keys were added.
- **Surprise scope:** changed production files, tests, documentation, changelogs, and generated RPC clients align with the plan’s listed surfaces; no out-of-scope `/move`/`/wt` behavior, ACP wire change, task cwd parameter, print-mode support, or weaver policy change was found.
- **Plan walks:** out-of-scope list respected. Final-verification items 7.1–7.3 remain unchecked in the pinned plan; no command-output evidence for them was supplied, and none was run in this read-only review.
- **Seams:** reviewed loop hook/session consumer, shared worktree helper/CLI/tool base pinning, setting/docs, extracted headless relocation and host consumers, AgentSession fence/D6 checks, SDK/tool registration and XDev dispatch, TUI/ACP/RPC relocators, optional RPC `cwd` wire/generated SDKs, and docs/changelogs.
- **Simplification pass:** no additional cross-slice simplification candidate found beyond the central admission reservation required by B2.

FAIL
# Wave 4 (delta round after fix wave f57d9cce38; head f57d9cce38)

FAIL — one Must-fix test-quality violation remains.

## Must-fix

Blocker B1: **High — prompt-prose assertions** at `packages/coding-agent/test/modes/session-move-relocator.test.ts:139-140` and `packages/coding-agent/test/session/agent-session-move.test.ts:171` make correctness depend on generated natural-language prompt wording rather than machine-consumed state.  
**Trigger / preconditions / impact / reversibility:** a normal wording-only edit to the destination rule or `session-move-result` template makes these tests fail despite unchanged behavior; conversely, the tests do not discriminate an incorrect structured continuation whose prose still matches. This violates the repository’s prompt-test constraint and undermines the feature’s regression proof; test-only damage is reversible.  
**Why it matters:** the TUI test pins `DESTINATION_ONLY_RULE_CANARY` in an LLM-facing system prompt, while `moveResultTexts` locates the continuation by matching “The session …” prose before asserting outcome details.  
**Fix:** remove the system-prompt prose assertions; retain observable relocation and destination-relative tool behavior. In `agent-session-move.test.ts`, select the continuation by `customType === "session-move-result"` and assert its structured `details` (`outcome`, `cwd`, `target`, `reason`) plus session state, rather than rendering text.  
**class:** new natural-language prompt assertions.  
**sites:** `packages/coding-agent/test/modes/session-move-relocator.test.ts:139-140`; `packages/coding-agent/test/session/agent-session-move.test.ts:171` (the helper feeds assertions at `:249-251`, `:277-280`, `:314-316`, `:353-355`, and `:392-394`).  
**search:** `functions.grep pattern="RULE_CANARY|The session \\(was moved\\|move to\\)" path="."`.

## Should-fix

None.

## Nit

None.

## Checked

- **Previous-report classes:** closed at every named production site.
  - `non-atomic pending-move admission`: `AgentSession.reserveSessionMove()` synchronously owns the slot (`session/agent-session.ts:3261-3280`); `SessionMoveTool` takes it before its first await and releases it on all failure paths (`tools/session-move.ts:240-285`). Normal scheduler exclusivity remains an additional guard.
  - `inconsistent registry scope across two D6 checks`: both admission and post-batch checks receive the session-created registry (`tools/session-move.ts:229-234`; `session/agent-session.ts:3330-3335`; `sdk.ts:4805`).
  - `detached fatal-session teardown`: RPC awaits `disposeAndExit()` on fatal relocation (`modes/rpc/rpc-mode.ts:1790-1795`).
  - `resolved server-side session move misses the post-batch stop fence`: the loop invokes `shouldStopAfterBatch` after a Cursor-resolved message when no runnable batch invoked it (`packages/agent/src/agent-loop.ts:1728-1737`).
  - `scheduler-bypassed exclusive move admission`: direct eval/Cursor execution reaches the session-owned reservation before any async creation work.
- **1. Duplication across slices/files:** no instance found. The sync `tools/session-move.ts:56-70` and async `session/session-worktree.ts:190-205` planned-path resolvers are boundary-driven: approval planning must remain synchronous, while shared worktree creation is async.
- **2. Naming inconsistency:** no instance found. “session move,” “relocator,” and `worktree.repoDir` are consistent across types, hosts, settings, prompts, documentation, and generated RPC bindings.
- **3. Uneven API surface:** no instance found. `SessionRelocationResult` is the common host contract; `HeadlessRelocationResult.fatal` is intentionally internal to headless callers that own teardown.
- **4. Mixed conventions:** no instance found. TUI retains its BTW-wrapped command-controller route; ACP and RPC consistently use the extracted headless relocation route.
- **5. Missing abstractions / abstraction gravity:** no additional instance found. CLI and tool share `addRepoWorktree`; `/move`, `/wt`, ACP, and RPC share headless relocation; D6 uses one running-work helper.
- **6. Dead code:** no instance found. Repository-wide searches confirm production consumers for `addRepoWorktree`, `cfgWorktreeRepoDir` / `resolveRepoWorktreeDir`, reservations/relocators, all three `shouldStopAfterBatch` loop boundaries, and optional RPC `cwd` across TypeScript, schema, Go, Python, and Rust bindings. The obsolete `requestSessionMove` implementation is absent.
- **7. Doc drift:** no instance found. `docs/tools/session_move.md`, slash-command internals, RPC docs, both changelogs, prompt docs, RPC schema, and generated SDKs agree. No i18n key was added; no locale tree exists to update.
- **Surprise scope:** all changed production, generated, documentation, and test files map to the OpenSpec design/task surfaces. The ancillary ACP fakes and test harness only satisfy the new host method contract. No ACP cwd-change protocol, `/move` or `/wt` behavior change, subagent relocation, `task.cwd`, print-mode support, or weaver-policy change was introduced.
- **Plan walk:** the out-of-scope list is respected. The task plan has no per-slice “Files modified” lists beyond its planned impact/tasks; all changed files fit those surfaces. Tasks 1–6 and cleanup/fix tasks 8–10 are checked. I did not execute verification commands; 7.1 (`bun check`) and 7.3 manual TUI/ACP QA remain unchecked in the pinned plan, while 7.2 is this F3 workflow.
- **Seams:** reviewed all supplied contracts: stop hook normal/replay/Cursor paths; reservation admission and direct bridges; CLI/tool worktree helper and SHA-pinned base; repoDir validation and approval tier; shared headless relocation; session fence/D6/continuation/goal gates; host declaration and advisor exclusion; TUI/ACP/RPC relocators; RPC optional `cwd`; and documentation/changelog coverage.
- **Simplification pass:** no additional cross-slice simplification candidate found.

FAIL
# Wave 5 (delta round after fix wave 790e675246; head 790e675246)

# Integration review — delta round

Reviewed supplied local diff for `24d028086d48b80e5a380e5dc3d1309e8bc6d653...790e675246d4ba0734ee7887395a9f1fdd183476`, the pinned plan, changed-file inventory, seam list, and prior F3 report.

## Must-fix

None.

## Should-fix

None.

## Nit

None.

## Checked

- **Prior-report classes — closed at every named site**
  - `non-atomic pending-move admission`: closed. `AgentSession.reserveSessionMove()` claims synchronously before tool work, and `SessionMoveTool.execute()` obtains it before its first await and releases it through `finally` (`packages/coding-agent/src/session/agent-session.ts:3261-3280`, `packages/coding-agent/src/tools/session-move.ts:229-285`).
  - `inconsistent registry scope across two D6 checks`: closed. Admission and post-batch recheck both use the session’s injected registry (`packages/coding-agent/src/tools/session-move.ts:229-234`, `packages/coding-agent/src/session/agent-session.ts:3335-3340`).
  - `detached fatal-session teardown`: closed. RPC awaits `disposeAndExit()` in the fatal relocation branch (`packages/coding-agent/src/modes/rpc/rpc-mode.ts:1790-1795`).
  - `resolved server-side session move misses the post-batch stop fence`: closed. The loop calls `shouldStopAfterBatch` for bridge-resolved Cursor calls when no runnable batch already asked it (`packages/agent/src/agent-loop.ts:1728-1737`).
  - `scheduler-bypassed exclusive move admission`: closed. The session-owned reservation covers direct eval/Cursor execution, while scheduler `exclusive` remains an additional normal-path guard (`packages/coding-agent/src/tools/session-move.ts:95,240-285`).
  - `new natural-language prompt assertions`: closed. Move-result tests select `customType: "session-move-result"` and assert structured details rather than rendered continuation prose (`packages/coding-agent/test/session/agent-session-move.test.ts:168-184`). The specified destination-only rule canary remains an intentional real-prompt observable and was not raised.

- **1. Duplication across slices/files:** instance assessed: `realpathOfPlannedPath` exists as async `packages/coding-agent/src/session/session-worktree.ts:190-205` and synchronous `packages/coding-agent/src/tools/session-move.ts:56-70`. No defect found: approval planning must remain synchronous whereas shared worktree creation is asynchronous; merging them would worsen that boundary.
- **2. Naming inconsistency:** no instance found. The nouns `session move`, `relocator`, and `worktree.repoDir` are consistent across types, tool prompts, host wiring, docs, settings, and tests.
- **3. Uneven API surface:** no instance found. TUI/ACP/RPC expose the same `SessionRelocationResult`; `HeadlessRelocationResult.fatal` remains an intentional internal extension for owners that must tear down an unusable headless session.
- **4. Mixed conventions:** no instance found. TUI retains the existing BTW-gated command-controller path; ACP and RPC consistently share the headless relocation path used by their existing slash-command behavior.
- **5. Missing abstractions / abstraction gravity:** no instance found. CLI/tool creation shares `addRepoWorktree`; `/move`, `/wt`, ACP, and RPC share headless relocation; D6 work detection is centralized in `findRunningSessionWork`.
- **6. Dead code:** no instance found. New public additions are connected:
  - `shouldStopAfterBatch` is set by `AgentSession` and consumed at normal, replay-tail, and Cursor-resolved loop boundaries.
  - `session_move` is registered and availability-gated.
  - `worktree.repoDir` and its validator are used by the tool.
  - relocators are installed by TUI, ACP, and RPC.
  - optional RPC `cwd` is emitted by `get_state` and represented in TypeScript wire code plus Go, Python, and Rust SDKs.
  - Searches run: `functions.grep pattern="reserveSessionMove\\(|hasPendingSessionMove\\(" path="."`; `functions.grep pattern="cfgWorktreeRepoDir|worktree\\.repoDir|resolveRepoWorktreeDir" path="."`; `functions.grep pattern="relocateHeadlessSession\\(|relocateForAgent\\(|rescopeHeadlessToCwd\\(" path="."`; `functions.grep pattern="cwd\\??:|cwd:.*sessionManager|Cwd" path="packages/coding-agent/src/modes/rpc;sdk/go/omp-rpc;sdk/python/omp-rpc;sdk/rust/omp-rpc"`.
- **7. Doc drift:** no instance found. `docs/tools/session_move.md`, slash-command internals, RPC documentation, both changelogs, tool prompt, OpenSpec requirement, RPC schema, generated TypeScript, and Go/Python/Rust bindings agree. No i18n keys or locale files were added.

- **Surprise-scope walk:** no unplanned production surface found. Changed files map to the plan’s agent-loop hook, shared worktree helper/settings/tool, session lifecycle, TUI/ACP/RPC relocators, additive RPC state wire change, generated SDKs, docs/changelogs, and supporting tests/fakes. No ACP cwd-change protocol, subagent relocation, `task` cwd parameter, print-mode support, or excluded weaver/gate-policy work was implemented.
- **Out-of-scope walk:** respected. `/move` and `/wt` retain their established behavior through extraction; persistent LSP/MCP/eval workspace rebinding remains excluded; ACP receives no move-specific protocol addition.
- **Verification-plan walk:** tasks 1–6 and fix/cleanup tasks 8–11 are marked complete in the pinned plan. This review did not execute verification commands. Final tasks 7.1 (`bun check`) and 7.3 real-surface TUI/ACP manual QA remain unchecked; 7.2 is the current F3 workflow and is not a code finding.
- **Seam list:** checked producer/consumer consistency for the loop stop hook, reservation contract and direct bridges, worktree helper consumers, `worktree.repoDir` approval/validation flow, shared headless relocation, transition fence and continuation flow, registration/host declaration, TUI/ACP/RPC relocators, and RPC `cwd` wire bindings.
- **Simplification pass:** no additional cross-slice simplification candidate found.

PASS
# Wave 6 (delta round after merging main dfdededea0 and the ACP approval test; head d5f812b44903)

# Integration review — delta round

Reviewed the supplied local `main...HEAD` diff, changed-file inventory, pinned plan, prior F3 report, and all listed seams.

## Must-fix

None.

## Should-fix

None.

## Nit

None.

## Checked

- **Prior-report classes — closed at every listed site**
  - `non-atomic pending-move admission`: closed. `AgentSession.reserveSessionMove()` synchronously claims the session slot before `SessionMoveTool.execute()` reaches an await; `commit` or `release` clears it (`packages/coding-agent/src/session/agent-session.ts:3256-3279`, `packages/coding-agent/src/tools/session-move.ts:229-285`).
  - `inconsistent registry scope across two D6 checks`: closed. Tool admission and the relocation-time recheck both pass the session-scoped registry to `findRunningSessionWork` (`packages/coding-agent/src/tools/session-move.ts:229-234`, `packages/coding-agent/src/session/agent-session.ts:3330-3335`). Search: `functions.grep pattern="findRunningSessionWork\\(" path="packages/coding-agent"`.
  - `detached fatal-session teardown`: closed at the previously reported RPC site: `disposeAndExit()` is awaited before the relocator can return (`packages/coding-agent/src/modes/rpc/rpc-mode.ts:1789-1795`). The corresponding ACP and slash-command fatal handlers also await disposal. Search: `functions.grep pattern="\\.fatal|fatal: true" path="packages/coding-agent/src"`.
  - `resolved server-side session move misses the post-batch stop fence`: closed. The hook runs after normal executed batches, replayed tails, and Cursor bridge-resolved calls (`packages/agent/src/agent-loop.ts:1305-1313,1687-1690,1730-1737`). Search: `functions.grep pattern="kCursorExecResolved|shouldStopAfterBatch" path="packages/agent/src;packages/ai/src/providers/cursor.ts;packages/coding-agent/src"`.
  - `scheduler-bypassed exclusive move admission`: closed. Direct eval and Cursor tool execution still reach the session-owned reservation before any awaited worktree operation; scheduler exclusivity remains an additional guard. Search: `functions.grep pattern="\\.execute\\(" path="packages/coding-agent/src"`.
  - `new natural-language prompt assertions`: closed. Move-continuation tests select `customType === "session-move-result"` and assert structured details. The remaining `RULE_CANARY` assertion is a test-authored destination rules-file witness, not generated prompt prose. Search: `functions.grep pattern="RULE_CANARY|The session \\(was moved\\|move to\\)" path="packages/coding-agent/test;packages/agent/test"`.

- **1. Duplication across slices/files:** no defect instance found. The synchronous `realpathOfPlannedPath` in `tools/session-move.ts` and asynchronous variant in `session/session-worktree.ts` are intentionally split at the synchronous approval-planning versus asynchronous worktree-creation boundary.
- **2. Naming inconsistency:** no instance found. The nouns **session move**, **relocator**, and **`worktree.repoDir`** are consistent across types, implementation, ACP test coverage, prompts, docs, settings, and changelogs.
- **3. Uneven API surface:** no instance found. TUI, ACP, and RPC normalize to `SessionRelocationResult`; the headless-only `fatal` extension remains internal to `HeadlessRelocationResult`. The additive RPC `cwd` field is optional in the server type, schema, generated TypeScript, Go, Python, and Rust bindings.
- **4. Mixed conventions:** no instance found. TUI retains its BTW-wrapped command-controller path, while ACP and RPC consistently share the extracted headless relocation path; all use the same AgentSession reservation and continuation protocol.
- **5. Missing abstractions / abstraction gravity:** no instance found. CLI/tool worktree creation shares `addRepoWorktree`; `/move`, `/wt`, ACP, and RPC share headless relocation; and D6 detection is centralized in `findRunningSessionWork`.
- **6. Dead code:** no instance found. `shouldStopAfterBatch`, move reservations, host relocators, `session_move` registration, `worktree.repoDir`, `addRepoWorktree`, and RPC `cwd` all have production consumers. Searches included:
  - `functions.grep pattern="reserveSessionMove\\(|hasPendingSessionMove\\(" path="packages/coding-agent"`
  - `functions.grep pattern="addRepoWorktree\\(" path="."`
  - `functions.grep pattern="cfgWorktreeRepoDir|resolveRepoWorktreeDir|worktree\\.repoDir" path="."`
  - `functions.grep pattern="relocateHeadlessSession\\(|relocateForAgent\\(|setSessionRelocator\\(" path="packages/coding-agent"`
- **7. Doc drift:** no instance found. The tool documentation, slash-command internals, RPC documentation, OpenSpec requirements, prompts, both changelogs, and generated RPC bindings agree on deferred relocation, approval tiers, and optional `cwd`.

- **Surprise-scope walk:** changed production files fit the planned agent-loop hook, session lifecycle, worktree helper/settings/tool, TUI/ACP/RPC adapters, RPC wire surface, docs, and changelogs. The ACP-permission regression test is explicitly prescribed by task 12.1. No out-of-scope ACP cwd protocol, subagent relocation, `task.cwd`, print-mode support, or weaver/gate-policy work was introduced.
- **Plan walk:** all implementation tasks through 11 are marked complete and map to corresponding diff surfaces. Task 12.1 remains unchecked in the pinned plan; its requested ACP permission regression is present at `packages/coding-agent/test/agent-session-acp-permission.test.ts:389-453`. This read-only review did not execute its prescribed commands or independently verify their recorded outcomes.
- **Out-of-scope walk:** respected. `/move` and `/wt` retain their existing behavior via the shared relocation extraction; persistent LSP/MCP/eval rebinding remains excluded; no ACP protocol addition or subagent move capability was added.
- **Verification walk:** the pinned plan marks tasks 7.1–7.3 complete and records F3/F1 evidence paths, but no checks were run in this review. The merged-main task 12.1 remains pending in plan status, as noted above.
- **Seams:** checked the normal/replay/Cursor-resolved stop-hook boundaries; reservation and direct bridge execution; D6 registry propagation; worktree helper and repoDir validation; transition fence and hidden continuation; host declaration and tool registration; TUI/ACP/RPC relocators; ACP approval tier routing; and RPC `cwd` source/schema/generated-client contract.
- **Simplification pass:** no additional cross-slice simplification candidate found.

PASS
