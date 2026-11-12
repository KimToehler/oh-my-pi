# Review

- **Verdict**: REJECT
- **Reviewed digest**: 658157d26278ed40981c67baee7ef46df7fd0d03a398ae1aa963b132b08f15f7
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta3
- **Verifier**: blocker-verifier, ProposeComputerUse.VerifierRound3
- **Models**: ProposeComputerUse.PlanReviewDelta3 onara/cx/gpt-6.1-sol; ProposeComputerUse.VerifierRound3 onara/cx/gpt-6.1-sol
- **Round**: 3
- **Awaiting**: none
- **Override**: none (second exhaustion ask answered Fix by the user, Tim, 2026-11-12: "Fix": fix the three round-3 blockers as the verifier confirmed them, then one more delta check.)

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta3)

1. **Quality and verification — D5 window-isolation proof**
   - defect: The replacement for the login-clear guard relies on a window capture excluding other applications, explicitly promising F1 verification, but no F1 row exercises that property. The rows establish which window ID a call names, not whether the returned pixels exclude an overlapping window. Ordinary QA with another application covering the target is the realistic trigger. A capture implementation returning a screen crop could satisfy the planned observations while including another application's credential surface; disclosure would be irreversible. This finding concerns the missing promised proof, not an assertion that the prelude actually behaves that way.
   - evidence: openspec/changes/app-qa-computer-use-exception/design.md:35 states that a window-scoped capture holds only its own buffer and marks this '[INFERENCE: F1 proves it on the real surface]'; gate.md:8 likewise says this is verified in F1. However, tasks.md:32 tests refusal of explicit whole-screen/other-app requests, tasks.md:35 checks call targets, and tasks.md:37 checks that capture calls name the target. Neither these rows nor design.md:53 requires an overlapping synthetic other-app window or an observation establishing its exclusion from the captured pixels.
   - change: Add a disposable isolation control: place a separately owned synthetic window with a distinctive nonsecret marker over the allowed target, capture only the resolved target through the actual prelude, and have the QA lane inspect the resulting target capture to establish that the other window is absent. Retain the credential-free observation and make it a required F1 result. Keep uncertainty for other window-server states as the accepted residual risk.
   - verifier: confirmed, blocking true, protected true; reason: D5 (design.md:35) expressly relies on the target window's own buffer excluding another application's password-manager window and promises F1 proof; gate.md:8 likewise requires that verification before accepting uncertainty about other window-server states. The enumerated F1 rows in tasks.md test requested targets and call arguments, not pixel isolation under overlap. D8 (design.md:53) permits fixture captures only to demonstrate the state reached after dialog/host-menu actions and supplies no overlapping-window control or exclusion observation. Thus a screen-crop implementation could pass all specified observations while including an ordinarily overlapping application's credential surface. This is a missing material boundary proof, not a demand to eliminate the accepted residual uncertainty.

2. **PROCESS 4 — Incomplete dialog-scope migration in tasks 1.1–1.2**
   - defect: The implementation instructions still prescribe the old system-dialog surface label while the changed design, specification and positive QA row require app dialog. Following task 1.1 literally produces evidence that fails the newly added positive row. Task 1.2 also continues advertising the broader old surface in the skill description. This is a reversible instruction defect, but it makes the planned implementation and its required value proof disagree during ordinary app-dialog QA.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:7 restricts SURFACE to 'screen reader, system dialog, host menu'; tasks.md:8 still tells the frontmatter to name 'system dialog'. In contrast, design.md:50 specifies 'screen reader|app dialog|host menu', specs/app-qa-driver/spec.md:115 names 'app dialog', and tasks.md:34 requires the evidence line 'Computer use: app dialog: ...'.
   - change: Update the remaining implementation instructions and advertised surface names to 'app dialog', retaining the explicit exclusion of dialogs belonging to other processes. Ensure task 1.1's prescribed evidence line agrees with D7 and the ce-dialog acceptance condition.
   - verifier: confirmed, blocking true, protected false; reason: tasks.md:7 explicitly limits the evidence SURFACE to 'screen reader, system dialog, host menu', and tasks.md:8 also prescribes 'system dialog' in the skill description. These contradict D7 (design.md:50), the evidence requirement (specs/app-qa-driver/spec.md:115), and the ce-dialog F1 row (tasks.md:34), which requires 'Computer use: app dialog: ...'. Normal execution of the app-dialog task following the prescribed label therefore fails its required positive value proof. That F1 would detect the contradiction does not resolve this delivered-instruction defect.

3. **PROCESS 4 — Broken Verify contract in task 2.1**
   - defect: The modified rule Verify requires three unrelated phrases that neither the existing rule nor the specified rule extension supplies. A compliant implementation consisting of the new condition, a description mentioning the prelude, and the D4 pointer bullet can therefore fail Verify despite implementing task 2.1 correctly. This blocks normal execution of the plan's deterministic delivered-text checks; the damage is reversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:13 newly requires `grep -q 'screen reader'`, `grep -q 'host menu'`, and `grep -q 'another process'` against RU. The complete existing team-config/agent/rules/ui-automation-credentials.md contains none of those phrases. The additions prescribed by tasks.md:13 and design.md:30 concern the computer helpers, forbidden credential surfaces and the no-credentials configuration condition, not those three surface-description phrases.
   - change: Remove the accidentally copied surface checks from the rule Verify, or explicitly design and require corresponding rule text if it genuinely belongs there. Keep checks for the new trigger, credential-scope pointer and preservation of the existing rule protections; verify the allowed surface descriptions against the skill instead.
   - verifier: confirmed, blocking true, protected true; reason: tasks.md:13 conjunctively requires the rule to contain 'screen reader', 'host menu', and 'another process'. The complete existing team-config/agent/rules/ui-automation-credentials.md contains none. The prescribed edits in that task and D4 add a helper trigger, mention the prelude in the description, and add a credential-scope bullet; none requires those three phrases, while all other lines must stay byte-identical. A straightforward compliant implementation therefore fails the mandatory Verify command. This is a concrete normal-execution failure of the deterministic delivery checks, not merely an alternative-check preference. The cited artifact and preservation requirements concern the credential guardrail.

## Residuals

none

Round 2's findings were fixed by the delta this round checked (exhaustion answer Fix, user Tim 2026-11-12, scope: computer use only for apps whose configuration has no credentials section, one target window, no display or other-app capture).
