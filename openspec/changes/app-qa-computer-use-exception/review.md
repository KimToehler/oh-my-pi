# Review

- **Verdict**: REJECT
- **Reviewed digest**: 355ad800d3abb576600b2ee12a5679dbbed956fdd6f62f87b67a2ca6ca93899d
- **Depth**: risky
- **Reviewer**: plan-reviewer, ComputerUsePlanReviewDelta25
- **Verifier**: blocker-verifier, ComputerUseTriageR25
- **Models**: ComputerUsePlanReviewDelta25 onara/cx/gpt-6.1-sol, ComputerUseTriageR25 onara/cx/gpt-6.1-sol
- **Round**: 25
- **Awaiting**: exhaustion
- **Override**: none

## Blockers

### Delta check (ComputerUsePlanReviewDelta25)

1. **PROCESS 4 — Fix 1: Hard-coded e1 does not identify each window’s root**
   - defect: With the main window and dialog both open, the prescribed resolver reads the same element’s attributes for every candidate. Accessibility references are session-wide, not numbered anew for each window. If e1 belongs to the main window, the dialog is incorrectly reported missing; if it belongs to the dialog, multiple candidates can be classified as dialogs and refused as ambiguous. This breaks the normal already-open-dialog case the fix must support. The refusal is reversible.
   - evidence: openspec/changes/app-qa-computer-use-exception/tasks.md:15 and design.md:122 prescribe win.ref("e1") after each candidate’s win.ax({maxDepth: 0}). However, packages/coding-agent/src/tools/computer/prelude.js:145–147,187 implements win.ref through a reference-only lookup without the window id; worker.ts:1306–1310 likewise resolves axNode(ref), not a window-scoped reference. crates/pi-natives/src/desktop/ax.rs:176–190,254–284 maintains one incrementing next_ref and allocates references across targets, so the second window’s root is not necessarily e1.
   - change: Extract the actual root reference from each candidate window’s returned snapshot and resolve that reference rather than assuming e1. Retain the app-filtered listing and safe catch. Exercise the two-window case with either window encountered first and with earlier accessibility reads already having allocated references.
   - triage: confirmed, blocking true, protected false: The prescribed resolver exists in tasks.md:15 and design.md:122 and hard-codes win.ref("e1") for every candidate. prelude.js:145–147,187 creates reference-only handles; worker.ts:1306–1310 resolves axNode(ref) without the window id. AxRegistry has one next_ref initialized to 1 (ax.rs:176–190), increments it for new registrations, and stores references across targets (ax.rs:254–284). Thus, with an ordinary main window and dialog, reading each candidate's snapshot does not make e1 that candidate's root: both attribute reads can identify the main window, yielding no dialog, or identify the dialog, yielding multiple matches. This is a delivered resolver defect, not missing verification; the planned two-window QA does not resolve it. It blocks the explicitly required already-open/two-window dialog workflow.

2. **PROCESS 4 — Fix 1: Replacement resolver contradicts mandatory window criteria**
   - defect: A session correctly following the new already-open-dialog path still necessarily fails the unchanged negative control: its listing was taken after the dialog was raised. Candidate-root inspection also conflicts with the unchanged criterion requiring every accessibility read to name only the resolved dialog. Consequently the new positive scenarios and mandatory criteria cannot be satisfied together in ordinary two-window operation. This is a reversible specification/gate defect, not an accepted residual risk.
   - evidence: openspec/changes/app-qa-computer-use-exception/specs/app-qa-driver/spec.md:135–137 requires resolving an already-open dialog without a driver step, but :148–149 still mandates failure when resolution uses a listing 'not taken before the step that raised it'. Separately, :117 now requires root-attribute reads for every app-window id, while :121 requires 'every capture and accessibility read' to name the one target window. tasks.md:57 explicitly permits the main window’s root attributes, demonstrating the newly intended exception that the criteria do not consistently express.
   - change: Replace the historical-listing negative-control clause with one testing violations of the app-scoped subrole resolver. Explicitly distinguish narrowly allowed candidate-root identification reads from content reads and captures of the resolved dialog, and align the positive scenarios and negative controls with that distinction.
   - triage: confirmed, blocking true, protected false: The specification retains incompatible mandatory criteria. spec.md:135–137 requires resolving a dialog already open at session start without a driver step, but :148–149 rejects resolution using a listing not taken before the step that raised it; a fresh session following the required path has no such historical listing. Additionally, :117 requires inspecting each candidate window's root attributes, while :121 requires every accessibility read to name only the resolved target window. In ordinary main-window-plus-dialog operation, inspecting the main window violates that unchanged criterion. tasks.md:57 explicitly allows main-window root reads, confirming the intended exception is not consistently expressed in the specification. These are delivered specification/gate contradictions, so checks that expose them do not refute the finding. They block jointly satisfying the required positive scenarios and mandatory acceptance criteria.

## Residuals

none
