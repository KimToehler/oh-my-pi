# Design

## Context

Canonical review instructions are static Markdown and YAML in `team-config/`, installed by the existing installer. The `omp-gated` schema's `review` artifact drives plan review; `review-work/SKILL.md` drives the F2 fix waves. Both already contain the seed of this change: the schema recommends Accept "when the fix would add a mechanism, procedure or check the proposal did not ask for", and the skill already allows `GC exempt` for a commit that changes no behaviour and no review input. Neither is reached early enough: the Accept recommendation lives in step 6, after a third REJECT, and the exemption competes with "When in doubt, review".

Measurement: `runs/gate-e2e-20261029/RESULT.md`, 22 changes, 711 reviewer invocations, 683 blockers classified. Plan review is 50% of reviewer service time; 29% of its rounds follow the last consumer-visible finding. Delta rejecting rounds are 23 of 52 process-internal, F3 8 of 23, F2 7 of 22.

## Goals / Non-Goals

**Goals:** fewer complete plan-review rounds without losing a blocking finding; one eligibility definition shared by the review instruction and the fix waves; no new tooling.

**Non-Goals:** changing the blocking threshold, reviewer selection, lens count, F1/F3 ownership, gate records, validators or the ledger; any early-ask path in the post-implementation lanes; admitting the readable gate summary into the record (own plan); a delta path for commits after the final verdict (own plan); any numerical quality claim from the observational baseline.

## Decisions

### D1. Eligibility is the negation of the existing threshold, not a second predicate

`review-work/SKILL.md:200` already defines what blocks: a realistic trigger whose result (a) breaks the goal, the value proof, a merge-gate criterion or an existing consumer, or (b) reaches a protected asset. The instructions therefore do not define "consumer-visible" as a new axis; they say a blocker is Accept-eligible exactly when it misses both limbs, and they name the classes that are never eligible because their immediate observer is misleading: security and privacy paths, protected assets, any change whose mandatory class is not `none`, and any blocker whose subject is a review, gate or release mechanism that would admit unreviewed or failing work. A gate-weakening blocker is not process-internal: the gate is the change's consumer.

### D1b. Ambiguity and incompleteness block

A blocker with no stated consequence, an ambiguous or mixed one, and a round in which a dispatched lens returned no verdict are all treated as blocking. The early ask needs a complete round whose open blockers are all eligible; anything less keeps the existing path. This is the path by which a real defect would be lost, so it defaults against the ask.

### D2. Ask at the first clean round, keep the old cap for defect rounds

A complete round whose open blockers are all Accept-eligible is the point where further rounds re-examine process concerns rather than the product. The instruction asks the user there. Rounds that still hold a non-eligible blocker keep the existing path, including the cap after a third REJECT, so this change cannot shorten a review that is still finding blocking defects. The measured tails (review-trailer-repair 17 rounds, m1-anthropic-body 10, gate-durable-qa-evidence 9) are exactly the case the earlier ask ends.

### D3. No unrequested mechanism for eligible blockers; real defects get their fix

The rule moves out of step 6 into the shared disposition rules. It binds only Accept-eligible blockers: answering one with a new script, procedure or check turns the checker into the next round's review target — this session's own `verify-f1.ts` cost two rounds while correctness had been OKAY since round 2. A blocker that is not eligible is fixed with whatever the correct fix needs, including a new check; the existing rule that a fix adding a subsystem becomes its own plan is untouched.

### D3b. Only plan review gets the early ask

F2, F3 and delta waves keep `CONTINUE`/`STOP`/freeze and record an accepted blocker through `override` plus a `downgrades` entry (`accepted-residual`, `below-threshold`), as today. They inherit only the eligibility definition, the ambiguity default, the no-unrequested-mechanism rule and the exemption allow-set, so one concept has one definition across the lanes without a second convergence path. F3 reads review-work's fix-wave step, so no separate edit to `integration-review/SKILL.md` is needed; that inheritance is verified in F1.

### D4. Verify by replaying recorded rounds, not by asserting prose

No test asserts the new wording. F1 applies the installed instruction text to recorded blockers from the measurement cohort and records, per case, the instruction sentence that decided it and the decision it produced. The cases cover each requirement and its negative control: an all-eligible round reaching the ask with Accept recommended; a round holding a blocking defect; a security/credential blocker whose immediate consequence is weaker proof (must stay blocking); a round with a missing lens verdict and a blocker without a stated consequence (must not reach the ask); an eligible blocker whose fix would add an unrequested checker (must go to Accept or its own plan) against a non-eligible blocker needing a new authorization check (must be fixed in plan); a comment-only commit in unread source (exempt) against a commit in an agent-loaded instruction file and one in a plan artifact (delta review required); and one F2 case showing the inherited eligibility rule lands in `downgrades`, not in an early ask. Each row names its decision from the fixed set `ask-accept-recommended`, `fix-blocking`, `exempt`, `delta-review`, `downgrade-recorded`, so the recorded outcome is comparable rather than free prose. The existing validator, convergence and installer suites run unchanged to show no machine contract moved.

## Risks / Trade-offs

- An early Accept can let a weak verification plan through → Accept is the user's decision, is recorded in `gate.md`, and the post-implementation gates (F2/F3/delta), which reject mostly on real defects, still run.
- Eligibility is a judgement → it is bound to the one existing threshold, defaults against the ask when unclear, and keeps Fix available at every ask; the measurement's own classification was a judge estimate and is cited as observational, not as proof.
- Fewer rounds could hide a regression in review quality → D4's replay keeps the defect case blocking; the next five gated changes are observed as workflow follow-up, as in the measurement report.
- The exemption could be stretched to behaviour changes → it is written as an allow-set: exempt only when every changed line is comment or prose that no brief, plan bundle, criterion, agent-loaded instruction or build/lint/codegen/doc generator reads. Agent-loaded instruction files and plan artifacts are explicitly non-exempt.

## Migration Plan

No state or schema migration. Edit the two instruction files in the task worktree; `scripts/deploy-local.sh` installs them. Projects that hold their own copy of the `omp-gated` schema are re-installed with `install-openspec-workflow.mjs`, because deployment alone leaves them on the old stopping rule; this repository's symlinked copy needs no step. Running sessions pick up the new text after a restart. Roll back by reverting the instruction commit, redeploying and re-running the project installer.
