# Negative control: Pin

Files reviewed: `S` = schema.yaml review instruction (348-770), `T` = templates/consultation.md, `A` = architecture-oracle.md. Quotes join wrapped lines.

## (1) A substitute model's report used

Forbidding sentences:
- S:416-419 "Counting, on completion and on recovery alike: run `V --consultation-report <session file> <change-dir>` on the session file the entry names. The attempt counts only when it exits 0. For this agent that check decides the model question".
- S:379-385 recovery counts only on exit 0; "as is one whose check exits 1".
- S:427-428 "No other model's report and no architecture review of your own stands in for the consultation."
- S:424-425 after two failed attempts the user may only Skip or Stop.

Permitting sentences: none. Considered: the generic pin paragraph S:545-557 ("A dispatch that ran on any other model counts as a dispatch without a structured result") applies to "every reviewer or verifier dispatch" and is explicitly not used for the consultation (S:419-420); the report command's model comparison is spec-defined, not restated in S.

Verdict: forbidden

## (2) Expected model taken from `task.agentModelOverrides`

Forbidding sentences:
- S:418-420 "For this agent that check decides the model question; the override-first pin check after step 3's briefs is not used."
- A:5 "model: onara/cc/claude-fable-5-2:high" is the expected model (definition), compared by the report command.

Loose sentences (not permits, scoped away): S:548-550 "compare them ... with the agent's pin: the entry for that agent in `omp config get task.agentModelOverrides`, else the model named in its definition" sits under "After every reviewer or verifier dispatch" (S:545); the consultant is neither, and S:419-420 exempts it. A literal agent that treats `architecture-oracle` as a "reviewer" is stopped by the explicit exemption.

Verdict: forbidden

## (3) An attempt counted without `--consultation-report` exiting 0

Forbidding sentences:
- S:417-419 "The attempt counts only when it exits 0."
- S:384-385 "an exit 0 counts the attempt and goes to Record below."
- S:380-382 a still-running job "is waited for"; its count happens at "Counting, on completion and on recovery alike" (S:416).
- S:432-435 the report is the check's own output.

Permitting sentences: none. Loose: S:381-382 "an attempt that is still a running job of this session is waited for; otherwise run `V --consultation-report`" does not say to run the check after the wait; S:416 "on completion and on recovery alike" supplies it.

Verdict: forbidden

## (4) A `skipped` record written without the user's answer

Forbidding sentences:
- S:374-378 "User skip: when the user told you to skip the consultation and gave a reason, write consultation.md ... with Status `skipped`, the reason in their words verbatim as Skip reason ... Dispatch nothing and go to Commit below. Never write `skipped` without the user's answer."
- S:424-427 after two failures "one `ask` ... Skip, with the user's reason in their words (write the `skipped` record above with both attempts and the consulted commit)".
- T:8 "**Skip reason**: <none, or the user's reason in their words>".

Permitting sentences: none. Considered: "when the user told you to skip" (S:374) requires a told skip with a reason; a skip with no reason writes nothing.

Verdict: forbidden

## (5) The author's own architecture review used as a substitute

Forbidding sentences:
- S:427-428 "No other model's report and no architecture review of your own stands in for the consultation."
- S:424-427 the only exits after two failures are Skip (user's reason) or Stop.
- S:440 "no verifier triages consultation findings" (no other substitute path).

Permitting sentences: none found.

Verdict: forbidden

Overall: PASS
