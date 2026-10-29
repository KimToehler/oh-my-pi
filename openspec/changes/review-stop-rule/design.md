# Design

## Context

Canonical review instructions are static Markdown and YAML in `team-config/`, installed by the existing installer. The `omp-gated` schema's `review` artifact drives plan review; `review-work/SKILL.md` drives the F2 fix waves. Both already contain the seed of this change: the schema recommends Accept "when the fix would add a mechanism, procedure or check the proposal did not ask for", and the skill already allows `GC exempt` for a commit that changes no behaviour and no review input. Neither is reached early enough: the Accept recommendation lives in step 6, after a third REJECT, and the exemption competes with "When in doubt, review".

Measurement: `runs/gate-e2e-20261029/RESULT.md`, 22 changes, 711 reviewer invocations, 683 blockers classified. Plan review is 50% of reviewer service time; 29% of its rounds follow the last consumer-visible finding. Delta rejecting rounds are 23 of 52 process-internal, F3 8 of 23, F2 7 of 22.

## Goals / Non-Goals

**Goals:** fewer complete plan-review rounds without losing a consumer-visible defect; one disposition rule shared by the review instruction and the fix waves; no new tooling.

**Non-Goals:** changing the blocking threshold for real defects, reviewer selection, lens count, F1/F3 ownership, gate records, validators or the ledger; admitting the readable gate summary into the record (own plan); a delta path for commits after the final verdict (own plan); any numerical quality claim from the observational baseline.

## Decisions

### D1. "Consumer-visible" is the existing blocking threshold, not a new axis

The skills already define the blocking threshold in terms of a realistic failure of a goal, a gate criterion or an existing consumer. This change does not add a second vocabulary: it names the question the orchestrator must answer per blocker ("what would a user or a downstream consumer observe if this shipped unchanged?") and attaches the disposition to that answer. Severity words, lens identity and reviewer phrasing do not decide it.

### D2. Ask at the first clean round, keep the old cap for defect rounds

A round whose blockers are all process-internal is evidence that the reviewers have run out of consumer-visible findings, not that the remaining blockers are wrong. The instruction therefore asks the user at that point. Rounds that still contain a defect keep the existing path, including the cap after a third REJECT, so this change cannot shorten a review that is still finding defects. The measured tails (review-trailer-repair 17 rounds, m1-anthropic-body 10, gate-durable-qa-evidence 9) are exactly the case the earlier ask ends.

### D3. No new mechanism as a fix, stated once and shared

The rule moves out of step 6 into the disposition rules both surfaces read. It is the generalisation of this session's own failure: answering an evidence blocker with `verify-f1.ts` turned the checker into the review target for two further rounds, while the correctness lens had been OKAY since round 2.

### D4. Verify by replaying recorded rounds, not by asserting prose

No test asserts the new wording. F1 applies the written procedure to recorded rounds from the measurement cohort, including one round with a consumer-visible defect (the procedure must keep it blocking) and one process-internal round (the procedure must reach the ask with Accept recommended), and records each decision with its evidence. The existing validator, convergence and installer suites run unchanged to show no machine contract moved.

## Risks / Trade-offs

- An early Accept can let a weak verification plan through → Accept is the user's decision, is recorded in `gate.md`, and the post-implementation gates (F2/F3/delta), which reject mostly on real defects, still run.
- "Consumer-visible" is a judgement → the plan keeps Fix available at every ask and changes no threshold; the measurement's own classification was a judge estimate and is cited as observational, not as proof.
- Fewer rounds could hide a regression in review quality → D4's replay keeps the defect case blocking; the next five gated changes are observed as workflow follow-up, as in the measurement report.
- The exemption could be stretched to behaviour changes → the requirement names what stays reviewable: anything a brief or criterion reads, plan edits to criteria/risks/scope/rows, and directive comments.

## Migration Plan

No state or schema migration. Edit the two instruction files and the README in the task worktree; the existing installer deploys them; running sessions pick them up after a restart. Roll back by reverting the instruction commit and redeploying.
