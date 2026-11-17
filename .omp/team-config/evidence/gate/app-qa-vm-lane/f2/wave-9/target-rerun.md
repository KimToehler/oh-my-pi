# target-rerun

Run 2026-11-17T12:33:50Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -rq`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Host screen locked (`"CGSSessionScreenIsLocked"=Yes`) before and after; run by the parent. Wave 9 is the closing wave of fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`): one script (`/tmp/aqvl/w9/rows.sh`, quoted in `rows-script.md`) ran `hostkey-nc` and then every row that exercises a lane ssh consumer, in order; its own guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `UserKnownHostsFile` = the pin, `HostKeyAlias=app-qa-golden`).

## Commands and output

```
### target-rerun
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios desktop)  [12:43:46]
ssh: settle: load 7.48 below 8 CPUs after 210 s
ssh: ios: 14050ED0-46B2-4799-94BD-E043C4CBF877
ssh: settle: load 6.92 below 8 CPUs after 0 s
ssh: desktop: pid 3078
vm up: app-qa-slot-1 holds ios, desktop
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios desktop)  [12:48:53]
ssh: settle: load 7.63 below 8 CPUs after 205 s
ssh: ios: DE98E353-C68B-4339-8BC0-02F55AE4FC7E
ssh: settle: load 7.15 below 8 CPUs after 0 s
ssh: desktop: pid 3808
vm up: app-qa-slot-1 holds ios, desktop
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [12:53:29]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios,desktop forward=83813 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
$ guest: xcrun simctl list devices booted
== Devices ==
-- iOS 26.4 --
    app-qa-lane (DE98E353-C68B-4339-8BC0-02F55AE4FC7E) (Booted) 
[exit 0]
$ guest: ps -axo pid=,args= | awk '$2 ~ /\/bin\/java$/ && $NF == "eu.onara.app.MainKt" {print $1}'
3808
[exit 0]
$ host: ps -axo pid=,args= | grep -E "ssh .*-R" | grep -v grep   (args cut)
83813 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i /Use
94662 ssh -f -N -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home)  [12:53:33]
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: DE98E353-C68B-4339-8BC0-02F55AE4FC7E
root: (not kept)
out: $HOST_TMP/app-qa-out-urUGGL
sweep: deleted out/2026-11-17_045336/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-17_045336/maestro.log
sweep: redacted out/2026-11-17_045336/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-17_045336/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/app-qa-out-urUGGL/f1-home.png
PASS f1-signin-home 43.6s
[exit 0]
```

Observation: after `vm up ios desktop` twice (both exit 0; second run: new simulator `DE98E353-...`, new desktop pid 3808), the guest lists exactly one booted device (the second run's), the java/main-class `ps` prints exactly one pid (3808, the pid the second `vm up` printed for desktop), the host shows one `ssh -R` of the lease (pid 83813 = `forward=` of `vm status`; the other, pid 94662 `-R 127.0.0.1:8082` to 192.168.64.124, belongs to the VM `kmp-sc-f1` of another session, running since 11:31 and not a slot clone), and the routed iOS sign-in flow, run with no guest command between the second `vm up` and the flow, passed on its first and only attempt (`PASS f1-signin-home 43.6s`, exit 0); screenshot viewed (signed-in home), kept as `target-rerun-home.png`.

Verdict: PASS
