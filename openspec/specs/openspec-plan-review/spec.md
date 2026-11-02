# openspec-plan-review Specification

## Purpose
Defines how the `review` artifact of an `omp-gated` OpenSpec change runs its independent plan-review rounds and what `review.md` must record before `validate-openspec-change.mjs --reviewed` lets apply start.

## Requirements

### Requirement: Round verdict
A round SHALL be OKAY when, after verifier triage and the user's answer to every exception ask, no confirmed blocking finding and no finding awaiting an exception answer remains open. Otherwise it SHALL be REJECT, and its record SHALL carry those open findings verbatim, grouped by reviewer, under `## Blockers` and every other finding under `## Residuals`. `--reviewed` SHALL refuse a record whose verdict is OKAY while its `## Blockers` section is neither `none` nor empty.

#### Scenario: One rejecting lens rejects the round

- **WHEN** scope A returns OKAY, scope B returns REJECT with two blockers, and the verifier confirms one as blocking and refutes the other
- **THEN** the round's verdict is REJECT, `## Blockers` lists the confirmed one verbatim under scope B, and `## Residuals` lists the refuted one with the verifier's reason

#### Scenario: All lenses agree

- **WHEN** every reviewer of the round returns OKAY with no blockers and the round carries no finding from an incomplete round
- **THEN** the round's verdict is OKAY and the `## Blockers` section is `none`

#### Scenario: All findings are residuals

- **WHEN** a reviewer returns REJECT and the verifier refutes every blocker outside the security scope
- **THEN** the round's verdict is OKAY, `## Blockers` is `none`, and `## Residuals` lists those findings

#### Scenario: Negative control

- **WHEN** `review.md` records `Verdict: OKAY` but its `## Blockers` section lists a finding
- **THEN** `validate-openspec-change.mjs --reviewed` MUST fail and name the Blockers section

### Requirement: Incomplete round
A reviewer or verifier task that returns no structured result (failure, timeout, unparsable output) or runs on a model other than its pin SHALL get one fresh retry with the same brief; so SHALL a verifier whose result is incomplete. A reviewer whose retry fails too makes the round incomplete: the agent SHALL tell the user and stop. A verifier whose retry fails too SHALL leave the round recorded REJECT with Awaiting `triage`.

#### Scenario: Retry recovers the lens

- **WHEN** the scope B reviewer fails and its fresh retry returns REJECT
- **THEN** the round continues with scope A's result and the retry's, and the record lists the retry's subagent id for scope B

#### Scenario: Reviewer fails beside a rejecting reviewer

- **WHEN** a `risky` change with a current OKAY `review.md` is reviewed again unchanged, scope A returns REJECT with two blockers, and scope B has no verdict after its retry
- **THEN** `review.md` records that round as REJECT with Awaiting `incomplete` and scope A's two blockers verbatim under `## Blockers`, each untriaged because the round is incomplete; no verifier is dispatched, nothing is fixed or asked, `--reviewed` fails, and the user is told scope B failed

#### Scenario: No delivered blocker

- **WHEN** a reviewer has no verdict after its retry, no other reviewer of the round delivered a blocker, and the round carries nothing from an incomplete round
- **THEN** no `review.md` is written or edited, an earlier record stays as it was, and the user is told which reviewer failed

#### Scenario: Repeated incomplete round

- **WHEN** the re-run of an incomplete round is itself incomplete and its fresh reviewers delivered no new blocker
- **THEN** the findings carried from the incomplete record are written again with Verdict REJECT and Awaiting `incomplete`, still marked as carried and untriaged, that record replaces the one it resumed, and the user is told which reviewer failed

#### Scenario: Verifier with an incomplete result

- **WHEN** the verifier returns results for blockers 1 and 3 of three, and its retry again omits one
- **THEN** `review.md` records that round as REJECT with Awaiting `triage` and all three blockers untriaged under `## Blockers`, `--reviewed` fails, and the user is told the verifier failed

#### Scenario: Failed triage supersedes an earlier approval

