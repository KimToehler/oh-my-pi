# Review

- **Verdict**: REJECT
- **Reviewed digest**: c7a85d4033a1fe50d0b7597a5f63cdd1856fd16784109bbbc6df7bac1548c0cf
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta9
- **Verifier**: blocker-verifier, ProposeComputerUse.Triage9
- **Models**: ProposeComputerUse.PlanReviewDelta9 onara/cx/gpt-6.1-sol, ProposeComputerUse.Triage9 onara/cx/gpt-6.1-sol
- **Round**: 9
- **Awaiting**: exhaustion
- **Override**: none

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta9)

1. **PROCESS 4 — Fix entry 1; F1 rt-collide**
   - defect: The collision row can pass without exercising recovery after mkdir fails. A session can check that the candidate exists, create an alternative, and finish successfully, while its behaviour after an actual failed mkdir remains untested. The realistic trigger remains an ordinary later session encountering an occupied output name and continuing after failed creation; it can modify another session's evidence, as the recorded failure already demonstrated. The recorded empty-directory modification is reversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:46 accepts the candidate mkdir failing “(or a check in its own step finding it present)”; specs/app-qa-driver/spec.md:38 contains the same alternative. Thus the mandatory retained interaction can contain no failed mkdir. This contradicts design.md:63's requirement that the session “must show the failed `mkdir`” and the assigned fix entry's explicit requirement to retain the failed mkdir interaction and subsequent calls.
   - change: Require an observed failed standalone mkdir in the F1 collision regression, followed by successful standalone creation of an alternative, subsequent driver output only beneath that alternative, and an unchanged collided fixture. Arrange the task or add a distinct collision subcase so an existence-check-only run cannot satisfy this regression. The delivered behaviour may still permit a safe existence pre-check, but that branch must not replace verification of the failure-recovery branch.
   - verifier: confirmed, blocking, not protected. "The concrete bypass is supported: tasks.md:46 permits an existence check instead of a failed mkdir, as does specs/app-qa-driver/spec.md:38. A session can therefore pass rt-collide by detecting the fixture before attempting creation, successfully creating an alternative and leaving the fixture unchanged, without exercising failure recovery. design.md:63 explicitly requires showing the failed mkdir and records the ordinary occupied-name failure that this regression must cover. Task 1.5 checks instruction text, not recovery execution; task 4.1 judges the permissive F1 row and checks evidence presence and scans, so these checks do not require the missing branch. This is a material missing regression proof for D11, not an accepted residual in gate.md. Blocking is warranted by the missing value proof; the finding concerns reversible modification of nonsecret scratch evidence, not a protected asset."

## Residuals

none

The delta checked here implements the user's Fix of 2026-11-12 answering round 8's exhaustion ask ("Fix: add the rt-collide row and the D11 wording, then one more delta check and the full F1 run").
