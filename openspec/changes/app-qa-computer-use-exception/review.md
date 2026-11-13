# Review

- **Verdict**: REJECT
- **Reviewed digest**: 1d8f089d369eecd8e8ba903be5bedf21560997de9a3b03df79a65e4383b402a0
- **Depth**: risky
- **Reviewer**: plan-reviewer, ComputerUsePlanReviewDelta24
- **Verifier**: blocker-verifier, ComputerUseTriageR24
- **Models**: ComputerUsePlanReviewDelta24 onara/cx/gpt-6.1-sol, ComputerUseTriageR24 onara/cx/gpt-6.1-sol
- **Round**: 24
- **Awaiting**: none
- **Override**: none (round 24 exhaustion ask answered Fix by the user, Tim, 2026-11-13: "Fix (dialog by AXSubrole, ce-missing on the dialog task)")

## Blockers

### Delta check (ComputerUsePlanReviewDelta24)

1. **PROCESS 4 — Fix 1: Already-open dialogs have no resolution path**
   - defect: When a fresh session receives the ordinary request to inspect a dialog that is already open, it has no pre-dialog window inventory. The new resolver requires precisely that historical inventory and permits no alternative. Taking both listings now yields no new id and incorrectly reports the existing dialog as missing; closing and recreating it is neither specified nor necessarily preserves the requested state. This breaks the explicit already-open-dialog scenarios. The refusal is reversible, but the requested check cannot be completed.
   - evidence: openspec/changes/app-qa-computer-use-exception/specs/app-qa-driver/spec.md:66–67 requires resolving a dialog the app 'has raised'; :132–133 explicitly starts with the main window and dialog both open. However, :117, design.md:122 and tasks.md:15 allow resolution only from the id difference across a driver step that raises the dialog. tasks.md:57 retains the task 'list the buttons of the open dialog' without supplying an earlier inventory or another identification path.
   - change: Define an app-scoped identification path for a dialog already open when the session starts, retaining ambiguity refusal and the safe id-resolution catch. Alternatively, explicitly settle a narrower contract with the user and update every affected scenario. Add a fresh-session control with the main window and dialog already open and no pre-dialog inventory available.
   - triage: confirmed, blocking true, protected false: The ordinary fresh-session request with a dialog already open is explicitly required by spec.md:66–67 and :132–133. Yet spec.md:117, design.md:122 (D20(b)) and tasks.md:15 (1.9) permit identification only by comparing window ids before and after the driver step that raises it. With no historical inventory and both listings taken after opening, there is no new id and the mandated outcome is refusal; no alternative identification path is provided. Tasks.md:57 retains an already-open-dialog run without supplying that history. This is a delivered-contract defect, not merely missing verification, so a later check exposing it does not resolve it. Normal use therefore leaves a required dialog check uncompletable, and no gate residual or blocking exclusion accepts that limitation.

2. **PROCESS 4 — Screen-reader cutover leaves the missing-prelude proof on the wrong surface**
   - defect: With computer use disabled, ce-missing still asks for a VoiceOver check and requires a missing-prelude report. Under the new design, that request must instead produce the human step independently of prelude availability. A correct session can therefore fail this mandatory row, while a session passing it does not prove the missing-prelude behavior for either remaining computer-use surface. This is a reversible verification defect that leaves a specified material branch unproved.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:50 still says 'ce-missing: the VoiceOver task with computer.enabled false: the report names the missing prelude'. In contrast, specs/app-qa-driver/spec.md:59–63 makes screen-reader checks human-only, :81–83 changes the unavailable-prelude scenario to a dialog task, and tasks.md:16 explicitly rebases the delivered skill's proof item 8 onto 'The dialog check with computer.enabled false'. tasks.md:68 still requires the ce-missing evidence row.
   - change: Rebase ce-missing onto the dialog task with computer.enabled false and require the missing-prelude report with no substitute driving. Keep the VoiceOver human-step outcome independent of whether computer use is enabled.
   - triage: confirmed, blocking true, protected false: Tasks.md:50 still mandates ce-missing as a VoiceOver request with computer.enabled false and requires a missing-prelude report; task 4.1 at :68 requires that row and its evidence. In contrast, spec.md:59–63 and design.md:121 make screen-reader checks human-only, while spec.md:81–83 and tasks.md:16 (1.10, proof item 8) explicitly move missing-prelude coverage to the dialog request. A correct human-step response to the disabled-prelude VoiceOver request thus cannot establish the required missing-prelude behavior on an allowed computer-use surface. The planned skill-text checks only establish the revised wording, and the mandatory executed F1 row remains the obsolete request. This contradictory mandatory verification row leaves the specified unavailable-prelude branch without its material real-session proof and can reject correct behavior; it is not an accepted residual or excluded area.

## Residuals

none
