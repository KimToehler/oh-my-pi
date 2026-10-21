## Must-fix

### 1. Goal-tool mutations are not bound to the transcript that admitted them

**`packages/coding-agent/src/modes/acp/acp-goal.ts:195-207`; `packages/coding-agent/src/goals/runtime.ts:169-182, 427, 459, 488-529`; `packages/coding-agent/src/goals/tools/goal-tool.ts:91-105`**

The entry gate checks only whether a session change or reconcile is *currently* running; it does not retain the tool call’s originating transcript generation, and `drop` and `complete` have no equivalent gate. A tool call queued on the accounting chain in transcript A can therefore commit after the switch and reconcile to B have finished: create/resume can enter B, while drop/complete can mutate B’s adopted goal.

**Fix:** Reserve a transcript/change generation when each mutating tool operation is admitted and verify it at the actual commit boundary, including drop and complete. Add gated tests that release the old call *after* the new transcript’s reconcile has completed, not only while reconcile is in progress.

- **class:** Unstamped Goal-tool mutations crossing transcript ownership.
- **sites:** `GoalRuntime.createGoal`, `resumeGoal`, `dropGoal`, and `completeGoalFromTool`; their tool dispatch sites are `goal-tool.ts:91-105`. `replaceGoal`, `pauseGoal`, and `onBudgetMutated` are additional runtime mutators requiring an ownership audit for their respective callers. Searches: `functions.grep`, path `packages/coding-agent/src`, patterns `\.((createGoal)|(resumeGoal)|(pauseGoal)|(dropGoal)|(completeGoalFromTool)|(onTaskAborted))\(` and `acp-stale-client-config|#staleValues|#reportedModeId|admitInterruptPause|admitEntry`; runtime mutators were also read directly.

### 2. Reported mode still leaks across transcripts

**`packages/coding-agent/src/modes/acp/acp-goal.ts:146-147, 480-485, 491-509, 597-609`**

`#reportedModeId` remains one actor-wide value even though stale config is now keyed by transcript. For example, switching from A while its reported mode is `goal` to B in `default` makes the post-reconcile sync record `goal` as a stale value **in B**, so a genuine Goal selection in B can be ignored. The added per-transcript test switches away from A only after A has already returned to Default, so it does not cover this case.

**Fix:** Bind reported-mode ownership to the transcript and define the transition behavior explicitly: when adopting B, do not write A’s reported value into B’s stale-config journal. Add a switch test from reported Goal in A to Default in B and verify that selecting Goal in B succeeds.

- **class:** Cross-transcript mode-reporting state leakage.
- **sites:** The single `#reportedModeId` field and its reads/writes in `adoptReportedMode`, `announceMode`, and `syncAgentModeChange`, all in `acp-goal.ts:147, 458-485`. Search: `functions.grep`, whole worktree, pattern `acp-stale-client-config|#staleValues|#reportedModeId|admitInterruptPause|admitEntry`.

### 3. New admission object contains unused production code

**`packages/coding-agent/src/modes/acp/acp-goal.ts:99, 103-109, 132-134, 292-294`**

`PromptAdmission` stores the actor and exposes an `actor` getter, but neither is read by any consumer. This adds dead ownership state to an already concurrency-sensitive object.

**Fix:** Remove the field, constructor argument, getter, and corresponding `this` argument at construction.

- **single instance:** A whole-worktree search for `PromptAdmission|\.actor\b|#actor\b` found no consumer of this getter or field; other `.actor` matches are unrelated concepts.

### 4. The row-10 RED requirement is not met for P×M

**`.omo/evidence/acp-goal-mode/actor-red.txt:93`; `/tmp/ACP_GOAL_MODE_PLAN.md`, TODO 10**

The plan requires each listed open pair to have a gated ACP regression test that fails on `fc293833cb`, but the recorded P×M test passed on that head. The later guard-discrimination result demonstrates a guard’s relevance, but does not establish the plan’s requested pre-restructure failure for the stated P×M scenario.

**Fix:** Either add a discriminating P×M regression that fails on the specified pre-actor head, or obtain and record an explicit plan decision changing that requirement based on the evidence.

- **single instance:** The recorded RED artifact explicitly identifies P×M as the exception; the other five pair results are documented as failures in that artifact and guard-discrimination evidence.

## Should-fix

None.

## Nit

None.

## Checked

- **Prior class: removed public RPC wire type:** Still closed. The delta does not modify the RPC wire type or boundary conversion; the new runtime gate defaults to absent and is installed by ACP.
- **Prior class: missing ACP Goal ingress coverage:** Existing ingress tests remain in the source, and the delta adds actor interleaving cases. The P×M RED qualification above remains open.
- **Prior class: explicit-mode lifecycle sync race:** The two mode entrypoints use `explicitModeChange`; its explicit counter and deferred sync cover lifecycle events during the transition.
- **Prior class: dropped concurrent lifecycle sync:** Deferred synchronization remains flushed at the outermost explicit transition. Cross-transcript ownership of the reported value is a separate blocker above.
- **Prior class: unselected paused Goal exit bypass:** `#leave` checks the actual paused state, not selection, and invokes the host pause/restore path.
- **1. Duplication across slices/files:** No instance found.
- **2. Naming inconsistency:** No instance found for the reviewed nouns `admission`, `reconcile`, and `continuation`.
- **3. Uneven API surface:** No instance found; host fences and the runtime mutation gate are optional host-specific additions.
- **4. Mixed conventions:** No instance found.
- **5. Missing abstractions:** No cross-slice simplification candidate found.
- **6. Dead code:** `PromptAdmission.actor` and its stored field are unused, as reported above.
- **7. Doc drift:** No instance found in the changed surface; no i18n keys, locale files, or OpenAPI contract changed.
- **Surprise scope and plan files:** The changed production files and test fakes are within row 10’s actor, ACP integration, host controller, and runtime surfaces; the two evidence files are also in the supplied inventory.
- **Out-of-scope walk:** No implementation of ACP Vibe, guided-goal, Loop, Tan, or `/goal drop` was found in this delta.
- **Verification checklist:** The supplied actor evidence records focused RED/discrimination results, with the P×M exception above. The full planned focused, shared Goal/RPC, ACP regression, check-command, and final-head manual QA runs are not established by the supplied delta evidence; no test or manual run was performed for this review.
- **i18n and slice-file walks:** No new keys or locales; changed production and test paths match the row-10 design surface.
- **Seam 1, actor ↔ ACP:** Reviewed prompt admission/confirmation, Stop and abort cleanup, explicit transitions and plan approval, reporting/stale config, observation, reconciliation and session-change hooks, and quiescence reads. Reported-mode transcript leakage remains open.
- **Seam 2, runtime gate:** Absent by default for RPC/TUI; ACP installation and disposal were inspected. Tool mutation ownership remains open as described above.
- **Seam 3, host controller and RPC:** Reviewed optional entry fences, abandonment and reconciliation probe; no RPC wire-shape change is present in this delta.
- **Seam 4, persisted stale config:** Entry shape remains `values` under `acp-stale-client-config`; transcript-keyed cache does not by itself fix the actor-wide reported-mode leak.
- **Seam 5, test fakes:** Both changed fakes provide the new no-op `setMutationGate` required during ACP registration.
- **Simplification pass:** The unused admission actor reference is the identified removable code; no other substantiated cross-slice simplification found.

FAIL