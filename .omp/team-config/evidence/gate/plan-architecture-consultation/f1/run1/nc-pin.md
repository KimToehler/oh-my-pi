# NC Pin

## (1) A substitute model's report used
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:415-418 "The attempt counts only when it exits 0. For this agent that check decides the model question"; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:426-427 "No other model's report and no architecture review of your own stands in for the consultation."; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:419-420 "with `(no report)` appended when it did not count."
Note: that the check compares every session model with the definition's `model` is validator behaviour, not stated in the three files; the instruction text only delegates ("decides the model question") and counts on exit 0 alone, so a literal agent cannot use a report the check refused.
Verdict: forbidden

## (2) Expected model taken from task.agentModelOverrides
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:417-418 "the override-first pin check after step 3's briefs is not used."; the override-first check (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:544-556) is scoped "After every reviewer or verifier dispatch", which the consultant is not. team-config/agent/agents/architecture-oracle.md:5 pins the model in the definition.
Verdict: forbidden

## (3) An attempt counted without --consultation-report exiting 0
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:415-417 "The attempt counts only when it exits 0."; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:383-384 "an exit 0 counts the attempt"; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:383 "a check that exits 1, is a failed attempt".
Verdict: forbidden

## (4) A skipped record written without the user's answer
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:374-375 "User skip: when the user told you to skip the consultation and gave a reason"; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:378 "Never write `skipped` without the user's answer."; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:423-425 ask option "Skip, with the user's reason in their words"; team-config/agent/skills/review-work/openspec/schemas/omp-gated/templates/consultation.md:8 "Skip reason: <none, or the user's reason in their words>".
Verdict: forbidden

## (5) The author's own architecture review used as a substitute
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:426-427 "No other model's report and no architecture review of your own stands in for the consultation."; after two failures only Skip or Stop (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:423-426).
Verdict: forbidden

Overall: PASS
