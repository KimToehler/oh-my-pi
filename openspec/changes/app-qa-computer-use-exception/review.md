# Review

- **Verdict**: REJECT
- **Reviewed digest**: e97c0c81cc3a9a9ff1ddc39d9d6ac0db936afbb98a16bb72dbbcd1b2d3e38e4e
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta4
- **Verifier**: blocker-verifier, ProposeComputerUse.VerifierRound4
- **Models**: ProposeComputerUse.PlanReviewDelta4 onara/cx/gpt-6.1-sol; ProposeComputerUse.VerifierRound4 onara/cx/gpt-6.1-sol
- **Round**: 4
- **Awaiting**: exhaustion
- **Override**: none

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta4)

1. **PROCESS 4 — Window-isolation proof remains non-discriminating**
   - defect: The overlap control permits a zoomed capture without requiring the captured rectangle to include the overlapping marker’s position. During ordinary execution, the session can zoom another part of the target window; the marker is then absent even if capture incorrectly samples composited screen pixels. The row can pass without establishing D5’s promised isolation property. This leaves the material boundary proof incomplete; it is not evidence that the prelude actually leaks pixels.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:35 places the marker over only 'part of the target app window', permits a capture '(zoomed or silent, as the skill prescribes)', and fails the row only if the marker appears. No condition ties the captured region to the overlap. packages/coding-agent/src/prompts/tools/computer.md:17,151 documents zoom as a rectangular region. design.md:35 and gate.md:8 nevertheless rely on ce-overlap as the F1 proof of other-window exclusion.
   - change: Require a successful full-target capture, or require the captured region to include a recorded overlap region. Establish that the separate marker window is visibly overlapping that region at capture time, retain the exact inspected capture and credential-free observation, and reject missing, wrong-target or non-covering captures rather than treating marker absence alone as success.
   - verifier: confirmed, blocking true, protected true; reason: tasks.md:35 explicitly permits a zoomed capture while placing the marker over only part of the target window. computer.md:17,151 confirms zoom selects a rectangle; an ordinary zoom of a different part therefore excludes the marker even if the capture samples composited pixels. The row requires neither coverage of the overlap nor an independent observation establishing that coverage, and its stated failure condition is marker appearance. D8 (design.md:53) adds inspection but no coverage check. Consequently the planned executed check does not discriminate the named failure. This is a missing material proof of the other-window exclusion boundary that design.md:35 and gate.md:8 expressly assign to ce-overlap, not a claim that the prelude leaks or a demand to guarantee other macOS versions.

2. **PROCESS 4 — New F1 row contradicts the routing negative control**
   - defect: The new row asks the session under test to capture the target app window through computer. A compliant session should instead use the driver for this supported app-window capture. Following the new row therefore requires behavior that the unchanged specification explicitly declares a failure; following the routing requirement prevents obtaining the row’s required prelude result. This is a reversible verification-design defect, but it breaks normal execution of the required value proof.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:24 establishes the scratch weaver :shell app as the session target, and tasks.md:35 asks the session for a prelude capture of 'the target app window'. specs/app-qa-driver/spec.md:66-67 explicitly makes computer use for 'a capture of the app window the driver offers' fail the requirement. The existing driver does offer desktop capture, as documented in team-config/agent/skills/app-qa-drivers/SKILL.md:29. design.md:53 repeats the instruction that the session takes the overlap capture.
   - change: Separate the capture-implementation isolation probe from the fresh session’s routing behavior: have the QA lane invoke the actual prelude against the disposable fixture directly, or use a clearly named permitted screen-reader/dialog target that the driver cannot capture. Update D8 and the row consistently so successful isolation verification does not require a session to violate the routing negative control.
   - verifier: confirmed, blocking true, protected false; reason: tasks.md:24 establishes the scratch weaver :shell app as the session target; tasks.md:35 explicitly asks that session for a prelude capture of the target app window, and design.md:53 likewise says the session takes the overlap capture. The routing negative control at specs/app-qa-driver/spec.md:66-67 explicitly fails computer use for an app-window capture offered by the driver, while team-config/agent/skills/app-qa-drivers/SKILL.md:29 supplies desktop capture. Thus the ordinary required overlap run cannot both obtain its specified session-generated prelude capture and satisfy routing. The QA lane's inspection/retention role does not change who is instructed to execute that capture. This is a contradiction in the delivered verification design, so other checks detecting the violation do not resolve it; it blocks execution of the required value proof.

## Residuals

none

Round 3's findings were fixed by the delta this round checked (second exhaustion answer Fix, user Tim 2026-11-12).
