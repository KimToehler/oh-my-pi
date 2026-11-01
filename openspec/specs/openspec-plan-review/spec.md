# openspec-plan-review Specification

## Purpose
Defines how the `review` artifact of an `omp-gated` OpenSpec change runs its independent plan-review rounds and what `review.md` must record before `validate-openspec-change.mjs --reviewed` lets apply start.

## Requirements

### Requirement: Three-lens review round
Each review round SHALL dispatch three fresh `plan-reviewer` tasks in one `task` batch, one per lens: correctness, verification, checks. Each task's brief SHALL be the schema's fixed brief verbatim with only the two paths filled in, followed by that lens's fixed paragraph from the schema, and nothing else. The checks lens SHALL cover CHECK 1 to 8, every check defined by rules loaded for the reviewer, and the merge-gate `Boundary:` rule.

#### Scenario: Instruction names three lens dispatches
- **WHEN** an agent reads the `review` instruction of a change whose project uses the deployed `omp-gated` schema
- **THEN** the instruction prescribes one batch of three `plan-reviewer` tasks, the fixed brief once, and exactly three lens paragraphs: correctness (review scope items 1 and 2), verification (items 3 and 5) and checks (item 4, CHECK 1 to 8, rule-defined checks, `Boundary:`)

#### Scenario: Rule-defined checks belong to the checks lens
- **WHEN** a rule loaded for `plan-reviewer` defines a check under its own label (for example `DOMAIN 2`)
- **THEN** the checks lens paragraph directs that reviewer to decide that check, and neither of the other two lens paragraphs excludes it from the checks lens

#### Scenario: Negative control
- **WHEN** a planner adds its own focus, a file list or a summary of the change to a lens brief, or dispatches only one or two lenses
- **THEN** recording that dispatch as a review round MUST fail: no review record is written from it

### Requirement: Round verdict
A round SHALL be OKAY only when all three lenses return OKAY. Otherwise it SHALL be REJECT, and its record SHALL carry the blockers of every rejecting lens verbatim, grouped by lens. `--reviewed` SHALL refuse a record whose verdict is OKAY while its `## Blockers` section is neither `none` nor empty.

#### Scenario: One rejecting lens rejects the round
- **WHEN** the correctness and checks lenses return OKAY and the verification lens returns REJECT with two blockers
- **THEN** the round's verdict is REJECT and `review.md` lists those two blockers verbatim under the verification lens

#### Scenario: All lenses agree
- **WHEN** all three lenses return OKAY
- **THEN** the round's verdict is OKAY and the `## Blockers` section is `none`

#### Scenario: Negative control
- **WHEN** `review.md` records `Verdict: OKAY` but its `## Blockers` section lists a lens's blockers
- **THEN** `validate-openspec-change.mjs --reviewed` MUST fail and name the Blockers section

### Requirement: Incomplete round
A lens that returns no structured verdict (failure, timeout, unparsable output) SHALL get one fresh retry with the same brief. When the retry also returns none, the round SHALL be incomplete: the agent writes and edits no `review.md` for it and SHALL tell the user which lens failed. A record of an earlier complete round stays as it was.

#### Scenario: Retry recovers the lens
- **WHEN** the checks lens fails and its fresh retry returns REJECT
- **THEN** the round's verdict is computed from the two first results and the retry, and the record lists the retry's subagent id for the checks lens

#### Scenario: Negative control
- **WHEN** a lens of the first round of a change has no structured verdict after its retry
- **THEN** producing a review record for that round MUST fail: no `review.md` exists afterwards, so `--reviewed` keeps failing as missing

### Requirement: Reviewer record
`review.md` SHALL name the reviewers of the recorded round as `plan-reviewer` followed by the subagent ids the `task` tool returned, comma-separated; a three-lens round lists its correctness, verification and checks ids in that order. `--reviewed` SHALL accept one or more ids and SHALL refuse an empty id, a template placeholder or a duplicate id.

#### Scenario: Three-lens record
- **WHEN** `review.md` has `- **Reviewer**: plan-reviewer, LensCor1, LensVer1, LensChk1` and is otherwise valid and current
- **THEN** `--reviewed` passes

