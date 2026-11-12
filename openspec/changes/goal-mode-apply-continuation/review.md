# Review

- **Verdict**: REJECT
- **Reviewed digest**: 99e4bdbe2002e82b6e2556b134f895fd182de625e690773bc5381b03d24ed00f
- **Depth**: risky
- **Reviewer**: plan-reviewer, GmacReviewA, GmacReviewB
- **Verifier**: blocker-verifier, none
- **Models**: GmacReviewA onara/cx/gpt-6.1-sol; GmacReviewB onara/cx/gpt-6.1-sol
- **Round**: 1
- **Awaiting**: triage
- **Override**: none

## Blockers

### Scope A (GmacReviewA)

1. **Correctness — owner notice**
   - Defect: On the normal authorized-goal path, implementing task 2.2 exactly as instructed produces a notice that omits pausing the goal, violating the notice requirement. The same task demands different text in its Verify command, so its implementation instruction and acceptance command cannot both be satisfied. This is reversible instruction-text damage.
   - Evidence: openspec/changes/goal-mode-apply-continuation/design.md:49 prescribes exactly: "Goal mode: the next goal continuation applies `<name>` unless you reply first." However, specs/openspec-planning-boundary/spec.md:51-55 requires naming both a message before the next turn and pausing the goal. tasks.md:12 instructs implementing design.md's additions exactly, while its Verify expects "To stop it, send a message before that turn starts or pause the goal." Task 4.1 also expects both mechanisms at tasks.md:22.
   - Change: Make design.md's exact delivered Output addition identical to the complete notice required by task 2.2 and the specification, explicitly naming both stop mechanisms and their timing.
   - not triaged: the verifier has not returned
2. **PROCESS 5 — gate.md classification and tasks.md Workflow follow-up**
   - Defect: The change modifies the admission boundary for applying product code, yet declares internal-tooling. Independently, its required risky depth cannot execute under that tier: risky requires two F2 invocations, whereas the validator permits exactly one for internal-tooling. Normal execution therefore cannot produce the required valid merge record. The classification is reversible before implementation.
   - Evidence: openspec/changes/goal-mode-apply-continuation/gate.md:4-5 declares risky plus internal-tooling; gate.md:6 acknowledges that the change decides when an otherwise unauthorized apply can edit source. tasks.md:26 repeats this incompatible F2 configuration. team-config/agent/skills/review-work/SKILL.md:96-109 requires both implementation-audit and strategic-risk-review for risky depth and explicitly requires re-tiering risky internal-tooling work to product. team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:660-661 rejects an internal-tooling record with anything other than exactly implementation-audit.
   - Change: Classify this gate-changing work as product in gate.md and the workflow follow-up, retain risky depth, and plan both required F2 invocations. Mandatory class may remain none if the delivered change introduces none of the mandatory-class behaviours; do not lower depth to evade the tier conflict.
   - not triaged: the verifier has not returned

### Scope B (GmacReviewB)

3. **Quality and verification — task 4.1, owner-objection coverage**
   - Defect: The veto session stops before it can observe the later continuation forbidden by requirement 3. An agent that obeys the objection in the user-message turn but starts apply on the following automatic continuation would pass the planned observation. This is an ordinary goal-session sequence; stopping the fixture hides the failure rather than establishing the requirement. Resulting fixture edits would be reversible, but the claimed veto proof is missing.
   - Evidence: openspec/changes/goal-mode-apply-continuation/tasks.md:20 stops each goal session once its turn after the proposal has read opsx-apply.md or ended. For veto, that turn is the queued owner's message. tasks.md:22 nevertheless requires owner-objects.md to establish that 'no later turn starts apply' and veto-nc.md to cover the log after the objection. specs/openspec-planning-boundary/spec.md:39-48 explicitly requires a later continuation not to apply against the objection.
   - Change: Give veto its own stopping rule: observe the objection turn and then a genuine subsequent runtime continuation while the goal remains active. Retain both turns and their tool interactions, showing the later continuation refuses apply and names the intervening user message. Specify a follow-up submission action and verify from the capture that the objection was delivered after presentation, not as steering during planning.
   - not triaged: the verifier has not returned
