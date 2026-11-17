# lane-novm

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
config: vm section removed
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight desktop --port 8081)  [13:14:26]
PASS driver: spectre 0.9.0
PASS screen capture: granted
FAIL screen: locked -- fix: unlock the screen
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 1]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:14:27]
vm: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json has no vm section
[exit 2]
$ cmp config backup ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json
identical
```

Observation: without the `vm` section (lane file present) the host `preflight desktop` runs on the host (exit 1 from the locked screen only, no lane line), and `vm status` exits 2 naming the configuration's missing `vm` section; configuration restored (`cmp` identical).

Verdict: PASS
