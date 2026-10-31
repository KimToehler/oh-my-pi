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

The bullet becomes "the change's mandatory class is not `none`, unless the blocker concerns only this change's verification as `Change verification` defines it; a blocker about the delivered change, one that concerns both and one whose subject is unclear stay excluded".

Alternatives:
- Drop the class exclusion entirely. That would let bookkeeping blockers about delivered auth, migration, wire or state behaviour be accepted. The class exists because such blockers can hide real defects. Rejected.
- Narrow it only in plan review. That would create a second eligibility definition, which the `review-blocker-disposition` spec forbids ("One authoritative disposition definition"). Rejected.

### D2. Subject is judged from the stated consequence, failing closed

The subject is read from the blocker's own stated consequence, as eligibility already is. A blocker counts as verification-only when that consequence names only the change's QA sessions, disposable fixtures, one-off evidence helpers or their evidence, and nothing the change delivers. Tooling that serves users, CI, installation, benchmarks or later reviews is delivered, as `Change verification` says. The existing "Unclear means blocking" rule already covers an unclear or mixed subject; the bullet repeats it only for this exclusion's own question, so it cannot be read as a new default.

Being verification-only is necessary, not sufficient. The blocker must still miss both threshold limbs, so a missing proof of material behaviour still blocks. Every other exclusion still precedes, including credentials and protected assets, the audit trail, CHECK 1 / item 4, `security_delta: yes`, classification disputes and review mechanisms.

### D3. The approach question shows the eligibility judgement

Step 4a's parenthetical "it never changes a blocker's severity or eligibility" becomes "it never changes a blocker's severity, and it is the same judgement `Blocker disposition` makes for the class exclusion, never a separate one". Two judgements of the same question could disagree: the question might show a blocker under verification while the ask treats it as delivered, or the reverse. With one judgement the user disputes exactly the assignment that decides Accept. "Its effect on Accept" in step 4a needs no new text: it already points at the disposition outcome.

### D4. Post-implementation lanes need no edit

F2, delta review and F3 reference the section. At F2 and F3 the blockers about F1 usually concern evidence the validator binds, and the audit-trail exclusion keeps them excluded. The practical effect is therefore mostly in plan review. This is stated in the README sentence, so nobody expects F2 freezes on F1 evidence.

### D5. This change is `concurrency-state`

The change alters the guard on an existing review-flow transition: which blockers reach the Accept ask instead of the fix loop. The `change-verification` spec classifies a changed transition of an existing review flow as `concurrency-state`, and `review-proportionality` used the same class. Under the rule in force while this change is reviewed, no blocker of this change is Accept-eligible.

## Risks / Trade-offs

- [The orchestrator labels a delivered-change blocker as verification to make it acceptable] → The threshold still applies, unclear or mixed subjects block, the approach question shows the assignment for the user to dispute, and security, credential and audit-trail exclusions precede. F1 exercises a delivered-change control and a mixed control.
- [A verification blocker is accepted whose gap later hides a delivered defect] → Only gaps in the form of evidence for behaviour that stays proven by a check that can fail are eligible; a missing proof of material behaviour is not.
- [Benefit smaller than expected] → Stated in the proposal: past rounds whose verification blockers named credentials would still be excluded. No round reduction is claimed.

## Migration Plan

After merge: `scripts/deploy-local.sh` (default agent directory only; a profile or custom `PI_CODING_AGENT_DIR` needs its own `bun scripts/install-team-config.ts`). Then run `team-config/agent/skills/review-work/scripts/install-openspec-workflow.mjs` in projects that hold their own `omp-gated` copy (onara, weaver), and restart running sessions. Rollback: revert the merge and redeploy; no data or record format changes.
