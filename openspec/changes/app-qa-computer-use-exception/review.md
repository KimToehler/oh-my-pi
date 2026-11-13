# Review

- **Verdict**: REJECT
- **Reviewed digest**: 299da80251992bcb8248c2dd0f316b38388b7a0821c04f76d7c57917bf2c50a7
- **Depth**: risky
- **Reviewer**: plan-reviewer, ComputerUsePlanReviewDelta23
- **Verifier**: blocker-verifier, none
- **Models**: ComputerUsePlanReviewDelta23 onara/cx/gpt-6.1-sol
- **Round**: 23
- **Awaiting**: triage
- **Override**: none

## Blockers

### Delta check (ComputerUsePlanReviewDelta23)

1. **Correctness — App-window cardinality is not target-window identity**
   - defect: Requiring the entire app-filtered listing to contain exactly one record prevents ordinary dialog checks when the app has both its main window and its dialog open. Conversely, closing only the dialog leaves the main window as the unique record, so the prescribed resolver does not establish the missing-dialog condition expected by ce-window-miss. These are normal application states, not unsupported syntax or deliberate corruption. The result breaks the dialog-check goal and its acceptance scenario; refusal or wrong-target results are reversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/design.md:89, tasks.md:15 and specs/app-qa-driver/spec.md:125 require exactly one record from computer.windows({app}), refusing several. worker.ts:1733–1768 filters the enumerated windows by app, optional title and id; an app-only filter does not distinguish a dialog from its main window. The repository explicitly models an Open panel and document window together at crates/pi-natives/src/desktop/macos/applications.rs:923–932. The dialog criterion requires resolving the dialog's own window at specs/app-qa-driver/spec.md:65–67, and tasks.md:60 requires the positive open-panel check. tasks.md:47 closes the dialog, not the app's main window, but nevertheless requires 'target window not found'.
   - change: Enumerate only the intended app, then identify candidates for the requested surface within that app-scoped result before applying empty/ambiguous refusal. Specify how a dialog is distinguished from its owner window without reading unrelated applications. Retain the safe id-resolution catch. Exercise both main-window-plus-dialog and main-window-with-dialog-closed states.
   - triage: not triaged: the verifier has not returned

2. **CHECK 5 — Before/after focus samples do not establish the capture interval**
   - defect: The guarded-desktop design still treats endpoint samples as proof that focus never left the app. On an otherwise compliant desktop, focus can move to an allowed Finder or terminal window during capture and return before the post-capture lookup. Both app inventories and both focus samples pass, so the instructions authorize reading the capture despite the explicit criterion forbidding reads after focus left. This can occur through brief interaction with the permitted system UI or terminal. The criterion violation and incorrect QA attribution are real even without assuming those windows contain protected data; transcript disclosure, if it occurs, is irreversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/design.md:90 claims that 'the before and after checks catch focus leaving the app'; tasks.md:16 authorizes reading when 'all four checks passed'. Capture itself has no expected-focus or focus-history guard at packages/coding-agent/src/tools/computer/worker.ts:634–649. specs/app-qa-driver/spec.md:97–99 requires never reading a capture whenever focus leaves between the initial check and capture completion, and its negative control at :102 includes that case. tasks.md:49 only proves a focus change that remains observable in the after-capture sample; it does not cover focus leaving and returning.
   - change: Provide a boundary that actually establishes focus continuity, or hand caption reading to a human when that guarantee is unavailable. A dedicated user plus before/after sampling must not be described as proving continuity. Add a control in which focus leaves and returns before the final sample, retaining independent evidence of that transition, and require refusal without inspecting the capture.
   - triage: not triaged: the verifier has not returned

3. **CHECK 4 — F1 still permits material failure branches to remain unexercised**
   - defect: The new matrix does not require reaching several branches central to the recorded fixes. The contention run can pass vacuously when no flow starts during the brief lock-held interval. The missing-window run starts with the dialog already closed, so it does not exercise failure after enumeration and cannot prove the safe catch. No dedicated run stages an absent host window to prove refusal rather than launch. Thus a passing matrix can leave the new serialization, late-resolution-error and missing-host behavior unproved. These are ordinary timing and application-lifecycle states; adding evidence is reversible, whereas the original disclosure or foreground-input consequences need not be.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:46 says only that 'every flow run that started while the session's lock existed must refuse'; it requires neither at least one such run nor a retained overlap witness. The same row treats a missing host window as 'not reached', rather than defining a refusal control. tasks.md:47 keeps the dialog closed from the outset and never closes a previously enumerated target before computer.window(id). These omissions leave the mechanisms prescribed at tasks.md:15 and :17, and design.md:89, :91–92, without their material failure-path proof. By contrast, tasks.md:50 correctly requires the takeover antecedent before that row can pass.
   - change: Require a witnessed lock overlap: retain acquisition, a real flow attempt while the owner remains live, refusal, selection/confirmation and release in order; no overlap means not proved. Add a disappearing-target run that demonstrably reaches the id-resolution catch and checks the raw session output for unrelated-title sentinels. Add an absent-host run with the activating-on-launch fixture available, requiring no apps.open call and an explicit preparation/refusal report. Require each antecedent before accepting its row.
   - triage: not triaged: the verifier has not returned

## Residuals

none