#### Scenario: Record from before this change
- **WHEN** an open change's current `review.md` has `- **Reviewer**: plan-reviewer, PlanReviewR27`
- **THEN** `--reviewed` passes as before

#### Scenario: Negative control
- **WHEN** `review.md` has `- **Reviewer**: plan-reviewer, LensCor1, LensCor1, LensChk1`, or the template's correctness-id placeholder in place of the first id
- **THEN** `--reviewed` MUST fail and name the Reviewer field

### Requirement: Early ask at a complete round with eligible blockers

The `omp-gated` review instruction SHALL apply the `Blocker disposition` section of the `review-work` skill to every complete rejecting round, and SHALL ask the user at every complete rejecting round below the approach-question trigger that holds at least one Accept-eligible blocker, instead of fixing it first. The question SHALL decide per blocker: Accept recommended for an eligible one, Fix and Stop but not Accept for a non-eligible one, each with the consequence the reviewer stated.

#### Scenario: Round with only eligible blockers asks

- **WHEN** round 2 of a change returns REJECT, every dispatched lens returned a verdict, every open blocker is Accept-eligible, and the approach-question trigger is not met
- **THEN** the instruction directs the orchestrator to ask the user then, with Accept recommended and each blocker's stated consequence shown, rather than to fix them and dispatch round 3

#### Scenario: Mixed round asks per blocker

- **WHEN** a complete rejecting round below the approach-question trigger holds both eligible and non-eligible blockers
- **THEN** the orchestrator asks in that round, recommends Accept for each eligible blocker and offers only Fix or Stop for each non-eligible one, fixes the non-eligible ones and those the user chose to fix, and dispatches a fresh round; no blocker waits in session state for a later round

#### Scenario: Accept keeps its effect

- **WHEN** the user answers Accept for an eligible blocker
- **THEN** their own reason enters `gate.md` as an accepted residual risk or out-of-scope area, a fresh round follows, and that round's reviewers do not block on it

#### Scenario: Round with only blocking findings keeps the existing path

- **WHEN** a complete rejecting round below the approach-question trigger holds only non-eligible blockers, including the ambiguous and no-stated-consequence cases
- **THEN** the instruction directs a fix and a new round without an ask; from round 3 on, the approach question takes the place of the former per-blocker ask after the third REJECT

#### Scenario: Incomplete round keeps its stop

- **WHEN** a lens still returns no structured verdict after its retry
- **THEN** the round is incomplete: as today, no `review.md` is written, the user is told which lens failed, and the review stops; no fix and no ask follow from it

#### Scenario: Eligible blockers at the approach question

- **WHEN** the third REJECT holds both eligible and non-eligible blockers and the user answers Continue at the approach question
- **THEN** the non-eligible blockers are fixed without a per-blocker ask unless a fix needs a user decision, and the per-blocker ask covers the eligible ones, recommends Accept for each and shows each blocker's stated consequence

#### Scenario: Negative control

- **WHEN** an instruction defers an eligible blocker of a complete round below the approach-question trigger to a later round without asking, asks while a non-eligible blocker is open without naming it, or recommends or offers Accept for a non-eligible blocker
- **THEN** review of that instruction MUST fail

### Requirement: The early ask is recorded first and quotes blockers verbatim

Before an early ask, an approach question or any fix after a complete rejecting round, the instruction SHALL write `review.md` for that round with its digest, REJECT and the blockers verbatim, so a Stop or an interrupted session leaves no earlier OKAY current. A per-blocker ask SHALL quote each blocker's area, defect and stated consequence verbatim from the lens output and name the exclusions checked for it.

#### Scenario: Earlier OKAY stays superseded

- **WHEN** a plan with a current OKAY `review.md` is reviewed again unchanged, the round rejects with an eligible blocker, and the user answers Stop
- **THEN** `review.md` already records that round's REJECT, so `--reviewed` fails and apply is not authorized

#### Scenario: Verbatim ask

- **WHEN** a lens reports an eligible blocker whose consequence names a stale cross-reference
- **THEN** the ask shows its area, defect and consequence as the lens wrote them, with the exclusions that were checked and did not apply

#### Scenario: Negative control

