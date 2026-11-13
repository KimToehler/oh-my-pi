# no-goal: "No goal active"

Requirement: A goal continuation applies a reviewed change its objective authorizes; scenario "No goal active".

Session `nogoal-continue`: interactive TUI under tmux, `omp "/opsx-propose add a widget cache"`, no goal, in `/tmp/gmac-f1/nogoal-continue/` (P from `W` at `.omp/commands/`). Captures: `sessions/nogoal-continue/transcript.jsonl`, `sessions/nogoal-continue/screen.txt`, `sessions/nogoal-continue/schema.json`. Operator input: one `ask` form about the cache contract submitted with its defaults during planning; after the planning turn ended (`stopReason: stop`), the typed message "Continue active goal." (`sessions/monitor.log`, 08:30:43). A first run of this session was discarded because a monitor bug sent that message while the planning turn was still running; this capture is the rerun on a fresh fixture.

Observation:

- Planning turn: created `add-widget-cache`, reviewed it (OKAY round 1) and ended with "All artifacts needed for implementation are ready. The artifacts are ready for review. When you are ready, run `/opsx-apply`." (`sessions/nogoal-continue/screen.txt`, line 1191). No source change.
- Turn after the proposal (typed "Continue active goal.", line 1194): zero tool calls. Reply (line 1203): "I haven't started applying `add-widget-cache`. A goal continuation can only apply a change whose goal says it may, and this one doesn't show that." It names the missing objective and the absent active goal, and states that the `/opsx-propose` request allowed planning only.
- No call names `opsx-apply.md`, the fixture has no worktree, and the last commit touching `src/` is the fixture commit.

Verdict: PASS. This session also shows a planning turn with no goal that presents the artifacts and ends, which `build-request.md` could not observe under `-p`.
