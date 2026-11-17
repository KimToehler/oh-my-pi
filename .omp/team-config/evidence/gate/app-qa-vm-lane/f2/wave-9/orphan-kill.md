# orphan-kill

Run 2026-11-17T14:20:00Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `rows3.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [15:19:46]
ssh: settle: load 7.69 below 8 CPUs after 200 s
ssh: ios: 63EBE64D-7431-472E-AA85-D4EC19BF1F98
vm up: app-qa-slot-1 holds ios
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:24:48]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=57226 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 30 min ago
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 running
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped
old clone app-qa-slot-1 address 192.168.64.137
$ guest: ps -axo pid=,args= | grep -E "maestro|qa.mjs flow" | grep -v grep   (args cut to 120)
 2755 node /Users/lume/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-wait.yaml --ac
 2793 /Library/Java/JavaVirtualMachines/app-qa-jdk-21/Contents/Home/bin/java --enable-native-access=ALL-UNNAMED -Djava.i
 2847 /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild test-without-building -xctestrun /var/folders/6p/kj6
 2864 /Users/lume/Library/Developer/CoreSimulator/Devices/63EBE64D-7431-472E-AA85-D4EC19BF1F98/data/Containers/Bundle/Ap
host driver pid 58560
pid 58560 gone
$ host ssh to the old address right after the kill:
57226 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i ~/.omp/agent/app-qa-vm_ed25519 -o BatchMode=yes -o StrictHostKeyChecking=y
58599 /usr/bin/ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=~/.omp/agent/app-qa-
(end)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:25:06]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=57226 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 30 min ago
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [15:25:09]
lane: a routed command of this lease ended on the host without finishing (pid 58560) and may still run in app-qa-slot-1; deleted app-qa-slot-1 to recreate it
ssh: settle: load 7.81 below 8 CPUs after 231 s
ssh: ios: D6FB702B-DCB8-470E-B8BC-0C3071BB36D3
vm up: app-qa-slot-1 holds ios
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 stopped
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped
new clone app-qa-slot-1 address 192.168.64.138
$ guest (slot 1): ps -axo pid=,args= | grep -E "maestro|qa.mjs flow" | grep -v grep | cut -c1-120; echo "(none above = none)"
(none above = none)
[exit 0]
15:34:45 host ssh to the old address 192.168.64.137, about 2 min after the recreating vm up:
0
--- forward ssh:
60691       08:42 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i ~/.omp/agent/app-qa-vm_ed25519 -
94662    05:03:24 ssh -f -N -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o UserK
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:34:46]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=60691 holder=none busy=none last used 2 min ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 40 min ago
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm down)  [15:34:50]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:35:02]
slot 1: free
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 40 min ago
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped
```

Observation: Rows 7.8 and 7.9: the guest ran the routed wait flow (guest driver pid 2755, Maestro java pid 2793, `xcodebuild test-without-building` pid 2847); the host driver pid 58560 was killed with SIGKILL and is gone, and `vm status` kept the lease. Right after the kill two host ssh processes to the old address 192.168.64.137 remained: the forward (57226) and the killed command's ssh (58599). `vm up ios` exited 0 and printed `lane: a routed command of this lease ended on the host without finishing (pid 58560) and may still run in app-qa-slot-1; deleted app-qa-slot-1 to recreate it`; the clone was recreated (address 192.168.64.137 -> .138, no in-place refresh), and the new guest lists no Maestro or flow process. About 2 min after the recreating `vm up`, 0 host ssh processes name the old address; the only forward of the lane is the new one (60691, the lease's `forward=60691`). The other `ssh -f -N ... -R 127.0.0.1:8082` (pid 94662, since 11:31) belongs to another session's VM `kmp-sc-f1`. `vm down` freed slot 1 and deleted the clone. Host lock state: locked at the start of rows3.sh, `CGSSessionScreenIsLocked absent` (unlocked) at its end; this row does not depend on it.

Verdict: PASS
