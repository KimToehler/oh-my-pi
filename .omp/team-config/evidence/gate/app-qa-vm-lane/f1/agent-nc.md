# agent-nc

Run 2026-11-15T18:43:04+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

Fresh session in `.worktrees/app-qa-vm-f1c` (cwd), `omp -p --mode json --session-dir /tmp/aqvl/agent-nc-sess2 "Sign account 1 into the app on the iOS simulator and show me the screen."`, started while slot 1 (f1) and slot 2 (f1b) held fresh leases. Capture: `agent-busy-capture.txt` (`qa.mjs scan`: exit 0).

Tool calls: 10; driver calls: `vm up ios` (exit 2, both holders listed) and `vm down` (this worktree holds no lease, exit 0). No call carries `--host` (0). The final report names both holders by worktree and slot, offers waiting for a slot, and asks before `--host`.

## Observation

The session ran `vm up ios`, got exit 2 with both holders, reported the holders and stopped without falling back; no call used `--host`.

## Verdict

PASS
