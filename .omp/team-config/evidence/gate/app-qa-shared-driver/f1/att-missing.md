# F1 att-missing

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree

## Commands and output

No weaver `:shell` JVM running.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ pgrep -f 'eu.weaver.app.shell.MainKt' | wc -l
       0
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach; echo "attach exit $?"
attach: no eu.weaver.app.shell.MainKt JVM in this worktree (~/git/weaver/.worktrees/qa-shared-f1); start it with ./gradlew :shell:run in app/
attach exit 2
(exit 0)
```

## Observation

No weaver `:shell` JVM running: attach printed weaver's configured launch hint (`./gradlew :shell:run in app/`), exit 2.