- **WHEN** a change with a current OKAY `review.md` is reviewed again unchanged, every reviewer returns blockers, and both verifier attempts fail
- **THEN** the earlier OKAY is replaced by that round's REJECT record, so `--reviewed` fails and apply is not authorized

#### Scenario: Negative control

- **WHEN** a reviewer has no verdict after its retry and its round is triaged, fixed, asked about or recorded OKAY, a blocker another reviewer of that round delivered leaves an earlier OKAY record current, or a verifier failure leaves an earlier OKAY record current
- **THEN** review of that instruction MUST fail

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

### Requirement: Review depth follows the change's risk

Before round 1 the planner SHALL record `- **Depth**:` in `gate.md` with its reason: `risky` when the Mandatory class is not `none` or the change alters a review, gate or release mechanism, else `standard`; a fix changing either SHALL update it before the next dispatch. `standard` dispatches one fresh `plan-reviewer` with all scopes; `risky` dispatches two in one batch, scope A (correctness, architecture, security, checks) and scope B (verification, executability).

#### Scenario: Instruction change without a class

- **WHEN** a change has Mandatory class `none` and edits a skill's wording without touching a review, gate or release mechanism
- **THEN** `gate.md` records depth `standard` and each round dispatches one `plan-reviewer`

#### Scenario: Class-bearing change

- **WHEN** a change has Mandatory class `concurrency-state`
- **THEN** `gate.md` records depth `risky` and each full round dispatches the scope A and scope B reviewers in one batch

#### Scenario: Gate mechanism without a class

- **WHEN** a change has Mandatory class `none` and changes what `validate-openspec-change.mjs --reviewed` accepts
- **THEN** its depth is `risky`

#### Scenario: Negative control

- **WHEN** an instruction records depth `standard` for a change whose Mandatory class is `auth-secrets-pii`, dispatches one reviewer for a `risky` change, or keeps the old depth after a fix raised the class
- **THEN** review of that instruction MUST fail

### Requirement: Fixed reviewer briefs on a pinned model

Every full-round plan-reviewer task SHALL carry the brief fixed in the schema verbatim with only the repository and change paths filled in, followed by its depth's fixed scope paragraph and nothing else; a delta check SHALL carry the schema's fixed delta brief with only the paths, the fix entries and the patch path filled in. The team seed SHALL resolve `plan-reviewer` to `onara/cx/gpt-6.1-sol:high` through `task.agentModelOverrides`.

#### Scenario: Standard dispatch

- **WHEN** a `standard` change starts round 1 in an agent directory seeded from the team config
- **THEN** the one `plan-reviewer` task carries the fixed brief and the all-scopes paragraph, and its run resolves to `onara/cx/gpt-6.1-sol:high`

#### Scenario: Negative control

- **WHEN** an instruction adds its own focus, a file list or a summary of the change to a brief, or the seed leaves `plan-reviewer` on the `advisor` role
- **THEN** review of that instruction or seed MUST fail

### Requirement: A dispatch counts only on its pinned model

After every dispatch the instruction SHALL read the models the dispatch's session file records and record them per dispatch under `- **Models**:` in `review.md`. A dispatch any of whose turns ran on a model other than its agent's pin SHALL count as one without a structured result. Without a pin for a dispatched agent, from the overrides or an agent definition, the instruction SHALL stop, name the missing override and write no record.

#### Scenario: Credential fallback to the parent model

- **WHEN** the pinned `plan-reviewer` model has no working credentials, so both attempts of a `standard` round-1 dispatch run on the parent session's model
- **THEN** neither verdict counts, the round is incomplete, no `review.md` is written, and the user is told which model the dispatch ran on instead of its pin

#### Scenario: Retry chain switches a reviewer mid-run

- **WHEN** scope A's session records its last turns on `onara/cc/claude-opus-5` after the retry chain switched it from its pin, and its fresh retry runs on the pin throughout
- **THEN** the round continues with the retry's verdict, the Reviewer field lists the retry's id, and `- **Models**:` lists both attempts, the switched one marked as having no verdict

#### Scenario: Substituted verifier

