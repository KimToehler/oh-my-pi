# cfg-newer

Run 2026-11-15T17:55:31+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

Local config: `schema` set to `app-qa/3`, the rest unchanged.

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
config: ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json: schema app-qa/3 is not one of app-qa/1, app-qa/2, the schemas this driver supports; redeploy team config (scripts/deploy-local.sh) to get a driver for it
[exit 2]
```

shim calls: none

## Observation

Exit 2; the line names `app-qa/3`, both supported ids `app-qa/1`, `app-qa/2` and the redeploy (`scripts/deploy-local.sh`); no check ran, no lume or ssh call.

## Verdict

PASS
