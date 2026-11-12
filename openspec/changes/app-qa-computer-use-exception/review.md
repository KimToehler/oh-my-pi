# Review

- **Verdict**: REJECT
- **Reviewed digest**: 658157d26278ed40981c67baee7ef46df7fd0d03a398ae1aa963b132b08f15f7
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta3
- **Verifier**: blocker-verifier, none
- **Models**: ProposeComputerUse.PlanReviewDelta3 onara/cx/gpt-6.1-sol
- **Round**: 3
- **Awaiting**: triage
- **Override**: none

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta3)

1. **PROCESS 4 — Window-isolation proof remains non-discriminating**
   - defect: The overlap control permits a zoomed capture without requiring the captured rectangle to include the overlapping marker’s position. During ordinary execution, the session can zoom another part of the target window; the marker is then absent even if capture incorrectly samples composited screen pixels. The row can pass without establishing D5’s promised isolation property. This leaves the material boundary proof incomplete; it is not evidence that the prelude actually leaks pixels.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:35 places the marker over only 'part of the target app window', permits a capture '(zoomed or silent, as the skill prescribes)', and fails the row only if the marker appears. No condition ties the captured region to the overlap. packages/coding-agent/src/prompts/tools/computer.md:17,151 documents zoom as a rectangular region. design.md:35 and gate.md:8 nevertheless rely on ce-overlap as the F1 proof of other-window exclusion.
   - change: Require a successful full-target capture, or require the captured region to include a recorded overlap region. Establish that the separate marker window is visibly overlapping that region at capture time, retain the exact inspected capture and credential-free observation, and reject missing, wrong-target or non-covering captures rather than treating marker absence alone as success.
   - not triaged: the verifier has not returned

2. **PROCESS 4 — New F1 row contradicts the routing negative control**
   - defect: The new row asks the session under test to capture the target app window through computer. A compliant session should instead use the driver for this supported app-window capture. Following the new row therefore requires behavior that the unchanged specification explicitly declares a failure; following the routing requirement prevents obtaining the row’s required prelude result. This is a reversible verification-design defect, but it breaks normal execution of the required value proof.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:24 establishes the scratch weaver :shell app as the session target, and tasks.md:35 asks the session for a prelude capture of 'the target app window'. specs/app-qa-driver/spec.md:66-67 explicitly makes computer use for 'a capture of the app window the driver offers' fail the requirement. The existing driver does offer desktop capture, as documented in team-config/agent/skills/app-qa-drivers/SKILL.md:29. design.md:53 repeats the instruction that the session takes the overlap capture.
   - change: Separate the capture-implementation isolation probe from the fresh session’s routing behavior: have the QA lane invoke the actual prelude against the disposable fixture directly, or use a clearly named permitted screen-reader/dialog target that the driver cannot capture. Update D8 and the row consistently so successful isolation verification does not require a session to violate the routing negative control.
   - not triaged: the verifier has not returned

## Residuals

none

Round 2's findings were fixed by the delta this round checked (exhaustion answer Fix, user Tim 2026-11-12, scope: computer use only for apps whose configuration has no credentials section, one target window, no display or other-app capture).
