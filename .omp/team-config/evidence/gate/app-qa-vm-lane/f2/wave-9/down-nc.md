# down-nc

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
(the lease released here is f1b's from the `reset-reuse` sequence of rows2.sh)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm down)  [13:57:40]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
kmp-sc-f1 running
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm status)  [13:57:56]
slot 1: free
slot 2: free
[exit 0]
$ stat golden disk
2026-11-15 17:45:45 ~/.lume/app-qa-golden/disk.img
```

Observation: after `vm down` (exit 0, `deleted app-qa-slot-1`) `lume ls` lists no `app-qa-slot-*` clone (only the stopped `app-qa-build` and `app-qa-golden`, plus the unrelated VMs `kmp-sc-f1` and `wv-f1-human` of other sessions), both slots are free, and the golden disk's modification time is 2026-11-15 17:45:45, the same value wave 6 read and earlier than the whole of F2: the lane did not modify the golden disk.

Verdict: PASS
