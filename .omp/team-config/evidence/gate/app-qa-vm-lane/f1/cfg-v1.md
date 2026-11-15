# cfg-v1

Run 2026-11-15T17:55:31+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*'
"CGSSessionScreenIsLocked"=Yes
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
PASS driver: spectre 0.9.0
PASS screen capture: granted
FAIL screen: locked -- fix: unlock the screen
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 1]
```

shim calls: none

## Observation

Host preflight desktop as before: host check lines, no `lane:` line; with the host locked it reports `screen: locked` and exits 1. No lume call.

## Verdict

PASS
