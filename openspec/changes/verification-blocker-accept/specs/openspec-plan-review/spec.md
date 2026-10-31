# Spec Delta

## MODIFIED Requirements

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
