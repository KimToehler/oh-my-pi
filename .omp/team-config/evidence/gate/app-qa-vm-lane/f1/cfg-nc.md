# cfg-nc

Run 2026-11-15T17:55:39+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

Case: `desktop.mainClass` misspelled `mainClas`.

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: desktop.mainClas: unknown key
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: desktop.mainClass: missing
[exit 2]
```

shim calls: none

Case: `vm` under `app-qa/1`.

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: vm: unknown key
[exit 2]
```

shim calls: none

Case: the file removed.

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: missing
[exit 2]
```

shim calls: none

## Observation

Each case exits 2 with only `config:` lines; no PASS/FAIL check line, no lume or ssh call.

## Verdict

PASS
