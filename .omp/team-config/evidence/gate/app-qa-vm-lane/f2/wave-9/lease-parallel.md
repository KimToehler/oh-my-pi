# lease-parallel

Run 2026-11-17T18:18:03Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `rows8.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file). Host screen locked before and after (`CGSSessionScreenIsLocked=Yes`). No macOS VM outside the lane ran at start or end.

## Commands and output

```
running macOS VMs outside the lane at start: none
Run 2026-11-17T18:18:03Z head 7a3687e8267cbbf3ef5ac275e1eff3e28bf362da; lock before: "CGSSessionScreenIsLocked"=Yes

### lease-parallel
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [18:18:03]
slot 1: free
slot 2: free
[exit 0]
lume ls at 2026-11-17T18:18:44Z (both starts running):
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
kmp-sc-f1 stopped
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)
start 2026-11-17T18:18:04Z
ssh: settle: load 7.89 below 8 CPUs after 418 s
ssh: ios: C3307184-9800-4663-8878-3300267E2C52
vm up: app-qa-slot-2 holds ios
[exit 0]
end 2026-11-17T18:29:33Z
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm up ios)
start 2026-11-17T18:18:04Z
ssh: settle: load 7.86 below 8 CPUs after 363 s
ssh: ios: 360D9961-B83A-4AD2-91D9-E30DF6E5CBC2
vm up: app-qa-slot-1 holds ios
[exit 0]
end 2026-11-17T18:29:30Z
after both starts at 2026-11-17T18:29:33Z:
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 running
app-qa-slot-2 stopped
kmp-sc-f1 stopped
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [18:29:37]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-1 targets=ios forward=98754 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-2 targets=ios forward=98425 holder=none busy=none last used less than a minute ago
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-par.yaml --account 1 --expect home --out /tmp/aqvl/w9/out8/lp-f1)
start 2026-11-17T18:29:40Z
lane: flow ios runs in app-qa-slot-2 (slot 2)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: C3307184-9800-4663-8878-3300267E2C52
root: (not kept)
out: /tmp/aqvl/w9/out8/lp-f1
sweep: deleted out/2026-11-17_102949/f1-signin-par/commands.json
sweep: redacted debug/.maestro/tests/2026-11-17_102949/maestro.log
sweep: redacted out/2026-11-17_102949/f1-signin-par/logs/device-simulator.log
sweep: redacted out/2026-11-17_102949/f1-signin-par/logs/maestro.log
screenshot: /tmp/aqvl/w9/out8/lp-f1/f1-home.png
PASS f1-signin-par 130.4s
[exit 0]
end 2026-11-17T18:32:43Z
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs flow ios app_kmp/maestro/f1-signin-par.yaml --account 1 --expect home --out /tmp/aqvl/w9/out8/lp-f1b)
start 2026-11-17T18:29:40Z
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: 360D9961-B83A-4AD2-91D9-E30DF6E5CBC2
root: (not kept)
out: /tmp/aqvl/w9/out8/lp-f1b
sweep: deleted out/2026-11-17_102948/f1-signin-par/commands.json
sweep: redacted debug/.maestro/tests/2026-11-17_102948/maestro.log
sweep: redacted out/2026-11-17_102948/f1-signin-par/logs/device-simulator.log
sweep: redacted out/2026-11-17_102948/f1-signin-par/logs/maestro.log
screenshot: /tmp/aqvl/w9/out8/lp-f1b/f1-home.png
PASS f1-signin-par 112.8s
[exit 0]
end 2026-11-17T18:32:27Z
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm down)  [18:32:43]
vm down: deleted app-qa-slot-2, slot 2 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1b && qa.mjs vm down)  [18:32:55]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [18:33:04]
slot 1: free
slot 2: free
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
kmp-sc-f1 stopped
wv-f1-human stopped
$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json
identical
running macOS VMs outside the lane at end: []
lock after: "CGSSessionScreenIsLocked"=Yes
DONE
```

Observation: two scratch worktrees (f1, f1b) ran `vm up ios` at the same time from two free slots: both exit 0, f1 in slot 2 (`app-qa-slot-2`), f1b in slot 1 (`app-qa-slot-1`); `vm status` lists two ready leases with distinct clones and forwards (98425, 98754). A routed sign-in flow then ran in each at the same time (18:29:40Z to 18:32:43Z): `PASS f1-signin-par 130.4s` in slot 2 and `PASS f1-signin-par 112.8s` in slot 1, each on its own device UDID, and each kept one screenshot taken after the `home` assertion (`lease-parallel-slot2-home.png`, `lease-parallel-slot1-home.png`, viewed: both the signed-in home screen). `vm down` in both exit 0, both slots free, `lume ls` lists no `app-qa-slot-*`, the lane file `cmp`-identical.

Deviations: (1) The two clones are listed in `lume ls` by the `vm status` slot table here; the `lume ls` at 18:18:44Z ran before either clone existed (both starts were still building and staging), and the one at 18:29:33Z lists `app-qa-slot-2 stopped` while its lease is ready with a live forward and a flow then passed in it: as in `stage-nc`, `lume ls` status reads lag the running clones under host load. The part-7 attempt (`rows7.sh`, same script with `f1-signin-home.yaml`) lists both `app-qa-slot-1 running` and `app-qa-slot-2 running` at 18:04:32Z while both starts ran. (2) Earlier attempts ran the scratch `f1-signin-home.yaml` (onara's unchanged `signin-ios.yaml` plus a `home` assertion): `rows4.sh` (both flows FAIL), `rows5.sh` (slot 1 PASS 100.2s, slot 2 FAIL) and `rows7.sh` (slot 2 PASS 115.2s, slot 1 FAIL). Every failure is the same onara-flow race, read from the kept roots' Maestro logs: `signin-ios.yaml` checks the `Continue|Fortfahren` consent alert once, about 7 s after the sign-in tap, the check is SKIPPED, the alert then appears and hides the form, and the 30 s `Username or email` wait fails. All 9 kept flow roots in the host's `$TMPDIR` that failed on the `Username or email` wait show the same SKIPPED consent check before it (7 of them right after the sign-in tap). This attempt used the scratch flow `f1-signin-par.yaml` (quoted in `rows-script.md`), which taps sign-in and waits up to 90 s for the alert or the form before running the unchanged `signin-ios.yaml`; it changes nothing in the driver or the lane. The driver's part held in every attempt: two leases, two clones, two routed flows at the same time, each on its own device, and a lane hint naming `vm up ios` on failure.

Verdict: PASS