- **WHEN** both verifier attempts of a rejecting round run on a model other than the verifier's pin
- **THEN** the round is recorded REJECT with Awaiting `triage` and its findings untriaged, as for a verifier without a structured result

#### Scenario: Installation without the pin

- **WHEN** the configuration has no `task.agentModelOverrides` entry for `plan-reviewer` and no agent definition in the agent directory names its model, as on an installation updated without merging the new seed entry
- **THEN** the review stops before its first dispatch counts, writes no `review.md`, and tells the user to add the override

#### Scenario: Negative control

- **WHEN** an instruction counts a verdict or triage result from a dispatch whose session records a model other than its pin, or writes a record whose `- **Models**:` omits a dispatch of the recorded round
- **THEN** review of that instruction MUST fail

### Requirement: A verifier triages every finding

After every complete round or delta check with a blocker or a finding carried from an incomplete round, the instruction SHALL dispatch one fresh `blocker-verifier` with its fixed brief and every such finding verbatim, numbered 1 to N. It SHALL return per finding `confirmed`, `refuted` or `undecided`, a reason, and for `confirmed` whether the threshold is met. A result without exactly one entry per index SHALL count as incomplete. The instruction SHALL NOT decide an untriaged finding itself.

#### Scenario: Round with findings

- **WHEN** a `risky` round returns REJECT from scope A with two blockers and OKAY from scope B
- **THEN** one verifier task receives both blockers verbatim and returns one result per blocker before any artifact is edited

#### Scenario: Round without findings

- **WHEN** every reviewer of a round returns OKAY with no blockers and no finding is carried from an incomplete round
- **THEN** no verifier is dispatched and the round is OKAY

#### Scenario: Negative control

- **WHEN** an instruction fixes or asks about a blocker before the verifier returned, sends the verifier a paraphrase or a subset of the round's blockers, triages a verifier result that omits an index or repeats one, or triages a finding itself after the verifier failed
- **THEN** review of that instruction MUST fail

### Requirement: Only confirmed findings block

A blocker SHALL stay blocking only when the verifier confirms a concrete failure scenario, evidence at the cited `file:line` or plan quote, and the blocking threshold. A check the plan runs refutes only a blocker about missing or ineffective verification, never one about what the plan delivers. A finding awaiting an ask stays blocking; an untriaged one forces REJECT and SHALL NOT become a residual. Every other blocker becomes a residual that never blocks apply.

#### Scenario: Speculative finding

- **WHEN** a blocker says a race might occur but names no sequence that produces it and no cited line supports it
- **THEN** the verifier refutes it and it is recorded as a residual

#### Scenario: Preference about a check that already catches the failure

- **WHEN** a blocker asks for a different Verify method while the planned test already fails when the named failure occurs
- **THEN** it is recorded as a residual, not fixed

#### Scenario: Detection is not resolution

- **WHEN** a blocker names a contradiction between two of the plan's own rules and the plan schedules a QA run whose retained outputs would exhibit it
- **THEN** the verifier confirms it: the scheduled run refutes only a finding about verification, so the contradiction stays blocking until the plan is fixed

#### Scenario: Unproven material behaviour

- **WHEN** a blocker shows that a criterion covers deletion and no planned Verify command or test can fail when deletion breaks, and the verifier confirms the cited lines
- **THEN** it stays blocking: a check the plan runs is a task's `Verify:` command, a test the tasks name or a planned real-session run, while a `### Requirement:` block or a `#### Scenario:`, its Negative control included, is a criterion, not a check, and refutes nothing

#### Scenario: Finding no verifier triaged

- **WHEN** both verifier attempts of a rejecting round fail, so its findings carry no result
- **THEN** they stay under Blockers as untriaged with that reason, the round is recorded REJECT, and apply stays blocked until a later verifier triages them

#### Scenario: Negative control

- **WHEN** an instruction lists a refuted or below-threshold finding under Blockers, keeps apply blocked on a round whose findings are all residuals, refutes a finding about a Verify command that cannot fail by citing a requirement or scenario no task executes, refutes a finding about what the plan delivers by citing a check that would detect it later, or records an untriaged finding as a residual or ends its round OKAY
- **THEN** review of that instruction MUST fail

