# lane-nofile

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
lane file moved away
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight desktop --port 8081)  [13:14:24]
PASS driver: spectre 0.9.0
PASS screen capture: granted
FAIL screen: locked -- fix: unlock the screen
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 1]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [13:14:25]
vm: the machine lane file /Users/[redacted]/.omp/agent/app-qa-vm.json is missing; the lane is not set up on this machine
[exit 2]
$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json
identical
```

Observation: with the lane file moved away, the host `preflight desktop` runs (host lines, exit 1 from the locked host screen only, no lane line) and `vm up ios` exits 2 naming the missing lane file (path printed with `[redacted]`); lane file restored (`cmp` identical).

Verdict: PASS
