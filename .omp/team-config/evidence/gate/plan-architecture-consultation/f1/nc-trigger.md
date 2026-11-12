# Negative control: Trigger

Files reviewed (only these): `S` = team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml (review instruction, lines 348-770), `T` = .../templates/consultation.md, `A` = team-config/agent/agents/architecture-oracle.md. Spec wording read from spec.md only. Quotes join wrapped lines.

## (1) Full `risky` round dispatched without the record or with a `pending` one, any path incl. incomplete-round re-run

Forbidding sentences:
- S:445-449 "3. Admission, at the head of this step and before any of its dispatches (from step 2, and from the incomplete-round re-run below, which resumes here): when the round is a full round at depth `risky`, or the user asked for a consultation of this change, and the change folder holds no consultation.md or a `pending` one, dispatch nothing and run step 2a."
- S:751-753 "A record with Awaiting `incomplete` on the unchanged digest re-runs the recorded round in full from step 3 with fresh reviewers" (resumes at the admission, so the re-run is gated).
- S:762-764 "A re-run that passed through step 2a keeps its round number, its carried findings and its unspent budget, on the digest step 2 takes after the consultation."
- S:667-668 "`risky` after its first full round: repeat from step 1 as a second full fresh two-reviewer round" and S:669-671 (standard made `risky`: "repeat from step 1 as a second full fresh two-reviewer round over the fixed artifacts") both pass step 3's admission.
- S:683-686 "Delta admission: when the depth update of that fix made the change `risky` and the folder holds no `consulted` or `skipped` consultation.md, run step 2a before that delta dispatch" (covers `pending`, since only `consulted`/`skipped` exempt).

Permitting sentences: none found. Checked and rejected:
- "when the round is a full round at depth `risky`, or the user asked ..., and the change folder holds no consultation.md or a `pending` one" (S:446-448): a literal reading "A, or (B and C)" still sends a risky round to 2a; reading "(A or B) and C" is the intended one. Neither dispatches a round without the record.
- S:752-753 "under the same round number and the depth the record names": the re-run skips step 2's depth read, but the depth comes from the record and the unchanged digest covers gate.md, so step 3's "at depth `risky`" test is still evaluated.

Observation outside this route (not a full round, not in the control text): S:683-684 admits a delta only "when the depth update of that fix made the change `risky`"; an already-`risky` pre-deploy change spent on both rounds with no record would get an exhaustion-Fix delta check with no consultation. `--reviewed` still refuses it. Not counted as a permit.

Verdict: forbidden

## (2) Consultation dispatched for a change whose record is `consulted` or `skipped`

Forbidding sentences:
- S:370-373 "2a. Architecture consultation, entered only from an admission check (step 3's, or the delta admission of step 5); it never runs for a `standard` fix-delta check, and never once consultation.md is `consulted` or `skipped`."
- S:446-448 admission fires only when "the change folder holds no consultation.md or a `pending` one" (also gates the "user asked" case).
- S:683-684 delta admission only when "the folder holds no `consulted` or `skipped` consultation.md".

Permitting sentences: none. Checked: the retry/second-attempt dispatch (S:422-423) happens only while the record is `pending`; a "user asked" request (S:447) is gated by the same record test.

Verdict: forbidden

## (3) Attempt dispatched before the committed `pending` record names it

Forbidding sentences:
- S:386-392 "Dispatch, for each attempt: commit the change folder and confirm `git status --porcelain -- <change-dir>` prints nothing. Write consultation.md from the template with Status `pending`; ... Models every earlier attempt and the new one as `<requested name> dispatched`; `none` everywhere else. Run `V <change-dir>` and commit the record; only then dispatch, in a new task call, exactly one fresh item".
- S:379 "Recovery: when consultation.md is `pending`, dispatch nothing before you resolve every attempt its Models names".
- T:6 Models entry format `"<subagent id> dispatched" with its session file once known`.

