# target-desktop

Run 2026-11-15T18:14:37+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
ssh: settle: load 5.67 below 8 CPUs after 0 s
ssh: desktop: pid 3128
vm up: app-qa-slot-1 holds desktop
[exit 0]
```

vm up took 35 s.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=desktop forward=16806 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
attach: pid=3128 session=pid-3128
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
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture home --out /tmp/aqvl/td-1794762821
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
capture: /tmp/aqvl/td-1794762821/home.png
capture: /tmp/aqvl/td-1794762821/home.json
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/aqvl/inspect_known_hosts -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR lume@192.168.64.23 'ps -axo pid=,args= | awk '\''$2 ~ /\/bin\/java$/ && $NF == "eu.onara.app.MainKt" {print $1}'\'''
3128
[exit 0]
```

The JVM count first used `ps -axo comm=,args= | awk '$1 ~ /\/java$/ && …'`, which printed 0 twice although the app ran: `ps` cuts `comm` to 16 characters when `args` follows (`/Library/Java/Ja`). The plan's row now matches the argv only (above): one pid, 3128, the pid `vm up` printed and `attach` used; the two `sudo` parents and Spectre's daemon (`DaemonMainKt`) do not match.

`qa.mjs scan /tmp/aqvl/td-1794762821`: exit 0. Capture kept as `target-desktop-home.png`: the signed-in home screen.

## Observation

`vm up desktop`, then routed attach, wait `sign-in`, tap, wait `home` and capture each exit 0 in one JVM (pid 3128, the one `java` process running the main class); the capture lands in the host `--out` folder and shows the signed-in home screen. The target start printed its settle line (load 5.67, no wait).

## Verdict

PASS
