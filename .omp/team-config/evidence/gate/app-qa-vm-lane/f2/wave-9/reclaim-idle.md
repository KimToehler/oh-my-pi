# reclaim-idle

Run 2026-11-17T16:20:15Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `rows4.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file). Host screen unlocked (the script's lock lines print `CGSSessionScreenIsLocked absent`); the row does not depend on it. Re-run of the row after the first wave-9 attempt (`rows3.sh`) could not start a slot-2 clone: the macOS VM `kmp-sc-f1` of another session was running, and Apple's limit of two macOS guests per host refused every `lume run` of `app-qa-slot-2` (`slot2-vm-limit.txt`). `rows4.sh` checks at start that no macOS VM outside the lane runs (none) and records the same after lease-parallel and at the end. The two leases this row starts from are lease-parallel's (`lease-parallel.md`).

## Commands and output

```
### reclaim-idle
$ jq .idleMinutes ~/.omp/agent/app-qa-vm.json
1
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm status)  [16:39:34]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=63570 holder=none busy=none last used 2 min ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=ios forward=82620 holder=none busy=none last used 2 min ago
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm up ios)  [16:39:42]
lane: reclaimed slot 1: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 (idle since 2026-11-17T16:36:57.149Z); deleted app-qa-slot-1
ssh: settle: load 7.95 below 8 CPUs after 271 s
ssh: ios: FD504BB5-FDC6-4640-A7A2-B5A07257A587
vm up: app-qa-slot-1 holds ios
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm status)  [16:48:59]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-1 targets=ios forward=90856 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=ios forward=82620 holder=none busy=none last used 12 min ago
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 stopped
app-qa-slot-2 stopped
kmp-sc-f1 stopped
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm down)  [16:49:12]
vm down: this worktree holds no lease
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm down)  [16:49:20]
vm down: deleted app-qa-slot-2, slot 2 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm down)  [16:49:40]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [16:49:49]
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
```

Observation: With `idleMinutes: 1` and both slots held by ready leases idle for about 2 minutes (f1 in slot 1 since 16:36:57Z, f1b in slot 2), the third `vm up ios` (f1c, exit 0) printed `lane: reclaimed slot 1: .../app-qa-vm-f1 (idle since 2026-11-17T16:36:57.149Z); deleted app-qa-slot-1` and staged f1c in slot 1 (`vm status`: ready, targets=ios); the idle lease was the one idle longest. The other lease (f1b, slot 2) was left alone (`vm status` still lists it). Then `vm down` in f1 (`this worktree holds no lease`), f1b and f1c: all exit 0, both slots free, `lume ls` lists no `app-qa-slot-*`. The lane file was restored from its backup and `cmp` reports it identical. Deviation: the `lume ls` at 16:49 lists both clones `stopped` while `vm status` lists both ready with live forwards; as in `stage-nc`, `lume ls` status reads during heavy host load (load average about 50) lag the running clones.

Verdict: PASS
