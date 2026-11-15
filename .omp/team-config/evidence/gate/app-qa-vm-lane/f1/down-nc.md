# down-nc

Run 2026-11-15T19:51:32+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm down
vm down: this worktree holds no lease
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1b) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm down
vm down: this worktree holds no lease
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1c) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm down
vm down: this worktree holds no lease
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: free
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden"]
[exit 0]
```

Golden disk `~/.lume/app-qa-golden/disk.img` modification time: recorded before F1 1794761145 (2026-11-15 17:45:45); now 1794761145.

`app-qa-build` is the image build VM of `vm-image.md` (step 12: "Keep `app-qa-build` for the next image update, or delete it"), stopped, not a lane clone; no `app-qa-slot-*` name remains. The row's wording "lists only `app-qa-golden`" does not allow for the kept build VM; recorded as a wording finding for the plan, not as a lane defect.

## Observation

After `vm down` in all three scratch worktrees, `vm status` shows both slots free and `lume ls` lists no lane clone (`app-qa-golden` plus the stopped image build VM `app-qa-build`, which `vm-image.md` keeps for image updates); the golden disk's modification time is unchanged (1794761145 before and after). Wording finding: the row says "only `app-qa-golden`".

## Verdict

PASS