- **WHEN** an instruction paraphrases a blocker in a per-blocker ask, or asks or fixes before recording the round's REJECT
- **THEN** review of that instruction MUST fail

### Requirement: Early ask stays inside plan review

The early-ask rule and the approach question SHALL apply to plan-review rounds only. The post-implementation lanes SHALL keep their existing convergence decisions and record vocabulary unchanged, and SHALL apply only the eligibility definition, the ambiguity default, the accept-path and coverage rules and the no-unrequested-mechanism rule of `review-blocker-disposition`.

#### Scenario: F2 wave with only eligible blockers

- **WHEN** an F2 fix wave returns FAIL and every blocker is Accept-eligible
- **THEN** the instruction keeps the existing CONTINUE, STOP and freeze decisions, records the user's acceptance through `override` plus a `downgrades` entry whose `rule` is `below-threshold`, `accepted-residual` or `frozen`, and introduces no early-ask path of its own

#### Scenario: F3 and delta keep their records

- **WHEN** a blocker stays unfixed at an F3 freeze or after a second delta REJECT
- **THEN** it is recorded as today: an F3 freeze in the F3 report's follow-up list with `GC decide --lane F3`, a delta acceptance with `GC accept`

#### Scenario: Negative control

- **WHEN** the F2, F3 or delta instruction carries an early-ask step or an approach question, or records an unfixed blocker outside its lane's existing record
- **THEN** review of that instruction MUST fail

### Requirement: Approach question at a recurring REJECT

At a complete REJECT of round 3 or later, or earlier when the correctness lens returned OKAY and every open blocker concerns the change's own verification method, the `omp-gated` review instruction SHALL ask one approach question before any per-blocker ask or fix, and again at every later such REJECT. It SHALL offer Continue, Re-plan, Stop and, where allowed, Split. Continue SHALL fix the non-eligible blockers, asking only for fixes that need a user decision, and dispatch a fresh round.

#### Scenario: Third REJECT asks first

- **WHEN** round 3 of a change is a complete REJECT whose blockers are all non-eligible
- **THEN** `review.md` records that REJECT, and the next action is the approach question; no artifact edit, per-blocker ask or dispatch precedes it

#### Scenario: Continue fixes and dispatches

- **WHEN** the user answers Continue, no blocker is eligible, and one fix needs a user decision on scope the artifacts leave open
- **THEN** the orchestrator asks that one decision with fix alternatives and Stop and no Accept, fixes the blockers in the artifacts, runs the validator, takes a new digest and dispatches three fresh lenses with no other per-blocker ask

#### Scenario: Early trigger on verification-only blockers

- **WHEN** round 2 is a complete REJECT, the correctness lens returned OKAY, and every open blocker concerns the change's verification method
- **THEN** the approach question is asked in round 2

#### Scenario: Negative control

- **WHEN** an instruction fixes or asks per blocker before the approach question at round 3, asks it at a round-1 REJECT whose correctness lens rejected, or offers Accept for a non-eligible blocker after Continue
- **THEN** review of that instruction MUST fail

### Requirement: The approach question diagnoses before it recommends

The approach question SHALL show the round; per lens its verdict and blocker count; per blocker its area and whether it concerns the delivered change or the change's verification, judged by consequence as `Blocker disposition` judges eligibility, never changing severity; the Mandatory class, the part that sets it and its effect on Accept; a causal diagnosis of what keeps generating blockers; and a recommendation of the option that removes that cause while best keeping the goal, with its reason.

#### Scenario: Diagnosis matches the round

- **WHEN** two lenses reject and most blockers ask for more inventories of the change's own QA setup
- **THEN** the question shows each lens's verdict and count as returned, assigns those blockers to verification, and names the QA design as the cause behind its recommendation

#### Scenario: Assignment and eligibility agree under a mandatory class

- **WHEN** a change's Mandatory class is `concurrency-state`, the approach question shows one blocker as concerning verification, and that blocker misses both limbs of the blocking threshold with no other exclusion applying
- **THEN** the question states that Accept is available for that blocker, and after Continue the per-blocker ask recommends Accept for it

#### Scenario: Negative control

- **WHEN** an instruction recommends an option by counting blockers, offers pre-written fixes as options, or shows a blocker as concerning verification while the eligibility decision treats it as concerning the delivered change, or the reverse
- **THEN** review of that instruction MUST fail

