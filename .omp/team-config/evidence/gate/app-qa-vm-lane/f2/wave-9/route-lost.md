# route-lost

Run 2026-11-17T12:33:50Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -rq`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Host screen locked (`"CGSSessionScreenIsLocked"=Yes`) before and after; run by the parent. Wave 9 is the closing wave of fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`): one script (`/tmp/aqvl/w9/rows.sh`, quoted in `rows-script.md`) ran `hostkey-nc` and then every row that exercises a lane ssh consumer, in order; its own guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `UserKnownHostsFile` = the pin, `HostKeyAlias=app-qa-golden`).

## Commands and output

```
--- first attempt (rows.sh) ---
### route-lost
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home)   (background)  [12:42:33]
forward pid from vm status: 52626
$ host: ps -o pid=,args= -p FORWARD (args cut to 90)
52626 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i ~/.om
$ guest: ps -axo pid=,args= | grep -E "maestro|qa.mjs flow" | grep -v grep | cut -c1-110
[exit 0]
$ kill 52626  [12:43:46]
--- flow output ---
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: 034F9F15-BE87-45B6-BA24-5C2C5737D5D7
root: $HOST_TMP/app-qa-root-ngUoWb
out: $HOST_TMP/app-qa-out-QyDDSk
sweep: deleted out/2026-11-17_044238/f1-signin-wait/commands.json
FAIL f1-signin-wait 33s: Assertion is false: "Username or email" is visible
root kept: $HOST_TMP/app-qa-root-ngUoWb
lane: app-qa-slot-1: the guest command exited 1; to restart the app, simulator or forward run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 1]


--- re-run (route-lost2.sh) ---
### route-lost (re-run)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [12:55:55]
slot 1: free
slot 2: free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [12:55:56]
ssh: settle: load 7.53 below 8 CPUs after 175 s
ssh: ios: 9DB5FD15-B3AF-4F2A-9702-E72EBE4BB9EF
vm up: app-qa-slot-1 holds ios
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home)   (background)  [13:02:12]
forward pid from vm status: 1766  [13:03:24]
$ host: ps -o pid=,args= -p FORWARD (args cut to 90)
 1766 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i ~/.om
$ guest: ps -axo pid=,args= | grep -E "maestro|qa.mjs flow" | grep -v grep | cut -c1-110
 1685 node /Users/lume/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-wait
 1724 /Library/Java/JavaVirtualMachines/app-qa-jdk-21/Contents/Home/bin/java --enable-native-access=ALL-UNNAME
 1777 /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild test-without-building -xctestrun /var/fold
 1797 /Users/lume/Library/Developer/CoreSimulator/Devices/9DB5FD15-B3AF-4F2A-9702-E72EBE4BB9EF/data/Containers
[exit 0]
$ kill 1766  [13:03:25]
--- flow output (finished 13:04:04) ---
lane: flow ios runs in app-qa-slot-1 (slot 1)
lane: infrastructure lost during the run (forward); this is not an app result, run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
guest (not an app result): credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
guest (not an app result): device: 9DB5FD15-B3AF-4F2A-9702-E72EBE4BB9EF
guest (not an app result): root: $HOST_TMP/app-qa-root-ongVFH
guest (not an app result): out: $HOST_TMP/app-qa-out-PbwF8F
guest (not an app result): sweep: deleted out/2026-11-17_050215/f1-signin-wait/commands.json
guest (not an app result): sweep: redacted debug/.maestro/tests/2026-11-17_050215/maestro.log
guest (not an app result): sweep: redacted out/2026-11-17_050215/f1-signin-wait/logs/device-simulator.log
guest (not an app result): sweep: redacted out/2026-11-17_050215/f1-signin-wait/logs/maestro.log
guest (not an app result): FAIL f1-signin-wait 80.1s: Assertion is false: id: home is visible
guest (not an app result): root kept: $HOST_TMP/app-qa-root-ongVFH
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:04:04]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=1766 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm down)  [13:04:05]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:04:10]
slot 1: free
slot 2: free
[exit 0]
lock after: "CGSSessionScreenIsLocked"=Yes
DONE
```

Observation: First attempt, not counted: the script started the wait flow on the clone `args-flow` had just signed in, without the fresh `vm up ios` the row prescribes (wave 6 ran it after one); the app was on its home screen, the sign-in subflow found no login form and the flow failed at 33 s (`"Username or email" is visible`), before the forward was killed at 70 s, so no loss was exercised; the lane reported it as an ordinary guest result (exit 1), which is right for a run whose infrastructure was intact. Re-run as in wave 6: fresh `vm up ios` (exit 0), the routed wait flow in the background; at 72 s `vm status` named forward pid 1766, the host `ps` shows it as the lease's `ssh -N -R 8081:...`, the guest shows the routed driver, Maestro and xcodebuild running; `kill 1766`. The flow returned exit 2; its first line after the lane line is `lane: infrastructure lost during the run (forward); this is not an app result, run ... vm up ios`, and every guest output line is prefixed `guest (not an app result):`, so no line starts with `PASS` or `FAIL` (the guest's own `FAIL f1-signin-wait 80.1s` sits behind the prefix). `vm status` afterwards still lists the slot ready with the killed pid as `forward=`; `vm down` exit 0, both slots free. Stopped-clone and dropped-connection cases: *test* rows `route: lost ...` / `route: peer-gone ...` (lines 79-81 of `qa-test-log.txt`, passing on this head).

Verdict: PASS
