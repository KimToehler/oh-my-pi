# cfg-nc

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
kmp-sc-f1 running
wv-f1-human stopped
sub-case 1: desktop.mainClass renamed mainClas
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight desktop --port 8081)  [13:14:22]
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: desktop.mainClas: unknown key
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: desktop.mainClass: missing
[exit 2]
$ cmp config backup ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json
identical
sub-case 2: vm section under schema app-qa/1
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight ios)  [13:14:22]
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: vm: unknown key
[exit 2]
$ cmp config backup ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json
identical
sub-case 3: configuration file removed
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight ios)  [13:14:23]
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: missing
[exit 2]
$ cmp config backup ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json
identical
lume ls unchanged
```

Observation: the misspelled `desktop.mainClas` (exit 2: unknown key and missing `desktop.mainClass`), a `vm` section under `app-qa/1` (exit 2: `vm: unknown key`) and the removed file (exit 2: `missing`) all stop with no check line, naming the file and the cause; the configuration was restored after each sub-case (`cmp` identical each time) and `lume ls` is unchanged.

Verdict: PASS
