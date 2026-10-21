## 1. Goal and behavioural contract

Reviewed Goal arming and command routing, continuation ownership, Stop/resume, mode synchronization, session reattachment, and the RPC boundary against the supplied contract.

## 2. Correctness, regressions, architecture, wire contracts

The two F2 cancellation and mode-transition classes are closed at their previously identified sites:

- **Post-cancellation prompt admission and Goal-state resurrection:** create and resume share the cancellation check and compensation in `acp-agent.ts:1257-1274` and `acp-goal.ts:90-108`; gated tests cover both.
- **Post-cancellation preparation crossing prompt boundaries:** the next queued prompt waits for `goalPreparation` at `acp-agent.ts:984-989`; create and resume tests send the next prompt before releasing the held preparation.
- **Stale Goal-entry commit after explicit mode exit:** ACP selection, leave, and preparation run on the same operation chain at `acp-goal.ts:45-75,90-108`; gated tests cover Default during creation and Plan during resume.

I searched the coding-agent source for `prepareHostPrompt`, `pauseAfterCancelledPrompt`, `createForHostPrompt`, `resumeForHostPrompt`, `goalPreparation`, and the Goal `leave`/`select` calls to identify these sites. I did not re-derive the five classes already closed by F3. No separate RPC wire-contract blocker found.

## 3. Security and privacy delta

**Delta: yes.** ACP now persists objective text as Goal state and enables ACP autonomous continuation by default. I found no new external recipient.

## 4. Verification adequacy

**Blocker — Medium: the required final-head IntelliJ Stop-during-continuation scenario remains unverified.**

- **Evidence:** The plan explicitly requires pressing Stop **during a continuation in IntelliJ** at `.omo/plans/ACP_GOAL_MODE_PLAN.md:122-124`. The final-head IDE run stopped during the objective’s first turn; `.omo/evidence/acp-goal-mode/qa-matrix.md:6-8,15-16` states that continuation cancellation was exercised over stdio with IntelliJ identity, not in the IDE.
- **Failure mode:** The stdio test supports the server-side lifecycle, but does not establish that the real IDE keeps Stop available and correctly handles cancellation and resumption during a continuation. The plan marks F1 complete despite this missing real-surface scenario.
- **Fix direction:** On the final code head, run the specified scenario in IntelliJ: cancel during an actual Goal continuation, verify no autonomous output after Stop, then resume the same objective. Record the real-surface evidence and update the matrix.
- **class:** stale or surrogate manual evidence for required final-head GUI scenarios.
- **sites:** The single feature QA matrix is `.omo/evidence/acp-goal-mode/qa-matrix.md:6-8,15-16`; the corresponding plan requirement and completion claim are `.omo/plans/ACP_GOAL_MODE_PLAN.md:122-124,146`. I searched the plan and evidence tree for `press Stop during a continuation`, `Manual QA`, and `stale or surrogate manual`. The prior class is **partially closed**: final-head IntelliJ evidence now exists for the other reported scenarios, but this required site remains open.

The supplied suite artifact reports 467 passing tests and clean checks. I ran no tests or manual QA in this read-only audit.

## 5. Final verdict

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A registered file prompt template submitted while Goal is armed can run without consuming the pending objective.
  positive_witness: Select Goal, submit a registered file template, then submit ordinary text; only the ordinary text becomes the persisted objective.
  negative_control: The template invocation or its expanded text becomes the objective, or the subsequent ordinary prompt fails to create one.
  observable: Persisted Goal objective and user-turn sequence after both prompts.
  boundary: ACP prompt routing through AgentSession file-template expansion.
END-REVIEW-TRAILER