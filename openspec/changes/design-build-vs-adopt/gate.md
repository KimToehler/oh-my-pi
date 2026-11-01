# Gate

- **Mandatory class**: none
- **Risk tier**: internal-tooling
- **Author's risk assessment**: The change adds planning instruction text and one correctness-lens sentence; it reaches no protected asset and changes no state machine, record, validator or script. Too strict, a design spends one short subsection on a mechanism that did not need it, or the lens raises a blocker the planner fixes by adding the decision. Too loose, plans stay as they are today. Neither weakens an existing review: the lens only gains a check. Revertible by reverting the text and re-deploying.
- **Whole-diff review**: not needed (one schema file, one template comment and one README paragraph, all model-read text; no independently testable module or runtime layer)
- **Accepted residual risks**: Whether a planner searches well, and whether the facts it records (versions, licences, maintenance) are true, stays a judgement the user sees in `design.md`; the reviewer has no web access and checks only that the decision exists, carries the fields the form asks for and names its gaps. F1 shows the behaviour on fixtures, not a compliance rate.
- **Out of scope for blocking**: plan-mode plans and the plan-mode `plan-reviewer` prompt; web access for `plan-reviewer`; script or validator enforcement of the decision; the implementation phase.