4. **Quality and verification — task 4.1, reviewed-validation precondition**
   - Defect: No real-session row exercises failure of the reviewed-validation precondition. All proposed continuation rows either use a reviewed proposal or test a different condition. A version that starts apply despite a rejected or stale review can therefore pass the whole matrix. This occurs during ordinary proposal revision and breaks the requirement to refuse before entering apply; downstream apply guards do not prove this boundary.
   - Evidence: openspec/changes/goal-mode-apply-continuation/specs/openspec-planning-boundary/spec.md:24-29 requires reviewed validation to pass and otherwise requires refusal with the failed condition named. design.md:30 specifically distinguishes refusing before apply from entering apply and stopping there. tasks.md:20-22 lists only nogoal, auth, planonly, veto, nogoal-continue and control-old; none supplies a presented change whose reviewed validation fails. Task 2.1's check at tasks.md:11 only establishes that the validator command text appears.
   - Change: Add a fresh ordinary goal-session row with an authorizing objective and an earlier presented proposal whose reviewed validation fails, for example because its review became stale after an artifact revision. Observe the actual continuation, retain the validator failure and refusal, and require no entry into apply. In authorized.md also retain the successful reviewed-validation result establishing the positive scenario's precondition.
   - not triaged: the verifier has not returned
5. **Executability — task 2.2 verification contradicts its required edit**
   - Defect: Task 2.2 cannot pass when implemented exactly as directed. Its required Output bullet and its grep expect different sentences. Normal faithful implementation therefore fails its named Verify command, and following the prescribed text also leaves F1 expecting stop instructions the delivered bullet does not contain. This is a reversible planning defect, but it prevents valid task completion.
   - Evidence: openspec/changes/goal-mode-apply-continuation/tasks.md:12 requires the four additions 'exactly' as design.md's Other edits paragraph. design.md:49 specifies 'Goal mode: the next goal continuation applies `<name>` unless you reply first.' The Verify command at tasks.md:12 instead requires 'Goal mode: the next goal continuation applies `<name>`. To stop it, send a message before that turn starts or pause the goal.' Task 4.1 at tasks.md:22 expects notice.md to establish both stop methods.
   - Change: Choose one complete notice that states both stop methods, then make design.md's literal edit, task 2.2's instruction and exact check, and task 4.1's observation agree.
   - not triaged: the verifier has not returned
6. **Executability — gate classification and F2**
   - Defect: The planned F2 combines risky depth with internal-tooling tier, which the shipped workflow cannot admit. Running the two reviews required at risky depth causes the validator to reject the record; running only the internal-tooling reviewer does not satisfy risky depth. This blocks the ordinary merge path even if implementation and QA pass; it is reversible by correcting classification before execution.
   - Evidence: openspec/changes/goal-mode-apply-continuation/gate.md:4-5 declares risky and internal-tooling; tasks.md:26 repeats that combination. openspec/config.yaml:11 requires classification from a real process boundary, and gate.md itself identifies an owner-authorization boundary. The repository's team-config/agent/skills/review-work/SKILL.md:95-109 requires both risky invocations and explicitly requires risky internal-tooling work to be re-tiered to product with user agreement. team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:660-661 rejects any internal-tooling record containing a second reviewer.
   - Change: Resolve the tier before handoff using the shipped review-work procedure. For the stated risky boundary change, obtain the required agreement, use product tier consistently in gate.md and tasks.md, and preserve risky depth. Do not silently lower review depth to make the record pass.
   - not triaged: the verifier has not returned
7. **Quality and verification — task 4.1 retained-evidence checks**
   - Defect: The F1 Verify command can pass after transcript or tool-log capture failed. It requires nonempty narrative row files but checks only that session directories exist. Empty session directories plus written observations satisfy it, although the outputs needed to establish turn boundaries, apply entry and objection handling are absent. A routine capture/export failure is sufficient; fabrication is not a necessary precondition. This leaves material behaviour unproved.
   - Evidence: openspec/changes/goal-mode-apply-continuation/tasks.md:20 promises each session's transcript and tool log and says each row cites its capture. The Verify command at tasks.md:22 only uses test -s for the twelve row Markdown files and test -d for the six session directories. openspec/schemas/omp-gated/schema.yaml:291 requires task commands to assert artifact presence and evidence integrity for model-read instruction changes.
   - Change: Name concrete transcript and tool-log artifacts for every session and require them to be nonempty and readable, along with the deterministic bump-check captures and their exit results. Check that each row's cited artifacts exist and retain the actual outputs. Continue judging model behaviour directly from those captures; no behavioural re-scoring command is needed.
   - not triaged: the verifier has not returned

## Residuals

none
