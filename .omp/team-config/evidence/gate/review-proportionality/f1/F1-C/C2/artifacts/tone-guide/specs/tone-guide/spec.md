## ADDED Requirements

### Requirement: Apologise only for our errors

A reply drafted with the `support-reply` skill SHALL apologise only when the ticket thread shows an error on our side.

#### Scenario: Question without an error

- **WHEN** the ticket asks how to export an invoice and shows no error
- **THEN** the draft answers without an apology

#### Scenario: Negative control

- **WHEN** the ticket shows a failed payment caused by our outage
- **THEN** a draft without an apology MUST fail the scenario
