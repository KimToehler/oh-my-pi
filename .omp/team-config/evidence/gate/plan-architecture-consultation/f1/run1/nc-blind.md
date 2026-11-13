# NC Blind review

## (1) A plan-reviewer (full round or delta) allowed to read consultation.md
Forbidding (full round only): team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:465-466 "Review every file in the change directory except review.md and consultation.md (neither is part of the plan; do not read them) against the repository."
PERMITS (delta): team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:690-692 "Plan: the OpenSpec change folder {CHANGE DIR} (proposal.md, specs/**/spec.md, design.md, gate.md, tasks.md; review.md is the review record and consultation.md the consultation record, neither is plan)."
How: the delta brief says consultation.md is "not plan" but, unlike the full-round brief, never says "do not read" it; the delta reviewer is pointed at the change folder (which holds the file) and told to judge "against the repository and the unchanged plan text" (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:701-702), so a literal reader may open consultation.md, whose findings then reach the reviewer. No other delta-brief sentence forbids it. (The spec requires both briefs to say "not to be read".)
Verdict: permitted (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:690-692)

## (2) A delta-check patch containing consultation.md
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:697-698 "written with `git diff {RECORDING COMMIT} -- {CHANGE DIR} ':!{CHANGE DIR}/review.md' ':!{CHANGE DIR}/consultation.md'`"; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:683-685 "its patch, taken from the recording commit, covers the consultation edits with the fixes" (plan edits only; the pathspec still excludes the record).
Verdict: forbidden

## (3) A reviewer or verifier dispatch quoting, summarising or naming a consultation finding
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:459-460 "Never quote, summarise or name a consultation finding in any reviewer or verifier dispatch."; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:589-590 verifier gets "every blocker copied verbatim from the delivered payload", which are reviewer blockers only; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:439 "no verifier triages consultation findings."
Residual note (not a finding route): the sentence covers findings only; report-level content (bottom line, recommended approach) and adopted-edit diffs in the delta patch are not named.
Verdict: forbidden

Overall: FAIL — permitted routes: (1) delta plan-reviewer not told not to read consultation.md (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:690-692).
