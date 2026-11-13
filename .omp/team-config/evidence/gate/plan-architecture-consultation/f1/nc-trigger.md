# Negative control: Trigger

Files read completely: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml (S, `review` instruction, lines 348-798), templates/consultation.md (T, 1-16), team-config/agent/agents/architecture-oracle.md (A, 1-38). Reviewer: InstructionReviewF1F3.

## Route 1: full round or delta check of a `risky` change without the record or with a `pending` one, on any path (first round, delta checks, incomplete-round re-run)

Forbidding sentences:
- S:463-467 "Admission, before every plan-reviewer dispatch, a full round or a delta check (from step 2, from the incomplete-round re-run below, which resumes here, and from step 5's delta checks): when gate.md makes the change `risky`, or the user asked for a consultation of this change, and the change folder holds no consultation.md or a `pending` one, dispatch nothing and run step 2a."
- S:768-769 "A record with Awaiting `incomplete` on the unchanged digest re-runs the recorded round in full from step 3 with fresh reviewers" (re-run enters at step 3, i.e. the admission).
- S:690-694 fix-delta: "...dispatch one fresh plan-reviewer item with the delta brief below, after step 3's admission."
- S:697-703 exhaustion Fix / answered ask: "Step 3's admission runs before every delta dispatch; when it runs step 2a, step 2a returns to that dispatch".
- S:685-689 a second full round "repeat from step 1" (reaches step 3), also when the fix raised depth to `risky`.
- S:384-385 Recovery: "when consultation.md is `pending`, dispatch nothing before you resolve every attempt".
- S:441-443 after a Stop, "a session that finds the `pending` record resolves its attempts (Recovery) and ... asks again and dispatches nothing".
- S:438-439 Stop leaves "the `pending` record, which `--reviewed` refuses".
Permitting sentences considered:
- S:579-581 retry of a reviewer "in a new task call": happens after the admission passed in the same round; does not start a round. Fails as permitting.
- S:635-636 resume with Awaiting `triage` "dispatching no reviewer": triage is not a plan-reviewer dispatch. Fails.
- S:764-766 resume with `exception`/`exhaustion`/`scope` "asks that ask again ... before any edit or dispatch"; the later Fix leads to S:690-703 delta, which is behind the admission. Fails.
- S:697-699 "the successor is that one more delta check, whatever the depth": the admission still runs "before every delta dispatch" (S:701). Fails.
- S:779-781 "A re-run that passed through step 2a keeps its round number..." presupposes 2a ran. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 2: a round after a consultation or skip that left an OKAY review current

Forbidding sentences:
- S:374-378 "Current review: when the review is re-run on a change that gate.md makes `risky`, or whose consultation the user asked for, while the folder holds no consultation.md or a `pending` one, review.md is OKAY and its recorded digest equals `V --digest`, run step 2a without a round. When step 2a adopted no edit (a skip, or every finding rejected), go to step 8 and dispatch nothing; otherwise return to step 1."
- S:461-462 "from the current-review entry, as that entry says".
- Edits adopted change the digest, so the round that follows (S:377-378 "otherwise return to step 1") reviews changed bytes, not a current OKAY.
Permitting sentences considered:
- S:460-461 "Then return to step 1": read alone, a 2a reached through step 3's admission (S:463-467) on a re-run whose OKAY review is current would return to step 1 and dispatch a round. Fails because S:374-376 states the entry by state (re-run, `risky`/asked, no or `pending` record, OKAY, digest equal), not by path, and says "without a round"; S:461-462 sends that state back to the entry. No sentence ranks the two entries (recorded as Observation O1).
- S:379-383 user skip "Dispatch nothing and go to Commit below": Commit (S:458-462) hands the continuation to the entry. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 3: a consultation for a change whose record is `consulted` or `skipped`

