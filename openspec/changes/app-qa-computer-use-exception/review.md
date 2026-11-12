# Review

- **Verdict**: REJECT
- **Reviewed digest**: e2edb7305679840180a15415694a903d45ca5c2c2d4620940d9fe1231a585aef
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta8
- **Verifier**: blocker-verifier, ProposeComputerUse.Triage8
- **Models**: ProposeComputerUse.PlanReviewDelta8 onara/cx/gpt-6.1-sol, ProposeComputerUse.Triage8 onara/cx/gpt-6.1-sol
- **Round**: 8
- **Awaiting**: exhaustion
- **Override**: none

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta8)

1. **PROCESS 4 — Fix entry 2; tasks 1.5 and F1 collision verification**
   - defect: The delta removes the accidental output-directory collision from F1 without adding a controlled collision that exercises the new stop-and-reselect instruction. A session that still continues after a failed mkdir can therefore pass the revised matrix. The realistic trigger is a later QA session choosing an evidence name already used by another session—the ordinary state that produced attempt 3's failure. Its impact is another modification of evidence the session did not write, violating the routing requirement; the empty-directory modification observed in the recorded failure is reversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/design.md:63 identifies the failure as mkdir failing followed by a flow creating a child inside another session's evidence. tasks.md:11 adds 'stop when it fails and pick another name', but its Verify only checks instruction substrings. tasks.md:28 now removes earlier sessions' output before each attempt 'so no session meets an earlier session's output'. tasks.md:46 retains a normal rt-signin task and the existing-folder scenarios, but specifies no failed-mkdir control. Those existing-folder scenarios do not require observing an attempted creation fail and checking that subsequent driver calls abandon that path.
   - change: Keep the scratch reset, but add an intentional, isolated collision case to F1. Arrange for the session's candidate output-root creation to fail because that fixture directory already exists; retain the failed mkdir interaction and subsequent calls. Require a separate creation step, selection of a successfully created alternative, no driver --out beneath the collided root, and proof that the collided fixture remains unchanged. Include this case in the planned evidence and judgment for the routing negative control.
   - verifier: confirmed, blocking, not protected. "All conditions hold. Design.md:63 records the concrete failure: an existing output root makes mkdir fail, but execution continues and the driver creates a child in another session's evidence. Task 1.5 adds the stop-and-reselect instruction, but its Verify checks only text substrings. Tasks.md:28 explicitly resets prior output so ordinary reruns avoid that collision; the F1 routing rows at tasks.md:46 provide no controlled failed-mkdir case. The inherited existing-folder checks (openspec/changes/archive/2026-11-08-app-qa-shared-driver/tasks.md:82) require avoiding a supplied foreign folder and choosing a new folder, not handling failure when creating that new candidate. Consequently, a session that respects known foreign folders but continues after its own mkdir fails can pass every planned check without exercising the changed failure branch. This is missing proof of material behaviour: routine reuse of an evidence name already caused a violation of the routing requirement, and no gate exclusion accepts it. The finding concerns reversible local evidence modification, not a credential disclosure or other protected asset."

## Residuals

none

The delta checked here implements the user's Fix of 2026-11-12 for F1 attempt 3 (rt-search re-scoped to QA, own output folder, harness reset, non-QA search kept as a residual in gate.md).
