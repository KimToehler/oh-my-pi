## 1. Goal and behavioural contract

The implementation matches the intended narrow exception:

- Tag-reachable actions remain on the driver; driver failures do not authorize fallback automation.
- Computer use is limited to the app’s dialog and the simulator/emulator host menu. Screen-reader checks remain human steps.
- Configuration, credential-section, background-mode, window-resolution, output-filtering and evidence-attribution restrictions are present.
- D23 explicitly terminates the check after a fixed window-resolution failure, including prohibiting retries through a retained handle.

Reviewed the supplied complete implementation diff, the bound plan’s requirements and decisions, and the base routing requirement.

## 2. Correctness, regressions, architecture, wire contracts

Read all three changed production TypeScript files and both changed test files whole, together with the delivered skill and rules.

The code change is appropriately centralized:

- `EvalPreludeDefinition.statusError` is optional, preserving existing definitions.
- Both thrown prelude failures and error-valued results use the override.
- The original exception or error-valued result still reaches the cell.
- Only the computer definition supplies `"failed"`; ordinary tool handling is unchanged.
- JavaScript and Python both route prelude invocations through `callSessionTool`, so the fix does not introduce competing language-specific behavior.

The split evidence rule has its own rule name and therefore its own once-per-session trigger budget. The added condition patterns are compatible with the repository’s regex compiler.

**Note N1 — diagnostic policy follows the completion-time registry.** At `packages/coding-agent/src/eval/js/tool-bridge.ts:161-162`, the failure policy is looked up from the currently enabled definition, including after the awaited invocation at `:258-260`. If an already-started prelude becomes disabled or is replaced before returning a failure, its original fixed policy can disappear and the bridge falls back to error text. Live prelude availability is supported by `packages/coding-agent/src/eval/preludes.ts:97-100` and `packages/coding-agent/src/session/agent-session.ts:3485-3507`. A robustness improvement would bind failure summarization to the definition that actually executes. This is non-blocking here: the supplied ordinary-session evidence does not es…

No other substantiated correctness or consumer regression was found.

## 3. Security and privacy delta

This changes a guardrail governing automation near real authentication surfaces, so the security delta is material even though the exception itself refuses configured credential-bearing apps.

The changed text preserves the existing login restrictions and adds explicit computer-prelude coverage. Host-window captures and accessibility reads are excluded, avoiding reliance on the current repository’s credential configuration to classify another repository’s shared simulator content.

The status fix addresses the identified persistence seam: catching an exception in the cell previously did not prevent the bridge from recording its full text independently.

The following remain accepted boundaries, not new blockers:

- Authentication through routes absent from the configuration’s `credentials` section.
- Target-owned sheets or overlays captured with the target.
- Capture isolation demonstrated on one macOS version.
- Text-matched instructional rules rather than a hard authorization boundary.

## 4. Verification adequacy

The supplied Q1–Q46 matrix covers the main behavior, refusal paths, adjacent driver routing, rule ordering, retained evidence, flow-lock contention and actual takeover outcomes. The wave-2 reruns address the failure changed by D23; the stated carries are causally reasonable because the intervening delta only changes behavior after a fixed failure message.

The new tests exercise bridge behavior rather than asserting instructional prose. They distinguish thrown failures, error-valued results, unchanged fallback behavior and the real computer prelude over a fake native backend.

I did not execute tests, inspect remote state, change files or dispatch reviewers. The reported **201 passing bridge/computer tests** and **886 passing team-config tests** are supplied QA results, not independently executed results. I did not open retained evidence captures because the active credentials rule prohibits reading evidence this session did not write; behavioral conclusions therefore rely on the supplied matrix and observations.

My additional adversarial criterion targets policy lifetime during an outstanding invocation, described in N1 and recorded below. It was not executed.

## 5. Final assessment

No finding meets the brief’s blocking threshold on the evidence available. N1 remains a bounded, unverified reconfiguration risk; the accepted privacy residuals remain explicit.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-6.1-sol
security_delta: yes
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: Disabling a prelude after its invocation starts must not change the diagnostic-redaction policy of that outstanding invocation.
  positive_witness: A gated invocation starts with a fixed failure policy, availability changes to disabled, and its eventual rejection records the original fixed status while preserving the original exception for the cell.
  negative_control: The same invocation records its sensitive exception text because the completion-time registry no longer exposes its definition.
  observable: Capture emitted status events and the rejected exception around a deterministically gated invocation; this criterion was not executed in this review.
  boundary: Invocation lifetime between prelude authorization and eval-status emission.
END-REVIEW-TRAILER

[Some lines truncated to 768 chars. Use agent://F2W2ImplAudit:raw:26-26 to read line 26 whole]
