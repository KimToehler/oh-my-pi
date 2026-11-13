# Negative control: Trigger

Files: S = team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml (review instruction, lines 348-775 read, plus 1-4 header), T = .../templates/consultation.md (1-16), A = team-config/agent/agents/architecture-oracle.md (1-38).

## (1) Full `risky` round without the record or with a `pending` one, any path (first round, fix-triggered second round, delta, incomplete-round re-run, cross-session recovery)

Forbidding:
- S:448-452 "Admission, at the head of this step and before any of its dispatches (from step 2, and from the incomplete-round re-run below, which resumes here): when the round is a full round at depth `risky`, or the user asked for a consultation of this change, and the change folder holds no consultation.md or a `pending` one, dispatch nothing and run step 2a."
- S:754-756 "A record with Awaiting `incomplete` on the unchanged digest re-runs the recorded round in full from step 3 with fresh reviewers" (step 3 = admission); S:765-767 "A re-run that passed through step 2a keeps its round number, its carried findings and its unspent budget".
- S:670-674 second full round "repeat from step 1" (step 1 -> 2 -> 3 admission) for `risky` and for a `standard` raised to `risky`.
- S:682-689 delta admission: "when the depth update of that fix made the change `risky` and the folder holds no `consulted` or `skipped` consultation.md, run step 2a before that delta dispatch" (covers none and `pending`).
- S:360-362 depth updated before the commit so step 3 reads the post-fix depth.

Permitting sentences: none found.
Readings checked:
- Step 5 "Otherwise one fix-delta check" (S:674-681) for `standard`: not a full round, and a fix that makes the change `risky` is routed to the full round (S:672-674), so no risky delta skips admission.
- S:683-685 exhaustion Fix delta "whatever the depth": the record already exists from the first full round of a `risky` change, and S:685-689 adds delta admission when the depth just became `risky`.
- S:372 "never runs for a `standard` fix-delta check" removes consultation only for `standard` deltas, which are not full `risky` rounds.
- Incomplete re-run: S:449-450 names it explicitly; the depth is the record's (S:755-757) and admission is evaluated again at step 3.
- Recovery across sessions with a `pending` record: admission's "or a `pending` one" sends it to 2a Recovery (S:379-385), not to the dispatch of reviewers.

## (2) Consultation for a change whose record is `consulted` or `skipped`

Forbidding:
- S:370-373 "it never runs for a `standard` fix-delta check, and never once consultation.md is `consulted` or `skipped`. One consultation per change".
- S:448-451 admission enters 2a only for "no consultation.md or a `pending` one", also when "the user asked for a consultation".
- S:686-687 delta admission only when the folder holds no `consulted` or `skipped` record.
- S:370 "entered only from an admission check".

Permitting sentences: none found.
Readings checked: "the user asked for a consultation of this change" (S:449) is bound by the same record condition (S:450-451). The User skip bullet (S:374-378) runs inside 2a, which is itself closed by S:372. T:3 lists `consulted, skipped or pending` but is a template, not a trigger.

## (3) Attempt dispatched before the committed `pending` record names it

Forbidding:
- S:386-392 "Dispatch, for each attempt: commit the change folder and confirm `git status --porcelain -- <change-dir>` prints nothing. Write consultation.md ... with Status `pending` ... Models every earlier attempt and the new one as `<requested name> dispatched` ... Run `V <change-dir>` and commit the record; only then dispatch".
- S:379-380 "when consultation.md is `pending`, dispatch nothing before you resolve every attempt its Models names".
- S:422-424 retry "with the same brief and the next attempt number" (a "Dispatch, for each attempt" attempt, so S:386-392 applies).
- T:6 "`<subagent id> dispatched` with its session file once known for an attempt not yet resolved".

Permitting sentences: none found.
Readings checked: S:422 "a failed attempt gets one fresh retry with the same brief" does not restate the record step, but it names the retry an attempt and S:386 says "for each attempt"; S:389-390 "kept on a retry" presupposes the record is rewritten per retry. S:412-414 session binding happens after dispatch but only refines an entry already committed.

## (4) Re-dispatch of an attempt whose session file holds a report

Forbidding:
- S:379-385 "dispatch nothing before you resolve every attempt its Models names, from the one session file its entry names ... otherwise run `V --consultation-report <session file> <change-dir>` ... an exit 0 counts the attempt and goes to Record below."
- S:416-418 "Counting, on completion and on recovery alike: run `V --consultation-report ...` ... The attempt counts only when it exits 0."
- S:381-382 a still-running job "is waited for".
- S:422 only "a failed attempt" gets a retry; S:384-385 failed = no named file or exit 1.

Permitting sentences: none found.
Readings checked: S:383-385 "an entry that names none has no report to count, even when the attempt itself finished: it is a failed attempt" lets a retry dispatch where an unrecorded session file might hold a report. This is not a session file "its entry names": the control's "session file" is the entry's (S:383 "An attempt's session file is only the one its entry names"), and the commit-before-binding order (S:412-414) is meant to make the entry name it as soon as it is known. Noted as an observation: this rule is deliberate and trades a possible wasted attempt for never searching for files.

## (5) Third attempt

Forbidding:
- S:372-373 "at most two attempts across sessions, at most one counted".
- S:422-428 retry "within the two ... only two observed failures reach the ask. After two failed attempts, one `ask` ... with exactly two options: Skip ... or Stop (leave the `pending` record ... and dispatch nothing further) ... a fix to the installation is the user's to make, never a third option".
- S:386-391 Models lists "every earlier attempt", so the count is read from the committed record across sessions.

Permitting sentences: none found.
Readings checked: Stop leaves `pending`; a later session re-enters 2a through admission (S:450-451), and Recovery resolves both attempts as failed, so the ask repeats rather than dispatching. The user-ask on an installation fix is excluded as a third option (S:429-430).

## (6) Session file found by an attempt's name; report counted from a file other than the entry's or whose brief names another change directory

Forbidding:
- S:380-381 "from the one session file its entry names, never by searching for an attempt's name".
- S:383 "An attempt's session file is only the one its entry names".
- S:416-417 "run `V --consultation-report <session file> <change-dir>` on the session file the entry names".
- S:412-414 "`read history://<id>` prints the attempt's session file ... only the recorded id and file count." The `<change-dir>` argument is passed to the check, and the count follows exit 0 only (S:417-418).

Permitting sentences: none found.
Readings checked: S:412-414 takes the file from `history://<id>`, but the id is the one the task call returned and the file is then written to the entry. No sentence in S/T/A states the "brief names another change directory" rule in prose; it is enforced only through the exit-0 requirement of the check (S:417-418), whose behaviour is outside these three files (observation, not counted).

## (7) Consultation on uncommitted bytes

Forbidding:
- S:386-387 "commit the change folder and confirm `git status --porcelain -- <change-dir>` prints nothing" before the record is written.
- S:388-389 "Consulted commit the 40-hex commit whose plan the consultant reads"; T:4.
- S:361-367 the round "reviews exactly the committed bytes".
- S:444-447 edits and consultation.md are committed together before anything else.

Permitting sentences: none found.
Readings checked: the `pending` record commit changes only consultation.md, which the brief excludes (S:404-405). On a retry across sessions the folder is again committed and checked clean (S:386-387); the kept consulted commit (S:389-390) could trail a later committed plan edit, but those bytes are committed (observation, not counted).

Verdict: (1) forbidden; (2) forbidden; (3) forbidden; (4) forbidden; (5) forbidden; (6) forbidden; (7) forbidden.

Overall: PASS
