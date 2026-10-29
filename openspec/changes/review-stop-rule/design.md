# Design

## Context

Canonical review instructions are static Markdown and YAML in `team-config/`, installed by the existing installer. The `omp-gated` schema's `review` artifact drives plan review; `review-work/SKILL.md` drives the F2 Phase 4 record, the fix waves and delta reviews; `integration-review/SKILL.md` Step 4 makes the F3 STOP and freeze decision. The schema already contains the seed of this change: it recommends Accept "when the fix would add a mechanism, procedure or check the proposal did not ask for". It is not reached early enough: the recommendation lives in step 6, after a third REJECT.

Measurement: `runs/gate-e2e-20261029/RESULT.md`, 22 changes, 711 reviewer invocations, 683 blockers classified. Plan review is 50% of reviewer service time; 29% of its rounds follow the last consumer-visible finding. Delta rejecting rounds are 23 of 52 process-internal, F3 8 of 23, F2 7 of 22.

## Goals / Non-Goals

**Goals:** fewer complete plan-review rounds without losing a blocking finding; one eligibility definition shared by the review instruction and every post-implementation lane; no new tooling.

**Non-Goals:** changing the blocking threshold, reviewer selection, lens count, F1/F3 ownership, gate records, validators or the ledger; any early-ask path in the post-implementation lanes; changing the between-waves exemption (the user removed it from this plan in round 4: today's text already exempts a comment "at your judgement", with "When in doubt, review", and the measurement showed no comment-reset problem); admitting the readable gate summary into the record (own plan); a delta path for commits after the final verdict (own plan); any numerical quality claim from the observational baseline.

## Decisions

### D0. One authoritative section

The definition lives once, in a `Blocker disposition` section of `review-work/SKILL.md`, next to the blocking threshold it negates. The schema's `review` instruction references it by its installed path `~/.omp/agent/skills/review-work/SKILL.md`, as it already references the validator under that skill (`schema.yaml:328`); `integration-review/SKILL.md` Step 4 references it by name, as it already references "review-work Fix waves" (`integration-review/SKILL.md:59`). Both add only their own decision points; a restated copy would let a later edit leave the lanes deciding differently.

### D1. Eligibility is the negation of the existing threshold, not a second predicate

`review-work/SKILL.md:200` already defines what blocks: a realistic trigger whose result (a) breaks the goal, the value proof, a merge-gate criterion or an existing consumer, or (b) reaches a protected asset, a list that includes an audit trail. A blocker is Accept-eligible exactly when it misses both limbs and no exclusion applies. The exclusions name the classes whose immediate observer is misleading, in terms each lane actually has: security and privacy paths and protected assets; the audit trail, meaning the gate record, its trailers and the QA artifacts the validator binds (`validate-gate-record.mjs`), so a blocker about their binding is never "bookkeeping"; every blocker filed under review_scope item 4 or CHECK 1 (plan review has no security lens; its checks lens carries item 4 next to the other mechanical checks, so the exclusion binds the item and check, not the lens); every blocker from a `security_delta: yes` trailer (F2); any change whose mandatory class is not `none`; and any blocker saying the change alters a review, gate or release mechanism so it would admit unreviewed or failing work. Precedence is one-directional: a label, lens or wording never makes a blocker eligible, an exclusion always makes it ineligible.

The value-proof limb gets one reading: a gap in the plan's own Verify commands or evidence is weaker proof and eligible, unless it leaves a merge-gate criterion wholly unproven. Without that reading nearly every verification blocker would break "the value proof", the early ask would rarely fire, and whether it fired would depend on the orchestrator's reading. A plan's own Verify is not a "gate mechanism"; that exclusion is about a change to the review tooling itself.

### D1b. Ambiguity blocks; an incomplete round keeps its stop

A blocker with no stated consequence, or an ambiguous or mixed one, is treated as blocking. A round in which a lens still returns no verdict after its retry is incomplete and keeps the existing behaviour (`schema.yaml:379-384`: no `review.md`, tell the user which lens failed, stop); it never counts as a clean round and never triggers an ask. This is the path by which a real defect would be lost, so every unclear state defaults against the ask.

### D2. Ask at the first clean round, keep the old cap for defect rounds

A complete round whose open blockers are all Accept-eligible is the point where further rounds re-examine process concerns rather than the product. The instruction asks the user there. In a complete round that still holds a non-eligible blocker, the non-eligible ones are fixed and the eligible ones are kept, without a mechanism fix, in the orchestrator's own list of carried blockers. The fixed brief is not changed, so fresh lenses may not re-raise them; the list is what keeps them alive. The ask comes at the first complete round in which every open and carried blocker is eligible, including a round that returns OKAY while carried blockers remain, and always before `review.md` is written; otherwise after the third REJECT as before. A carried blocker is therefore never dropped silently, and this change cannot shorten a review that is still finding blocking defects. The measured tails (review-trailer-repair 17 rounds, m1-anthropic-body 10, gate-durable-qa-evidence 9) are exactly the case the earlier ask ends.

### D3. No unrequested mechanism for eligible blockers; real defects get their fix

The rule moves out of step 6 into the shared section. It binds only Accept-eligible blockers: answering one with a new script, procedure or check turns the checker into the next round's review target — this session's own `verify-f1.ts` cost two rounds while correctness had been OKAY since round 2. A blocker that is not eligible is fixed with whatever the correct fix needs, including a new check; the existing rule that a fix adding a subsystem becomes its own plan is untouched.

### D3b. Only plan review gets the early ask

F2, F3 and delta waves keep `CONTINUE`/`STOP`/freeze and their existing records: F2 records an unfixed blocker through `override` plus a `downgrades` entry (`below-threshold`, `accepted-residual`, `out-of-scope`, `frozen`); F3 records a freeze in its report's follow-up list with `GC decide --lane F3`; a delta acceptance is `GC accept`. F3 decides STOP and freeze in its own Step 4 before review-work's fix-wave step is reached, so `integration-review/SKILL.md` Step 4 references the section too.

### D5. Accept paths recommend; coverage is specific; the user keeps the final word

Every point where a blocker can stay unfixed applies eligibility: plan-review Accept and Override, the F2 Phase 4 override, F2 and F3 freeze, and delta accept. Plan review decides per blocker. A decision that leaves several blockers at once (an F2 override, a freeze, a delta accept) is recommended and offered only when every one of them is eligible or covered; otherwise the orchestrator offers fix, re-plan or stop and names each such blocker with its stated consequence. Under Risk tier `internal-tooling` at wave 3 or later, where `GC decide` already refuses continue, that leaves re-plan or a re-tier, as today.

A blocker is covered only when an Accepted residual risks or Out of scope entry of the plan-reviewed `gate.md` names the same defect class and consequence; a broad area list does not cover a specific blocker, and coverage never applies to an excluded blocker. `below-threshold` is used only for eligible blockers, `accepted-residual` and `out-of-scope` only for covered ones.

The user decided (round 2) that an explicit request to accept anyway stays possible rather than being forbidden, so no script changes: the request is recorded in the path's existing record with the user's reason in their words and the blocker's stated consequence. A hard refusal in `GC decide`/`GC accept` would need a blocker classification field and is its own plan if ever wanted.

### D4. Verify by replaying recorded rounds, not by asserting prose

No test asserts the new wording. Each edit task replays its own rows against the file it edited before it is ticked, and F1 re-runs all rows against the installed text at the final head. A row applies one instruction file to one recorded case from the measurement cohort, or to a case marked `constructed` where the cohort has none, and records the instruction sentence that decided it and the decision it produced. The 29 rows in `tasks.md` cover each requirement per lane: the exclusions and their precedence (item 4, CHECK 1 credential weaker proof, gate-record evidence, `security_delta: yes`, mandatory class, minor label on a consumer break) against an eligible CHECK 5 binding blocker outside the record; the Verify-gap reading; the ambiguity defaults; the mechanism rule; plan-review eligible, blocking, incomplete, mixed-early, carried-after-OKAY and mixed-third-REJECT rounds, the Accept effect and an insisted Override; the F2 eligible downgrade, an uncovered override, a broad entry that does not cover a security blocker, and a withheld freeze; a withheld and an insisted delta accept; an eligible, a withheld and an insisted F3 freeze; and a sandbox install whose installed and source hashes must equal the current source bytes. The Verify commands bind every row name to its edited file and expected decision, check the evidence hash, and check the quoted sentence against that file. The checker is an inline command per task, not a new script. The replays are the orchestrator's judgement; F2 reviews the instruction diffs against every negative control (accepted residual in `gate.md`).

## Risks / Trade-offs

- An early Accept can let a weak verification plan through → Accept is the user's decision, is recorded in `gate.md`, and the post-implementation gates (F2/F3/delta), which reject mostly on real defects, still run.
- Eligibility is a judgement → it is bound to the one existing threshold, defaults against the ask when unclear, and keeps Fix available at every ask; the measurement's own classification was a judge estimate and is cited as observational, not as proof.
- Fewer rounds could hide a regression in review quality → D4's replay keeps the defect case blocking; the next five gated changes are observed as workflow follow-up, as in the measurement report.
- A carried blocker lives only in the orchestrator's session → it is asked about before `review.md` is written, so it ends either accepted into `gate.md` or fixed; if the session is lost mid-review, the list is lost with it, and the next review run starts without it, as an unfinished review does today.
- A reference can be missed → the schema names the installed file path it already uses for the validator, and the F1 rows for plan review and F3 cite sentences from their own files that name the section.

## Migration Plan

No state or schema migration. Edit the three instruction files in the task worktree; `scripts/deploy-local.sh` installs them into the default agent directory. Profile installs (`~/.omp/profiles/*/agent`) and custom `PI_CODING_AGENT_DIR` roots need their own `env -u PI_PROFILE -u OMP_PROFILE PI_CODING_AGENT_DIR=DIR bun scripts/install-team-config.ts`, because the schema's `~/.omp/agent/skills/review-work/SKILL.md` reference, like its validator reference, names the default directory. Projects that hold their own copy of the `omp-gated` schema are re-installed with `install-openspec-workflow.mjs`, because deployment alone leaves them on the old stopping rule; this repository's symlinked copy needs no step. Running sessions pick up the new text after a restart. Roll back by reverting the instruction commit, redeploying and re-running the project installer.
