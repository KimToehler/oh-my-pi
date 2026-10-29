# Design

## Context

Canonical review instructions are static Markdown and YAML in `team-config/`, installed by the existing installer. The `omp-gated` schema's `review` artifact drives plan review; `review-work/SKILL.md` drives the F2 Phase 4 record, the fix waves and delta reviews; `integration-review/SKILL.md` Step 4 makes the F3 STOP and freeze decision. The first two already contain the seed of this change: the schema recommends Accept "when the fix would add a mechanism, procedure or check the proposal did not ask for", and the skill already allows `GC exempt` for a commit that changes no behaviour and no review input. Neither is reached early enough: the Accept recommendation lives in step 6, after a third REJECT, and the exemption competes with "When in doubt, review".

Measurement: `runs/gate-e2e-20261029/RESULT.md`, 22 changes, 711 reviewer invocations, 683 blockers classified. Plan review is 50% of reviewer service time; 29% of its rounds follow the last consumer-visible finding. Delta rejecting rounds are 23 of 52 process-internal, F3 8 of 23, F2 7 of 22.

## Goals / Non-Goals

**Goals:** fewer complete plan-review rounds without losing a blocking finding; one eligibility definition shared by the review instruction and every post-implementation lane; no new tooling.

**Non-Goals:** changing the blocking threshold, reviewer selection, lens count, F1/F3 ownership, gate records, validators or the ledger; any early-ask path in the post-implementation lanes; admitting the readable gate summary into the record (own plan); a delta path for commits after the final verdict (own plan); any numerical quality claim from the observational baseline.

## Decisions

### D0. One authoritative section

The definition lives once, in a `Blocker disposition` section of `review-work/SKILL.md`, next to the blocking threshold it negates. The schema's `review` instruction references it by its installed path `~/.omp/agent/skills/review-work/SKILL.md`, as it already references the validator under that skill (`schema.yaml:328`); `integration-review/SKILL.md` Step 4 references it by name, as it already references "review-work Fix waves" (`integration-review/SKILL.md:59`). Both add only their own decision points; a restated copy would let a later edit leave the lanes deciding differently.

### D1. Eligibility is the negation of the existing threshold, not a second predicate

`review-work/SKILL.md:200` already defines what blocks: a realistic trigger whose result (a) breaks the goal, the value proof, a merge-gate criterion or an existing consumer, or (b) reaches a protected asset. A blocker is Accept-eligible exactly when it misses both limbs and no exclusion applies. The exclusions name the classes whose immediate observer is misleading, in terms each lane actually has: security and privacy paths and protected assets; every blocker filed under review_scope item 4 or CHECK 1 (plan review has no security lens; its checks lens carries item 4 next to the other mechanical checks, so the exclusion binds the item and check, not the lens); every blocker from a `security_delta: yes` trailer (F2); any change whose mandatory class is not `none`; and any blocker saying the change alters a review, gate or release mechanism so it would admit unreviewed or failing work. Precedence is one-directional: a label, lens or wording never makes a blocker eligible, an exclusion always makes it ineligible.

The value-proof limb gets one reading: a gap in the plan's own Verify commands or evidence is weaker proof and eligible, unless it leaves a merge-gate criterion wholly unproven. Without that reading nearly every verification blocker would break "the value proof", the early ask would rarely fire, and whether it fired would depend on the orchestrator's reading. A plan's own Verify is not a "gate mechanism"; that exclusion is about a change to the review tooling itself.

### D1b. Ambiguity and incompleteness block

A blocker with no stated consequence, an ambiguous or mixed one, and a round in which a dispatched lens returned no verdict are all treated as blocking. The early ask needs a complete round whose open blockers are all eligible; anything less keeps the existing path. This is the path by which a real defect would be lost, so it defaults against the ask.

### D2. Ask at the first clean round, keep the old cap for defect rounds

A complete round whose open blockers are all Accept-eligible is the point where further rounds re-examine process concerns rather than the product. The instruction asks the user there. In a round that still holds a non-eligible blocker, the non-eligible ones are fixed and the eligible ones are carried open in `review.md` without a mechanism fix, so the orchestrator always has a permitted action; the ask comes at the first round where only eligible blockers remain, or after the third REJECT as before. This change therefore cannot shorten a review that is still finding blocking defects. The measured tails (review-trailer-repair 17 rounds, m1-anthropic-body 10, gate-durable-qa-evidence 9) are exactly the case the earlier ask ends.

### D3. No unrequested mechanism for eligible blockers; real defects get their fix

The rule moves out of step 6 into the shared section. It binds only Accept-eligible blockers: answering one with a new script, procedure or check turns the checker into the next round's review target — this session's own `verify-f1.ts` cost two rounds while correctness had been OKAY since round 2. A blocker that is not eligible is fixed with whatever the correct fix needs, including a new check; the existing rule that a fix adding a subsystem becomes its own plan is untouched.

