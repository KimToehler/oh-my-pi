Bottom line: The change holds up architecturally: move admission, batch termination, relocation, and host rescoping have clear owners, while TUI, ACP, RPC, and CLI reuse existing relocation and worktree mechanisms. I found no blocker; the highest-impact risk—continued execution or concurrent writes in the old checkout—is addressed across normal, wrapped, replayed, and Cursor-bridged tool paths.

## 1. Does the change hold up architecturally?

Yes.

- `runLoopBody` in `packages/agent/src/agent-loop.ts` supplies a generic, non-aborting batch boundary rather than attaching relocation semantics to transformed tool results. It covers ordinary batches, replayed tool tails, and `kCursorExecResolved` calls.
- `AgentSession.reserveSessionMove`, `#scheduleSessionMove`, and `#executeSessionMove` in `packages/coding-agent/src/session/agent-session.ts` correctly centralize atomic admission, transition fencing, the second running-work check, relocation, and continuation creation.
- `SessionMoveTool.execute` and `#plan` in `packages/coding-agent/src/tools/session-move.ts` own only validation, approval classification, optional worktree creation, and reservation commit.
- TUI, ACP, and RPC remain adapters: `CommandController.relocateForAgent`, `AcpAgent.#relocateSession`, and the RPC relocator all route through existing relocation behavior. Headless callers share `relocateHeadlessSession` in `packages/coding-agent/src/session/headless-relocation.ts`.
- Worktree creation is consolidated in `addRepoWorktree` in `packages/coding-agent/src/session/session-worktree.ts`, preserving one implementation for the CLI and tool.

The main architectural compromise is process-global headless rescoping through `setProjectDir`; the plan explicitly accepts its multi-session ACP consequences and correctly keeps logical cwd and session-file ownership per session.

## 2. What does the line-level audit structurally miss?

- **Note N1:** [INFERENCE] A user interrupt while `SessionMoveTool.execute` is awaiting worktree creation cannot immediately cancel that work: `_signal` is unused, while `AgentSession.abort` calls `#discardPendingSessionMove`, which clears committed moves but not an open `#sessionMoveReserved`. A branch/worktree may therefore finish being created after Stop before the reservation commits or releases. This does not block because cancellation of approved worktree creation is not part of the contract, the state is ultimately released or drained, and the local side effects are reversible.
- **Note N2:** On an ACP fatal relocation, `AcpAgent.#relocateSession` awaits `record.session.dispose()` from inside the session-move post-prompt task, while `AgentSession.#doDispose` initially drains all post-prompt tasks, including that caller. The disposal timeout bounds the resulting self-wait. This does not block because reaching it requires the fatal double-recovery path, not ordinary operation, and it produces a bounded teardown delay rather than unsafe continuation or protected-asset exposure.
- More broadly, a line-level pass is less likely to expose temporal ownership questions spanning `AgentSession.abort`, post-prompt task draining, host teardown, and the process-global state changed by `rescopeHeadlessToCwd`. The supplied whole-diff review covered the principal production paths, while the two remaining observations above stay below the blocking threshold.

## 3. Which production failure would hurt most, and is it addressed?

The worst credible failure is a model request or concurrent writer continuing in the old checkout after `session_move` succeeds, causing edits or commands to land on the wrong branch. That failure is addressed by:

- atomic session-owned admission in `AgentSession.reserveSessionMove`;
- the post-batch stop hook in `runLoopBody`, including replay and Cursor-resolved execution;
- suppression of steering, aside, and follow-up drains at the stop boundary;
- admission and post-batch running-work checks through `findRunningSessionWork`;
- the session-transition fence around relocation;
- goal-continuation gates in `GoalHostController` and `InteractiveMode`;
- the supplied TUI and ACP QA scenarios covering continuation ordering, active goals, running background work, and resume-bucket relocation.

The remaining process-global ACP cwd exposure is explicitly accepted in `openspec/changes/session-move-tool/gate.md` and inherits the existing `/move` behavior.

## 4. Is any auditor finding a false positive on unchanged behavior?

No. The implementation audit reported no defect findings or blockers, so there is no false positive to dismiss. Its treatment of the filesystem race and process-global ACP cwd as documented residual behavior is consistent with the pinned gate.

## Action plan

1. Record this strategic review as passing; no fix wave is required.
2. Preserve the abort-during-creation and ACP fatal-disposal observations as optional hardening notes, not merge blockers.
3. Keep the accepted ACP process-global and persistent-service rebinding limitations visible in the shipped documentation.

**Effort:** Quick (<1h), because no required remediation was identified.

**Confidence:** high.

PASS

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: Moving one ACP session must not change another hosted session's logical cwd or session-file bucket, even though the process-wide project directory changes.
  positive_witness: After session A moves, A reports the target cwd while session B still reports its original cwd and retains its session file in its original bucket.
  negative_control: Moving session A causes session B to resolve relative work against A's target or relocates B's session file.
  observable: The two session records' SessionManager cwd values, relative-tool results, and session-file paths remain independently attributable before and after A's move.
  boundary: ACP host record isolation at the AcpAgent-to-SessionManager and headless-relocation boundary.
END-REVIEW-TRAILER