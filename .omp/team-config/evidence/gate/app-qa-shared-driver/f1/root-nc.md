# F1 root-nc

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree

## Commands and output

An existing output directory.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ mkdir -p /tmp/app-qa-impl/f1out/existing && touch /tmp/app-qa-impl/f1out/existing/keep.txt && stat -f "%z %Sm %N" /tmp/app-qa-impl/f1out/existing/*
0 Nov  8 20:22:43 2026 /tmp/app-qa-impl/f1out/existing/keep.txt
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/shot.yaml --out /tmp/app-qa-impl/f1out/existing; echo "driver exit $?"; pgrep -fl "maestro.cli.AppKt test" || echo "no maestro test process"
flow: --out /tmp/app-qa-impl/f1out/existing exists; name a directory that does not exist yet
driver exit 2
no maestro test process
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ stat -f "%z %Sm %N" /tmp/app-qa-impl/f1out/existing/*
0 Nov  8 20:22:43 2026 /tmp/app-qa-impl/f1out/existing/keep.txt
(exit 0)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: root keeps no step screenshot after a pass or a failure`

## Observation

`--out` naming an existing directory: exit 2 naming it, before any Maestro process; the directory's listing is unchanged. A step screenshot surviving is *test* `flow: root keeps no step screenshot after a pass or a failure` in `f1/qa-test-log.txt`.
