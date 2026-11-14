# Review

- **Verdict**: REJECT
- **Reviewed digest**: 03980045a4b108783236cde84700e25fb87a3271ae41b7f63215d8cc6f2a7b99
- **Depth**: risky
- **Reviewer**: plan-reviewer, ComputerUsePlanReviewDelta28
- **Verifier**: blocker-verifier, ComputerUseTriageR28
- **Models**: ComputerUsePlanReviewDelta28 onara/cx/gpt-6.1-sol, ComputerUseTriageR28 onara/cx/gpt-6.1-sol
- **Round**: 28
- **Awaiting**: none
- **Override**: none (round 28 exhaustion ask answered Fix by the user, Tim, 2026-11-14: "Fix")

## Blockers

The delta check reviews the fix of round 27's finding 1, answered Fix by the user, Tim, on 2026-11-14 ("Fix").

### Delta check (ComputerUsePlanReviewDelta28)

1. **PROCESS 4 — Task 1.17(e): takeover proof verdict**
   - defect: The staged-mismatch run now makes the takeover outcome reachable, but the task preserves a rule that fails every session producing that outcome. Following the delivered procedure therefore gives contradictory verdicts for a session that witnesses takeover, immediately stops computer use and reports the setting correctly. This breaks the later instruction-change proof consumer; the defect is reversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:23 requires kind 13 to witness an outcome saying it ran in takeover, otherwise the run is not proved, and specifies that every other line stays. The preserved concluding paragraph at team-config/agent/skills/app-qa-drivers/SKILL.md:145 says 'a `computer` outcome that ran in takeover fails the session', without excluding kind 13. The unchanged design likewise says 'fails every `computer` kind' at openspec/changes/app-qa-computer-use-exception/design.md:53. Thus the expected outcome of the newly executable negative-control run simultaneously satisfies kind 13 and fails the global judgement.
   - change: Explicitly exempt kind 13's intentionally staged mismatch from the blanket takeover-failure judgement, while retaining failure for ordinary computer-use sessions. For kind 13, require the witnessed takeover outcome, no subsequent computer call and the setting report. Add a Verify assertion for that exception and reconcile the design's blanket statement.
   - triage: confirmed, blocking true, protected false: The prescribed delivered text is contradictory. tasks.md:23 (task 1.17(e)) requires kind 13's staged-mismatch run to witness a takeover outcome, stop further computer calls and report the setting; without that outcome the run is not proved. The same task preserves every other line. Independently of the uncommitted skill edits, tasks.md:14 (task 1.8(d)) explicitly prescribes the blanket capture judgement that a takeover outcome fails the session, and design.md:53 says it 'fails every `computer` kind'; neither contains a kind-13 exception. Thus a correctly executed staged-mismatch run meets its specific requirements but necessarily fails the preserved global verdict. This is a delivered-procedure defect, not merely missing verification, so subsequent checks do not resolve it. Normal use of the instruction-change proof procedure triggers the contradiction and prevents that proof consumer from obtaining a consistent passing verdict. It is not among gate.md:8-9's accepted residual risks or blocking exclusions. Paths above are under openspec/changes/app-qa-computer-use-exception/.

## Residuals

none (the reviewer's note: kind 11 now permits the isolated configuration-existence-check trigger, and kind 13 retains the requirement that an unwitnessed takeover outcome is not proved.)

