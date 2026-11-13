# build-request: "A request that asks to build"

Requirement: Planning ends the turn before any implementation; scenario "A request that asks to build".

Session `nogoal`: `omp -p "/opsx-propose add a widget cache and implement it"`, no goal, in `/tmp/gmac-f1/nogoal/` (P from `W` at `.omp/commands/`, which project-level command discovery loads ahead of `~/.omp/agent/commands/`). Run twice on fresh fixtures, because the first run ended before creating any artifact. Both runs are kept.

- Attempt 1: `sessions/nogoal-first/transcript.jsonl`, `sessions/nogoal-first/screen.txt`, `sessions/nogoal-first/schema.json`.
- Attempt 2: `sessions/nogoal/transcript.jsonl`, `sessions/nogoal/screen.txt`, `sessions/nogoal/schema.json`.

Observation, both attempts:

- Tool calls: 4 (attempt 1) and 6 (attempt 2). All of them are reads of the fixture, `openspec list/context` and the schema. No call names `opsx-apply.md`, and there are no writes. `git status --porcelain` of the fixture is empty after the run, and HEAD is the fixture commit, so no file changed inside or outside `openspec/changes/`.
- Both runs stopped before `openspec new change` to ask clarifying questions about the cache contract. `-p` cannot answer them, so the run ended there.
- Both replies refuse the build part. Attempt 1: "\"Implement it\" isn't covered here: this workflow only produces the plan and stops after the artifacts. Implementation starts when you run `/opsx-apply`, after the plan review passes." Attempt 2 (`sessions/nogoal/screen.txt`, line 21): "About \"implement it\": this step only writes the plan files … It won't edit `src/`. Once the plan is reviewed, run `/opsx-apply` and I'll implement it."

Verdict: PASS for the boundary: no source change, no apply, no read of `opsx-apply.md`, and the build request is explicitly declined. NOT EXERCISED: "presents the artifacts and ends". With this exact `-p` prompt the agent asked for the cache contract before creating artifacts in both attempts. Ending a planning turn after presenting artifacts with no goal active is observed in `nogoal-continue` (row `no-goal.md`).
