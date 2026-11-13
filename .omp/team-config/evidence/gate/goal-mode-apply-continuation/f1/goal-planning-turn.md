# goal-planning-turn: "Planning inside goal mode"

Requirement: Planning ends the turn before any implementation; scenario "Planning inside goal mode".

Session `auth`: interactive TUI under tmux, `omp --goal "Propose the change widget-cache with /opsx-propose, then apply each reviewed proposal."` in `/tmp/gmac-f1/auth/` (P from `W` at `.omp/commands/`). Captures: `sessions/auth/transcript.jsonl` (copied from the session file after the agent's `session_move` relocated it under `~/.omp/agent/sessions/`), `sessions/auth/screen.txt`, `sessions/auth/schema.json`.

Fixture note: the global `openspec` skill points the agent at `~/.omp/agent/commands/opsx-propose.md`, which holds the `main` text. The agent read it, listed `.omp/commands/`, diffed the two copies and followed the project copy (thinking: "check the project-local opsx-propose command, since it probably overrides the global one").

Observation (`sessions/auth/transcript.jsonl`):

- Turn 0, started by the goal kickoff (user role, 07:07:24Z), created `widget-cache`, ran two review rounds (round 1 REJECT, fixed, round 2 delta check OKAY) and ended with `stopReason: stop`. Its commits touch only `openspec/changes/widget-cache/` (fixture `git log main --name-only`). It did not edit `src/cache.ts`.
- The turn's reply states "The team's rules don't allow applying in the same turn the proposal was written, so `src/cache.ts` is unchanged and the goal stays open" and ends with the notice (`sessions/auth/screen.txt`, line 992).
- Apply began only in turn 1, which the hidden `Continue active goal.` message started at 07:20:06Z.

Verdict: PASS.
