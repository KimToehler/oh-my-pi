# Proposal

## Why

After implementation, a gated change runs three lanes (F1 manual QA, F2 `review-work`, F3 `integration-review`), each with its own waves and fix deltas and no round limit short of a convergence STOP. Those lanes carry 65% of reviewer cost and 50% of reviewer service time (`runs/gate-e2e-20261029/RESULT.md`, 22 changes), and most of the time goes into the machinery rather than the findings. plan-review-proportional took 4 F2 waves, 4 F3 waves, 4 F1 re-runs and about 33 commits after implementation. About 7 of its 11 F2 fix rows corrected plan text or Verify commands the change itself had introduced. Unlike plan review, the findings themselves are mostly real: 87 of 126 oh-my-pi post-implementation blockers were product defects, concentrated in concurrency-state, wire-contract and auth changes. Instruction-only changes had 0-1 real defect each but carried 1-21 F1 rows. So the lanes should follow the change's risk and run on the strongest measured reviewer, without adding a findings filter. The plan-review side of this shipped in plan-review-proportional (archived 2026-11-02).

## What Changes

- **BREAKING** (review workflow): post-implementation review depth follows the change's `Depth`, the field plan-review-proportional introduced in `gate.md`. A plan-mode plan, which has no `gate.md`, derives the same value in Phase 0.5 from its class and from whether it changes a review, gate or release mechanism. The orchestrator may raise the depth, never lower it.
  - `standard`: one `implementation-audit` lane.
  - `risky`: `implementation-audit` plus `strategic-risk-review`, dispatched in parallel. Today the second lane waits for the audit findings.
- **BREAKING**: F3 leaves the final verification wave of gated plans. Its whole-diff surface (cross-module seams, simplification, consistency) moves into the briefs: into section 2 of `implementation-audit` for `standard`, and into a rewritten four-question `strategic-risk-review` brief for `risky`. `gate.md` and plan merge gates record `Whole-diff review: not needed (whole-diff surface reviewed in F2)`. `integration-review` stays available as an on-demand whole-branch review outside the gate.
- Both gate lanes run on `auditor`, pinned in its frontmatter to `onara/cx/gpt-6.1-sol:high`. Today `auditor` resolves `@review` = `terra:high`, and the second lane runs on `oracle` = `sol:xhigh`. A dispatch whose session ran on another model or effort makes that invocation INCONCLUSIVE, and it is re-run, mirroring plan-review D10. A conflicting `task.agentModelOverrides.auditor` stops the gate before dispatch.
- A fixed fix-round budget replaces the open wave loop: `standard` allows 1 fix round and `risky` 2, each followed by its closing wave. If a closing wave still fails, the user is asked once before any edit: one more fix round, re-plan or Stop. Override is offered as well, but only when every open blocker is eligible or covered under `Blocker disposition`, never for an excluded one. An earlier `gate-convergence` STOP keeps its current ask. Raising an `internal-tooling` plan to `risky` first re-tiers it to `product`.
- F1 is proportional. `standard` runs one row per requirement plus the existing minimum (happy path, riskiest edge, one adjacent regression), and `risky` runs one row per scenario. A fix stales only the rows whose observed behaviour its diff can change. The orchestrator carries every other row with a one-line reason, and the fix-delta brief lists the carried rows so the delta check can object.
- The decomposed review (a candidate list, then one verification per candidate) is not adopted. It made `gemini-3.8-flash-high` find real blockers (`runs/review-argon-20261102/RESULT.md`, Addendum 3), but its effect on `sol:high` is unmeasured. It stays an open option for a later change.

## Capabilities

### New Capabilities

- `post-implementation-review`: depth, lanes and the whole-diff surface of the F2 gate, the reviewer model pin, the fix-round budget and its exhaustion ask, and F1 scope and re-run rules.

### Modified Capabilities

- `review-blocker-disposition`: the requirement "One disposition definition for the post-implementation lanes" names F3 as a gate lane. It now names `integration-review` as an on-demand lane that still references the shared definition.

## Impact

- `team-config/agent/skills/review-work/SKILL.md`: Phase 0.5 (depth), Phase 1 (F1 scope and re-runs), Phase 2 (both briefs, parallel dispatch, model pin), the model-resolution note (`:135`, still says GPT-5.6 via `@review`), Fix waves (budget, exhaustion ask, carried rows in the delta brief), Phase 4 (Override after the budget).
- `team-config/agent/agents/auditor.md`: `model:` changes from `"@review"` to `onara/cx/gpt-6.1-sol:high`. This also affects the other `auditor` uses named in `team-config/agent/rules/delegation.md:15`.
- `team-config/agent/rules/delegation.md`: one sentence saying that read-only reviewers of the same committed inputs do not overlap, so both gate lanes share a batch (design D8).
- `team-config/agent/skills/integration-review/SKILL.md`: scoped to on-demand use, with no F3 gate role.
- `team-config/agent/rules/plan-merge-gate.md`: the final verification wave becomes F1, F2 and the default `Whole-diff review` value.
- `omp-gated` schema `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` and its `gate`/`tasks` templates: F3 row and `Whole-diff review` guidance. `team-config/README.md`: review section.
- Unchanged in this change (follow-up "Slice B"): `validate-gate-record.mjs`, `trailer.mjs`, `gate-convergence.mjs`, record v3 (`whole_diff`, `reviewers_run`, `sections_covered`, `adversarial_criteria`), the per-wave GC flow and `plan_sha256` binding of `tasks.md`. This change fits inside their current contracts (see design.md D1).
- Installed copies: `scripts/deploy-local.sh` for this agent directory; onara and weaver rerun `install-openspec-workflow.mjs`.
