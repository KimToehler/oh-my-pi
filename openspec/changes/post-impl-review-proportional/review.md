# Review

- **Verdict**: REJECT
- **Reviewed digest**: 47a440339dc138aea2ec1a23b910207418de0eae55f51884bd2d83ccb3f8ce53
- **Depth**: risky
- **Reviewer**: plan-reviewer, PlanRevR2A, PlanRevR2B
- **Verifier**: blocker-verifier, none
- **Models**: PlanRevR2A onara/cx/gpt-6.1-sol; PlanRevR2B onara/cx/gpt-6.1-sol
- **Round**: 2
- **Awaiting**: triage
- **Override**: none

## Blockers

### Scope A (PlanRevR2A)

1. **Area**: CHECK 8 — Required-depth fallback in D2
   **Defect**: When an internal-tooling plan derives risky depth because it changes a review/gate/release mechanism, declining the re-tier permits standard review instead. This is not merely declining an optional elevation: it bypasses the required second invocation. The resulting gate is under-reviewed; recovery requires correcting the classification and repeating review.
   **Evidence**: openspec/changes/post-impl-review-proportional/specs/post-implementation-review/spec.md:11 requires risky depth for mechanism changes and says the orchestrator SHALL NOT lower it. However, :30-31 explicitly says that without re-tier agreement the gate keeps standard. design.md:46 and tasks.md:9 prescribe the same fallback. design.md:48 rejects precisely the outcome of reviewing a class-none mechanism change with only one reviewer. The validator permits a class-none internal-tooling record with exactly implementation-audit (team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:655-662), so it will not catch this downgrade.
   **Change**: Distinguish optional elevation from required risky classification. If risky depth is required and the user declines re-tiering, stop the gate without dispatching or permitting a standard record. Update the requirement, D2 and task 2.1 consistently; retain standard only when the rule genuinely derives standard.
   - not triaged: the verifier has not returned

2. **Area**: Correctness — D4 outcome normalization versus the retained trailer contract
   **Defect**: After both the original dispatch and its retry run on a substitute model but return otherwise valid PASS trailers, D4 makes the invocation INCONCLUSIVE. The retained wave instructions then require submitting that PASS trailer with the INCONCLUSIVE outcome, which GC rejects. Thus the planned failure path cannot record its wave under the claimed unchanged GC flow. This is recoverable workflow blockage, not a passing review.
   **Evidence**: openspec/changes/post-impl-review-proportional/design.md:75 and tasks.md:10 require model mismatches to become INCONCLUSIVE, including after the bounded retry; specs/post-implementation-review/spec.md:59 defines that disposition. proposal.md:36 explicitly retains the per-wave GC flow. That flow requires a trailer even for an INCONCLUSIVE invocation whose reply contains one (team-config/agent/skills/review-work/SKILL.md:455-457). GC checks the submitted trailer against the normalized outcome (scripts/gate-convergence.mjs:557-560), and scripts/trailer.mjs:167-168 refuses PASS versus INCONCLUSIVE. Editing or repairing the reviewer's verdict is not a valid remedy: SKILL.md:304 requires verbatim storage and :347 requires trailer repair to keep the verdict.
   **Change**: Specify how rejected-model replies are retained as evidence but excluded from accepted invocation trailers. Record INCONCLUSIVE without passing a contradictory PASS/FAIL trailer, which the current GC implementation already permits. Apply this explicitly to both exhausted attempts, without rewriting their replies, and retain a successful GC recording in the existing mismatch verification scenario.
   - not triaged: the verifier has not returned

3. **Area**: CHECK 6 — Fresh-gate versus existing-gate re-tier ordering
   **Defect**: The new Phase 0.5 transition assumes an existing internal-tooling baseline. On a fresh gate—the path explicitly exercised by F1-C(d)—there is none yet, so GC retier refuses. Deferring the command until after the ordinary baseline is insufficient if the plan has already been changed to product: that baseline then records product and retier again refuses. The planned fresh-gate transition therefore needs an explicit initialization order. The failure is reversible but blocks the required dispatch path.
   **Evidence**: openspec/changes/post-impl-review-proportional/design.md:46 and tasks.md:9 place the set-product/GC-retier transition in Phase 0.5; tasks.md:27 requires its ledger event before both reviewers run. The existing workflow first initializes GC in the Phase 1 preamble (team-config/agent/skills/review-work/SKILL.md:160,449-451). scripts/gate-convergence.mjs:642-645 calls readLedger and requires its tier to be internal-tooling; readLedger refuses a missing baseline at :127-130. baseline records the plan's current tier at :317-321, so initializing only after changing the plan records product instead.
   **Change**: Design both entry paths explicitly. For a fresh gate that must retain a retier event, initialize the baseline under the original internal-tooling classification, then obtain agreement, change the plan and run retier before any snapshot or reviewer dispatch. For an already-baselined gate, use the existing transition. Reconcile this ordering with default-branch integration and verify the fresh path required by F1-C(d).
   - not triaged: the verifier has not returned

