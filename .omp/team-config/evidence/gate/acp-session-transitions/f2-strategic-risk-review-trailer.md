Bottom line: The change holds up architecturally: ACP-specific refusal remains at the ACP adapter, persistence ownership remains in `SessionManager`, and slash-command code only exposes an optional host lifecycle hook. I found no blocking defect; the highest-impact risk—silent transcript loss after deleting or failing to delete the active file—is directly addressed and adversarially covered in the supplied QA matrix.

Action plan / answers:

1. **Architecture:** The boundaries are appropriate. `AcpAgent.#configureExtensions` owns the ACP-only transcript-replacement policy; `BUILTIN_SESSION_SLASH_COMMANDS` signals successful deletion through `SlashCommandRuntime.endSessionAfterTurn`; `AcpAgent.#parkForClose`, `#endSessionAfterTurn`, and `#runClose` own protocol admission and shutdown; and `SessionManager.dropSession`, `#detachSessionFile`, and `#reattachSessionFile` own persistence integrity. The optional hook preserves existing TUI/RPC/print behavior rather than pushing ACP semantics into shared storage or extension APIs.

2. **What a line-level audit structurally misses:** The core correctness property is a distributed state machine, not any individual branch: after deletion, the record must be absent from `#sessions`, temporarily reachable through `#closing` only for output/cancel/close/dispose, and disposed only after `ForegroundWork.ended` is marked by `AcpSurfaceV1.onForegroundEnd` or `AcpSurfaceV2.onForegroundEnd`. The supplied Q9 coverage exercises that admission boundary. Likewise, current-file deletion is a transaction across synchronous detachment, writer drain, storage deletion, authoritative recovery, target-generation arbitration, and session-claim release; Q11 targets those cross-method races rather than merely testing the happy path.

3. **Worst production failure:** Silent loss or malformed recreation of a user's transcript in every mode would hurt most. The change addresses it by detaching only when the resolved deletion path is the current file, doing so before the first await, restoring failed deletion/close operations through `#authoritativelyRewriteCurrentStateLocked`, and preventing recovery from overwriting a replacement target that has started. The supplied Q11 results cover held writer close, held unlink, failed close/delete, concurrent `newSession`, and an in-flight `setSessionFile`; Q7 supplies the real-surface header check. The explicitly accepted overlap residual in `gate.md` remains narrower and does not overturn that result.

4. **Auditor false positives:** None. The implementation auditor's non-atomic session-file/artifact deletion note is a real pre-existing property of direct storage deletion, but the diff neither introduces nor broadens it; its non-blocking classification is therefore correct rather than a false positive.

Effort: Quick (<1h); no remediation is indicated by this review.

Confidence: medium — conclusions are grounded in the complete supplied diff, plan, QA matrix, and audit report, but the assignment intentionally prohibited inspecting unchanged helper implementations and omitted evidence artifacts.

Watch out for:
- Note N1: The accepted failed-delete/concurrent-target residual does not block because it requires overlapping failure paths and is explicitly recorded in `gate.md`; it should remain visible if persistence serialization is redesigned.
- Note N2: Removing the ACP Goal-mode transcript-swap tests is correct for the now-unreachable public path, but it removes direct regression protection for the defensive branches in `AcpGoalActor.#syncTranscript` and `endSessionChange`; any future ACP session-replacement wire feature must restore equivalent tests before enabling that path.
- Note N3: The non-atomic artifact cleanup observation does not block because it is unchanged behavior, requires a local cleanup failure, and is outside this change's session-file recreation contract.

PASS

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: A parked ACP record has exactly one close owner even when turn settlement, `session/close`, and agent disposal race.
  positive_witness: Every close initiator converges on the same `ClosingSession.start()` promise, the already-admitted terminal frame is emitted once, and the record is disposed once.
  negative_control: Concurrent close initiators cause double disposal, omit the terminal frame, or leave the record parked after all close promises settle.
  observable: Ordered terminal frames, close-promise settlement, disposal-call count, and rejection of a post-close request as an unknown session.
  boundary: `AcpAgent` closing-map lifecycle through `ClosingSession.start`/`#runClose` and the v1/v2 surface drain boundary.
END-REVIEW-TRAILER
