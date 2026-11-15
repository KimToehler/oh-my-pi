# stage-refresh

Run 2026-11-15T18:12:35+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

Edited `app_kmp/ui/src/commonMain/composeResources/values/strings.xml`: `jobs_empty` set to "F1 refresh marker: nothing generating." (reverted after the row).

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=65861 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
ssh: settle: load 7.99 below 8 CPUs after 165 s
ssh: ios: D1659918-9976-4C68-B53B-B75DAD527386
vm up: app-qa-slot-1 holds ios
[exit 0]
```

vm up took 328 s.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=2056 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/aqvl/inspect_known_hosts -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR lume@192.168.64.23 'grep -c "F1 refresh marker: nothing generating." ~/work/onara/app_kmp/ui/src/commonMain/composeResources/values/strings.xml'
1
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: D1659918-9976-4C68-B53B-B75DAD527386
root: (not kept)
out: $HOST_TMP/T/app-qa-out-ZuSzgZ
sweep: deleted out/2026-11-15_091122/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-15_091122/maestro.log
sweep: redacted out/2026-11-15_091122/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-15_091122/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/T/app-qa-out-ZuSzgZ/f1-home.png
PASS f1-signin-home 45.5s
[exit 0]
```

`qa.mjs scan` of the returned folder: exit 0. Screenshot kept as `stage-refresh-home.png`: the card shows "F1 refresh marker: nothing generating.". The edit was reverted afterwards; `git status` of the worktree: M .omp/app-qa.json; M app_kmp/gradle.properties; ?? app_kmp/maestro/f1-signin-home.yaml; ?? app_kmp/maestro/f1-signin-wait.yaml.

## Observation

After the string edit, `vm up ios` ran the build (the new string reached the app), and the clone stayed `app-qa-slot-1`. The guest copy holds the change (grep count 1), and the routed flow passes with the screenshot showing the new string. The rerun's target start waited 165 s for the guest load to settle (simulator recreated while the build had run).

## Verdict

PASS
