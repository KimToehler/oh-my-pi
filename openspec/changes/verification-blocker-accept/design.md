# Design

## Context

`review-work/SKILL.md`, section `Blocker disposition`, is the one definition of which blockers may stay unfixed in every lane: plan review (schema `review` step 4/6), F2, delta review and F3. Eligibility means a blocker misses both limbs of the blocking threshold and no exclusion applies. One exclusion reads "the change's mandatory class is not `none`". The `Change verification` section in the same file, merged with `review-proportionality`, separates the delivered change from work done only to establish this change's evidence. Schema step 4a uses that separation for display only: "it never changes a blocker's severity or eligibility". See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- Allow Accept, on a classified change, only for blockers about the change's own verification that already pass the unchanged threshold.
- Keep one judgement for "delivered change or verification", used both by the exclusion and by the approach question.

**Non-Goals:**
- No change to the threshold, the other exclusions, coverage, the user's-explicit-request path, the F2 Phase 4 override, the freeze rules or the approach-question trigger.
- No change to the validator, the record format, `downgrades` rules or any script.
- No per-lane variant. The F2 and F3 effect follows from the shared section alone.

## Decisions

### D1. Narrow the class exclusion; do not drop it

The bullet becomes "the change's mandatory class is not `none`, unless the blocker concerns only this change's verification as `Change verification` defines it and misses both limbs of the blocking threshold; on such a change every other blocker stays excluded, including one about the delivered change, one that concerns both, one whose subject is unclear and one that leaves a material behaviour unproven".

The threshold test sits inside the exclusion, not only in the eligibility test. An excluded blocker can be neither covered by a `gate.md` entry nor accepted on the user's explicit request; a merely non-eligible one can (SKILL.md, `Covered` and `The user's explicit request`). Without the threshold in the exclusion, a verification-only blocker that leaves material behaviour unproven would drop from excluded to non-eligible on a classified change and become coverable and user-acceptable. With it, the narrowing reaches exactly the blockers that are then eligible, and every lane's existing paths stay as they are for everything else.

Alternatives:
- Drop the class exclusion entirely. That would let bookkeeping blockers about delivered auth, migration, wire or state behaviour be accepted. The class exists because such blockers can hide real defects. Rejected.
- Narrow it only in plan review. That would create a second eligibility definition, which the `review-blocker-disposition` spec forbids ("One authoritative disposition definition"). Rejected.

### D2. Subject is judged from the stated consequence, failing closed

The subject is read from the blocker's own stated consequence, as eligibility already is. A blocker counts as verification-only when that consequence names only the change's QA sessions, disposable fixtures, one-off evidence helpers or their evidence, and nothing the change delivers. Tooling that serves users, CI, installation, benchmarks or later reviews is delivered, as `Change verification` says. On a classified change an unclear or mixed subject stays excluded. That is stronger than "Unclear means blocking" (non-eligible) and keeps today's status for it: neither coverage nor the user's request can leave it unfixed.

Being verification-only is necessary, not sufficient: the blocker must also miss both threshold limbs, so a missing proof of material behaviour stays excluded. Every other exclusion still precedes, including credentials and protected assets, the audit trail, CHECK 1 / item 4, `security_delta: yes`, classification disputes and review mechanisms.

### D3. The approach question shows the eligibility judgement

Step 4a's parenthetical "it never changes a blocker's severity or eligibility" becomes "it never changes a blocker's severity, and it is the same judgement `Blocker disposition` makes for the class exclusion, never a separate one". Two judgements of the same question could disagree: the question might show a blocker under verification while the ask treats it as delivered, or the reverse. With one judgement the user disputes exactly the assignment that decides Accept. "Its effect on Accept" in step 4a needs no new text: it already points at the disposition outcome.

### D4. Post-implementation lanes need no edit

F2, delta review and F3 reference the section, so the changed decision can occur in each: a verification-only blocker that misses the threshold and concerns no artifact the validator binds (for example a misleading name in an F1 helper the record does not cite) becomes eligible for the F2 Phase 4 `below-threshold` override, a delta accept and an F3 freeze. Blockers about F1 evidence the validator binds stay excluded as audit trail, so the effect there is narrower than in plan review. The README states that limit. F1 exercises each of the three lanes' decisions (task 2.1 row C).

### D5. This change is `concurrency-state`

The change alters the guard on an existing review-flow transition: which blockers reach the Accept ask instead of the fix loop. The `change-verification` spec classifies a changed transition of an existing review flow as `concurrency-state`, and `review-proportionality` used the same class. Under the rule in force while this change is reviewed, no blocker of this change is Accept-eligible.

## Risks / Trade-offs

- [The orchestrator labels a delivered-change blocker as verification to make it acceptable] → The threshold still applies, unclear or mixed subjects block, the approach question shows the assignment for the user to dispute, and security, credential and audit-trail exclusions precede. F1 exercises a delivered-change control and a mixed control.
- [A verification blocker is accepted whose gap later hides a delivered defect] → Only gaps in the form of evidence for behaviour that stays proven by a check that can fail are eligible; a missing proof of material behaviour is not.
- [Benefit smaller than expected] → Stated in the proposal: past rounds whose verification blockers named credentials would still be excluded. No round reduction is claimed.

## Migration Plan

After merge: `scripts/deploy-local.sh` (default agent directory only; a profile or custom `PI_CODING_AGENT_DIR` needs its own `bun scripts/install-team-config.ts`). Then run `team-config/agent/skills/review-work/scripts/install-openspec-workflow.mjs` in projects that hold their own `omp-gated` copy (onara, weaver), and restart running sessions. Rollback: revert the merge and redeploy; no data or record format changes.
