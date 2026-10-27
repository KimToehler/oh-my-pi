# Review

- **Verdict**: REJECT
- **Reviewed digest**: c5f961931d0d4639728c75c14ce7f89537e3faaeda3c23ffa99994ce37190b34
- **Reviewer**: plan-reviewer, GdqeCorrectnessR3, GdqeVerificationR3, GdqeChecksR3
- **Round**: 3
- **Override**: none

## Blockers

### Verification (GdqeVerificationR3)

[
  {
    "area": "Final verification — task 3.1",
    "defect": "The F1 evidence can report PASS even when the snapshot or validator exit status is wrong. The script compares only validator outcome and finding; the Verify command accepts any numeric Exit and does not check the GC snapshot result. A normal new-guidance run where snapshot fails but a later validator invocation passes can therefore be recorded as passing, so the stated workflow integration is not proved. This is reversible but undermines the merge-gate evidence.",
    "evidence": "openspec/changes/gate-durable-qa-evidence/tasks.md:15 requires GC snapshot to succeed and records an Exit line, but derives RESULT solely from outcome and finding; its Verify command checks only '^Exit: [0-9]+$' and does not assert a snapshot exit or output. The scenarios in specs/merge-gate-record/spec.md:8-10, 53-55 explicitly require exit 0.",
    "change": "Capture and independently assert the GC snapshot exit and its expected result, and compare each validator exit status with the scenario's expected zero or nonzero status both when generating RESULT and when checking the evidence."
  },
  {
    "area": "Executability — tasks 2.1 and 2.2",
    "defect": "The Verify commands do not prove several required guidance changes. For example, task 2.1 passes when the Reuse first line merely contains \"record's evidence directory\" even if it still tells authors to reuse an untracked artifact elsewhere; task 2.2 counts two occurrences of that phrase without checking that the actual visual-qa storage and tui-check paths moved. Such stale guidance causes ordinary gate authors to produce artifacts the new validator rejects at Phase 5. The failed gate is recoverable, but the planned cutover and task-completion proof are broken.",
    "evidence": "openspec/changes/gate-durable-qa-evidence/tasks.md:10-11 specify the reuse, staging, safe-publishing and visual-qa path changes, while their Verify commands use phrase-presence and occurrence checks. team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:255-257 requires each command to directly prove its task's observable result.",
    "change": "Use deterministic assertions tied to each changed instruction and actual command/path, including the tracked-or-copy reuse rule, unstaged/explicit staging, both visual-qa destinations and the redaction procedure; ensure stale or contradictory instructions make the relevant Verify fail."
  }
]
