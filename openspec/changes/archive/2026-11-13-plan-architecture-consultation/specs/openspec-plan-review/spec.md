## MODIFIED Requirements

### Requirement: The user is asked only on named exceptions

The instruction SHALL ask the user only when a finding in the security scope (review_scope item 4 or CHECK 1) or naming a protected asset is not confirmed; when the verifier returns `undecided` for a finding whose stated consequence meets the blocking threshold; when the budget is spent with a confirmed blocking finding open; when a fix needs a scope decision the artifacts leave open; or when both attempts of a pair of architecture consultation attempts failed, where it asks only whether to skip with a reason or to stop (capability `plan-architecture-consultation`). Otherwise it SHALL decide without asking.

#### Scenario: Refuted findings only

- **WHEN** every finding of a round is refuted and none is in the security scope
- **THEN** the round is OKAY with residuals and no question is asked

#### Scenario: Refuted security finding

- **WHEN** the verifier refutes a CHECK 1 finding that a QA step writes a provider key to an evidence file
- **THEN** `review.md` records the round as REJECT with that finding under Blockers before the user is asked whether to fix it, keep it as a residual with their reason, or stop; only the answer "keep" moves it to Residuals with the user's reason, and the record is then rewritten as OKAY when no other blocking finding remains

#### Scenario: Undecided finding that claims blocking damage

- **WHEN** the verifier returns `undecided` for a finding whose stated consequence meets the threshold
- **THEN** the ask offers Fix, keep as a residual with the user's reason, and Stop, and the finding stays under Blockers until the user answers

#### Scenario: Confirmed finding whose fix needs a scope decision

- **WHEN** the verifier confirms a blocking finding whose fix depends on a scope decision the artifacts leave open
- **THEN** the ask offers the named scope alternatives, each a fix of the artifacts, and Stop, never keep as a residual, because a finding confirmed as blocking reaches acceptance only through the exhaustion ask's Override; the finding stays under Blockers until a fix lands

#### Scenario: Two failed consultation attempts

- **WHEN** both attempts of a `risky` change's architecture consultation ran on a model other than the pin, before any reviewer finding exists
- **THEN** the user is asked once whether to skip with a reason or to stop, quoting each attempt's models, and no other question is asked

#### Scenario: Negative control

- **WHEN** an instruction records an unconfirmed security-scope finding, or an `undecided` finding whose stated consequence meets the threshold, as a residual without asking, applies a fix that needs an open scope decision without asking, offers keep for a finding the verifier confirmed as blocking, asks the user at a round whose findings are all refuted and outside the security scope, or asks about a consultation before both attempts of its current pair failed or with options other than skip with a reason and stop
- **THEN** review of that instruction MUST fail
