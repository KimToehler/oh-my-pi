# lease-parallel

Run 2026-11-16T15:19Z on head `71072693cc0f650f4ff974c31f164907f4b89d70` (deployed). Also the live check of row 7.7.

Host screen before the first row: `ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*'` printed `"CGSSessionScreenIsLocked"=Yes`.

Before: `vm status` in app-qa-vm-f1 printed `slot 1: free`, `slot 2: free` [exit 0]; `lume ls` listed only app-qa-build and app-qa-golden.

## Simultaneous start (one attempt, no retry)

Both commands started in the background in the same shell loop (start 2026-11-16T15:19:28Z each): `cd ~/git/onara/.worktrees/app-qa-vm-f1 && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios` and the same in `app-qa-vm-f1b`.

### app-qa-vm-f1
```
start 2026-11-16T15:19:28Z
ssh: settle: load 7.73 below 8 CPUs after 261 s
ssh: ios: B63D8F57-C67D-441F-8B16-B3A0472AC6E4
vm up: app-qa-slot-1 holds ios
[exit 0]
end 2026-11-16T15:26:39Z
```

### app-qa-vm-f1b
```
start 2026-11-16T15:19:28Z
ssh: settle: load 7.91 below 8 CPUs after 261 s
ssh: ios: 18806BEF-0176-4267-8864-872AEFC1F864
vm up: app-qa-slot-2 holds ios
[exit 0]
end 2026-11-16T15:27:32Z
```

## `lume ls` while both starts ran

Sampled every ~30 s from 15:19:48Z (filter: `lume ls | awk '{print $1,$6,$10}'`, which printed the name, display and shared_dirs columns; the name column is what matters). Clone app-qa-slot-1 is listed from the first sample, app-qa-slot-2 from 15:20:19Z (after both clones existed, every sample from 15:20:19Z to 15:22:41Z lists both). Lines like `VNC-disabled it` are lume stderr noise.
```
lume ls 2026-11-16T15:19:48Z
name display shared_dirs
app-qa-build 1024x768 -
app-qa-golden 1024x768 -
app-qa-slot-1 1024x768 -
lume ls 2026-11-16T15:20:19Z
[2026-11-16T15:20:22Z] VNC-disabled it
name display shared_dirs
app-qa-build 1024x768 -
app-qa-golden 1024x768 -
app-qa-slot-1 1024x768 -
app-qa-slot-2 1024x768 -
lume ls 2026-11-16T15:20:53Z
name display shared_dirs
app-qa-build 1024x768 -
app-qa-golden 1024x768 -
app-qa-slot-1 1024x768 -
app-qa-slot-2 1024x768 -
lume ls 2026-11-16T15:21:29Z
[2026-11-16T15:21:32Z] VNC-disabled it
[2026-11-16T15:21:34Z] VNC-disabled it
name display shared_dirs
app-qa-build 1024x768 -
app-qa-golden 1024x768 -
app-qa-slot-1 1024x768 -
app-qa-slot-2 1024x768 -
lume ls 2026-11-16T15:22:06Z
name display shared_dirs
app-qa-build 1024x768 -
app-qa-golden 1024x768 -
app-qa-slot-1 1024x768 -
app-qa-slot-2 1024x768 -
lume ls 2026-11-16T15:22:41Z
[2026-11-16T15:22:44Z] VNC-disabled it
name display shared_dirs
app-qa-build 1024x768 -
app-qa-golden 1024x768 -
app-qa-slot-1 1024x768 -
app-qa-slot-2 1024x768 -
```

Full `lume ls` after both starts finished (15:29Z, after the flows):
```
name                                    os      cpu     memory  disk            display     status                      network     storage         shared_dirs                
app-qa-build                            macOS   8       16.00G  47.5GB/160.0GB  1024x768    stopped                     nat         home            -                          
app-qa-golden                           macOS   8       16.00G  47.5GB/160.0GB  1024x768    stopped                     nat         home            -                          
app-qa-slot-1                           macOS   8       16.00G  61.4GB/160.0GB  1024x768    running                     nat         home            -                          
app-qa-slot-2                           macOS   8       16.00G  59.5GB/160.0GB  1024x768    running                     nat         home            -                          
```

## Sign-in flows at the same time (fresh leases, one sign-in each)

Both started in the background together at 2026-11-16T15:27:40Z: `cd ~/git/onara/.worktrees/app-qa-vm-f1[b] && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home`.

### app-qa-vm-f1
```
start 2026-11-16T15:27:40Z
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: B63D8F57-C67D-441F-8B16-B3A0472AC6E4
root: (not kept)
out: $HOST_TMP/app-qa-out-zjUUY4
sweep: deleted out/2026-11-16_072745/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-16_072745/maestro.log
sweep: redacted out/2026-11-16_072745/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-16_072745/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/app-qa-out-zjUUY4/f1-home.png
PASS f1-signin-home 53.2s
[exit 0]
end 2026-11-16T15:29:13Z
```

### app-qa-vm-f1b
```
start 2026-11-16T15:27:40Z
lane: flow ios runs in app-qa-slot-2 (slot 2)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: 18806BEF-0176-4267-8864-872AEFC1F864
root: $HOST_TMP/app-qa-root-uyvgzj
out: $HOST_TMP/app-qa-out-PZG2uh
sweep: deleted out/2026-11-16_072744/f1-signin-home/commands.json
FAIL f1-signin-home 39.1s: Assertion is false: "Username or email" is visible
root kept: $HOST_TMP/app-qa-root-uyvgzj
lane: app-qa-slot-2: the guest command exited 1; to restart the app, simulator or forward run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 1]
end 2026-11-16T15:28:59Z
```

## Observation

Both `vm up ios` of the one simultaneous attempt exited 0 (slot 1 at 15:26:39Z, slot 2 at 15:27:32Z, about 7-8 minutes each on the loaded host): the 7.7 failure of wave 4 (exit 2 after 180 s, no ssh) did not occur. Two clones were listed in `lume ls`. The flows ran at the same time: f1 `PASS f1-signin-home 53.2s`; f1b FAIL after 39.1s at `Assertion is false: "Username or email" is visible` (the sign-in form did not appear in time in that guest; the driver printed the kept root and the infrastructure line, no screenshot or hierarchy was taken or read by me, and the kept root was not opened). The row requires both flows to PASS, so it is not met. The flow was not retried inside this row.

Verdict: FAIL