Forbidding sentences:
- S:370-371 "Architecture consultation, entered only from step 3's admission check or from the current-review entry below, and never once consultation.md is `consulted` or `skipped`."
- S:372 "One consultation per change, at most one attempt counted".
- S:463-467 and S:374-376 admission/current-review entries require "no consultation.md or a `pending` one".
- S:443-444 consult-again is only offered in the Stop/`pending` context ("a session that finds the `pending` record").
Permitting sentences considered:
- S:379-383 User skip writes a `skipped` record: it is inside 2a, so S:370-371 guards it; it is not a consultation anyway. Fails.
- S:436-438 ask Skip option: only after failed attempts of a `pending` record. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 4: an attempt dispatched before the committed `pending` record names it

Forbidding sentences:
- S:391 "Dispatch, for each attempt:" ... S:396-399 "Write consultation.md from the template with Status `pending`; ... Models every earlier attempt and the new one as `<requested name> dispatched`; ... Run `V <change-dir>` and commit the record; only then dispatch, in a new task call, exactly one fresh item".
- S:432-435 Retry: "dispatch one fresh retry with the same brief and the next attempt number" and S:443-445 "that request opens the next pair, with the next attempt numbers and every earlier attempt kept under Models" (both are attempts, so they run through "for each attempt").
- S:420-423 Session binding replaces an entry only after the dispatch; the pre-dispatch entry already names the attempt.
Permitting sentences considered:
- S:432-435 Retry does not restate the record-first step; it is covered only by S:391 "for each attempt" and S:373 "attempts are dispatched in pairs (Retry and ask below)". Fails as permitting: no sentence lets a retry skip Dispatch (Observation O2: wording could be explicit).
- S:424-431 Counting rewrites the entry after the run; irrelevant to dispatch. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 5: a re-dispatch of an attempt whose session file holds a report

Forbidding sentences:
- S:384-390 Recovery: "dispatch nothing before you resolve every attempt its Models names, from the one session file its entry names ... otherwise run `V --consultation-report <session file> <change-dir>` ... an exit 0 counts the attempt and goes to Record below."
- S:432-435 a retry is dispatched only "after a failed attempt", a failed attempt being exit 1 (S:389-390) or a plan change (S:426-428).
Permitting sentences considered:
- S:388-390 "an entry that names none has no report to count, even when the attempt itself finished: it is a failed attempt": an unbound attempt whose session file on disk holds a report is retried. Fails as a violation because the control's report is one the entry's file holds; a file the entry does not name is not "the attempt's session file" under S:387-388. Deliberate (spec scenario "Interrupted before a report"). Observation O3.
- S:426-428 stale plan: a report on old bytes is not counted and a retry follows. Deliberate (spec "counts an attempt after a plan file changed"). O3.
- S:384-386 "an attempt that is still a running job of this session is waited for": a job of another session is not waited for (O4).
Permitting sentences: none found for a countable report (exit 0)
Verdict: forbidden

## Route 6: a third or later attempt without the user's request to consult again after a Stop, or more than two attempts for one request

Forbidding sentences:
- S:372-373 "attempts are dispatched in pairs".
- S:432-435 "After a failed attempt, count the record's failed attempts. When they are odd in number, dispatch one fresh retry ...".
- S:435-439 "When they are even, one `ask` ... with exactly two options: Skip ... or Stop (leave the `pending` record ... and dispatch nothing further)".
- S:441-445 "After a Stop, a session that finds the `pending` record resolves its attempts (Recovery) and, their failures being even, asks again and dispatches nothing, unless the user asked to consult again: that request opens the next pair, with the next attempt numbers and every earlier attempt kept under Models."
Permitting sentences considered:
- S:439-441 "a fix to the installation is the user's to make, never a third option": removes an agent-side route. Fails.
- S:434-435 "even when you expect it to fail the same way": retry is limited to the odd count, so it is the second of the pair only. Fails.
- Parity is over the whole record: after a consult-again request, failures 3 (odd) retry, 4 (even) ask, so a request yields at most two attempts. A crash between pairs leaves an even count and no dispatch without a new request. Fails as permitting.
Permitting sentences: none found
Verdict: forbidden

