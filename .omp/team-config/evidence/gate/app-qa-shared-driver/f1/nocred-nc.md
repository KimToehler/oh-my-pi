# F1 nocred-nc

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree

## Commands and output

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/plain.yaml --account 1; echo "driver exit $?"; pgrep -fl "maestro.cli.AppKt test" || echo "no maestro test process"
flow: --account needs a credentials section in ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json
driver exit 2
no maestro test process
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/plain.yaml --credentials /tmp/app-qa-impl/scratch-creds.env; echo "driver exit $?"; pgrep -fl "maestro.cli.AppKt test" || echo "no maestro test process"
flow: --credentials needs a credentials section in ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json
driver exit 2
no maestro test process
(exit 0)
```

## Observation

Weaver without a `credentials` section: the flow with `--account 1`, then with `--credentials <scratch file>`, each exited 2 naming the missing `credentials` section and the file, before any Maestro process (none running afterwards; no device or root line printed).
