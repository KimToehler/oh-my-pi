# Proposal

## Why

The merged depth-proportional plan review replaced three fixed lenses with a bounded loop: one reviewer for standard depth, two scope reviewers for risky depth, plus fresh blocker-verifier triage. Its accepted recall risk remains unmeasured. The local historical corpus holds 85 labelled latent defects over five plans but no sol:high plan-review run; this change measures single-reviewer discovery and triage losses against that baseline without changing the deployed workflow.

## What Changes

- A frozen replay protocol for the plan-review loop: pinned corpus inputs by digest, one arm per loop shape, fixed model and effort per arm, blinded scoring, and a retained per-trial record. It follows the shape of the existing `runs/review-effort-20261029` protocol, which the repository already uses for this kind of question.
- New dispatches for the arms the corpus lacks: three independent single-reviewer sol:high trials per plan and one same-brief terra:medium control per plan, each followed by the current verifier. Historical Focus and Replay results remain labelled historical references, not contemporaneous randomized controls. Corpus blocker_matches are prior annotations, not executable match rules for new replies; blinded snapshot-based adjudication supplies new matches.
- A tracked, deterministic scorer (`scripts/score-plan-review-replay.ts`, tested under `bun run test:scripts`) that reads a replay directory plus the labelled corpus and emits the comparison: hits against each plan's latent set, findings the `blocker-verifier` triage would move to Residual (the loop's false-drop surface), unmatched findings sent to adjudication rather than counted as false positives, and cost and elapsed time per arm. It computes, never judges: every classification it cannot derive from a match rule it lists for a human or a judge.
- A committed result under `.omp/team-config/evidence/`: the conclusion, the per-arm table, and the digests of the local inputs it was computed from, so the finding stays auditable after the untracked `runs/` data is gone.
- Report historical review-record round numbers and a bounded-round counterfactual separately from measured first-pass discovery. Do not attribute rounds saved to this experiment: it neither fixes historical plans nor runs complete review/fix cycles. Latest review records alone cannot identify the workflow used in every preceding round.

Not in scope: changing the merged review loop, production briefs, agent definitions, model roles or gate rules; implementing the parked review-replay-bench metaharness rig; benchmarking risky-depth two-reviewer execution; replaying full fix cycles; or re-running historical F2/F3 reviews. This change's own F1/F2/F3 verification remains required.

## Capabilities

### New Capabilities

- `plan-review-measurement`: measuring a plan-review loop against a labelled defect corpus — what a replay trial must pin and retain, how a reviewer finding is matched to a known defect, how a dropped finding is distinguished from a finding that was never made, and what the report must separate before anyone reads a conclusion from it.

### Modified Capabilities

None. `openspec-plan-review` describes the loop under test and does not change.

## Impact

- New: `scripts/score-plan-review-replay.ts` and `scripts/score-plan-review-replay.test.ts`, run by the existing `bun run test:scripts`. No new dependency, no package or CLI surface.
- New: a result artifact under `.omp/team-config/evidence/plan-review-measurement/`.
- Reads, never writes, the untracked local corpus `runs/evo-deleg/plan-review-experiment.json` (`/runs/` is gitignored, so inputs are pinned by digest instead of committed) and writes its new trials beside it.
- Spends model budget: the new dispatches are the only cost, bounded by the arm table in `design.md`.
- No production model-role setting, agent definition or schema is touched, so no deployed session changes behaviour.
