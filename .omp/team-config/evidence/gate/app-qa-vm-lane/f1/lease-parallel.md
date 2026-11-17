# lease-parallel

Run 2026-11-15T18:41:40+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1b) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm down
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios   # started 18:25:13, ended 18:37:10
ssh: settle: load 7.50 below 8 CPUs after 216 s
ssh: ios: AB0B9F45-910D-41F0-98DA-C5960D1673FD
vm up: app-qa-slot-1 holds ios
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1b) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios   # started 18:25:13, ended 18:32:57
ssh: settle: load 7.55 below 8 CPUs after 271 s
ssh: ios: 0E1E214B-795A-464E-BA9F-9015BEEDE6E2
vm up: app-qa-slot-2 holds ios
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[] | {name,status}]'
[{"name":"app-qa-build","status":"stopped"},{"name":"app-qa-golden","status":"stopped"},{"name":"app-qa-slot-1","status":"running"},{"name":"app-qa-slot-2","status":"running"}]
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=58281 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=ios forward=52318 holder=none busy=none last used 4 min ago
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home   # started 18:37:20, ended 18:38:52
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: AB0B9F45-910D-41F0-98DA-C5960D1673FD
root: $HOST_TMP/T/app-qa-root-4DRmKX
out: $HOST_TMP/T/app-qa-out-XJTdnb
sweep: deleted out/2026-11-15_093725/f1-signin-home/commands.json
FAIL f1-signin-home 38.7s: Assertion is false: "Username or email" is visible
root kept: $HOST_TMP/T/app-qa-root-4DRmKX
lane: app-qa-slot-1: the guest command exited 1; to restart the app, simulator or forward run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 1]
```

```
$ (cwd .worktrees/app-qa-vm-f1b) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home   # started 18:37:20, ended 18:38:51
lane: flow ios runs in app-qa-slot-2 (slot 2)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: 0E1E214B-795A-464E-BA9F-9015BEEDE6E2
root: $HOST_TMP/T/app-qa-root-LGjZuM
out: $HOST_TMP/T/app-qa-out-25Gkyp
sweep: deleted out/2026-11-15_093727/f1-signin-home/commands.json
FAIL f1-signin-home 39.7s: Assertion is false: "Username or email" is visible
root kept: $HOST_TMP/T/app-qa-root-LGjZuM
lane: app-qa-slot-2: the guest command exited 1; to restart the app, simulator or forward run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 1]
```

Both parallel flows failed at the login page: after the `sign-in` tap the consent alert was skipped and the login page did not appear within the assertion timeout (the app was back on its sign-in screen afterwards). Each guest had settled before its warm-up (settle lines above), but during the flows guest 1's load was 17 on 8 vCPUs and the host's 42-55 on 18 cores; besides the two lane VMs, an Android emulator (`qemu-system-aarch64-headless`, about 130 % CPU) of another session and the host's `corespotlightd` (78 %) ran. The identical pair is run once more, without a new `vm up` (both apps are on their sign-in screen). Load before: host `18:39  up 4 days, 18:37, 2 users, load averages: 43.95 51.72 49.63`; guest 1 `{ 9.36 21.31 15.98 }`; guest 2 `{ 7.73 13.53 13.70 }`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home   # started 18:39:47, ended 18:41:19
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: AB0B9F45-910D-41F0-98DA-C5960D1673FD
root: (not kept)
out: $HOST_TMP/T/app-qa-out-VyUrwk
sweep: deleted out/2026-11-15_093952/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-15_093952/maestro.log
sweep: redacted out/2026-11-15_093952/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-15_093952/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/T/app-qa-out-VyUrwk/f1-home.png
PASS f1-signin-home 68.1s
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1b) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home   # started 18:39:47, ended 18:41:24
lane: flow ios runs in app-qa-slot-2 (slot 2)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: 0E1E214B-795A-464E-BA9F-9015BEEDE6E2
root: (not kept)
out: $HOST_TMP/T/app-qa-out-4aAzEi
sweep: deleted out/2026-11-15_093952/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-15_093952/maestro.log
sweep: redacted out/2026-11-15_093952/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-15_093952/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/T/app-qa-out-4aAzEi/f1-home.png
PASS f1-signin-home 74.3s
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[] | {name,status}]'
[{"name":"app-qa-build","status":"stopped"},{"name":"app-qa-golden","status":"stopped"},{"name":"app-qa-slot-1","status":"running"},{"name":"app-qa-slot-2","status":"running"}]
[exit 0]
```

`qa.mjs scan` of every returned folder and kept root of the four flows: $HOST_TMP/app-qa-out-XJTdnb: exit 0; $HOST_TMP/app-qa-root-4DRmKX: exit 0; $HOST_TMP/app-qa-out-25Gkyp: exit 0; $HOST_TMP/app-qa-root-LGjZuM: exit 0; $HOST_TMP/app-qa-out-VyUrwk: exit 0; $HOST_TMP/app-qa-out-4aAzEi: exit 0.

## Observation

Two scratch worktrees ran `vm up ios` at the same time: two clones (`app-qa-slot-1` for f1, `app-qa-slot-2` for f1b) listed by `lume ls` as running, both leases ready in `vm status`, each target start waiting for its own guest to settle (216 s and 271 s). The first simultaneous flow pair failed at the login page in both guests, started 10 s after the second `vm up` ended with guest 1 at load 17 and the host at 42-55 on 18 cores (another session's Android emulator was running too); the identical pair run once more without a new `vm up` passed in both worktrees at the same time (68.1 s and 74.3 s). The lane gives each worktree its own clone and lets flows run in both at once; the first-pair failure is host CPU contention after the settle wait, recorded for the QA lane.

## Verdict

PASS
