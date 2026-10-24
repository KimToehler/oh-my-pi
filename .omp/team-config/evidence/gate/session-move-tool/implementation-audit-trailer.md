PASS — no blocking defect substantiated.

## 1. Goal and behavioural contract
The implementation matches the supplied contract in the reviewed range:

- `session_move` is gated to declared, persisted, top-level relocatable sessions and uses a session-owned reservation.
- Its creation path validates registered/repository-contained targets and defers relocation until the tool batch boundary.
- The loop’s stop hook covers normal batches, replayed tool tails, and Cursor bridge-resolved calls.
- TUI, ACP, and RPC install host-specific relocators; RPC exposes optional `cwd` through `get_state`.
- The post-prompt relocation rechecks running work, holds a transition fence, and sends a hidden `session-move-result` continuation.

## 2. Correctness, regressions, architecture, wire contracts
No blocker found.

The prior F3 classes remain closed at their named production sites:

- **non-atomic pending-move admission / scheduler-bypassed exclusive move admission:** `AgentSession.reserveSessionMove()` claims synchronously before `SessionMoveTool.execute()` reaches an await; the tool releases on failures. Search: `reserveSessionMove\(|hasPendingSessionMove\(|setSessionRelocator\(` across the worktree.
- **inconsistent registry scope across D6 checks:** both admission and relocation-time checks call `findRunningSessionWork` with the session registry. Search: `findRunningSessionWork\(` in `packages/coding-agent`.
- **resolved server-side session move misses post-batch stop:** `agent-loop.ts:1687-1737` invokes the hook for normal executable batches and Cursor-resolved calls; replay-tail handling also invokes it (`:1305`).
- **detached fatal-session teardown:** RPC awaits fatal disposal before a result continuation can be sent; ACP and slash-command paths await their corresponding teardown.
- **new natural-language prompt assertions:** move-result tests select structured `customType: "session-move-result"` details. The destination-rule canary is a test-controlled rule-content witness for prompt rebuilding, not a generated prompt wording assertion.

The additive RPC `cwd` field is optional in the wire source and represented in generated TypeScript, Go, Python, and Rust clients, preserving older-server compatibility.

## 3. Security and privacy delta
No security/privacy delta found. The change does not introduce or weaken access to real credentials, authentication/authorization, or third-party personal data.

The worktree-creation path is approval-tiered as `exec` when it can execute a repository `post-checkout` hook. Target containment checks reject ordinary external targets and unsafe worktree-directory path components. The documented symlink replacement race and persistent-process workspace rebinding are accepted residual risks in the pinned gate.

## 4. Verification adequacy
Reviewed the supplied F1 artifacts for all seven scenarios:

- Existing registered worktree relocation and continuation in the destination.
- New worktree/branch creation and destination continuation.
- External-target rejection with unchanged cwd.
- Background-job refusal naming the job.
- Exactly one continuation under a goal.
- ACP continuation on the same session id, with no premature assistant chunk.
- Target-bucket resume visibility and source-bucket removal.

The artifacts report real TUI and ACP source-build execution on `790e675246`, and the brief supplies successful `bun check`, agent-package tests, and coding-agent-package results with the seven failures stated to reproduce on `main`. The automated tests also cover the critical scheduler, bridge, reservation, D6, relocation, goal, host-wiring, and RPC-state seams. I did not execute checks in this read-only audit.

## 5. Final `PASS | FAIL | INCONCLUSIVE`
PASS

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: A failed creating move attempt must relinquish its admission slot, so it cannot prevent a later independent valid move in the same live session.
  positive_witness: An invalid first branch request errors, and a subsequent valid target creates exactly its requested worktree and records its move.
  negative_control: The rejected first call leaves the reservation latched, causing the subsequent valid call to fail as already pending.
  observable: The first result is an error; hasPendingSessionMove() is false afterward; the second call creates its target and records a pending move.
  boundary: SessionMoveTool execution and AgentSession reservation API
END-REVIEW-TRAILER