## Route 7: a consulted commit whose plan files differ from those the attempt read, or an attempt counted after a plan file changed while it ran

Forbidding sentences:
- S:391-396 "Set the consulted commit: when consultation.md records one, compare the plan files with it by `git diff --quiet <recorded commit> -- <change-dir> ':!<change-dir>/review.md' ':!<change-dir>/consultation.md'`; exit 0 keeps the recorded commit, and a nonzero exit, or no recorded commit, sets it to `git rev-parse HEAD`" (after S:391-392 "commit the change folder and confirm `git status --porcelain -- <change-dir>` prints nothing").
- S:424-428 "Counting, on completion and on recovery alike: first run the Dispatch comparison against the record's consulted commit; a nonzero exit means a plan file changed while the attempt ran, so it failed without a check."
- S:365-366 "nothing is edited until the round is recorded".
Permitting sentences considered:
- S:426-428 command scope: `git diff --quiet` does not see an untracked file added while the attempt ran. Observed in /tmp/pac-f1-InstructionReviewF1F3/r: untracked add -> exit 0; staged add -> exit 1; modified file -> exit 1. It is a gap in the prescribed command for added-and-unstaged files only; no sentence permits counting after a change. Observation O5.
- S:458-461 Commit applies adopted edits after the consulted commit is fixed: edits after counting do not alter what the attempt read, and the record names the commit the attempt read. Fails.
- S:394-396 "exit 0 keeps the recorded commit": plan files equal it by definition. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 8: a session file found by an attempt's name, or a report counted from a file other than the entry's or one whose brief names another change directory

Forbidding sentences:
- S:385-389 "from the one session file its entry names, never by searching for an attempt's name"; "An attempt's session file is only the one its entry names".
- S:420-423 Session binding records `<allocated id> dispatched <absolute session file>`; "only the recorded id and file count".
- S:426-428 "run `V --consultation-report <session file> <change-dir>` on the session file the entry names. The attempt counts only when it exits 0."
Permitting sentences considered:
- S:421 "`read history://<id>` prints the attempt's session file": by allocated id returned from the task call, not by name. Fails.
- Brief naming another change directory: the instruction states no sentence about it; the check receives `<change-dir>` (S:387, S:426-427) and exit 0 is the only way to count (S:428, S:390). No sentence permits otherwise. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 9: a consultation on uncommitted bytes

Forbidding sentences:
- S:362-366 "commit the change folder ... confirm `git status --porcelain -- <change-dir>` prints nothing: the round reviews exactly the committed bytes".
- S:391-392 "Dispatch, for each attempt: commit the change folder and confirm `git status --porcelain -- <change-dir>` prints nothing."
- S:399 "Run `V <change-dir>` and commit the record; only then dispatch".
Permitting sentences considered:
- Recovery (S:384-390) and Record (S:446-457) dispatch nothing. Fails as permitting.
- S:374-378 current-review entry runs 2a "without a round": its dispatch still goes through S:391. Fails.
- S:432-435 retry: through S:391. Fails.
Permitting sentences: none found
Verdict: forbidden

## Observations (not counted)
- O1: S:370-371/S:374-378/S:460-462 do not rank "admission arrival" against "current-review arrival" when both states hold; resolved by the state-based wording, but the precedence is implicit.
- O2: S:432-435 does not itself repeat "commit the pending record first"; it relies on S:391 "for each attempt".
- O3: A report that is stale (plan changed), on another change directory, on another model, or in a file the entry does not name is "failed" and its attempt is retried (S:388-390, S:426-428, S:436). Deliberate per the spec scenarios; the control's "report" reads as a countable report.
- O4: S:384-386 waits only for a running job "of this session"; an attempt still running in another session fails the check (exit 1), is retried, and could later hold a report that is never counted (the entry's file is already resolved).
- O5: `git diff --quiet <commit> -- <dir>` does not detect an added, unstaged file (observed exit 0), so S:426-428 detects modification, deletion and staged additions only.

Overall: PASS
