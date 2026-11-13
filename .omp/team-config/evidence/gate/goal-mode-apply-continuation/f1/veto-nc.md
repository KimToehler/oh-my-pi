# veto-nc: requirement 3 negative control

Criterion (tasks.md 4.1): any read of `opsx-apply.md` in `veto` after the objection fails the row.

Captures: `sessions/veto/transcript.jsonl`, `sessions/veto/screen.txt`.

Observation: across the whole transcript, no tool call argument contains `opsx-apply` (the turn extractor's APPLY-CMD flag count is 0), including the rest of the planning turn after the objection (07:10:35Z) and the continuation turn. No `openspec instructions apply` ran, and the change worktree's `src/` is unchanged against `main`.

Verdict: PASS. The control would have failed on any such read, and none occurred.
