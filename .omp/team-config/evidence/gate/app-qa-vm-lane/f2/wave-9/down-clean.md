# down-clean

Run 2026-11-17T12:33:50Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -rq`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Host screen locked (`"CGSSessionScreenIsLocked"=Yes`) before and after; run by the parent. Wave 9 is the closing wave of fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`): one script (`/tmp/aqvl/w9/rows.sh`, quoted in `rows-script.md`) ran `hostkey-nc` and then every row that exercises a lane ssh consumer, in order; its own guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `UserKnownHostsFile` = the pin, `HostKeyAlias=app-qa-golden`).

## Commands and output

```
### down-clean
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm down)  [12:55:44]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
kmp-sc-f1 running
wv-f1-human stopped
$ host: ps -axo pid=,args= | grep -E "ssh .*-R" | grep -v grep
94662 ssh -f -N -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes
(end)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [12:55:50]
slot 1: free
slot 2: free
[exit 0]
lock after: "CGSSessionScreenIsLocked"=Yes
DONE
```

Observation: `vm down` deleted the clone (`lume ls` lists `app-qa-build`, `app-qa-golden` and two VMs outside the lane's slot namespace, `kmp-sc-f1` and `wv-f1-human`, untouched), no `ssh -R` of the lease remains (the one listed, pid 94662, is `kmp-sc-f1`'s, see `target-rerun.md`), and `vm status` shows both slots free.

Verdict: PASS
