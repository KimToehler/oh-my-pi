# Negative control: Pin

Files: S = team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml (review instruction, lines 348-775), T = .../templates/consultation.md (1-16), A = team-config/agent/agents/architecture-oracle.md (1-38).

## (1) A substitute model's report

Forbidding:
- S:416-419 "The attempt counts only when it exits 0. For this agent that check decides the model question".
- S:420-421 entry records "every model its session file shows ... with `(no report)` appended when it did not count"; T:6 "(no report) after an attempt that did not count".
- S:428-431 "No other model's report ... stands in for the consultation."
- A:5 names the one model.

Permitting sentences: none found.
Readings checked: T:6 "further models appended" and S:420 allow recording several models, which could read as accepting a mixed-model report; but counting requires exit 0 (S:417-418) and S:419 assigns the model decision to that check, so a record of further models marks an uncounted attempt. The check's comparison itself is not in these three files (observation, not counted).

## (2) Expected model taken from `task.agentModelOverrides`

Forbidding: S:418-419 "the override-first pin check after step 3's briefs is not used"; S:428-430 treats "a configured override" as a cause of failure, never as the pin; A:5 is the pin.

Permitting sentences: none found.
Readings checked: S:551-555 (the override-first pin rule) sits in step 3 for plan-reviewers/verifiers, and S:418-419 excludes it for this agent explicitly. S:356 "stop" and "tell the user to add `task.agentModelOverrides`" is that same step-3 rule and is not reachable from step 2a.

## (3) An attempt counted without `--consultation-report` exiting 0

Forbidding: S:384-385 "an exit 0 counts the attempt"; S:383-385 exit 1 or no named file is a failed attempt; S:416-418 "The attempt counts only when it exits 0"; S:435-438 the Record's report is the output of that command.

Permitting sentences: none found.
Readings checked: S:381-382 an attempt still running is "waited for" and then S:416 applies; the retry and `(no report)` marking (S:420-424) never count; S:434 "Consultant ... <id of the counted attempt>" can only name one that counted.

## (4) A skip without the user

Forbidding: S:374-378 "when the user told you to skip the consultation and gave a reason ... Never write `skipped` without the user's answer."; S:425-428 only the user's choice of Skip "with the user's reason in their words" writes it; T:8 "none, or the user's reason in their words".

Permitting sentences: none found.
Readings checked: the Stop option (S:427-428) leaves `pending`, not `skipped`; no sentence lets the author skip on failure, on a configured override, or on a missing model entry (S:429-430).

## (5) The author's own review as a substitute

Forbidding: S:430-431 "No other model's report and no architecture review of your own stands in for the consultation."; S:450-452 admission dispatches nothing from step 3 while consultation.md is missing or `pending`; S:426-428 Stop leaves the `pending` record "which `--reviewed` refuses".

Permitting sentences: none found.
Readings checked: step 3's plan-reviewers (S:453-455) are a different gate and cannot reach step 3 without a `consulted` or `skipped` record; the Record's findings dispositions (S:438-443) are on the counted report only.

Verdict: (1) forbidden; (2) forbidden; (3) forbidden; (4) forbidden; (5) forbidden.

Overall: PASS
