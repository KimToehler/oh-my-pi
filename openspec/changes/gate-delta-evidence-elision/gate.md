# Gate

- **Mandatory class**: none
- **Depth**: risky (the change alters what a fix-delta reviewer of the merge gate is shown)
- **Risk tier**: product
- **Author's risk assessment**: The change narrows the input of the fix-delta review, the step that decides every fix
  commit between F2 waves for every gated change. What can break:
  - a code, plan or spec hunk is left out of a patch, so a fix commit is decided by a reviewer that never saw it and a
    defect reaches main; the worst case, because the ledger then counts the commit as reviewed;
  - a manifest names a wider left-out path and `delta` accepts it, which turns the same hole into a choice of the
    orchestrator;
  - a delta directory written before the deploy no longer verifies, so a gate in flight must re-dispatch its ranges;
  - the listing misreports which evidence changed, so a reviewer skips a capture its carry decision needed.

  The damage is a missed defect or rework in reviewed work. The change handles no credential, data or irreversible
  state; the ledger events, the gate record and the validator stay as they are. Class `none`: no supported contract
  outside team-config reads the manifest (it lives in the ignored `gate-deltas/` directory and only `gate-convergence.mjs`
  reads it), and no state machine changes. Product, because it gates every product change.
- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
- **Accepted residual risks**:
  - A QA harness script kept under `.omp/team-config/evidence/` that a fix round changes is shown to the delta reviewer
    only as a directory line; its effect is judged through the QA row it produces in the wave (design.md Risks).
  - Merge commits keep `git show`'s combined diff, which is empty for a clean merge: a merge's content is reviewed
    through its parents' commits or a main-merge range, as today.
- **Out of scope for blocking**:
  - `GC exempt`, the ledger events, `ready`, the gate record and `validate-gate-record.mjs`;
  - the reading budget of reviewer agents and the router's compression of tool output;
  - the F2 wave briefs and the QA matrix.
