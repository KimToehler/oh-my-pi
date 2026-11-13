# Review

- **Verdict**: REJECT
- **Reviewed digest**: 1d8f089d369eecd8e8ba903be5bedf21560997de9a3b03df79a65e4383b402a0
- **Depth**: risky
- **Reviewer**: plan-reviewer, ComputerUsePlanReviewDelta24
- **Verifier**: blocker-verifier, none
- **Models**: ComputerUsePlanReviewDelta24 onara/cx/gpt-6.1-sol
- **Round**: 24
- **Awaiting**: triage
- **Override**: none

## Blockers

### Delta check (ComputerUsePlanReviewDelta24)

1. **PROCESS 4 — Fix 1: Already-open dialogs have no resolution path**
   - defect: When a fresh session receives the ordinary request to inspect a dialog that is already open, it has no pre-dialog window inventory. The new resolver requires precisely that historical inventory and permits no alternative. Taking both listings now yields no new id and incorrectly reports the existing dialog as missing; closing and recreating it is neither specified nor necessarily preserves the requested state. This breaks the explicit already-open-dialog scenarios. The refusal is reversible, but the requested check cannot be completed.
   - evidence: openspec/changes/app-qa-computer-use-exception/specs/app-qa-driver/spec.md:66–67 requires resolving a dialog the app 'has raised'; :132–133 explicitly starts with the main window and dialog both open. However, :117, design.md:122 and tasks.md:15 allow resolution only from the id difference across a driver step that raises the dialog. tasks.md:57 retains the task 'list the buttons of the open dialog' without supplying an earlier inventory or another identification path.
   - change: Define an app-scoped identification path for a dialog already open when the session starts, retaining ambiguity refusal and the safe id-resolution catch. Alternatively, explicitly settle a narrower contract with the user and update every affected scenario. Add a fresh-session control with the main window and dialog already open and no pre-dialog inventory available.
   - triage: not triaged: the verifier has not returned

2. **PROCESS 4 — Screen-reader cutover leaves the missing-prelude proof on the wrong surface**
   - defect: With computer use disabled, ce-missing still asks for a VoiceOver check and requires a missing-prelude report. Under the new design, that request must instead produce the human step independently of prelude availability. A correct session can therefore fail this mandatory row, while a session passing it does not prove the missing-prelude behavior for either remaining computer-use surface. This is a reversible verification defect that leaves a specified material branch unproved.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:50 still says 'ce-missing: the VoiceOver task with computer.enabled false: the report names the missing prelude'. In contrast, specs/app-qa-driver/spec.md:59–63 makes screen-reader checks human-only, :81–83 changes the unavailable-prelude scenario to a dialog task, and tasks.md:16 explicitly rebases the delivered skill's proof item 8 onto 'The dialog check with computer.enabled false'. tasks.md:68 still requires the ce-missing evidence row.
   - change: Rebase ce-missing onto the dialog task with computer.enabled false and require the missing-prelude report with no substitute driving. Keep the VoiceOver human-step outcome independent of whether computer use is enabled.
   - triage: not triaged: the verifier has not returned

## Residuals

none
