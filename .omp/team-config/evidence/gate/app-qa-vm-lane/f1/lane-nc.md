# lane-nc

Run 2026-11-15T17:55:53+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden"]
[exit 0]
```

Lane file case: misspelled key `imge`.

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
lane: ~/.omp/agent/app-qa-vm.json: imge: unknown key
lane: ~/.omp/agent/app-qa-vm.json: image: missing
[exit 2]
```

shim calls: none

Lane file case: without `image`.

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
lane: ~/.omp/agent/app-qa-vm.json: image: missing
[exit 2]
```

shim calls: none

Lane file case: `image: app-qa-slot-golden`.

```
$ (cwd .worktrees/app-qa-vm-f1) PATH=/tmp/aqvl/shim:$PATH node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
lane: ~/.omp/agent/app-qa-vm.json: image: "app-qa-slot-golden" lies in app-qa-slot-, the namespace of the lane's clones
[exit 2]
```

shim calls: none

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden"]
[exit 0]
```

## Observation

Each invalid lane file exits 2 naming the lane file and the cause; `lume ls` names are unchanged.

## Verdict

PASS
