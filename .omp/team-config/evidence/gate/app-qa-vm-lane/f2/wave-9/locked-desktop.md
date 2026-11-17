# locked-desktop

Run 2026-11-17T12:33:50Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -rq`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Host screen locked (`"CGSSessionScreenIsLocked"=Yes`) before and after; run by the parent. Wave 9 is the closing wave of fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`): one script (`/tmp/aqvl/w9/rows.sh`, quoted in `rows-script.md`) ran `hostkey-nc` and then every row that exercises a lane ssh consumer, in order; its own guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `UserKnownHostsFile` = the pin, `HostKeyAlias=app-qa-golden`).

## Commands and output

```
### target-desktop / out-capture / locked-desktop
lock: "CGSSessionScreenIsLocked"=Yes
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up desktop)  [12:54:30]
ssh: settle: load 2.75 below 8 CPUs after 0 s
ssh: desktop: pid 4148
vm up: app-qa-slot-1 holds desktop
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [12:55:15]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=desktop forward=393 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight desktop)  [12:55:16]
lane: preflight desktop runs in app-qa-slot-1 (slot 1)
PASS driver: spectre 0.9.0
PASS screen capture: granted
PASS screen: unlocked
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop attach)  [12:55:20]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
attach: pid=4148 session=pid-4148
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop wait sign-in --timeout 60)  [12:55:30]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
wait: tag=sign-in count=1
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop tap sign-in)  [12:55:33]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
tap: tag=sign-in
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop wait home --timeout 60)  [12:55:36]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
wait: tag=home count=1
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop capture home --out /tmp/aqvl/w9/out/cap/out)  [12:55:39]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
capture: /tmp/aqvl/w9/out/cap/out/home.png
capture: /tmp/aqvl/w9/out/cap/out/home.json
[exit 0]
$ ls -la out (perm size name)
total  
drwxr-xr-x@ 128 .
drwxr-xr-x@ 96 ..
-rw-r--r--@ 9190 home.json
-rw-r--r--@ 53842 home.png
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs scan /tmp/aqvl/w9/out/cap)  [12:55:43]
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
[exit 0]
$ guest: ps -axo pid=,args= | awk '$2 ~ /\/bin\/java$/ && $NF == "eu.onara.app.MainKt" {print $1}'
4148
[exit 0]
lock: "CGSSessionScreenIsLocked"=Yes
```

Observation: host locked before and after (`=Yes`); routed `preflight desktop` exit 0 with the guest's `PASS screen capture: granted` and `PASS screen: unlocked`; attach, wait sign-in, tap sign-in, wait home, capture each exit 0; capture viewed (signed-in home: "Signed in as ...", Running generations, Coach chat, Profile, Logout), kept as `locked-desktop-home.png`; scan exit 0.

Verdict: PASS
