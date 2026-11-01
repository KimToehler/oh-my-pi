Requirement (quoted verbatim from a spec):

<requirement>
### Requirement: The approach question diagnoses before it recommends

The approach question SHALL show the round; per lens its verdict and blocker count; per blocker its area and whether it concerns the delivered change or the change's verification, judged by consequence, never changing severity, and the same judgement the `Blocker disposition` section uses for eligibility; the Mandatory class, the part that sets it and its effect on Accept; a causal diagnosis of what keeps generating blockers; and a recommendation of the option that removes that cause while best keeping the goal, with its reason.

#### Scenario: Diagnosis matches the round

- **WHEN** two lenses reject and most blockers ask for more inventories of the change's own QA setup
- **THEN** the question shows each lens's verdict and count as returned, assigns those blockers to verification, and names the QA design as the cause behind its recommendation

#### Scenario: Assignment and eligibility agree under a mandatory class

- **WHEN** a change's Mandatory class is `concurrency-state`, the approach question shows one blocker as concerning verification, and that blocker misses both limbs of the blocking threshold with no other exclusion applying
- **THEN** the question states that Accept is available for that blocker, and after Continue the per-blocker ask recommends Accept for it

#### Scenario: Negative control

- **WHEN** an instruction recommends an option by counting blockers, offers pre-written fixes as options, or shows a blocker as concerning verification while the eligibility decision treats it as concerning the delivered change, or the reverse
- **THEN** review of that instruction MUST fail
</requirement>

Instruction text:

<instruction>
 4a. Approach question: one `ask`, before any per-blocker ask. Show the round; per lens its verdict and blocker count; per blocker its area and whether it concerns the delivered change or this change's verification, judged by the blocker's consequence, not by which lens raised it (shown so the user can dispute it; it never changes a blocker's severity, and eligibility judges the subject separately); the Mandatory class, the delivered part that sets it, and its effect on Accept. Then give a causal diagnosis, what keeps generating blockers, and recommend the option that removes that cause while best keeping the goal, with the reason. Never recommend by counting blockers, and never offer pre-written fixes as options. Options: - Continue: fix every non-eligible blocker in the artifacts and repeat from step 1; ask per blocker (step 6) only for eligible ones, Accept recommended, and for a fix that needs a user decision. A Stop at any of those asks ends the review without fixes. - Re-plan: no per-blocker ask; nothing from this round enters gate.md as an Accept, Override or residual risk. Revise the design, the verification and every affected artifact, including gate.md's classification when the new approach changes it; create design.md when absent. Then repeat from step 1 with three fresh lenses. - Split, offered only when the Mandatory class is not `none` and a named class-setting part can ship separately from a useful remainder: name both scopes, why they are independent, and any part of the original goal the remainder no longer meets; choosing Split is the user's explicit approval of that scope change. Split ends this fix loop: revise the artifacts to the retained scope, name the removed part as a separate change to be proposed and reviewed before it is implemented, reclassify the retained behaviour, and repeat from step 1. Never implement the removed part, accept its blockers, or lower a class while its trigger remains in the retained scope. Without a useful independent remainder, offer no Split. - Stop: no fix and no new round; apply stays blocked. No option accepts a blocker or authorizes apply. </instruction>

List every sentence of this instruction that permits a behaviour the requirement's Negative control forbids, quoting it, or answer none found.
