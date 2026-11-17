# cfg-override

Run 2026-11-17T15:36:53Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `cfg-override.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
Run 2026-11-17T15:36:53Z
Lock state before: 
alt config: /tmp/aqvl/w9/alt-qa.json = onara's .omp/app-qa.json without its vm section; keys: schema,name,desktop,backend,credentials,expect,android,scan
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1) $QA vm status
slot 1: free
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 42 min ago
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1) $QA vm up ios
ssh: settle: load 7.48 below 8 CPUs after 261 s
ssh: ios: 2F974C77-151E-45FA-BB5B-462D0606D944
vm up: app-qa-slot-1 holds ios
[exit 0]
--- host processes before (simctl, maestro, spectre, xcodebuild):
46729 /opt/homebrew/Cellar/spectre/0.9.0/libexec/Spectre.app/Contents/Resources/runtime/bin/java -Djava.io.tmpdir=$HOST_TMP…
70503 /usr/bin/java --enable-native-access=ALL-UNNAMED -Djava.io.tmpdir=$HOST_TMP/app-qa-flow-9kw2bQ/
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp) $QA preflight ios --config /tmp/aqvl/w9/alt-qa.json
lane: --config names a host file; run the command with --host to use it on the host
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp) $QA preflight desktop --config /tmp/aqvl/w9/alt-qa.json
lane: --config names a host file; run the command with --host to use it on the host
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp) $QA flow ios maestro/f1-signin-home.yaml --config /tmp/aqvl/w9/alt-qa.json
lane: --config names a host file; run the command with --host to use it on the host
[exit 2]
--- host processes after:
46729 /opt/homebrew/Cellar/spectre/0.9.0/libexec/Spectre.app/Contents/Resources/runtime/bin/java -Djava.io.tmpdir=$HOST_TMP…
70503 /usr/bin/java --enable-native-access=ALL-UNNAMED -Djava.io.tmpdir=$HOST_TMP/app-qa-flow-9kw2bQ/
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp) $QA preflight ios
lane: preflight ios runs in app-qa-slot-1 (slot 1)
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: 2F974C77-151E-45FA-BB5B-462D0606D944
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp) $QA preflight ios --host --config /tmp/aqvl/w9/alt-qa.json
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: 612AB788-087A-408B-ACE1-34BCD68C235D
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1) $QA vm down
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1) $QA vm status
slot 1: free
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 50 min ago
[exit 0]
Lock state after:
```

Observation: In a ready ios lease of f1, `preflight ios`, `preflight desktop` and `flow ios` with `--config` naming a valid host file without a `vm` section each exit 2 with `lane: --config names a host file; run the command with --host to use it on the host`; the host process list for simctl, Maestro, Spectre and xcodebuild is the same before and after (pid 46729, the Spectre runtime, and pid 70503, a flow JVM of another session's android run, both present before), so nothing started on the host. Without `--config` the same `preflight ios` runs in the lease (`lane: preflight ios runs in app-qa-slot-1`, exit 0); with `--host --config` the host checks run against the host simulator (device 612AB788-…, exit 0). `vm down` freed slot 1. Host screen unlocked during this row (the lock lines print empty: no `CGSSessionScreenIsLocked` key); the row does not depend on it.

Verdict: PASS
