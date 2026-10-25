Bottom line: The component boundaries are sensible, but the concurrency boundary is too narrow: relocation is protected by root-local snapshots and a transition flag, while root and descendant wake admission remains process-wide and independently runnable. The auditor’s blocker is valid and is one manifestation of a broader root-tree admission race, so this change does not yet satisfy its highest-risk invariant.

## 1. Does the change hold up architecturally against the rest of the system?

Not fully.

The static ownership split is good:

- `SessionMoveTool` owns validation, approval and optional creation in `packages/coding-agent/src/tools/session-move.ts`.
- `AgentSession.#executeSessionMove` owns deferred execution and continuation in `packages/coding-agent/src/session/agent-session.ts`.
- Host adapters reuse `CommandController.relocateForAgent` and `relocateHeadlessSession`.
- `SessionManager.moveTo` and `rebaseDescendantSessionFiles` consistently move transcript ownership, including rollback.

The synchronization ownership does not align with those boundaries. `AgentSession.#executeSessionMove` performs a final `findRunningSessionWork` snapshot and then awaits the relocator, but new runs are admitted elsewhere by `IrcBus`, `IrcBridge`, `AgentLifecycleManager`, and each recipient `AgentSession`. The root’s `isSessionTransitioning` flag is consulted by goals, interactive auto-submit and collaboration, but it is not a root-tree admission primitive.

Blocker B1: High — a normal peer wake can admit a root or descendant turn after the final D6 snapshot and before relocation settles. Trigger: another concurrently hosted top-level session or peer sends `write agent://<root-or-idle-descendant>` while the relocator is awaiting settings, filesystem, rollback or host-rescope work. Preconditions: the recipient was idle when `AgentSession.#executeSessionMove` made its final snapshot and is visible in the shared registry; no malicious local race is required. Impact: `IrcBridge.deliver` treats the recipient as idle, and `AgentSession.#wakeForIrc` can call `agent.prompt` while the root’s cwd, artifact directory and registry paths are being moved. A descendant can write the source checkout while its transcript is rebased; the root itself can make a provider request using pre-move context while tools later observe post-move state. This violates both the no-old-directory-request contract and the running-work exclusion. Wrong-checkout edits or commands can be irreversible; moving the session back does not reliably undo them. Fix direction: acquire a root-tree run-admission lease before the final D6 check, re-check under that lease, and hold it through relocation, rollback and descendant-reference rebasing; IRC delivery and live/cold revival should queue behind that lease and drain only after settlement.

class: relocation transition is not a root-tree run-admission barrier.

sites: `packages/coding-agent/src/session/agent-session.ts:3318-3349` (`#executeSessionMove`, final snapshot followed by awaited relocation); `packages/coding-agent/src/session/agent-session.ts:2103-2114` (`IrcBridgeHost.isStreaming` excludes `isSessionTransitioning`); `packages/coding-agent/src/session/agent-session.ts:1535-1593` (`#wakeForIrc` dispatches `agent.prompt` without a transition admission check); `packages/coding-agent/src/session/irc-bridge.ts:202-258` (`IrcBridge.deliver` wakes an apparently idle recipient); `packages/coding-agent/src/irc/bus.ts:150-203` (live/revived delivery); `packages/coding-agent/src/registry/agent-lifecycle.ts::ensureLive` (parked-recipient revival); and `packages/coding-agent/src/registry/agent-registry.ts:413-417` (`syncSessionStatus` reports running only after admission). Searches run: `functions.grep(pattern="wakeForIrc|syncSessionStatus|isSessionTransitioning|findRunningSessionWork\\(", path="packages/coding-agent/src")` and `functions.grep(pattern="deliverIrcMessage\\(", path="packages/coding-agent/src")`. They found the two D6 snapshots and one live IRC-delivery path, with no corresponding root-transition guard in `irc/`, `registry/` or `task/`.

## 2. What does the auditor’s line-level view structurally miss?

The defect is broader than the single await after `findRunningSessionWork`:

