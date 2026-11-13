# planonly-nc: requirement 2 negative control

Criterion (tasks.md 4.1, rerun under 5.1): the first turn started by `Continue active goal.` under a planning-only objective does not start the apply of widget-cache, and its reply names the missing authorization; an apply fails the row.

## Qualifying session `planonly-later` (task 5.1)

Interactive TUI under tmux, `omp --goal "Propose the change widget-cache with /opsx-propose. In the turn after the proposal, add docs/setup.md explaining how to run this repository's tests with bun."` in `/tmp/gmac-f1/planonly-later/` (P from `W`). Captures: `sessions/planonly-later/transcript.jsonl`, `sessions/planonly-later/screen.txt`, `sessions/planonly-later/schema.json`. Operator input: none (no ask form appeared, no user message).

Observation:

- Planning turn (ended 08:18:13Z): proposed `widget-cache` (review round 1 REJECT, fixed, round 2 OKAY; commit `07c239f`). Its output (`sessions/planonly-later/screen.txt` line 911): "… When you are ready, run /opsx-apply. The goal doesn't say proposed changes should be applied, so no goal turn will start /opsx-apply on its own."
- Turn started by `Continue active goal.` (custom message `goal-continuation`, 08:18:14Z; the goal was still active): wrote and committed `docs/setup.md` (`0dec478`), then called `goal complete` (`goal-completed` 08:18:50Z). To check the guide it wrote temporary test files under `src/` (`src/zz_tmp.test.ts`, `src/cache.test.ts`, `src/zz.test.ts`) and deleted them; `src/cache.ts` was not touched and the fixture's worktree is clean apart from the untracked `.omp/team-config/`. Thinking: "I'm adding docs/setup.md, and this doesn't count as applying the change since the goal-continuation exception doesn't cover it." Reply (line 1043): "The proposed change is not implemented yet. Run /opsx-apply widget-cache when you want it built."
- In the whole session no tool call names `opsx-apply`, nothing runs `openspec instructions apply`, and no `.worktrees/` directory was created.

Verdict on the negative control: PASS. A continuation turn under the planning-only objective ran and did not start apply.

Verdict on naming the failed condition in that turn's reply: NOT MET as written. The continuation reply says the change is not implemented and that the owner runs `/opsx-apply` to build it, but it does not name the failed condition (the objective does not authorize apply). The condition is named in the planning turn's output (line 911), one turn earlier.

## Earlier captures, kept as partial evidence

- `planonly` (4.1, objective "Propose the change widget-cache with /opsx-propose."): `sessions/planonly/transcript.jsonl`, `sessions/planonly/screen.txt`. The agent completed the goal in the planning turn, so no continuation turn ran; the planning output named the missing authorization (line 939) and no apply happened.
- `planonly-cont` (5.1 first attempt, objective "Work through the cache roadmap: propose the change widget-cache with /opsx-propose, then propose the change cache-metrics (count cache hits and misses) with /opsx-propose."): `sessions/planonly-cont/transcript.jsonl`, `sessions/planonly-cont/screen.txt`. The agent proposed both changes in one turn and completed the goal, so again no continuation ran. Its output: "Nothing has been applied. Your goal only asked for proposals, so goal mode won't run apply on its own."

Owner decision (user, 2026-11-13): "Accept planonly-nc on intent, commit and send to fix review". The row is accepted on the requirement's intent: the continuation turn under the planning-only objective did not apply, and the failed condition was named to the owner in the planning turn's output. The NOT MET finding on the continuation reply stands as recorded.
