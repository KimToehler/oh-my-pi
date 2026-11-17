# cfg-newer

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
config: schema set to app-qa/3
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight ios)  [13:14:18]
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: schema app-qa/3 is not one of app-qa/1, app-qa/2, the schemas this driver supports; redeploy team config (scripts/deploy-local.sh) to get a driver for it
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:14:19]
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: schema app-qa/3 is not one of app-qa/1, app-qa/2, the schemas this driver supports; redeploy team config (scripts/deploy-local.sh) to get a driver for it
[exit 2]
$ cmp config backup ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json
identical
```

Observation: with `schema` `app-qa/3` in onara's `.omp/app-qa.json`, `preflight ios` and `vm status` each exit 2 naming the file, the id, both supported ids (`app-qa/1`, `app-qa/2`) and the redeploy command; no check line ran. The configuration was restored (`cmp` identical).

Verdict: PASS
