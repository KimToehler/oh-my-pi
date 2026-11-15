# args-nc

Run 2026-11-15T18:15:02+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1/app_kmp) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop type chat-input '$(id)'
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
type: tag=chat-input textLength=5
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1/app_kmp) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find chat-input --equals '$(id)'
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
tag=chat-input count=1 enabled=true focused=true textLength=5 equals=true
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --credentials /tmp/x
lane: --credentials names a host file; run the command with --host to use it on the host
[exit 2]
```

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios /tmp/aqvl/outside.yaml
flow: /tmp/aqvl/outside.yaml is outside the worktree /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1; the guest holds only the worktree
[exit 2]
```

shim calls for the two refusals: none; guest process count before 876, after 876. The count is a live macOS count that background daemons move; the proof of "no SSH" is the PATH shim, which records every `ssh` and `lume` the driver starts.

## Observation

`$(id)` typed through the lane arrives literally (`textLength=5`, `equals=true` for the same literal), so the guest shell did not evaluate it. `--credentials /tmp/x` and a flow path outside the worktree each exit 2 on the host with no ssh or lume call (shim), and the guest process count is unchanged.

## Verdict

PASS
