# NC Dispositions

## (1) Report typed or edited instead of written by the report command
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:431-434 "the header and `## Report` from the template, a line holding only ```` ```json ````, then the report appended by redirecting the output of `V --consultation-report <session file> <change-dir>` into the file (`>>`), then a line holding only ```` ``` ````; never type, reformat or edit the report."; team-config/agent/skills/review-work/openspec/schemas/omp-gated/templates/consultation.md:12 "written by the report command of the review instruction".
Verdict: forbidden

## (2) A finding without a disposition
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:435-439 "one `### <finding id>` subsection per report finding, in the report's order, each holding exactly one bullet: `- **Disposition**: adopted: ...` ... or `- **Disposition**: rejected: <your reason>`. You decide every finding"; team-config/agent/skills/review-work/openspec/schemas/omp-gated/templates/consultation.md:15 "one \"### <finding id>\" subsection per finding of the report, in the report's order, holding only ...".
Verdict: forbidden

## (3) adopted: recorded without editing the plan
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:437-438 "`adopted: <artifact and what changed>` once that edit is made in the artifact"; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:440-443 "Commit: apply the adopted edits to the plan artifacts, ... run `V <change-dir>`, and commit consultation.md with the edits in one commit."
Note: Record (writes dispositions) precedes Commit (applies edits), a mild ordering tension with "once that edit is made", but every path ends with the edits applied and committed with the record; no sentence allows skipping them.
Verdict: forbidden

## (4) Round 1 dispatched before the adopted edits are committed
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:440-443 "commit consultation.md with the edits in one commit. Then return to step 1"; step 1/2 (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:359-366) then require V passed and "commit the change folder ... confirm `git status --porcelain -- <change-dir>` prints nothing" before any dispatch.
Verdict: forbidden

Overall: PASS
