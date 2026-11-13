# Negative control: Dispositions

Files read completely: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml (S, `review` instruction, lines 348-798), templates/consultation.md (T, 1-16), team-config/agent/agents/architecture-oracle.md (A, 1-38). Reviewer: InstructionReviewF1F3.

## Route 1: a report typed or edited instead of written by the report command

Forbidding sentences:
- S:449-452 "Write the file in order: the header and `## Report` from the template, a line holding only ```` ```json ````, then the report appended by redirecting the output of `V --consultation-report <session file> <change-dir>` into the file (`>>`), then a line holding only ```` ``` ````; never type, reformat or edit the report."
- T:12 "a json fence holding the counted attempt's structured result on one line, written by the report command of the review instruction".
Permitting sentences considered:
- S:446-448 Record fields (Consultant, Models, Bottom line, Skip reason) are typed in the header; the report is the fenced block only. Fails.
- S:429-431 rewrites the `Models` entry: header line, not the report. Fails.
- S:453 `none` under `## Findings`: not the report. Fails.
- S:458-461 Commit edits "plan artifacts", not the report. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 2: an undisposed finding

Forbidding sentences:
- S:452-457 "`## Findings`: `none` when the report has no findings; otherwise one `### <finding id>` subsection per report finding, in the report's order, each holding exactly one bullet: `- **Disposition**: adopted: <artifact and what changed>` ... or `- **Disposition**: rejected: <your reason>`. You decide every finding".
- T:14-16 "one `### <finding id>` subsection per finding of the report ... holding only `adopted:` or `rejected:`".
- S:460 `V <change-dir>` runs before the commit (record validity).
Permitting sentences considered:
- S:455-456 "once that edit is made in the artifact": ties `adopted` to the edit; does not allow a finding without a bullet. Fails.
- S:456-457 "no verifier triages consultation findings": removes a third party, not the author's duty. Fails.
- S:453 `none` only "when the report has no findings". Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 3: `adopted:` without an edit

Forbidding sentences:
- S:454-456 "`adopted: <artifact and what changed>` once that edit is made in the artifact".
- S:458-461 "apply the adopted edits to the plan artifacts ... and commit consultation.md with the edits in one commit".
- S:376-378 "When step 2a adopted no edit (a skip, or every finding rejected)": adopted means an edit exists.
Permitting sentences considered:
- S:446-461 order: Record (S:446-457) comes before Commit (S:458-461), so `adopted:` text could be written before the edit is applied. Fails because S:455-456 requires the edit to be made first and S:458-460 commits edit and record together; no committed state holds `adopted:` without the edit (Observation O1 on ordering).
- S:458-459 "update the Mandatory class and `- **Depth**:` ... when an adopted edit changed the class or the reach": conditional, not a permission. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 4: round 1 before the adopted edits are committed

Forbidding sentences:
- S:458-462 "Commit: apply the adopted edits ..., run `V <change-dir>`, and commit consultation.md with the edits in one commit. Then return to step 1, or, from the admission of a delta check, to that delta dispatch, or, from the current-review entry, as that entry says."
- S:362-369 step 1/2: round reviews committed bytes, `git status --porcelain` empty, digest taken after; "An edit after this point ... makes the digest stale: return to step 1."
- S:701-703 delta: "which takes `V --digest` after the consultation commit, and its patch, taken from the recording commit, covers the consultation edits too".
- S:377-378 and S:779-781 digest taken "after the consultation".
Permitting sentences considered:
- S:690-694 delta path: fix commit and `git status` check come before the admission; the consultation commit follows and the digest is re-taken after it (S:701-703). Fails.
- S:376-378 current-review: without adopted edits goes to step 8; with edits returns to step 1. Fails.
- S:379-383 user skip: "Dispatch nothing and go to Commit below". Fails.
Permitting sentences: none found
Verdict: forbidden

## Observations (not counted)
- O1: S:455-456 (disposition written "once that edit is made") and the order Record then Commit (S:446-461) leave unspecified whether edits are made before the file is written; the instruction states only the end state (edit and record in one commit).
- O2: After the Commit step no sentence forbids a later edit of consultation.md; any change of plan files makes the review stale (S:783-784) and the validator reads the record.

Overall: PASS
