## 1. Goal and behavioural contract

Goal arming, command routing, continuation ownership, Stop/resume, stale-mode handling, and RPC compatibility reviewed. Cancellation and explicit mode changes can still race Goal preparation.

## 2. Correctness, regressions, architecture, wire contracts

**Blocker 1 — High: cancelled preparation overlaps next prompt.**

- **Evidence:** `acp-agent.ts:1016-1032` starts `#runPromptOrCommand` without awaiting it. Cancellation resolves the prompt immediately and cleanup waits only for `session.abort()` (`:1315-1347`). Goal preparation and its compensating pause can still be running at `:1219-1227`. `acp-goal.ts:65-74` retains `#objectivePending` until creation finishes.
- **Failure mode:** Hold tool activation during creation, cancel, then send the next prompt before releasing activation. Abort cleanup and the first response finish, so the next prompt enters while `#objectivePending` remains true and a Goal already exists. It attempts another creation and fails instead of resuming. Alternatively, late `pauseAfterCancelledPrompt()` can pause a Goal after newer work starts.
- **Fix direction:** Include in-flight preparation and cancellation compensation in the prompt cleanup barrier. Preserve prompt-turn ownership until both finish; test immediate next-prompt admission before releasing the preparation gate.
- **class:** post-cancellation Goal preparation crossing prompt boundaries.
- **sites:** `acp-agent.ts:1017,1219-1227,1315-1347`; create and resume share `acp-goal.ts:65-74,84-86`. Search: `#runPromptOrCommand\(|#beginCancelCleanup\(|pauseAfterCancelledPrompt\(|prepareHostPrompt\(|createForHostPrompt\(|resumeForHostPrompt\(` across `packages/coding-agent/src`. Direct post-cancel admission guard is present at the single ACP preparation site, but the broader cancellation class remains **open** across that site’s cleanup boundary.

**Blocker 2 — High: explicit mode exit can resurrect Goal.**

- **Evidence:** `host-controller.ts:317-321` captures the active state, awaits tool activation, then writes that captured state. Concurrent Default or Plan selection calls `goal.leave()` through `acp-agent.ts:2466-2474`; `acp-goal.ts:47-57` pauses the current Goal and restores tools.
- **Failure mode:** Select Default or Plan while creation or resume is held at tool activation. Mode exit pauses Goal, but releasing activation writes the earlier active state back and enables Goal tools. Default can report Goal again; Plan can coexist with an active Goal. This is state resurrection, distinct from F3’s closed notification-sync race.
- **Fix direction:** Serialize Goal preparation with explicit mode transitions, or invalidate and reconcile stale preparation before committing its state and tools. Add gated creation **and** resume tests for both mode request entrypoints.
- **class:** stale asynchronous Goal-entry commit after explicit mode exit.
- **sites:** Shared stale commit at `host-controller.ts:317-321`; both `setSessionMode` and mode-valued `setSessionConfigOption` enter `#applyModeChange` at `acp-agent.ts:899,920`; both creation and resume use `#enter`. Search: `#applyModeChange\(|\.goal\.leave\(|setGoalModeState\(state\)|setActiveToolsByName\(` across ACP source and `host-controller.ts`. Class remains **open** at the shared commit.

RPC wire translation and opt-in continuation reviewed; no separate wire-contract blocker found.

## 3. Security and privacy delta

**Delta: yes.** ACP now persists objective text as Goal state and enables autonomous ACP continuation by default. No new external recipient identified. The mode-exit race can permit work under a Goal the client explicitly left.

## 4. Verification adequacy

- **Blocker — Medium: final-head IntelliJ QA missing.** `qa-matrix.md:5-6,15-17` identifies the real IntelliJ run as code head `3d2f945577`; cancellation fixes and the main merge landed later. Final-head Stop/resume, command, and replay scenarios used stdio with IntelliJ identity, not the specified real IntelliJ surface. Plan requires manual QA on real surface after the last code commit.
- **class:** stale or surrogate manual evidence for required final-head GUI scenarios.
- **sites:** `.omo/evidence/acp-goal-mode/qa-matrix.md:5-17`, covering real-IDE objective, Stop/resume, command, replay, and log-count scenarios. Single QA matrix for this feature; inspect its cited artifacts and rerun required scenarios on final code in IntelliJ.
- Gated cancellation tests at `acp-agent.test.ts:5217-5260` release preparation before sending the next prompt; they do not exercise blocker 1. No checks run during this read-only review.

## 5. Final verdict

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A later explicit mode selection cannot be overwritten by an earlier asynchronous Goal tool activation.
  positive_witness: Hold Goal activation, select Plan, release activation, and observe Plan selected with Goal paused and pre-Goal tools restored.
  negative_control: Releasing the older activation restores an active Goal or its tool after Plan selection.
  observable: Goal status, enabled tool names, mode notifications, and persisted mode after the activation gate opens.
  boundary: ACP mode-change handlers and GoalHostController tool activation.
END-REVIEW-TRAILER