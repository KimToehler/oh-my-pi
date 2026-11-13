# Review

- **Verdict**: REJECT
- **Reviewed digest**: d769116833b5d672c5032c1c42cfa15c9628077900910c70fbee25a78e4f9c07
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta20
- **Verifier**: blocker-verifier, ProposeComputerUse.Triage20
- **Models**: ProposeComputerUse.PlanReviewDelta20 onara/cx/gpt-6.1-sol, ProposeComputerUse.Triage20 onara/cx/gpt-6.1-sol
- **Round**: 20
- **Awaiting**: exhaustion
- **Override**: none

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta20)

1. **PROCESS 4 — Task 1.7 Verify checks proof text in the wrong section**
   - defect: When task 1.7(d) places the replacement announcement wording and unfocused-app item in “Proving a QA instruction change,” the new Verify loop searches for both strings only inside the earlier computer-use section. An implementation following the task therefore exits with “missing …” before reaching the later proof-section check. This breaks the planned deterministic verification; the damage is reversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:13 defines sec with sed from “Computer use for surfaces the driver cannot reach” through “Signing in on a simulator or emulator,” then adds 'the announcement read from silent captures of the caption panel' and 'while another app is in front' to the loop checking sec. The same task explicitly places those additions in the proof section. The repository confirms the separate boundaries at team-config/agent/skills/app-qa-drivers/SKILL.md:89, :100 and :121, with proof item 1 at :127.
   - change: Keep the computer-use bullet assertions in the sec loop. Check both new proof strings against the extracted “Proving a QA instruction change” section instead, alongside the existing assertion that the old AX-proof wording is absent.
   - triage: confirmed, blocking (ProposeComputerUse.Triage20): Task 1.7 at tasks.md:13 explicitly puts the replacement announcement phrase and the unfocused-app scenario in “Proving a QA instruction change,” but its Verify loop requires both phrases in sec, extracted only from the computer-use heading through the signing-in heading. SKILL.md:89-100 bounds that earlier section; the proof section begins at :121 and its VoiceOver item is at :127. Following the specified edits therefore leaves the first phrase outside sec, causing the loop to exit with “missing the announcement read from silent captures of the caption panel” before the later proof-section assertion. This is a defect in the prescribed verification itself, not merely a request for an alternative check. The normal implementation sequence cannot pass the plan's required deterministic instruction-text proof (tasks.md:3), so it blocks that value proof despite being reversible. No gate residual-risk or out-of-scope entry covers this verification defect.

## Residuals

- Reviewer note (not a blocker), verbatim: Task 1.7 requires stopping a screen reader the session started, but ce-vo-unfocused starts with VoiceOver already running and does not require a cleanup outcome. Add a session-owned-reader variant to verify that branch. This does not block the new focus-refusal proof itself: its no-capture and no-focus-takeover outcomes are explicitly checked.