### Requirement: Fix budget per depth

Confirmed blocking findings SHALL be fixed and committed without asking while budget remains. `standard`: one fresh `plan-reviewer` then checks the fix delta under PROCESS 4. `risky`: round 2 is a full fresh two-reviewer round on the new digest. No further dispatch SHALL follow without the user's answer, and a Fix answer to an exhaustion, exception or scope ask on a spent budget SHALL authorize its edits and exactly one further delta check.

#### Scenario: Standard change with fixes

- **WHEN** round 1 of a `standard` change leaves two confirmed blocking findings
- **THEN** both are fixed, the validator passes, and one delta check runs on the new digest, built from the fixed findings verbatim as fix entries plus `git diff <c> -- <change dir>` without `review.md`, where `<c>` is the commit that recorded the round; its findings are triaged like a round

#### Scenario: Risky change with fixes

- **WHEN** round 1 of a `risky` change leaves one confirmed blocking finding
- **THEN** it is fixed and committed, and round 2 dispatches fresh scope A and scope B reviewers with new subagent ids on the new digest

#### Scenario: Risky change clean after triage

- **WHEN** round 1 of a `risky` change leaves only residuals
- **THEN** the review is OKAY after round 1 and no round 2 is dispatched

#### Scenario: Exception answered Fix with the budget spent

- **WHEN** the delta check of a `standard` change leaves only an undecided finding whose consequence meets the threshold, and the user answers Fix to its exception ask
- **THEN** the artifacts are fixed and exactly one further delta check runs on the new digest, and no further dispatch follows it without another answer

#### Scenario: Negative control

- **WHEN** an instruction dispatches a third full round of a `risky` change or a second delta check of a `standard` change before the user answered the exhaustion ask or answered Fix to an exception or scope ask on a spent budget, ends a `risky` review OKAY after round-1 fixes without round 2, answers them with a one-reviewer delta check, offers a Fix answer it cannot carry out, or builds a delta check from a diff base other than the recording commit
- **THEN** review of that instruction MUST fail

### Requirement: Reviewed bytes are committed

Before every round or delta-check dispatch, the instruction SHALL update `- **Depth**:` when a fix changed the class or the reach, then commit the change folder, confirm `git status --porcelain -- <change dir>` is empty and take the digest, and SHALL commit each round's `review.md` before any fix or ask. The commit that records a round therefore holds exactly the planning bytes that round reviewed, and it is the base of the next delta check.

#### Scenario: Draft created without a commit

- **WHEN** `/opsx-propose` wrote the planning artifacts without committing them and round 1 of a `standard` change is about to be dispatched
- **THEN** the artifacts are committed first, and the later delta patch shows every change made after round 1, including a removed line that existed only in the reviewed draft

#### Scenario: A fix raises the depth

- **WHEN** a fix between two rounds makes a `standard` change `risky`
- **THEN** the depth bullet is updated before the folder is committed and digested, so the digest covers the new depth and the next dispatch is the one that depth prescribes

#### Scenario: Negative control

- **WHEN** an instruction dispatches a round or delta check while the change folder has uncommitted or untracked changes, or takes a delta base whose change folder differs from the reviewed bytes
- **THEN** review of that instruction MUST fail

### Requirement: The user is asked only on named exceptions

The instruction SHALL ask the user only when a finding in the security scope (review_scope item 4 or CHECK 1) or naming a protected asset is not confirmed; when the verifier returns `undecided` for a finding whose stated consequence meets the blocking threshold; when the budget is spent with a confirmed blocking finding open; or when a fix needs a scope decision the artifacts leave open. Otherwise it SHALL decide without asking.

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

#### Scenario: Negative control

- **WHEN** an instruction records an unconfirmed security-scope finding, or an `undecided` finding whose stated consequence meets the threshold, as a residual without asking, applies a fix that needs an open scope decision without asking, offers keep for a finding the verifier confirmed as blocking, or asks the user at a round whose findings are all refuted and outside the security scope
- **THEN** review of that instruction MUST fail