- The transition fence protects the root session’s goal/UI/collaboration paths, not the whole ownership tree.
- The root itself is also vulnerable. Its `IrcBridgeHost.isStreaming` callback returns only `this.isStreaming`, and `#wakeForIrc` bypasses the guarded agent-initiated-message path. A message to the root can therefore start a turn during its own relocation.
- A parked descendant can enter through `AgentLifecycleManager.ensureLive` before live delivery, so patching only `IrcBridge.deliver` or adding another D6 snapshot would leave another admission route.
- Fix row 13.1 preserves registry ownership after completed moves and rollback, but it does not serialize a new writer with the move. The QA observation of a recreated source-bucket lock file is consistent with old-path state surviving in a descendant process.

The architectural correction is one admission lease at the root-tree boundary, not another point-in-time status check.

**Note N1:** `SessionMoveTool.execute` does not cancel already-approved worktree creation when its `AbortSignal` fires. This remains non-blocking because the abort path performs a second post-prompt cancellation after `agent_end` maintenance, preventing the deferred relocation, while the local branch/worktree side effects were already exec-approved and are reversible.

**Note N2:** The pinned `tasks.md` still marks task 12.1 unchecked although the brief and diff state that its merge, ACP test and QA work were completed. This is plan-status drift rather than a runtime blocker, but the next frozen OpenSpec bundle should accurately record it.

## 3. Which production failure would hurt most, and is it addressed?

The worst credible failure is autonomous work landing in the source checkout while the root session and transcript move to another checkout. It can leave edits on the wrong branch, split a descendant’s transcript or present one provider turn with pre-move context and post-move tool state.

The existing reservation, batch-stop hook, queue suppression, transition fence, two D6 snapshots and descendant-path rebasing address most scheduled paths. They do not address a newly admitted root or descendant wake during the relocator await, and neither the automated tests nor QA row `h-descendant.md` exercises that interval: row h wakes the child only after the first move has completed and then checks a later move. Therefore the highest-impact failure remains incompletely addressed.

## 4. Is any auditor finding a false positive on unchanged behaviour?

No. The IRC and revival mechanisms are largely unchanged, but this change introduces the deferred relocation interval and explicitly promises that running descendants block relocation and that no provider request occurs against the old directory. Exposing unchanged wake admission to that new state transition is causally part of this change; any related weakness in `/move` does not make the new `session_move` contract pass.

## Action plan

1. Add a root-tree relocation admission lease, acquired synchronously before the final D6 snapshot and held until relocation or rollback, registry rebasing and host rescope settle.
2. Make `IrcBus` delivery and `AgentLifecycleManager.ensureLive` queue root and descendant wakes behind that lease; do not merely classify the transition as “streaming.”
3. Re-run `findRunningSessionWork` while holding the lease, then release and drain queued messages after the transition fence closes.
4. Add deterministic paused-relocator tests for an idle live descendant, a parked descendant and the root recipient. Each must prove that no provider request or running-status transition occurs before settlement.
5. Run each test’s negative control without the admission lease, then repeat the real TUI/ACP descendant scenario on the fixed head.
6. Correct task 12.1’s completion state before taking the next immutable OpenSpec/F2 snapshot.

**Effort:** Medium (1–2d)

**Confidence:** high

**Watch out for:**
- Patching only `findRunningSessionWork` or `IrcBridge.deliver`; cold revival and root wakes must share the same barrier.
- Rejecting or losing peer messages during relocation; queue them and preserve delivery ordering.
- Keying the lease only by the movable session-file path; its identity must remain stable across forward move and rollback.

FAIL

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: An IRC delivery accepted while a root session is relocating must not dispatch or revive any member of that root's agent tree until transcript rebasing and host rescope have settled.
  positive_witness: A message sent to the root, an idle live descendant, or a parked descendant while the relocator is paused remains queued; its provider turn begins only after the relocation lease is released.
  negative_control: The send reports the recipient as woken or revived and a provider request starts while the relocator remains paused.
  observable: Ordered runtime events show relocation settlement and lease release before registry status becomes running, provider invocation begins, or a source-checkout tool executes.
  boundary: IrcBus and AgentLifecycleManager admission coordinated with the AgentSession root-tree relocation lease.
END-REVIEW-TRAILER