Possibly loose sentence (not a permit): S:422-423 "a failed attempt gets one fresh retry with the same brief and the next attempt number, within the two." It does not restate the pending-record write; the neighbouring S:386 "Dispatch, for each attempt:" covers every attempt including the retry (it has an attempt number), and S:389-390 "Models every earlier attempt and the new one" presupposes the retry writes a new record first.
Also loose (not a permit): S:389-390 "Models every earlier attempt and the new one as `<requested name> dispatched`" read literally rewrites earlier entries without their file or `(no report)`; this loses no attempt count and does not dispatch anything early.

Verdict: forbidden

## (4) Re-dispatch of an attempt whose session file (the one its record entry names) holds a report

Forbidding sentences:
- S:379-385 "dispatch nothing before you resolve every attempt its Models names, from the one session file its entry names, never by searching for an attempt's name: an attempt that is still a running job of this session is waited for; otherwise run `V --consultation-report <session file> <change-dir>`. ... an exit 0 counts the attempt and goes to Record below."
- S:416-419 "Counting, on completion and on recovery alike: run `V --consultation-report <session file> <change-dir>` on the session file the entry names. The attempt counts only when it exits 0."
- S:422 retry only for "a failed attempt"; failed = "one whose check exits 1" (S:384-385) or an entry that names no file (S:383-384).

Permitting sentences: none for a counting report. Interpretation note: a file that holds a report but whose check exits 1 (wrong model, other change) is "failed" and retried (S:384-385, S:422); the spec's scenarios (Report of another change, Installation without the model entry) require exactly this, so it is not the forbidden route. S:383-384 "an entry that names none has no report to count, even when the attempt itself finished" is the spec's own rule (the control's parenthetical limits the file to the entry's).

Verdict: forbidden

## (5) A third attempt

Forbidding sentences:
- S:372-373 "One consultation per change: at most two attempts across sessions, at most one counted."
- S:422-428 "a failed attempt gets one fresh retry with the same brief and the next attempt number, within the two. After two failed attempts, one `ask` quoting each attempt's Models entry, with exactly two options: Skip ... or Stop (leave the `pending` record, which `--reviewed` refuses, and dispatch nothing further)."
- S:389-390 the pending record carries "every earlier attempt", so a later session can count them.

Permitting sentences: none found (S:422 "a failed attempt gets one fresh retry" read per failed attempt is capped by "within the two").

Verdict: forbidden

## (6) Session file found by name / report counted from a file other than the entry's / report whose brief names another change directory

Forbidding sentences:
- S:379-381 "from the one session file its entry names, never by searching for an attempt's name".
- S:383-384 "An attempt's session file is only the one its entry names, so an entry that names none has no report to count".
- S:416-418 "run `V --consultation-report <session file> <change-dir>` on the session file the entry names."
- S:412-415 binding via the allocated id: "`read history://<id>` prints the attempt's session file ... only the recorded id and file count." (file found by id from the task call, not by name).
- S:419 / S:384-385 only exit 0 counts; the brief-names-this-change-directory test lives in the report command (called with `<change-dir>`), spec-defined, not restated in the instruction.

Permitting sentences: none. Dependence note: the instruction does not itself state the brief/change-dir test; it delegates it to the check's exit code. S:431-435 "`V --consultation-report <session file> <change-dir>`" in Record does not repeat "the entry's" file, but is reached only after Counting on that file (S:416-418).

Verdict: forbidden

## (7) Consultation on uncommitted bytes of the change folder

Forbidding sentences:
- S:386-387 "Dispatch, for each attempt: commit the change folder and confirm `git status --porcelain -- <change-dir>` prints nothing." and S:391 "Run `V <change-dir>` and commit the record; only then dispatch".
- S:362-366 step 2 commits and confirms clean before step 3's admission.

Permitting sentences: none for uncommitted bytes. Observation outside the route: S:388-389 "Consulted commit the 40-hex commit whose plan the consultant reads (the plan commit before the first `pending` commit, kept on a retry)": if plan files were committed differently between sessions, the retry commits the new bytes while the record keeps the old commit. Committed, not uncommitted, so not this route.

Verdict: forbidden

Overall: PASS
