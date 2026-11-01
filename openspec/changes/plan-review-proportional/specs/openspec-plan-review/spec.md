# Spec Delta

## ADDED Requirements

### Requirement: Review depth follows the change's risk

Before round 1 the `omp-gated` review instruction SHALL set one depth and record it in `review.md`: `risky` when `gate.md`'s Mandatory class is not `none` or the change alters a review, gate or release mechanism, otherwise `standard`. `standard` dispatches one fresh `plan-reviewer` with all review scopes; `risky` dispatches two fresh reviewers in one `task` batch, scope A (correctness, architecture, security, mechanical checks) and scope B (verification, executability).

#### Scenario: Instruction change without a class

- **WHEN** a change has Mandatory class `none` and edits a skill's wording without touching a review, gate or release mechanism
- **THEN** `review.md` records depth `standard` and each round dispatches one `plan-reviewer`

#### Scenario: Class-bearing change

- **WHEN** a change has Mandatory class `concurrency-state`
- **THEN** `review.md` records depth `risky` and each full round dispatches the scope A and scope B reviewers in one batch

#### Scenario: Gate mechanism without a class

- **WHEN** a change has Mandatory class `none` and changes what `validate-openspec-change.mjs --reviewed` accepts
- **THEN** its depth is `risky`

#### Scenario: Negative control

- **WHEN** an instruction records depth `standard` for a change whose Mandatory class is `auth-secrets-pii`, or dispatches one reviewer for a `risky` change
- **THEN** review of that instruction MUST fail

### Requirement: Fixed reviewer briefs on a pinned model

Every plan-reviewer task SHALL carry the brief fixed in the schema verbatim with only the repository and change paths filled in, followed by its depth's fixed scope paragraph and nothing else, so the planner's focus does not steer the review. The team seed SHALL resolve `plan-reviewer` to `onara/cx/gpt-6.1-sol:high` through `task.agentModelOverrides`, so the user's `advisor` role does not choose the reviewer model.

#### Scenario: Standard dispatch

- **WHEN** a `standard` change starts round 1 in an agent directory seeded from the team config
- **THEN** the one `plan-reviewer` task carries the fixed brief and the all-scopes paragraph, and its run resolves to `onara/cx/gpt-6.1-sol:high`

#### Scenario: Negative control

- **WHEN** an instruction adds its own focus, a file list or a summary of the change to a brief, or the seed leaves `plan-reviewer` on the `advisor` role
- **THEN** review of that instruction or seed MUST fail

### Requirement: A verifier triages every finding

After every complete round or fix-delta check that returned at least one blocker, and before any fix or ask, the instruction SHALL dispatch one fresh `blocker-verifier` task, whose agent definition pins `onara/cx/gpt-6.1-sol:medium`, with its fixed brief, the two paths and every blocker verbatim. For each blocker the verifier SHALL return `confirmed`, `refuted` or `undecided` with its reason and, for `confirmed`, whether the blocker meets the blocking threshold.

#### Scenario: Round with findings

- **WHEN** a `risky` round returns REJECT from scope A with two blockers and OKAY from scope B
- **THEN** one verifier task receives both blockers verbatim and returns one result per blocker before any artifact is edited

#### Scenario: Round without findings

- **WHEN** every reviewer of a round returns OKAY with no blockers
- **THEN** no verifier is dispatched and the round is OKAY

#### Scenario: Negative control

- **WHEN** an instruction fixes or asks about a blocker before the verifier returned, or sends the verifier a paraphrase or a subset of the round's blockers
- **THEN** review of that instruction MUST fail

### Requirement: Only confirmed findings block

A blocker SHALL stay blocking only when the verifier confirms all of: a concrete failure scenario, evidence it found at the cited repository `file:line` or plan quote, why the plan's criteria and Verify commands would not catch that failure, and the blocking threshold. Every other blocker SHALL become a residual recorded with the verifier's result and reason; residuals never block apply.

#### Scenario: Speculative finding

- **WHEN** a blocker says a race might occur but names no sequence that produces it and no cited line supports it
- **THEN** the verifier refutes it and it is recorded as a residual

#### Scenario: Preference about a check that already catches the failure

- **WHEN** a blocker asks for a different Verify method while the planned test already fails when the named failure occurs
- **THEN** it is recorded as a residual, not fixed

#### Scenario: Unproven material behaviour

- **WHEN** a blocker shows that a criterion covers deletion and no planned Verify command or test can fail when deletion breaks, and the verifier confirms the cited lines
- **THEN** it stays blocking

#### Scenario: Negative control

