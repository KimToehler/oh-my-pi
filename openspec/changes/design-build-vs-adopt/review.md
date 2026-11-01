# Review

- **Verdict**: REJECT
- **Reviewed digest**: b3eae5f35ff6dd59e0ef6dc9a2fd7c63b38ddc95817eae51da0d9821f07ed45a
- **Reviewer**: plan-reviewer, DbaCorrectnessR4, DbaVerificationR4, DbaChecksR4
- **Round**: 4
- **Override**: none

## Blockers

### Correctness (DbaCorrectnessR4)

[
  {
    "area": "correctness — enforcement of the new lens check",
    "defect": "E3 states unconditionally that a covered mechanism without its subsection, a subsection missing a line or candidate fact, an open Decision, or a gap-less build/reject verdict \"is a blocker\". The agent that receives this lens paragraph is bound by its own contract, which subordinates exactly this kind of rule-derived gap to a threshold: a finding only blocks when a realistic trigger makes it break the goal, the value proof, a Merge gate criterion or an existing consumer, or reach a protected asset — otherwise it is a note (\"A false note costs nothing; a false blocker costs a fix wave\"). A design.md whose Build vs. adopt subsection merely lacks the Platform line, or whose Decision reads `open, search failed: …`, breaks no goal, consumer or protected asset of the reviewed plan, so a reviewer applying its contract will record a note and return OKAY. The plan nowhere reconciles the two (no occurrence of \"threshold\" or of the reviewer's decision rule in proposal.md, design.md, gate.md or spec.md), so its only enforcement mechanism — there is no validator or script, by design (proposal.md Impact: \"No script, validator, record format or package code changes\") — can silently not fire, and the rows that are supposed to prove it (C2, C3, C4) are the ones most likely to fail.",
    "evidence": "packages/coding-agent/src/prompts/agents/plan-reviewer.md:75 (\"that gap is a blocker when it meets the blocking threshold in <decision>, otherwise a note\") and :90 (\"mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer … or (b) reaches a protected asset\"); the lens text that contradicts it: openspec/changes/design-build-vs-adopt/design.md:93-97 (E3, \"… a subsection missing a line or a candidate fact the paragraph's form asks for, a Decision still open, or a build or reject verdict without a gap is a blocker.\"); the requirement it must satisfy: openspec/changes/design-build-vs-adopt/specs/openspec-design-adoption/spec.md:115 (\"SHALL return a blocker when … a decision lacks a line or candidate fact the form asks for, when a Decision is still open\") and :125 (Negative control: \"MUST fail with REJECT\"); the planned proofs that depend on it: design.md:147-149 (C2, C3, C4 expect REJECT for a missing gap, a missing Platform line and an open Decision). For contrast, every existing lens paragraph (schema.yaml:357-363, :367-388) states a focus, never a verdict, and the only unconditional \"is a blocker\" rules live inside the reviewer's own prompt next to the threshold (plan-reviewer.md:86).",
    "change": "Make E3 decide the blocker question inside the reviewer's contract instead of beside it: state in the inserted sentence why such a gap meets the threshold (e.g. that an undocumented or incomplete Build vs. adopt decision breaks the reviewed plan's own goal, so it is reported as a blocker and not as a note), or have it name the gap as a Merge-gate-criterion failure. Record that reconciliation as a Decision in design.md (which reviewer rule the sentence overrides and why), and keep C2-C4 as its proof."
  }
]
