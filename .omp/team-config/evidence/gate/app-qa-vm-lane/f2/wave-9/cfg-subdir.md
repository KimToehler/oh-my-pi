# cfg-subdir

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp && qa.mjs preflight ios)  [13:24:47]
lane: preflight ios runs in app-qa-slot-1 (slot 1)
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: 3CF8EC24-B74F-4749-83B9-FA0C44DBD969
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 0]
```

Observation: run from `app_kmp/` (a subdirectory of the linked worktree), `preflight ios` finds the worktree configuration and routes to the lease (lane line naming slot 1 and `app-qa-slot-1`; device, backend 8081 health); exit 0.

Verdict: PASS
