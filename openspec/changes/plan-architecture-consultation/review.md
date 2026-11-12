# Review

- **Verdict**: REJECT
- **Reviewed digest**: a5ee305e664275f143a8c5079401f2e8f8a7654fc8c4a656cd0411eef76fdf2b
- **Depth**: risky
- **Reviewer**: plan-reviewer, PacRevA7, PacRevB7
- **Verifier**: blocker-verifier, PacVer7
- **Models**: PacRevA7 onara/cx/gpt-6.1-sol; PacRevB7 onara/cx/gpt-6.1-sol; PacVer7 onara/cx/gpt-6.1-sol
- **Round**: 7
- **Awaiting**: none
- **Override**: none

## Blockers

### Scope A (PacRevA7)

1. **Correctness — existing plan-review contract**
   - Defect: The plan adds a skip-or-stop ask after two failed consultation attempts while explicitly leaving the existing 'The user is asked only on named exceptions' requirement unchanged. A normal installation missing the Fable model entry reaches this new ask before any reviewer finding exists, so none of the existing requirement's permitted conditions holds. Implementing the planned recovery path therefore violates the published plan-review contract. This is reversible by correcting the spec delta; it does not require changing the chosen consultation behaviour.
   - Evidence: openspec/changes/plan-architecture-consultation/proposal.md:26-28 declares no modified capabilities and says the existing openspec-plan-review requirements keep their text. design.md:95-97 requires the new ask after two failures; tasks.md:15 implements it. In contrast, openspec/specs/openspec-plan-review/spec.md:288-290 says the instruction SHALL ask only for its enumerated finding/budget/scope exceptions and otherwise SHALL decide without asking.
   - Change: Declare openspec-plan-review as a modified capability and include a MODIFIED block for 'The user is asked only on named exceptions', narrowly adding the consultation-failure skip-or-stop ask and its negative control. Preserve the existing restrictions on all other asks.
   - Verifier: confirmed, blocking true, protected false: The delivery rules contradict each other. design.md:95-97 requires a skip-or-stop ask after two failed attempts, and proposal.md's Impact explicitly identifies existing installations missing the model entry as a trigger. That can occur before any reviewer finding or unresolved scope decision. openspec/specs/openspec-plan-review/spec.md:288-290 permits asks only for its enumerated finding, budget and scope exceptions, whereas proposal.md:26-28 explicitly leaves those requirements unchanged. This normal installation path therefore violates an existing consumer contract. It is a specification defect, not missing verification; later checks do not resolve it.

2. **Build vs. adopt — report schema check**
   - Defect: The Repository entry for the new JTD-subset validator gives filenames but no PATH:LINE references. This does not satisfy the explicitly required build/adopt record, so the plan's decision to build the validator lacks the prescribed source-grounded repository-stage evidence. Under this assignment's build/adopt rule, that missing fact blocks the value proof even though the other stages and a build gap are present.
   - Evidence: openspec/schemas/omp-gated/schema.yaml:213-215 requires the Repository entry to contain PATH:LINE evidence, or 'none' with the paths searched. openspec/changes/plan-architecture-consultation/design.md:204-208 introduces the report-schema checker, but line 205 cites only output-schema-validator.ts and jtd-to-json-schema.ts without line locations. Relevant existing boundaries are packages/coding-agent/src/tools/output-schema-validator.ts:81,101 and packages/coding-agent/src/tools/jtd-to-json-schema.ts:365,377.
   - Change: Complete that Repository entry with precise PATH:LINE references to the existing validator and schema-normalisation/conversion entry points, retaining the explanation of why they cannot be reused by the deployed standalone script.
   - Verifier: confirmed, blocking true, protected false: schema.yaml:205-219 expressly covers a newly introduced general-purpose format validator and requires a Repository entry containing PATH:LINE evidence (or 'none' with searched paths). design.md:204-208 chooses to build the report schema checker, but its Repository entry supplies only filenames, not line references. Actual source-grounded boundaries exist at output-schema-validator.ts:81,101 and jtd-to-json-schema.ts:365,377. The stated deployment gap does not substitute for the separately required repository evidence. Thus the build/adopt decision lacks a mandatory part of its value proof; this is a deliverable omission rather than a request for additional verification.

## Residuals

none
