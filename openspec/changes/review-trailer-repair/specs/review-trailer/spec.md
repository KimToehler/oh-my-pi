# Spec Delta

## Purpose

Makes a merge-gate reviewer's trailer checkable as soon as the reply arrives, keeps a gate wave from recording reviewer outcomes whose trailer cannot validate, and lets a malformed trailer be repaired by the reviewer that wrote the review instead of re-running the review.

## ADDED Requirements

### Requirement: Trailer check without a record
`validate-gate-record.mjs` run with `--trailer <file> --invocation <implementation-audit|strategic-risk-review> --verdict <PASS|FAIL|INCONCLUSIVE> --plan <plan>` and no `--record` SHALL apply to that file every trailer rule of the record check except the model binding to the record's resolution, SHALL NOT require the file to be tracked, and SHALL print `passed` (exit 0) or `blocked` (exit 1, finding on stderr).

#### Scenario: Well-formed untracked trailer
- **WHEN** an untracked file holds a reviewer reply whose single trailer block names `implementation-audit`, sections `1,2,3,4,5`, a model id, `security_delta: no`, `verdict: PASS` and one own five-field criterion, and the check runs with `--invocation implementation-audit --verdict PASS`
- **THEN** it prints `passed` and exits 0

#### Scenario: Repair reply holding only blocker lines and the trailer
- **WHEN** the file holds only the line `Blocker B1: <finding>` followed by an otherwise well-formed trailer with `verdict: FAIL` and `blockers: B1`, checked with `--verdict FAIL`
- **THEN** it prints `passed` and exits 0

#### Scenario: Reply without a trailer
- **WHEN** the file holds a review narrative that ends in `PASS` but has no `REVIEW-TRAILER-v1` / `END-REVIEW-TRAILER` block
- **THEN** it prints `blocked`, exits 1, and stderr says the trailer is missing

#### Scenario: Negative control
- **WHEN** the trailer is well-formed except that its criteria key reads `adversarial_criterion:`
- **THEN** the check MUST fail: it prints `blocked`, exits 1, and stderr names `adversarial_criteria`; an exit 0 is a defect

### Requirement: Trailer check binds verdict and invocation
The trailer check SHALL fail with a `verdict` finding when the trailer's `verdict` differs from `--verdict`, and with an `invocation` finding when the trailer's `invocation` differs from `--invocation`.

#### Scenario: Invocation mismatch
- **WHEN** a well-formed trailer names `strategic-risk-review` and the check runs with `--invocation implementation-audit`
- **THEN** it exits 1 with an `invocation` finding

#### Scenario: Negative control
- **WHEN** a well-formed trailer carries `verdict: PASS` and the check runs with `--verdict FAIL`
- **THEN** the check MUST fail with a `verdict` finding and exit 1; an exit 0 is a defect

### Requirement: Gate wave records reviewer outcomes only with a checked trailer
In lane F2, `gate-convergence.mjs wave` SHALL require one `--trailer <invocation>=<path>` for each `implementation-audit` or `strategic-risk-review` outcome that is PASS or FAIL, SHALL run the trailer check on each given trailer against the plan bytes the wave verified, with that outcome as the verdict, and SHALL append nothing to the ledger when a required trailer is missing or fails, or when a `--trailer` names no outcome.

#### Scenario: Reviewer outcome with a passing trailer
- **WHEN** `wave --lane F2` runs with `--outcome qa=PASS --outcome implementation-audit=PASS --trailer implementation-audit=<path>` and that file passes the trailer check with verdict PASS
- **THEN** the wave is recorded as before

#### Scenario: Reviewer outcome without a trailer
- **WHEN** `wave --lane F2` runs with `--outcome qa=PASS --outcome implementation-audit=PASS` and no `--trailer`
- **THEN** it exits 1, stderr names `implementation-audit`, and the ledger gains no `gate_wave` event

#### Scenario: Inconclusive reviewer without a trailer
- **WHEN** `wave --lane F2` runs with `--outcome qa=PASS --outcome implementation-audit=INCONCLUSIVE` and no `--trailer`
- **THEN** the wave is recorded with the `implementation-audit-inconclusive` blocker, as before