- **WHEN** an instruction lists a refuted or below-threshold finding under Blockers, or keeps apply blocked on a round whose findings are all residuals
- **THEN** review of that instruction MUST fail

### Requirement: Fix budget per depth

Confirmed blocking findings SHALL be fixed in the artifacts without asking while budget remains. `standard`: after the round-1 fixes, one fresh `plan-reviewer` checks the fix delta (fix entries plus artifact diff) under PROCESS 4. `risky`: after the round-1 fixes, round 2 is a full fresh two-reviewer round. No further dispatch SHALL follow without the user's answer.

#### Scenario: Standard change with fixes

- **WHEN** round 1 of a `standard` change leaves two confirmed blocking findings
- **THEN** both are fixed, the validator passes, and one delta check runs on the new digest; its findings are triaged like a round

#### Scenario: Risky change clean after triage

- **WHEN** round 1 of a `risky` change leaves only residuals
- **THEN** the review is OKAY after round 1 and no round 2 is dispatched

#### Scenario: Negative control

- **WHEN** an instruction dispatches a third full round of a `risky` change, or a second delta check of a `standard` change, before the user answered the exhaustion ask
- **THEN** review of that instruction MUST fail

### Requirement: The user is asked only on named exceptions

The instruction SHALL ask the user only when a finding in the security scope (review_scope item 4 or CHECK 1) or naming a protected asset is not confirmed; when the verifier returns `undecided` for a finding whose stated consequence meets the blocking threshold; when the budget is spent with a confirmed blocking finding open; or when a fix needs a scope decision the artifacts leave open. Otherwise it SHALL decide without asking.

#### Scenario: Refuted findings only

- **WHEN** every finding of a round is refuted and none is in the security scope
- **THEN** the round is OKAY with residuals and no question is asked

#### Scenario: Refuted security finding

- **WHEN** the verifier refutes a CHECK 1 finding that a QA step writes a provider key to an evidence file
- **THEN** the user is asked whether to fix it, keep it as a residual with their reason, or stop, before the round is recorded as OKAY

#### Scenario: Negative control

- **WHEN** an instruction records an unconfirmed security-scope finding as a residual without asking, or asks the user at a round whose findings are all refuted and outside the security scope
- **THEN** review of that instruction MUST fail

### Requirement: Budget exhaustion asks once and Override is the user's acceptance

When the budget is spent with a confirmed blocking finding open, one ask SHALL quote each such finding's area, defect and evidence verbatim with the verifier's reason, and offer Fix (followed by one more delta check), Override and Stop. Override SHALL record the user's reason in `review.md` with the artifacts unchanged and SHALL NOT be offered while an open finding is in the security scope or names a protected asset.

#### Scenario: User accepts a remaining finding

- **WHEN** round 2 of a `risky` change leaves one confirmed blocking finding about an unproven F1 evidence path and the user answers Override with a reason
- **THEN** `review.md` keeps the REJECT, its Blockers, and the user's reason as Override, and `--reviewed` passes

#### Scenario: Remaining security finding

- **WHEN** the open confirmed finding names a credential sink
- **THEN** the ask offers only Fix and Stop

#### Scenario: Negative control

- **WHEN** an instruction offers Override for an open security-scope finding, writes an Override the user did not give, or edits an artifact before writing Override
- **THEN** review of that instruction MUST fail

### Requirement: A round is recorded before any fix or ask

Before any fix or ask that follows a round or delta check, the instruction SHALL write `review.md` with that round's digest, verdict, depth, reviewer and verifier ids, Blockers (confirmed blocking findings verbatim, grouped by reviewer) and Residuals (every other finding with the verifier's result and reason), so a Stop or an interrupted session leaves no earlier OKAY current.

#### Scenario: Earlier OKAY stays superseded

- **WHEN** a plan with a current OKAY `review.md` is reviewed again unchanged, the round leaves a confirmed blocking finding, and the user later answers Stop
- **THEN** `review.md` already records that round's REJECT, so `--reviewed` fails and apply is not authorized

#### Scenario: Negative control

- **WHEN** an instruction edits an artifact or asks the user before writing the round's REJECT, or drops a residual from the record
- **THEN** review of that instruction MUST fail

### Requirement: Plan-review triage stays inside plan review

Depth, verifier triage, residuals, the fix budget and the exception asks SHALL apply to plan review of `omp-gated` changes only. F2 waves, F2 fix-delta reviews and F3 SHALL keep their convergence decisions, record vocabulary and the `Blocker disposition` section of the `review-work` skill unchanged.

#### Scenario: F2 wave with a below-threshold blocker

