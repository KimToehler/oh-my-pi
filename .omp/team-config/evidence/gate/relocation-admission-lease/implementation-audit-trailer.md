PASS — no blocking defect substantiated.

1. **Goal and behavioural contract**
   - Traced the barrier from tree membership and ticket lifecycle (`registry/relocation-admission.ts:57-145`), through IRC admission and lifecycle hand-off (`irc/bus.ts:141-214`, `registry/agent-lifecycle.ts:387-461`), to the deferred session-move running-work check and pre-dispatch IRC deferral (`session/agent-session.ts:1458-1631,3370-3441`).
   - The implementation holds same-tree peer delivery and revival until the relocation holder releases, retains FIFO waiter order, and makes pre-hold descendant work visible via `isStreaming`, `hasAdmittedSubmission`, and `hasPostPromptWork` (`session/session-move.ts:109-135`). The root wake race is separately deferred at the ownership check, rather than incorrectly treated as descendant running work.
   - Host acquisition covers the deferred `session_move`, TUI controller, and headless relocation paths (`agent-session.ts:3409`, `modes/controllers/command-controller.ts:1769-1779`, `session/headless-relocation.ts:76-79`). Their `using` lifetimes include flush/refusal, move, rescope, and rollback outcomes.

2. **Correctness, regressions, architecture, wire contracts**
   - No blocker found. The lease implementation centrally owns membership claims, pre-existing ticket draining, nested hold counting, release-before-waiter sequencing, and re-evaluation after another tree obtains a lease. This avoids competing queues or per-surface barrier implementations.
   - The move-target publication and hold-time ID snapshot address the rebasing window: a descendant remains a member both after its ref is repointed and before the root manager publishes its destination (`session-manager.ts:2578-2585`; `agent-session.ts:3370-3388`).
   - Follow-up retries reacquire admission before every prompt/restore hand-off and release after synchronous submission/scheduling (`task/executor.ts:2618-2625,2656-2666,3846-3978`). The warm reviver correctly makes the rebased registry ref authoritative rather than reopening the spawn-time path (`task/executor.ts:4240-4247`).
   - The changed TUI lifecycle interface routes transcript chat through `promptLive`; direct non-turn revive consumers still use `ensureLive`, so the API division remains coherent. No changed public wire shape was identified.
   - I rechecked all production `ensureLive` callers using the repository search: IRC delivery, collaboration revive/chat, TUI focus/chat, RPC steering, and task follow-up are the relevant sites. No missing changed revival entry point was found.
   - Residual non-blocking risk: the F3 report's unconditional admission of explicitly out-of-scope already-live human chat/steer/live-idle-follow-up paths remains a reversible latency expansion. It is covered by the pinned plan's out-of-scope field and is not a blocker for this audit.

3. **Security and privacy delta**
   - No credential, authentication, authorization, PII, persistence-schema, or externally exposed wire-contract delta was introduced. The change only coordinates in-process registry/session activity. `security_delta: no`.

4. **Verification adequacy**
   - Reviewed the supplied evidence rather than rerunning checks: the four real-surface F1 artifacts cover successful TUI relocation, held cross-session ACP delivery to a parked descendant, unaffected other-tree delivery, and refusal while a descendant runs. The supplied automated evidence additionally covers relocated warm revival, retry/reminder ticket generations, registry FIFO/release behavior, pre-barrier work visibility, and TUI/ACP/RPC/headless holder paths.
   - The new tests exercise meaningful timing boundaries with paused real relocation/revival seams rather than merely asserting helper calls. In particular, the parked-child case observes a rebased transcript path, and the F2 regression observes lease readiness independently of a still-running provider turn.
   - Checks were not executed in this read-only audit; the stated `bun check` and suite totals are author-supplied evidence.

5. **Final review disposition**
   - No blocker found. The implementation satisfies the reviewed concurrency-state contract at the admission, relocation, rebasing, and release seams.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: A completed relocation releases its tree lease before scheduling or submitting the hidden result continuation, so a newly arriving peer message is not held behind an unrelated continuation model turn.
  positive_witness: A peer message sent after relocation body completion is admitted immediately while the session-move result continuation may still be pending.
  negative_control: Releasing the lease only after the continuation finishes leaves the peer send pending for the continuation's provider latency.
  observable: The peer send settles before any continuation turn reaches provider dispatch, while its delivery observes the settled session directory.
  boundary: AgentSession relocation finally block and the subsequent session-move-result submission.
END-REVIEW-TRAILER