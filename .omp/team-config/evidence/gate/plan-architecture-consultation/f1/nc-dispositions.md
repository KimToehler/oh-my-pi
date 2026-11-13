# Negative control: Dispositions

Files: S = team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml (review instruction, lines 348-775), T = .../templates/consultation.md (1-16), A = team-config/agent/agents/architecture-oracle.md (1-38).

## (1) A report typed or edited instead of written by the report command

Forbidding:
- S:435-438 "Write the file in order: the header and `## Report` from the template, a line holding only ```` ```json ````, then the report appended by redirecting the output of `V --consultation-report <session file> <change-dir>` into the file (`>>`), then a line holding only ```` ``` ````; never type, reformat or edit the report."
- T:12 "a json fence holding the counted attempt's structured result on one line, written by the report command of the review instruction".

Permitting sentences: none found.
Readings checked: S:433-434 has the author type Consultant and Bottom line (`bottom_line.verdict`), which are header fields, not the report. S:444-445 edits only plan artifacts and gate.md, and S:439-443 only the Findings section after the report. The redirect is of the exit-0 command named at S:416-418 (counted attempt only).

## (2) An undisposed finding

Forbidding: S:438-443 "`## Findings`: `none` when the report has no findings; otherwise one `### <finding id>` subsection per report finding, in the report's order, each holding exactly one bullet ... You decide every finding; no verifier triages consultation findings."; T:14-16; S:446-447 the record is committed only with the edits in Commit.

Permitting sentences: none found.
Readings checked: S:441-442 "`adopted: ...` once that edit is made" does not let a finding wait without a bullet, because the section holds exactly one bullet per finding. The User skip bullet (S:374-378) writes `skipped` with findings `none`; a skipped record is no counted report, so no finding of one exists (observation: a `pending` attempt holding a countable report can be skipped by the user's explicit order, S:376-377).

## (3) `adopted:` without an edit

Forbidding: S:441-442 "`- **Disposition**: adopted: <artifact and what changed>` once that edit is made in the artifact"; S:444-446 "apply the adopted edits to the plan artifacts ... and commit consultation.md with the edits in one commit"; T:16.

Permitting sentences: none found.
Readings checked: `rejected: <your reason>` (S:442-443) is the only no-edit route. "once that edit is made" is a timing condition on writing the bullet, not an alternative to the edit.

## (4) Round 1 before the adopted edits are committed

Forbidding: S:444-447 "commit consultation.md with the edits in one commit. Then return to step 1, or, from the delta admission, to that delta dispatch."; S:361-369 step 1-2 commit and clean `git status` before any digest or dispatch; S:448-452 step 3 is reached only after step 2; S:687-689 delta dispatch follows the consultation commit, with a new `V --digest`.

Permitting sentences: none found.
Readings checked: after a crash between Record and Commit, an uncommitted `consulted` file would pass admission (S:450-451 "no consultation.md or a `pending` one"), but step 2's commit-and-clean rule (S:362-367) commits the edits and file before the dispatch, so no round dispatches on uncommitted edits (observation: the edits then go in step 2's commit, not the S:444-446 one).

Verdict: (1) forbidden; (2) forbidden; (3) forbidden; (4) forbidden.

Overall: PASS