#### Scenario: Trailer in lane F3
- **WHEN** `wave --lane F3` runs with any `--trailer`
- **THEN** it exits 1 and the ledger gains no `gate_wave` event

#### Scenario: Negative control
- **WHEN** `wave --lane F2` runs with `--outcome qa=PASS --outcome implementation-audit=PASS --trailer implementation-audit=trailer-implementation-audit.txt` and that file's otherwise well-formed trailer carries `verdict: FAIL`
- **THEN** recording MUST fail: exit 1 with a `verdict` finding and no `gate_wave` event; a recorded wave is a defect

### Requirement: Trailer repair before re-dispatch
review-work SHALL send one fixed repair message to the same reviewer when a reply delivers its review and states one verdict but its trailer is missing or fails the trailer check, store the answer unedited as the trailer artifact, and dispatch a fresh reviewer only when the repaired trailer fails the check with the original verdict or the reviewer is unreachable or silent. `rules/merge-gate-proof.md` SHALL state this order; `rules/delegation.md` SHALL allow the message.

#### Scenario: Missing trailer on a PASS reply
- **WHEN** an implementation-audit reply closes with `PASS` and carries no trailer block
- **THEN** the guidance sends the fixed repair message to that reviewer with `write agent://<id>` before any new `task` dispatch

#### Scenario: Repair fails
- **WHEN** the repair reply's trailer fails the trailer check, carries a verdict other than the original reply's, or the reviewer cannot be reached or does not answer the repair message
- **THEN** the guidance dispatches a fresh reviewer with the verbatim brief, as before this change

#### Scenario: Bare verdict without a review
- **WHEN** a reply is only `PASS`, or an acknowledgement, with no review content
- **THEN** the guidance sends no repair message and takes the bounded fresh retry, then `INCONCLUSIVE`, as before this change

#### Scenario: Reply without a verdict
- **WHEN** a reply states no verdict token, or conflicting ones
- **THEN** the guidance records it as `INCONCLUSIVE` and sends no repair message

#### Scenario: Negative control
- **WHEN** shipped `SKILL.md` or `rules/merge-gate-proof.md` still prescribes a fresh re-dispatch as the first response to a missing or malformed trailer on a reply that states a verdict, or `rules/delegation.md` forbids every follow-up message to a reviewer without naming the repair message
- **THEN** the guidance check from tasks.md MUST fail: it names the file and exits non-zero; a clean exit is a defect

### Requirement: Repair and re-dispatch are bounded
review-work SHALL allow, per invocation and wave, at most one fresh re-dispatch after a failed repair, and at most one repair message per reply. When the trailer of the fresh reviewer still fails after its own repair, the guidance SHALL record the invocation as `INCONCLUSIVE` and dispatch no further reviewer for it in that wave.

#### Scenario: Fresh reviewer repaired successfully
- **WHEN** the first repair fails, the fresh reviewer's reply has a malformed trailer, and its one repair passes the trailer check with that reply's verdict
- **THEN** the guidance continues with that trailer and dispatches nothing more

#### Scenario: Fresh reviewer still malformed
- **WHEN** the fresh reviewer's repaired trailer also fails the trailer check
- **THEN** the guidance records `INCONCLUSIVE` for that invocation and dispatches no further reviewer in that wave

#### Scenario: Negative control
- **WHEN** shipped `SKILL.md` Phase 3 lets a failed repair of the fresh reviewer lead to another fresh dispatch
- **THEN** the guidance check from tasks.md MUST fail and name `SKILL.md`; a clean exit is a defect

### Requirement: Briefs announce the trailer up front
Both reviewer briefs in review-work `SKILL.md` SHALL state, within their first three lines, that the reply ends with the `REVIEW-TRAILER-v1` block given at the end of the brief, with its field names exactly as written there.

#### Scenario: Audit brief
- **WHEN** the implementation-audit brief is read
- **THEN** one of its first three lines names `REVIEW-TRAILER-v1`

#### Scenario: Negative control
- **WHEN** either brief names `REVIEW-TRAILER-v1` only in its closing block
- **THEN** the guidance check from tasks.md MUST fail and name that brief; a clean exit is a defect