### Requirement: Budget exhaustion asks once and Override is the user's acceptance

When the budget is spent with a confirmed blocking finding open, the instruction SHALL edit no artifact and SHALL ask once, quoting each such finding's area, defect and evidence verbatim with the verifier's reason, offering Fix (followed by one more delta check), Override and Stop. Override SHALL record the user's reason in `review.md` with the artifacts unchanged and SHALL NOT be offered while an open finding is in the security scope or names a protected asset.

#### Scenario: User accepts a remaining finding

- **WHEN** round 2 of a `risky` change leaves one confirmed blocking finding about an unproven F1 evidence path and the user answers Override with a reason
- **THEN** `review.md` keeps the REJECT, its Blockers, and the user's reason as Override, and `--reviewed` passes

#### Scenario: Remaining security finding

- **WHEN** the open confirmed finding names a credential sink
- **THEN** the ask offers only Fix and Stop

#### Scenario: Nothing is fixed before the ask

- **WHEN** the delta check of a `standard` change leaves one confirmed blocking finding
- **THEN** the artifacts stay as the delta check read them until the user answers, so an Override accepts exactly those bytes, and only Fix starts the edits and the one further delta check

#### Scenario: Negative control

- **WHEN** an instruction offers Override for an open security-scope finding, writes an Override the user did not give, edits an artifact before writing Override, or fixes a finding after the budget is spent without the user's Fix answer
- **THEN** review of that instruction MUST fail

### Requirement: A round is recorded before any fix or ask

Before any fix or ask that follows a round or delta check, the instruction SHALL write `review.md` with that round's digest, verdict, depth, reviewer and verifier ids, each dispatch's models, Blockers and Residuals, so a Stop or an interrupted session leaves no earlier OKAY current. A round whose reviewers delivered blockers SHALL be recorded REJECT with Awaiting `triage` before the verifier is dispatched, and the post-triage record replaces it on the same digest.

#### Scenario: Earlier OKAY stays superseded

- **WHEN** a plan with a current OKAY `review.md` is reviewed again unchanged, the round leaves a confirmed blocking finding, and the user later answers Stop
- **THEN** `review.md` already records that round's REJECT with the confirmed finding and every finding awaiting an exception answer verbatim under Blockers, grouped by reviewer, and every other finding under Residuals with the verifier's result and reason, so `--reviewed` fails and no unanswered exception authorizes apply

#### Scenario: Session dies while the verifier runs

- **WHEN** a plan with a current OKAY `review.md` is reviewed again unchanged, the round's reviewers deliver blockers, and the session is interrupted after the verifier is dispatched and before any result is recorded
- **THEN** the record committed before that dispatch already holds REJECT with Awaiting `triage` and the untriaged blockers, so `--reviewed` fails and a later session resumes the triage instead of applying

#### Scenario: Negative control

- **WHEN** an instruction edits an artifact or asks the user before writing the round's REJECT, dispatches the verifier before the round's rejection is committed, drops a residual from the record, or records a finding awaiting an exception answer outside Blockers
- **THEN** review of that instruction MUST fail

### Requirement: Resume from the record

`review.md` SHALL carry `- **Awaiting**:` (`none`, `exception`, `exhaustion`, `scope`, `triage` or `incomplete`), and each finding under Blockers its verifier result and reason, or why it is untriaged. A session resuming on the recorded digest SHALL, before any edit, re-ask the recorded ask, triage exactly the untriaged findings, or re-run an `incomplete` round in full, triaging its carried findings with the re-run's. It SHALL NOT re-triage a recorded result, drop a carried finding, or add one.

#### Scenario: Interrupted exhaustion ask

- **WHEN** the session ends after writing a round-2 REJECT with Awaiting `exhaustion` and before the user answered, and a new session resumes the review
- **THEN** it asks the exhaustion ask again, quoting the recorded findings and verifier reasons, and dispatches no verifier or reviewer first

#### Scenario: Interrupted triage

