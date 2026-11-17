# lane-nofile

Run 2026-11-15T17:55:53+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

Lane file moved to `~/.omp/agent/app-qa-vm.json.away`.

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight ios
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
FAIL device: 2 booted devices (612AB788-087A-408B-ACE1-34BCD68C235D (iPhone 17 Pro), EB37BA50-3B78-4396-B068-DC23997BF895 (iPhone 17)); pass --device ID -- fix: pass --device ID
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 1]
```

shim calls: none

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
vm: the machine lane file ~/.omp/agent/app-qa-vm.json is missing; the lane is not set up on this machine
[exit 2]
```

shim calls: none

## Observation

Without the lane file the preflight runs on the host (host check lines with the host's two booted simulators, no `lane:` line, exit 1), and `vm up ios` exits 2 naming the missing lane file. No lume or ssh call.

## Verdict

PASS