- **WHEN** an F2 wave returns FAIL with one blocker below the threshold
- **THEN** the instruction keeps the existing CONTINUE, STOP, freeze and override decisions and dispatches no `blocker-verifier`

#### Scenario: Negative control

- **WHEN** the F2, F3 or F2 delta instruction dispatches a `blocker-verifier` or records a blocker as a plan-review residual
- **THEN** review of that instruction MUST fail

## MODIFIED Requirements

### Requirement: Round verdict
A round SHALL be OKAY when, after verifier triage and any exception ask, no confirmed blocking finding remains open. Otherwise it SHALL be REJECT, and its record SHALL carry the open confirmed blocking findings verbatim, grouped by reviewer, under `## Blockers` and every other finding under `## Residuals`. `--reviewed` SHALL refuse a record whose verdict is OKAY while its `## Blockers` section is neither `none` nor empty.

#### Scenario: One rejecting lens rejects the round

- **WHEN** scope A returns OKAY, scope B returns REJECT with two blockers, and the verifier confirms one as blocking and refutes the other
- **THEN** the round's verdict is REJECT, `## Blockers` lists the confirmed one verbatim under scope B, and `## Residuals` lists the refuted one with the verifier's reason

#### Scenario: All lenses agree

- **WHEN** every reviewer of the round returns OKAY with no blockers
- **THEN** the round's verdict is OKAY and the `## Blockers` section is `none`

#### Scenario: All findings are residuals

- **WHEN** a reviewer returns REJECT and the verifier refutes every blocker outside the security scope
- **THEN** the round's verdict is OKAY, `## Blockers` is `none`, and `## Residuals` lists those findings

#### Scenario: Negative control

- **WHEN** `review.md` records `Verdict: OKAY` but its `## Blockers` section lists a finding
- **THEN** `validate-openspec-change.mjs --reviewed` MUST fail and name the Blockers section

### Requirement: Incomplete round
A reviewer or verifier task that returns no structured result (failure, timeout, unparsable output) SHALL get one fresh retry with the same brief. When the retry also returns none, the round SHALL be incomplete: the agent writes and edits no `review.md` for it and SHALL tell the user which task failed. A record of an earlier complete round stays as it was.

#### Scenario: Retry recovers the lens

- **WHEN** the scope B reviewer fails and its fresh retry returns REJECT
- **THEN** the round continues with scope A's result and the retry's, and the record lists the retry's subagent id for scope B

#### Scenario: Verifier without a result

- **WHEN** the verifier and its retry return no structured result
- **THEN** no `review.md` is written or edited for that round and the user is told the verifier failed

#### Scenario: Negative control

- **WHEN** a reviewer or the verifier of the first round of a change has no structured result after its retry
- **THEN** producing a review record for that round MUST fail: no `review.md` exists afterwards, so `--reviewed` keeps failing as missing

### Requirement: Reviewer record
`review.md` SHALL name the reviewers of the recorded round as `plan-reviewer` followed by the subagent ids the `task` tool returned, comma-separated; a `risky` round lists its scope A and scope B ids in that order, a `standard` round or a delta check its one id. `--reviewed` SHALL accept one or more ids and SHALL refuse an empty id, a template placeholder or a duplicate id.

#### Scenario: Three-lens record

- **WHEN** an open change's current `review.md` has `- **Reviewer**: plan-reviewer, LensCor1, LensVer1, LensChk1` from a review run before this change and is otherwise valid and current
- **THEN** `--reviewed` passes

#### Scenario: Record from before this change

- **WHEN** an open change's current `review.md` has `- **Reviewer**: plan-reviewer, PlanReviewR27`
- **THEN** `--reviewed` passes as before

#### Scenario: Risky record

- **WHEN** `review.md` has `- **Reviewer**: plan-reviewer, RevA1, RevB1` and is otherwise valid and current
- **THEN** `--reviewed` passes

#### Scenario: Negative control

- **WHEN** `review.md` has `- **Reviewer**: plan-reviewer, RevA1, RevA1`, or the template's scope-A placeholder in place of the first id
- **THEN** `--reviewed` MUST fail and name the Reviewer field

### Requirement: Verification lens judges real-session evidence

The verification scope (scope B of a `risky` round, or the single `standard` reviewer) SHALL judge model behaviour by whether the planned real-session run can expose the failure and whether its retained outputs establish the material behaviour, and SHALL NOT require a command that re-scores model behaviour.

#### Scenario: Ordinary session verification

- **WHEN** an instruction-only change verifies its behaviour in fresh ordinary sessions on disposable fixtures and retains their outputs
- **THEN** the verification scope does not block for a missing behaviour-scoring checker

