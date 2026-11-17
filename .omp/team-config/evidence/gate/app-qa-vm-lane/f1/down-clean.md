# down-clean

Run 2026-11-15T18:16:26+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=desktop forward=22389 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm down
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden"]
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) pgrep -fl '^/usr/bin/ssh -N -R' || echo no-forward
no-forward
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: free
slot 2: free
[exit 0]
```

## Observation

`vm down` deletes the clone (`lume ls` lists only `app-qa-build` and `app-qa-golden`), no `ssh -R` forward remains, and `vm status` shows both slots free.

## Verdict

PASS
