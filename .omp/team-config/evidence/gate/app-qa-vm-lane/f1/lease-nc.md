# lease-nc

Run 2026-11-15T18:41:58+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden","app-qa-slot-1","app-qa-slot-2"]
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1c) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
vm up: no free slot; every slot is held or used within 30 min:
  slot 1: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 (ready, last used less than a minute ago)
  slot 2: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b (ready, last used less than a minute ago)
[exit 2]
```

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden","app-qa-slot-1","app-qa-slot-2"]
[exit 0]
```

## Observation

With both slots held by fresh leases, the third worktree's `vm up ios` exits 2 naming both holders (f1 and f1b with their state and last use); `lume ls` names are unchanged.

## Verdict

PASS
