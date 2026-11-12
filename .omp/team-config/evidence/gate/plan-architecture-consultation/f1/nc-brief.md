# Negative control: Brief

Files reviewed: `S` = schema.yaml review instruction (lines 348-770), `T` = templates/consultation.md, `A` = team-config/agent/agents/architecture-oracle.md. Quotes join wrapped lines.

## (1) Consultation brief with added focus, file list or summary of the change

Forbidding sentences:
- S:391-397 "only then dispatch, in a new task call, exactly one fresh item: `agent: "architecture-oracle"`, `name` `ArchConsult` followed by the first 8 hex digits of the consulted commit and the attempt number (e.g. `ArchConsult1a2b3c4d1`), `solutionSpace: "Architecture consultation before plan review; outcome open"`, `context` exactly `Architecture consultation on an OpenSpec change (planning artifacts only; nothing is implemented yet).`, the brief below verbatim with only the two paths filled in, and no `model`. Add no focus, summary or file list."
- S:422-423 retry "with the same brief".
- A:17 "the repository root and change directory the brief names; those are your only read roots."

Permitting sentences: none. Loose points considered:
- S:404-405 "Read proposal.md, design.md, tasks.md, gate.md and every specs/**/spec.md in the change directory" is a file list, but it is inside the fixed brief the spec mandates verbatim, not an addition.
- The enumerated item fields (S:392-397) omit the top-level `i` intent and `tools`/`isolated` fields; "exactly one fresh item" plus the unqualified "Add no focus, summary or file list" cover the dispatch, so a literal agent has no sanctioned slot for added content.

Verdict: forbidden

## (2) `model` set on the consultation task item

Forbidding sentences:
- S:396-397 "the brief below verbatim with only the two paths filled in, and no `model`."
- S:422-423 retry is "with the same brief" and S:386 "Dispatch, for each attempt" governs it.
- S:453 "Never carry a `model` on a task item; the agent's configuration chooses the model." (general, step 3).

Permitting sentences: none. The retry bullet (S:422) does not restate "no model" but the dispatch bullet covers each attempt.

Verdict: forbidden

## (3) Agent definition granting an editing tool

Forbidding sentences:
- A:4 "tools: read, grep, glob"
- A:17 "You NEVER edit, run code, delegate, browse the web, or access files outside the repository root and change directory the brief names".
- A:3 description "Read-only pre-review architecture consultation".

Permitting sentences: none found. Notes: `yield` is not in the `tools` list but A:32 "Submit the whole report as one terminal `yield`"; yield is a submission, not an editing tool. No other tool line or tool-granting sentence exists in A. The task item carries no `tools` field (S:392-397).

Verdict: forbidden

## (4) Definition naming a model other than `onara/cc/claude-fable-5-2:high`

Forbidding sentences:
- A:5 "model: onara/cc/claude-fable-5-2:high"

Permitting sentences: none. A names no other model anywhere (the output schema on A:7 contains no model name). S has no instruction to change the definition's model; S:419-420 "the override-first pin check after step 3's briefs is not used" keeps overrides out.

Verdict: forbidden

Overall: PASS
