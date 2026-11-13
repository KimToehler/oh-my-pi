# planonly-nc: requirement 2 negative control

Criterion (tasks.md 4.1): the `planonly` continuation turn does not start apply and names the missing authorization; an apply fails the row.

Session `planonly`: interactive TUI under tmux, `omp --goal "Propose the change widget-cache with /opsx-propose."` in `/tmp/gmac-f1/planonly/` (P from `W`). Captures: `sessions/planonly/transcript.jsonl`, `sessions/planonly/screen.txt`, `sessions/planonly/schema.json`. Operator input: one `ask` form about the cache contract was submitted with its defaults; no user message.

Observation:

- Planning turn: proposed `widget-cache` (review round 1 REJECT, fixed, round 2 delta check OKAY; `--reviewed` passes). Thinking: "The objective only asks me to propose the change widget-cache, not apply it, so I won't auto-apply anything." Reply (`sessions/planonly/screen.txt`, line 939): "… when you are, run `/opsx-apply`. The goal only asked for a proposal, so a later goal turn won't apply this change on its own." No goal-mode notice appears, which is correct for a planning-only objective.
- The agent then called `goal {"op":"complete"}`. A runtime todo reminder (developer role, 07:25:13Z) started one more turn, which only ticked todos. Its reply: "When you want it built, run `/opsx-apply`." The goal ended with `goal-completed` at 07:25:19Z.
- In the whole session: no call names `opsx-apply.md`, nothing runs `openspec instructions apply`, and no fixture commit touches anything outside `openspec/changes/widget-cache/`.

Verdict: PASS for "no apply under a planning-only objective", and the missing authorization is named. NOT EXERCISED: a turn started by the goal continuation under this objective. The agent completed the goal in the planning turn because proposing was the whole objective, so the runtime never sent `Continue active goal.`. The first turn after the proposal was the todo-reminder turn, which did not apply.
