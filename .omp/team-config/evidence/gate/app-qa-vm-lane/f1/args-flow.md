# args-flow

Run 2026-11-15T18:49:16+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
ssh: settle: load 7.71 below 8 CPUs after 210 s
ssh: ios: CF29F773-E4E9-4EC1-9633-E0531C587C02
vm up: app-qa-slot-1 holds ios
[exit 0]
```

vm up took 300 s (resets the sign-in state).

```
$ (cwd .worktrees/app-qa-vm-f1/app_kmp) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios maestro/f1-signin-home.yaml --account 1 --expect home
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: CF29F773-E4E9-4EC1-9633-E0531C587C02
root: (not kept)
out: $HOST_TMP/T/app-qa-out-URO2qs
sweep: deleted out/2026-11-15_094814/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-15_094814/maestro.log
sweep: redacted out/2026-11-15_094814/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-15_094814/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/T/app-qa-out-URO2qs/f1-home.png
PASS f1-signin-home 43.2s
[exit 0]
```

`qa.mjs scan` of the returned folder: exit 0.

## Observation

From `app_kmp/`, `flow ios maestro/f1-signin-home.yaml` (path relative to `app_kmp/`) was routed to slot 1, ran on the guest device and passed, with its named screenshot returned.

## Verdict

PASS
