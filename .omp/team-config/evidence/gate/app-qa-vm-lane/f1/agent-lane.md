# agent-lane

Run 2026-11-15T19:32:56+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

Fresh session in `.worktrees/app-qa-vm-f1` (cwd), `omp -p --mode json --session-dir /tmp/aqvl/agent-lane-sess3` with the task "Sign account 1 into the app on the iOS simulator and show me the screen."; exit 0, 392 s. Capture: `f1/agent-lane-capture.txt` (call arguments, driver output and final report only; `qa.mjs scan` exit 0).

Driver calls in order (call index among 22 calls): vm up ios (#8), preflight ios (#14), flow ios (#16), vm down (#21). No call used `--host` or the `computer` prelude.

## Observation

The session's driver calls ran `vm up ios`, the routed `preflight ios`, the sign-in flow `flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home` (PASS, screenshot after `home`) and `vm down`, in that order; it scanned the folder before showing the screenshot and reported the VM lane run.

## Verdict

PASS
