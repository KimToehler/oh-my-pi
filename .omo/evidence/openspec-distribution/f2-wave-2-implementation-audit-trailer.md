### 1. Goal and behavioural contract

The supplied diff and implementation cover the pinned CLI check, persistent telemetry opt-out, deployed schema source, project installation and migration notices. No blocking contract violation found.

### 2. Correctness, regressions, architecture, wire contracts

**Note — alternative project layout:** If a project uses a Git submodule at the schema path, its ignored, untracked submodule contents may not appear in the parent’s workflow-path status before the installer removes the directory (`install-openspec-workflow.mjs:88–96, 138`). This does not block: that layout is not claimed by the change, and the trigger is outside the ordinary project setup covered by the plan.

### 3. Security and privacy delta

No change to a real credential, authentication or authorisation path, third-party personal data, or access to a protected asset was identified. The CLI check applies both telemetry opt-outs to each OpenSpec invocation.

### 4. Verification adequacy

Reviewed the installer and CLI-check tests, deploy sequence, F3 reports, and supplied F1 evidence, including the real deploy and telemetry logs. No checks were run in this read-only review.

**Note — rollback coverage:** The tests inject failures during schema copying and rollback checkout, but do not directly inject failure while creating the config (`install-openspec-workflow.test.ts:273–320`; implementation at `install-openspec-workflow.mjs:144–151`). This is a non-blocking verification gap; the tests do exercise the principal rollback and incomplete-rollback paths.

### 5. Final verdict

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: A previously installed, committed workflow can be installed again without creating spurious changes or migration notices.
  positive_witness: A rerun on a current committed project exits zero, reports that the workflow is already current, and leaves Git status clean.
  negative_control: A rerun that changes a workflow file or emits a migration notice for the current deployed validator path MUST fail.
  observable: Exit status, installer output, and Git status before and after the rerun.
  boundary: Installer command executed in a project Git work tree.
END-REVIEW-TRAILER
