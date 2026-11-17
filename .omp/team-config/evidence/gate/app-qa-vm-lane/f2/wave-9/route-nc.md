# route-nc

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [13:41:45]
ssh: settle: load 7.69 below 8 CPUs after 200 s
ssh: ios: 9C561965-2EF1-47B7-BEDB-D55D5A2EB9EA
vm up: app-qa-slot-1 holds ios
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:46:35]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=20483 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop attach)  [13:46:38]
lane: this worktree's lease did not stage desktop; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
[exit 2]
forward pid from vm status: 20483
$ kill 20483
forward gone
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight ios)  [13:46:41]
lane: the port forward of app-qa-slot-1 is not running; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:46:44]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=20483 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

Observation: with the lease staged for ios only (`vm up ios` on f1's lease, `targets=ios`), routed `desktop attach` exits 2 (`did not stage desktop; run ... vm up desktop`); after the lease's forward ssh (pid 20483, from `vm status`) was killed, routed `preflight ios` exits 2 (`the port forward of app-qa-slot-1 is not running; run ... vm up ios`) with no guest check. Another worktree's lease and a lease not `ready`: *test* rows `route: other`, `route: target`, `route: stopped`, `route: forward`, `route: unreachable` in `f2/wave-9/qa-test-log.txt`. `vm status` still lists the dead forward pid; the routed command checks the process, not the record.

Verdict: PASS
