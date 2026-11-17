# reset-reuse

Run 2026-11-17T14:01:07Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `route-port2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
--- first attempt (rows2.sh): the guest inspections read no clone address (the row script's own `lume ls | jq` lookup failed on lume's non-JSON preamble: `jq: parse error`); the flow passed (`PASS f1-signin-home 48s`). Repeated with the fixed lookup (`gip.sh`):

(the f1c lease above was released by vm down; f1b now takes the freed slot)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm up ios)  [14:09:08]
ssh: settle: load 7.95 below 8 CPUs after 256 s
ssh: ios: 260FA31E-E95C-4A45-B03C-8CB2FE4CA96B
vm up: app-qa-slot-1 holds ios
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm status)  [14:17:40]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-1 targets=ios forward=62999 holder=none busy=none last used less than a minute ago
slot 2: free
/tmp/aqvl/w9/route-port2.sh: line 13: 59874 Terminated: 15          probe > $O/probe2.log 2>&1
[exit 0]
f1b holds slot 1
$ guest (app-qa-slot-1 at 192.168.64.132): ls ~/work
onara
[exit 0]
$ guest (app-qa-slot-1 at 192.168.64.132): ls "${TMPDIR}app-qa" 2>&1; echo "(end)"
ls: /var/folders/6p/kj6l582x2874t2vjchfzyntm0000gn/T/app-qa: No such file or directory
(end)
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out /tmp/aqvl/w9/out-rp/rr)  [14:17:57]
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: 260FA31E-E95C-4A45-B03C-8CB2FE4CA96B
root: (not kept)
out: /tmp/aqvl/w9/out-rp/rr
sweep: deleted out/2026-11-17_061805/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-17_061805/maestro.log
sweep: redacted out/2026-11-17_061805/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-17_061805/f1-signin-home/logs/maestro.log
screenshot: /tmp/aqvl/w9/out-rp/rr/f1-home.png
PASS f1-signin-home 54.6s
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm down)  [14:19:33]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm status)  [14:19:48]
slot 1: free
slot 2: free
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
kmp-sc-f1 running
wv-f1-human stopped
--- probe log (every 15 s during vm up):
14:10:13 load=50.16 app-qa-slot-1 lume=running ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:10:41 load=54.66 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:11:15 load=64.55 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:11:46 load=66.00 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:12:18 load=72.91 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:12:50 load=63.55 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:13:27 load=67.83 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:13:58 load=59.08 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:14:28 load=52.46 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:14:57 load=54.02 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:15:25 load=52.32 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:15:52 load=52.58 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:16:21 load=46.21 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:16:49 load=47.36 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0 
14:17:16 load=45.89 app-qa-slot-1 lume=stopped ip=- run=1 dhcp=192.168.64.132 ssh: rc=0
```

Observation: After `vm down` in f1c freed slot 1, f1b took it (`vm up ios` exit 0, `vm status` slot 1 ready for f1b). Guest inspection over the pinned host key at the clone's address (192.168.64.132): `ls ~/work` shows one copy only (`onara`), and the guest `${TMPDIR}app-qa` does not exist (no session record left). The routed sign-in flow passed (`PASS f1-signin-home 54.6s`). Kept screenshot `reset-reuse-home.png` (viewed: signed-in home screen, `Coach chat` card, no credential on screen). `vm down` freed the slot; `lume ls` lists no `app-qa-slot-*`. Deviation: as in wave 6, the guest copy's worktree identity is not distinguishable by `ls ~/work` alone (one directory named `onara`). The refresh reset and the other worktree's files: *test* `stage: reset ...` (lines 61-62 of `qa-test-log.txt`, passing on this head). The first attempt's failed inspection was a fault in the row script, not the driver.

Verdict: PASS