### Requirement: Unanswered approach question survives a resume

A session that resumes a review whose approach question is unanswered SHALL ask it again before any artifact edit or dispatch, and the REJECT already recorded in `review.md` SHALL keep apply blocked meanwhile.

#### Scenario: Resumed session asks again

- **WHEN** the session is interrupted while the approach question is open and then resumed
- **THEN** it asks the approach question again before any artifact edit or dispatch, and `--reviewed` keeps failing on the recorded REJECT meanwhile

#### Scenario: Negative control

- **WHEN** a resumed session edits an artifact or dispatches lenses before the approach question is answered
- **THEN** review of that instruction MUST fail

### Requirement: Re-plan revises without accepting

Re-plan SHALL revise the design, the verification and every affected artifact, including the gate classification when the new approach changes it, without any per-blocker ask and without recording an Accept, Override or residual risk from the round, and SHALL then validate and dispatch a fresh three-lens round. Stop SHALL end the review with no edit and no dispatch. No option of the approach question SHALL authorize apply.

#### Scenario: Re-plan changes the class

- **WHEN** the user answers Re-plan and the new approach removes the part that set the class
- **THEN** `gate.md` carries the class of the revised delivered change, no Accept from that round appears in it, and a validated fresh round follows

#### Scenario: Stop ends the review

- **WHEN** the user answers Stop at the approach question
- **THEN** no artifact is edited and no lens is dispatched, and `--reviewed` keeps failing

#### Scenario: Negative control

- **WHEN** Re-plan records an Accept or leaves a changed class stale, or Stop edits an artifact or dispatches a round
- **THEN** review of that instruction MUST fail

### Requirement: Split separates the class-setting part

Split SHALL be offered only when the Mandatory class is not `none` and a named class-setting part can ship separately from a useful remainder. It SHALL name both scopes, why they are independent and what of the original goal the remainder no longer meets, revise the artifacts to the retained scope, name the removed part as a separate change reviewed before it is implemented, and reclassify the retained behaviour.

#### Scenario: Split keeps the removed part's class

- **WHEN** a change pairs an auth flow with an independent rename and the user answers Split
- **THEN** both scopes are named, the auth part leaves as a separate change that keeps `auth-secrets-pii`, and the retained rename is reclassified and reviewed fresh

#### Scenario: No Split without a remainder

- **WHEN** the Mandatory class is `none`, or the class-setting part cannot ship apart from a useful remainder
- **THEN** the approach question offers no Split

#### Scenario: Negative control

- **WHEN** Split keeps the class-setting part in the retained scope with a lowered class, or accepts the removed part's blockers
- **THEN** review of that instruction MUST fail

### Requirement: Verification lens judges real-session evidence

The verification lens SHALL judge model behaviour by whether the planned real-session run can expose the failure and whether its retained outputs establish the material behaviour, and SHALL NOT require a command that re-scores model behaviour.

#### Scenario: Ordinary session verification

- **WHEN** an instruction-only change verifies its behaviour in fresh ordinary sessions on disposable fixtures and retains their outputs
- **THEN** the verification lens does not block for a missing behaviour-scoring checker

#### Scenario: Negative control

- **WHEN** the planned behaviour scenario only checks that a sentence exists in a file, so it passes before the behaviour does
- **THEN** a verification lens that does not block on it MUST fail

### Requirement: Checks lens scope for session authentication

The checks lens and `plan-reviewer` CHECK 1 SHALL NOT require a credential, run-identity or dependency-lifetime inventory for change verification that only runs ordinary agent sessions with their existing provider authentication, and SHALL keep the full CHECK 1 inventory when a plan copies, routes, logs, stores or reconfigures a credential or delivers code that handles one.

#### Scenario: Ordinary session login

- **WHEN** a plan's QA runs ordinary local sessions on the developer's existing model configuration
- **THEN** the checks lens does not block for a missing credential or run-identity inventory of those sessions

#### Scenario: Negative control

- **WHEN** a plan's QA step copies the provider key from the agent configuration into a committed evidence file
- **THEN** a review that does not block under CHECK 1 MUST fail
