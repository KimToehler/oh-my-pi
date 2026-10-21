**Bottom line:** The seven fixes close the interleavings they target, including `fc293833cb`’s prompt/session-change hold, but the design is not structurally complete. ACP Goal ownership is still split across four independent serializers—`AcpGoalController.#op`, `GoalRuntime.#accountingTail`, host reconcile/exit chains, and ACP notification state—so several real pairs have no common ordering point.

## Action plan

1. **Interleaving inventory.** Abbreviations: prompt **P**, Stop **S**, explicit mode **M**, steered builtin **B**, extension session change **X**, deferred reconcile **R**, agent `goal` tool **T**, continuation **C**, lifetime events **L**.
   - **P×S — ordered:** cancellation is rechecked around preparation, compensated, and exposed through `goalPreparation`; the next prompt waits for cleanup (`acp-agent.ts:953-1058,1176-1288,1331-1387`).
   - **P×B — ordered:** the turn reserves steered builtins before running them and quiescence includes that reservation (`acp-agent.ts:297-307,1476-1626`).
   - **P×X/R — ordered for Goal entry:** `beginSessionChange` joins the adapter chain, operations await host settlement, and admission rejects a changed transcript (`acp-goal.ts:77-152,183-243`; `acp-agent.ts:1258-1288`).
   - **P×C/L — ordered:** continuation is counted before prompt settlement; the Goal observer is installed before prompt subscribers (`host-controller.ts:491-545`; `acp-agent.ts:297-307,1743-1755`).
   - **P×M — defect:** create/resume and leave are serialized, but prompt admission occurs after an awaited mode sync and outside `#op`; a later Plan exit can pause Goal and enable Plan before the earlier objective reaches `session.prompt()` (`acp-agent.ts:1225-1250,2513-2544`).
   - **S×B/C/L — ordered:** cancellation marks the turn first, drops queued builtins, invalidates continuation generation, and suppresses the aborted `agent_end` (`acp-agent.ts:1353-1387,1531-1626`; `host-controller.ts:139-143,491-545`).
   - **S×M/T — ordered only within GoalRuntime:** its accounting chain serializes runtime mutations, but it provides no transcript ownership (`runtime.ts:149-161,244-263`).
   - **S×X/R — defect:** cancel cleanup and `#goalSessionChange` do not join each other. A late interrupted `onTaskAborted` reads live state after awaits and can pause the Goal adopted by the new transcript (`acp-agent.ts:1353-1387,3408-3421`; `runtime.ts:244-263`).
   - **M×L — notification-ordered:** `explicitModeChanges` defers lifecycle synchronization until the outer explicit transition ends (`acp-agent.ts:2299-2326`).
   - **M×M/X/R — partially defective:** Goal operations use `#op`, but Plan mutation is outside it. Concurrent Plan→Goal can clear Plan before waiting for `select()`, then the earlier request installs Plan afterward, leaving Plan and `#selected` simultaneously true (`acp-agent.ts:896-948,2513-2544`).
   - **M×T — defect:** the tool calls `GoalRuntime` directly; a previously admitted `resume` can reactivate Goal after Plan paused it, and `observe(goal_updated)` then sets `#selected` outside `#op` (`runtime.ts:428-443`; `acp-goal.ts:160-175`).
   - **B×{M,X,R,T} — no direct ACP transient write:** relevant effects reduce to L; its own turn ownership is already fenced at `acp-agent.ts:1476-1626`.
   - **X×R/C — ordered:** reconciles queue, overlap remains non-awaited, and continuation uses session-change/generation gates (`host-controller.ts:170-221,379-423,491-545`).
   - **X/R×T/L — defect:** runtime tool mutations and old-run events bypass the session hold and reconcile chain; `#reconcileOnce` directly clears/replaces state and tools while T may commit independently (`host-controller.ts:396-461`; `runtime.ts:393-504`).
   - **X/R×reported/stale state — defect:** `reportedModeId` is record-global and `staleClientConfig` is loaded once, never rebound when the transcript changes; source-transcript stale values can suppress or fail to journal the target transcript’s mode (`acp-agent.ts:1788-1806,2386-2443,3408-3421`).
   - **T×C/L and C×L — ordered in isolation:** tool commits emit L, and continuation admission rereads live Goal/Plan state; the defect appears only when M, X, R, or S changes ownership concurrently (`host-controller.ts:428-545`).

2. **Verdict and minimal restructuring:** replace the ACP-specific promise chains and side-channel counters with one per-record `AcpGoalActor`. It should own `{transcriptGeneration, turnGeneration, selected, objectivePending, reportedModeId, staleConfigByTranscript, sessionChangeState}` and process every P/S/M/B/X/R/T/C/L intent.

3. Use two-phase, generation-stamped effects: the actor reserves an operation, asynchronous tool swaps/reconcile/network delivery run outside the mailbox, and completion commits only if its transcript/turn generation still owns the state. This preserves the required non-awaited overlap reconcile without reintroducing its extension-notification deadlock.

4. **Files:** reshape `acp-goal.ts` into that actor; route prompt admission, cancel, mode APIs, steering, session changes, and lifetime delivery through it in `acp-agent.ts`; make `host-controller.ts` publish reconcile/continuation intents rather than mutate ACP state through `onReconciled`; let ACP install the actor’s mutation gate around `GoalRuntime` mutators in `runtime.ts`.

5. Remove `AcpGoalController.#op`, `#sessionChanges/#heldChanges/#changeHeld`, direct `observe()` writes, and ACP’s `goalPreparation`, `reportedModeId`, `explicitModeChanges`, `modeSyncDeferred`, and unscoped `staleClientConfig`. Retain GoalRuntime’s accounting logic and the host’s durable reconcile algorithm.

**Residual risk if shipped now:** a rare overlap can leave Plan with an active/selected Goal, pause or resurrect the wrong transcript’s Goal, expose the wrong tool set, or mishandle IntelliJ’s stale `goal` replay—potentially creating an unintended autonomous objective.

**Effort:** Medium (1–2d)  
**Confidence:** high

**Watch out for:**
- Never await the deferred reconcile from the extension notification that caused it.
- Do not hold the actor mailbox across transport notifications or re-entrant extension callbacks.
- Keep the shared RPC/TUI GoalRuntime behavior and RPC wire contract unchanged.

VERDICT: RESTRUCTURE