- **WHEN** a record carries Awaiting `triage` with two untriaged findings and a new session resumes the review on the unchanged digest
- **THEN** it dispatches one verifier for exactly those two findings and dispatches no reviewer

#### Scenario: Interrupted incomplete round

- **WHEN** a record carries Awaiting `incomplete` and a new session resumes the review on the unchanged digest
- **THEN** it dispatches the recorded round's reviewers fresh and in full under the same round number, the incomplete round spends no budget, the verifier receives the record's delivered findings verbatim, carried ones first, with the re-run's blockers, and the re-run's record replaces the incomplete one

#### Scenario: Re-run misses a carried finding

- **WHEN** the re-run of an incomplete round returns OKAY with no blockers from both scopes, and the incomplete record carried one blocker from scope A
- **THEN** a verifier is still dispatched for that carried blocker, and the round is OKAY only if the verifier triages it out of Blockers; when it confirms it as blocking, the record is REJECT with the finding under scope A marked as carried from the incomplete round

#### Scenario: Negative control

- **WHEN** an instruction re-triages a finding whose verifier result the record carries, offers "keep" for a finding recorded as confirmed, writes a record with an open ask and Awaiting `none`, dispatches a reviewer on a resume whose record's Awaiting is not `incomplete`, or ends the re-run of an incomplete round without triaging every finding it carried, or merges a carried finding into a repeat of it
- **THEN** review of that instruction MUST fail

### Requirement: The record matches the change's risk

`validate-openspec-change.mjs` SHALL refuse a `gate.md` Depth other than `standard` or `risky`, and Depth `standard` with a Mandatory class other than `none`. `--reviewed` SHALL refuse a record of Round 1 or 2 with fewer than two reviewer ids when `gate.md` has Depth `risky` or a class other than `none`. Round counts rounds and delta checks from 1. A `gate.md` without Depth is checked on its class alone.

#### Scenario: Risky change recorded with one reviewer

- **WHEN** `gate.md` has class `concurrency-state` and Depth `risky`, and a current `review.md` of Round 1 names one reviewer id
- **THEN** `--reviewed` fails and names the Reviewer field

#### Scenario: Exhaustion delta check

- **WHEN** a `risky` change's current OKAY `review.md` is Round 3 with one reviewer id
- **THEN** `--reviewed` passes

#### Scenario: Record from before this change

- **WHEN** `gate.md` has class `concurrency-state` and no Depth, and a current OKAY `review.md` names three lens ids
- **THEN** `--reviewed` passes

#### Scenario: Class-bearing record without Depth names one reviewer

- **WHEN** `gate.md` has class `concurrency-state` and no Depth, and a current OKAY `review.md` of Round 1 names one reviewer id
- **THEN** `--reviewed` fails and names the Reviewer field

#### Scenario: Risky round 2 recorded with one reviewer

- **WHEN** `gate.md` has Depth `risky`, and a current OKAY `review.md` of Round 2 names one reviewer id
- **THEN** `--reviewed` fails and names the Reviewer field

#### Scenario: Negative control

- **WHEN** `gate.md` has Depth `standard` and Mandatory class `auth-secrets-pii`
- **THEN** `validate-openspec-change.mjs` MUST fail and name the Depth field

### Requirement: Plan-review triage stays inside plan review

Depth, verifier triage, residuals, the fix budget and the exception asks SHALL apply to plan review of `omp-gated` changes only. F2 waves, F2 fix-delta reviews and F3 SHALL keep their convergence decisions, record vocabulary and the `Blocker disposition` section of the `review-work` skill unchanged.

#### Scenario: F2 wave with a below-threshold blocker

- **WHEN** an F2 wave returns FAIL with one blocker below the threshold
- **THEN** the instruction keeps the existing CONTINUE, STOP, freeze and override decisions and dispatches no `blocker-verifier`

#### Scenario: Negative control

- **WHEN** the F2, F3 or F2 delta instruction dispatches a `blocker-verifier` or records a blocker as a plan-review residual
- **THEN** review of that instruction MUST fail
