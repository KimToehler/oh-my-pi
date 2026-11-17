# reclaim-idle

Run 2026-11-15T18:57:04+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

Lane file `idleMinutes` set to 1 for this row (restored to 30 afterwards).

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=83705 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=ios forward=52318 holder=none busy=none last used 8 min ago
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden","app-qa-slot-1","app-qa-slot-2"]
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1c) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
lane: reclaimed slot 2: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b (idle since 2026-11-15T17:41:24.605Z); deleted app-qa-slot-2
ssh: settle: load 7.81 below 8 CPUs after 251 s
ssh: ios: D9D073C6-0F91-4707-8955-5E2B54542BF3
vm up: app-qa-slot-2 holds ios
[exit 0]
```

vm up took 446 s.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=83705 holder=none busy=none last used 7 min ago
slot 2: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=ios forward=11337 holder=none busy=none last used less than a minute ago
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden","app-qa-slot-1","app-qa-slot-2"]
[exit 0]
```

## Observation

With `idleMinutes: 1`, slot 1 used less than a minute before and slot 2's lease idle for 8 minutes, `vm up ios` in a third worktree prints `lane: reclaimed slot 2: ... app-qa-vm-f1b (idle since ...); deleted app-qa-slot-2` and stages slot 2 for `app-qa-vm-f1c` (a new clone of the image, settled after 251 s); `vm status` shows the new holder.

## Verdict

PASS
