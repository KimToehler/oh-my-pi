# Review

- **Verdict**: REJECT
- **Reviewed digest**: c7a85d4033a1fe50d0b7597a5f63cdd1856fd16784109bbbc6df7bac1548c0cf
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta9
- **Verifier**: blocker-verifier, none
- **Models**: ProposeComputerUse.PlanReviewDelta9 onara/cx/gpt-6.1-sol
- **Round**: 9
- **Awaiting**: triage
- **Override**: none

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta9)

1. **PROCESS 4 — Fix entry 1; F1 rt-collide**
   - defect: The collision row can pass without exercising recovery after mkdir fails. A session can check that the candidate exists, create an alternative, and finish successfully, while its behaviour after an actual failed mkdir remains untested. The realistic trigger remains an ordinary later session encountering an occupied output name and continuing after failed creation; it can modify another session's evidence, as the recorded failure already demonstrated. The recorded empty-directory modification is reversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:46 accepts the candidate mkdir failing “(or a check in its own step finding it present)”; specs/app-qa-driver/spec.md:38 contains the same alternative. Thus the mandatory retained interaction can contain no failed mkdir. This contradicts design.md:63's requirement that the session “must show the failed `mkdir`” and the assigned fix entry's explicit requirement to retain the failed mkdir interaction and subsequent calls.
   - change: Require an observed failed standalone mkdir in the F1 collision regression, followed by successful standalone creation of an alternative, subsequent driver output only beneath that alternative, and an unchanged collided fixture. Arrange the task or add a distinct collision subcase so an existence-check-only run cannot satisfy this regression. The delivered behaviour may still permit a safe existence pre-check, but that branch must not replace verification of the failure-recovery branch.
   - not triaged: the verifier has not returned

## Residuals

none

The delta checked here implements the user's Fix of 2026-11-12 answering round 8's exhaustion ask ("Fix: add the rt-collide row and the D11 wording, then one more delta check and the full F1 run").
