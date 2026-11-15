# locked-desktop

Run 2026-11-15T18:16:00+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*'
"CGSSessionScreenIsLocked"=Yes
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
ssh: settle: load 2.83 below 8 CPUs after 0 s
ssh: desktop: pid 3881
vm up: app-qa-slot-1 holds desktop
[exit 0]
```

vm up took 18 s.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
lane: preflight desktop runs in app-qa-slot-1 (slot 1)
PASS driver: spectre 0.9.0
PASS screen capture: granted
PASS screen: unlocked
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
attach: pid=3881 session=pid-3881
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop wait sign-in --timeout 60
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
wait: tag=sign-in count=1
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap sign-in
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
tap: tag=sign-in
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop wait home --timeout 90
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
wait: tag=home count=1
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture home --out /tmp/aqvl/ld-1794762942
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
capture: /tmp/aqvl/ld-1794762942/home.png
capture: /tmp/aqvl/ld-1794762942/home.json
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*'
"CGSSessionScreenIsLocked"=Yes
[exit 0]
```

`qa.mjs scan /tmp/aqvl/ld-1794762942`: exit 0. Capture kept as `locked-desktop-home.png`: the signed-in home screen.

## Observation

Host locked before and after. The routed preflight desktop exits 0 with the guest's `PASS screen capture: granted` and `PASS screen: unlocked`; attach, wait `sign-in`, tap, wait `home` and capture each exit 0, and the capture shows the signed-in home screen.

## Verdict

PASS
