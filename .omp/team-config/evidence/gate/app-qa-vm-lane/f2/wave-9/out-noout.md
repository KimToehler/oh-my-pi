# out-noout

Run 2026-11-17T12:33:50Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -rq`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Host screen locked (`"CGSSessionScreenIsLocked"=Yes`) before and after; run by the parent. Wave 9 is the closing wave of fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`): one script (`/tmp/aqvl/w9/rows.sh`, quoted in `rows-script.md`) ran `hostkey-nc` and then every row that exercises a lane ssh consumer, in order; its own guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `UserKnownHostsFile` = the pin, `HostKeyAlias=app-qa-golden`).

## Commands and output

```
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp && qa.mjs flow ios maestro/f1-signin-home.yaml --account 1 --expect home)  [12:40:57]
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: 034F9F15-BE87-45B6-BA24-5C2C5737D5D7
root: (not kept)
out: $HOST_TMP/app-qa-out-C6vptH
sweep: deleted out/2026-11-17_044100/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-17_044100/maestro.log
sweep: redacted out/2026-11-17_044100/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-17_044100/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/app-qa-out-C6vptH/f1-home.png
PASS f1-signin-home 59.4s
[exit 0]
lock: "CGSSessionScreenIsLocked"=Yes
```

Observation: the flow without `--out` printed a new host folder (`out: $HOST_TMP/app-qa-out-C6vptH`) holding only the named screenshot `f1-home.png` (143453 bytes, mode 0700 folder); no guest path was printed. The screenshot was viewed: signed-in home screen ("Signed in as ...", Running generations, Coach chat, Profile, Logout), no login surface.

Verdict: PASS
