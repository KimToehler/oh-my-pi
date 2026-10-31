# Review

- **Verdict**: REJECT
- **Reviewed digest**: 9c99b7029076c72de0249c7db47763bc8663ef0143a040e0b0490a55b344ae20
- **Reviewer**: plan-reviewer, LensCorR1, LensVerR1, LensChkR1
- **Round**: 1
- **Override**: none

## Blockers

### Correctness (LensCorR1)

[
  {
    "area": "Correctness — threshold-breaking verification blockers",
    "defect": "Narrowing the class exclusion also makes verification-only blockers that fail the threshold non-excluded. Existing coverage and explicit-user-request paths can then leave them unfixed, contrary to the plan’s claim that missing proof of material behaviour still blocks on classified changes.",
    "evidence": "design.md:12-17, 29-31 says Accept is limited to verification blockers that pass the threshold and leaves coverage and explicit requests unchanged. But review-work/SKILL.md:433-441 permits a non-excluded blocker that breaks the threshold to be covered by a matching reviewed residual, and permits explicit acceptance of a non-eligible, non-excluded blocker at plan review, freeze or delta accept. For example, a classified change’s verification-only blocker says a disposable F1 scenario cannot detect a material failure; after the proposed bullet change, a user can explicitly accept it even though the proof remains missing. The decision is reversible by a later review, but it can allow the current change to proceed without that proof.",
    "change": "Preserve exclusion for verification-only blockers that fail the threshold, or explicitly redesign and specify the covered and user-request paths so the promised material-proof boundary holds across every lane."
  },
  {
    "area": "Correctness — F1 evidence exclusion",
    "defect": "The planned README asserts that all F1 evidence blockers remain excluded at F2 and F3, although the authoritative rule excludes only QA artifacts the validator binds. This misstates eligibility for ordinary F1 outputs that are not bound and contradicts the shared policy the change is meant to expose.",
    "evidence": "tasks.md:9 requires adding “At F2 and F3, blockers about F1 evidence stay excluded as audit trail.” review-work/SKILL.md:426-427 limits that exclusion to the gate record, trailers, and QA artifacts the validator binds; design.md:37 itself says F1 blockers usually concern bound evidence. For a verification-only bookkeeping blocker involving an unbound F1 output, with no other exclusion and material behaviour otherwise proven, the shared rule permits eligibility while the new README says it is excluded. The resulting unnecessary fix or refusal is reversible but defeats the intended availability of Accept.",
    "change": "Qualify the README statement to cover only F1 artifacts actually bound by the validator, and keep the task and design consistent with that scope."
  }
]

### Checks (LensChkR1)

[
  {
    "area": "CHECK 6 — entry-path parity, task 2.1",
    "defect": "F2, delta review and F3 consume the changed eligibility rule but have no path-specific controls. On a classified change with a verification-only bookkeeping blocker, those lanes could fail to offer an otherwise eligible disposition, or offer one despite an exclusion, without the planned F1 detecting it. The resulting review decision is reversible before merge, but an incorrect disposition can affect what is allowed to ship.",
    "evidence": "proposal.md:30 applies the narrowed exclusion to plan review, F2, delta review and F3; design.md:40 confirms the post-implementation paths consume it. tasks.md:15 exercises only plan-review sessions and explicitly lists F2, delta and F3 as unexercised. The actual consumers are team-config/agent/skills/review-work/SKILL.md:370, :466, :478 and team-config/agent/skills/integration-review/SKILL.md:149.",
    "change": "Add a discriminating control for each affected path, exercising its own disposition decision on a classified change, including an eligible verification-only blocker and an applicable exclusion, or provide a path-specific reason and evidence that the changed decision cannot occur there."
  }
]
