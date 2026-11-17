# target-nc

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
(lease and signed-in desktop from the args-shell setup, `args-shell.md`)
guest app pid: 3271
$ guest: kill -9 3271; sleep 2; ps -axo pid=,args= | awk '$2 ~ /\/bin\/java$/ && $NF == "eu.onara.app.MainKt"' | wc -l
       0
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop attach)  [13:41:40]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
attach: no eu.onara.app.MainKt JVM in this worktree (/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1); start it with ./gradlew :desktopApp:run in app_kmp/
lane: app-qa-slot-1: the guest command exited 2; to restart the app, simulator or forward run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
[exit 2]
```

Observation: *test* for a launcher cfg without a main class: `target: desktop - a launcher cfg without app.mainclass is refused by the host with exit 2 before any clone` in `f2/wave-9/qa-test-log.txt`. Live: after the guest app (pid 3271, the pid `vm up` printed) was killed with SIGKILL (0 MainKt JVMs left), routed `desktop attach` exits 2 (`no eu.onara.app.MainKt JVM in this worktree`) plus `lane: app-qa-slot-1: the guest command exited 2; to restart the app, simulator or forward run ... vm up desktop`.

Verdict: PASS