#### Scenario: Negative control

- **WHEN** the planned behaviour scenario only checks that a sentence exists in a file, so it passes before the behaviour does
- **THEN** a verification scope that does not block on it MUST fail

### Requirement: Checks lens scope for session authentication

The security and checks scope (scope A of a `risky` round, or the single `standard` reviewer) and `plan-reviewer` CHECK 1 SHALL NOT require a credential, run-identity or dependency-lifetime inventory for change verification that only runs ordinary agent sessions with their existing provider authentication, and SHALL keep the full CHECK 1 inventory when a plan copies, routes, logs, stores or reconfigures a credential or delivers code that handles one.

#### Scenario: Ordinary session login

- **WHEN** a plan's QA runs ordinary local sessions on the developer's existing model configuration
- **THEN** the security and checks scope does not block for a missing credential or run-identity inventory of those sessions

#### Scenario: Negative control

- **WHEN** a plan's QA step copies the provider key from the agent configuration into a committed evidence file
- **THEN** a review that does not block under CHECK 1 MUST fail

## REMOVED Requirements

### Requirement: Three-lens review round
**Reason**: Replaced by depth-dependent dispatch: one reviewer for `standard`, two scoped reviewers for `risky`.
**Migration**: See "Review depth follows the change's risk" and "Fixed reviewer briefs on a pinned model".

#### Scenario: Negative control
- **WHEN** an instruction still dispatches three lens reviewers for a round
- **THEN** review of that instruction MUST fail

### Requirement: Early ask at a complete round with eligible blockers
**Reason**: Plan review no longer decides Accept eligibility per blocker; the verifier separates blocking findings from residuals.
**Migration**: See "Only confirmed findings block" and "The user is asked only on named exceptions".

#### Scenario: Negative control
- **WHEN** an instruction asks the user per blocker for Accept at a plan-review round within budget
- **THEN** review of that instruction MUST fail

### Requirement: The early ask is recorded first and quotes blockers verbatim
**Reason**: The early ask no longer exists; recording before any fix or ask is kept for every round.
**Migration**: See "A round is recorded before any fix or ask" and "Budget exhaustion asks once and Override is the user's acceptance".

#### Scenario: Negative control
- **WHEN** an instruction asks or fixes before recording the round's REJECT
- **THEN** review of that instruction MUST fail

### Requirement: Early ask stays inside plan review
**Reason**: Replaced by the scope rule for the new plan-review triage.
**Migration**: See "Plan-review triage stays inside plan review".

#### Scenario: Negative control
- **WHEN** an F2, F3 or delta instruction gains an early-ask step
- **THEN** review of that instruction MUST fail

### Requirement: Approach question at a recurring REJECT
**Reason**: The fixed budget per depth ends the loop; there is no recurring REJECT to diagnose.
**Migration**: See "Fix budget per depth" and "Budget exhaustion asks once and Override is the user's acceptance".

#### Scenario: Negative control
- **WHEN** an instruction asks an approach question with Continue, Re-plan, Split or Stop
- **THEN** review of that instruction MUST fail

### Requirement: The approach question diagnoses before it recommends
**Reason**: The approach question is removed.
**Migration**: None; the exhaustion ask quotes the open findings and the verifier's reasons.

#### Scenario: Negative control
- **WHEN** an instruction recommends an option at the exhaustion ask by counting findings
- **THEN** review of that instruction MUST fail

### Requirement: Unanswered approach question survives a resume
**Reason**: The approach question is removed; a recorded REJECT keeps apply blocked through `--reviewed`.
**Migration**: None.

#### Scenario: Negative control
- **WHEN** a resumed session with an unanswered exhaustion ask dispatches a reviewer before the user answers
- **THEN** review of that instruction MUST fail

### Requirement: Re-plan revises without accepting
**Reason**: Re-plan was an approach-question option; the user re-plans by stopping and editing the artifacts, which makes the review stale and starts a new review.
**Migration**: Answer Stop, revise the artifacts, run the review again.

#### Scenario: Negative control
- **WHEN** an instruction offers Re-plan as an option of a plan-review ask
- **THEN** review of that instruction MUST fail

### Requirement: Split separates the class-setting part
**Reason**: Split existed because a mandatory class made every plan-review blocker non-acceptable; verifier triage no longer depends on the class.
**Migration**: Answer Stop and propose the parts as separate changes when a split is wanted.

#### Scenario: Negative control
- **WHEN** an instruction offers Split as an option of a plan-review ask
- **THEN** review of that instruction MUST fail
