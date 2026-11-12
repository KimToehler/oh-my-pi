# Review

- **Verdict**: REJECT
- **Reviewed digest**: ba1edf49ef267414aeb569efe061cc6a6ff82fd8f63b4593102f04325a29b887
- **Depth**: risky
- **Reviewer**: plan-reviewer, PacRevA6, PacRevB6
- **Verifier**: blocker-verifier, PacVer6
- **Models**: PacRevA6 onara/cx/gpt-6.1-sol; PacRevB6 onara/cx/gpt-6.1-sol; PacVer6 onara/cx/gpt-6.1-sol
- **Round**: 6
- **Awaiting**: none
- **Override**: none

## Blockers

### Scope A (PacRevA6)

1. **CHECK 7 — design.md D2/D9/D12: consultation contract sources**
   - Defect: The plan independently defines the report contract in the agent's JTD output schema and in checkReport, and independently stores the template's placeholder texts in a validator constant. Sharing checkReport between session extraction and record validation does not cover the runtime's separate schema consumer; testing that the placeholder constant agrees with the template is also not a shared source. Neither duplication has a reason why its consumers cannot share one artifact. A routine schema or template update can therefore cause a runtime-accepted report or correctly filled shipped template to be rejected downstream, blocking affected risky changes. The damage is reversible, but CHECK 7 explicitly requires one truth even when the copies currently agree.
   - Evidence: openspec/changes/plan-architecture-consultation/design.md:36-49 defines the agent schema and calls it the record's report contract; :166 separately specifies checkReport's type, field, enum and limit checks; :200 calls these checks project-specific implementations of that schema. The runtime separately consumes the declared output schema through packages/coding-agent/src/task/executor.ts:121-122, with JTD object validation translated at packages/coding-agent/src/tools/jtd-to-json-schema.ts:74-96. design.md:159 explicitly requires another copy of the template slot texts in a constant, synchronized by a test. D12 at :204 shares checkReport only between the two downstream validator consumers.
   - Change: Name a single authoritative artifact for the report contract that both runtime output admission and consultation validation consume, keeping genuinely additional record constraints explicit. Derive unfilled-slot comparisons from the shipped template rather than copying its strings. Alternatively, document a concrete reason why each contract cannot be shared, as CHECK 7 permits; an equality test alone is not that reason.
   - Verifier: confirmed, blocking true, protected false: The plan explicitly duplicates both concepts: design.md:36-49 declares the agent's report schema, while :166 and :200 prescribe independent type/enum/limit checks implementing that schema; :204 shares checkReport only between session extraction and record validation. D12 reads the agent definition for its model pin, not to derive report validation from its schema. Separately, :159 requires a validator constant copying the shipped template's slot texts, with an agreement test rather than shared consumption. No concrete inability to share either artifact is documented. An ordinary subsequent schema update can therefore admit reports through runtime validation while rejecting them through the unchanged consultation validator. This is a delivered-design defect, so tests detecting disagreement do not resolve it. packages/coding-agent/src/prompts/agents/plan-reviewer.md:83 expressly makes two independent derivations blocking even when they currently agree, unless they consume a shared artifact/function or document why they cannot. Neither duplication is an accepted residual or out-of-scope item in gate.md.

## Residuals

none
