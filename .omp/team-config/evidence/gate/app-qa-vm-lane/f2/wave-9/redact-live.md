# redact-live

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:25:03]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=53288 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
lane file truncated to 40 bytes (invalid JSON)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight ios)  [13:25:09]
lane: /Users/[redacted]/.omp/agent/app-qa-vm.json: not valid JSON
[exit 2]
$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json
identical
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:25:11]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=53288 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

Observation: with a ready lease, `vm status` prints the worktree path as `/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1`; with the lane file truncated to invalid JSON, the routed `preflight ios` prints `lane: /Users/[redacted]/.omp/agent/app-qa-vm.json: not valid JSON` (exit 2). Neither output contains the user name (the raw log holds no `/Users/<name>`, checked with a string search before writing this file). The lane file was restored (`cmp` identical) and `vm status` afterwards is unchanged.

Verdict: PASS
