# NC Trigger (files: `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` review instruction, `team-config/agent/skills/review-work/openspec/schemas/omp-gated/templates/consultation.md`, `team-config/agent/agents/architecture-oracle.md`; line numbers are file lines)

## (1) Full risky round dispatched without the record or with a pending one, any path incl. incomplete-round re-run
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:444-448 "3. Admission, at the head of this step and before any of its dispatches (from step 2, and from the incomplete-round re-run below, which resumes here): when the round is a full round at depth `risky`, or the user asked for a consultation of this change, and the change folder holds no consultation.md or a `pending` one, dispatch nothing and run step 2a."
Also team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:749-751 "A record with Awaiting `incomplete` on the unchanged digest re-runs the recorded round in full from step 3" (step 3 head is the admission), and team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:666-667 / 668-670 (second full round "repeat from step 1", which reaches step 2 then 3).
Searched for a permit: second-round and re-run paths all pass through step 3's head; reviewer retries (558-559) happen after the admission on the same record. None found.
Verdict: forbidden

## (2) Consultation dispatched for a change whose record is consulted or skipped
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:370-372 "it never runs for a `standard` fix-delta check, and never once consultation.md is `consulted` or `skipped`."; admission only fires on "no consultation.md or a `pending` one" (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:447); delta admission team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:682-683 "the folder holds no `consulted` or `skipped` consultation.md". A user request (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:446) does not override: the "and" binds it to the no-record/pending condition.
Verdict: forbidden

## (3) Attempt dispatched before the committed pending record names it
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:385-391 "Dispatch, for each attempt: commit the change folder ... Write consultation.md from the template with Status `pending`; ... Models every earlier attempt and the new one as `<requested name> dispatched`; ... Run `V <change-dir>` and commit the record; only then dispatch, in a new task call, exactly one fresh item". Applies to retries via team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:421-422 "a failed attempt gets one fresh retry with the same brief and the next attempt number" (still "for each attempt").
Verdict: forbidden

## (4) Re-dispatch of an attempt whose session file holds a report
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:379-384 "Recovery: when consultation.md is `pending`, dispatch nothing before you resolve every attempt its Models names, from the one session file its entry names ... otherwise run `V --consultation-report <session file> <change-dir>`... an exit 0 counts the attempt and goes to Record below."
PERMITS: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:382-383 "An entry without a session file, or a check that exits 1, is a failed attempt;"
How: an entry still reading `<requested name> dispatched` (session interrupted between the task call and Session binding, team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:411-413 "as soon as ... `read history://<id>` prints the attempt's session file, replace its entry ... and commit the record") is declared failed unconditionally, and team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:421-422 then gives it "one fresh retry". If that attempt's session file already holds a valid report (finished after the interruption), the text re-dispatches it. The text names no step that locates that file other than the entry, and team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:380-381 forbids searching ("never by searching for an attempt's name"), so the only literal route is re-dispatch.
Verdict: permitted (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:382-383)

## (5) A third attempt
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:372-373 "One consultation per change: at most two attempts across sessions, at most one counted."; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:421-427 "a failed attempt gets one fresh retry ... within the two. After two failed attempts, one `ask` ... with exactly two options: Skip ... or Stop (leave the `pending` record, which `--reviewed` refuses, and dispatch nothing further)."
Verdict: forbidden

## (6) Session file found by searching; report counted from a file other than the entry's; or brief naming another change directory
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:380-381 "from the one session file its entry names, never by searching for an attempt's name"; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:415-417 "run `V --consultation-report <session file> <change-dir>` on the session file the entry names. The attempt counts only when it exits 0."; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:413-414 "only the recorded id and file count."
Brief-names-another-directory: the delivered text passes <change-dir> to the check and counts only on exit 0 (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:416-417); it does not itself state the check compares the brief's directory (that is validator behaviour outside the three files), but a literal agent cannot count without exit 0.
Verdict: forbidden

## (7) Consultation on uncommitted bytes of the change folder
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:385-386 "commit the change folder and confirm `git status --porcelain -- <change-dir>` prints nothing."; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:387-388 "Consulted commit the 40-hex commit whose plan the consultant reads"; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:390 "commit the record; only then dispatch".
Verdict: forbidden

Overall: FAIL — permitted routes: (4) re-dispatch of an attempt whose session file holds a report, via team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:382-383 "An entry without a session file ... is a failed attempt;".
