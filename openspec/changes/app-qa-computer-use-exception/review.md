# Review

- **Verdict**: REJECT
- **Reviewed digest**: 833cf774693b325220611dbf601adf5acdc5518ec1beb0400c6c8337d6817151
- **Depth**: risky
- **Reviewer**: plan-reviewer, ComputerUsePlanReviewDelta27
- **Verifier**: blocker-verifier, ComputerUseTriageR27
- **Models**: ComputerUsePlanReviewDelta27 onara/cx/gpt-6.1-sol, ComputerUseTriageR27 onara/cx/gpt-6.1-sol
- **Round**: 27
- **Awaiting**: none
- **Override**: none (round 27 exhaustion ask answered Fix by the user, Tim, 2026-11-14: "Fix")

## Blockers

The delta check reviews the fix of F1 attempt 12's failures that the user, Tim, authorized on 2026-11-14: "Fix all, with the device-setting confirmation and noqa option (a)".

### Delta check (ComputerUsePlanReviewDelta27)

1. **PROCESS 4 — Fixes 2 and 5: delivered proof instructions**
   - defect: The new tasks change runtime guidance and F1 expectations without updating the skill's own proof procedure. Following the prescribed edits leaves a compliant non-QA session failing proof kind 11, and makes proof kind 13 unreachable under its stated setup. This breaks an existing consumer of the delivered skill: later instruction-change verification. The defect is reversible by updating the text.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:19-22 prescribe edits only to the window, background, host-menu and sign-in bullets; tasks.md:35-36 edit only rule paragraphs. None updates the proof section. Consequently team-config/agent/skills/app-qa-drivers/SKILL.md:140 retains kind 11's requirement that `ui-automation-credentials` is not loaded, contradicting the permitted existence-check trigger in openspec/changes/app-qa-computer-use-exception/specs/app-qa-driver/spec.md:54. SKILL.md:142 also retains a session running under `takeover` that must produce a takeover outcome, although task 1.14 now requires that session to stop before any computer call. The necessary mismatch setup exists only in tasks.md:54's F1 row, not in an edit to the delivered proof procedure.
   - change: Add explicit edits and Verify checks for the skill's proof section: align kind 11 with the existence-check-only trigger exception, and align kind 13 with the pre-check and staged-mismatch sub-runs already designed for F1. Preserve the requirement that an unwitnessed takeover outcome is not proved.
   - triage: confirmed, blocking true, protected true: The delivered proof procedure still requires no ui-automation-credentials load in kind 11 (team-config/agent/skills/app-qa-drivers/SKILL.md:140), whereas the revised specification explicitly permits its load on an isolated configuration-existence check (openspec/changes/app-qa-computer-use-exception/specs/app-qa-driver/spec.md:54). Kind 13 still starts under takeover and requires a witnessed takeover outcome (SKILL.md:142), but task 1.14 requires stopping before any computer call when the configuration check prints takeover (tasks.md:20). Tasks 1.13–1.16 and 2.10–2.11 restrict their edits to runtime bullets and rule paragraphs (tasks.md:19-22,35-36), leaving these proof instructions unchanged. The staged mismatch is specified only for F1 (tasks.md:54). This is a delivered-contract contradiction, not merely missing verification: later instruction-change verification rejects permitted behavior or cannot prove its required outcome under the stated setup. It affects an existing consumer and is not an accepted residual or excluded area in gate.md:8-9.

## Residuals

2. **PROCESS 4 — Fix 4: failure-path verification**
   - defect: The planned rerun can pass without exercising the newly added sign-in/sign-out failure guard. Starting signed out and completing sign-in successfully never reaches the branch that leaked login-page text in attempt 12. An implementation that adds the required phrases but still performs a text probe after failure could therefore pass the prescribed checks. This leaves material credential-safety behaviour unproved; the verification gap is reversible, while a recurrence that discloses a credential would not be.
   - evidence: openspec/changes/app-qa-computer-use-exception/specs/app-qa-driver/spec.md:20-22 adds a scenario specifically for a failed flow or unknown resulting screen. tasks.md:22 verifies only the presence of phrases. tasks.md:71 resets keychain/app state before `rt-signin` and adds the conditional assertion 'after a failed sign-in or sign-out flow ... no page text', but specifies no sub-run that reaches a failed flow or unknown screen and no requirement to mark this scenario not proved when that antecedent is absent. A successful ordinary sign-in satisfies that row without testing the new mechanism.
   - change: Add a concrete F1 failure-path sub-run using a disposable setup that produces a failed sign-in/sign-out flow or unknown resulting screen. Require retained output witnessing that antecedent, then verify tag-only non-login probes or a stop, with no page-text assertion/find/wait or hierarchy read. Keep the normal successful sign-in regression run separate.
   - triage: refuted, blocking false, protected true: Condition 3 fails: the plan already requires executing the failed-flow scenario and treating an unwitnessed antecedent as not proved. The scenario explicitly requires a failed sign-in/sign-out flow or unknown resulting screen (openspec/changes/app-qa-computer-use-exception/specs/app-qa-driver/spec.md:20-22). Tasks.md:71 requires the changed routing requirement's scenarios to rerun on the redeployed skill; task 4.1 additionally requires 'one row per scenario' and explicitly states that a row whose antecedent was not witnessed is not proved (tasks.md:74). The F1 introduction likewise applies that antecedent rule to every row (tasks.md:48). Thus an ordinary successful sign-in alone cannot satisfy the required failure-scenario verification. The suggested disposable failure setup would make execution more explicit, but the claim that the prescribed checks allow this material behavior to pass without witnessing its antecedent is contradicted by those existing execution requirements.

