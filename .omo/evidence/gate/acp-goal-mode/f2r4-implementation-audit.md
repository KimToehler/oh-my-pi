## 1. Goal and behavioural contract

Reviewed Goal selection and arming, registered-command routing, prompt-owned continuations, Stop/resume, mode synchronization, and reattachment against the supplied contract. No blocker found.

## 2. Correctness, regressions, architecture, wire contracts

The prior F2 code classes are closed at their identified sites:

- **Post-cancellation admission and Goal-state resurrection:** create and resume share the cancellation check and compensating pause in `acp-agent.ts:1257-1274` and `acp-goal.ts:90-115`.
- **Preparation crossing prompt boundaries:** the next queued prompt waits for `goalPreparation` at `acp-agent.ts:984-989`.
- **Stale entry after an explicit mode exit:** selection, leave, and prompt preparation share the operation chain in `acp-goal.ts:45-108`.

I searched the coding-agent source for `prepareHostPrompt`, `pauseAfterCancelledPrompt`, `createForHostPrompt`, `resumeForHostPrompt`, `goalPreparation`, and the adapter’s `select` and `leave` calls. Gated tests cover cancellation during create and resume, follow-up prompts, and explicit mode changes. I reviewed the F3 round-4 report and did not re-derive its five closed classes.

The RPC boundary retains `op`, `objective`, and `token_budget`, with translation confined to `rpc-goal.ts:7-19`; RPC continuation remains opt-in in `goals/settings.ts:27-37`. No separate wire-contract blocker found.

## 3. Security and privacy delta

**Delta: yes.** ACP objective text is now persisted as Goal state, and ACP Goal continuation is enabled by default. I found no new external recipient or security blocker in the reviewed changes.

## 4. Verification adequacy

The supplied final-code-head matrix reports 467 passing tests and clean checks. The recorded IntelliJ run stopped during the first objective turn, not a continuation. The user’s untraced IntelliJ continuation-Stop attestation is explicitly accepted as a residual risk in the plan; stdio evidence and gated tests cover the server-side behavior. It therefore does not block this gate.

This was a read-only audit: I did not run tests or manual QA.

## 5. Final verdict

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: yes
verdict: PASS
adversarial_criteria:
- invariant: An explicitly configured continuation-mode list that excludes ACP prevents automatic ACP Goal continuation without disabling the initial objective turn.
  positive_witness: With goal.continuationModes set to interactive only, selecting Goal and submitting an objective runs the objective turn but admits no automatic ACP continuation.
  negative_control: An ACP continuation starts despite ACP being absent from the configured list, or the objective turn itself is rejected solely because ACP continuation is disabled.
  observable: The objective user turn and continuation admission count under the explicit settings.
  boundary: ACP prompt lifecycle through the shared Goal host continuation gate.
END-REVIEW-TRAILER