### D3b. Only plan review gets the early ask

F2, F3 and delta waves keep `CONTINUE`/`STOP`/freeze and their existing records: F2 records an unfixed blocker through `override` plus a `downgrades` entry (`below-threshold`, `accepted-residual`, `out-of-scope`, `frozen`); F3 records a freeze in its report's follow-up list with `GC decide --lane F3`; a delta acceptance is `GC accept`. F3 decides STOP and freeze in its own Step 4 before review-work's fix-wave step is reached, so `integration-review/SKILL.md` Step 4 references the section too.

### D5. Accept paths recommend; the user keeps the final word

Every point where a blocker can stay unfixed applies eligibility: plan-review Accept and Override, the F2 Phase 4 override, F2 and F3 freeze, and delta accept. The orchestrator recommends and offers accept, freeze or override only when every blocker it would leave is eligible or covered by an entry of the plan-reviewed `gate.md`; otherwise it offers fix, re-plan or stop and names each such blocker with its stated consequence. `below-threshold` is used only for eligible blockers; `accepted-residual` and `out-of-scope` keep their meaning, because their `gate.md` entries passed plan review under the same section. The user decided (round 2) that an explicit request to accept anyway stays possible rather than being forbidden, so no script changes: the request is recorded in the path's existing record with the user's reason in their words and the blocker's stated consequence. A hard refusal in `GC decide`/`GC accept` would need a blocker classification field and is its own plan if ever wanted.

### D6. The exemption is an allow-set that keeps today's checkbox case

A commit between waves is exempt when it ticks a final-verification checkbox, as today, or when every changed line is comment or prose that no brief, plan bundle, criterion, agent-loaded instruction or build/lint/codegen/doc generator reads and no changed comment carries a compiler, linter or build directive. Other prose in agent-loaded instruction files and plan artifacts is explicitly non-exempt.

### D4. Verify by replaying recorded rounds, not by asserting prose

No test asserts the new wording. Each edit task replays its own rows against the file it edited before it is ticked, and F1 re-runs all rows against the installed text at the final head. A row applies one instruction file to one recorded case from the measurement cohort, or to a case marked `constructed` where the cohort has none, and records the instruction sentence that decided it and the decision it produced. The 32 rows in `tasks.md` cover each requirement per lane: the exclusions and their precedence (item 4, CHECK 1 credential weaker proof, `security_delta: yes`, mandatory class, minor label on a consumer break) against an eligible CHECK 5 binding blocker; the Verify-gap reading; the ambiguity defaults; the mechanism rule; plan-review eligible, blocking, incomplete, mixed-early and mixed-third-REJECT rounds, the Accept effect and an insisted Override; the F2 eligible downgrade, an uncovered override and a withheld freeze; a withheld and an insisted delta accept; an eligible, a withheld and an insisted F3 freeze; the commit exemption with the checkbox case against instruction, plan-artifact, directive and generator-doc comments; and a sandbox install whose installed and source hashes must equal the current source bytes. The Verify commands bind every row name to its edited file and expected decision, check the evidence hash, and check the quoted sentence against that file. The checker is an inline command per task, not a new script. The replays are the orchestrator's judgement; F2 reviews the instruction diffs against every negative control (accepted residual in `gate.md`).

## Risks / Trade-offs

- An early Accept can let a weak verification plan through → Accept is the user's decision, is recorded in `gate.md`, and the post-implementation gates (F2/F3/delta), which reject mostly on real defects, still run.
- Eligibility is a judgement → it is bound to the one existing threshold, defaults against the ask when unclear, and keeps Fix available at every ask; the measurement's own classification was a judge estimate and is cited as observational, not as proof.
- Fewer rounds could hide a regression in review quality → D4's replay keeps the defect case blocking; the next five gated changes are observed as workflow follow-up, as in the measurement report.
- The exemption could be stretched to behaviour changes → D6's allow-set; agent-loaded instruction files and plan artifacts beyond the checkbox are explicitly non-exempt.
- A reference can be missed → the schema names the installed file path it already uses for the validator, and the F1 rows for plan review and F3 cite sentences from their own files that name the section.

## Migration Plan

No state or schema migration. Edit the three instruction files in the task worktree; `scripts/deploy-local.sh` installs them. Projects that hold their own copy of the `omp-gated` schema are re-installed with `install-openspec-workflow.mjs`, because deployment alone leaves them on the old stopping rule; this repository's symlinked copy needs no step. Running sessions pick up the new text after a restart. Roll back by reverting the instruction commit, redeploying and re-running the project installer.
