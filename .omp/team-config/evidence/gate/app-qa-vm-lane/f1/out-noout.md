# out-noout

Run 2026-11-15T18:05:42+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*'
"CGSSessionScreenIsLocked"=Yes
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: 69D74232-E8D2-48CD-A535-08C79FD75552
root: (not kept)
out: $HOST_TMP/T/app-qa-out-OfvFmS
sweep: deleted out/2026-11-15_090402/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-15_090402/maestro.log
sweep: redacted out/2026-11-15_090402/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-15_090402/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/T/app-qa-out-OfvFmS/f1-home.png
PASS f1-signin-home 54.6s
[exit 0]
```

Flow took 87 s. It is the first flow on this fresh clone (`vm up ios` of `stage-first`, which waited 231 s for the guest to settle).

```
$ (cwd .worktrees/app-qa-vm-f1) ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*'
"CGSSessionScreenIsLocked"=Yes
[exit 0]
```

`qa.mjs scan` of the returned folder: exit 0. Screenshot kept as `locked-ios-home.png`: the signed-in home screen ("Signed in as …", "Running generations", "Coach chat").

## Observation

A routed flow without `--out` returns its named screenshot into a new host folder that it prints (the folder holds only `f1-home.png`); no guest path is printed.

## Verdict

PASS
