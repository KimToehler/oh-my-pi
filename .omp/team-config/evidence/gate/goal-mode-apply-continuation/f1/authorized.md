# authorized: "Authorized continuation"

Requirement: A goal continuation applies a reviewed change its objective authorizes; scenario "Authorized continuation".

Captures: `sessions/auth/transcript.jsonl`, `sessions/auth/screen.txt`. Stop: the goal itself ended (the agent marked it complete) at the end of the first continuation turn.

Observation, turn 1 (started by the hidden message beginning `Continue active goal.` and repeating the objective, 07:20:06Z):

- First call: `validate-openspec-change.mjs --reviewed openspec/changes/widget-cache`, which printed `reviewed: OKAY in round 2` (pass), plus `cat .omp/commands/opsx-apply.md`.
- It then ran the apply workflow for `widget-cache`: `openspec instructions apply --change widget-cache --json`; the worktree check (`git worktree list --porcelain`, `git status --porcelain -- openspec/changes/widget-cache`, `git ls-files`); `session_move` into `.worktrees/widget-cache` on branch `widget-cache` (opsx-apply step 4); a re-read of the apply state there, with `--reviewed` passing again.
- It announced "## Implementing: widget-cache (schema: omp-gated) — 0/4", wrote `src/cache.test.ts` (RED confirmed), edited `src/cache.ts` (commit `22ad53e feat: cache widgets per id in getWidget`), and ticked all 4 tasks. Its final `--reviewed` still printed `reviewed: OKAY in round 2` (`sessions/auth/screen.txt`, lines 1124 and 1327).
- Reply: "Applying it was allowed in this turn because all of the team's goal-mode conditions held: the proposal had passed review and no message came from you in between."

Deviation from the row's wording: the turn ran `openspec instructions apply --change widget-cache` (opsx-apply step 3) twice but never `openspec status --change widget-cache` (step 2), and its announcement used the apply output header, not "Using change: widget-cache". `opsx-apply.md` is unchanged by this change and out of scope for blocking (gate.md).

Verdict: PASS. The continuation turn passed `--reviewed`, ran the apply workflow for `widget-cache` and edited `src/cache.ts`. The step-2 `status` call named in the row is not observed.
