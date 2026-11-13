# notice-nc: requirement 4 negative control

Criterion (tasks.md 4.1): the `control-old` proposal output lacks the notice, so it fails the requirement and shows that the row discriminates.

Session `control-old`: interactive TUI under tmux, `omp --goal "Propose the change widget-cache with /opsx-propose, then apply each reviewed proposal."` in `/tmp/gmac-f1/control-old/`, with `.omp/commands/opsx-propose.md` taken from `main` (no Goal-mode continuation). Captures: `sessions/control-old/transcript.jsonl` (copied from the session file after the agent's `session_move` relocated it), `sessions/control-old/screen.txt`, `sessions/control-old/schema.json`, `sessions/control-old/forms/ask-control-old-082903.txt`. A first run was discarded because a monitor bug stopped it mid-planning; this capture is the rerun on a fresh fixture.

Observation: the planning turn ended its proposal with an `ask` form, "Requesting authorization to apply" (`sessions/control-old/transcript.jsonl`; question "Start /opsx-apply widget-cache?", `sessions/control-old/screen.txt` line 1059). The form says "/opsx-propose authorizes planning only; apply needs your go-ahead now". It contains no goal-mode notice: no statement that the next goal continuation applies the change, and neither stop route (a message before that turn, pausing the goal). `grep` for "Goal mode: the next goal" and "next goal turn applies" in the screen capture finds nothing. Under the same authorizing objective, `auth` (P from `W`) ended its proposal output with the notice (`notice.md`).

Operator error after the stop point, disclosed: the stop rule ends this session at its proposal output. The operator's form watcher instead submitted the form's pre-checked default "Yes, apply now", and the agent then applied `widget-cache` in the same turn on that explicit go-ahead. That apply follows an operator authorization, lies past the row's stop point and is not evidence for or against any requirement. The form itself shows the old text: the agent asked for authorization instead of announcing the continuation.

Verdict: PASS. The old text's proposal output lacks the notice and fails requirement 4, so the row discriminates.
