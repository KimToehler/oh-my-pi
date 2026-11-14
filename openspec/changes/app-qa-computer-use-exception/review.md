# Review

- **Verdict**: REJECT
- **Reviewed digest**: e762345bf22a201780fab34165de8f982b325f1a342d1082cd83b11c4b8b7f19
- **Depth**: risky
- **Reviewer**: plan-reviewer, ComputerUsePlanReviewDelta30
- **Verifier**: blocker-verifier, ComputerUseTriageR30
- **Models**: ComputerUsePlanReviewDelta30 onara/cx/gpt-6.1-sol, ComputerUseTriageR30 onara/cx/gpt-6.1-sol
- **Round**: 30
- **Awaiting**: exhaustion
- **Override**: none

## Blockers

The delta check reviews design D22 (F1 attempt 13), whose fixes the user, Tim, chose on 2026-11-14: "Fix all three, ce-window-miss via the omp code change".

### Delta check (ComputerUsePlanReviewDelta30)

1. **PROCESS 4 — task 3.2 / D22(c): incomplete fix**
   - defect: When the disappearing-dialog run reaches the required catch, the planned bridge still records a computer error message, only shortened. This removes the other-app title listing but does not satisfy the requirement that no computer error message appear in the raw stream, so D22(c)'s claim that the unchanged row becomes reachable is false.
   - evidence: design.md:140 retains the first line (`no window matches "ID"`) and says the row is unchanged; tasks.md:44 requires that implementation, whereas tasks.md:56 requires run 2's raw JSONL to hold "no `computer` error message at all"; the same prohibition is in specs/app-qa-driver/spec.md:139-141 and design.md:127; packages/coding-agent/src/tools/computer/worker.ts:1937-1938 builds that first line as part of the thrown error.
   - change: Make the recorded status satisfy the no-error-message requirement, or revise the raw-stream contract consistently (spec, D21(a), ce-window-miss row, skill proof procedure) to permit a bounded first-line summary while prohibiting other-app titles and listings; add a regression assertion against the chosen contract.
   - triage: confirmed, blocking true, protected true: tasks.md:44 and design.md:140 retain the error's first line in `statusEvents[].error`, while tasks.md:56, spec.md:139-141 and design.md:127 forbid any `computer` error message in run 2's raw stream; a dialog closing between resolution and a later guarded call reproduces it. Protected because it concerns the boundary keeping other apps' window titles out of retained raw output.

## Residuals

none (the reviewer's notes: tasks 1.18 and 1.19 name text present in the skill and their Verify commands fail before and pass after the edits; task 1.19 matches the driver requirement that forbids removing another run's lock; separate regression cases for a thrown error and a failed result are recommended; proposal.md's Consumers bullet is too narrow now that browser and other prelude error statuses change too.)
