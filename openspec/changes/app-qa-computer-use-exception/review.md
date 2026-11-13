# Review

- **Verdict**: REJECT
- **Reviewed digest**: 32139a6d82bd499ab592a3bf49cc964103cfecca7e99d3563fc7c92692845a17
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta19Retry
- **Verifier**: blocker-verifier, none
- **Models**: ProposeComputerUse.PlanReviewDelta19 onara/cx/gpt-6.1-sol (no verdict), ProposeComputerUse.PlanReviewDelta19Retry onara/cx/gpt-6.1-sol
- **Round**: 19
- **Awaiting**: triage
- **Override**: none (this delta check reviews the fix of F1 attempt 10 that the user, Tim, authorized on 2026-11-13: "Fix all, then delta check and attempt 11")

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta19Retry)

1. **PROCESS 4 — VoiceOver proof contradicts the screenshot-only fix**
   - defect: A session following task 1.7 cannot satisfy the existing ce-voiceover criterion: the caption panel must now be read only through screenshots, but F1 still requires printed AX lines. Attempting AX to satisfy that criterion reproduces the reported AxFailed failure; omitting AX leaves the criterion unmet. This blocks the planned successful rerun and is reversible by correcting the proof instructions.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:13 requires screenshot/zoom-only caption-panel reads and says every other skill line stays; tasks.md:37 still requires “filtered AX lines printed.” design.md:53 repeats that affirmative requirement. The preserved delivered proof text at team-config/agent/skills/app-qa-drivers/SKILL.md:127 likewise specifies filtered accessibility lines. design.md:83 records that the panel exposes no accessibility tree.
   - change: Update ce-voiceover, design D8 and the skill's proof item together to require the relevant announcement observed from the permitted caption-panel capture, without requiring an AX read. Keep the prohibition on whole-tree output and unfiltered observation.
   - triage: not triaged: the verifier has not returned
2. **CHECK 4 — Task 1.7 focus-safety decision lacks a negative control**
   - defect: All planned VoiceOver rows now receive the app already in front, so they cannot expose a session that ignores the new focused:true decision, captures another app's announcement, or takes over focus instead of stopping. Another app retaining or gaining focus is ordinary desktop use and was the actual attempt-10 failure state. The missing proof concerns a boundary that can disclose credentials or personal text into an irreversible transcript, not merely an untested convenience branch.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:13 introduces the decision and its refusal/cleanup branch. tasks.md:33 makes bringing the app forward part of the VoiceOver setup; the F1 rows at tasks.md:37-54 provide no unfocused or missing-target control. design.md:83 explicitly records that the previous run captured another app's focused text and then called raise().
   - change: Add a disposable, synthetic VoiceOver negative-control row with the target app absent from the focused results or focused:false. Require no caption-panel capture, no raise/takeover/control acquisition/activating open, a report explaining that the app must be in front, and stopping VoiceOver when that session started it. Retain the relevant call outcomes and report; do not use real sensitive text.
   - triage: not triaged: the verifier has not returned
3. **PROCESS 4 — Task 2.1 Verify retains the old condition count**
   - defect: After task 2.7 correctly adds the ninth condition, task 2.1's Verify necessarily fails because it still requires exactly eight conditions. The delta updates the surrounding claim and the other count checks to nine but misses this executable assertion. This makes the planned deterministic verification fail on the intended final artifact; the damage is reversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:17 says “the counts below are nine” but its Verify still contains `grep -c "^  - '" $f | grep -q '^8$'`. tasks.md:23 adds the ninth condition and verifies `c.length!==9`.
   - change: Change task 2.1's condition-count assertion to nine so it agrees with task 2.7 and the updated checks in tasks 2.2-2.4.
   - triage: not triaged: the verifier has not returned

## Residuals

none
