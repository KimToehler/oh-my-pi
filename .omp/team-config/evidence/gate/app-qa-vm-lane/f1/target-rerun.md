# target-rerun

Run 2026-11-15T19:20:19+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios desktop   # run 1
ssh: settle: load 7.89 below 8 CPUs after 200 s
ssh: ios: A7A3A885-AD36-4441-BE40-D6A4FFEA73B2
ssh: settle: load 7.42 below 8 CPUs after 0 s
ssh: desktop: pid 5345
vm up: app-qa-slot-1 holds ios, desktop
[exit 0]
```

vm up took 278 s.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios desktop   # run 2
ssh: settle: load 7.67 below 8 CPUs after 205 s
ssh: ios: AA66F9A3-C65B-40F6-BABA-87400749C460
ssh: settle: load 6.87 below 8 CPUs after 0 s
ssh: desktop: pid 6066
vm up: app-qa-slot-1 holds ios, desktop
[exit 0]
```

vm up took 304 s.

```
$ (cwd .worktrees/app-qa-vm-f1) ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/aqvl/inspect_known_hosts -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR lume@192.168.64.26 'xcrun simctl list devices booted'
== Devices ==
-- iOS 26.4 --
    app-qa-lane (AA66F9A3-C65B-40F6-BABA-87400749C460) (Booted)
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/aqvl/inspect_known_hosts -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR lume@192.168.64.26 'ps -axo pid=,args= | awk '\''$2 ~ /\/bin\/java$/ && $NF == "eu.onara.app.MainKt" {print $1}'\'''
6066
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) pgrep -fl '^/usr/bin/ssh -N -R' 
11337 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i ~/.omp/agent/app-qa-vm_ed25519 -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=10 lume@192.168.64.27
13958 /usr/bin/ssh -N -R 8081:127.0.0.1:8081 -o ExitOnForwardFailure=yes -i ~/.omp/agent/app-qa-vm_ed25519 -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=10 lume@192.168.64.26
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios,desktop forward=13958 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=ios forward=11337 holder=none busy=none last used 14 min ago
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: AA66F9A3-C65B-40F6-BABA-87400749C460
root: (not kept)
out: $HOST_TMP/T/app-qa-out-9LMcDL
sweep: deleted out/2026-11-15_101833/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-15_101833/maestro.log
sweep: redacted out/2026-11-15_101833/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-15_101833/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/T/app-qa-out-9LMcDL/f1-home.png
PASS f1-signin-home 44.1s
[exit 0]
```

`qa.mjs scan` of the returned folder: exit 0. Host `ssh -R` processes: pid 13958 for slot 1 (this lease, `vm status` forward=13958) and pid 11337 for slot 2 (`app-qa-vm-f1c`), so one per lease.

## Observation

After `vm up ios desktop` twice, the guest shows one booted device (the second start's `AA66F9A3-…`), the argv match prints one JVM pid 6066, equal to the `desktop: pid 6066` the second `vm up` printed; the host has one `ssh -R` process for this lease (13958, the forward `vm status` names; 11337 belongs to slot 2), and the routed sign-in flow passes.

## Verdict

PASS
