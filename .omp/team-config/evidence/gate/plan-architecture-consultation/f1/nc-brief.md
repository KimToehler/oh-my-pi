# Negative control: Brief

Files: S = team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml (review instruction, lines 348-775), T = .../templates/consultation.md (1-16), A = team-config/agent/agents/architecture-oracle.md (1-38).

## (1) Consultation brief with added focus (or file list / summary)

Forbidding:
- S:391-397 "dispatch, in a new task call, exactly one fresh item: `agent: "architecture-oracle"`, `name` `ArchConsult` followed by the first 8 hex digits ... `solutionSpace: "Architecture consultation before plan review; outcome open"`, `context` exactly `Architecture consultation on an OpenSpec change (planning artifacts only; nothing is implemented yet).`, the brief below verbatim with only the two paths filled in, and no `model`. Add no focus, summary or file list."
- S:422-423 retry "with the same brief".
- S:399-410 the fixed brief text itself.

Permitting sentences: none found.
Readings checked: S:464 and S:460-463 (the "no focus" rule and scope paragraphs) concern the plan-reviewer briefs, not the consultation, so they neither permit nor forbid here. S:449 "or the user asked for a consultation" changes admission, not the brief. The brief's own sentence "Inspect the relevant existing implementation and callers" (S:405-406) is fixed text, not planner-added focus.

## (2) `model` on the consultation item

Forbidding: S:397 "and no `model`"; S:456 "Never carry a `model` on a task item; the agent's configuration chooses the model."; A:5 pins the model in the definition.

Permitting sentences: none found.
Readings checked: S:418-419 "the override-first pin check ... is not used" relates to verification, not to adding `model`. S:429-430 "a configured override" is a diagnosis for the ask.

## (3) Definition with an editing tool

Forbidding: A:4 `tools: read, grep, glob`; A:17 "You NEVER edit, run code, delegate, browse the web, or access files outside the repository root and change directory the brief names"; A:10 "read-only".

Permitting sentences: none found.
Readings checked: A:32 "Submit the whole report as one terminal `yield`" is a result-delivery mechanism, not an edit/write tool (not among the tools list at A:4). A:8 and A:12-38 grant nothing else.

## (4) Definition with another model

Forbidding: A:5 `model: onara/cc/claude-fable-5-2:high` (one model, the pinned one); S:395-397 and S:456 keep the item free of a `model`; S:416-419 the report check decides the model question.

Permitting sentences: none found.
Readings checked: T:6 "further models appended" and S:420 record models the session shows; they only record, and an attempt on another model does not count (S:417-418).

Verdict: (1) forbidden; (2) forbidden; (3) forbidden; (4) forbidden.

Overall: PASS
