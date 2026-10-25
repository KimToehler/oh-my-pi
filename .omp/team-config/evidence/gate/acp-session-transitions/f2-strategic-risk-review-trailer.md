Bottom line: The change holds up architecturally: ACP-specific refusal stays at the ACP adapter, deletion durability is enforced in `SessionManager`, and host-session termination is exposed through an optional slash-runtime hook rather than leaking ACP policy into shared commands. I found no substantiated blocker; the highest-impact risk—silent transcript loss or recreation of a deleted transcript—is directly addressed and adversarially exercised.

## 1. Architectural fit

Yes. The responsibilities are placed at the narrowest existing boundaries:

- ACP transcript replacement is refused in `AcpAgent.#configureExtensions` through `#refuseTranscriptReplacement` (`packages/coding-agent/src/modes/acp/acp-agent.ts`), while `navigateTree` and `reload` retain their existing same-session path. This avoids changing TUI, RPC, print, or `AgentSession` semantics.
- The no-recreation invariant is centralized in `SessionManager.dropSession`, `#detachSessionFile`, and `#reattachSessionFile` (`packages/coding-agent/src/session/session-manager.ts`), so late title, exit, and append writers cannot each forget a separate “deleted” flag.
- ACP teardown is centralized in `ClosingSession.start`, `#parkForClose`, `#runClose`, and `#endSessionAfterTurn` (`packages/coding-agent/src/modes/acp/acp-agent.ts`). The optional `SlashCommandRuntime.endSessionAfterTurn` hook (`packages/coding-agent/src/slash-commands/types.ts`) leaves non-ACP hosts unchanged.
- The merged fatal-relocation behavior correctly reuses that same close path from `#relocateSession` and `relocateWithRuntime` rather than creating a second ACP-record cleanup protocol.

## 2. What the line-level audit structurally misses

The main structural dependency is a three-party lifecycle handshake: the builtin parks the record, `AcpAgent` owns the close latch, and the active protocol surface must resolve `ForegroundWork.ended`. Current v1 and v2 implementations both call `markEnded` (`acp-surface-v1.ts` and `acp-surface-v2.ts`), but the type system does not ensure that every future terminal path or protocol surface does so. A missed settlement would leave a deleted session correctly unaddressable but parked and undisposed until explicit close or agent disposal.

A second structural edge is that `SessionManager.#targetGeneration` records that `newSession` or `setSessionFile` *started*, not that a replacement target was successfully installed. [INFERENCE] If a failed current-file deletion overlaps a `setSessionFile` that starts and then itself rejects before installing a target, `#reattachSessionFile` appears to skip restoration solely because the generation changed. This is not a blocker under the supplied threshold: it requires two overlapping failure paths, no ordinary admitted flow producing that overlap is established in the supplied material, the damage is local/reversible, and nearby unsynchronized restoration overlap is an accepted residual risk. It is nevertheless the most valuable missing adversarial regression.

## 3. Highest-impact production failure

The worst credible failure is silent transcript loss across every mode: detaching the wrong persistence target, or failing to republish the complete in-memory transcript after deletion or writer-close failure. That is addressed by:

- matching the requested deletion against the current file before detachment;
- detaching before the first `await`, closing the pre-existing writer, and preventing hot-path appends from reopening the old path;
- authoritative full-state rewrite on failure;
- preserving a concurrently selected replacement target with `#targetGeneration`;
- real-storage race tests in `test/session-manager/drop-current-session.test.ts`, including held unlink, held writer close, close failure, failed deletion, `newSession`, and in-flight `setSessionFile` cases.

The QA matrix’s Q7/Q11 negative controls and the real ACP runs provide evidence at both the persistence boundary and the user-facing protocol boundary. The remaining accepted serialization residual does not overturn that conclusion.

## 4. Auditor findings versus unchanged behavior

No auditor finding is a false positive. The implementation audit’s repeated-`session/close` item is explicitly a coverage-strengthening note, not a claimed defect; the shown `ClosingSession.start` latch structurally shares one `#runClose` promise. Its mention of non-atomic session-file/artifact deletion is also correctly classified as pre-existing storage behavior rather than a change-caused blocker.

## Notes

- Note N1: A started-but-failed concurrent `setSessionFile` may suppress failed-delete restoration through `#targetGeneration`; it does not block because the supplied system flow does not establish this double-failure overlap as ordinary operation and the accepted residual already acknowledges unsynchronized target restoration.
- Note N2: Close liveness depends on every ACP surface resolving `ForegroundWork.ended`; it does not block because both current surfaces visibly resolve it on success and error, and close/dispose retain escape paths.
- Note N3: `/session delete` still tells every ACP client to use `session/load`, while the new test states protocol v2 exposes `session/resume` instead; this is unchanged, reversible guidance text and does not break the implemented deletion contract.

## Action plan

1. Proceed without a strategic blocking fix.
2. Add a focused regression where failed `dropSession(current)` overlaps a `setSessionFile` that also rejects; assert the chosen recovery semantics through `getSessionFile()`, a subsequent `flush()`, and complete on-disk entries.
3. Add a lifecycle conformance test that every v1/v2 foreground terminal outcome resolves `ended` and eventually removes a parked record from `#closing`.
4. Make the deletion confirmation protocol-neutral (“start or resume another session”) or select the valid v1/v2 method.

Effort: Short (1–4h) for the optional hardening; no blocking implementation work.

Confidence: high.

PASS

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: A replacement-target operation that starts but fails to install a target must not by itself suppress recovery of the original persistence target after current-file deletion also fails.
  positive_witness: A failed delete overlapping a rejected `setSessionFile` leaves the manager on the original session, and a later append plus flush produces one complete header and every pre-existing and later entry.
  negative_control: The attempted switch increments the generation, restoration is skipped, `getSessionFile()` remains undefined, and the later append is retained only in memory; this MUST fail.
  observable: Both operation errors, `getSessionFile()`, old-path existence, parsed header count, and message contents after a successful flush.
  boundary: `SessionManager.dropSession` / `#reattachSessionFile` target-generation handoff.
END-REVIEW-TRAILER