### Scope B (PlanRevR2B)

4. **Area**: Quality and verification — reviewer history and effort
   **Defect**: F1-C tests wrong trailer models and a conflicting configuration override, but never tests rejecting a completed child whose trailer names the correct model while its session history shows another model or lower effort. An implementation that checks only the trailer and pre-dispatch configuration could pass every planned fixture while omitting the new history/effort check. This leaves a material requirement unproven; repairing the verification is reversible.
   **Evidence**: specs/post-implementation-review/spec.md:59 requires every assistant turn and the pinned effort to match; :66-69 explicitly requires rejecting same-model medium-effort execution. tasks.md:27 supplies wrong-model trailer payloads in sessions (a)/(b), while (c) rejects a medium override before dispatch. tasks.md:10 checks only that history://, thinking_level_change and agentModelOverrides appear in Phase 3. Actual effort can differ from the definition: packages/coding-agent/src/task/executor.ts:4732-4744 gives caller effort precedence over the explicit model suffix.
   **Change**: Add a fresh-session negative run with a correct-model PASS trailer but mismatched child-session history, including same-model lower effort. Retain the history inspection and resulting INCONCLUSIVE/retry interactions. Show that removing the history/effort comparison would make this observation fail; do not substitute another wrong-trailer fixture.
   - not triaged: the verifier has not returned

5. **Area**: Quality and verification — declared Depth precedence
   **Defect**: No fixture distinguishes reading gate.md Depth from recomputing depth solely from Mandatory class and mechanism changes. Standard F1-A and concurrency-state F1-B agree with the old class-based lane selection; F1-C tests plan-mode derivation instead. Ignoring an explicitly risky OpenSpec Depth can therefore pass the planned verification. Normal use of an elevated class-none plan would lose its second lane, violating the never-lower criterion. The missing evidence is reversible by extending the fixture.
   **Evidence**: specs/post-implementation-review/spec.md:11 requires consuming gate.md Depth and never lowering it; :33-36 makes lowering a declared-risky gate the negative control. tasks.md:25 uses class none/standard, :26 uses concurrency-state/risky, and :27 uses plan-mode mechanism-derived risky. The check in tasks.md:9 tests keyword presence, not Depth precedence. team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:656-659 requires both lanes only when mandatory_class is not none, so the unchanged validator suite does not fill this gap.
   **Change**: Add an OpenSpec fixture with Risk tier product, Mandatory class none, explicitly declared Depth risky, and a small ordinary diff that does not independently trigger mechanism-derived risky. Observe both lanes in one batch despite the small diff, and reject a single-lane result. Retain the consumed Depth and dispatch evidence.
   - not triaged: the verifier has not returned

6. **Area**: Executability — risky budget fixture
   **Defect**: F1-B requires a real first review wave over one planted defect, then assumes a controlled 3→2→1 blocker trend. The real wave is not constrained to produce three distinct blocker classes. A normal result of one blocker causes the fixed wave-3 total of one to trigger the existing convergence STOP, so this run cannot establish the intended spent-budget ask with CONTINUE at wave 3. The fixture can be repaired without changing delivered behaviour.
   **Evidence**: tasks.md:26 simultaneously specifies 'one planted real defect', 'wave 1 runs for real', counts '(3, 2, 1)', and a required CONTINUE at wave 3. team-config/agent/skills/review-work/scripts/gate-convergence.mjs:283-296 returns STOP at wave 3 when the current total is at least the first-wave total. Thus an ordinary actual first-wave total of one followed by the specified final total of one takes the wrong branch.
   **Change**: Separate the real risky parallel-dispatch/brief proof from a budget-transition session with a fully controlled first-through-third-wave outcome sequence, or specify an executable setup that establishes the required initial count and preserves the intended trend without inventing reviewer blockers. Retain GC decisions showing that the budget test actually reaches CONTINUE at wave 3 before its ask.
   - not triaged: the verifier has not returned

## Residuals

none
