Requirement (quoted verbatim from a spec):

<requirement>
### Requirement: Security sources and gate classification are never eligible

The exclusions SHALL also cover every blocker whose area names review_scope item 4 or CHECK 1, every blocker from a `security_delta: yes` trailer, every blocker on a change whose mandatory class is not `none` unless it concerns only that change's verification (`Change verification` in `review-work`) and misses both threshold limbs, and every blocker that disputes the plan's Mandatory class, Risk tier, reviewer set or whole-diff-review decision.

#### Scenario: Bookkeeping blocker from a security source

- **WHEN** a blocker reads as evidence bookkeeping but is filed under review_scope item 4 or CHECK 1, or comes from a `security_delta: yes` trailer
- **THEN** it is not Accept-eligible, because the exclusion takes precedence over the threshold test

#### Scenario: Delivered-change blocker under a mandatory class

- **WHEN** a change's mandatory class is `concurrency-state` and a blocker's stated consequence is a stale cross-reference in the delivered design of the changed state transition, while every behaviour stays proven
- **THEN** it is not Accept-eligible, because it concerns the delivered change

#### Scenario: Verification-only evidence gap under a mandatory class

- **WHEN** a change's mandatory class is `concurrency-state` and a blocker's stated consequence is that one F1 scenario's evidence path is named differently in tasks.md and design.md, while that scenario still runs, retains its outputs and every behaviour stays proven by a check that can fail, and no other exclusion applies
- **THEN** it is Accept-eligible and the instruction may recommend Accept for it

#### Scenario: Verification blocker that leaves material behaviour unproven

- **WHEN** a change's mandatory class is `auth-secrets-pii`, a blocker says the planned F1 run cannot fail when token refresh fails, and the user asks to accept it anyway or a `gate.md` Accepted residual risks entry names that gap
- **THEN** it stays excluded although it concerns only verification: it is not Accept-eligible, the entry does not cover it, no `gate.md` entry is written for the user's request, and the options are fix, re-plan or stop

#### Scenario: Verification blocker that names a credential

- **WHEN** a change's mandatory class is not `none` and a blocker says a planned QA step copies the provider key into a committed evidence file
- **THEN** it is not Accept-eligible, because it names a security path and a protected asset

#### Scenario: Mixed or unclear subject under a mandatory class

- **WHEN** a change's mandatory class is not `none` and a blocker names both a QA fixture and a delivered code or design path, or its stated consequence leaves open which of the two it concerns
- **THEN** it stays excluded and is not Accept-eligible

#### Scenario: Disputed gate classification

- **WHEN** a blocker says the plan's Mandatory class, Risk tier, reviewer set or whole-diff-review decision is wrong
- **THEN** it is not Accept-eligible, because it decides how much review the change gets, even though it reads as wording of a `gate.md` field

#### Scenario: Negative control

- **WHEN** an instruction treats a blocker from one of these sources, or a dispute of the plan's gate classification, as bookkeeping, or, on a change whose mandatory class is not `none`, treats as eligible, coverable or acceptable on request a blocker that concerns the delivered change, concerns both, leaves its subject unclear or breaks the blocking threshold
- **THEN** review of that instruction MUST fail
</requirement>

Instruction text:

<instruction>
## Blocker disposition

The one definition of which reviewer blockers may stay unfixed, for every lane: plan review (the `omp-gated` schema's `review` instruction), F2 (Phase 4 and Fix waves), delta reviews and F3 (`integration-review` Step 4). Those lanes reference this section and add only their own decision points; none restates it. A lane that cannot read this section treats every blocker as not eligible and tells the user once per review that Accept is off.

**Eligible.** A blocker is Accept-eligible only when it misses both limbs of the blocking threshold in the Phase 2 briefs - its result (a) breaks no goal, value proof, `## Merge gate` criterion or existing consumer, and (b) reaches no protected asset - and no exclusion below applies. Read eligibility from the blocker's own stated consequence against that threshold. A severity label, the lens, the wording or any other predicate never makes a blocker eligible, and an exclusion always makes it ineligible. A missing proof of any material behaviour or failure mode breaks the value proof, even when the criterion is partly proven; only a gap in the form of evidence (binding, wording, bookkeeping outside the audit trail) for a behaviour that stays proven by a check that can fail is weaker proof. After implementation, a test that cannot fail for the implemented behaviour is judged by the threshold as before.

**Excluded.** Never eligible, whatever the blocker's immediate observer:

- it names a security or privacy path, a protected asset, a merge-gate criterion or an existing consumer;
- it concerns the audit trail: the gate record, its trailers, or a QA artifact the validator binds;
- its area names review_scope item 4 or CHECK 1;
- it comes from a `security_delta: yes` trailer;
- the change's mandatory class is not `none`, unless the blocker concerns only this change's verification as `Change verification` defines it and misses both limbs of the blocking threshold; on such a change every other blocker stays excluded, including one about the delivered change, one that concerns both, one whose subject is unclear and one that leaves a material behaviour unproven;
- it disputes the plan's Mandatory class, Risk tier, reviewer set or whole-diff-review decision;
- it says the change alters a review, gate or release mechanism so that it would admit unreviewed or failing work.

An excluded blocker is never accepted, frozen or overridden at any path, even on the user's request: offer fix, re-plan or stop, because an accepted entry would make later reviewers treat the defect as settled.

**Unclear means blocking.** A blocker with no stated consequence, an ambiguous one, or one that mixes a process gap with a code or design path is not eligible. A round is complete only when every dispatched reviewer returned a structured verdict; an incomplete round keeps the lane's existing stop, never counts as free of blocking findings and never triggers an ask.

**Covered.** A blocker is covered only when an `Accepted residual risks` or `Out of scope for blocking` entry of the plan's reviewed merge-gate section (`gate.md` for an OpenSpec folder) names the same defect class and consequence; a broad area list covers no specific blocker. Coverage is the existing `accepted-residual`/`out-of-scope` path: the entry was reviewed with the plan, so a covered blocker may stay unfixed even when it breaks the threshold. Coverage never applies to an excluded blocker.

**Accept paths.** Wherever a blocker can stay unfixed - plan-review Accept and Override, the Phase 4 override, an F2 or F3 freeze, a delta accept - recommend and offer accept, freeze or override only for blockers that are eligible or covered; a decision that leaves several blockers at once needs every one of them so. Otherwise offer fix, re-plan or stop (under Risk tier `internal-tooling` at wave 3 or later, re-plan or a re-tier, as today) and name each such blocker with its stated consequence.

**The user's explicit request.** For a non-eligible blocker that no exclusion names, the user may still ask to accept it at plan-review Accept or Override, a freeze or a delta accept. Record it in that path's existing record (the `gate.md` entry or Override, a `frozen` `downgrades` entry, the F3 report's follow-up list, `GC accept --reason`) with the user's reason in their words and the blocker's stated consequence. The ordinary Phase 4 override never accepts one (Phase 4, Downgrades).

**No unrequested mechanism.** Never answer an eligible blocker by adding a mechanism, script, procedure or check the proposal did not ask for: it goes to the user as Accept, or becomes its own plan, because the next round would review the new surface. A non-eligible blocker is fixed with whatever the correct fix needs, including a new check; a fix that adds a subsystem is still its own plan (Fix waves step 4).
</instruction>

List every sentence of this instruction that permits a behaviour the requirement's Negative control forbids, quoting it, or answer none found.
