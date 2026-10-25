FAIL

## 1. Goal and behavioural contract

The implementation covers the intended surfaces: target validation and worktree creation, deferred post-batch relocation, one hidden continuation, TUI/ACP/RPC relocators, optional RPC `cwd`, tool availability gating, and descendant registry rebasing. The supplied TUI/ACP evidence demonstrates ordinary successful and refused paths.

Blocker B1: **High — non-atomic descendant-work exclusion** at `packages/coding-agent/src/session/agent-session.ts:3326-3349` violates **“Running background work blocks the move”**. After the final `findRunningSessionWork()` snapshot passes, `#executeSessionMove` immediately awaits the host relocator without reserving descendant run admission. A normal peer `write agent://<idle-descendant>` can wake that descendant during any awaited relocator step (for example settings flush or filesystem relocation): `IrcBridge.deliver()` calls `wakeForIrc` for an idle recipient at `packages/coding-agent/src/session/irc-bridge.ts:243-266`, and the descendant starts its turn with `agent.prompt(records)` at `packages/coding-agent/src/session/agent-session.ts:1571-1600`. Its registry status is synchronised to `running` by `AgentRegistry.syncSessionStatus()` at `packages/coding-agent/src/registry/agent-registry.ts:413-418`, but the root has already passed its last D6 check and relocates anyway. Trigger: an idle retained subagent and an ordinary peer message concurrent with its root’s deferred move. Impact: the subagent can execute/write in the old checkout while its root relocates, precisely the mixed-workspace state the D6 rule is meant to prevent; resulting edits may be irreversible. Fix direction: make the root’s transition fence an admission barrier for descendant wakes/revivals, or otherwise atomically hold descendant-run admission from the final D6 check until relocation settles, then re-check under that barrier before moving.  
class: final D6 check is not held through relocation.  
sites: **single production instance** — `functions.grep(pattern="findRunningSessionWork\\(", path="/Users/tim/git/oh-my-pi/.worktrees/session-move-tool")` found only the tool-time admission check at `tools/session-move.ts:229` and the relocation-time decision at `session/agent-session.ts:3331`; only the latter proceeds directly to the relocator and is therefore the vulnerable final admission point.

## 2. Correctness, regressions, architecture, wire contracts

The new `SessionManager.moveTo` rebase path correctly updates descendant registry-file references after artifact-directory movement, including rollback through the common `moveTo` path. The SDK passes the configured registry into `AgentSession`, and both pre-tool and post-batch D6 checks use it. The prior closed classes remain closed at their reported sites: batch stopping includes normal, replay-tail, and Cursor-resolved calls; reservation acquisition precedes tool awaits; RPC fatal teardown is awaited; and RPC `cwd` is optional in server and generated client representations.

The blocker above remains because those correct snapshot checks do not serialize a new descendant run against relocation. No additional substantiated correctness or wire-contract blocker was found.

## 3. Security and privacy delta

No credential, authentication/authorization, or third-party-personal-data path was added. The path-containment and symlink validation changes are directly related to the feature and correctly reject unregistered/out-of-repository targets under the stated call-time containment model. The plan’s accepted concurrent filesystem-component swap race remains out of scope.

The reported blocker is a concurrency/state regression affecting local checkout integrity, not a security/privacy delta.

## 4. Verification adequacy

Reviewed the supplied full diff, pinned OpenSpec bundle, F3 report, source implementation, focused tests, and wave-3 TUI/ACP evidence.

The supplied verification exercises:
- normal existing/create target moves;
- out-of-repository rejection;
- running async job refusal;
- one continuation with a goal;
- ACP approval behavior;
- resume relocation;
- descendant-ref rebasing after a completed move and rollback.

It does **not** exercise the blocking race: a real or controlled `agent://` wake of an idle descendant after `#executeSessionMove`’s final D6 snapshot but before/during an awaited host relocation, followed by proof that relocation does not proceed while that wake runs. The new row `h-descendant.md` wakes the child only after the first move has completed, then tests a later second move; it cannot discriminate this pre-relocation race. The unit tests similarly either register the child before the final recheck or mark it running after a completed move.

## 5. Final

FAIL

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1, 2, 3, 4, 5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: Once the root session begins its deferred relocation transition, no previously idle descendant may begin executing against the source checkout before the relocation either rejects or completes.
  positive_witness: A peer wake arriving during a deliberately paused relocator is queued or rejected until relocation settles, and no descendant provider request or source-checkout mutation occurs during the pause.
  negative_control: An idle descendant accepts the peer wake after the final D6 snapshot and begins a provider/tool turn while the root relocator is still paused.
  observable: Ordered runtime trace shows the descendant run admission only after relocation settlement; the negative control must show admission before settlement and fail.
  boundary: AgentSession post-batch relocation fence, AgentRegistry descendant lifecycle, and IRC wake delivery.
END-REVIEW-TRAILER