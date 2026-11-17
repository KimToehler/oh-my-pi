# route-nolease

Run 2026-11-15T17:56:00+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: free
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
lane: this worktree holds no ready lease; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
[exit 2]
```

shim calls: none

## Observation

With no lease (both slots free), `desktop attach` exits 2 naming `vm up desktop`; no lume call.

## Verdict

PASS
