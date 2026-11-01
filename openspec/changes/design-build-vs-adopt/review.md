# Review

- **Verdict**: REJECT
- **Reviewed digest**: ca819eb7e61c06ddcf13736d32b7b96d47f78fd1502790aea81353a019014307
- **Reviewer**: plan-reviewer, DbaCorrectnessR5, DbaVerificationR5, DbaChecksR5
- **Round**: 5
- **Override**: none

## Blockers

### Correctness (DbaCorrectnessR5)

[
  {
    "area": "correctness",
    "defect": "E3 reads the rule from the wrong root when the change lives in a separate OpenSpec planning home. In normal store-backed use, the reviewer receives the target code repository and the store's change directory, but E3 directs it to the code repository's schema. That file can be absent or contain an older rule, preventing the required decision check or unnecessarily blocking review. This is reversible, but breaks the promised coverage of omp-gated plan review.",
    "evidence": "openspec/changes/design-build-vs-adopt/design.md:95-98 explicitly directs the lens to `openspec/schemas/omp-gated/schema.yaml under the repository root`; specs/openspec-design-adoption/spec.md:115 requires the lens to read the applicable rule and report missing/incomplete decisions. The existing workflow explicitly supports a planning home separate from the code (team-config/agent/commands/opsx-propose.md:92,115), including registered stores (:21). The schema itself explains that planningHome.root may resolve through `--store`, a project store pointer, or a global default, and must not be replaced with a repo-relative assumption (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:122-128).",
    "change": "Make E3 locate the applicable schema in the planning home that owns the change, rather than assuming the target code repository owns it. Preserve the separate code-repository root for reviewing implementation claims, and update the corresponding design rationale to distinguish these roots."
  }
]

### Verification (DbaVerificationR5)

[
  {
    "area": "Quality and verification - F1 row set (design D6), task 2.1",
    "defect": "E3 ships a new blocking criterion into the correctness lens paragraph that runs on every future omp-gated plan review, but no row proves the lens does NOT demand a `Build vs. adopt` decision from a plan whose mechanisms are not covered. All five lens rows use the same covered-mechanism fixture, so the lens's false-positive behaviour - the regression this change can inflict on every unrelated change - is unexercised. Row C0 only shows that a *complete* decision draws no blocker; it cannot fail when the lens over-triggers on project-specific logic. The plan itself names the trigger: 'The coverage line is fuzzy (\"general-purpose infrastructure\")' (design.md:169), yet mitigates it only on the planner side ('the cost of a false positive is one short subsection'), while on the lens side a false positive is a REJECT and a fix round for an unrelated change. The design instruction's symmetric case is covered (row B, design.md:146, project logic -> no subsection, no search), which makes the missing lens-side counterpart an asymmetry rather than a deliberate exclusion: it is named neither in design.md:162 ('Unexercised by design') nor in gate.md's Accepted residual risks.",
    "evidence": "design.md:150-154 - rows C1, C2, C3, C4, C0 all run on `Change keycloak-sign-in` (OIDC/PKCE/token storage, a covered mechanism); design.md:146 - row B covers the uncovered-mechanism case for the design instruction only; design.md:169 - the fuzzy-coverage risk; specs/openspec-design-adoption/spec.md:95-101 - Requirement 'Plan review checks the decision' is proven on the silent side only by 'Complete decision passes' (C0); tasks.md:15 - the 2.1 evidence list contains no row for this case; the delivered lens text design.md:95-101 (E3) says 'a mechanism it covers that the plan introduces without its subsection in design.md … Report it as a blocker, not a note', with coverage judged by the reviewer from the paragraph's examples (token storage, retry and backoff, scheduling, caching, a UI widget).",
    "change": "Add one lens row to design D6 (e.g. C5 'lens, no covered mechanism'): run the same C1 prompt over a complete `trial-expiry`-style fixture change (project-specific logic built from existing components, design.md either absent or present with no `Build vs. adopt` subsection) with the delivered schema, Must show: no blocker demanding a `Build vs. adopt` decision; record any such blocker as a row failure. Add `C5` to task 2.1's row list and to its Verify loop (`prompt.txt`, `output.txt`, `calls.md`, README table row)."
  }
]
