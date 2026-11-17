# route-nolease

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:14:31]
slot 1: free
slot 2: free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop attach)  [13:14:31]
lane: this worktree holds no ready lease; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
[exit 2]
```

Observation: `vm status` shows both slots free (f1 holds no lease) and the routed `desktop attach` exits 2 naming `vm up desktop`.

Verdict: PASS
