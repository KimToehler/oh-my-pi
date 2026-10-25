1. Goal and behavioural contract

PASS. I traced all three decisions through the supplied diff and current implementation:
- **D1:** ACP-only extension wiring refuses `newSession`, `branch`, and `switchSession` before entering `#goalSessionChange` or touching the session. `navigateTree` and `reload` retain their existing ACP wiring. The extension runner's unchanged command-context types still expose the same return shape, and non-ACP paths do not use the new refusal helper.
- **D2:** `SessionManager.dropSession()` detaches the current persistence target synchronously before its first await. Consequently the existing persistence guards make entries, title updates, close-time `session_exit`, drafts, and ordinary flushes in-memory after a successful deletion. Its non-ENOENT recovery restores the target through the authoritative full rewrite; a concurrently started replacement target is protected by the target-generation check.
- **D3:** successful `/session delete` invokes the optional ACP runtime hook only after `dropSession()` succeeds. Parking removes the record from the normal lookup map synchronously, while the explicit cancel, close, and disposal paths retain their intentionally exceptional access to the parked record. Both surfaces resolve `ForegroundWork.ended` from their terminal foreground handling, so the deferred close starts after the delete turn settles rather than cancelling its confirmation.

2. Correctness, regressions, architecture, wire contracts

No blocker found.

The close lifecycle is centralized: `#parkForClose()` installs one `ClosingSession`, `start()` coalesces concurrent close sources, and `#runClose()` is the sole disposal path. Normal v1/v2 session-addressed routes resolve via `#getSessionRecord()` and therefore reject a parked record exactly as an unissued ID; `_session/steering` separately translates that lookup failure to its established invalid-params wire outcome. `cancel()` intentionally consults `#closing` first, and `closeSession()` starts a pending close, matching the stated exceptions.

For protocol ordering, v1 marks the work ended after resolving/rejecting its prompt promise. v2 clears the foreground, queues terminal `idle`, then marks work ended; the subsequent close drains the per-record ordered emission tail and last transport write before disposal. This preserves the confirmation/end frame path while preventing later normal requests from being admitted.

**Note — non-blocking:** the F3 report's carried `non-atomic session-file/artifact deletion` finding remains in `session-storage.ts` direct-storage deletion: artifact cleanup can fail after JSONL removal. It is not caused by this diff, is already documented as a Should-fix, requires a local cleanup failure, and is locally reversible; it does not meet the supplied blocker threshold.

3. Security and privacy delta

No security or privacy delta found. The reviewed changes do not touch credentials, authentication, authorization, or third-party personal data, and do not weaken access to a protected asset. The new warning logs action/session identifiers rather than transcript content or credentials.

4. Verification adequacy

The supplied real-surface F1 matrix is adequate for the externally observable ACP contract: it records passing v1 and v2 evidence for all three extension refusals, retained navigation/reload behavior, successful-delete confirmation and post-delete rejection, list/file absence, and the headerless-file negative control. `f1-results-main.json` is a discriminating control: only the unchanged navigation/reload guards pass on main.

The focused automated coverage is also appropriately adversarial for the highest-risk internal seams: `acp-session-identity.test.ts` holds the confirmation-delivery window and compares each exposed request route against a never-issued ID, while retaining cancel/close/dispose controls on both surfaces. `drop-current-session.test.ts` exercises real on-disk storage across held writer-close and held deletion windows, recovery after delete/close failure, and concurrent new-session/switch target replacement. The supplied QA matrix records 664 passing targeted tests and the final package check/full-suite comparison. I did not execute commands in this read-only audit; these verification statements are based on the provided matrix and inspected evidence artifacts.

5. Final

PASS

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: A deferred ACP shutdown cannot overtake a terminal foreground frame already admitted to the protocol surface's ordered emission path.
  positive_witness: For a v2 locally handled command, the client receives its prompt response, command output, and terminal idle state before the record is drained and disposed.
  negative_control: A close seals or disposes the record before an already-queued terminal state is written, leaving the client with a successful prompt acknowledgement but no terminal state.
  observable: Ordered v2 frame sequence and successful completion of the close after the terminal frame is written.
  boundary: AcpSurfaceV2 ordered emission queue and AcpAgent deferred close handoff.
END-REVIEW-TRAILER
