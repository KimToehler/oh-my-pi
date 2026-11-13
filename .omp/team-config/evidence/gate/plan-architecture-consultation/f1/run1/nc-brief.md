# NC Brief

## (1) Consultation brief with added focus, file list or summary
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:394-396 "`context` exactly `Architecture consultation on an OpenSpec change (planning artifacts only; nothing is implemented yet).`, the brief below verbatim with only the two paths filled in, and no `model`. Add no focus, summary or file list."; retry keeps it: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:421-422 "one fresh retry with the same brief".
Verdict: forbidden

## (2) `model` set on the consultation task item
Forbidding: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:395-396 "and no `model`."; team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:452 "Never carry a `model` on a task item; the agent's configuration chooses the model."
Verdict: forbidden

## (3) Agent definition granting an editing tool
Forbidding: team-config/agent/agents/architecture-oracle.md:4 "tools: read, grep, glob"; team-config/agent/agents/architecture-oracle.md:17 "You NEVER edit, run code, delegate, browse the web, or access files outside the repository root and change directory the brief names".
Verdict: forbidden

## (4) Definition naming a model other than onara/cc/claude-fable-5-2:high
Forbidding: team-config/agent/agents/architecture-oracle.md:5 "model: onara/cc/claude-fable-5-2:high" (only model line in the definition).
Verdict: forbidden

Overall: PASS
