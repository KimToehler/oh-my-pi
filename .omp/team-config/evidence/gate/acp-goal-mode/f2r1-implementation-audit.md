## 1. Goal and behavioural contract

Goal selection, command preflight, continuation ownership, Stop/resume, stale-mode handling, and RPC compatibility were reviewed against the supplied contract. One cancellation race violates Stop’s guarantee before the first Goal turn starts.

## 2. Correctness, regressions, architecture, wire contracts

**Blocker — High: cancelled prompt can start after cancellation.**

- **Evidence:** `packages/coding-agent/src/modes/acp/acp-agent.ts:1168-1177` awaits Goal preparation and mode synchronization, then submits `session.prompt()` without rechecking the captured prompt turn. `:1237-1253` marks that turn cancelled, starts abort, and resolves its response. Goal creation/resumption itself has asynchronous waits at `src/goals/host-controller.ts:282-290,310-322`.
- **Failure mode:** Cancel while Goal creation, resume, tool activation, or mode notification is awaiting. Abort can finish before prompt admission. When the suspended path resumes, it still submits the original prompt after the client received `cancelled`; work can run without its owning ACP prompt. Creation or resumption can also finish after abort, leaving Goal active rather than paused.
- **Violated contract:** Stop must end the owning prompt and leave Goal dormant until another user prompt.
- **Fix direction:** Coordinate cancellation with in-flight Goal preparation. Recheck the captured turn after each asynchronous preparation boundary and before admission; ensure cancellation cannot leave a late-created or resumed Goal active. Add gated tests for cancellation during both create and resume, including completion of abort before releasing the gate.
- **class:** post-cancellation prompt admission and Goal-state resurrection.
- **sites:** `acp-agent.ts:1168-1177` is the single new ACP admission site; both create and resume paths reach it through `acp-goal.ts:64-71`. Search: `prepareHostPrompt|createForHostPrompt|resumeForHostPrompt` across `packages`, plus `cancelRequested|prepareHostPrompt|#runPromptOrCommand` across ACP source. Class remains **open** at this site.

F3’s five previously closed classes were not re-derived. RPC boundary conversion and continuation opt-in were reviewed; no separate wire-contract blocker found.

## 3. Security and privacy delta

**Delta: yes.** ACP Goal now persists prompt text as Goal objective in session mode records and enables autonomous continuation by default for ACP. This introduces additional persistence and execution exposure, though no new external recipient was identified. The cancellation blocker also permits unintended post-Stop execution.

## 4. Verification adequacy

Supplied QA covers real IntelliJ objective/completion and Stop during a running turn, plus stdio replay scenarios. `suites-head.txt` reports 443 passing tests and clean checks. These do not cover cancellation while Goal preparation is in flight; the reported Stop test waits for continuation admission first. No checks were run during this read-only review.

## 5. Final verdict

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: Cancellation during asynchronous prompt preparation cannot resurrect work or mutate Goal into an active state after cleanup.
  positive_witness: Hold Goal tool activation, cancel the prompt, finish abort, release activation, and observe no agent submission and no active Goal.
  negative_control: A late preparation completion submits the cancelled prompt or restores an active Goal after abort.
  observable: Prompt admission count, cancelled response ordering, persisted Goal status, and tool activity after the preparation gate opens.
  boundary: ACP session/prompt admission and Goal host preparation.
END-REVIEW-TRAILER