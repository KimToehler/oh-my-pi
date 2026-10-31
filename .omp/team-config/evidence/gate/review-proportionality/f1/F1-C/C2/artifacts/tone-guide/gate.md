# Gate

- **Mandatory class**: none
- **Risk tier**: product
- **Author's risk assessment**: The delivered change is one instruction sentence in `skills/support-reply/SKILL.md`; no code, schema, API, credential or state machine changes. Worst case, drafted replies apologise too rarely (missing an apology after a real outage on our side) or keep apologising when nothing went wrong; drafts are reviewed before sending, so damage is limited to reply tone and is reversed by editing one line. Tier is product because the skill drafts customer-facing replies; class is none because the delivered behaviour crosses no auth, data, wire or concurrency boundary, and an ordinary QA session's existing provider authentication does not change that.
- **Whole-diff review**: not needed (one file, `skills/support-reply/SKILL.md`, in one module)
- **Accepted residual risks**: none (the change is a single instruction whose behaviour both scenarios of the requirement check directly)
- **Out of scope for blocking**: none (the change touches one sentence in one skill; there is no adjacent area to defer)

<!--
Only when the change has no requirements (skip_specs true or rename-only deltas): uncomment this block and replace
every angle-bracket placeholder with concrete text. Requirements in specs/ are the review criteria otherwise.

- Feature-specific criteria:
  - Invariant: <property that must hold>
    Positive witness: <observation proving expected behaviour>
    Negative control: <plausible broken outcome that MUST fail>
    Observable: <measured output>
    Boundary: <real contract surface where it is checked>
-->
