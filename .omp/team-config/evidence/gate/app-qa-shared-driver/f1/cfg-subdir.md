# F1 cfg-subdir

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree

## Commands and output

Preflight desktop from `app/shell/` of the scratch weaver worktree.

cwd `~/git/weaver/.worktrees/qa-shared-f1/app/shell`

```
$ pwd | sed "s|$HOME|~|"; git rev-parse --show-toplevel | sed "s|$HOME|~|"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
~/git/weaver/.worktrees/qa-shared-f1/app/shell
~/git/weaver/.worktrees/qa-shared-f1
PASS driver: spectre 0.9.0
PASS screen capture: granted
PASS screen: unlocked
(exit 0)
```

Control: the same command from `app/shell/` with the scratch worktree's configuration temporarily raised to `app-qa/2`; the refusal names the file read.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ cd ~/git/weaver/.worktrees/qa-shared-f1/app/shell && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
config: ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json: schema app-qa/2 is not app-qa/1, the schema this driver supports; redeploy team config (scripts/deploy-local.sh) to get a driver for it
(exit 2)
```

## Observation

From `app/shell/` of the scratch weaver worktree (a linked worktree of `~/git/weaver`, whose main checkout holds no `.omp/app-qa.json`), preflight desktop printed weaver's desktop checks: the driver, screen-capture and screen lines pass (exit 0), and there is no backend line since weaver's configuration has no `backend` section. The control names the file in force: with that worktree's configuration raised to `app-qa/2`, the same command from the same directory refuses naming `.worktrees/qa-shared-f1/.omp/app-qa.json`. Configuration restored afterwards.
