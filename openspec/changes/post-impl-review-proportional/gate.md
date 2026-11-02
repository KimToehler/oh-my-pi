# Gate

- **Mandatory class**: concurrency-state
- **Depth**: risky (Mandatory class concurrency-state; the change alters the post-implementation merge gate)
- **Risk tier**: product
- **Author's risk assessment**: The change rewrites the transitions of the existing post-implementation gate: depth, lanes, waves, the fix budget, the user ask and the F1 re-run rule. It therefore keeps the class of a changed state machine, and it is product because it gates every product change before merge. What can break:
  - a real defect reaches main because one `sol:high` lane missed what F3 or a later wave would have found;
  - a gate skips the second lane for a `risky` change;
  - the loop runs past its budget, or edits before the user has answered;
  - a verdict from a substituted model counts as the pinned reviewer's;
  - a carried QA row hides a regression a fix caused;
  - a pin that no longer resolves stops every gate.

  The damage is rework or a missed defect in reviewed work. The change handles no credential, data or irreversible state, and it leaves the validator, trailer checker and ledger that bind the record unchanged.
- **Whole-diff review**: not needed (every edit is instruction or configuration text of one gate flow, cut over together as design D8 states; no script, validator or package code changes)
- **Accepted residual risks**:
  - Two briefs on one model share blind spots. D2a, C3 and E1's wave-2 blockers were missed by every measured Sol run, and whether two different briefs on `sol:high` beat two runs of one brief is unmeasured (design D3).
  - The judgement limb of the depth rule, a class-`none` change that alters a review, gate or release mechanism, rests on the instruction and the reviewers. `validate-gate-record.mjs:655-659` requires both invocations only for a class other than `none`.
  - The model pin is enforced by the instruction. The validator checks that the trailer and the resolution agree (`validate-gate-record.mjs:452`) but not that they equal the pin.
  - The runtime's sources of substitution remain: the seed retry chain (`team-config/seed/config.yml:27-28`) and a pin without credentials falling back to the parent model. A substitution costs a retry, not a wrong PASS.
  - `whole_diff` in the record and the fix-delta review before each closing wave stay as redundant bookkeeping until Slice B.
  - Without verifier triage after implementation, a false blocker costs a fix round or an Override.
- **Out of scope for blocking**:
  - `validate-gate-record.mjs`, `trailer.mjs`, `gate-convergence.mjs` and the record v3 format, which Slice B covers;
  - the decomposed review;
  - the main-merge re-gate policy of Fix waves step 1;
  - plan review of `omp-gated` changes;
  - the `Blocker disposition` rules themselves, beyond their lane list;
  - the review brief and convergence rules of an on-demand `integration-review`.
