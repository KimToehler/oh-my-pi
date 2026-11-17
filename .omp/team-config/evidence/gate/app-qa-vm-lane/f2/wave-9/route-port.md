# route-port

Run 2026-11-17T14:01:07Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `route-port2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
--- first attempt (rows2.sh, slot 2 while f1 held slot 1):
$ curl http://127.0.0.1:8091/actuator/health
{"groups":["liveness","readiness"],"status":"UP"}
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm up ios --port 8091)  [13:29:02]
vm up: app-qa-slot-2 did not accept an ssh connection
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm status)  [13:32:24]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=none forward=53288 holder=none busy=none last used 3 min ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used less than a minute ago
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c/app_kmp && qa.mjs preflight ios)  [13:32:27]
lane: this worktree's lease did not stage ios; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c/app_kmp && qa.mjs preflight ios --port 8091)  [13:32:27]
lane: this worktree's lease did not stage ios; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c/app_kmp && qa.mjs preflight ios --port 8081)  [13:32:28]
lane: this worktree's lease did not stage ios; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm down)  [13:32:28]
vm down: deleted app-qa-slot-2, slot 2 is free
[exit 0]
/tmp/aqvl/w9/rows2.sh: line 145: 99570 Terminated: 15          python3 /tmp/aqvl/relay.py
$ curl http://127.0.0.1:8091/actuator/health
000
relay stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm status)  [13:32:38]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=none forward=53288 holder=none busy=none last used 3 min ago
slot 2: free
[exit 0]

--- second attempt (route-port2.sh):
$ curl http://127.0.0.1:8091/actuator/health
{"groups":["liveness","readiness"],"status":"UP"}
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm status)  [14:01:08]
slot 1: free
slot 2: free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm up ios --port 8091)  [14:01:09]
ssh: settle: load 7.54 below 8 CPUs after 211 s
ssh: ios: B6DF5306-E386-42CF-B8A9-40FBB089509D
vm up: app-qa-slot-1 holds ios
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm status)  [14:07:57]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-1 targets=ios forward=53071 holder=none busy=none last used less than a minute ago
slot 2: free
/tmp/aqvl/w9/route-port2.sh: line 13: 52738 Terminated: 15          probe > $O/probe.log 2>&1
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c/app_kmp && qa.mjs preflight ios)  [14:08:05]
lane: preflight ios runs in app-qa-slot-1 (slot 1)
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: B6DF5306-E386-42CF-B8A9-40FBB089509D
PASS backend: http://127.0.0.1:8091/actuator/health UP
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c/app_kmp && qa.mjs preflight ios --port 8091)  [14:08:21]
lane: preflight ios runs in app-qa-slot-1 (slot 1)
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: B6DF5306-E386-42CF-B8A9-40FBB089509D
PASS backend: http://127.0.0.1:8091/actuator/health UP
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c/app_kmp && qa.mjs preflight ios --port 8081)  [14:08:35]
lane: app-qa-slot-1 forwards the backend port 8091, not 8081; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios --port 8081
[exit 2]
f1c holds slot 1
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm down)  [14:08:46]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
/tmp/aqvl/w9/route-port2.sh: line 71: 52722 Terminated: 15          python3 /tmp/aqvl/relay.py
$ curl http://127.0.0.1:8091/actuator/health
000
relay stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm status)  [14:09:05]
slot 1: free
slot 2: free
[exit 0]
--- probe log (every 15 s during vm up):
14:01:31 load=33.04 app-qa-slot-1 lume=running ip=- run=1 dhcp=- ssh: - 
14:01:53 load=37.54 app-qa-slot-1 lume=running ip=192.168.64.131 run=1 dhcp=(lume has one) ssh: rc=0 
14:02:25 load=40.66 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.131 ssh: rc=0 
14:02:56 load=50.77 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.131 ssh: rc=0 
14:03:29 load=52.25 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.131 ssh: rc=0 
14:04:00 load=50.20 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.131 ssh: rc=0 
14:04:30 load=47.62 app-qa-slot-1 lume=running ip=192.168.64.131 run=1 dhcp=(lume has one) ssh: rc=0 
14:05:01 load=50.37 app-qa-slot-1 lume=running ip=192.168.64.131 run=1 dhcp=(lume has one) ssh: rc=0 
14:05:30 load=42.35 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.131 ssh: rc=0 
14:05:59 load=27.96 app-qa-slot-1 lume=running ip=192.168.64.131 run=1 dhcp=(lume has one) ssh: rc=0 
14:06:27 load=20.60 app-qa-slot-1 lume=running ip=192.168.64.131 run=1 dhcp=(lume has one) ssh: rc=0 
14:06:56 load=20.27 app-qa-slot-1 lume=running ip=192.168.64.131 run=1 dhcp=(lume has one) ssh: rc=0 
14:07:23 load=23.76 app-qa-slot-1 lume=running ip=192.168.64.131 run=1 dhcp=(lume has one) ssh: rc=0 
14:07:50 load=33.76 app-qa-slot-1 lume=running ip=192.168.64.131 run=1 dhcp=(lume has one) ssh: rc=0
```

Observation: Second attempt: with the relay on 8091 serving the local backend (health UP first), `vm up ios --port 8091` in f1c exits 0 (`app-qa-slot-1 holds ios`) and `vm status` shows slot 1 ready for f1c with forward 53071; routed `preflight ios` without `--port` checks the forwarded port (`backend: http://127.0.0.1:8091/actuator/health UP`, exit 0), with `--port 8091` the same (exit 0), and `--port 8081` is refused with exit 2 (`app-qa-slot-1 forwards the backend port 8091, not 8081; run ... vm up ios --port 8081`) and no guest check line. `vm down` deleted slot 1; the relay was killed (8091 answers `000`). Deviation: the first attempt (rows2.sh, 13:29Z, slot 2 with f1 holding slot 1, host load about 45 from other sessions' emulators, Gradle daemons and VM `kmp-sc-f1`) ended `vm up: app-qa-slot-2 did not accept an ssh connection`, exit 2, after the driver's 180 s ssh wait (`waitForSsh`, qa.mjs:1977). The second attempt logged the clone every ~30 s (probe log above): its address was known from the DHCP lease throughout and ssh answered, yet `lume ls` alternated between `running` and `stopped` under load 33-52, and `vm up` took 6 min 48 s with a 211 s settle wait. The ssh wait is a fixed budget that host load can exhaust; the failure was a refusal with exit 2 and a clean lease, not a wrong route.

Verdict: PASS
