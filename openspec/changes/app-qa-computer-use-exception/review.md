# Review

- **Verdict**: REJECT
- **Reviewed digest**: e2edb7305679840180a15415694a903d45ca5c2c2d4620940d9fe1231a585aef
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta8
- **Verifier**: blocker-verifier, none
- **Models**: ProposeComputerUse.PlanReviewDelta8 onara/cx/gpt-6.1-sol
- **Round**: 8
- **Awaiting**: triage
- **Override**: none

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta8)

1. **PROCESS 4 — Fix entry 2; tasks 1.5 and F1 collision verification**
   - defect: The delta removes the accidental output-directory collision from F1 without adding a controlled collision that exercises the new stop-and-reselect instruction. A session that still continues after a failed mkdir can therefore pass the revised matrix. The realistic trigger is a later QA session choosing an evidence name already used by another session—the ordinary state that produced attempt 3's failure. Its impact is another modification of evidence the session did not write, violating the routing requirement; the empty-directory modification observed in the recorded failure is reversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/design.md:63 identifies the failure as mkdir failing followed by a flow creating a child inside another session's evidence. tasks.md:11 adds 'stop when it fails and pick another name', but its Verify only checks instruction substrings. tasks.md:28 now removes earlier sessions' output before each attempt 'so no session meets an earlier session's output'. tasks.md:46 retains a normal rt-signin task and the existing-folder scenarios, but specifies no failed-mkdir control. Those existing-folder scenarios do not require observing an attempted creation fail and checking that subsequent driver calls abandon that path.
   - change: Keep the scratch reset, but add an intentional, isolated collision case to F1. Arrange for the session's candidate output-root creation to fail because that fixture directory already exists; retain the failed mkdir interaction and subsequent calls. Require a separate creation step, selection of a successfully created alternative, no driver --out beneath the collided root, and proof that the collided fixture remains unchanged. Include this case in the planned evidence and judgment for the routing negative control.
   - not triaged: the verifier has not returned

## Residuals

none

The delta checked here implements the user's Fix of 2026-11-12 for F1 attempt 3 (rt-search re-scoped to QA, own output folder, harness reset, non-QA search kept as a residual in gate.md).
