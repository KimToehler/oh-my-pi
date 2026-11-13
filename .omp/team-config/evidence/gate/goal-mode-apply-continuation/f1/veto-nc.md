# veto-nc: requirement 3 negative control

Criterion (tasks.md 4.1, rerun under 5.1): any read of `opsx-apply.md` after the objection fails the row; in `veto-log` that window includes the two continuation turns after the planning turn.

Captures: `sessions/veto-log/transcript.jsonl`, `sessions/veto-log/screen.txt` (qualifying, task 5.1); `sessions/veto/transcript.jsonl`, `sessions/veto-cont/transcript.jsonl`, `sessions/veto-later/transcript.jsonl` (earlier captures with one continuation turn each).

Observation: in `veto-log`, no tool call after the objection (08:27:28Z) has an argument containing `opsx-apply` or `instructions apply`: not in the rest of the planning turn and not in continuation turns 1, 2 and the started turn 3, whose only tool calls append to `notes/turns.log`. No `.worktrees/` directory exists in the fixture and `src/` is unchanged against `2ad5fb9`. The same holds after the objection in `veto` (07:10:35Z), `veto-cont` (07:52:14Z) and `veto-later` (08:08:30Z).

Verdict: PASS. The control would have failed on any such read in any of the four sessions, and none occurred.
