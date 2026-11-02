# Gate quorum: require two distinct approvals for a release

## Goal
The release gate admits a candidate after one approval. Require two distinct approvers, so a single person cannot admit a release alone.

## TODOs
- [x] 1. `scripts/gate.ts`: count distinct approvers; admit only with at least 2 (refusal reason `needs 2 approvals, got N`)
- [x] 2. `scripts/gate.test.ts`: cover two approvals, duplicate approver, one approval

## Final verification wave
- [ ] F1. Manual QA on the real surface, one evidence path per scenario in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/gate-quorum/f1/`): first merge the default branch into the work branch when it is not an ancestor of the head, and commit; then run QA on the head after the last code commit
- [ ] F2. Merge gate: `review-work`, SHA-bound team-config.merge-gate/v3 record validated

## Merge gate
- Author's risk assessment: The gate script decides which release candidates are admitted. A wrong count admits a release with one approval, or refuses a good one. No credentials or personal data involved.
- Mandatory class: none
- Risk tier: internal-tooling
- Whole-diff review: not needed (whole-diff surface reviewed in F2)
- Accepted residual risks: approver identity is a free-form string and is not authenticated against any directory
- Out of scope for blocking: the CLI wrapper's JSON input validation
- Feature-specific criteria:
  - Invariant: a candidate is admitted only when no check failed and at least two distinct approver strings are present
    Positive witness: approvals ["a","b"] with passing checks exits 0 with `admitted`
    Negative control: approvals ["a","a"] or ["a"] admitted with passing checks
    Observable: exit code and the JSON reason line printed by `bun scripts/gate.ts <file>`
    Boundary: the CLI entry point of `scripts/gate.ts`
  - Mechanical: bun test passes
    Invariant: the unit tests of the gate pass
    Observable: `bun test` exits 0
    Boundary: scripts/gate.test.ts
