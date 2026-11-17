# reclaim-nc

Run 2026-11-17T17:44:00Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `rows6.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file). Host screen locked at the end (`lock after: "CGSSessionScreenIsLocked"=Yes`); the row does not depend on it. No macOS VM outside the lane ran at start or end (the script's `running macOS VMs outside the lane` lines).

## Commands and output

```
### reclaim-nc
$ jq .idleMinutes ~/.omp/agent/app-qa-vm.json
1
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)
start 2026-11-17T17:44:00Z
ssh: settle: load 7.76 below 8 CPUs after 364 s
ssh: ios: 1E42863D-1AD5-4542-850C-1C7D5B200FD3
vm up: app-qa-slot-1 holds ios
[exit 0]
end 2026-11-17T17:58:34Z
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm up ios)
start 2026-11-17T17:44:00Z
ssh: settle: load 7.97 below 8 CPUs after 314 s
ssh: ios: 416806D9-DD03-46BC-A443-114764FD5CAE
vm up: app-qa-slot-2 holds ios
[exit 0]
end 2026-11-17T17:56:59Z
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [17:58:34]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=51009 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=ios forward=50725 holder=none busy=none last used 1 min ago
[exit 0]
--- flow attempt 1
flow attempt 1 still running at 2026-11-17T18:00:22Z
== 2026-11-17T18:00:22Z vm status during the running flow
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [18:00:22]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=51009 holder=none busy=61741 last used 1 min ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=ios forward=50725 holder=none busy=none last used 3 min ago
[exit 0]
== guest app pid and host forward pid before the refusals
$ guest (slot 1): pgrep -fl 'eu.onara.app.kmp|maestro' | cut -c1-120
1889 node /Users/lume/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-wait.yaml --acc
1928 /Library/Java/JavaVirtualMachines/app-qa-jdk-21/Contents/Home/bin/java --enable-native-access=ALL-UNNAMED -Djava.io
1981 /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild test-without-building -xctestrun /var/folders/6p/kj6l
2016 /Users/lume/Library/Developer/CoreSimulator/Devices/1E42863D-1AD5-4542-850C-1C7D5B200FD3/data/Containers/Bundle/App
[exit 0]
50725 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i ~/.omp/agent/app-qa-vm_ed25519 -o BatchMode=
51009 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i ~/.omp/agent/app-qa-vm_ed25519 -o BatchMode=
== keep the other lease (f1b) fresh
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs preflight ios)  [18:00:38]
lane: preflight ios runs in app-qa-slot-2 (slot 2)
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: 416806D9-DD03-46BC-A443-114764FD5CAE
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 0]
== 2026-11-17T18:01:02Z vm status
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [18:01:02]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=51009 holder=none busy=61741 last used 2 min ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=ios forward=50725 holder=none busy=none last used less than a minute ago
[exit 0]
== third vm up (f1c)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm up ios)  [18:01:05]
vm up: no free slot; every slot is held or used within 1 min:
  slot 1: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 (ready, last used 2 min ago)
  slot 2: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b (ready, last used less than a minute ago)
[exit 2]
== vm up ios in the flow worktree (f1)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [18:01:11]
vm up: a routed command of this worktree's lease runs (pid 61741); wait for it to finish
[exit 2]
== vm down of that lease (f1)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm down)  [18:01:19]
vm down: a routed command of this worktree's lease runs (pid 61741); wait for it to finish
[exit 2]
== guest app pid and host forward pid after the refusals
$ guest (slot 1): pgrep -fl 'eu.onara.app.kmp|maestro' | cut -c1-120
1889 node /Users/lume/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-wait.yaml --acc
1928 /Library/Java/JavaVirtualMachines/app-qa-jdk-21/Contents/Home/bin/java --enable-native-access=ALL-UNNAMED -Djava.io
1981 /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild test-without-building -xctestrun /var/folders/6p/kj6l
2016 /Users/lume/Library/Developer/CoreSimulator/Devices/1E42863D-1AD5-4542-850C-1C7D5B200FD3/data/Containers/Bundle/App
[exit 0]
50725 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i ~/.omp/agent/app-qa-vm_ed25519 -o BatchMode=
51009 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i ~/.omp/agent/app-qa-vm_ed25519 -o BatchMode=
== 2026-11-17T18:01:27Z vm status after the refusals
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [18:01:27]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=51009 holder=none busy=61741 last used 2 min ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=ios forward=50725 holder=none busy=none last used less than a minute ago
[exit 0]
--- flow output
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home)
start 2026-11-17T17:58:42Z
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: 1E42863D-1AD5-4542-850C-1C7D5B200FD3
root: (not kept)
out: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-out-OKnrWU
sweep: deleted out/2026-11-17_095852/f1-signin-wait/commands.json
sweep: redacted debug/.maestro/tests/2026-11-17_095852/maestro.log
sweep: redacted out/2026-11-17_095852/f1-signin-wait/logs/device-simulator.log
sweep: redacted out/2026-11-17_095852/f1-signin-wait/logs/maestro.log
PASS f1-signin-wait 197.1s
[exit 0]
end 2026-11-17T18:02:52Z
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [18:02:52]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=51009 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=ios forward=50725 holder=none busy=none last used 1 min ago
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm down)  [18:02:55]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm down)  [18:03:07]
vm down: deleted app-qa-slot-2, slot 2 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [18:03:13]
slot 1: free
slot 2: free
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
kmp-sc-f1 stopped
wv-f1-human stopped
$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json
identical
running macOS VMs outside the lane at end: []
lock after: "CGSSessionScreenIsLocked"=Yes
DONE
```

Observation: Both leases ready (f1 slot 1, f1b slot 2), `idleMinutes: 1`. During the routed flow in f1 (busy pid 61741, f1 `last used 2 min ago`, past the 1-minute limit), with f1b kept fresh by one routed `preflight ios` (exit 0) at 18:00:38, the third `vm up ios` (f1c) was refused, exit 2, naming both holders; `vm up ios` in f1 and `vm down` in f1 each exit 2 naming the busy pid 61741. The guest's app pid (2016) and the flow's guest processes (1889, 1928, 1981) and both host forward pids (51009 for slot 1, 50725 for slot 2) are the same before and after the three refusals. The flow finished `PASS f1-signin-wait 197.1s`; afterwards the busy marker was gone (`busy=none`), `vm down` of both leases exit 0, both slots free, `lume ls` lists no `app-qa-slot-*`, and the lane file was restored and `cmp` reports it identical.

Deviations: (1) the refusal of the third `vm up` needs both slots non-reclaimable, so the other lease (f1b) was kept fresh with one routed `preflight ios`, as in wave 6; without it the idle f1b would be reclaimed (that case is `reclaim-idle`). (2) Earlier wave-9 attempts of this row (`rows3.sh` with a foreign macOS VM running, and `rows4.sh`) ended before the idle limit passed: the wait flow failed on onara's 30 s login-form wait in `signin-ios.yaml` under host load (load average 45-86 from other sessions' emulators, VMs and Gradle builds), so no refusal could be observed. `rows6.sh` starts up to three flow attempts and goes on only with one still running after 100 s; the first attempt ran past the limit. (3) The *test* half of the row passes in the wave-9 test log `f2/wave-9/qa-test-log.txt`: a sweep during another worktree's start (`lease: starting - vm status during another worktree's starting vm up deletes nothing and leaves its lease`, line 29), a routed command during a reclaim (`lease: admit - during a reclaim whose delete is held a routed command of the reclaimed worktree exits 2 and runs no guest command`, line 26) and a killed teardown (the three `lease: closing - a vm down killed ...` tests, lines 31-33).

Verdict: PASS
