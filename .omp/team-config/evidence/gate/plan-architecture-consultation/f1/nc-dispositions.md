# Negative control: Dispositions

Files reviewed: `S` = schema.yaml review instruction (348-770), `T` = templates/consultation.md, `A` = architecture-oracle.md. Quotes join wrapped lines.

## (1) Report typed or edited instead of written by the report command

Forbidding sentences:
- S:432-435 "Write the file in order: the header and `## Report` from the template, a line holding only ```` ```json ````, then the report appended by redirecting the output of `V --consultation-report <session file> <change-dir>` into the file (`>>`), then a line holding only ```` ``` ````; never type, reformat or edit the report."
- T:12 "<none, or a json fence holding the counted attempt's structured result on one line, written by the report command of the review instruction>"

Permitting sentences: none. Considered: S:441-443 Commit "apply the adopted edits to the plan artifacts ... commit consultation.md with the edits" edits plan artifacts, not the report; S:435 forbids editing the report.

Verdict: forbidden

## (2) A finding without a disposition

Forbidding sentences:
- S:435-440 "`## Findings`: `none` when the report has no findings; otherwise one `### <finding id>` subsection per report finding, in the report's order, each holding exactly one bullet: `- **Disposition**: adopted: <artifact and what changed>` once that edit is made in the artifact, or `- **Disposition**: rejected: <your reason>`. You decide every finding".
- T:16 "one "### <finding id>" subsection per finding of the report, in the report's order, holding only "- **Disposition**: adopted: ..." or "- **Disposition**: rejected: <reason>"".

Permitting sentences: none. No third option (defer, pending, none) exists.

Verdict: forbidden

## (3) `adopted:` recorded without editing the plan

Forbidding sentences:
- S:438-439 "`- **Disposition**: adopted: <artifact and what changed>` once that edit is made in the artifact".
- S:441-443 "Commit: apply the adopted edits to the plan artifacts, update the Mandatory class and `- **Depth**:` in gate.md when an adopted edit changed the class or the reach, run `V <change-dir>`, and commit consultation.md with the edits in one commit."

Weak points considered (not permits): the Record bullet (S:429-440) precedes the Commit bullet that applies the edits, so a literal agent may write `adopted:` before editing; the Commit bullet still requires the edits and consultation.md in one commit, and S:438-439 says "once that edit is made". `adopted: <artifact and what changed>` is not machine-checked for a real change; the instruction text states it must correspond to an edit.

Verdict: forbidden

## (4) Round 1 dispatched before the adopted edits are committed

Forbidding sentences:
- S:443-444 "commit consultation.md with the edits in one commit. Then return to step 1, or, from the delta admission, to that delta dispatch."
- S:362-366 step 2 "commit the change folder ... confirm `git status --porcelain -- <change-dir>` prints nothing" before step 3.
- S:445-449 step 3 admission runs the consultation first; round dispatch only after step 1/2 re-run.
- S:763-764 re-run keeps its round "on the digest step 2 takes after the consultation".

Permitting sentences: none for dispatching before the commit. Observation outside the route: S:685-686 for the delta path "step 2a then returns to it" returns directly to the delta dispatch, whose "run `V --digest <change-dir>` again" (S:674-675) precedes the 2a detour; the instruction does not say to recompute the digest after the consultation edits. The edits are committed before dispatch, so route (4) is not permitted; it is a staleness risk for that delta path only.

Verdict: forbidden

Overall: PASS
