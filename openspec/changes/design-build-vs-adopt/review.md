# Review

- **Verdict**: REJECT
- **Reviewed digest**: 2786e2e2438a2a2e755917eb2582e7036c9405aef5e5b3aa8b628d7fae3d1d11
- **Reviewer**: plan-reviewer, DbaCorrectnessR7, DbaVerificationR7, DbaChecksR7
- **Round**: 7
- **Override**: none

## Blockers

### Checks (DbaChecksR7)

[
  {
    "area": "CHECK 6 — design.md D1/D6; tasks.md 2.1",
    "defect": "The plan introduces two schema-consumption paths—repository-local changes and changes in a separate planning store—but provides no control that distinguishes them. In ordinary store-backed use, resolving the rule relative to the code repository instead of the change's planning home can read an absent or older schema and omit the new decision check. Every planned C-row would still pass with that defective implementation of the instruction. This leaves a material part of the newly specified lookup behaviour unproved; the resulting missed plan-review check is reversible, not an irreversible-data defect.",
    "evidence": "openspec/changes/design-build-vs-adopt/design.md:27 expressly distinguishes the planning store from the code repository, and :98-101 delivers that root-selection instruction. However, :143 puts each fixture's schema in its own disposable code repository, and :155-162 define all correctness-lens rows without a separate planning home. tasks.md:17 runs only those rows. Separate planning homes are an existing supported entry path: team-config/agent/commands/opsx-propose.md:21 supports explicit stores, :52 resolves the authoritative root, and :115 states that the planning home may be separate from the code.",
    "change": "Add one fresh correctness-lens control with the code repository and planning store in different roots. Put the delivered schema and a missing-decision change in the store, and an older or deliberately distinguishable schema in the code repository. Require the retained calls to show the reviewer reading the store's schema and returning the missing-decision blocker. Document that explicit store, project-pointer and default-store selection converge on the same change-folder-based lookup, so separate sessions for those selectors are unnecessary."
  }
]
