# F1 cfg-newer

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree

## Commands and output

Scratch configuration with its schema id raised to `app-qa/2`.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ grep schema .omp/app-qa.json
  "schema": "app-qa/2",
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
config: ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json: schema app-qa/2 is not app-qa/1, the schema this driver supports; redeploy team config (scripts/deploy-local.sh) to get a driver for it
(exit 2)
```

## Observation

With `schema` `app-qa/2` the driver stopped with exit 2 before any check, naming the file, both schema ids (`app-qa/2` found, `app-qa/1` supported) and the redeploy of team config. Configuration restored afterwards.
