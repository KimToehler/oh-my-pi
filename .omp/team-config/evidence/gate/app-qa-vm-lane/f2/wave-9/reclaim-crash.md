# reclaim-crash

Run 2026-11-17T14:20:00Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `rows3.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [14:37:48]
slot 1: free
slot 2: free
[exit 0]
driver pid 7540 at 2026-11-17T14:37:49Z
clone listed at 2026-11-17T14:38:48Z
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 stopped
kmp-sc-f1 running
wv-f1-human stopped
kill -9 7540 (driver) at 2026-11-17T14:38:51Z, exit 0
driver wait status 137
--- vm up output before the kill:
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [14:38:51]
lane: sweep: deleted app-qa-slot-1 (starting lease of dead pid 7540)
lane: sweep: freed slot-1
slot 1: free
slot 2: free
[exit 0]
(end of lume mutation processes)
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
kmp-sc-f1 running
wv-f1-human stopped
```

Observation: From two free slots, `vm up ios` in f1 (pid 7540) was killed with SIGKILL 3 s after its clone `app-qa-slot-1` appeared in `lume ls` (exit 137, no output). The next `vm status` printed `lane: sweep: deleted app-qa-slot-1 (starting lease of dead pid 7540)` and `lane: sweep: freed slot-1`, then both slots free; no `lume clone|stop|delete` process for a slot runs and `lume ls` lists no `app-qa-slot-*`.

Verdict: PASS
