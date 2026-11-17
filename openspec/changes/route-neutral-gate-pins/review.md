# Review

- **Verdict**: REJECT
- **Reviewed digest**: a83c719eeb40dc854ba86089fa608c8a3f715e9645efc213ae7257fb6ac79156
- **Depth**: risky
- **Reviewer**: plan-reviewer, PlanReviewR1ScopeA, PlanReviewR1ScopeB
- **Verifier**: blocker-verifier, none
- **Models**: PlanReviewR1ScopeA openai-codex/gpt-6.1-sol; PlanReviewR1ScopeB openai-codex/gpt-6.1-sol
- **Round**: 1
- **Awaiting**: triage
- **Override**: none

## Blockers

### Scope A (PlanReviewR1ScopeA)

1. **Area**: Correctness — helper dependency cutover
   **Defect**: Tasks 1.1–1.2 add a static dependency without migrating the deployed-layout fixture. Running the named validator suite would make its contract-source cases fail during module loading, before their assertions. This is reversible but breaks an existing consumer.
   **Evidence**: tasks.md:7-8 and design.md:39 introduce model-name.mjs and import it into validate-openspec-change.mjs. team-config/agent/skills/review-work/scripts/validate-openspec-change.test.ts:1129-1139 copies an explicit list containing only validate-openspec-change.mjs, folder-plan.mjs and plan-contract.mjs. Its consumers at :1156, :1179 and :1193 execute that incomplete copy.
   **Change**: Include migration of skillCopy()'s dependency list in task 1.2 so its copied validator also receives model-name.mjs.
   **Verifier**: not triaged: the verifier has not returned

2. **Area**: CHECK 7 — independently derived model identity
   **Defect**: The shared helper serves only the executable validators; tasks 2.1–2.2 independently reimplement the same identity derivation in both model-applied checks. No reason explains why those checks cannot consume the installed helper. This violates the required single truth and the design's one-rule goal.
   **Evidence**: design.md:20 promises one rule; :39 shares bareModelName between validators. tasks.md:12-13 instead prescribe independent last-path-segment comparisons. The existing helper at team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:184-186 also trims and lowercases, operations absent from those instructions. Both instruction surfaces already execute commands (schema.yaml:565-567; SKILL.md:351).
   **Change**: Have both instruction checks consume the installed model-name helper or its shared output, retaining their distinct pin sources, effort policies and exact session-route binding.
   **Verifier**: not triaged: the verifier has not returned

### Scope B (PlanReviewR1ScopeB)

3. **Area**: Verification — tasks 2.2 and 3.5
   **Defect**: No planned test exercises the new single-route-per-dispatch requirement. A normal cross-provider fallback could retain the pinned model and effort while changing provider; an implementation omitting the route-uniformity check would pass every listed row and could accept a misleading single-route gate record. The resulting gate/provenance error is recoverable by re-review.
   **Evidence**: specs/post-implementation-review/spec.md:7 requires “all turns on one `provider/model`”; tasks.md:13 explicitly adds that check. However, tasks.md:21 tests a uniformly direct-provider session, and tasks.md:24 tests different-model substitution and a trailer disagreeing with a uniformly routed session—not two routes for the same model. Configured fallback candidates preserve distinct provider-qualified selectors in packages/coding-agent/src/task/executor.ts:355-364.
   **Change**: Add an F1 seeded row containing turns on both `onara/cx/gpt-6.1-sol` and `openai-codex/gpt-6.1-sol`, all at high effort, with an otherwise valid trailer naming one route. Apply the delivered Phase 3 instruction in a fresh ordinary session and retain its reads, rejection and bounded-retry outcome. This row must fail if the single-route check is omitted.
   **Verifier**: not triaged: the verifier has not returned

## Residuals

none
